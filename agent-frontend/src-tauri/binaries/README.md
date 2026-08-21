# 后端 sidecar 产物目录

本目录存放 Tauri `externalBin` 引用的后端 sidecar 产物：

| 文件 | 说明 | 是否入库 |
| --- | --- | --- |
| `butvan-backend-<target-triple>` | 启动器：macOS/Linux 为 sh 脚本（入库），Windows 为 Rust 编译的 exe（不入库，CI 生成） | 视平台 |
| `butvan-backend.jar` | Spring Boot 可执行 fat jar | 否（gitignore） |
| `butvan-backend-runtime/` | jlink 生成的最小 JRE | 否（gitignore） |

生成方式：

```bash
./agent-backend/scripts/package-sidecar.sh
```

产物布局遵循 Tauri externalBin 约定：文件名必须带
`-<target-triple>` 后缀（例如 `butvan-backend-aarch64-apple-darwin`、
`butvan-backend-x86_64-pc-windows-msvc.exe`），打包时 Tauri 会自动去掉后缀并放入应用资源目录。

注意：
- 修改 macOS/Linux 的 sh 启动器脚本后，请同步更新
  `agent-backend/scripts/package-sidecar.sh` 中的生成逻辑，保持两者一致。
- Windows 原生启动器源码位于 `scripts/backend-launcher/`，由打包脚本在 Windows 上编译生成。
