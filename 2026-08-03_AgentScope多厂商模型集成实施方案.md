# AgentScope-Java 2.0 动态多厂商大模型集成架构与手动实施指南

> **文档日期**: 2026-08-03  
> **目标模块**: `agent-backend` (`server-agents` 模块)  
> **框架规范**: AgentScope-Java 2.0 + Spring Boot 3.4  
> **设计目标**: 实现“厂商端点凭证 (BaseURL + Key) 配置”与“运行时动态模型 ID (Model Name)”彻底解耦，支持前端选择厂商与自由输入/切换任意模型。

---

## 一、 方案设计背景与架构升级说明

### 1.1 传统硬编码模型配置痛点
在传统的配置方式中，YAML 文件强绑定了具体的模型实例（如 `qwen-max`, `deepseek-r1`, `gpt-4o`）。这种方式存在明显缺陷：
- **死板固化**：每次厂商推出了新模型（如 `qwen-turbo-latest` 或 `gpt-4.5`），系统都必须修改 YAML 甚至重启后端。
- **缺乏前端交互**：无法在 Web 前端让用户自行填写个人/企业的 API Key 和 Base URL，也无法动态下拉选择新模型。

### 1.2 动态厂商驱动架构 (Dynamic Vendor-Driven Architecture)

本升级方案将集成层拆分为两级架构：

```mermaid
flowchart TD
    UI[Web前端 / 交互界面] -->|发送请求: vendor='deepseek', model='deepseek-r1'| Controller[后端 API]
    
    subgraph 厂商凭证管理 (Vendor Credential Layer)
        ConfigDB[(YAML / Nacos / 数据库)] -->|定义厂商凭证| Registry[AgentScopeModelRegistry]
        VendorOpenAI[OpenAI: baseUrl + apiKey] --> Registry
        VendorDashscope[DashScope: apiKey] --> Registry
        VendorDeepSeek[DeepSeek: baseUrl + apiKey] --> Registry
        VendorOllama[Ollama: baseUrl] --> Registry
    end
    
    Controller -->|按厂商与模型请求| Registry
    Registry -->|动态匹配/复用模型| Factory[AgentScopeModelFactory]
    Factory -->|实例化 AgentScope Model| Agent[ReActAgent / Workflow]
```

1. **厂商凭证配置 (Vendor Config)**：仅需在配置/数据库中保存不同厂商（如 `dashscope`, `openai`, `deepseek`, `siliconflow`, `ollama`）的 **Protocol**、**Base URL** 和 **API Key**。
2. **运行时模型选择 (Runtime Model Resolution)**：在前端或对话请求中，用户只需选择厂商，并指定具体想要调用的 `model`（模型标识）。
3. **动态工厂与智能缓存 (Dynamic Factory & Caching)**：后端根据“厂商凭证 + 模型标识”即时构造对应的 AgentScope `Model` 实例（`DashScopeChatModel` 或 `OpenAIChatModel`），并进行高效内存缓存。

---

## 二、 详细实施步骤指南 (Step-by-Step)

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

因为 `server-agents` 模块需要使用 `@Component` 和 `@ConfigurationProperties` 等 Spring 核心注解，需要在此模块添加 `spring-boot-starter` 依赖：

```xml
<!-- agent-backend/server-agents/pom.xml -->
<dependencies>
    <!-- Spring Boot 基础核心依赖 (提供 @Component, @ConfigurationProperties 等) -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter</artifactId>
    </dependency>

    <!-- AgentScope 核心依赖 -->
    <dependency>
        <groupId>io.agentscope</groupId>
        <artifactId>agentscope-harness</artifactId>
    </dependency>

    <!-- AgentScope 阿里云 DashScope 模型扩展 -->
    <dependency>
        <groupId>io.agentscope</groupId>
        <artifactId>agentscope-extensions-model-dashscope</artifactId>
    </dependency>

    <!-- AgentScope OpenAI / OpenAI-Compat 模型扩展 -->
    <dependency>
        <groupId>io.agentscope</groupId>
        <artifactId>agentscope-extensions-model-openai</artifactId>
    </dependency>
</dependencies>
```

