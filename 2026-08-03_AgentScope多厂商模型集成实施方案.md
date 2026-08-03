# AgentScope-Java 2.0 多厂商大模型集成架构与手动实施指南

> **文档日期**: 2026-08-03  
> **目标模块**: `agent-backend` (`server-agents` 模块)  
> **框架规范**: AgentScope-Java 2.0 + Spring Boot 3.4  
> **参考开源项目**: `mewcode-java` (`com.mewcode.llm` / `com.mewcode.config`)

---

## 一、 方案设计背景与参考架构分析

本项目 (`ButvanAgent`) 后端基于 **AgentScope-Java 2.0** 构建。在参考项目 `mewcode-java` 中，其多厂商 LLM 集成模块具备极强的工业级完备性与可扩展性。本方案深度吸收 `mewcode-java` 的核心设计理念，将其迁移并升级至 AgentScope-Java 与 Spring Boot 3.4 架构下。

### 1.1 `mewcode-java` 核心设计要素借鉴

- **统一配置驱动 (`ProviderConfig`)**：将厂商协议 (`protocol`)、模型标识 (`model`)、BaseURL、API Key、思考模式 (`thinking`) 和上下文窗口集中配置化管理。
- **多级 API Key 隐蔽解析 (`resolvedApiKey`)**：当 API Key 未显式配置时，系统根据 `protocol` 自动隐蔽读取环境变量（如 `DASHSCOPE_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `DEEPSEEK_API_KEY`）。
- **上下文窗口 4 层兜底算法 (`resolvedContextWindow`)**：采用 4 层优先顺序计算有效 Context Window：显式 YAML 配置 > 动态端点拉取缓存 > 内置模型 ID 名称契约矩阵 > 默认 128k 保守兜底值。
- **模型能力与别名解析器 (`ModelResolver`)**：负责模型简写别名（如 `sonnet`, `qwen`, `deepseek`）到全量模型 ID 的映射，并检测模型是否支持 Reasoning/Thinking 特性。

### 1.2 AgentScope-Java 2.0 模型组件体系

AgentScope-Java 2.0 采用了高度模块化的 Model 抽象架构：
- **DashScope 厂商扩展**：扩展依赖包 `io.agentscope:agentscope-extensions-model-dashscope`，内置 `DashScopeChatModel`。
- **OpenAI / OpenAI-Compat 厂商扩展**：扩展依赖包 `io.agentscope:agentscope-extensions-model-openai`，内置 `OpenAIChatModel`，天然兼容 DeepSeek, Ollama, vLLM, SiliconFlow 等标准 OpenAI 兼容端点。
- **Anthropic 厂商扩展**：扩展依赖包 `io.agentscope:agentscope-extensions-model-anthropic`，内置 `AnthropicChatModel`。

---

## 二、 详细实施步骤指南 (Step-by-Step)

请按照以下步骤依次在 `agent-backend` 工程中新建与修改代码文件。

---

### 步骤一：修改 POM 依赖文件

#### 1. 修改父工程 `agent-backend/pom.xml`

在 `<dependencyManagement>` 中补充 AgentScope 模型扩展依赖：

```xml
<!-- agent-backend/pom.xml -->
<dependencyManagement>
    <dependencies>
        <dependency>
            <groupId>io.agentscope</groupId>
            <artifactId>agentscope-harness</artifactId>
            <version>${agentscope.version}</version>
        </dependency>

        <dependency>
            <groupId>io.agentscope</groupId>
            <artifactId>agentscope-extensions-model-dashscope</artifactId>
            <version>${agentscope.version}</version>
        </dependency>

        <!-- 补充 OpenAI 及通用兼容端点扩展模块 -->
        <dependency>
            <groupId>io.agentscope</groupId>
            <artifactId>agentscope-extensions-model-openai</artifactId>
            <version>${agentscope.version}</version>
        </dependency>
    </dependencies>
</dependencyManagement>
```

#### 2. 修改子模块 `agent-backend/server-agents/pom.xml`

在 `<dependencies>` 中引入对应的扩展依赖：

```xml
<!-- agent-backend/server-agents/pom.xml -->
<dependencies>
    <dependency>
        <groupId>io.agentscope</groupId>
        <artifactId>agentscope-harness</artifactId>
    </dependency>

    <dependency>
        <groupId>io.agentscope</groupId>
        <artifactId>agentscope-extensions-model-dashscope</artifactId>
    </dependency>

    <dependency>
        <groupId>io.agentscope</groupId>
        <artifactId>agentscope-extensions-model-openai</artifactId>
    </dependency>
