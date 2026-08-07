# ButvanAgent System Prompt 模块化架构与接入教程

## 1. 这份文档解决什么问题

在当前 `ButvanAgent` 项目中，后端的 System Prompt 在 `AgentService.java` 中仅通过硬编码的一句话（`你是一个强大的桌面智能助手。`）定义。这会导致大模型行为边界模糊、输出格式不可控、调用缺乏精准约束等问题。

**核心原则**：
1. **模块化与优先级控制**：借鉴 `mewcode-java` 架构，将 System Prompt 拆解为 7 个优先级不同的核心模块（Priority 0 - 70），按顺序自动组装。
2. **Prompt Cache 性能与成本优化**：将静态身份与环境配置放于系统顶层，充分利用主流 LLM API 的缓存机制（最高降低 90% input token 成本）；将动态变动指令通过 `<system-reminder>` 注入对话消息中。
3. **精准与克制**：约束大模型的默认“过度回答”和“顺手重构”偏好，确保回复短小、行为精准、代码安全。

这份教程将手把手指导你手动编写基于模块化优先级的 System Prompt 构建体系，并将其优雅地接入 `AgentService`。

---

## 2. 核心原理与架构设计

模块化 System Prompt 的核心在于将系统的控制能力拆解为具备显式优先级的 `Section`，并通过组装器按照 `priority` 从小到大排序连接：

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                          System Prompt 7 大模块架构                          │
├──────────┼────────────────────────────┼─────────────────────────────────────┤
│ 优先级   │ 模块名称 (Section)          │ 核心职责                            │
├──────────┼────────────────────────────┼─────────────────────────────────────┤
│ Priority 0│ Identity (角色与安全底线)   │ 定义智能体身份，划定 OWASP 等安全红线│
│ Priority 10│ System (系统运行规则)      │ 权限响应处理、<system-reminder> 支持 │
│ Priority 20│ DoingTasks (任务策略)      │ 探究答复2-3句、先读后写、保持最小变更 │
│ Priority 30│ ExecutingActions (高风险审)│ 破坏性/不可逆操作前主动向用户二次确认│
│ Priority 40│ UsingTools (工具调度规范)  │ 专用工具优先于 Bash，多工具并行调用  │
│ Priority 50│ ToneStyle (语气与格式)     │ 不带 Emoji、精确 file:line 定位格式  │
│ Priority 60│ OutputEfficiency (输出效率)│ 工具执行前一句话告知、完结一两句总结 │
│ Priority 70│ Environment (动态环境)     │ 工作目录、OS、Shell、Git分支、日期  │
└──────────┴────────────────────────────┴─────────────────────────────────────┤
```

**工作流**：
```text
探测系统与 Git 运行环境 (EnvironmentContext)
    ↓
创建 PromptBuilder 并添加各大模块 Section (Priority 0 ~ 70)
    ↓
按 Priority 升序排序并过滤空段落，用空行 (\n\n) 拼接为最终 System Prompt
    ↓
传递给 HarnessAgent.builder().sysPrompt(fullSysPrompt).build()
```

---

## 3. 包结构与目录规划

在后端 `agent-backend/server-agents` 模块的 `src/main/java/butvan/agent/agents/` 路径下规划 Prompt 包结构：

```text
butvan.agent.agents.prompt/
├── PromptSection.java          // 模块区间记录类 (Section Record)
├── PromptSections.java         // 7 大预定义 Prompt 模块内容与工厂
└── PromptBuilder.java          // 环境探测与 Prompt 优先级组装器
```

---

## 4. 第一步：定义 PromptSection 结构 (`PromptSection.java`)

在 `butvan.agent.agents.prompt` 包下创建 `PromptSection.java`：

```java
package butvan.agent.agents.prompt;

/**
 * 代表 System Prompt 中的一个独立模块区间（Section）。
 * <p>
 * 每个模块包含模块唯一标识名、排序优先级以及具体的 Prompt 指令内容。
 * 优先级数值越小，拼接时在系统提示词中的位置越靠前。
 *
 * @param name     模块标识名称，例如 "Identity"、"System" 等
 * @param priority 模块优先级（数值越小越靠前，建议取值范围 0 ~ 95）
 * @param content  模块的具体 Prompt 指令文本内容
 */
