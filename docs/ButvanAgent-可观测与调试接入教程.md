# ButvanAgent 可观测与调试：Studio 与 OpenTelemetry 接入教程

> 目标：为 ButvanAgent 接入 AgentScope Java 的两类可观测能力：
>
> 1. **Studio 可视化调试**：通过 Web UI 实时查看 Agent 的推理、工具调用与消息流，并支持 Human-in-the-Loop 输入；
> 2. **OpenTelemetry 链路追踪**：把 `invoke_agent`、`chat`、`execute_tool` 等 Span 通过 OTLP 协议导出到 Langfuse / Jaeger 等平台。
>
> 本教程基于项目锁定的 **AgentScope Java 2.0.0** 编写，只改后端，不涉及前端。
> 请按顺序手动完成，每一步编译通过后再进入下一步。

---

## 1. 先看版本差异：你手上的文档是 v1 写法

外部流传的《可观测与调试》文档对应 AgentScope Java **v1** API。项目当前在
`agent-backend/pom.xml` 中锁定 `agentscope.version=2.0.0`，两代 API 差异很大，
直接照抄 v1 代码**无法编译**。差异对照如下：

| 能力 | v1 文档写法 | 本项目 2.0.0 实际写法 |
| --- | --- | --- |
| Studio 客户端 | 认为随 `agentscope-core` 提供 | 在独立构件 `io.agentscope:agentscope-extensions-studio` 中，需要显式加依赖 |
| Studio 初始化 | `StudioManager.init().studioUrl(...).project(...).runName(...).initialize()` | API 基本不变，但类位于扩展构件内 |
| 全局追踪 | `TracerRegistry.register(TelemetryTracer.builder()...)` | `TelemetryTracer` 仍在（位于扩展构件内），但 `TracerRegistry` 已在 2.0.0 标记 `@Deprecated(forRemoval)` |
| v2 原生追踪 | 无 | `OtelTracingMiddleware` + 自建 OpenTelemetry SDK，走 `GlobalOpenTelemetry` |
| Harness 日志追踪 | 无 | `HarnessAgent` 内置 `AgentTraceMiddleware`（默认开启，INFO/DEBUG 日志） |

**结论**：本教程全部以 2.0.0 的实测 API 为准；v1 文档只作为背景理解。

---

## 2. 先理解完整链路

当前 `AgentService.createHarnessAgent()` 构建 Agent 时只挂了 toolkit、权限、工作区、
状态存储和压缩配置。可观测接入后变成：

```text
桌面端 SSE 请求
  │
  ▼
AgentService.streamAgent → currentAgent() → createHarnessAgent()
  │                                        ├── .middleware(new OtelTracingMiddleware())
  │                                        │        // 生成 invoke_agent / chat / execute_tool Span
  │                                        └── .hook(new StudioMessageHook(StudioManager.getClient()))
  │                                                 // PostCall 后把最终消息镜像到 Studio
  ▼
AgentScope 执行（推理 / 模型调用 / 工具执行）
  ├── Trace → GlobalOpenTelemetry（或 TracerRegistry）→ OTLP → Langfuse / Jaeger / Studio
  └── 消息 → StudioClient → Studio Server → Web UI
```

两条路径互不影响：

- **Studio**：`StudioManager.init()` 成功后会自动做两件事——注册一个全局 system hook
  （`StudioMessageHook`），并往 `TracerRegistry` 注册一个指向 Studio 的
  `TelemetryTracer`。因此只要初始化一次，之后创建的所有 Agent 都会自动镜像消息。
- **OpenTelemetry**：2.0.0 推荐把 `OtelTracingMiddleware` 挂到 Agent 上；它读取
  `GlobalOpenTelemetry`，未配置 SDK 时是 no-op，配置了则自动产生 Span。

---

## 3. 本次会修改哪些文件

