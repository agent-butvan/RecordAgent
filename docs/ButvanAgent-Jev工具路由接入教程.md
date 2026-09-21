# ButvanAgent Jev 工具路由接入教程

> 本教程面向“自己逐步手写代码”的开发方式。它不给项目直接落实现成改动，而是说明每一步为什么做、应放在哪里、核心代码如何组织，以及写完后如何验证。

## 1. 这份教程最终要实现什么

ButvanAgent 已经把工具按能力组延迟暴露给主模型，例如 `workspace`、`memory`、`calendar`、`finance`。目前主模型需要先看到 `reset_equipped_tools`，再自行决定启用哪个能力组。

接入 Jev 后，一次新用户轮次将变成：

```text
用户输入
  │
  ├─ 保存用户消息、组装个人上下文
  │
  ├─ Jev 判断本轮可能需要哪些能力组
  │      例如：workspace=0.96、web=0.82、calendar=0.04
  │
  ├─ 把本轮路由结果写入 RuntimeContext
  │
  ├─ 把 ACTIVE 组同步到当前会话的 AgentState.toolContext
  │      保证 Schema 可见性与 ToolExecutor 可执行性一致
  │
  ├─ ToolSchemaSelectionMiddleware 组装本轮 Tool Schema
  │      常驻工具 + 未分类工具 + Jev 选中的能力组
  │
  └─ 主模型开始推理和调用工具
```

这里最重要的边界是：

- **ButvanAgent 继续注册、实现和执行全部 Tool。**
- **Jev 不保存 Tool，不执行 Tool，也不维护 Tool Schema。**
- **Jev 只根据当前用户请求，对 ButvanAgent 提供的能力组做快速概率判断。**
- **真正暴露给主模型的 Schema，仍由 ButvanAgent 在本地组装。**

因此需要编写的是一个很薄的 Jev HTTP Adapter，而不是一套“Jev Tool 客户端框架”。

---

## 2. 为什么第一版只做“能力组路由”

不要在第一版让 Jev 直接从几十个具体 Tool 中选择。优先选择能力组，原因有四个：

1. 当前项目已经有成熟的 Tool Group 语义，改动范围小。
2. 能力组数量稳定，Jev 的问题定义不会随着每个工具的细节频繁变化。
3. 一个请求可能同时需要多个能力，例如“搜索最新资料并写入项目”，同时需要 `web` 和 `workspace`。
4. Jev 判断错误时，仍可保留 `reset_equipped_tools` 作为主模型的补救入口。

推荐使用“一组一个 Noul 问题”的多标签方案，而不是一个 Choice：

```json
{
  "workspace": {
    "type": "noul",
    "instructions": "完成当前请求是否需要读写或搜索项目文件，或者执行本地命令？",
    "criteria": {
      "true": "需要 workspace 能力组",
      "false": "不需要 workspace 能力组"
    }
  },
  "web": {
    "type": "noul",
    "instructions": "完成当前请求是否需要搜索实时互联网信息或外部资料？",
    "criteria": {
      "true": "需要 web 能力组",
      "false": "不需要 web 能力组"
    }
  }
}
```

Noul 返回的是“答案为 yes 的概率”，字段名为 `noul`，范围是 `0..1`。它不是 Choice/Score 响应中的 `confidence`，代码和日志里应统一叫 `probability`，不要叫 `confidence`。

---

## 3. 开始前先理解当前工程的四个接入点

| 现有位置 | 当前职责 | 接入 Jev 后的变化 |
| --- | --- | --- |
| `tool/ToolSchemaRoutingPolicy.java` | 定义能力组及工具匹配规则 | 把能力组定义提取为唯一目录，避免 Jev 再复制一份 |
| `tool/ToolRegistry.java` | 注册 Tool，并对最终 Toolkit 应用分组 | 保持 Tool 所有权不变 |
| `agent/AgentService.java` | 创建一次运行的 `RuntimeContext` | 在新用户轮次调用路由器，并同步本轮决策与会话工具状态 |
| `agent/AgentFactory.java` | 构建并缓存 `HarnessAgent`、注册 Middleware | 增加 Tool Schema 选择 Middleware |

当前 `AgentFactory` 按“项目根目录”缓存 `HarnessAgent`，不是每个会话创建一份 Agent。因此绝对不要这样实现 Jev 路由：

```java
// agent：按项目根目录缓存、可能被多个会话共享的 HarnessAgent。
// selectedGroups：Jev 为当前用户轮次选出的能力组名称。
// 错误示例：会修改共享 Toolkit 的激活状态
agent.getToolkit().updateToolGroups(selectedGroups, true);
```

两个会话同时运行时，上述写法可能让 A 会话选择的工具泄漏到 B 会话。正确做法是：

1. 路由结果放入本轮独立的 `RuntimeContext`；
2. `ACTIVE` 结果写入当前用户、当前会话的 `AgentState.toolContext.activatedGroups`；
3. Middleware 在每次 Model Call 前生成新的 `List<ToolSchema>`；
4. 不调用共享 Toolkit 的 `updateToolGroups`，避免跨会话状态污染。

第二步不能省略。`ModelCallInput.tools()` 只决定模型能看见哪些 Schema，AgentScope 的
`ToolExecutor` 仍会检查会话工具组是否已激活。若只做 Schema 过滤，模型虽然能调用
`web_search`，执行阶段却会得到 `Unauthorized tool call: 'web_search' is not available`，
随后只能通过 `reset_equipped_tools` 补救并重复调用。

---

## 4. 建议的最终目录

```text
agent-backend/server-agents/src/main/java/butvan/agent/agents/
├── config/
│   ├── TypeSafeConfigData.java
│   └── TypeSafeProperties.java
├── routing/
│   ├── ToolRoutingMode.java
│   ├── ToolRoutingRequest.java
│   ├── ToolRoutingDecision.java
│   ├── ToolRoutingStateSynchronizer.java
│   ├── ToolCapabilityRouter.java
│   ├── JevToolCapabilityRouter.java
│   ├── SystemOneGateway.java
│   ├── JevSystemOneAdapter.java
│   ├── JevGatewayException.java
│   ├── TypeSafeHttpConfiguration.java
│   └── dto/
│       ├── JevNoulQuestion.java
│       ├── JevSystemOneRequest.java
│       ├── JevNoulAnswer.java
│       ├── JevUsage.java
│       └── JevSystemOneResponse.java
└── tool/
    ├── ToolCapabilityCatalog.java
    ├── ToolSchemaRoutingPolicy.java       # 修改
    └── ToolSchemaSelectionMiddleware.java
```

测试放到相同包路径下的 `src/test/java`：

```text
routing/JevToolCapabilityRouterTest.java
routing/JevSystemOneAdapterTest.java
tool/ToolCapabilityCatalogTest.java
tool/ToolSchemaSelectionMiddlewareTest.java
```

`routing` 是领域决策与外部 Jev Adapter 的边界；`tool` 继续负责项目内部的工具目录和 Schema 组装。

---

## 5. 第 0 步：建立分支与基线

按照项目分支规范，从 `main` 创建功能分支：

```bash
git switch main
git status
git switch -c feature/jev-tool-routing
```

先执行当前模块测试，记录接入前的基线：

```bash
cd agent-backend
mvn -pl server-agents -am test
```

如果基线本来就失败，先记录原始失败，不要把无关修复混进本功能。

---

## 6. 第 1 步：提取唯一的能力组目录

### 6.1 为什么先做这一步

当前能力组名称、说明和工具匹配规则都在 `ToolSchemaRoutingPolicy` 的私有常量中。Jev 也需要读取这些组及说明。如果直接在路由器里复制一份，今后新增工具组时极易只改一处。

新建：

```text
agent-backend/server-agents/src/main/java/butvan/agent/agents/tool/ToolCapabilityCatalog.java
```

核心结构可以写成：

为方便你边写边理解，下面的示例采用“教学型注释”：字段、Record 组件、方法参数、返回值和重要局部变量都会说明职责。实际落地时可以保留这些注释，再按团队习惯精简显而易见的部分。