public record PromptSection(
        String name,
        int priority,
        String content
) {}
```

---

## 5. 第二步：定义 7 大预定义 Prompt 模块 (`PromptSections.java`)

在 `butvan.agent.agents.prompt` 包下创建 `PromptSections.java`，定义符合项目规范的 7 个优先级模块：

```java
package butvan.agent.agents.prompt;

import butvan.agent.agents.prompt.PromptBuilder.EnvironmentContext;

/**
 * 预定义的 System Prompt 核心模块集。
 * <p>
 * 包含从 Priority 0 到 Priority 70 的 7 大核心行为约束与上下文模块：
 * <ul>
 *   <li>Priority 0: 角色身份与安全红线 (Identity)</li>
 *   <li>Priority 10: 系统运行规则与权限处理 (System)</li>
 *   <li>Priority 20: 软件工程任务执行规范 (DoingTasks)</li>
 *   <li>Priority 30: 高风险/破坏性动作审查 (ExecutingActions)</li>
 *   <li>Priority 40: 原生与专用工具调度规范 (UsingTools)</li>
 *   <li>Priority 50: 交互语气与代码引用格式 (ToneStyle)</li>
 *   <li>Priority 60: 文本输出效率与总结约束 (OutputEfficiency)</li>
 *   <li>Priority 70: 动态系统与 Git 环境上下文 (Environment)</li>
 * </ul>
 */
public final class PromptSections {

    /**
     * 工具类构造函数私有化，防止实例化。
     */
    private PromptSections() {}

    // ── Priority 0: Identity (角色身份与安全红线) ─────────────────────────

    /** Priority 0 模块的文本内容 */
    static final String IDENTITY_CONTENT = """
            你是 ButvanAgent，一个基于 Tauri 桌面壳与 Spring Boot 后端驱动的高效桌面智能助手。
            你帮助用户完成软件工程任务（读取、编写、调试与重构代码，解释逻辑）以及本地系统与文件管理任务。
            
            重要安全原则：
            - 严禁引入安全漏洞（如命令注入、XSS、SQL 注入等 OWASP 常见漏洞）。优先编写安全、稳健的代码。
            - 严禁编造或盲猜 URL 与命令。只能使用用户明确提供或本地文件中确切存在的 URL。""";

    /**
     * 构建 Priority 0: 角色身份与安全底线模块。
     *
     * @return 角色身份 PromptSection 实例
     */
    public static PromptSection identitySection() {
        return new PromptSection("Identity", 0, IDENTITY_CONTENT);
    }

    // ── Priority 10: System (系统运行规则) ────────────────────────────────

    /** Priority 10 模块的文本内容 */
    static final String SYSTEM_CONTENT = """
            # 系统运行规则
            - 所有你在工具调用之外输出的文本均会直接显示给用户。
            - 工具的使用受系统权限控制机制（PermissionContext）约束。若用户拒绝了某次工具调用，不要盲目重复相同的请求，应及时调整策略。
            - 消息或工具返回中可能包含 <system-reminder> 标签。这些包含系统补充指令或上下文，请将其作为高优先级的系统要求对待。
            - 会话具备自动上下文压缩能力，请放心地在长流程任务中按步骤推进。""";

    /**
     * 构建 Priority 10: 系统运行规则模块。
     *
     * @return 系统规则 PromptSection 实例
     */
    public static PromptSection systemSection() {
        return new PromptSection("System", 10, SYSTEM_CONTENT);
    }

    // ── Priority 20: Doing Tasks (任务执行规范) ───────────────────────────

