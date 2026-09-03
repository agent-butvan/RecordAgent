# 桌面端发布指南

## 版本约定

根目录 `VERSION` 是桌面端版本唯一来源。发布新版本时，只编辑该文件，并执行：

```bash
node scripts/sync-version.mjs
pnpm --dir agent-frontend run version:check
```

该命令会将版本同步到 `agent-frontend/package.json` 与
`agent-frontend/src-tauri/tauri.conf.json`。CI 会拒绝三者不一致的构建。

## 验证与发布

- `.github/workflows/verify-desktop.yml`：每个 PR 和向 `develop` 的推送，分别在 macOS Apple Silicon、macOS Intel、Linux、Windows 构建桌面包，并启动 sidecar 验证 `/api/health`。
- `.github/workflows/release.yml`：只接受完整 SemVer tag，例如 `v0.1.1`。也可在 Actions 页面手动输入一个已推送的 tag。
- 发布工作流会校验 tag 与 `VERSION`，再构建、验证 sidecar，最后上传到草稿 GitHub Release。发布者确认后再手动点击 Publish release。

推荐步骤：

```bash
# 1. 编辑 VERSION，例如 0.1.1
node scripts/sync-version.mjs
git add VERSION agent-frontend/package.json agent-frontend/src-tauri/tauri.conf.json
git commit -m "chore(release): v0.1.1"
git tag -a v0.1.1 -m "v0.1.1"
git push <正式发布远端> develop v0.1.1
```

仅推送分支不会创建 Release，必须将 tag 推送到正式发布远端。当前仓库存在 `origin` 与 `openagent-van` 两个远端，发布前必须确认目标。

## 签名

macOS 已预留以下 GitHub Secrets：`APPLE_CERTIFICATE`、`APPLE_CERTIFICATE_PASSWORD`、`APPLE_SIGNING_IDENTITY`、`APPLE_ID`、`APPLE_PASSWORD`、`APPLE_TEAM_ID`。配置后 CI 会自动执行签名与公证；未配置时仍可构建，但用户会看到 Gatekeeper 警告。

Windows Authenticode 签名需要采购证书并配置 Tauri 的 Windows 签名命令后再启用；在此之前，SmartScreen 警告仍属预期行为。