```java
package butvan.agent.agents.tool;

import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.function.Predicate;

/** ButvanAgent Tool 能力组的唯一目录。 */
@Component
public class ToolCapabilityCatalog {

    /** AgentScope 元工具名称；主模型可通过它补充启用能力组。 */
    public static final String META_TOOL_NAME = "reset_equipped_tools";

    /** capabilities：项目当前支持的全部能力组及其 Tool 名称匹配规则。 */
    private final List<Capability> capabilities = List.of(
            capability("workspace", "读写、搜索项目文件以及执行本地命令；代码和本机任务需要启用。",
                    names("read_file", "write_file", "edit_file", "list_files", "glob_files",
                            "grep_files", "execute", "custom_bash")),
            capability("memory", "检索和保存长期记忆、搜索当前或历史会话。",
                    prefixes("memory_", "session_")),
            capability("planning", "进入或维护计划模式，并在任务完成后生成验收报告。",
                    nameOrPrefix("acceptance_report", "plan_")),
            capability("delegation", "创建、联系和等待子 Agent，以及管理异步任务。",
                    prefixes("agent_", "task_", "wait_async_")),
            capability("skills", "按路径加载任务所需的 Skill 说明。",
                    prefixes("load_skill_")),
            capability("web", "搜索互联网中的实时信息与外部资料。",
                    names("web_search")),
            capability("calendar", "查询、创建、更新、完成或删除日程与待办。",
                    prefixes("calendar_")),
            capability("finance", "查询财务数据、创建账户和记录收支。",
                    prefixes("finance_")),
            capability("library", "搜索、读取、创建、更新或回收项目内部资料。",
                    prefixes("library_")),
            capability("study", "查询、开始、结束、补录、更新或删除学习记录。",
                    prefixes("study_"))
    );

    /**
     * 返回全部能力组定义。
     *
     * @return 不可变的能力组定义列表
     */
    public List<Capability> capabilities() {
        return capabilities;
    }

    /**
     * 提取全部能力组名称，供 Jev 构建候选问题。
     *
     * @return 不可变且不重复的能力组名称集合
     */
    public Set<String> groupNames() {
        return capabilities.stream().map(Capability::name)
                .collect(java.util.stream.Collectors.toUnmodifiableSet());
    }

    /**
     * 根据 Tool 名称查找它所属的能力组。
     *
     * @param toolName Tool Schema 中的唯一工具名称
     * @return 匹配到的能力组；未分类时返回空
     */
    public Optional<Capability> groupFor(String toolName) {
        // item：流处理中正在检查的单个能力组。
        return capabilities.stream().filter(item -> item.matches(toolName)).findFirst();
    }

    /**
     * 创建一条能力组定义，减少目录初始化时的重复样板代码。
     *
     * @param name 能力组的稳定英文名称
     * @param description 提供给主模型和 Jev 的中文能力说明
     * @param matcher 判断某个 Tool 是否属于该组的规则
     * @return 新的能力组定义
     */
    private static Capability capability(
            String name,
            String description,
            Predicate<String> matcher
    ) {
        return new Capability(name, description, matcher);
    }

    /**
     * 创建“精确名称集合”匹配器。
     *
     * @param names 允许匹配的 Tool 名称列表
     * @return Tool 名称匹配规则
     */
    private static Predicate<String> names(String... names) {
        // values：由可变参数转换成的不可变名称集合，用于常量时间查找。
        Set<String> values = Set.of(names);
        return values::contains;
    }

    /**
     * 创建“名称前缀”匹配器。
     *
     * @param prefixes 一个或多个 Tool 名称前缀
     * @return Tool 名称匹配规则
     */
    private static Predicate<String> prefixes(String... prefixes) {
        // values：保存全部允许前缀，供返回的 Predicate 闭包读取。
        List<String> values = List.of(prefixes);
        // toolName：Predicate 每次判断时收到的具体 Tool 名称。
        return toolName -> values.stream().anyMatch(toolName::startsWith);
    }

    /**
     * 创建“一个精确名称或一个前缀”匹配器。
     *
     * @param name 允许精确匹配的 Tool 名称
     * @param prefix 允许匹配的 Tool 名称前缀
     * @return Tool 名称匹配规则
     */
    private static Predicate<String> nameOrPrefix(String name, String prefix) {
        // toolName：Predicate 每次判断时收到的具体 Tool 名称。
        return toolName -> name.equals(toolName) || toolName.startsWith(prefix);
    }

    /**
     * 单个 Tool 能力组定义。
     *
     * @param name 能力组的稳定英文名称
     * @param description 能力组用途说明
     * @param matcher Tool 名称匹配规则
     */
    public record Capability(
            String name,
            String description,
            Predicate<String> matcher
    ) {
        /**
         * 判断给定 Tool 是否属于当前能力组。
         *
         * @param toolName 待判断的 Tool 名称
         * @return 属于当前组时返回 true
         */
        public boolean matches(String toolName) {
            return matcher.test(toolName);
        }
    }
}
```

然后修改 `ToolSchemaRoutingPolicy`：

- 删除它自己的 `GROUPS`、`GroupDefinition` 和匹配辅助方法；
- `apply` 改为接收 `ToolCapabilityCatalog`；
- 创建分组和移动工具时都从目录读取。

示意代码：

```java
/**
 * 将 Toolkit 中已注册的工具划入能力组，并注册常驻元工具。
 *
 * @param toolkit 当前 HarnessAgent 使用的完整工具容器
 * @param catalog ButvanAgent 唯一的能力组目录
 */
static void apply(Toolkit toolkit, ToolCapabilityCatalog catalog) {
    // capability：当前正在创建或检查的单个能力组定义。
    for (ToolCapabilityCatalog.Capability capability : catalog.capabilities()) {
        if (toolkit.getToolGroup(capability.name()) == null) {
            toolkit.createToolGroup(
                    capability.name(),
                    capability.description(),
                    false
            );
        }
    }

    // toolName：Toolkit 当前已经注册的单个 Tool 名称。
    for (String toolName : List.copyOf(toolkit.getToolNames())) {
        if (ToolCapabilityCatalog.META_TOOL_NAME.equals(toolName)) continue;
        // group：toolName 匹配到的能力组。
        catalog.groupFor(toolName)
                .ifPresent(group -> moveToGroup(toolkit, toolName, group.name()));
    }

    if (toolkit.getTool(ToolCapabilityCatalog.META_TOOL_NAME) == null) {
        toolkit.registerMetaTool();
    }
}
```

`ToolRegistry` 增加目录依赖：

```java
/** toolkit：保存项目业务 Tool 的基础 AgentScope 工具容器。 */
private final Toolkit toolkit;

/** capabilityCatalog：Tool 能力组的唯一目录。 */
private final ToolCapabilityCatalog capabilityCatalog;

/**
 * 创建工具注册表，并注册所有 Spring 发现的 Tool 模块。
 *
 * @param toolModules Spring 收集到的全部业务 Tool 模块
 * @param capabilityCatalog Tool 能力组目录
 */
public ToolRegistry(
        List<AgentToolModule> toolModules,
        ToolCapabilityCatalog capabilityCatalog
) {
    this.capabilityCatalog = capabilityCatalog;
    this.toolkit = new Toolkit();
    toolModules.forEach(this.toolkit::registerTool);
}

/**
 * 在 HarnessAgent 完成内置工具注册后应用按需 Schema 分组。
 *
 * @param agentToolkit 最终属于 HarnessAgent 的完整 Toolkit
 */
public void enableOnDemandSchemas(Toolkit agentToolkit) {
    ToolSchemaRoutingPolicy.apply(agentToolkit, capabilityCatalog);
}
```

构造器签名改变后，现有 `ToolRegistryTest` 也要显式传入目录：

```java
// catalog：测试专用能力组目录，不依赖 Spring 容器。
ToolCapabilityCatalog catalog = new ToolCapabilityCatalog();

// registry：待验证的 ToolRegistry，被测实例使用空业务 Tool 列表。
ToolRegistry registry = new ToolRegistry(List.of(), catalog);
```

生产环境仍由 Spring 自动注入，不需要手工创建。

### 6.2 本步验收

此时还没有接入 Jev，功能行为必须完全不变：

```bash
cd agent-backend
mvn -pl server-agents -am -Dtest=ToolRegistryTest \
  -Dsurefire.failIfNoSpecifiedTests=false test
```

