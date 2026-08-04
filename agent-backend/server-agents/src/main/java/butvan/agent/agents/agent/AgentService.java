package butvan.agent.agents.agent;

import butvan.agent.agents.model.ModelHolder;
import io.agentscope.core.ReActAgent;
import io.agentscope.core.message.Msg;
import io.agentscope.core.message.MsgRole;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

@Component
public class AgentService {

    private static final Logger log = LoggerFactory.getLogger(AgentService.class);

    private final ModelHolder modelHolder;

    public AgentService(ModelHolder modelHolder) {
        this.modelHolder = modelHolder;
    }

    public void runAgent() {
        ReActAgent agent = ReActAgent.builder().model(modelHolder.getModel()).build();

        Msg msg = agent.call(
                Msg.builder()
                        .role(MsgRole.USER)
                        .textContent("你好，你是什么模型？")
                        .build())
                .block();

        log.info("agent say: [{}]", msg.getTextContent());
    }
}
