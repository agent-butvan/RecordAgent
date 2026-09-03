#!/usr/bin/env bash
#
# ButvanAgent 一键打包脚本
# 运行后产出桌面端最终安装包（macOS: .app/.dmg；Linux: AppImage/.deb；Windows: .msi/.exe）
#
# 用法:
#   ./scripts/build-app.sh                     # release 打包（默认）
#   ./scripts/build-app.sh --debug             # debug 构建（快速验证用）
#   ./scripts/build-app.sh --bundles dmg,app   # 指定安装包格式
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_DIR="$ROOT_DIR/agent-frontend"

DEBUG_MODE=0
BUNDLES=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --debug)
      DEBUG_MODE=1
      shift
      ;;
    --bundles)
      if [[ $# -lt 2 ]]; then
        echo "--bundles 需要一个参数（如 dmg,app）" >&2
        exit 1
      fi
      BUNDLES="$2"
      shift 2
      ;;
    -h | --help)
      sed -n '2,12p' "$0"
      exit 0
      ;;
    *)
      echo "未知参数: $1（可用 --debug / --bundles <格式>）" >&2
      exit 1
      ;;
  esac
done

# ---- 前置检查 ----
for CMD in node pnpm cargo rustc java mvn; do
  if ! command -v "$CMD" >/dev/null 2>&1; then
    echo "缺少依赖: $CMD（请先安装并确保在 PATH 中）" >&2
    exit 1
  fi
done
echo "==> 0/4 前置检查通过（node / pnpm / cargo / rustc / java / mvn）"

echo "==> 1/4 校验版本一致性"
node "$ROOT_DIR/scripts/sync-version.mjs" --check

cd "$FRONTEND_DIR"

if [ ! -d node_modules ]; then
  echo "==> 2/4 安装前端依赖"
  pnpm install
else
  echo "==> 2/4 前端依赖已就绪"
fi

# ---- 组装 tauri build 参数 ----
TAURI_ARGS=()
if [ "$DEBUG_MODE" = "1" ]; then
  TAURI_ARGS+=(--debug)
  echo "==> 3/4 开始 debug 打包（快速验证用，不推荐分发）"
else
  echo "==> 3/4 开始 release 打包（自动先生成后端 sidecar）"
fi
if [ -n "$BUNDLES" ]; then
  TAURI_ARGS+=(--bundles "$BUNDLES")
  echo "    指定安装包格式: $BUNDLES"
fi

# beforeBuildCommand 会自动执行后端 sidecar 打包 + 前端构建
echo "==> 4/4 执行 pnpm tauri build"
if [ ${#TAURI_ARGS[@]} -gt 0 ]; then
  pnpm tauri build "${TAURI_ARGS[@]}"
else
  pnpm tauri build
fi

# ---- 输出产物位置 ----
PROFILE_DIR="$FRONTEND_DIR/src-tauri/target"
if [ "$DEBUG_MODE" = "1" ]; then
  PROFILE_DIR="$PROFILE_DIR/debug"
else
  PROFILE_DIR="$PROFILE_DIR/release"
fi

echo ""
echo "打包完成，产物："
find "$PROFILE_DIR/bundle" \
  \( -type f \( -name '*.dmg' -o -name '*.deb' -o -name '*.AppImage' -o -name '*.msi' -o -name '*.exe' \) \
  -o -type d -name '*.app' \) 2>/dev/null | sed 's/^/  /'
echo "目录：$PROFILE_DIR/bundle/"