再新增 `ToolCapabilityCatalogTest`，至少覆盖：

- `calendar_query` 属于 `calendar`；
- `read_file` 属于 `workspace`；
- 未分类工具返回空；
- 能力组名称没有重复；
- 所有当前已注册并计划路由的工具都能匹配。

---

## 7. 第 2 步：增加 TypeSafe 本地配置

### 7.1 配置放在哪里

不要把 API Key 写入 `application.yml`、源码或 Git。沿用项目规范，只写入：

```text
~/.butvan-agent/config.json
```

在根对象新增独立的 `typesafe` 节点。Jev 不是主聊天模型供应商，因此不要塞进现有 `providers` 节点。

```json
{
  "typesafe": {
    "enabled": true,
    "mode": "shadow",
    "apiKey": "你的 TypeSafe API Key",
    "model": "jev-latest",
    "threshold": 0.75
  }
}
```

三个运行模式：

| 模式 | 是否请求 Jev | 是否改变 Tool Schema | 用途 |
| --- | --- | --- | --- |
| `off` | 否 | 否 | 紧急回滚或未配置 |
| `shadow` | 是 | 否 | 只观察准确率和延迟 |
| `active` | 是 | 是 | 正式应用路由结果 |

### 7.2 配置领域对象

新建 `ToolRoutingMode.java`：

```java
package butvan.agent.agents.routing;

import java.util.Locale;

/** Jev 工具路由的运行模式。 */
public enum ToolRoutingMode {
    /** 完全关闭：不请求 Jev，也不改变 Tool Schema。 */
    OFF,

    /** 影子运行：请求 Jev 并记录结果，但不改变 Tool Schema。 */
    SHADOW,

    /** 正式运行：请求 Jev，并把结果应用到当前模型调用。 */
    ACTIVE;

    /**
     * 把用户配置文本安全转换为路由模式。
     *
     * @param value 配置文件中的模式文本，例如 off、shadow 或 active
     * @return 对应模式；空值或非法值统一返回 OFF
     */
    public static ToolRoutingMode parse(String value) {
        if (value == null || value.isBlank()) return OFF;
        try {
            return valueOf(value.strip().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ignored) {
            // ignored：表示配置值不是合法枚举；按安全默认值关闭路由。
            return OFF;
        }
    }
}
```

新建 `TypeSafeConfigData.java`：

```java
package butvan.agent.agents.config;

import butvan.agent.agents.routing.ToolRoutingMode;

/**
 * TypeSafe Jev 本地配置快照。
 *
 * @param enabled 用户是否总开关启用 Jev 路由
 * @param mode 当前灰度模式
 * @param apiKey TypeSafe API Key；禁止写入日志
 * @param model 调用的 Jev 模型或别名
 * @param threshold 选中能力组所需的最低 Noul 概率
 */
public record TypeSafeConfigData(
        boolean enabled,
        ToolRoutingMode mode,
        String apiKey,
        String model,
        double threshold
) {
    /**
     * 创建安全的关闭态默认配置。
     *
     * @return 不会发起网络请求的默认配置
     */
    public static TypeSafeConfigData disabled() {
        return new TypeSafeConfigData(false, ToolRoutingMode.OFF, "", "jev-latest", 0.75);
    }

    /**
     * 判断当前配置是否具备调用 Jev 的必要条件。
     *
     * @return 总开关已启用、模式非 OFF 且 API Key 非空时返回 true
     */
    public boolean isReady() {
        return enabled
                && mode != null
                && mode != ToolRoutingMode.OFF
                && apiKey != null
                && !apiKey.isBlank()
                && model != null
                && !model.isBlank()
                && Double.isFinite(threshold)
                && threshold >= 0.0
                && threshold <= 1.0;
    }
}
```

新建 `TypeSafeProperties.java`，写法可直接参考现有 `TavilyProperties`：

```java
package butvan.agent.agents.config;

import butvan.agent.agents.routing.ToolRoutingMode;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

/** 从用户级 config.json 动态读取 TypeSafe Jev 配置。 */
@Slf4j
@Component
public class TypeSafeProperties {

    /** CONFIG_PATH：ButvanAgent 用户级配置文件的固定位置。 */
    private static final Path DEFAULT_CONFIG_PATH = Paths.get(
            System.getProperty("user.home"), ".butvan-agent", "config.json");

    /** objectMapper：负责解析本地 JSON 配置文件的 Jackson 组件。 */
    private final ObjectMapper objectMapper;

    /** configPath：当前实例读取的配置路径；测试可以传入临时文件。 */
    private final Path configPath;

    /**
     * 创建生产环境配置读取器。
     *
     * @param objectMapper Spring 统一配置的 JSON 解析器
     */
    @Autowired
    public TypeSafeProperties(ObjectMapper objectMapper) {
        this(objectMapper, DEFAULT_CONFIG_PATH);
    }

    /**
     * 创建可指定配置路径的读取器，供同包测试使用。
     *
     * @param objectMapper JSON 解析器
     * @param configPath 待读取的配置文件路径
     */
    TypeSafeProperties(ObjectMapper objectMapper, Path configPath) {
        this.objectMapper = objectMapper;
        this.configPath = configPath;
    }

    /**
     * 每次路由前读取最新的 TypeSafe 配置。
     *
     * @return 有效配置；文件缺失、节点缺失或读取失败时返回关闭态
     */
    public TypeSafeConfigData load() {
        try {
            if (!Files.isRegularFile(configPath)) return TypeSafeConfigData.disabled();

            // node：config.json 根对象中的 typesafe 配置节点。
            JsonNode node = objectMapper.readTree(configPath.toFile()).path("typesafe");
            if (node.isMissingNode() || node.isNull()) return TypeSafeConfigData.disabled();

            // threshold：Noul 概率达到该值时，能力组才会被选中。
            double threshold = node.path("threshold").asDouble(0.75);
            if (!Double.isFinite(threshold) || threshold < 0.0 || threshold > 1.0) {
                threshold = 0.75;
            }

            // model：空字符串也统一回退到稳定别名。
            String model = node.path("model").asText("jev-latest").strip();
            if (model.isEmpty()) model = "jev-latest";

            return new TypeSafeConfigData(
                    node.path("enabled").asBoolean(false),
                    ToolRoutingMode.parse(node.path("mode").asText("off")),
                    node.path("apiKey").asText(""),
                    model,
                    threshold
            );
        } catch (IOException | RuntimeException exception) {
            // exception：读取或解析配置时发生的异常；禁止记录配置内容。
            log.error("读取 TypeSafe 配置失败，Jev 路由将保持关闭：{}", configPath, exception);
            return TypeSafeConfigData.disabled();
        }
    }
}
```

注意：日志只能记录配置文件路径和错误类型，不能输出配置对象、请求 Header 或 API Key。

### 7.3 本步验收

给配置读取器写临时目录测试会更干净。为此可把配置路径作为包级构造参数注入，生产构造器仍使用默认路径。测试至少覆盖：

- 文件不存在时返回关闭态；
- `typesafe` 节点不存在时返回关闭态；
- 非法 mode 回退为 `OFF`；
- threshold 超出 `0..1` 时回退默认值；
- 读取失败不会抛到聊天主流程。

---

## 8. 第 3 步：定义路由领域接口

先定义内部契约，再写 HTTP。这样单元测试不依赖真实网络。

### 8.1 路由请求

```java
package butvan.agent.agents.routing;

import java.util.Set;

/**
 * 一次用户轮次提交给 Tool 路由器的最小输入。
 *
 * @param userInput 当前用户可见的请求文本
 * @param availableGroups 本次允许 Jev 判断的能力组名称集合
 */
public record ToolRoutingRequest(
        String userInput,
        Set<String> availableGroups
) {}
```

这里只传“当前用户可见输入”，不要把完整聊天历史、个人画像、Memory、RAG 文档和 System Prompt 一起发送给 Jev。能力路由通常不需要这些内容，少发数据也更符合最小化原则。

### 8.2 路由结果