---

### 步骤二：厂商级配置声明 (`application.yml`)

在配置文件中，**仅配置厂商粒度**的通信凭证，无需死板写死具体模型列表：

```yaml
agent:
  model:
    default-vendor: dashscope
    default-model: qwen-max
    vendors:
      # 阿里云 DashScope
      dashscope:
        protocol: dashscope
        api-key: ${DASHSCOPE_API_KEY:}
      
      # DeepSeek 官方 API
      deepseek:
        protocol: openai-compat
        base-url: https://api.deepseek.com/v1
        api-key: ${DEEPSEEK_API_KEY:}
      
      # 硅基流动 SiliconFlow
      siliconflow:
        protocol: openai-compat
        base-url: https://api.siliconflow.cn/v1
        api-key: ${SILICONFLOW_API_KEY:}

      # 本地 Ollama
      ollama:
        protocol: openai-compat
        base-url: http://localhost:11434/v1
        api-key: "ollama"

      # OpenAI 官方
      openai:
        protocol: openai
        base-url: https://api.openai.com/v1
        api-key: ${OPENAI_API_KEY:}
```

---

### 步骤三：创建厂商配置实体类 (`VendorProviderProperties.java`)

新建文件路径：`agent-backend/server-agents/src/main/java/butvan/agent/agents/model/config/VendorProviderProperties.java`

注解对应包路径为：
- `@Component`: `import org.springframework.stereotype.Component;`
- `@ConfigurationProperties`: `import org.springframework.boot.context.properties.ConfigurationProperties;`

```java
package butvan.agent.agents.model.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;

/**
 * 厂商级（Vendor Level）大模型凭证配置类。
 */
@Component
@ConfigurationProperties(prefix = "agent.model")
public class VendorProviderProperties {

    /**
     * 默认厂商名称
     */
    private String defaultVendor = "dashscope";

    /**
     * 默认模型 ID
     */
    private String defaultModel = "qwen-max";

    /**
     * 厂商凭证配置字典 (vendorName -> VendorConfig)
     */
    private Map<String, VendorConfig> vendors = new HashMap<>();

    public String getDefaultVendor() { return defaultVendor; }
    public void setDefaultVendor(String defaultVendor) { this.defaultVendor = defaultVendor; }

    public String getDefaultModel() { return defaultModel; }
    public void setDefaultModel(String defaultModel) { this.defaultModel = defaultModel; }

    public Map<String, VendorConfig> getVendors() { return vendors; }
    public void setVendors(Map<String, VendorConfig> vendors) { this.vendors = vendors; }

    /**
     * 厂商凭证配置
     */
    public static class VendorConfig {
        private String name;
        private String protocol; // "dashscope", "openai", "openai-compat"
        private String baseUrl;
        private String apiKey;
        private boolean enabled = true;

        public String getName() { return name; }
        public void setName(String name) { this.name = name; }

        public String getProtocol() { return protocol; }
        public void setProtocol(String protocol) { this.protocol = protocol; }

        public String getBaseUrl() { return baseUrl; }
        public void setBaseUrl(String baseUrl) { this.baseUrl = baseUrl; }

        public String getApiKey() { return apiKey; }
        public void setApiKey(String apiKey) { this.apiKey = apiKey; }

        public boolean isEnabled() { return enabled; }
        public void setEnabled(boolean enabled) { this.enabled = enabled; }
    }
}
```

---

### 步骤四：创建动态模型请求上下文 (`ModelSelector.java`)

用于在运行时传递“厂商 + 动态模型 ID”：

新建文件路径：`agent-backend/server-agents/src/main/java/butvan/agent/agents/model/dto/ModelSelector.java`

