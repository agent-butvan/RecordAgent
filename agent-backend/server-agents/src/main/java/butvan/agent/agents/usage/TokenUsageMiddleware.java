package butvan.agent.agents.usage;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.agentscope.core.agent.Agent;
import io.agentscope.core.agent.RuntimeContext;
import io.agentscope.core.event.AgentEvent;
import io.agentscope.core.event.ModelCallEndEvent;
import io.agentscope.core.event.ModelCallStartEvent;
import io.agentscope.core.message.ContentBlock;
import io.agentscope.core.message.Msg;
import io.agentscope.core.message.MsgRole;
import io.agentscope.core.message.ToolResultBlock;
import io.agentscope.core.message.TextBlock;
import io.agentscope.core.message.ThinkingBlock;
import io.agentscope.core.middleware.MiddlewareBase;
import io.agentscope.core.middleware.ModelCallInput;
import io.agentscope.core.model.ToolSchema;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Flux;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Function;

/** 在每次真实 Model Call 前后采集可解释输入和 Provider Usage。 */
@Slf4j
@Component
@RequiredArgsConstructor
public class TokenUsageMiddleware implements MiddlewareBase {

    private static final int MAX_SCHEMA_CACHE_ENTRIES = 512;

    private final TokenCounter tokenCounter;
    private final ObjectMapper objectMapper;
    private final Map<String, Integer> schemaTokenCache = new ConcurrentHashMap<>();

    @Override
    public Flux<AgentEvent> onModelCall(
            Agent agent,
            RuntimeContext context,
            ModelCallInput input,
            Function<ModelCallInput, Flux<AgentEvent>> next
    ) {
        TurnUsageAccumulator accumulator = context == null
                ? null : context.get(TurnUsageAccumulator.class);
        TokenUsageRoundContext round = context == null
                ? null : context.get(TokenUsageRoundContext.class);
        if (accumulator == null || round == null) return next.apply(input);

        ModelInputEstimate estimate = safelyEstimate(input, round);
        return next.apply(input).doOnNext(event -> {
            try {
                if (event instanceof ModelCallStartEvent start) {
                    accumulator.recordInput(start.getReplyId(), estimate);
                }
                if (event instanceof ModelCallStartEvent || event instanceof ModelCallEndEvent) {
                    accumulator.record(event, modelIdentity(input), UsagePurpose.CHAT);
                }
                if (event instanceof ModelCallEndEvent end && log.isDebugEnabled()) {
                    logUsage(context, round, accumulator, end.getReplyId());
                }
            } catch (RuntimeException exception) {
                log.warn("Token Usage 事件采集失败：sessionId={}", context.getSessionId(), exception);
            }
        });
    }

    private ModelInputEstimate safelyEstimate(ModelCallInput input, TokenUsageRoundContext round) {
        try {
            return estimate(input, round);
        } catch (RuntimeException exception) {
            log.warn("Token Usage 输入分类失败：turnId={}", round.turnId(), exception);
            return new ModelInputEstimate(tokenCounter.id(), InputTokenBreakdown.empty(), List.of());
        }
    }

    private ModelInputEstimate estimate(ModelCallInput input, TokenUsageRoundContext round) {
        List<Msg> messages = input == null || input.messages() == null ? List.of() : input.messages();
        int currentUserIndex = findCurrentUser(messages, round.turnId());
        long system = 0;
        long history = 0;
        long currentUser = 0;
        long toolResult = 0;
        long ragContext = 0;
        Map<String, ToolTokenUsage> tools = new LinkedHashMap<>();

        for (int index = 0; index < messages.size(); index++) {
            Msg message = messages.get(index);
            if (message == null) continue;
            if (message.getRole() == MsgRole.SYSTEM) {
                system += countBlocks(message.getContent());
                continue;
            }
            if (message.getRole() == MsgRole.TOOL) {
                for (ContentBlock block : message.getContent()) {
                    if (!(block instanceof ToolResultBlock result)) continue;
                    long resultTokens = countBlocks(result.getOutput());
                    toolResult += resultTokens;
                    String toolName = normalizeToolName(result.getName());
                    tools.merge(toolName, new ToolTokenUsage(toolName, 0, resultTokens),
                            ToolTokenUsage::plus);
                }
                continue;
            }
            if (index == currentUserIndex) {
                long messageTokens = countBlocks(message.getContent());
                long referencedTokens = round.ragContexts().stream()
                        .mapToLong(tokenCounter::count).sum();
                long attributedRagTokens = Math.min(messageTokens, referencedTokens);
                ragContext += attributedRagTokens;
                currentUser += messageTokens - attributedRagTokens;
            } else if (currentUserIndex >= 0 && index < currentUserIndex
                    && (message.getRole() == MsgRole.USER || message.getRole() == MsgRole.ASSISTANT)) {
                history += countBlocks(message.getContent());
            }
        }

        long toolSchema = 0;
        List<ToolSchema> schemas = input == null || input.tools() == null ? List.of() : input.tools();
        for (ToolSchema schema : schemas) {
            if (schema == null) continue;
            int schemaTokens = countSchema(schema);
            toolSchema += schemaTokens;
            String toolName = normalizeToolName(schema.getName());
            tools.merge(toolName, new ToolTokenUsage(toolName, schemaTokens, 0), ToolTokenUsage::plus);
        }

        InputTokenBreakdown breakdown = new InputTokenBreakdown(
                system, history, currentUser, toolSchema, toolResult, ragContext, 0);
        return new ModelInputEstimate(tokenCounter.id(), breakdown, List.copyOf(tools.values()));
    }