```java
package butvan.agent.agents.routing;

import java.util.Map;
import java.util.Set;

/**
 * 一次 Jev Tool 路由的不可变结果。
 *
 * @param status 本次路由处于关闭、影子、启用还是降级状态
 * @param selectedGroups 达到阈值的能力组名称
 * @param probabilities 每个能力组对应的 Noul yes 概率
 * @param providerModel TypeSafe 实际返回的模型版本
 * @param durationMillis 本次路由请求的总耗时毫秒数
 */
public record ToolRoutingDecision(
        Status status,
        Set<String> selectedGroups,
        Map<String, Double> probabilities,
        String providerModel,
        long durationMillis
) {
    /** 路由决策的生命周期状态。 */
    public enum Status {
        /** 未启用 Jev。 */
        OFF,

        /** 已获得 Jev 结果，但只观察、不应用。 */
        SHADOW,

        /** 已获得 Jev 结果，并应用于本轮模型调用。 */
        ACTIVE,

        /** Jev 调用或响应校验失败，回退原流程。 */
        FALLBACK
    }

    /**
     * 判断 Middleware 是否应该应用本决策。
     *
     * @return 只有 ACTIVE 状态返回 true
     */
    public boolean appliesToModelCall() {
        return status == Status.ACTIVE;
    }

    /**
     * 创建“Jev 未启用”的决策。
     *
     * @return OFF 状态的空决策
     */
    public static ToolRoutingDecision off() {
        return new ToolRoutingDecision(Status.OFF, Set.of(), Map.of(), "", 0L);
    }

    /**
     * 创建“Jev 失败并回退”的决策。
     *
     * @param durationMillis 失败前已经消耗的时间
     * @return FALLBACK 状态的空决策
     */
    public static ToolRoutingDecision fallback(long durationMillis) {
        return new ToolRoutingDecision(
                Status.FALLBACK, Set.of(), Map.of(), "", durationMillis);
    }
}
```

所有集合建议在构造器里 `Set.copyOf` / `Map.copyOf`，保证写入 `RuntimeContext` 后不会被其他代码修改。

### 8.3 路由接口

```java
package butvan.agent.agents.routing;

/** 主流程依赖的 Tool 能力路由抽象。 */
public interface ToolCapabilityRouter {

    /**
     * 根据当前用户请求选择可能需要的能力组。
     *
     * @param request 当前用户轮次的最小路由输入
     * @return 不会为 null 的路由决策
     */
    ToolRoutingDecision route(ToolRoutingRequest request);
}
```

业务层以后只依赖这个接口，不依赖 HTTP DTO。

---

## 9. 第 4 步：编写 Jev HTTP Adapter

### 9.1 为什么直接调用 HTTP

TypeSafe 当前官方客户端页面列出 Python 与 JavaScript/TypeScript SDK，同时明确允许其他语言直接调用 HTTP API。ButvanAgent 是 Java 21 + Spring Boot，`server-agents` 已依赖 `spring-boot-starter-web`，所以第一版直接使用 Spring `RestClient`，不需要引入非官方 Java SDK。

API 基本契约：

```text
POST https://api.typesafe.ai/v1/systemone
Authorization: Bearer <API_KEY>
Content-Type: application/json
```

请求顶层字段是 `state`、`model`、`questions`，推荐模型别名为 `jev-latest`。

### 9.2 DTO

`JevNoulQuestion.java`：

```java
package butvan.agent.agents.routing.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * 发送给 System One 的一个 Noul 二分类问题。
 *
 * @param type 固定为 noul
 * @param instructions Jev 需要判断的问题文本
 * @param criteria yes/no 两种结果的业务含义
 */
public record JevNoulQuestion(
        String type,
        String instructions,
        Criteria criteria
) {
    /**
     * 用统一标准创建能力组判断问题。
     *
     * @param instructions 针对某个能力组的判断说明
     * @return 可直接加入 questions Map 的 Noul 问题
     */
    public static JevNoulQuestion of(String instructions) {
        return new JevNoulQuestion(
                "noul",
                instructions,
                new Criteria("需要该能力组", "不需要该能力组")
        );
    }

    /**
     * Noul 两端概率的语义说明。
     *
     * @param yes 概率接近 1 时代表的含义，序列化字段名为 true
     * @param no 概率接近 0 时代表的含义，序列化字段名为 false
     */
    public record Criteria(
            @JsonProperty("true") String yes,
            @JsonProperty("false") String no
    ) {}
}
```

其余 DTO：

```java
/**
 * System One HTTP 请求体。
 *
 * @param state 本次需要判断的用户文本
 * @param model Jev 模型名称或别名
 * @param questions 以能力组名为键的 Noul 问题
 */
public record JevSystemOneRequest(
        String state,
        String model,
        Map<String, JevNoulQuestion> questions
) {}

/**
 * 单个 Noul 问题的响应。
 *
 * @param type 响应类型，预期为 noul
 * @param noul 答案为 yes 的概率，范围为 0..1
 */
public record JevNoulAnswer(
        String type,
        Double noul
) {}

/**
 * TypeSafe 返回的本次请求 Token 用量。
 *
 * @param inputTokens TypeSafe 统计的输入 Token 数
 * @param outputTokens TypeSafe 统计的输出 Token 数
 */
public record JevUsage(
        @JsonProperty("input_tokens") long inputTokens,
        @JsonProperty("output_tokens") long outputTokens
) {}

/**
 * System One HTTP 响应体。
 *
 * @param model 实际执行判断的 Jev 模型版本
 * @param answers 以请求 question id 为键的 Noul 答案
 * @param usage 本次 Jev 请求的 Token 用量
 */
public record JevSystemOneResponse(
        String model,
        Map<String, JevNoulAnswer> answers,
        JevUsage usage
) {}
```

每个 `public record` 应放在独立文件中，并补上中文 Javadoc。

### 9.3 HTTP Client 配置

路由位于主模型调用之前，必须短超时、失败放行。建议连接超时 500ms、读取超时 1000ms，后续再根据真实指标调整。

```java
package butvan.agent.agents.routing;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

import java.net.http.HttpClient;
import java.time.Duration;

/** 创建与其他外部服务隔离的 TypeSafe 专用 HTTP Client。 */
@Configuration
public class TypeSafeHttpConfiguration {

    /**
     * 创建 TypeSafe 专用的短超时 HTTP Client。
     *
     * @return 只配置 TypeSafe base URL 和超时策略的 RestClient
     */
    @Bean
    @Qualifier("typeSafeRestClient")
    RestClient typeSafeRestClient() {
        // httpClient：JDK 底层客户端，连接建立最多等待 500ms。
        HttpClient httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofMillis(500))
                .build();

        // requestFactory：把 JDK HttpClient 接入 Spring，并限制响应读取时间。
        JdkClientHttpRequestFactory requestFactory =
                new JdkClientHttpRequestFactory(httpClient);
        requestFactory.setReadTimeout(Duration.ofMillis(1000));

        return RestClient.builder()
                .baseUrl("https://api.typesafe.ai")
                .requestFactory(requestFactory)
                .build();
    }
}
```

不要设置全局默认 `Authorization` Header，因为 API Key 来自可更新的用户配置，应在每次请求时读取并设置。

### 9.4 Gateway 接口与 Adapter

```java
package butvan.agent.agents.routing;

import butvan.agent.agents.routing.dto.JevNoulQuestion;
import butvan.agent.agents.routing.dto.JevSystemOneResponse;

import java.util.Map;

/** 对 TypeSafe System One HTTP API 的项目内抽象。 */
public interface SystemOneGateway {

    /**
     * 调用 System One，批量判断多个 Noul 问题。
     *
     * @param apiKey 当前用户配置的 TypeSafe API Key
     * @param model Jev 模型名称或别名
     * @param state 本次需要判断的用户文本
     * @param questions 以能力组名称为键的 Noul 问题
     * @return TypeSafe 的结构化响应
     */
    JevSystemOneResponse evaluate(
            String apiKey,
            String model,
            String state,
            Map<String, JevNoulQuestion> questions
    );
}
```

Adapter 的核心代码：

