package butvan.agent.agents.session;

import butvan.agent.agents.model.ModelHolder;
import io.agentscope.core.message.ContentBlock;
import io.agentscope.core.message.SystemMessage;
import io.agentscope.core.message.TextBlock;
import io.agentscope.core.message.UserMessage;
import io.agentscope.core.model.ChatResponse;
import io.agentscope.core.model.GenerateOptions;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;

/** 使用当前激活模型生成会话标题的生产适配器。 */
@Component
@RequiredArgsConstructor
public class ModelConversationTitleGenerator implements ConversationTitleGenerator {

    private final ModelHolder modelHolder;

    @Override
    public String generate(String firstQuestion) {
        GenerateOptions options = GenerateOptions.builder()
                .stream(false)
                .temperature(0.2)
                .maxTokens(32)
                .build();
        List<ChatResponse> responses = modelHolder.getModel().stream(
                        List.of(
                                SystemMessage.builder().textContent(
                                        "你负责给聊天会话命名。请根据用户问题输出一个准确、简洁的中文标题，最多20个汉字；不要引号、句号、序号或解释。"
                                ).build(),
                                UserMessage.builder().textContent(firstQuestion).build()
                        ),
                        List.of(),
                        options
                )
                .collectList()
                .block();
        if (responses == null) return "";
        return responses.stream()
                .flatMap(response -> response.getContent() == null
                        ? java.util.stream.Stream.empty()
                        : response.getContent().stream())
                .filter(TextBlock.class::isInstance)
                .map(ContentBlock::toString)
                .reduce("", String::concat);
    }
}
