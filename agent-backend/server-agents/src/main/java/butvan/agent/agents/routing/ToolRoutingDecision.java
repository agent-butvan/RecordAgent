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
 * @param durationMillis 本次路由请求的总耗时毫秒
 * @param failure Jev 失败后的安全摘要；仅 FALLBACK 状态可能存在
 */
public record ToolRoutingDecision(
        Status status,
        Set<String> selectedGroups,
        Map<String, Double> probabilities,
        String providerModel,
        long durationMillis,
        ToolRoutingFailure failure
) {

    /** 将集合字段复制为不可变快照，避免路由结果被调用方修改。 */
    public ToolRoutingDecision {
        selectedGroups = selectedGroups == null ? Set.of() : Set.copyOf(selectedGroups);
        probabilities = probabilities == null ? Map.of() : Map.copyOf(probabilities);
    }

    /** 保留成功决策原有构造形式，失败摘要默认为空。 */
    public ToolRoutingDecision(
            Status status,
            Set<String> selectedGroups,
            Map<String, Double> probabilities,
            String providerModel,
            long durationMillis
    ) {
        this(status, selectedGroups, probabilities, providerModel, durationMillis, null);
    }

    /**
     * 本次路由的生命周期状态。
     */
    public enum Status {
        OFF,
        SHADOW,
        ACTIVE,
        FALLBACK // Jev 调用或响应校验失败，回退原流程
    }

    /**
     * 判断 Middleware 是否应该应用本决策。
     *
     * @return 仅 ACTIVE 状态返回 true
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
        return new ToolRoutingDecision(Status.OFF, Set.of(), Map.of(), "", 0L, null);
    }

    /**
     * 创建“Jev 失败并回退”的决策。
     *
     * @param durationMillis 失败前已经消耗的时间
     * @return FALLBACK 状态的空决策
     */
    public static ToolRoutingDecision fallback(long durationMillis) {
        return fallback(durationMillis, ToolRoutingFailure.unknown());
    }

    /**
     * 创建携带安全失败摘要的降级决策。
     *
     * @param durationMillis 失败前已经消耗的时间
     * @param failure 可安全传播的失败原因
     * @return FALLBACK 状态的空决策
     */
    public static ToolRoutingDecision fallback(
            long durationMillis,
            ToolRoutingFailure failure
    ) {
        return new ToolRoutingDecision(
                Status.FALLBACK,
                Set.of(),
                Map.of(),
                "",
                durationMillis,
                failure == null ? ToolRoutingFailure.unknown() : failure
        );
    }
}