```java
/** 使用 Spring RestClient 调用 TypeSafe System One 的 HTTP Adapter。 */
@Component
public class JevSystemOneAdapter implements SystemOneGateway {

    /** restClient：只用于访问 TypeSafe API 的短超时 HTTP Client。 */
    private final RestClient restClient;

    /**
     * 创建 System One HTTP Adapter。
     *
     * @param restClient 由 TypeSafeHttpConfiguration 创建的专用客户端
     */
    public JevSystemOneAdapter(
            @Qualifier("typeSafeRestClient") RestClient restClient
    ) {
        this.restClient = restClient;
    }

    /**
     * 向 System One 发送一次批量 Noul 判断请求。
     *
     * @param apiKey 当前用户的 TypeSafe API Key
     * @param model Jev 模型名称或别名
     * @param state 当前用户可见的请求文本
     * @param questions 需要同时判断的能力组问题
     * @return 非空的结构化 Jev 响应
     * @throws JevGatewayException 网络失败、HTTP 错误或空响应时抛出
     */
    @Override
    public JevSystemOneResponse evaluate(
            String apiKey,
            String model,
            String state,
            Map<String, JevNoulQuestion> questions
    ) {
        // request：即将序列化为 JSON 的 System One 请求体。
        JevSystemOneRequest request = new JevSystemOneRequest(state, model, questions);
        try {
            // response：RestClient 反序列化得到的 System One 响应。
            JevSystemOneResponse response = restClient.post()
                    .uri("/v1/systemone")
                    .headers(headers -> {
                        // headers：仅属于当前请求的 HTTP Header 集合，用于写入最新 API Key。
                        headers.setBearerAuth(apiKey);
                    })
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(request)
                    .retrieve()
                    .body(JevSystemOneResponse.class);

            if (response == null) {
                throw new JevGatewayException("TypeSafe 返回空响应");
            }
            return response;
        } catch (RestClientResponseException exception) {
            // exception：TypeSafe 返回 4xx/5xx 时由 RestClient 抛出的 HTTP 异常。
            throw new JevGatewayException(
                    "TypeSafe 请求失败，HTTP " + exception.getStatusCode().value(),
                    exception
            );
        } catch (RestClientException exception) {
            // exception：连接、超时或响应解析失败时产生的客户端异常。
            throw new JevGatewayException("TypeSafe 网络请求失败", exception);
        }
    }
}
```

同时新建一个只表达外部网关失败的异常，避免业务层依赖 Spring HTTP 异常：

```java
package butvan.agent.agents.routing;

/** 表示 TypeSafe System One 调用或响应校验失败。 */
public class JevGatewayException extends RuntimeException {

    /**
     * 创建不携带底层原因的网关异常。
     *
     * @param message 可安全写入内部日志的错误摘要；不得包含 Key 或用户原文
     */
    public JevGatewayException(String message) {
        super(message);
    }

    /**
     * 创建保留底层原因的网关异常。
     *
     * @param message 可安全写入内部日志的错误摘要；不得包含 Key 或用户原文
     * @param cause RestClient 抛出的原始异常，仅用于内部诊断
     */
    public JevGatewayException(String message, Throwable cause) {
        super(message, cause);
    }
}
```

这里故意不把响应 body、请求 state 或 Header 拼进异常。官方对 `429`、`529` 建议指数退避，但本路径对首 token 延迟敏感，因此 MVP 的 `active` 模式应立即 fail-open，不在用户请求线程中连续重试。后续若要重试，最多一次、必须受总时限约束，并优先只在 shadow 采样任务中使用。

### 9.5 Adapter 测试

使用 `MockRestServiceServer` 绑定 `RestClient.Builder`，不要请求真实 TypeSafe 服务。至少验证：

- URL、POST 方法和 Bearer Header 正确；
- JSON 包含 `state`、`model` 和全部 questions；
- 正常响应能解析 Noul 和 usage；
- 401、422、429、529 转为安全异常；
- 异常文本中不含 API Key 和用户输入。

---

## 10. 第 5 步：实现 Jev 能力路由器

`JevToolCapabilityRouter` 的职责只有五件事：

1. 读取本地配置；
2. 把能力组目录转换为 Noul questions；
3. 调用 `SystemOneGateway`；
4. 校验响应并按阈值选组；
5. 任何异常都返回 `FALLBACK`，不阻断主聊天。

建议先限制路由输入长度，例如最多 4000 个 Java 字符，避免误把大段粘贴内容发送给外部服务：

```java
/** 使用 Jev Noul 概率为当前用户轮次选择 Tool 能力组。 */
@Slf4j
@Component
@RequiredArgsConstructor
public class JevToolCapabilityRouter implements ToolCapabilityRouter {

    /** MAX_INPUT_CHARS：允许发送给 Jev 的最大 Java 字符数，限制隐私范围与成本。 */
    private static final int MAX_INPUT_CHARS = 4_000;

    /** properties：按需读取当前用户 TypeSafe 本地配置。 */
    private final TypeSafeProperties properties;

    /** capabilityCatalog：提供能力组名称、说明和 Tool 分类规则。 */
    private final ToolCapabilityCatalog capabilityCatalog;

    /** gateway：隔离实际的 TypeSafe System One HTTP 调用。 */
    private final SystemOneGateway gateway;

    /**
     * 为一次新用户轮次生成 Tool 能力组决策。
     *
     * @param request 当前用户文本和允许判断的能力组集合
     * @return OFF、SHADOW、ACTIVE 或 FALLBACK 状态的不可变决策
     */
    @Override
    public ToolRoutingDecision route(ToolRoutingRequest request) {
        // startedAt：单调时钟起点，只用于计算路由耗时，不代表墙上时间。
        long startedAt = System.nanoTime();
        try {
            // config：本次路由开始时读取到的 TypeSafe 配置快照。
            // 必须放在 try 内，保证配置读取异常也能 fail-open。
            TypeSafeConfigData config = properties.load();
            if (!config.isReady()) return ToolRoutingDecision.off();

            // state：去除首尾空白并执行长度限制后的 Jev 输入文本。
            String state = normalizeInput(request.userInput());

            // questions：以能力组名为键、一次性发送给 Jev 的全部 Noul 问题。
            Map<String, JevNoulQuestion> questions = capabilityCatalog.capabilities()
                    .stream()
                    // item：目录流中正在检查的能力组定义。
                    .filter(item -> request.availableGroups().contains(item.name()))
                    .collect(java.util.stream.Collectors.toUnmodifiableMap(
                            ToolCapabilityCatalog.Capability::name,
                            // item：转换为 Noul 问题的单个能力组定义。
                            item -> JevNoulQuestion.of(
                                    "完成当前用户请求是否需要以下能力：" + item.description())
                    ));

            // response：System One 对全部能力组问题返回的原始结构化响应。
            JevSystemOneResponse response = gateway.evaluate(
                    config.apiKey(), config.model(), state, questions);

            // probabilities：校验完成后，以能力组名为键的 yes 概率。
            Map<String, Double> probabilities = validateAnswers(questions, response);

            // selected：概率达到配置阈值、准备暴露给主模型的能力组。
            Set<String> selected = probabilities.entrySet().stream()
                    // entry：当前正在与阈值比较的“能力组名 -> 概率”条目。
                    .filter(entry -> entry.getValue() >= config.threshold())
                    .map(Map.Entry::getKey)
                    .collect(java.util.stream.Collectors.toUnmodifiableSet());

            // status：决定结果只用于观测，还是实际应用于本轮 Model Call。
            ToolRoutingDecision.Status status = config.mode() == ToolRoutingMode.ACTIVE
                    ? ToolRoutingDecision.Status.ACTIVE
                    : ToolRoutingDecision.Status.SHADOW;

            // decision：准备写入 RuntimeContext 的本轮最终路由决策。
            ToolRoutingDecision decision = new ToolRoutingDecision(
                    status,
                    selected,
                    probabilities,
                    response.model(),
                    elapsedMillis(startedAt)
            );
            log.info("Jev Tool 路由完成：status={}, groups={}, probabilities={}, costMs={}",
                    decision.status(), decision.selectedGroups(),
                    decision.probabilities(), decision.durationMillis());
            return decision;
        } catch (RuntimeException exception) {
            // exception：配置读取之后，构建问题、调用 Jev 或校验响应时发生的异常。
            // duration：路由失败前已消耗的总时间，用于观察外部依赖影响。
            long duration = elapsedMillis(startedAt);
            log.warn("Jev Tool 路由失败，回退原有 Schema 流程：costMs={}, errorType={}",
                    duration, exception.getClass().getSimpleName());
            return ToolRoutingDecision.fallback(duration);
        }
    }

    /**
     * 校验 Jev 是否为每个问题返回合法的 Noul 概率。
     *
     * @param questions 本次实际发出的能力组问题
     * @param response System One 返回的响应体
     * @return 以能力组名为键的不可变概率 Map
     * @throws JevGatewayException answers 缺失、类型错误或概率越界时抛出
     */
    private Map<String, Double> validateAnswers(
            Map<String, JevNoulQuestion> questions,
            JevSystemOneResponse response
    ) {
        if (response.answers() == null) {
            throw new JevGatewayException("TypeSafe 响应缺少 answers");
        }

        // probabilities：按问题遍历顺序暂存已经校验通过的能力组概率。
        Map<String, Double> probabilities = new LinkedHashMap<>();

        // group：questions 中当前正在校验的能力组名称。
        for (String group : questions.keySet()) {
            // answer：TypeSafe 为当前能力组返回的 Noul 答案。
            JevNoulAnswer answer = response.answers().get(group);
            if (answer == null || !"noul".equals(answer.type()) || answer.noul() == null) {
                throw new JevGatewayException("TypeSafe 响应缺少有效 Noul 答案");
            }
            if (answer.noul() < 0.0 || answer.noul() > 1.0) {
                throw new JevGatewayException("TypeSafe Noul 概率超出范围");
            }
            probabilities.put(group, answer.noul());
        }
        return Map.copyOf(probabilities);
    }

    /**
     * 清理并限制发送给 Jev 的用户输入。
     *
     * @param value 当前用户可见的原始请求文本
     * @return 去除首尾空白且不超过 MAX_INPUT_CHARS 的文本
     * @throws IllegalArgumentException 输入为空时抛出
     */
    private String normalizeInput(String value) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("路由输入不能为空");
        }
        // normalized：去除首尾空白后的用户输入。
        String normalized = value.strip();
        return normalized.length() <= MAX_INPUT_CHARS
                ? normalized
                : normalized.substring(0, MAX_INPUT_CHARS);
    }

    /**
     * 使用单调时钟计算路由耗时。
     *
     * @param startedAt 调用 System.nanoTime() 记录的起始值
     * @return 从 startedAt 到现在的毫秒数
     */
    private long elapsedMillis(long startedAt) {
        return java.util.concurrent.TimeUnit.NANOSECONDS.toMillis(
                System.nanoTime() - startedAt);
    }
}
```

