package butvan.agent.agents.prompts;

/**
 *
 * @param name 模块标识名称
 * @param priority 优先级  ，越小越靠前
 * @param content 模块的具体内容
 */
public record PromptSection(String name, int priority, String content) {
}
