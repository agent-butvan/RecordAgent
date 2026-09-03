package butvan.agent.network.config.database;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

import java.nio.file.Path;

/** 本地 SQLite 数据库路径配置。 */
@Data
@ConfigurationProperties(prefix = "butvan.database")
public class LocalDatabaseProperties {

    /** 业务数据库文件；测试可通过属性覆盖，生产环境默认位于用户目录。 */
    private Path path = Path.of(System.getProperty("user.home"), ".butvan-agent", "data", "butvan.db");
}
