package butvan.agent.agents.usage;

/** 模型输入细分的本地 Token 估算接口，不替代供应商上报的实际 Usage。 */
public interface TokenCounter {

    /** 估算一段文本包含的 Token 数。 */
    int count(String text);

    /** 返回估算算法标识，便于持久化数据解释与后续迁移。 */
    String id();
}
