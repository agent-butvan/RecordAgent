package butvan.agent.agents.routing;

import butvan.agent.agents.config.TypeSafeConfigData;
import butvan.agent.agents.config.TypeSafeProperties;
import butvan.agent.agents.tool.ToolCapabilityCatalog;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Slf4j
@Component
@RequiredArgsConstructor
public class JevToolCapabilityRouter implements ToolCapabilityRouter {

    /**
     * 允许发送给 Jev 的最大 Java 字符数，用于限制隐私暴露范围与调用成本。
     */
    private static final int MAX_INPUT_CHARS = 4_000;

    /** properties：按轮次读取用户级 TypeSafe 配置。 */
    private final TypeSafeProperties properties;

    /** capabilityCatalog：提供允许交给 Jev 判断的能力组及说明。 */
    private final ToolCapabilityCatalog capabilityCatalog;

    /** gateway：负责调用 TypeSafe System One API。 */
    private final SystemOneGateway gateway;

    /**
     * 为一次新用户轮次生成 Tool 能力组决策
     *
     * @param request 当前用户文本和运行时可用能力组集合
     * @return 当前轮次的 Tool 能力组路由决策
     */
    @Override
    public ToolRoutingDecision route(ToolRoutingRequest request) {
        // 单调时钟起点，只用于计算路由耗时，不代表墙上时间
        long startedAt = System.nanoTime();

        try {
            // 本次路由开始时读取到的 TypeSafe 配置快照
            TypeSafeConfigData config = properties.load();
            if (!config.isReady()) return ToolRoutingDecision.off();

            // 去除首尾空白并执行长度限制后的 Jev 输入文本
            String state = normalizeInput(request.userInput());

            // 以能力组名为 key、一次性发送给 Jev 的全部 Noul 问题
            Map<String, JevNoulQuestion> questions = capabilityCatalog.capabilities()
                    .stream()
                    .filter(item -> request.availableGroups().contains(item.name()))
                    .collect(Collectors.toUnmodifiableMap(
                            ToolCapabilityCatalog.Capability::name,
                            item -> JevNoulQuestion.of(
                                    "完成当前用户请求是否需要以下能力：" + item.description()
                            )
                    ));

            // System One 对全部能力组问题返回的原始结构化响应
            JevSystemOneResponse response = gateway.evaluate(
                    config.apiKey(), config.model(), state, questions
            );

            // 校验完成以后，以能力组名为 key 的 yes 概率
            Map<String, Double> probabilities = validateAnswers(questions, response);

            // 概率达到配置阈值、准备暴露给主模型的能力组
            Set<String> selected = probabilities.entrySet().stream()
                    .filter(entry -> entry.getValue() >= config.threshold())
                    .map(Map.Entry::getKey)
                    .collect(Collectors.toUnmodifiableSet());

            // 决定结果只用于观测，还是立即应用于本轮 Model Call
            ToolRoutingDecision.Status status = config.mode() == ToolRoutingMode.ACTIVE
                    ? ToolRoutingDecision.Status.ACTIVE
                    : ToolRoutingDecision.Status.SHADOW;

            // 准备写入 RuntimeContext 的本轮最终路由决策
            ToolRoutingDecision decision = new ToolRoutingDecision(
                    status,
                    selected,
                    probabilities,
                    response.model(),
                    elapsedMillis(startedAt)
            );

            log.info("Jev Tool 路由完成： status={}, groups={}, probabilities={}, costMs={}",
                    decision.status(), decision.selectedGroups(), decision.probabilities(), decision.durationMillis());

            return decision;
        } catch (RuntimeException exception) {
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
            if (!Double.isFinite(answer.noul())
                    || answer.noul() < 0.0
                    || answer.noul() > 1.0) {
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