    private int findCurrentUser(List<Msg> messages, String turnId) {
        for (int index = 0; index < messages.size(); index++) {
            Msg message = messages.get(index);
            if (message == null || message.getRole() != MsgRole.USER || message.getMetadata() == null) continue;
            if (turnId.equals(message.getMetadata().get(TokenUsageRoundContext.TURN_METADATA_KEY))) return index;
        }
        return -1;
    }

    private int countSchema(ToolSchema schema) {
        Map<String, Object> normalized = new LinkedHashMap<>();
        normalized.put("name", schema.getName());
        normalized.put("description", schema.getDescription());
        normalized.put("parameters", schema.getParameters());
        if (schema.getOutputSchema() != null) normalized.put("outputSchema", schema.getOutputSchema());
        if (schema.getStrict() != null) normalized.put("strict", schema.getStrict());
        String serialized = serialize(normalized);
        String cacheKey = tokenCounter.id() + "\u0000" + serialized;
        if (schemaTokenCache.size() >= MAX_SCHEMA_CACHE_ENTRIES
                && !schemaTokenCache.containsKey(cacheKey)) {
            schemaTokenCache.clear();
        }
        return schemaTokenCache.computeIfAbsent(cacheKey, ignored -> tokenCounter.count(serialized));
    }

    private int countJson(Object value) {
        return tokenCounter.count(serialize(value));
    }

    private long countBlocks(List<ContentBlock> blocks) {
        if (blocks == null) return 0;
        long total = 0;
        for (ContentBlock block : blocks) {
            if (block instanceof TextBlock text) total += tokenCounter.count(text.getText());
            else if (block instanceof ThinkingBlock thinking) total += tokenCounter.count(thinking.getThinking());
            else total += countJson(block);
        }
        return total;
    }

    private String serialize(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException exception) {
            return String.valueOf(value);
        }
    }

    private ModelIdentity modelIdentity(ModelCallInput input) {
        return new ModelIdentity(null,
                input == null || input.model() == null ? null : input.model().getModelName());
    }

    private String normalizeToolName(String value) {
        return value == null || value.isBlank() ? "unknown-tool" : value.strip();
    }

    private void logUsage(
            RuntimeContext context,
            TokenUsageRoundContext round,
            TurnUsageAccumulator accumulator,
            String invocationId
    ) {
        ModelInvocationUsage usage = accumulator.snapshot().calls().stream()
                .filter(call -> invocationId.equals(call.invocationId()))
                .findFirst().orElse(null);
        if (usage == null) return;
        InputTokenBreakdown value = usage.breakdown();
        String toolLines = usage.toolUsages().stream()
                .map(tool -> "%s schema=%d result=%d".formatted(
                        tool.toolName(), tool.schemaTokens(), tool.resultTokens()))
                .reduce((left, right) -> left + System.lineSeparator() + right)
                .orElse("none");
        log.debug("""
                ========== TOKEN USAGE ==========
                Conversation: {}
                Round: {}
                Model Call: #{} ({})
                Model: {}
                System Prompt: {}
                History: {}
                Current User: {}
                Tool Schema: {}
                Tool Result: {}
                RAG Context: {}
                Estimated Input: {}
                Actual Input: {}
                Other / Protocol: {}
                Output: {}
                Total: {}
                Duration: {} ms
                Tools:
                {}
                =================================
                """,
                context.getSessionId(), round.turnId(), usage.modelCallIndex(), usage.invocationId(),
                usage.model(), value.systemPromptTokens(), value.historyTokens(),
                value.currentUserTokens(), value.toolSchemaTokens(), value.toolResultTokens(),
                value.ragContextTokens(), usage.estimatedInputTokens(), usage.inputTokens(),
                value.otherTokens(), usage.outputTokens(), usage.totalTokens(),
                usage.durationMillis(), toolLines);
    }
}
