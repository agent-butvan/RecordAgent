//! 后端 sidecar 生命周期管理
//!
//! 负责在应用启动时拉起 Spring Boot 后端、等待健康检查通过，
//! 将动态分配的端口暴露给前端，并在应用退出时关闭后端进程。

use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::Mutex;
use std::thread;
use std::time::{Duration, Instant};

use log::{error, info, warn};
use tauri::{AppHandle, Manager, State};
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

/// 后端进程与端口共享状态（通过 Tauri 状态管理注入）
pub struct BackendState {
    /// 健康检查通过后写入端口，前端通过 `get_backend_port` 命令读取
    pub port: Mutex<Option<u16>>,
    /// sidecar 子进程句柄，应用退出时用于关闭后端
    pub child: Mutex<Option<CommandChild>>,
}

impl Default for BackendState {
    fn default() -> Self {
        Self {
            port: Mutex::new(None),
            child: Mutex::new(None),
        }
    }
}

/// 前端查询后端运行模式：开发模式直接连本地 8081，打包模式等待 sidecar 就绪
#[tauri::command]
pub fn get_backend_mode() -> &'static str {
  if cfg!(debug_assertions) {
    "dev"
  } else {
    "sidecar"
  }
}

/// 前端查询后端动态端口；未就绪时返回 null
#[tauri::command]
pub fn get_backend_port(state: State<'_, BackendState>) -> Option<u16> {
    *state.port.lock().unwrap()
}

/// 在应用 setup 阶段启动后端 sidecar，并在后台线程等待其就绪
pub fn setup(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    app.manage(BackendState::default());

    let port = pick_free_port();
    info!("分配后端动态端口：{port}");

    let sidecar = app.shell().sidecar("butvan-backend")?;
    let (mut rx, child) = sidecar
        .args([
            format!("--server.port={port}"),
            "--server.address=127.0.0.1".to_string(),
        ])
        .spawn()
        .map_err(|e| format!("后端 sidecar 启动失败：{e}"))?;

    let state = app.state::<BackendState>();
    *state.child.lock().unwrap() = Some(child);

    // 后台线程轮询 /api/health，就绪后把端口写入状态供前端读取
    let handle = app.clone();
    thread::spawn(move || {
        let ready = wait_until_ready(port, Duration::from_secs(60));
        if ready {
            if let Some(state) = handle.try_state::<BackendState>() {
                *state.port.lock().unwrap() = Some(port);
            }
            info!("后端 sidecar 已就绪，端口：{port}");
        } else {
            error!("后端 sidecar 60 秒内未就绪，端口：{port}");
        }
    });

    // 转发子进程标准输出/错误到应用日志，避免管道积压阻塞
    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(line) | CommandEvent::Stderr(line) => {
                    let text = String::from_utf8_lossy(&line);
                    let text = text.trim_end();
                    if !text.is_empty() {
                        info!("[backend] {text}");
                    }
                }
                CommandEvent::Terminated(payload) => {
                    warn!("后端 sidecar 已退出：code={:?}", payload.code);
                }
                _ => {}
            }
        }
    });

    Ok(())
}

/// 应用退出时关闭后端进程
pub fn shutdown(app: &AppHandle) {
    if let Some(state) = app.try_state::<BackendState>() {
        if let Some(child) = state.child.lock().unwrap().take() {
            let _ = child.kill();
            info!("后端 sidecar 已随应用退出关闭");
        }
    }
}

/// 在 127.0.0.1 上分配一个空闲端口
fn pick_free_port() -> u16 {
    let listener = TcpListener::bind(("127.0.0.1", 0)).expect("无法分配空闲端口");
    listener.local_addr().expect("读取端口失败").port()
}

/// 轮询后端健康检查接口，直到返回 HTTP 200 或超时
fn wait_until_ready(port: u16, timeout: Duration) -> bool {
    let deadline = Instant::now() + timeout;
    while Instant::now() < deadline {
        if probe_health(port) {
            return true;
        }
        thread::sleep(Duration::from_millis(400));
    }
    false
}

/// 向 /api/health 发送最小 HTTP GET 请求，返回是否收到 200 响应
fn probe_health(port: u16) -> bool {
    let Ok(addr) = format!("127.0.0.1:{port}").parse::<std::net::SocketAddr>() else {
        return false;
    };
    let Ok(mut stream) = TcpStream::connect_timeout(&addr, Duration::from_millis(400)) else {
        return false;
    };
    let _ = stream.set_read_timeout(Some(Duration::from_millis(400)));

    let request = format!(
        "GET /api/health HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\nConnection: close\r\n\r\n"
    );
    if stream.write_all(request.as_bytes()).is_err() {
        return false;
    }

    let mut buf = [0u8; 256];
    let Ok(n) = stream.read(&mut buf) else {
        return false;
    };
    String::from_utf8_lossy(&buf[..n]).starts_with("HTTP/1.1 200")
}
