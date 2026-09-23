package butvan.agent.network.automation;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import java.time.Clock;

/** 为自动任务提供可替换时钟，测试无需真实等待。 */
@Configuration
public class AutomationConfiguration {
    @Bean
    public Clock automationClock() { return Clock.systemUTC(); }
}