    /** Priority 20 模块的文本内容 */
    static final String DOING_TASKS_CONTENT = """
            # 任务执行规范
            - 探究性问题（如“这个需求怎么做比较好？”、“如何优化这个模块？”）：用 2-3 句话给出建议与主要权衡，供用户决策，不要直接动手修改代码。
            - 读代码优先：不要修改任何你未曾读取过的文件。在尝试修改或解释文件前，必须先使用专用读取工具阅读该文件。
            - 优先修改已有文件而非新建文件，避免文件膨胀。
            - 保持最小必要变更：不要添加超出任务要求的抽象、重构或多余功能。修复 Bug 不需要顺便清理周边代码。不要为假设的未来需求做设计。
            - 默认不写描述性注释：只在 WHY（隐蔽约束、特殊变通）不明显时写一行短注释。不要写阐述 WHAT 的废话注释。
            - 验证原则：在汇报任务完成之前，务必通过运行测试或检查命令验证结果。若测试失败，必须原样如实反映，严禁在出现错误时虚报“测试全部通过”。""";

    /**
     * 构建 Priority 20: 软件工程任务执行规范模块。
     *
     * @return 任务规范 PromptSection 实例
     */
    public static PromptSection doingTasksSection() {
        return new PromptSection("DoingTasks", 20, DOING_TASKS_CONTENT);
    }

    // ── Priority 30: Executing Actions (高风险动作审查) ───────────────────

    /** Priority 30 模块的文本内容 */
    static final String EXECUTING_ACTIONS_CONTENT = """
            # 高风险动作审查
            在执行不可逆、影响面大或具备破坏性的操作前，必须向用户明确说明并请求确认。
            
            需要主动二次确认的高风险操作示例：
            - 破坏性操作：删除文件/分支、drop 数据库表、rm -rf、覆盖未提交改动
            - 难逆转操作：force-push、git reset --hard、修改已提交历史、卸载核心依赖包
            
            遇到障碍时，探究根本原因，严禁使用破坏性命令强行绕过安全检查。""";

    /**
     * 构建 Priority 30: 高风险动作审查模块。
     *
     * @return 高风险动作审查 PromptSection 实例
     */
    public static PromptSection executingActionsSection() {
        return new PromptSection("ExecutingActions", 30, EXECUTING_ACTIONS_CONTENT);
    }

    // ── Priority 40: Using Tools (工具调度规范) ─────────────────────────

    /** Priority 40 模块的文本内容 */
    static final String USING_TOOLS_CONTENT = """
            # 工具调度规范
            - 优先使用专用工具而非 Shell/Bash 命令：
              - 读文件优先用 ReadFile 而非 cat, head, tail；
              - 编辑文件优先用 EditFile / MultiReplace 而非 sed, awk；
              - 写入文件优先用 WriteFile 而非 echo >；
              - 匹配与搜索优先用 Glob / Grep 工具。
            - 多个独立的工具调用应在同一轮集中并行发出，不要串行多次往返。
            - 仅在需要系统交互或无专用工具替代时使用 Bash 命令。""";

    /**
     * 构建 Priority 40: 工具调度规范模块。
     *
     * @return 工具调度规范 PromptSection 实例
     */
    public static PromptSection usingToolsSection() {
        return new PromptSection("UsingTools", 40, USING_TOOLS_CONTENT);
    }

    // ── Priority 50: Tone & Style (语气与格式) ───────────────────────────

    /** Priority 50 模块的文本内容 */
    static final String TONE_STYLE_CONTENT = """
            # 语气与格式
            - 除非用户明确要求，否则回复中严禁使用 Emoji。
            - 保持回复简短、专业、直接。
            - 引用具体代码位置时，统一使用 `file_path:line_number` 格式（如 `src/App.tsx:42`），以便定位与跳转。""";

    /**
     * 构建 Priority 50: 语气与引用格式模块。
     *
     * @return 语气格式 PromptSection 实例
     */
    public static PromptSection toneStyleSection() {
        return new PromptSection("ToneStyle", 50, TONE_STYLE_CONTENT);
    }

    // ── Priority 60: Output Efficiency (输出效率) ─────────────────────────

    /** Priority 60 模块的文本内容 */
    static final String OUTPUT_EFFICIENCY_CONTENT = """
            # 输出效率
            - 在发起工具调用之前，用一句话向用户说明你即将进行的操作（不要无声地直接调工具）。
            - 避免输出冗长的内心思考过程，直接呈现决策与关键进展。
            - 轮次结束总结：任务完成时仅用 1-2 句话总结“改了什么”以及“下一步建议”，不多说废话。""";