</dependencies>
```

---

### 步骤二：配置应用 YAML (`application.yml`)

在 `server-network/src/main/resources/application.yml`（或 `server-agents` 相应配置文件）中加入以下模型多厂商配置：

```yaml
agent:
  model:
    default-provider: qwen-max
    providers:
      qwen-max:
        protocol: dashscope
        model: qwen-max
        api-key: ${DASHSCOPE_API_KEY:}
        thinking: false
        context-window: 32768
        max-output-tokens: 8192
        temperature: 0.7
      
      deepseek-r1:
        protocol: openai-compat
        base-url: https://api.deepseek.com/v1
        model: deepseek-reasoner
        api-key: ${DEEPSEEK_API_KEY:}
        thinking: true
        context-window: 64000
        max-output-tokens: 8192
        temperature: 0.6

      gpt-4o:
        protocol: openai
        model: gpt-4o
        api-key: ${OPENAI_API_KEY:}
        thinking: false
        context-window: 128000
        max-output-tokens: 4096
```

---

### 步骤三：创建配置映射类 `ModelProviderProperties.java`

新建文件路径：`agent-backend/server-agents/src/main/java/butvan/agent/agents/model/config/ModelProviderProperties.java`

```java
package butvan.agent.agents.model.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;

/**
 * AgentScope 多厂商模型配置映射类。
 */
@Component
@ConfigurationProperties(prefix = "agent.model")
public class ModelProviderProperties {

    /**
     * 默认模型提供者名称
     */
    private String defaultProvider = "qwen-max";

    /**
     * 多厂商模型配置字典 (providerName -> ProviderConfig)
     */
    private Map<String, ProviderConfig> providers = new HashMap<>();

    public String getDefaultProvider() {
        return defaultProvider;
    }

    public void setDefaultProvider(String defaultProvider) {
        this.defaultProvider = defaultProvider;
    }

    public Map<String, ProviderConfig> getProviders() {
        return providers;
    }

    public void setProviders(Map<String, ProviderConfig> providers) {
        this.providers = providers;
    }

    public static class ProviderConfig {
        private String name;
        private String protocol; // "dashscope", "openai", "openai-compat", "anthropic"
        private String baseUrl;
        private String model;
        private String apiKey;
        private boolean thinking;
        private int contextWindow;
        private int maxOutputTokens;
        private Double temperature = 0.7;

        public String getName() { return name; }
        public void setName(String name) { this.name = name; }

        public String getProtocol() { return protocol; }
        public void setProtocol(String protocol) { this.protocol = protocol; }

        public String getBaseUrl() { return baseUrl; }
        public void setBaseUrl(String baseUrl) { this.baseUrl = baseUrl; }

        public String getModel() { return model; }
        public void setModel(String model) { this.model = model; }

        public String getApiKey() { return apiKey; }
        public void setApiKey(String apiKey) { this.apiKey = apiKey; }

        public boolean isThinking() { return thinking; }
        public void setThinking(boolean thinking) { this.thinking = thinking; }

        public int getContextWindow() { return contextWindow; }
        public void setContextWindow(int contextWindow) { this.contextWindow = contextWindow; }

        public int getMaxOutputTokens() { return maxOutputTokens; }
        public void setMaxOutputTokens(int maxOutputTokens) { this.maxOutputTokens = maxOutputTokens; }

        public Double getTemperature() { return temperature; }
        public void setTemperature(Double temperature) { this.temperature = temperature; }
    }
}
```

---

### 步骤四：创建别名与能力解析器 `ModelResolver.java`

新建文件路径：`agent-backend/server-agents/src/main/java/butvan/agent/agents/model/resolver/ModelResolver.java`

```java
package butvan.agent.agents.model.resolver;

import butvan.agent.agents.model.config.ModelProviderProperties.ProviderConfig;

import java.util.Map;

/**
 * 模型别名映射、能力探测与多级 Context Window 兜底解析器。
 */
public class ModelResolver {

    /**
     * 常用模型别名映射表
     */
    private static final Map<String, String> ALIASES = Map.of(
            "qwen", "qwen-max",
            "sonnet", "claude-3-5-sonnet-20241022",
            "haiku", "claude-3-5-haiku-20241022",
            "deepseek", "deepseek-reasoner",
            "gpt4", "gpt-4o"
    );

