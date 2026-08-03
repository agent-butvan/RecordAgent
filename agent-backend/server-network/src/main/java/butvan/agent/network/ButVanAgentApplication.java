package butvan.agent.network;


import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication(scanBasePackages = "butvan.agent")
public class ButVanAgentApplication {
    public static void main(String[] args) {
        SpringApplication.run(ButVanAgentApplication.class, args);
    }
}