```java
package butvan.agent.agents.model.dto;

/**
 * 运行时模型选择器 DTO。
 */
public record ModelSelector(
        String vendor,      // 厂商标识，如 "deepseek", "dashscope", "openai"
        String modelName,   // 动态输入的模型标识，如 "deepseek-reasoner", "qwen-plus", "gpt-4o-mini"
        Double temperature, // 温度系数 (选填)
        String customBaseUrl,// 自定义临时 BaseURL (选填，支持前端覆盖)
        String customApiKey  // 自定义临时 APIKey (选填，支持前端覆盖)
) {
    public static ModelSelector of(String vendor, String modelName) {
        return new ModelSelector(vendor, modelName, 0.7, null, null);
    }
}
```

---

### 步骤五：升级模型工厂类 (`AgentScopeModelFactory.java`)

支持基于“厂商配置 + 动态模型 ID”即时创建 AgentScope Model：

新建文件路径：`agent-backend/server-agents/src/main/java/butvan/agent/agents/model/factory/AgentScopeModelFactory.java`

```java
package butvan.agent.agents.model.factory;

import butvan.agent.agents.model.config.VendorProviderProperties.VendorConfig;
import butvan.agent.agents.model.dto.ModelSelector;
import io.agentscope.core.model.Model;
import io.agentscope.model.DashScopeChatModel;
import io.agentscope.model.OpenAIChatModel;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * 动态 AgentScope Java 模型构建工厂。
 */
public class AgentScopeModelFactory {

    private static final Logger log = LoggerFactory.getLogger(AgentScopeModelFactory.class);

    /**
     * 根据厂商凭证与动态模型请求构建对应的 AgentScope Model 实例
     */
    public static Model createModel(VendorConfig vendorConfig, ModelSelector selector) {
        String protocol = vendorConfig.getProtocol() != null ? vendorConfig.getProtocol().toLowerCase() : "";
        
        // 优先使用请求级自定 Key/Url，未提供则使用厂商默认配置
        String apiKey = (selector.customApiKey() != null && !selector.customApiKey().isBlank())
                ? selector.customApiKey()
                : resolveApiKey(vendorConfig);

        String baseUrl = (selector.customBaseUrl() != null && !selector.customBaseUrl().isBlank())
                ? selector.customBaseUrl()
                : vendorConfig.getBaseUrl();

        String targetModelId = selector.modelName();
        Double temp = selector.temperature() != null ? selector.temperature() : 0.7;

        log.info("Creating dynamic AgentScope Model - Vendor: [{}], Protocol: [{}], Target Model: [{}], BaseUrl: [{}]",
                vendorConfig.getName(), protocol, targetModelId, baseUrl);

        switch (protocol) {
            case "dashscope":
                return DashScopeChatModel.builder()
                        .modelName(targetModelId)
                        .apiKey(apiKey)
                        .temperature(temp)
                        .build();

            case "openai":
            case "openai-compat":
                var openAiBuilder = OpenAIChatModel.builder()
                        .modelName(targetModelId)
                        .apiKey(apiKey)
                        .temperature(temp);
                
                if (baseUrl != null && !baseUrl.isBlank()) {
                    openAiBuilder.baseUrl(baseUrl);
                }
                return openAiBuilder.build();

            default:
                throw new IllegalArgumentException("Unsupported protocol: [" + protocol + "] for vendor [" + vendorConfig.getName() + "]");
        }
    }

    private static String resolveApiKey(VendorConfig config) {
        if (config.getApiKey() != null && !config.getApiKey().isBlank()) {
            return config.getApiKey();
        }
        // 环境变量读取
        String envKey = switch (config.getProtocol()) {
            case "dashscope" -> System.getenv("DASHSCOPE_API_KEY");
            case "openai", "openai-compat" -> System.getenv("OPENAI_API_KEY");
            default -> null;
        };
        return envKey != null ? envKey : "";
    }
}
```

---

### 步骤六：创建厂商注册与动态模型路由中心 (`AgentScopeModelRegistry.java`)

支持在线更新厂商配置、动态路由模型、线程安全缓存：

新建文件路径：`agent-backend/server-agents/src/main/java/butvan/agent/agents/model/registry/AgentScopeModelRegistry.java`