```text
agent-backend/pom.xml                       # dependencyManagement 增加 agentscope-extensions-studio
agent-backend/server-agents/pom.xml         # 引入 studio 扩展；独立追踪时还需 opentelemetry-exporter-otlp
agent-backend/server-agents/src/main/java/butvan/agent/agents/
├── config/LocalConfigService.java          # 新增 observability 配置节点读写
├── observability/ObservabilityLifecycle.java  # 新增：启动初始化 Studio/OTel，关闭时清理
└── agent/AgentService.java                 # createHarnessAgent 挂 middleware / hook

~/.butvan-agent/config.json                 # 用户本地配置（不提交，密钥只放这里）
```

不需要新增 Controller，也不修改任何前端文件；`AgentService` 的 SSE 协议完全不变。

---

## 4. 第一步：添加依赖

### 4.1 父 POM 的 dependencyManagement

打开 `agent-backend/pom.xml`，在现有 `agentscope-extensions-model-*` 条目旁追加：

```xml
<dependency>
    <groupId>io.agentscope</groupId>
    <artifactId>agentscope-extensions-studio</artifactId>
    <version>${agentscope.version}</version>
</dependency>
```

### 4.2 server-agents 引入依赖

打开 `agent-backend/server-agents/pom.xml`，追加：

```xml
<!-- Studio 可视化调试（同时传递引入 OkHttp、socket.io-client、opentelemetry-exporter-otlp） -->
<dependency>
    <groupId>io.agentscope</groupId>
    <artifactId>agentscope-extensions-studio</artifactId>
</dependency>

<!-- 仅做 Langfuse/Jaeger 独立追踪且不开 Studio 时，也必须显式声明 OTLP 导出器；
     版本与 agentscope-core 2.0.0 依赖的 opentelemetry-api 1.61.0 对齐 -->
<dependency>
    <groupId>io.opentelemetry</groupId>
    <artifactId>opentelemetry-exporter-otlp</artifactId>
    <version>1.61.0</version>
</dependency>
```

### 4.3 验证依赖

```bash
cd /Users/butvan/Butvan_Projets/my_code/ButvanAgent/agent-backend
mvn -pl server-agents dependency:tree -Dincludes=io.agentscope:agentscope-extensions-studio
```

能看到 `agentscope-extensions-studio:2.0.0` 即成功。若此时编译失败，先修复基线问题，
不要继续。

---

## 5. 第二步：本地配置 `~/.butvan-agent/config.json`

按项目规范，用户配置统一放在 `~/.butvan-agent/config.json`，**不得**写入
`application.yml` / `application-vendor.yml` / 源码。在配置文件顶层新增
`observability` 节点：

```json
{
  "model": { "...": "现有模型配置，保持不变" },
  "observability": {
    "studio": {
      "enabled": false,
      "url": "http://localhost:8000",
      "tracingUrl": "",
      "project": "ButvanAgent",
      "runName": "desktop-local"
    },
    "tracing": {
      "enabled": false,
      "endpoint": "https://cloud.langfuse.com/api/public/otel/v1/traces",
      "headers": {
        "Authorization": "Basic <pk-lf-xxx:sk-lf-xxx 的 Base64>",
        "x-langfuse-ingestion-version": "4"
      }
    }
  }
}
```

字段说明：

| 字段 | 含义 |
| --- | --- |
| `studio.enabled` | 是否连接 Studio Server（生产默认 `false`） |
| `studio.url` | Studio Server 地址；`as_studio` 启动后以实际监听端口为准（官方示例 8000，扩展代码默认 3000，必须显式配置） |
| `studio.tracingUrl` | 显式指定 trace 推送地址（如 `http://localhost:8000/v1/traces`）；留空时 Studio 自己拼，见第 11 节风险 |
| `studio.project` / `studio.runName` | Studio 中的项目名与运行名；桌面应用建议 runName 用应用实例标识，不要每次对话重建 |
| `tracing.enabled` | 是否导出到独立 OTLP 平台 |
| `tracing.endpoint` | OTLP HTTP(S) 端点（Langfuse Cloud / Jaeger HTTP 端口） |
| `tracing.headers` | OTLP 请求头，如 Langfuse 的 `Authorization` 与 `x-langfuse-ingestion-version` |

