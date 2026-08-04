package butvan.agent.network;

import butvan.agent.agents.agent.AgentService;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Agent 后端应用启动类
 */
@RequiredArgsConstructor
@SpringBootApplication(scanBasePackages = "butvan.agent")
public class ButVanAgentApplication implements CommandLineRunner {

    /**
     * 注入 AgentService 依赖
     */
    private final AgentService agentService;

    /**
     * 应用启动主入口
     *
     * @param args 启动命令行参数
     */
    public static void main(String[] args) {
        SpringApplication.run(ButVanAgentApplication.class, args);
    }

    /**
     * 容器启动完成后调用的初始化执行方法
     *
     * @param args 命令行参数
     * @throws Exception 异常情况
     */
    @Override
    public void run(String... args) throws Exception {
        //agentService.runAgent();
    }
}