    /**
     * 协议与其对应的环境变量 API Key 映射
     */
    private static final Map<String, String> ENV_KEY_MAP = Map.of(
            "dashscope", "DASHSCOPE_API_KEY",
            "openai", "OPENAI_API_KEY",
            "openai-compat", "OPENAI_API_KEY",
            "anthropic", "ANTHROPIC_API_KEY"
    );

    /**
     * 解析模型名称或别名
     */
    public static String resolveModelId(String modelOrAlias) {
        if (modelOrAlias == null) return "";
        return ALIASES.getOrDefault(modelOrAlias.toLowerCase(), modelOrAlias);
    }

    /**
     * 判断模型是否具备 Reasoning / Thinking 特性
     */
    public static boolean supportsThinking(String model) {
        if (model == null) return false;
        String m = model.toLowerCase();
        return m.contains("reasoner") || m.contains("o1") || m.contains("o3") || m.contains("claude-3-7");
    }

    /**
     * 隐蔽解析有效 API Key (配置显示 Key > 系统环境变量)
     */
    public static String resolveApiKey(ProviderConfig cfg) {
        if (cfg.getApiKey() != null && !cfg.getApiKey().isBlank()) {
            return cfg.getApiKey();
        }
        String envName = ENV_KEY_MAP.get(cfg.getProtocol());
        if (envName != null) {
            String val = System.getenv(envName);
            if (val != null && !val.isBlank()) {
                return val;
            }
        }
        // 特殊 fallback：若为 deepseek 可尝试 DEEPSEEK_API_KEY
        if ("openai-compat".equals(cfg.getProtocol())) {
            String dsKey = System.getenv("DEEPSEEK_API_KEY");
            if (dsKey != null && !dsKey.isBlank()) return dsKey;
        }
        return "";
    }

    /**
     * 4 层 Context Window 兜底解析机制
     */
    public static int resolveContextWindow(ProviderConfig cfg) {
        // Layer 1: 手写显式配置
        if (cfg.getContextWindow() > 0) {
            return cfg.getContextWindow();
        }
        // Layer 2 & 3: 模型契约匹配矩阵
        String m = cfg.getModel() != null ? cfg.getModel().toLowerCase() : "";
        if (m.contains("1m") || m.contains("gpt-4.1")) return 1_000_000;
        if (m.contains("gpt-4o") || m.contains("gpt-4-turbo")) return 128_000;
        if (m.contains("o1") || m.contains("o3") || m.contains("claude")) return 200_000;
        if (m.contains("deepseek")) return 64_000;
        if (m.contains("qwen")) return 32_768;

        // Layer 4: 保守兜底
        return 128_000;
    }
}
```

---

### 步骤五：创建模型工厂类 `AgentScopeModelFactory.java`

新建文件路径：`agent-backend/server-agents/src/main/java/butvan/agent/agents/model/factory/AgentScopeModelFactory.java`

```java
package butvan.agent.agents.model.factory;

import butvan.agent.agents.model.config.ModelProviderProperties.ProviderConfig;
import butvan.agent.agents.model.resolver.ModelResolver;
import io.agentscope.core.model.Model;
import io.agentscope.model.DashScopeChatModel;
import io.agentscope.model.OpenAIChatModel;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * AgentScope Java 模型构建工厂。
 */
public class AgentScopeModelFactory {

    private static final Logger log = LoggerFactory.getLogger(AgentScopeModelFactory.class);

    /**
     * 根据 ProviderConfig 构建对应的 AgentScope Model 实例
     */
    public static Model createModel(String providerName, ProviderConfig cfg) {
        String protocol = cfg.getProtocol() != null ? cfg.getProtocol().toLowerCase() : "";
        String apiKey = ModelResolver.resolveApiKey(cfg);
        String modelId = ModelResolver.resolveModelId(cfg.getModel());

        log.info("Initializing AgentScope Model [{}] - Protocol: {}, ModelId: {}", providerName, protocol, modelId);

        switch (protocol) {
            case "dashscope":
                return DashScopeChatModel.builder()
                        .modelName(modelId)
                        .apiKey(apiKey)
                        .temperature(cfg.getTemperature())
                        .build();

            case "openai":
            case "openai-compat":
                var openAiBuilder = OpenAIChatModel.builder()
                        .modelName(modelId)
                        .apiKey(apiKey)
                        .temperature(cfg.getTemperature());
                
                if (cfg.getBaseUrl() != null && !cfg.getBaseUrl().isBlank()) {
                    openAiBuilder.baseUrl(cfg.getBaseUrl());
                }
                return openAiBuilder.build();

            default:
                throw new IllegalArgumentException("Unsupported model protocol: [" + protocol + "] for provider [" + providerName + "]");
        }
    }
}
```

---

### 步骤六：创建模型注册中心 `AgentScopeModelRegistry.java`

新建文件路径：`agent-backend/server-agents/src/main/java/butvan/agent/agents/model/registry/AgentScopeModelRegistry.java`

```java
package butvan.agent.agents.model.registry;