### 5.1 在 LocalConfigService 中增加配置类型

`LocalConfigService.ModelConfigData` 通过 `@JsonAnySetter` 保留未知顶层节点
（`extraFields`），模型配置保存时不会丢掉 `observability`。新增一个内部类型和读取方法：

```java
@Data
public static class ObservabilityConfigData {
    private StudioConfigData studio = new StudioConfigData();
    private TracingConfigData tracing = new TracingConfigData();

    @Data
    public static class StudioConfigData {
        private boolean enabled = false;
        private String url = "http://localhost:8000";
        private String tracingUrl = "";
        private String project = "ButvanAgent";
        private String runName = "desktop-local";
    }

    @Data
    public static class TracingConfigData {
        private boolean enabled = false;
        private String endpoint = "";
        private Map<String, String> headers = new LinkedHashMap<>();
    }
}

/** 读取 observability 顶层节点；不存在时返回默认值（全部关闭）。 */
public ObservabilityConfigData loadObservabilityConfig() {
    Object raw = loadFullConfigData().getExtraFields().get("observability");
    if (raw == null) {
        return new ObservabilityConfigData();
    }
    return objectMapper.convertValue(raw, ObservabilityConfigData.class);
}
```

### 5.2 密钥安全

- Langfuse 的 `pk-lf-*` / `sk-lf-*` 只出现在 `~/.butvan-agent/config.json` 或环境变量；
- `Authorization` 的 Base64 在运行时由应用计算，日志中禁止输出 header 值；
- 不提交任何含密钥的配置样例。

---

## 6. 第三步：新增 ObservabilityLifecycle

新建 `agent-backend/server-agents/src/main/java/butvan/agent/agents/observability/ObservabilityLifecycle.java`，
统一负责“启动初始化 + 退出清理”，避免把初始化代码散落到 `AgentService`：

```java
package butvan.agent.agents.observability;

import butvan.agent.agents.config.LocalConfigService;
import io.agentscope.core.studio.StudioManager;
import io.agentscope.core.tracing.OtelTracingMiddleware;
import io.opentelemetry.exporter.otlp.http.trace.OtlpHttpSpanExporter;
import io.opentelemetry.sdk.OpenTelemetrySdk;
import io.opentelemetry.sdk.trace.SdkTracerProvider;
import io.opentelemetry.sdk.trace.export.BatchSpanProcessor;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * 可观测能力生命周期：启动时按本地配置初始化 Studio 与 OpenTelemetry，
 * 关闭时释放连接与 tracer provider。Studio 或追踪不可用不应阻断应用启动。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ObservabilityLifecycle {

    private final LocalConfigService localConfigService;

    private SdkTracerProvider sdkTracerProvider;

    @PostConstruct
    public void init() {
        LocalConfigService.ObservabilityConfigData config =
                localConfigService.loadObservabilityConfig();

        if (config.getStudio().isEnabled()) {
            initStudio(config.getStudio());
        }
        if (config.getTracing().isEnabled()) {
            initTracing(config.getTracing());
        }
    }

    private void initStudio(LocalConfigService.ObservabilityConfigData.StudioConfigData studio) {
        try {
            StudioManager.init()
                    .studioUrl(studio.getUrl())
                    // 显式指定 tracingUrl，规避 Studio 默认拼接缺陷（见第 11 节）
                    .tracingUrl(studio.getTracingUrl().isBlank()
                            ? studio.getUrl() + "/v1/traces"
                            : studio.getTracingUrl())
                    .project(studio.getProject())
                    .runName(studio.getRunName())
                    .initialize()
                    .block();
            log.info("AgentScope Studio 已连接：url={}, project={}, runName={}",
                    studio.getUrl(), studio.getProject(), studio.getRunName());
        } catch (Exception e) {
            // Studio 不可用时降级运行，不影响聊天主链路
            log.warn("AgentScope Studio 初始化失败，本次运行不推送 Studio：{}", e.getMessage());
        }
    }

    private void initTracing(LocalConfigService.ObservabilityConfigData.TracingConfigData tracing) {
        try {
            OtlpHttpSpanExporter.Builder exporter = OtlpHttpSpanExporter.builder()
                    .setEndpoint(tracing.getEndpoint());
            for (Map.Entry<String, String> header : tracing.getHeaders().entrySet()) {
                exporter.addHeader(header.getKey(), header.getValue());
            }

            sdkTracerProvider = SdkTracerProvider.builder()
                    .addSpanProcessor(BatchSpanProcessor.builder(exporter.build()).build())
                    .build();

            OpenTelemetrySdk.builder()
                    .setTracerProvider(sdkTracerProvider)
                    .buildAndRegisterGlobal();

            log.info("OpenTelemetry 已注册：endpoint={}", tracing.getEndpoint());
        } catch (Exception e) {
            log.warn("OpenTelemetry 初始化失败，本次运行不导出 Trace：{}", e.getMessage());
        }
    }

    @PreDestroy
    public void shutdown() {
        if (StudioManager.isInitialized()) {
            StudioManager.shutdown();
        }
        if (sdkTracerProvider != null) {
            sdkTracerProvider.close();
        }
    }
}
```

