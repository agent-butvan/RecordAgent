package butvan.agent.agents.agent;

import io.agentscope.core.ReActAgent;
import io.agentscope.core.message.Msg;
import io.agentscope.core.message.MsgRole;
import io.agentscope.core.model.Model;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class AgentService {

    private static final Logger log = LoggerFactory.getLogger(AgentService.class);

    private final Model model;

    public void runAgent() {
        ReActAgent agent = ReActAgent.builder().model(model).build();

        Msg msg = agent.call(
                Msg.builder()
                        .role(MsgRole.USER)
                        .textContent("你好，你是什么模型？")
                        .build()
        ).block();

        log.info("agent say: [{}]", msg.getTextContent());
    }
}