import butvan.agent.agents.model.config.ModelProviderProperties;
import butvan.agent.agents.model.config.ModelProviderProperties.ProviderConfig;
import butvan.agent.agents.model.factory.AgentScopeModelFactory;
import butvan.agent.agents.model.resolver.ModelResolver;
import io.agentscope.core.model.Model;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * AgentScope 模型注册中心与生命周期托管。
 */
@Component
public class AgentScopeModelRegistry {

    private static final Logger log = LoggerFactory.getLogger(AgentScopeModelRegistry.class);

    private final ModelProviderProperties properties;
    private final Map<String, Model> modelCache = new ConcurrentHashMap<>();

    public AgentScopeModelRegistry(ModelProviderProperties properties) {
        this.properties = properties;
    }

    @PostConstruct
    public void init() {
        log.info("Starting initializing AgentScope ModelRegistry...");
        Map<String, ProviderConfig> providers = properties.getProviders();
        if (providers == null || providers.isEmpty()) {
            log.warn("No model providers configured under agent.model.providers!");
            return;
        }

        providers.forEach((name, cfg) -> {
            try {
                cfg.setName(name);
                Model model = AgentScopeModelFactory.createModel(name, cfg);
                modelCache.put(name, model);
                log.info("Successfully registered AgentScope Model [{}]", name);
            } catch (Exception e) {
                log.error("Failed to initialize model provider [{}]", name, e);
            }
        });
    }

    /**
     * 根据厂商配置名或别名获取 AgentScope Model 实例
     */
    public Model getModel(String providerOrAlias) {
        if (providerOrAlias == null || providerOrAlias.isBlank()) {
            return getDefaultModel();
        }

        // 1. 精确配置名匹配
        if (modelCache.containsKey(providerOrAlias)) {
            return modelCache.get(providerOrAlias);
        }

        // 2. 别名解析匹配
        String resolvedName = ModelResolver.resolveModelId(providerOrAlias);
        if (modelCache.containsKey(resolvedName)) {
            return modelCache.get(resolvedName);
        }

        log.warn("Model provider [{}] not found, falling back to default provider [{}]", 
                providerOrAlias, properties.getDefaultProvider());
        return getDefaultModel();
    }

    /**
     * 获取系统默认模型
     */
    public Model getDefaultModel() {
        String defaultName = properties.getDefaultProvider();
        Model defaultModel = modelCache.get(defaultName);
        if (defaultModel == null) {
            throw new IllegalStateException("Default AgentScope Model [" + defaultName + "] is not initialized!");
        }
        return defaultModel;
    }
}
```

---

## 三、 测试验证与故障排查 (Verification & Troubleshooting)

### 3.1 单元测试验证样例

在 `agent-backend/server-agents/src/test/java` 中新建单元测试类：

```java
package butvan.agent.agents.model;

import butvan.agent.agents.model.config.ModelProviderProperties;
import butvan.agent.agents.model.registry.AgentScopeModelRegistry;
import io.agentscope.core.model.Model;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.junit.jupiter.api.Assertions.assertNotNull;

@SpringBootTest
public class ModelRegistryTest {

    @Autowired
    private AgentScopeModelRegistry modelRegistry;

    @Test
    public void testGetDefaultModel() {
        Model defaultModel = modelRegistry.getDefaultModel();
        assertNotNull(defaultModel, "Default model should be properly initialized!");
    }
}
```

### 3.2 常见问题速查

- **API Key 未找到错误**：请确保在环境变量中 `export DASHSCOPE_API_KEY=your_key` 或在 `application.yml` 中配置 `api-key` 参数。
- **OpenAI-Compat 端点连接错误**：使用 deepseek, ollama 或第三方兼容端点时，请在 `application.yml` 中配置正确的 `base-url` (如 `https://api.deepseek.com/v1`)。
- **Maven 类加载错误**：如遇 `NoSuchMethodError` 或无法找到 `DashScopeChatModel`，请执行 `mvn clean compile` 确保 parent 与 sub-module pom 文件同步拉取了 2.0.0 依赖。