> **说明**：`StudioManager.initialize()` 成功后会自动把 `StudioMessageHook` 注册为全局
> system hook，并注册一个指向 Studio `tracingUrl` 的 `TelemetryTracer`。因此
> 第 7 步里 Agent 侧甚至可以不加 hook；显式添加只是为了可读性和“选择性镜像”。

### 6.1 方案选择表

| 场景 | 配置 | 结果 |
| --- | --- | --- |
| 开发调试 | `studio.enabled=true`，`tracing.enabled=false` | 消息镜像到 Studio，Trace 也推给 Studio 自己 |
| 生产可观测（推荐） | `studio.enabled=false`，`tracing.enabled=true` | `OtelTracingMiddleware` 把 Trace 导出到 Langfuse/Jaeger，不依赖 Studio |
| Studio + Langfuse 同时 | `studio.enabled=true`，`tracing.enabled=true` | Studio 管消息可视化，Langfuse 管 Trace；注意不要同时启用 `TracerRegistry` 与 `OtelTracingMiddleware`（见第 11 节） |

---

## 7. 第四步：在 AgentService 挂载 middleware / hook

修改 `AgentService.createHarnessAgent()`，在 builder 链上追加：

```java
private HarnessAgent createHarnessAgent(Model model) {
    String modelName = model.getModelName() == null ? "unknown-model" : model.getModelName();
    String systemPrompt = PromptBuilder.buildDefaultSystemPrompt(
            modelName,
            System.getProperty("user.dir")
    );

    return HarnessAgent.builder()
            .name("butvan_agent")
            .sysPrompt(systemPrompt)
            .model(model)
            .toolkit(toolRegistry.getToolkit())
            .permissionContext(agentSecurity.createPermissionContext(permissionChecker))
            .workspace(storageProperties.getWorkspaceDirectory())
            .stateStore(agentStateStore)
            .compaction(CompactionConfig.builder()
                    .triggerMessages(30)
                    .keepMessages(10)
                    .build())
            // ===== 可观测接入点 =====
            // OpenTelemetry：未配置 SDK 时是 no-op，可无条件挂载
            .middleware(new OtelTracingMiddleware())
            // Studio：仅在 Studio 已初始化时挂载（或依赖全局 system hook，可省略）
            .hook(StudioManager.isInitialized()
                    ? new StudioMessageHook(StudioManager.getClient())
                    : null)
            .build();
}
```

