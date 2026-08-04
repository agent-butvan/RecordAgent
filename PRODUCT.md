# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack
React 19, TypeScript, Vite, CSS Modules, Tauri (Desktop Shell), Spring Boot + AgentScope Java (Backend)

## Users
开发者、程序员与 AI 深度使用者，在桌面办公与开发场景下进行代码理解、新功能构建、Bug 排查及智能体任务自动化。

## Product Purpose
提供本地优先、低延迟流式响应的多厂商 AI 大模型桌面 Agent 客户端，帮助用户快速与大模型协作解决复杂开发和日常任务。

## Positioning
基于 React + Tauri 桌面端体验，具备本地配置文件 (`~/.butvan-agent/config.json`) 隔离保护与多厂商 AI 引擎 (Gemini / DeepSeek / OpenAI / Ollama / Anthropic / DashScope) 零感无缝切换机制。

## Operating Context
桌面端工作区环境，集成多会话历史持久化、多模型 API Key 配置管理、代码探索、功能构建、重构建议与 Bug 修复场景。

## Capabilities and Constraints
- 支持多厂商 API 密匙持久化及连通性测试 (Gemini, DeepSeek, OpenAI, Ollama, Anthropic, DashScope)。
- 低延迟 SSE 流式推流与打字效果呈现，支持 Reasoning 深度思考过程展示。
- 动态 Session 历史纪录基于 localStorage 持久化。
- 本地密钥存储于 `~/.butvan-agent/config.json`，不泄露至代码仓库。

## Brand Commitments
- 名称：ButvanAgent
- 视觉风格：极简 Codex 经典冰蓝灰侧边栏 + 悬浮 Capsule 输入胶囊 + 清澈的圆角卡片布局。

## Evidence on Hand
- 项目源代码 `agent-frontend` (React + Vite) 与 `agent-backend` (Spring Boot + AgentScope)。

## Product Principles
1. **本地安全优先**：API Key 与个人配置严格托管在用户本地目录，绝不硬编码提交仓库。
2. **极简高效**：界面无死数据、零干扰营销文案，直奔任务主题。
3. **低延迟多模型**：无缝支持主流公有云 AI 与本地 Ollama 私有模型。

## Accessibility & Inclusion
- 清晰的键盘快捷键导航 (Enter 发送, Shift+Enter 换行)。
- 高对比度字体层次与清晰的状态高亮提示。
