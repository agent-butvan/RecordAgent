---
version: 1
slug: "agent-frontend-src-components-layout-sidebar-tsx"
primary_target: "agent-frontend/src/components/layout/Sidebar.tsx"
related_targets: []
---

# Sidebar 表面简报

- **scope / mode**：左侧会话历史侧边栏；Operate（桌面端常驻导航）。
- **audience / job**：开发者每天多次回溯、切换、创建会话；任务 = 快速找到目标会话并进入，或新建对话。
- **action / task**：顶部“新建聊天”主操作 → 搜索框精确过滤 → 项目分区/时间分组（今天/昨天/近7天/近30天/更早）定位 → 悬停“…”菜单重命名/删除；底部用户信息与设置。
- **proof / content**：真实会话数据来自后端 sessions/projects（createdAt/updatedAt 驱动时间分组与排序）；无假数据。
- **constraints**：全局扁平 1px 描边体系；Inter 字族；lucide 图标；CSS Modules；固定 260px 宽度；不引入通用组件库。
- **constraints（更新）**：侧边栏右缘可拖拽调整宽度（220–400px，默认 260px，localStorage 记忆，双击手柄恢复默认）；无边框无阴影；底部个人信息区为 40px 行高、32px 头像 + 设置图标按钮。
- **chosen direction**：ChatGPT 官方会话历史布局 + Codex 式新建入口（用户钉定）；OWN-WORLD = 近白冷灰 #F7F8FA 纯平面，无边框无阴影，8-10px 圆角，蓝色仅作文件夹与焦点色；选中态仅文字变黑。
- **memorable moment**：会话列表标题行右侧编辑图标一键新建普通聊天；悬停会话项浮现“…”菜单，Portal 定位浮层不裁剪，重命名/删除一气呵成。
- **unresolved**：DESIGN.md 全局文档是否按本次侧边栏刷新（refresh/merge/overwrite 待用户确认）；项目分区与时间分组是否长期共存（已按推荐方案保留）。