    /**
     * 构建 Priority 60: 文本输出效率与总结约束模块。
     *
     * @return 输出效率 PromptSection 实例
     */
    public static PromptSection outputEfficiencySection() {
        return new PromptSection("OutputEfficiency", 60, OUTPUT_EFFICIENCY_CONTENT);
    }

    // ── Priority 70: Environment (动态运行环境上下文) ─────────────────────

    /**
     * 构建 Priority 70: 动态系统与 Git 运行环境上下文模块。
     *
     * @param env 动态探测到的当前系统与 Git 环境上下文对象
     * @return 运行环境 PromptSection 实例
     */
    public static PromptSection environmentSection(EnvironmentContext env) {
        StringBuilder sb = new StringBuilder();
        sb.append("# 运行环境\n");
        sb.append(" - 工作目录: ").append(env.workDir()).append('\n');
        sb.append(" - 操作系统/架构: ").append(env.os()).append('/').append(env.arch()).append('\n');
        sb.append(" - 运行 Shell: ").append(env.shell()).append('\n');
        sb.append(" - Git 仓库: ").append(env.isGitRepo());
        
        // 若为 Git 仓库且分支名有效，拼接分支信息
        if (env.isGitRepo() && env.gitBranch() != null && !env.gitBranch().isEmpty()) {
            sb.append("\n - Git 分支: ").append(env.gitBranch());
        }
        // 若指定了当前激活的大模型，拼接模型名称
        if (env.model() != null && !env.model().isEmpty()) {
            sb.append("\n - 激活模型: ").append(env.model());
        }
        sb.append("\n - 当前日期: ").append(env.date());
        
        return new PromptSection("Environment", 70, sb.toString());
    }
}
```

---

## 6. 第三步：编写组装器与环境探测 (`PromptBuilder.java`)

在 `butvan.agent.agents.prompt` 包下创建 `PromptBuilder.java`：

```java
package butvan.agent.agents.prompt;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * System Prompt 动态构建器与运行环境探测中心。
 * <p>
 * 负责自动检测系统宿主环境（操作系统、Shell、Git 状态、时间等），
 * 并管理多个 {@link PromptSection} 模块，按 Priority 优先级升序组合生成最终的 System Prompt 文本。
 */
public class PromptBuilder {

    /**
     * 运行时环境上下文对象。
     *
     * @param workDir   当前智能体工作根目录
     * @param os        宿主操作系统名称（如 macos, windows 11, linux）
     * @param arch      宿主 CPU 架构（如 x86_64, aarch64）
     * @param shell     当前使用的终端 Shell 名称（如 bash, zsh, cmd.exe）
     * @param isGitRepo 当前工作目录是否处于 Git 仓库中
     * @param gitBranch 当前 Git 分支名称（若非 Git 仓库则为空）
     * @param model     当前调用的大语言模型标识/名称
     * @param date      当前系统 ISO 日期（格式：YYYY-MM-DD）
     */
    public record EnvironmentContext(
            String workDir,
            String os,
            String arch,
            String shell,
            boolean isGitRepo,
            String gitBranch,
            String model,
            String date) {}

    /** 保存所有已添加的 PromptSection 模块列表 */
    private final List<PromptSection> sections = new ArrayList<>();

    /**
     * 向构建器中添加一个新的 Prompt 模块。
     *
     * @param section 待添加的 PromptSection 实例（若为 null 则自动忽略）
     * @return 链式调用的 PromptBuilder 实例
     */
    public PromptBuilder add(PromptSection section) {
        if (section != null) {
            sections.add(section);
        }
        return this;
    }