```java
package butvan.agent.agents.model.registry;

import butvan.agent.agents.model.config.VendorProviderProperties;
import butvan.agent.agents.model.config.VendorProviderProperties.VendorConfig;
import butvan.agent.agents.model.dto.ModelSelector;
import butvan.agent.agents.model.factory.AgentScopeModelFactory;
import io.agentscope.core.model.Model;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 厂商凭证注册中心与动态模型路由。
 */
@Component
public class AgentScopeModelRegistry {

    private static final Logger log = LoggerFactory.getLogger(AgentScopeModelRegistry.class);

    private final VendorProviderProperties properties;
    
    // 厂商配置表 (vendorName -> VendorConfig)
    private final Map<String, VendorConfig> vendorCache = new ConcurrentHashMap<>();

    // 动态 Model 实例缓存 (cacheKey: vendor:modelName -> Model)
    private final Map<String, Model> modelInstanceCache = new ConcurrentHashMap<>();

    public AgentScopeModelRegistry(VendorProviderProperties properties) {
        this.properties = properties;
    }

    @PostConstruct
    public void init() {
        log.info("Initializing AgentScope VendorRegistry...");
        Map<String, VendorConfig> vendors = properties.getVendors();
        if (vendors != null) {
            vendors.forEach((name, config) -> {
                config.setName(name);
                vendorCache.put(name, config);
                log.info("Registered Vendor Provider: [{}] - Protocol: {}", name, config.getProtocol());
            });
        }
    }

    /**
     * 根据 ModelSelector (厂商 + 动态模型标识) 获取或构建 AgentScope Model
     */
    public Model getModel(ModelSelector selector) {
        String vendorName = (selector.vendor() != null && !selector.vendor().isBlank())
                ? selector.vendor()
                : properties.getDefaultVendor();

        String modelName = (selector.modelName() != null && !selector.modelName().isBlank())
                ? selector.modelName()
                : properties.getDefaultModel();

        VendorConfig vendorConfig = vendorCache.get(vendorName);
        if (vendorConfig == null) {
            throw new IllegalArgumentException("Vendor provider [" + vendorName + "] is not registered in system!");
        }

        // 缓存 Key: vendor:modelName
        String cacheKey = vendorName + ":" + modelName;
        return modelInstanceCache.computeIfAbsent(cacheKey, k -> 
                AgentScopeModelFactory.createModel(vendorConfig, selector)
        );
    }

    /**
     * 快捷调用接口：指定厂商与动态模型名
     */
    public Model getModel(String vendor, String modelName) {
        return getModel(ModelSelector.of(vendor, modelName));
    }

    /**
     * 动态注册或更改厂商配置 (支持前端设置页面在线更新)
     */
    public void updateVendorConfig(String vendorName, VendorConfig config) {
        config.setName(vendorName);
        vendorCache.put(vendorName, config);
        // 清理该厂商旧模型缓存
        modelInstanceCache.keySet().removeIf(key -> key.startsWith(vendorName + ":"));
        log.info("Updated Vendor Config for [{}] and invalidated model caches.", vendorName);
    }

    /**
     * 获取系统默认模型
     */
    public Model getDefaultModel() {
        return getModel(properties.getDefaultVendor(), properties.getDefaultModel());
    }
}
```

---

## 三、 扩展使用说明（前端与业务层调用）

在业务 Service 或 Controller 中，你可以极其灵活地指定厂商和调用的任意模型：

```java
@Service
public class AgentChatService {

    @Autowired
    private AgentScopeModelRegistry modelRegistry;

    public void startChat(String userVendor, String userModelName, String userPrompt) {
        // 1. 动态获取用户选定的厂商+任意模型 (如: vendor="deepseek", modelName="deepseek-r1")
        Model agentModel = modelRegistry.getModel(userVendor, userModelName);

        // 2. 传递给 AgentScope 智能体使用
        // ReActAgent agent = ReActAgent.builder().model(agentModel)...
    }
}
```

如此一来，无论厂商未来发布什么新模型，前端界面均可直接传入模型名称进行通信，无需改动后端配置与重新部署服务。
