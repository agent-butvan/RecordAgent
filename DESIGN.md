---
name: ButvanAgent Design System
description: 极简冰蓝灰桌面端多厂商 Agent 工作区设计规范
colors:
  primary: "#2563eb"
  primary-hover: "#1d4ed8"
  accent-purple: "#9333ea"
  sidebar-bg: "#e5e9ee"
  sidebar-hover: "#dce1e7"
  sidebar-active: "#d3d9e0"
  neutral-bg: "#ffffff"
  neutral-surface: "#f8f9fa"
  neutral-text: "#111827"
  neutral-muted: "#4b5563"
  border-subtle: "#e5e7eb"
  border-medium: "#d1d5db"
typography:
  display:
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "26px"
    fontWeight: 700
  body:
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "14px"
    fontWeight: 400
  code:
    fontFamily: "'JetBrains Mono', monospace"
    fontSize: "12px"
    fontWeight: 500
rounded:
  sm: "6px"
  md: "10px"
  lg: "14px"
  xl: "18px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.neutral-bg}"
    rounded: "{rounded.full}"
    padding: "6px 16px"
  button-new-chat:
    backgroundColor: "{colors.neutral-bg}"
    textColor: "{colors.neutral-text}"
    rounded: "{rounded.md}"
    padding: "9px 12px"
  input-capsule:
    backgroundColor: "{colors.neutral-bg}"
    textColor: "{colors.neutral-text}"
    rounded: "{rounded.xl}"
    padding: "14px 18px"
---

# Design System: ButvanAgent

## Overview

**Creative North Star: "The Iceberg Workspace" (冰山极简工作区)**

ButvanAgent 旨在提供一种沉稳、透亮、低干扰的桌面端 AI Agent 交互环境。视觉系统借鉴了经典的 Codex 冰蓝灰桌面壳层，将绝大部分 UI 隐藏在视线背后，如同冰山沉浸在水面之下，仅把最核心的对话视窗与悬浮输入胶囊显露于水面之上。

设计遵循高对比度、清晰卡片层次与轻量阴影浮雕，避免过度刺眼的色彩装饰，让用户的注意力始终聚焦在 Agent 输出的代码与思维推理过程上。

**Key Characteristics:**
- **冰清透亮**: 采用冰蓝灰侧边栏 (`#E5E9EE`) 与纯白画板 (`#FFFFFF`) 呈现干净的冰山层次。
- **胶囊浮雕**: 底部 Floating Capsule 输入框搭配微羽化阴影 (`0 8px 30px rgba(0,0,0,0.08)`).
- **高阶推理展示**: 专属蓝边框 Reasoning 思考过程盒，凸显逻辑推理链条。

## Colors

本系统的色彩设计以冷冰蓝与墨黑为主基调，辅以极少量的活力蓝色作为高亮与激活状态。

### Primary
- **Royal Cobalt Blue** (`#2563EB`): 核心按钮、焦点边框与当前激活状态高亮。
- **Deep Cobalt Hover** (`#1D4ED8`): 按钮悬停与交互反馈。

### Neutral
- **Canvas White** (`#FFFFFF`): 主工作区画板背景与输入 Capsule 填充色。
- **Ice Blue Sidebar** (`#E5E9EE`): Codex 经典冰蓝灰侧边栏背景。
- **Sidebar Hover** (`#DCE1E7`): 会话项 Hover 态。
- **Sidebar Active** (`#D3D9E0`): 当前选中的会话高亮。
- **Primary Ink Text** (`#111827`): 标题与主要文本。
- **Secondary Slate Text** (`#4B5563`): 次要标签与辅助文案。

### Named Rules
**The Rarity Accent Rule.** 经典蓝色高亮 (`#2563EB`) 仅应用于屏幕中不到 5% 的关键交互元素（如当前模型 Selector、发送按钮、焦点 Outline），保持少即是多。

## Typography

**Display Font:** Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto
**Body Font:** Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto
**Label/Mono Font:** JetBrains Mono, monospace

**Character:** 结合现代无衬线体 Inter 的极简美感与 JetBrains Mono 的编程严谨感，代码与思考链采用等宽字体高亮。

### Hierarchy
- **Display** (700, 26px, 1.2): 主 Hero 标语（如 "我们该构建什么？"）。
- **Headline** (700, 16px, 1.3): 模块与设置项标题。
- **Title** (600, 14px, 1.4): 快捷卡片标题与会话 ListItem。
- **Body** (400, 14px, 1.6): 消息对话气泡与流式打字渲染。
- **Label / Code** (500, 12px, 1.5): 推理思考过程盒与 Model Selector 标签。

## Layout

采用了标准的 2 列桌面布局架构：
- 侧边栏宽度固定 `240px`，具备 macOS Traffic Light 顶部间距与底部 Profile 悬浮。
- 主视窗占据剩余空间，居中最大宽度 `840px` 限制输入 Capsule 与 Hero 快捷卡片，防止在大屏显示器下内容过宽。

## Elevation & Depth

采用了“平时扁平、交互浮雕 (Flat at rest, Lifted on focus/hover)”的深度策略。

### Shadow Vocabulary
- **Capsule Rest Shadow** (`0 8px 24px rgba(0, 0, 0, 0.06)`): 悬浮输入框静止状态下的立体沉降。
- **Capsule Active Shadow** (`0 8px 30px rgba(37, 99, 235, 0.12)`): 输入框获取焦点时的蓝光弥散。
- **Card Hover Shadow** (`0 8px 20px rgba(0, 0, 0, 0.06)`): 4 个 Hero 快捷动作卡片悬停时的轻微浮起。

## Shapes

- **Capsule Rounded** (`18px / 9999px`): 底部输入框与状态 Pill 使用大圆角胶囊轮廓。
- **Card Rounded** (`14px`): 快捷卡片与功能面板使用 14px 柔和微圆角。
- **Button Rounded** (`10px`): 新建任务按钮与常规交互元素。

## Components

### Buttons
- **Shape:** 10px 微圆角或 Full 胶囊轮廓。
- **Primary:** 背景 `#2563EB`，文字 `#FFFFFF`，padding `6px 16px`。
- **New Task Button:** 半透明冰白背景 `rgba(255,255,255,0.65)`，悬停渐变为纯白。

### Inputs / Capsule
- **Style:** 纯白背景 `#FFFFFF`，`1px solid rgba(0,0,0,0.09)`，`18px` 圆角。
- **Focus:** 边框高亮 `#2563EB`，发光 `0 8px 30px rgba(37,99,235,0.12)`。

### Reasoning Box
- **Style:** 柔和灰色背景 `#F8FAFC`，左侧 `3px solid #3B82F6` 蓝色指示条，`JetBrains Mono` 字体。

## Do's and Don'ts

### Do:
- **Do** 保持侧边栏冰蓝灰背景 (`#E5E9EE`) 与主视窗纯白背景的明晰对比。
- **Do** 保持中央区域内容的最大宽度限定在 `840px` 以内。
- **Do** 使用清晰的动画过渡 (`transition: all 150ms ease`).

### Don't:
- **Don't** 在界面中使用饱和度过高的纯红、纯绿大面积底色。
- **Don't** 使用写死的硬编码死数据会话或营销弹窗。
- **Don't** 移除 Reasoning 思考过程盒的蓝色视觉导轨。
