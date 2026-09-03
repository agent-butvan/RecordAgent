package butvan.agent.network.config.database;

import org.flywaydb.core.Flyway;
import org.sqlite.SQLiteConfig;
import org.sqlite.SQLiteDataSource;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.EnableTransactionManagement;

import javax.sql.DataSource;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

/** 统一创建本地 SQLite 数据源、迁移器和事务管理器。 */
@Configuration
@EnableTransactionManagement
@EnableConfigurationProperties(LocalDatabaseProperties.class)
public class LocalDatabaseConfiguration {

    /** 创建启用外键、WAL 和锁等待的 SQLite 数据源。 */
    @Bean
    public DataSource localDataSource(LocalDatabaseProperties properties) {
        Path databasePath = properties.getPath().toAbsolutePath().normalize();
        Path parent = databasePath.getParent();
        if (parent == null) {
            throw new IllegalStateException("SQLite 数据库路径必须包含父目录");
        }
        try {
            Files.createDirectories(parent);
        } catch (IOException exception) {
            throw new IllegalStateException("无法创建本地数据库目录: " + parent, exception);
        }

        SQLiteConfig config = new SQLiteConfig();
        config.enforceForeignKeys(true);
        config.setJournalMode(SQLiteConfig.JournalMode.WAL);
        config.setSynchronous(SQLiteConfig.SynchronousMode.NORMAL);
        config.setBusyTimeout(5_000);

        SQLiteDataSource dataSource = new SQLiteDataSource(config);
        dataSource.setUrl("jdbc:sqlite:" + databasePath);
        return dataSource;
    }

    /** 应用启动时执行版本化 SQL 迁移，失败时阻止服务启动。 */
    @Bean(initMethod = "migrate")
    public Flyway flyway(DataSource localDataSource) {
        return Flyway.configure()
                .dataSource(localDataSource)
                .locations("classpath:db/migration")
                .load();
    }

    /** 提供参数化 SQL 访问入口。 */
    @Bean
    public JdbcTemplate jdbcTemplate(DataSource localDataSource) {
        return new JdbcTemplate(localDataSource);
    }

    /** 提供批量按 ID 查询所需的命名参数 SQL 入口。 */
    @Bean
    public NamedParameterJdbcTemplate namedParameterJdbcTemplate(DataSource localDataSource) {
        return new NamedParameterJdbcTemplate(localDataSource);
    }

    /** 保证核心日记录与类型详情在同一事务内提交。 */
    @Bean
    public PlatformTransactionManager transactionManager(DataSource localDataSource) {
        return new DataSourceTransactionManager(localDataSource);
    }
}
