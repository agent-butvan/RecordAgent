package butvan.agent.network.daily;

import butvan.agent.network.record.repository.RecordRepository;
import butvan.agent.network.record.service.RecordJournalProjectionService;
import butvan.agent.network.record.service.RecordTabService;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;

/** 日记录模块装配入口。 */
@Configuration
@ComponentScan(basePackages = "butvan.agent.network.daily")
@Import({RecordRepository.class, RecordJournalProjectionService.class, RecordTabService.class})
public class DailyEventModuleConfiguration {
}
