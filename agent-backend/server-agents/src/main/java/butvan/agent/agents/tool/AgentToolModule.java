package butvan.agent.agents.tool;

/**
 * 可注册到 AgentScope Toolkit 的本地工具模块。
 *
 * <p>实现类由 Spring 发现，{@link ToolRegistry} 只依赖此稳定 seam，
 * 因而下游模块可以贡献业务工具而不造成 Maven 反向依赖。</p>
 */
public interface AgentToolModule {
}