`HarnessAgent.Builder.hook(...)` 内部对 `null` 做了安全跳过，所以上面的条件写法
可以直接编译。由于 `ObservabilityLifecycle` 初始化时会注册全局 system hook，
**不写这一行也能工作**；写上可以让“哪些 Agent 镜像到 Studio”一目了然。

`HarnessAgent` 还内置了 `AgentTraceMiddleware`（`enableAgentTracingLog` 默认 `true`），
会在 SLF4J 输出 Agent 名称、模型、工具名和消息长度摘要；把日志级别调到 DEBUG 可看到
工具参数和推理文本：

```yaml
# application.yml（仅日志级别，不含任何密钥）
logging:
  level:
    io.agentscope: INFO
```

---

## 8. 第五步：接入 Langfuse

两种方案任选其一，不要同时启用。

### 8.1 方案 A（推荐，v2 原生）：OtelTracingMiddleware + OTLP HTTP 导出器

这是 2.0.0 推荐的路径，不依赖 Studio 扩展：

```java
import io.opentelemetry.exporter.otlp.http.trace.OtlpHttpSpanExporter;
import io.opentelemetry.sdk.OpenTelemetrySdk;
import io.opentelemetry.sdk.trace.SdkTracerProvider;
import io.opentelemetry.sdk.trace.export.BatchSpanProcessor;

String publicKey = "pk-lf-xxxxxxxx";
String secretKey = "sk-lf-xxxxxxxx";
String encoded = Base64.getEncoder()
        .encodeToString((publicKey + ":" + secretKey).getBytes(StandardCharsets.UTF_8));

OtlpHttpSpanExporter exporter = OtlpHttpSpanExporter.builder()
        .setEndpoint("https://cloud.langfuse.com/api/public/otel/v1/traces")
        .addHeader("Authorization", "Basic " + encoded)
        .addHeader("x-langfuse-ingestion-version", "4")
        .build();

SdkTracerProvider tracerProvider = SdkTracerProvider.builder()
        .addSpanProcessor(BatchSpanProcessor.builder(exporter).build())
        .build();

OpenTelemetrySdk.builder()
        .setTracerProvider(tracerProvider)
        .buildAndRegisterGlobal();
```

之后 `OtelTracingMiddleware` 通过 `GlobalOpenTelemetry` 自动产出：

| Span 名 | 覆盖内容 |
| --- | --- |
| `invoke_agent <name>` | 每次 Agent 调用 |
| `chat <model>` | 每次模型 API 调用（含消息数、工具数等 GenAI 属性） |
| `execute_tool <name>` | 每次工具执行 |

> **注意**：Langfuse 的 OTLP 端点必须带 `x-langfuse-ingestion-version: 4` 请求头，
> 否则平台拒绝接收。

### 8.2 方案 B：Studio 扩展自带的 TelemetryTracer

`TelemetryTracer` 位于 `agentscope-extensions-studio` 构件内，API 与 v1 文档一致：

```java
import io.agentscope.core.tracing.TracerRegistry;
import io.agentscope.core.tracing.telemetry.TelemetryTracer;

TracerRegistry.register(
        TelemetryTracer.builder()
                .endpoint("https://cloud.langfuse.com/api/public/otel/v1/traces")
                .addHeader("Authorization", "Basic " + encoded)
                .addHeader("x-langfuse-ingestion-version", "4")
                .build()
);
```

它覆盖 `invoke_agent`、`chat`、`execute_tool` 和 `format` 四类 Span。
注意 `TracerRegistry` 已在 2.0.0 标记 `@Deprecated(forRemoval=true)`：当前可用，
但升级到未来版本时需迁移到方案 A。

---

## 9. 第六步：接入本地 Jaeger

启动 Jaeger（OTLP 收集器需开启）：

