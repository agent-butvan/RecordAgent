package butvan.agent.agents.agent;

import butvan.agent.agents.context.ContextInjectionMiddleware;
import butvan.agent.agents.model.ModelHolder;
import butvan.agent.agents.prompts.PromptBuilder;
import butvan.agent.agents.security.AgentSecurity;
import butvan.agent.agents.security.PermissionChecker;
import butvan.agent.agents.storage.AgentStorageProperties;
import butvan.agent.agents.subagent.SubagentCatalog;
import butvan.agent.agents.tool.ToolRegistry;
import butvan.agent.agents.usage.TokenUsageMiddleware;
import io.agentscope.core.model.Model;
import io.agentscope.core.permission.PermissionMode;
import io.agentscope.core.state.AgentStateStore;
import io.agentscope.harness.agent.HarnessAgent;
import io.agentscope.harness.agent.bus.MessageBus;
import io.agentscope.harness.agent.memory.compaction.CompactionConfig;
import io.agentscope.harness.agent.subagent.task.TaskRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.nio.file.Paths;
import java.util.concurrent.atomic.AtomicReference;

/**
 * HarnessAgent 构建与缓存。
 *
 * <p>模型切换时重建 Agent；会话状态保存在独立的 agentStateStore 中，
 * 因此不会因 Agent 实例替换而丢失。</p>
 */
@Component
@RequiredArgsConstructor
public class AgentFactory {

    private final ModelHolder modelHolder;
    private final ToolRegistry toolRegistry;
    private final AgentSecurity agentSecurity;
    private final AgentStorageProperties storageProperties;
    private final AgentStateStore agentStateStore;
    private final TaskRepository subagentTaskRepository;
    private final MessageBus subagentMessageBus;
    private final SubagentCatalog subagentCatalog;
    private final TokenUsageMiddleware tokenUsageMiddleware;
    private final ContextInjectionMiddleware contextInjectionMiddleware;

    private final PermissionChecker permissionChecker = new PermissionChecker(
            PermissionMode.DEFAULT,
            Paths.get(".").toAbsolutePath().normalize()
    );

    /**
     *  当前模型对呀的Agent缓存；同一模型连续请求不会重复构建 Agent
     */
    private final AtomicReference<HarnessAgent> cachedAgent = new AtomicReference<>();

    /**
     * 用对象引用识别 ModelHolder 是否已经切换了模型实例。
     */
    private volatile Model cachedModel;

    public synchronized HarnessAgent currentAgent() {
        // 获取当前激活的模型
        Model currentModel = modelHolder.getModel();
        HarnessAgent existingAgent = cachedAgent.get();

        // 模型未变：直接服用缓存，避免重复构建 Agent
        if (existingAgent != null && cachedModel == currentModel) {
            return existingAgent;
        }
        // 模型已切换：重建 Agent 并替换缓存
        HarnessAgent newAgent = createHarnessAgent(currentModel);
        cachedModel = currentModel;
        cachedAgent.set(newAgent);
        return newAgent;
    }

    /** 构建 Agent 时只指定根目录和状态存储，不拼接任何 sessionDir。 */
    private HarnessAgent createHarnessAgent(Model model) {
        // 模型名缺失时给兜底名，保证系统提示词可读
        String modelName = model.getModelName() == null ? "unknown-model" : model.getModelName();
        // 根据模型名与工作目录构建系统提示词
        String systemPrompt = PromptBuilder.buildDefaultSystemPrompt(
                modelName,
                System.getProperty("user.dir")
        );
        // 组装 HarnessAgent：计划模式、工具集、权限、工作区、状态存储、上下文压缩
        HarnessAgent agent = HarnessAgent.builder()
                .name("butvan_agent")
                .sysPrompt(systemPrompt)
                .model(model)
                .middleware(contextInjectionMiddleware)
                .middleware(tokenUsageMiddleware)
                .enablePlanMode() // 开启计划模式
                .planFileDirectory("plans")
                .toolkit(toolRegistry.getToolkit())
                .permissionContext(agentSecurity.createPermissionContext(permissionChecker))
                .workspace(storageProperties.getWorkspaceDirectory())
                .disableWorkspaceContext()
                .stateStore(agentStateStore)
                .taskRepository(subagentTaskRepository)
                .messageBus(subagentMessageBus)
                .subagents(subagentCatalog.declarations())
                .compaction(CompactionConfig.builder()
                        .triggerMessages(30)    // 30 条消息触发上下文压缩
                        .keepMessages(10)       // 压缩后保留最近 10 条
                        //.triggerTokens(131072)   // 固定 token 阈值，禁用动态 contextWindowSize 探测（避免框架向 DashScope 发送非法 URL 的探测请求）
                        .build())
                .build();
        toolRegistry.enableOnDemandSchemas(agent.getToolkit());
        return agent;
    }
}
