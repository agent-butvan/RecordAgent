---
name: ButvanAgent Design System
description: 零阴影、小圆角的大厂简约技术规范桌面端 Agent 设计系统
colors:
  primary: "#2563eb"
  primary-hover: "#1d4ed8"
  sidebar-bg: "#f8fafc"
  sidebar-border: "#e2e8f0"
  sidebar-hover: "#f1f5f9"
  sidebar-active: "#e2e8f0"
  neutral-bg: "#ffffff"
  neutral-surface: "#f8fafc"
  neutral-text: "#0f172a"
  neutral-muted: "#64748b"
  border-subtle: "#e2e8f0"
  border-medium: "#cbd5e1"
  border-active: "#2563eb"
typography:
  display:
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "24px"
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
  sm: "4px"
  md: "6px"
  lg: "8px"
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
    rounded: "{rounded.md}"
    padding: "6px 14px"
  button-new-chat:
    backgroundColor: "{colors.neutral-bg}"
    textColor: "{colors.neutral-text}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  input-box:
    backgroundColor: "{colors.neutral-bg}"
    textColor: "{colors.neutral-text}"
    rounded: "{rounded.lg}"
    padding: "12px 16px"
---

# Design System: ButvanAgent

## Overview

**Creative North Star: "The Technical Minimalist Studio" (大厂简约技术工坊)**

ButvanAgent 采用一线科技大厂（如 Vercel, Linear, Google Technical Style）倡导的极简、平整、强对齐视觉体系。整个系统完全去除了重阴影与大圆角胶囊包覆，转而依赖精确的 1px 细线条描边 (`1px solid #e2e8f0` / `#cbd5e1`)、严谨的色彩对比以及轻量的小圆角 (`4px - 8px`)。

界面无冗余修饰，保持高度清爽与专业工程师质感，确保用户的注意力专注于 Agent 的代码逻辑输出与高效协作。

**Key Characteristics:**
- **零阴影纯平设计**: 彻底弃用 Drop Shadows 渐变投影，全局采用 1px 细线描边分隔视窗与浮层。
- **精致小圆角**: 全局限定小圆角规则 (基础 `4px`, 卡片/输入框 `8px`), 彻底消除椭圆胶囊拖沓感。
- **清晰高对比描边**: 输入框与焦点组件采用极简 1px 高光描边高亮。

## Colors

调色板遵循大厂技术规范的冷灰色阶与精准蓝高亮。

### Primary
- **Tech Royal Blue** (`#2563EB`): 核心按钮、活动指示点与焦点描边高亮。
- **Deep Cobalt Hover** (`#1D4ED8`): 悬停交互反馈。

### Neutral
- **Clean Canvas White** (`#FFFFFF`): 主工作区与输入卡片填充。
- **Technical Surface Slate** (`#F8FAFC`): 侧边栏与微暗背景。
- **Subtle Border** (`#E2E8F0`): 常规分隔线与非激活卡片描边。
- **Medium Border** (`#CBD5E1`): 输入框与可交互组件默认描边。
- **Primary Ink Text** (`#0F172A`): 标题与主要文本。
- **Secondary Muted Text** (`#64748b`): 辅助说明与次要标签。

### Named Rules
**The Border-Over-Shadow Rule.** 切断所有 box-shadow 投影；元素的边界、层级与选中态一律通过 1px 描边颜色 (`#e2e8f0` -> `#cbd5e1` -> `#2563eb`) 区分。

## Typography

**Display Font:** Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto
**Body Font:** Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto
**Label/Mono Font:** JetBrains Mono, monospace

**Character:** 严谨的无衬线体 Inter 搭配 JetBrains Mono 代码/思考过程文本，字号与字重阶梯紧凑清晰。

### Hierarchy
- **Display** (700, 24px, 1.2): 页面核心 Hero 标题。
- **Headline** (600, 15px, 1.3): 模块标题与 Settings 导航。
- **Title** (600, 13px, 1.4): 会话项标题与快捷卡片标语。
- **Body** (400, 14px, 1.55): 对话气泡与流式打字输出。
- **Label / Code** (500, 12px, 1.4): Reasoning 思考过程盒与 Model 状态 Badge。

## Layout

标准的紧凑双列桌面架构：
- 侧边栏宽度为固定 `240px`，使用 `border-right: 1px solid #e2e8f0` 清晰划分。
- 主视窗水平居中，最大宽度限制为 `840px`，确保输入区与卡片在宽屏下高度对齐。

## Elevation & Depth

**The Flat-By-Default Rule.**
本系统完全消除任何 `box-shadow` 阴影效果。深度与层次完全由背景对比度 (`#ffffff` vs `#f8fafc`) 与 1px 描边状态线（`border: 1px solid ...`）提供。

## Shapes

- **Small Radius** (`4px`): 细小 Tag 标签、Icon 按钮与 Badge。
- **Medium Radius** (`6px`): 按钮、会话条目与侧边栏 Item。
- **Large Radius** (`8px`): 输入框与 Hero 快捷卡片的最大圆角边界。

## Components

### Buttons
- **Shape:** `6px` 紧凑圆角。
- **Primary:** 背景 `#2563EB`，文字 `#FFFFFF`，无阴影，`padding: 6px 14px`。
- **New Task Button:** 填充 `#FFFFFF`，`border: 1px solid #cbd5e1`，悬停变色 `#F1F5F9`。

### Inputs / Textarea Container
- **Style:** 填充 `#FFFFFF`，`border: 1px solid #cbd5e1`，`8px` 紧凑圆角，无阴影。
- **Focus:** 描边高亮 `border-color: #2563EB`，无 boxShadow 扩散。

### Select
- **Semantics:** 统一封装原生 `select`，保留键盘操作、表单提交和浏览器辅助功能；页面不得重复实现下拉箭头与交互状态。
- **Sizes:** `sm`、`md`、`lg` 分别用于紧凑工具栏、常规表单和初始化表单，控件高度保持为 `32px`、`36px`、`46px`。
- **States:** 默认使用中性描边；悬停增强描边，键盘聚焦使用品牌蓝，错误态使用克制的红色描边与说明文字。
- **Appearance:** 常规表单使用 `outline`；文章编辑器等沉浸式界面使用 `ghost`，静态状态不显示背景与边框，但保留键盘焦点提示。
- **Content:** 支持标签、说明、错误、占位项、禁用选项和前置图标；表单布局通过全宽属性适配，视觉细节由公共组件统一维护。包含自定义输入项的分类选择器必须通过二级 Modal 收集内容，不得在 Select 下方展开输入框。

### Quick Action Cards
- **Style:** 填充 `#FFFFFF`，`border: 1px solid #e2e8f0`，`8px` 紧凑圆角。
- **Hover:** 描边转换为 `border-color: #2563EB`，微平移但不添加阴影。

### Reasoning Box
- **Style:** 填充 `#F8FAFC`，`border: 1px solid #e2e8f0`，左侧 `3px solid #2563EB` 蓝条，`4px` 圆角。

## Do's and Don's

### Do:
- **Do** 坚持使用 `4px`、`6px`、`8px` 小圆角，保证紧凑干净的线框比例。
- **Do** 使用 `box-shadow: none` 彻底消除多余的模糊投影。
- **Do** 使用 1px 精细描边区分按钮、输入框与卡片层级。

### Don't:
- **Don't** 使用大于 10px 的大圆角或 9999px 椭圆胶囊形状（指示圆点除外）。
- **Don't** 添加 `box-shadow` 或 `drop-shadow` 阴影滤镜。
- **Don't** 破坏整体去阴影、高对比的大厂技术规范风格。
