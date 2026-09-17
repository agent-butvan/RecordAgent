# System Prompt 与上下文管理开源项目调研

> 调研日期：2026-09-12
> 范围：只采用项目官方 GitHub 仓库的源码、官方文档或官方设计 issue；结论用于 ButvanAgent 的技术方案，不代表照搬实现。

## 1. 摘要

成熟 Agent 通常把上下文拆成稳定规则、按路径/模式加载的规则、按相关度选择的工作区信息和用户显式引用的数据。共同原则是每一类信息有明确触发条件、真实 Token 预算、来源/优先级和回退路径；没有一个项目把不断增长的完整记忆文件作为每轮 System Prompt 的默认内容。

## 2. 项目证据

### Aider：相关度排序的仓库地图

Aider 会构建全仓库的符号/依赖图，但发送给模型的是按图排序后、压进 `map-tokens` 预算的最相关片段，而不是完整源码。官方文档说明默认 repo map 预算约为 1K，并且在没有指定文件时会动态调整；实现通过模型的 `token_count` 估算候选地图大小，再用二分搜索选择不超过预算的版本。

- [Aider repo map 官方文档](https://github.com/Aider-AI/aider/blob/main/aider/website/docs/repomap.md)
- [Aider `repomap.py` 实现](https://github.com/Aider-AI/aider/blob/main/aider/repomap.py)
- [Aider 配置中的 `map-tokens` 与历史预算](https://github.com/Aider-AI/aider/blob/main/aider/website/docs/config/aider_conf.md)

可迁移结论：工作区上下文应先相关度排序，再按真实 tokenizer 和硬预算裁剪；ButvanAgent 的 Memory 检索可以采用同样的 chunk/Top-K/预算模型。

### Continue：规则的模式与文件范围触发

Continue 的规则文件支持 `alwaysApply`、`globs`、`regex` 和面向 Agent 的 `description`。始终规则每次加入；带 glob/regex 的规则在文件上下文匹配时加入；其余规则由 Agent 根据描述请求。规则按稳定顺序合并成系统消息，并明确不应用于自动补全等其他请求类型。

- [Continue 规则官方文档](https://github.com/continuedev/continue/blob/main/docs/customize/deep-dives/rules.mdx)
- [Continue 活跃工具选择实现](https://github.com/continuedev/continue/blob/main/gui/src/redux/selectors/selectActiveTools.ts)

可迁移结论：项目规则不应和用户记忆共用一个“全部常驻”开关；路径匹配是确定性加载规则的合适触发器，`AGENTS.md` 的作用域也应保留。

### OpenHands：always / keyword / manual 微 Agent

OpenHands 的官方设计记录将微 Agent 定义为“触发器 + 附加指令 + 可选工具”。触发器有 `always`、`keyword`、`manual` 三种：仓库级通用规范可 always，GitHub 等领域知识可 keyword，复杂操作指南可 manual；仓库内微 Agent 放在 `.openhands/microagents/`。

- [OpenHands 微 Agent 设计 issue](https://github.com/OpenHands/OpenHands/issues/7547)

可迁移结论：ButvanAgent 可将稳定用户画像映射为 always，将历史记忆映射为本地相关度触发，将完整 Knowledge/敏感数据映射为显式 manual/用户确认，而不是每轮注入。

### OpenAI Codex：层级规则与有界上下文

Codex 的 `agents_md.rs` 从项目根沿路径向当前工作目录收集层级 `AGENTS.md`，按作用域顺序合并，且不越过项目根。其仓库契约进一步要求上下文项使用结构化片段、有硬上限、避免频繁改变上下文破坏缓存，并对超过约 1K Token 的新片段要求额外审查。

- [Codex `agents_md.rs`](https://github.com/openai/codex/blob/main/codex-rs/core/src/agents_md.rs)
- [Codex 仓库上下文工程约束](https://github.com/openai/codex/blob/main/AGENTS.md)
- [Codex 默认基础提示](https://github.com/openai/codex/blob/main/codex-rs/protocol/src/prompts/base_instructions/default.md)

可迁移结论：上下文块需要 provenance、稳定顺序和硬上限；动态环境放在稳定前缀后面，项目规则必须按路径加载。

## 3. 对 ButvanAgent 的直接启示

1. 保留 `disableWorkspaceContext()`，但增加小型 always-on User Profile，解决“没有召回就完全不了解用户”的体验断层。
2. 用本地检索产生有限的 memory hits；自动召回不应依赖模型先完成工具组切换。
3. `memory_search` 与自动召回共享同一个有界检索实现，补充分词/相关度/Top-K/Token 上限，避免当前整句精确匹配与无界返回。
4. `AGENTS.md` 使用路径级规则，Knowledge 使用显式引用或领域触发；不能把两者重新塞回通用 Workspace Context。
5. 统一 TokenCounter，不能继续混用项目的“非 ASCII 约一个 Token”和 AgentScope Workspace Context 的 `字符数 / 4` 估算。

## 4. 不应照搬的做法

- Aider 的 repo map 面向代码依赖图，不能直接替代个人记忆检索；个人记忆需要敏感级别、主体分类和用户可清除能力。
- OpenHands 的 keyword 触发依赖明显关键词，中文自然语言个人偏好不能只依赖关键字；ButvanAgent 应先本地打分，低分不注入。
- Continue 的规则始终应用能力不意味着 ButvanAgent 可把整个根 `AGENTS.md` 常驻；当前根文件约 4,579 个项目估算 Token，应保留按路径读取。
- Codex 的上下文契约并不等于具体 Java/AgentScope API；落地仍需验证 AgentScope 2.0.0 的 middleware 顺序、状态恢复和 Provider Usage。

## 5. 结论与验证要求

推荐采用“System Core + User Profile Snapshot + 本地有界 Episodic Recall + 路径级项目规则”的混合方案。实施时必须用真实 Provider Usage 对照本地估算，并以任务成功率、Recall@K、无关注入率、首 Token 延迟和会话恢复作为验收，而不能只看字符串长度。