实际书写时补齐 import，并让 `JevGatewayException` 继承 `RuntimeException`。

### 10.1 没有组选中时怎么办

不要自动选择全部组。空集合是合法结果，表示当前请求可能不需要领域 Tool。Middleware 仍会保留：

- `reset_equipped_tools`；
- 目录无法识别的兼容工具；
- AgentScope 必需的未分类工具。

所以主模型仍有补救能力。

### 10.2 本步测试

用假的 `SystemOneGateway` 测试，不访问网络：

- 一次选择 `workspace + web` 多个组；
- 概率等于阈值时选中；
- 低于阈值时不选；
- `off` 不调用 Gateway；
- `shadow` 产生结果但不应用；
- 缺答案、类型错误、概率越界时返回 `FALLBACK`；
- 输入超过 4000 字符时被截断；
- Gateway 超时或抛异常时不会向上抛出。

---

## 11. 第 6 步：在 AgentService 中生成“本轮决策”

给 `AgentService` 注入：

```java
/** toolCapabilityRouter：根据当前用户请求产生本轮 Jev 能力组决策。 */
private final ToolCapabilityRouter toolCapabilityRouter;

/** toolCapabilityCatalog：提供允许路由的能力组名称集合。 */
private final ToolCapabilityCatalog toolCapabilityCatalog;

/** toolRoutingStateSynchronizer：让模型可见 Schema 与会话级工具执行状态保持一致。 */
private final ToolRoutingStateSynchronizer toolRoutingStateSynchronizer;
```

在 `produceEvents` 中，`AgentRun` 和 checkpoint 已经建立、取消检查已经完成后，主模型调用之前加入：

```java
// routingDecision：当前用户轮次的 Jev 路由结果；只存入本轮 RuntimeContext。
ToolRoutingDecision routingDecision = toolCapabilityRouter.route(
        new ToolRoutingRequest(displayContent, toolCapabilityCatalog.groupNames())
);

// context：当前 AgentRun 独享的运行上下文；以类型作为决策的读取键。
context.put(ToolRoutingDecision.class, routingDecision);

// 仅 ACTIVE 模式执行：把选中组同步到当前会话的 AgentState 并持久化。
synchronizeToolRoutingState(userId, request.sessionId(), routingDecision);

// streamSession：当前 SSE 运行会话；路由期间用户也可能发出取消请求。
if (streamSession.isCancelled()) {
    // run：已经建立 checkpoint 的当前 AgentRun，用现有取消流程统一收尾。
    finishCancelled(run, streamSession);
    return;
}

// input：可能包含应用内部展开内容的主模型输入；不会发送给 Jev。
// request：当前 AgentUserCall，用于取得本轮显式 RAG 上下文。
runAgentStream(
        run,
        List.of(run.currentUserMessage(input, request.ragContexts())),
        streamSession
);
```

`ToolRoutingStateSynchronizer` 的核心实现如下：

```java
/** 将 ACTIVE 路由决策同步到 AgentScope 的会话级工具状态。 */
@Component
public class ToolRoutingStateSynchronizer {

    /**
     * @param state 当前用户、当前会话的 AgentScope 状态
     * @param decision 当前用户轮次的路由决策
     * @return 会话状态发生变化时返回 true
     */
    public boolean apply(AgentState state, ToolRoutingDecision decision) {
        if (state == null || decision == null || !decision.appliesToModelCall()) {
            return false;
        }

        // selectedGroups：排序后的能力组快照，保证状态文件内容稳定。
        List<String> selectedGroups = decision.selectedGroups().stream().sorted().toList();
        if (selectedGroups.equals(state.getToolContext().getActivatedGroups())) {
            return false;
        }

        state.getToolContext().setActivatedGroups(selectedGroups);
        return true;
    }
}
```

`AgentService` 中负责取得并保存当前会话状态：

```java
/** 将 ACTIVE 路由决策写入当前会话状态，并在模型调用前持久化。 */
private void synchronizeToolRoutingState(
        String userId,
        String sessionId,
        ToolRoutingDecision decision
) {
    if (decision == null || !decision.appliesToModelCall()) return;

    // agent：按当前会话所属项目取得的 HarnessAgent。
    HarnessAgent agent = agentFactory.currentAgent(sessionId);
    // state：当前用户和当前会话独享的 AgentScope 状态。
    AgentState state = agent.getDelegate().getAgentState(userId, sessionId);
    if (toolRoutingStateSynchronizer.apply(state, decision)) {
        agent.getDelegate().saveAgentState(userId, sessionId);
    }
}
```

这里修改的是会话 `AgentState`，不是共享 Toolkit。HITL 权限恢复会重新加载同一个会话状态，
因此被 Jev 选中的工具在确认后仍然可执行。

这里选择 `displayContent`，而不是包含隐藏上下文的 `input`，原因是：

- `displayContent` 是用户本轮实际看到并提交的请求；
- `input` 可能由 Slash Command 展开，带入额外资料；
- 路由只需要判断能力，不应默认把 RAG、Memory 或隐藏上下文发送给外部服务。

如果某类 Slash Command 确实需要额外路由线索，应显式构建一个经过脱敏、限定字段的 `routingText`，不要直接改成发送完整 `request.context()`。

正常 HITL 审批恢复会继续使用原来的 `AgentRun`，因此进程内的 `RuntimeContext` 和路由决策仍在，不需要为 MVP 新增 checkpoint 字段。项目目前也不承诺进程重启后恢复旧审批；将来若实现真正可恢复运行，再把路由决策纳入 checkpoint 版本迁移。

---

## 12. 第 7 步：只为本轮组装 Tool Schema

