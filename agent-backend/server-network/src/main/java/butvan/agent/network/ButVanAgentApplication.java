package butvan.agent.network;

import butvan.agent.agents.agent.AgentService;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication(scanBasePackages = "butvan.agent")
public class ButVanAgentApplication implements CommandLineRunner {

    private final AgentService agentService;

    public ButVanAgentApplication(AgentService agentService) {
        this.agentService = agentService;
    }

    public static void main(String[] args) {
        SpringApplication.run(ButVanAgentApplication.class, args);
    }

    @Override
    public void run(String... args) throws Exception {
        agentService.runAgent();
    }
}
