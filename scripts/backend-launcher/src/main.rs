//! ButvanAgent 后端 sidecar 原生启动器
//!
//! Tauri `externalBin` 在 Windows 上要求真正的可执行文件（.exe），
//! 不能使用 shell 脚本。该启动器负责定位自身同目录 / 资源目录下的
//! `butvan-backend.jar` 与 jlink 最小 JRE，并以透传参数拉起 Spring Boot 后端。
//!
//! 打包脚本当前仅在 Windows 目标上生成该 exe；macOS / Linux 使用 sh 启动器。

use std::env;
use std::path::{Path, PathBuf};
use std::process::{Command, ExitCode};

/// 获取 JRE 下的 java 可执行文件名
fn java_name() -> &'static str {
    if cfg!(windows) {
        "java.exe"
    } else {
        "java"
    }
}

/// 候选资源目录：自身所在目录（dev / Linux / Windows 安装目录）、
/// 上级 Resources 目录（macOS 打包布局）、同级 resources 目录
fn candidates(exe_dir: &Path) -> Vec<PathBuf> {
    let mut dirs = vec![exe_dir.to_path_buf()];
    if let Some(parent) = exe_dir.parent() {
        dirs.push(parent.join("Resources"));
    }
    dirs.push(exe_dir.join("resources"));
    dirs
}

/// 检查目录下是否包含可用的后端运行时
fn locate(dir: &Path) -> Option<(PathBuf, PathBuf)> {
    let java = dir.join("butvan-backend-runtime").join("bin").join(java_name());
    let jar = dir.join("butvan-backend.jar");
    if java.is_file() && jar.is_file() {
        Some((java, jar))
    } else {
        None
    }
}

fn main() -> ExitCode {
    let Ok(exe) = env::current_exe() else {
        eprintln!("[butvan-backend-launcher] 无法定位自身路径");
        return ExitCode::FAILURE;
    };
    let Some(exe_dir) = exe.parent() else {
        eprintln!("[butvan-backend-launcher] 无法定位启动器目录");
        return ExitCode::FAILURE;
    };

    let mut found = None;
    for dir in candidates(exe_dir) {
        if let Some((java, jar)) = locate(&dir) {
            found = Some((java, jar));
            break;
        }
    }

    let Some((java, jar)) = found else {
        eprintln!(
            "[butvan-backend-launcher] 未找到 butvan-backend.jar 或 butvan-backend-runtime，请先执行 agent-backend/scripts/package-sidecar.sh"
        );
        return ExitCode::FAILURE;
    };

    match Command::new(java)
        .arg("-jar")
        .arg(jar)
        .args(env::args().skip(1))
        .status()
    {
        Ok(status) => ExitCode::from(status.code().unwrap_or(1) as u8),
        Err(err) => {
            eprintln!("[butvan-backend-launcher] 启动后端失败：{err}");
            ExitCode::FAILURE
        }
    }
}