```bash
docker run -d --name jaeger \
  -e COLLECTOR_OTLP_ENABLED=true \
  -p 16686:16686 -p 4317:4317 -p 4318:4318 \
  jaegertracing/all-in-one:latest
```

Web UI：http://localhost:16686

方案 A 把 `endpoint` 指到 HTTP 端口：

```java
OtlpHttpSpanExporter.builder()
        .setEndpoint("http://localhost:4318/v1/traces")
        .build();
```

方案 B 同样：

```java
TracerRegistry.register(
        TelemetryTracer.builder()
                .endpoint("http://localhost:4318/v1/traces")
                .build()
);
```

> **注意**：`TelemetryTracer` 内部只使用 `OtlpHttpSpanExporter`，所以必须用
> HTTP 端口 4318（`/v1/traces`），不能用 gRPC 端口 4317。方案 A 若想用 gRPC，
> 可换成 `OtlpGrpcSpanExporter` 并指向 `http://localhost:4317`。

---

## 10. 第七步：验证

### 10.1 编译与基线

```bash
cd /Users/butvan/Butvan_Projets/my_code/ButvanAgent/agent-backend
JAVA_HOME=$(/usr/libexec/java_home -v 21) mvn -pl server-agents -am compile
```

### 10.2 Studio

```bash
npm install -g @agentscope/studio
as_studio
```

在 `~/.butvan-agent/config.json` 打开 `observability.studio.enabled=true`，重启后端，
发起一次对话，然后在 Studio Web UI 的 Projects 中找到 `ButvanAgent` 与对应 run，
确认消息流、推理和工具调用可见。

### 10.3 Langfuse / Jaeger

打开 `observability.tracing.enabled=true` 并配置端点后，发起一次对话：

- Langfuse：控制台 Traces 页应出现 `invoke_agent butvan_agent` 及子 Span；
- Jaeger：http://localhost:16686 搜索服务 `io.agentscope`（或按 `invoke_agent` 操作名过滤）。

### 10.4 本地日志

不配置任何外部平台时，`AgentTraceMiddleware` 仍会在 INFO 级别输出执行摘要；
把 `logging.level.io.agentscope` 调到 DEBUG 可看到工具参数与推理文本。

---

## 11. 遗留风险与需要决策的事项

1. **`TracerRegistry` 弃用**：2.0.0 标记 `@Deprecated(forRemoval=true)`，Studio 扩展
   内部仍依赖它。长期方案是 `OtelTracingMiddleware`；升级 AgentScope 前需先迁移。
2. **Studio 默认 tracingUrl 拼接缺陷**：`StudioManager` 默认用
   `URI.create(studioUrl).getPath() + "/v1/traces"` 拼地址，对 `http://localhost:8000`
   会得到相对路径 `/v1/traces`。本教程已在 `ObservabilityLifecycle` 中显式
   `tracingUrl` 规避，**不要依赖默认值**。
3. **双追踪勿叠加**：`TracerRegistry`（Studio 自动注册）与 `OtelTracingMiddleware`
   （`GlobalOpenTelemetry`）同时启用会产生双份 hook。若 Studio 与 Langfuse 双开，
   建议 Studio 只做消息可视化，Trace 全部走 `OtelTracingMiddleware`；或在
   `StudioManager.init()` 之后用带 Langfuse headers 的 `TelemetryTracer` 重新
   `TracerRegistry.register(...)` 覆盖默认 tracer。
4. **版本升级决策**：中央仓库已有 `2.0.2`（bugfix）。是否把 `agentscope.version`
   升到 2.0.2 由项目评审决定；本教程代码在两个版本上均适用。
5. **配置入口**：当前 `observability` 只进 `~/.butvan-agent/config.json`，桌面端没有
   设置 UI。是否暴露前端开关属于产品决策，本教程未实现。
6. **失败降级**：Studio 连不上时应用照常运行（初始化异常被捕获）；生产默认关闭
   `studio.enabled`，避免每次调用都向 Studio 写一份数据。