    /**
     * 将所有已添加的 PromptSection 模块按 Priority 优先级升序排序，
     * 过滤空段落后，使用双换行符（{@code \n\n}）拼接为完整的 System Prompt 字符串。
     *
     * @return 拼接完成的完整 System Prompt 文本
     */
    public String build() {
        // 关键：按 Priority 数值从小到大排序（优先级高/数值小的排在最前面）
        sections.sort(Comparator.comparingInt(PromptSection::priority));

        List<String> parts = new ArrayList<>();
        for (PromptSection s : sections) {
            String content = s.content() == null ? "" : s.content().strip();
            if (!content.isEmpty()) {
                parts.add(content);
            }
        }
        // 每个模块间保留双换行，保证 Markdown 标题与段落间距清晰
        return String.join("\n\n", parts);
    }

    /**
     * 自动探测当前宿主机的操作系统、Shell、CPU 架构以及 Git 仓库状态。
     *
     * @param modelName     当前选用的 LLM 模型名称
     * @param customWorkDir 自定义工作目录路径（若传入 null 或空白串，则默认使用当前 JVM 的 user.dir）
     * @return 探测填充后的 {@link EnvironmentContext} 环境对象
     */
    public static EnvironmentContext detectEnvironment(String modelName, String customWorkDir) {
        // 1. 解析工作目录
        String workDir = customWorkDir != null && !customWorkDir.isBlank()
                ? customWorkDir : System.getProperty("user.dir");
        
        // 2. 读取操作系统与架构
        String os = System.getProperty("os.name", "unknown").toLowerCase();
        String arch = System.getProperty("os.arch", "unknown");
        
        // 3. 读取用户 Shell 环境
        String shell = System.getenv("SHELL");
        if (shell == null || shell.isEmpty()) {
            shell = os.contains("win") ? "cmd.exe" : "bash";
        }

        boolean isGitRepo = false;
        String gitBranch = "";

        // 4. 探测当前目录是否在 Git 仓库树内部
        try {
            Process p = new ProcessBuilder("git", "-C", workDir, "rev-parse", "--is-inside-work-tree")
                    .redirectErrorStream(true)
                    .start();
            try (var reader = new BufferedReader(new InputStreamReader(p.getInputStream()))) {
                String line = reader.readLine();
                if ("true".equals(line != null ? line.strip() : "")) {
                    isGitRepo = true;
                }
            }
            p.waitFor();
        } catch (Exception ignored) {
            // 当系统没有安装 Git 或当前目录非 Git 仓库时捕获异常并静默处理
        }

        // 5. 若确认是 Git 仓库，获取当前 HEAD 对应的分支名称
        if (isGitRepo) {
            try {
                Process p = new ProcessBuilder("git", "-C", workDir, "rev-parse", "--abbrev-ref", "HEAD")
                        .redirectErrorStream(true)
                        .start();
                try (var reader = new BufferedReader(new InputStreamReader(p.getInputStream()))) {
                    String line = reader.readLine();
                    if (line != null) {
                        gitBranch = line.strip();
                    }
                }
                p.waitFor();
            } catch (Exception ignored) {
                // 分支检测失败时静默忽略，保持 gitBranch 为空字符串
            }
        }

        // 6. 获取当前本地 ISO 格式日期（YYYY-MM-DD）
        String date = LocalDate.now().toString();
        
        return new EnvironmentContext(workDir, os, arch, shell, isGitRepo, gitBranch, modelName, date);
    }

    /**
     * 便捷静态工厂方法：自动探测环境并按标准 Priority (0-70) 组装生成完整的系统提示词。
     *
     * @param modelName 当前使用的模型名称
     * @param workDir   当前工作目录
     * @return 完整的 System Prompt 字符串
     */
    public static String buildDefaultSystemPrompt(String modelName, String workDir) {
        // 自动探测宿主环境
        EnvironmentContext env = detectEnvironment(modelName, workDir);

        // 按 Priority 从小到大顺序装配 7 大核心模块
        return new PromptBuilder()
                .add(PromptSections.identitySection())           // Priority 0
                .add(PromptSections.systemSection())             // Priority 10
                .add(PromptSections.doingTasksSection())         // Priority 20
                .add(PromptSections.executingActionsSection())   // Priority 30
                .add(PromptSections.usingToolsSection())         // Priority 40
                .add(PromptSections.toneStyleSection())          // Priority 50
                .add(PromptSections.outputEfficiencySection())   // Priority 60
                .add(PromptSections.environmentSection(env))     // Priority 70
                .build();
    }
}
```

---

## 7. 第四步：接入 `AgentService.java`

更新位于 `agent-backend/server-agents/src/main/java/butvan/agent/agents/agent/AgentService.java` 中的 `createHarnessAgent` 方法：

```java
package butvan.agent.agents.agent;

