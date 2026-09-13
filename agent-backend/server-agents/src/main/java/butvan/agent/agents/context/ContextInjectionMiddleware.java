package butvan.agent.agents.context;

import butvan.agent.agents.usage.TokenUsageRoundContext;
import io.agentscope.core.agent.Agent;
import io.agentscope.core.agent.RuntimeContext;
import io.agentscope.core.event.AgentEvent;
import io.agentscope.core.message.Msg;
import io.agentscope.core.message.MsgRole;
import io.agentscope.core.message.UserMessage;
import io.agentscope.core.middleware.MiddlewareBase;
import io.agentscope.core.middleware.ModelCallInput;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Flux;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.Function;

/** 在真实 Model Call 前临时注入已组装上下文，不修改 AgentState 中的消息。 */
@Component
public class ContextInjectionMiddleware implements MiddlewareBase {

    public static final String CONTEXT_METADATA_KEY = "butvan_managed_context";

    @Override
    public Flux<AgentEvent> onModelCall(
            Agent agent,
            RuntimeContext context,
            ModelCallInput input,
            Function<ModelCallInput, Flux<AgentEvent>> next
    ) {
        ContextEnvelope envelope = context == null ? null : context.get(ContextEnvelope.class);
        if (envelope == null || envelope.isEmpty() || input == null || input.messages() == null) {
            return next.apply(input);
        }

        int currentUserIndex = findCurrentUser(input.messages(), context.get(TokenUsageRoundContext.class));
        if (currentUserIndex < 0) return next.apply(input);

        List<Msg> messages = new ArrayList<>(input.messages());
        messages.add(currentUserIndex, UserMessage.builder()
                .name("managed_context")
                .textContent(envelope.rendered())
                .metadata(Map.of(
                        Msg.METADATA_SYNTHETIC, true,
                        Msg.METADATA_REMINDER_KIND, CONTEXT_METADATA_KEY,
                        CONTEXT_METADATA_KEY, true))
                .build());
        return next.apply(new ModelCallInput(messages, input.tools(), input.options(), input.model()));
    }

    private int findCurrentUser(List<Msg> messages, TokenUsageRoundContext round) {
        if (round == null) return -1;
        for (int index = 0; index < messages.size(); index++) {
            Msg message = messages.get(index);
            if (message == null || message.getRole() != MsgRole.USER || message.getMetadata() == null) continue;
            if (round.turnId().equals(
                    message.getMetadata().get(TokenUsageRoundContext.TURN_METADATA_KEY))) return index;
        }
        return -1;
    }
}