新建 `ToolSchemaSelectionMiddleware.java`：

```java
package butvan.agent.agents.tool;

import butvan.agent.agents.routing.ToolRoutingDecision;
import io.agentscope.core.agent.Agent;
import io.agentscope.core.agent.RuntimeContext;
import io.agentscope.core.event.AgentEvent;
import io.agentscope.core.middleware.ActingInput;
import io.agentscope.core.middleware.MiddlewareBase;
import io.agentscope.core.middleware.ModelCallInput;
import io.agentscope.core.model.ToolSchema;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Flux;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;

/** 按本轮 Jev 决策组装模型可见的 Tool Schema，不修改共享 Toolkit。 */
@Component
public class ToolSchemaSelectionMiddleware implements MiddlewareBase {

    /** MANUAL_OVERRIDE_KEY：标记主模型已经显式接管本轮 Tool Group 选择。 */
    private static final String MANUAL_OVERRIDE_KEY =
            "butvan.tool-schema-routing.manual-override";

    /** capabilityCatalog：用于判断一个 Tool 是分组工具还是常驻兼容工具。 */
    private final ToolCapabilityCatalog capabilityCatalog;

    /**
     * 创建本轮 Tool Schema 选择 Middleware。
     *
     * @param capabilityCatalog 项目唯一的 Tool 能力组目录
     */
    public ToolSchemaSelectionMiddleware(ToolCapabilityCatalog capabilityCatalog) {
        this.capabilityCatalog = capabilityCatalog;
    }

    /**
     * 观察主模型是否调用 reset_equipped_tools。
     *
     * @param agent 当前执行工具的 Agent
     * @param context 当前运行独享的上下文
     * @param input 本轮准备执行的工具调用
     * @param next Middleware 链的下一个处理函数
     * @return 下游工具执行事件流
     */
    @Override
    public Flux<AgentEvent> onActing(
            Agent agent,
            RuntimeContext context,
            ActingInput input,
            Function<ActingInput, Flux<AgentEvent>> next
    ) {
        // resetsEquippedTools：本批工具调用是否包含能力组重置元工具。
        boolean resetsEquippedTools = input != null
                && input.toolCalls() != null
                && input.toolCalls().stream().anyMatch(toolCall ->
                ToolCapabilityCatalog.META_TOOL_NAME.equals(toolCall.getName()));
        if (resetsEquippedTools && context != null) {
            context.put(MANUAL_OVERRIDE_KEY, true);
        }
        return next.apply(input);
    }

    /**
     * 在每次模型调用前，根据 RuntimeContext 生成本轮专属 Tool Schema。
     *
     * @param agent 当前执行 Model Call 的 Agent；从中只读完整 Toolkit
     * @param context 当前 AgentRun 独享的运行上下文
     * @param input 上游 Middleware 传入的模型调用参数
     * @param next Middleware 链的下一个处理函数
     * @return 下游 AgentEvent 响应流
     */
    @Override
    public Flux<AgentEvent> onModelCall(
            Agent agent,
            RuntimeContext context,
            ModelCallInput input,
            Function<ModelCallInput, Flux<AgentEvent>> next
    ) {
        // decision：AgentService 为当前用户轮次写入 RuntimeContext 的路由决策。
        ToolRoutingDecision decision = context == null
                ? null
                : context.get(ToolRoutingDecision.class);

        if (decision == null || !decision.appliesToModelCall()
                || agent == null || agent.getToolkit() == null) {
            return next.apply(input);
        }

        // 调用过元工具后，AgentScope 的会话级能力组成为权威来源。
        if (Boolean.TRUE.equals(context.get(MANUAL_OVERRIDE_KEY))) {
            return next.apply(input);
        }

        // selectedByName：按 Tool 名称去重，并保持“常驻工具在前、路由工具在后”的顺序。
        Map<String, ToolSchema> selectedByName = new LinkedHashMap<>();

        // 只保留元工具和未被能力目录分类的工具。
        // 即使共享 Toolkit 曾被其他会话激活过，也不会把其能力组带进本轮。
        if (input.tools() != null) {
            input.tools().stream()
                    .filter(this::isAlwaysVisible)
                    // schema：当前被保留的元工具或未分类 Tool Schema。
                    .forEach(schema -> selectedByName.put(schema.getName(), schema));
        }

        // 直接读取指定组的 Schema，不调用 updateToolGroups，不修改共享状态。
        // routedSchemas：从完整 Toolkit 只读取得的本轮已选能力组 Schema。
        List<ToolSchema> routedSchemas = agent.getToolkit()
                .getToolSchemas(decision.selectedGroups());
        // schema：当前加入最终结果并按名称去重的路由 Tool Schema。
        routedSchemas.forEach(schema -> selectedByName.put(schema.getName(), schema));

        // routedInput：复制原模型调用参数，只替换最终发送给模型的 tools 列表。
        ModelCallInput routedInput = new ModelCallInput(
                input.messages(),
                List.copyOf(selectedByName.values()),
                input.options(),
                input.model()
        );
        return next.apply(routedInput);
    }

    /**
     * 判断 Tool Schema 是否应无条件保留在模型上下文中。
     *
     * @param schema 当前待判断的 Tool Schema
     * @return 元工具或目录无法分类的兼容工具返回 true
     */
    private boolean isAlwaysVisible(ToolSchema schema) {
        if (schema == null || schema.getName() == null) return false;
        return ToolCapabilityCatalog.META_TOOL_NAME.equals(schema.getName())
                || capabilityCatalog.groupFor(schema.getName()).isEmpty();
    }
}
```

这段代码有两个容易忽略的设计点：

1. 不是只对 `input.tools()` 做过滤，因为未激活组原本不在 `input.tools()` 中，仅过滤无法加入 Jev 选中的组。
2. 不是直接把选中组追加到 `input.tools()`，因为共享 Toolkit 可能已被其他会话改变；应先取“常驻基线”，再加入本轮选中组。
3. 一旦主模型调用 `reset_equipped_tools`，Middleware 必须停止覆盖后续 Model Call，让 AgentScope 的会话级工具状态真正承担误路由补救。
4. `ACTIVE` 决策还必须提前同步到会话 `AgentState`；Middleware 只处理 Schema，不能单独保证工具可执行。

### 12.1 Middleware 顺序

在 `AgentFactory` 中注入 `ToolSchemaSelectionMiddleware`，然后把顺序改为：

```java
// contextInjectionMiddleware：先向消息列表临时注入有界个人上下文。
.middleware(contextInjectionMiddleware)

// toolSchemaSelectionMiddleware：再为当前 Model Call 组装最终 Tool Schema。
.middleware(toolSchemaSelectionMiddleware)

// tokenUsageMiddleware：最后按照最终消息和 Schema 做 Token 归因估算。
.middleware(tokenUsageMiddleware)
```

目的不是视觉上的排列，而是确保 Token Schema 归因看到的是最终实际发送给模型的工具集合。写完后应通过测试确认 AgentScope 的 Middleware 调用顺序符合这一预期；如果框架实际采用反向包裹顺序，就交换后两个 Middleware，以“TokenUsageMiddleware 接收到路由后的 tools”为验收标准。

### 12.2 Middleware 测试

至少覆盖：

- `ACTIVE + workspace`：保留元工具和未分类工具，只加入 workspace；
- 同时选择两个组时两组都存在；
- 未选择的能力组即使出现在原始 `input.tools()`，也会被移除；
- `SHADOW`、`OFF`、`FALLBACK` 完全透传原输入；
- Context 中没有决策时保持旧行为；
- 两个不同 RuntimeContext 并发调用，最终 Schema 互不污染；
- 输出列表按工具名去重。
- ACTIVE 决策写入当前会话的 `activatedGroups`，SHADOW/FALLBACK 不改变会话状态；
- 权限暂停与恢复后，Jev 选中的工具不会出现 `not available`。

并发测试非常重要，它是本方案避免共享 Agent 串扰的直接证据。

---

## 13. 第 8 步：先 Shadow，再 Active

### 13.1 Shadow 阶段

先配置：

```json
{
  "typesafe": {
    "enabled": true,
    "mode": "shadow",
    "apiKey": "...",
    "model": "jev-latest",
    "threshold": 0.75
  }
}
```

