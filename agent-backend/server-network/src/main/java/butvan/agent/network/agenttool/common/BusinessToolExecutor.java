package butvan.agent.network.agenttool.common;

import butvan.agent.agents.tool.result.ToolResult;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.function.Supplier;

/** 统一执行业务写工具，并以用户、工具名和幂等键防止重复写入。 */
@Component
@RequiredArgsConstructor
public class BusinessToolExecutor {
    private static final int MAX_IDEMPOTENCY_KEY_LENGTH = 128;

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    /**
     * 在同一数据库事务内执行领域写入并保存结果；领域异常会整体回滚。
     */
    @Transactional
    public ToolResult<?> write(
            String ownerId,
            String toolName,
            String idempotencyKey,
            Supplier<ToolResult<?>> operation) {
        validate(ownerId, toolName, idempotencyKey);
        ToolResult<?> cached = find(ownerId, toolName, idempotencyKey);
        if (cached != null) return cached;

        int inserted = jdbcTemplate.update("""
                INSERT OR IGNORE INTO agent_tool_operation (
                    owner_id, tool_name, idempotency_key, result_json, created_at
                ) VALUES (?, ?, ?, NULL, ?)
                """, ownerId, toolName, idempotencyKey, Instant.now().toString());
        if (inserted != 1) {
            ToolResult<?> concurrentResult = find(ownerId, toolName, idempotencyKey);
            if (concurrentResult != null) return concurrentResult;
            throw new IllegalStateException("相同写操作正在执行，请稍后查询结果");
        }

        ToolResult<?> result = operation.get();
        jdbcTemplate.update("""
                UPDATE agent_tool_operation SET result_json = ?
                WHERE owner_id = ? AND tool_name = ? AND idempotency_key = ?
                """, serialize(result), ownerId, toolName, idempotencyKey);
        return result;
    }

    private ToolResult<?> find(String ownerId, String toolName, String idempotencyKey) {
        List<String> results = jdbcTemplate.query(
                "SELECT result_json FROM agent_tool_operation WHERE owner_id = ? AND tool_name = ? AND idempotency_key = ?",
                (resultSet, rowNumber) -> resultSet.getString("result_json"),
                ownerId, toolName, idempotencyKey);
        if (results.isEmpty() || results.getFirst() == null) return null;
        try {
            return objectMapper.readValue(results.getFirst(), ToolResult.class);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("历史工具结果无法读取", exception);
        }
    }

    private String serialize(ToolResult<?> result) {
        try {
            return objectMapper.writeValueAsString(result);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("工具结果无法保存", exception);
        }
    }

    private void validate(String ownerId, String toolName, String idempotencyKey) {
        if (ownerId == null || ownerId.isBlank()) throw new IllegalArgumentException("当前用户不能为空");
        if (toolName == null || toolName.isBlank()) throw new IllegalArgumentException("工具名称不能为空");
        if (idempotencyKey == null || idempotencyKey.isBlank()) throw new IllegalArgumentException("idempotencyKey 不能为空");
        if (idempotencyKey.length() > MAX_IDEMPOTENCY_KEY_LENGTH) {
            throw new IllegalArgumentException("idempotencyKey 长度不能超过 128 个字符");
        }
    }
}