import butvan.agent.agents.prompt.PromptBuilder; // 引入组装器
import io.agentscope.core.agent.HarnessAgent;
import io.agentscope.core.model.Model;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.nio.file.Paths;

/**
 * 智能体调度与 HarnessAgent 生命周期管理服务。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AgentService {

    private final ModelHolder modelHolder;
    private final ToolRegistry toolRegistry;
    private final AgentSecurity agentSecurity;

    /**
     * 创建并配置当前模型对应的 HarnessAgent 实例。
     * <p>
     * 使用 {@link PromptBuilder} 动态探测操作系统、Git 状态及模型参数，
     * 生成包含 7 大核心行为约束模块（Priority 0 - 70）的强约束 System Prompt。
     *
     * @param model 当前激活的大语言模型实例
     * @return 配置完毕的 HarnessAgent 实例
     */
    private HarnessAgent createHarnessAgent(Model model) {
        // 1. 动态获取模型名称与系统当前工作目录
        String modelName = model != null ? model.getName() : "unknown-model";
        String workDir = System.getProperty("user.dir");

        // 2. 调用 PromptBuilder 自动探测环境并拼接 7 大模块的系统提示词
        String sysPrompt = PromptBuilder.buildDefaultSystemPrompt(modelName, workDir);

        log.info("[AgentService] 成功构建模块化 System Prompt，字符数: {}", sysPrompt.length());

        // 3. 将生成的 sysPrompt 传递给 HarnessAgent Builder
        return HarnessAgent.builder()
                .name("butvan_agent")
                .sysPrompt(sysPrompt) // 替换原先硬编码的一句话字符串
                .model(model)
                .toolkit(toolRegistry.getToolkit())
                .permissionContext(agentSecurity.createPermissionContext())
                .workspace(Paths.get(".agentscope/workspace"))
                .compaction(CompactionConfig.builder()
                        .triggerMessages(30)
                        .keepMessages(10)
                        .build())
                .build();
    }
}
```

---

## 8. 建议的实施顺序与验证方式

| 次序 | 手动编写的代码内容 | 位置 | 成功验证标志 |
| --- | --- | --- | --- |
| 1 | 编写 `PromptSection.java` | `prompt/PromptSection.java` | 接口 Record 编译通过，字段 Javadoc 完整。 |
| 2 | 编写 `PromptSections.java` | `prompt/PromptSections.java` | 7 大预定义 Section 工厂方法编译通过，方法及常量注释无遗漏。 |
| 3 | 编写 `PromptBuilder.java` | `prompt/PromptBuilder.java` | `detectEnvironment` 与 `buildDefaultSystemPrompt` 方法编译通过，包含完整算法分支注释。 |
| 4 | 在 `AgentService.java` 接入 | `agent/AgentService.java` | 运行测试或启动后端，查看日志 `[AgentService] 成功构建模块化 System Prompt`，验证系统提示词已成功变为多段落强约束文本。 |

---

## 9. 最终代码职责表

| 类名 | 归属规范 | 职责与作用 |
| --- | --- | --- |
| `PromptSection` | Record 数据载体 | 封装单个 Prompt 模块的名字、优先级与文本内容（包含完整 Javadoc）。 |
| `PromptSections` | 预定义模块库 | 提供从 Identity 到 Environment 的 7 大核心行为约束模块（包含完整 Javadoc）。 |
| `PromptBuilder` | 组装建造者 | 探测 OS/Git 等环境，按优先级升序组装最终 System Prompt 字符串（包含完整 Javadoc）。 |
| `AgentService` | 业务服务层 | 在生成 `HarnessAgent` 时调用 `PromptBuilder` 动态注入强约束系统提示词。 |