Shadow 模式会调用 Jev、记录组概率和耗时，但 Middleware 不改变 Schema。建议准备至少 50～100 条覆盖真实使用场景的测试请求，人工标注期望能力组，例如：

| 用户请求 | 期望组 |
| --- | --- |
| “帮我搜索项目中所有硬编码端口” | `workspace` |
| “查一下今天 OpenAI 的最新公告” | `web` |
| “查资料并把结论写到 docs” | `web + workspace` |
| “记住我喜欢简短回答” | `memory` |
| “明天下午三点提醒我开会” | `calendar` |
| “解释什么是依赖倒置” | 空集合 |

不要凭感觉确定阈值。根据样本计算：

- 每个组的召回率：应该启用时是否启用；
- 每个组的精确率：启用后是否真的需要；
- 空集合比例；
- P50、P95 路由延迟；
- 失败和超时比例。

工具路由通常更怕漏选，因此第一版可以优先保证召回率，再逐渐减少多余 Schema。

### 13.2 Active 阶段

Shadow 数据达到目标后改为：

```json
"mode": "active"
```

建议先只在开发环境运行，再观察：

- 主模型首 token 延迟是否明显增加；
- 工具调用成功率是否下降；
- 主模型调用 `reset_equipped_tools` 补救的频率；
- Jev 失败时聊天是否仍正常；
- 并发会话是否出现工具串扰。

紧急回滚只需将 mode 改为 `off`，不必删除代码或改数据库。

---

## 14. 错误处理策略

| 情况 | 路由结果 | 主聊天行为 |
| --- | --- | --- |
| 未配置、disabled、off | `OFF` | 完全保持原流程 |
| Jev 超时或网络错误 | `FALLBACK` | 完全保持原流程 |
| 401 | `FALLBACK` | 正常聊天；日志提示配置错误但不打印 Key |
| 422 | `FALLBACK` | 正常聊天；检查 DTO 或 question 定义 |
| 429 / 529 | `FALLBACK` | 正常聊天；MVP 不在首 token 前重试 |
| 响应缺组、类型错误、概率越界 | `FALLBACK` | 正常聊天；记录安全告警 |
| 没有组超过阈值 | `ACTIVE + 空集合` | 只提供常驻/未分类 Schema |
| 用户取消 | 停止后续调用 | 按现有 `runId` 取消流程收尾 |

所谓 fail-open，是 Jev 故障时退回项目原有工具路由行为，而不是给用户返回“Agent 失败”。

---

## 15. 隐私、安全与费用边界

接入前应明确以下约束：

1. 只有 `typesafe.enabled=true` 且配置有效时，才允许向外发送请求。
2. 默认只发送当前用户可见文本，不发送 System Prompt、历史会话、Profile、Memory、RAG 和 Tool Result。
3. 不记录 API Key、Authorization Header、完整用户输入和完整外部错误 body。
4. 不把 TypeSafe usage 混入主聊天模型的供应商 Usage。它们是不同请求、不同计费来源。
5. 若后续需要统计 Jev token，用独立的 routing usage 记录或扩展 system usage 格式，并增加版本字段。
6. `reset_equipped_tools` 继续保留，为错误路由提供主模型侧补救路径。
7. Jev 输出是概率判断，不是权限决定；Tool 执行仍必须经过现有权限和 HITL 审批体系。

---

## 16. 推荐的提交顺序

你可以按以下小步提交，每一步都保持可测试、可回滚：

1. `refactor: 提取工具能力组目录`
2. `feat: 增加 TypeSafe Jev 本地配置`
3. `feat: 增加 System One HTTP 适配器`
4. `feat: 增加 Jev 工具能力路由器`
5. `feat: 按运行上下文选择工具 Schema`
6. `test: 补充 Jev 路由与并发隔离测试`
7. `docs: 记录 Jev 灰度与回滚流程`

每次提交前先执行当前步骤最贴近的测试，最后执行：

```bash
cd agent-backend
mvn -pl server-agents -am test
```

如果修改影响 `server-network` 启动装配，再补充整个后端构建：

```bash
cd agent-backend
mvn clean verify
```

---

## 17. 常见错误

### 错误一：让 Jev 保存项目 Tool

Jev 只回答结构化问题。Tool 的注册、Schema、权限、执行器和生命周期仍应全部留在 ButvanAgent。

### 错误二：每个请求调用 `updateToolGroups`

当前 Agent 按项目根缓存，共享 Toolkit。修改 group active 状态可能造成并发会话串扰。

### 错误三：把 Noul 值称为 confidence

Noul 返回 yes probability；只有 Choice 和 Score 响应包含独立 confidence 字段。

### 错误四：用一个 Choice 做全部路由

Choice 是单选，而真实请求经常需要 `web + workspace` 等多组能力。使用每组一个 Noul 才是多标签判断。

### 错误五：失败时返回空工具集

网络错误、429、529 或格式错误应进入 `FALLBACK` 并保持原流程，而不是误当作“所有组概率都低”。

### 错误六：直接发送完整上下文

工具路由只需本轮意图。发送历史、Memory 和 RAG 会扩大隐私范围、成本和延迟。

### 错误七：一开始就启用 Active

先用 Shadow 收集真实请求上的准确率和延迟，再根据数据选阈值。

### 错误八：只暴露 Schema，不同步会话工具状态

`getToolSchemas(selectedGroups)` 只解决模型可见性，不会自动激活 ToolExecutor 使用的工具组。
ACTIVE 模式必须把相同的组写入当前会话 `AgentState.toolContext.activatedGroups`。

### 错误九：把所有 Tool Result 都显示成成功

AgentScope 会用 `ToolResultEndEvent` 给出 `SUCCESS`、`ERROR`、`DENIED` 或 `INTERRUPTED`。
后端 SSE 应透传终态，前端只有在真实 `SUCCESS` 时才显示绿色完成。

---

## 18. Definition of Done

完成以下项目后，第一版才算真正接入完成：

- [ ] 能力组定义只有 `ToolCapabilityCatalog` 一份；
- [ ] Jev 只接收当前用户可见输入和能力组说明；
- [ ] API Key 只存在本地用户配置中；
- [ ] `off` 模式不产生任何 Jev 网络请求；
- [ ] `shadow` 模式不改变主模型看到的 Schema；
- [ ] `active` 模式只暴露选中组、元工具和未分类工具；
- [ ] `active` 模式下模型可见组与当前会话可执行组完全一致；
- [ ] 路由过程不修改共享 Toolkit 的 active groups；
- [ ] Jev 超时、限流、过载和格式错误均 fail-open；
- [ ] HITL 权限审批仍由现有机制处理；
- [ ] 权限恢复后不会因能力组未激活而重复调用同一工具；
- [ ] Tool Result 错误或拒绝状态不会在前端显示为成功；
- [ ] 两个并发 RuntimeContext 的工具组互不污染；
- [ ] 主模型的 Tool Schema token 归因基于最终 Schema；
- [ ] Shadow 样本达到团队设定的准确率和延迟目标；
- [ ] `mvn -pl server-agents -am test` 全部通过；
- [ ] 关闭配置即可完成回滚。

---

## 19. 官方资料

- [TypeSafe Quick start](https://docs.typesafe.ai/introduction/quickstart)：System One Endpoint、Bearer 认证、`jev-latest` 及基础请求/响应示例。
- [TypeSafe API reference](https://docs.typesafe.ai/api)：`state`、questions、Noul/Choice/Score、usage 和错误码定义。
- [TypeSafe Client SDKs](https://docs.typesafe.ai/sdk)：官方 SDK 范围，以及其他语言可直接调用 HTTP API的说明。
- [TypeSafe System One](https://docs.typesafe.ai/concepts/system-one)：System One 的定位和输入输出边界。
- [TypeSafe Confidence](https://docs.typesafe.ai/confidence)：Choice/Score confidence 的解释。

---

## 20. 一句话复盘

这次接入不是把 Tool 交给 Jev 管理，而是让 Jev 在主模型调用前选择能力组，再由 ButvanAgent 同步当前会话的工具状态，并通过 Middleware 安全地组装本轮 Tool Schema。
