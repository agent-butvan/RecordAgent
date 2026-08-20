package butvan.agent.feishu.service;

import butvan.agent.agents.model.ModelHolder;
import butvan.agent.agents.session.SessionCatalogService;
import butvan.agent.agents.session.dto.CreateSessionRequest;
import butvan.agent.agents.session.dto.SessionKind;
import butvan.agent.agents.session.dto.SessionSummaryDto;
import com.lark.oapi.channel.LarkChannel;
import com.lark.oapi.channel.model.NormalizedMessage;
import com.lark.oapi.channel.model.SendInput;
import com.lark.oapi.channel.model.SendOptions;
import com.lark.oapi.channel.model.SendResult;
import com.lark.oapi.channel.model.StreamInput;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

/**
 * 飞书消息处理服务：接收长连接推送的聊天消息，转交 Agent 处理后回复。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class FeishuChatService {

    private static final long SEND_TIMEOUT_SECONDS = 30;
    private static final long STREAM_TIMEOUT_SECONDS = 360;
    private static final int MAX_CARD_TEXT_LENGTH = 30_000;

    private final FeishuAgentRunner feishuAgentRunner;
    private final SessionCatalogService sessionCatalogService;
    private final ModelHolder modelHolder;

    /** 飞书发送者 open_id 到应用会话 ID 的映射，同一用户始终回到同一会话。 */
    private final ConcurrentHashMap<String, String> sessionBySender = new ConcurrentHashMap<>();

    /**
     * 处理一条飞书消息（在虚拟线程中执行，避免阻塞长连接分发线程）。
     *
     * @param channel 已建立的长连接
     * @param message 归一化后的飞书消息
     */
    public void handle(LarkChannel channel, NormalizedMessage message) {
        Thread.startVirtualThread(() -> {
            try {
                handleInternal(channel, message);
            } catch (Exception e) {
                log.error("飞书消息处理异常：chatId={}, senderId={}, messageId={}",
                        message.getChatId(), message.getSenderId(), message.getMessageId(), e);
                replyQuietly(channel, message, "处理消息时发生错误，请稍后重试");
            }
        });
    }

    private void handleInternal(LarkChannel channel, NormalizedMessage message) {
        // 只记录元信息，不记录消息正文，便于排查事件是否送达
        log.info("收到飞书消息：chatId={}, senderId={}, messageId={}, 类型={}, 内容长度={}",
                message.getChatId(), message.getSenderId(), message.getMessageId(),
                message.getRawContentType(),
                message.getContent() == null ? 0 : message.getContent().length());

        // 忽略机器人自己发出的消息，防止回声死循环
        if (channel.getBotIdentity() != null
                && channel.getBotIdentity().getOpenId().equals(message.getSenderId())) {
            return;
        }

        String rawType = message.getRawContentType();
        if (rawType != null && !rawType.isBlank() && !"text".equalsIgnoreCase(rawType)) {
            replyQuietly(channel, message, "目前只支持文本消息");
            return;
        }

        String content = message.getContent();
        if (content == null || content.isBlank()) {
            return;
        }

        if (!modelHolder.isInitialized()) {
            replyQuietly(channel, message, "模型尚未配置，请先在 ButvanAgent 桌面端完成模型初始化");
            return;
        }

        String sessionId = sessionBySender.computeIfAbsent(message.getSenderId(), senderId -> {
            SessionSummaryDto created = sessionCatalogService.create(
                    new CreateSessionRequest(SessionKind.GENERAL, safeTitle(message.getSenderName())));
            return created.id();
        });

        streamReply(channel, message, sessionId, content);
    }

    /** 飞书流式回复：先发「正在思考…」卡片，Agent 输出过程中原地更新内容。 */
    private void streamReply(LarkChannel channel, NormalizedMessage message, String sessionId, String input) {
        String botName = channel.getBotIdentity() != null && channel.getBotIdentity().getName() != null
                ? channel.getBotIdentity().getName()
                : "助手";
        try {
            channel.stream(message.getChatId(),
                    StreamInput.card(buildStreamingCard("正在思考…", botName), controller -> {
                        StringBuilder accumulated = new StringBuilder();
                        FeishuAgentRunner.AgentReply reply = feishuAgentRunner.runAndCollect(sessionId, input, delta -> {
                            accumulated.append(delta);
                            controller.update(buildStreamingCard(accumulated.toString(), botName));
                        });
                        String finalText = switch (reply.kind()) {
                            case OK -> accumulated.toString();
                            case FAILED -> reply.text();
                        };
                        controller.update(buildStreamingCard(finalText, botName));
                    }),
                    SendOptions.newBuilder().replyTo(message.getMessageId()).build())
                    .get(STREAM_TIMEOUT_SECONDS, TimeUnit.SECONDS);
            log.info("飞书流式回复完成：chatId={}, 原消息Id={}", message.getChatId(), message.getMessageId());
        } catch (Exception e) {
            log.error("飞书流式回复失败：chatId={}, 原消息Id={}", message.getChatId(), message.getMessageId(), e);
            replyQuietly(channel, message, "处理消息时发生错误，请稍后重试");
        }
    }

    /** 构建流式交互卡片；内容超长时截断，避免超过飞书消息大小限制。 */
    private static Map<String, Object> buildStreamingCard(String content, String botName) {
        String text = content == null ? "" : content;
        boolean truncated = false;
        if (text.length() > MAX_CARD_TEXT_LENGTH) {
            text = text.substring(0, MAX_CARD_TEXT_LENGTH);
            truncated = true;
        }
        String display = text.isEmpty() ? "…" : text;
        if (truncated) {
            display = display + "\n\n（内容过长，已截断）";
        }

        Map<String, Object> card = new LinkedHashMap<>();
        card.put("schema", "2.0");
        card.put("config", Map.of("update_multi", true));
        card.put("header", Map.of(
                "title", Map.of("tag", "plain_text", "content", botName),
                "template", "blue"));
        card.put("body", Map.of("elements", List.of(
                Map.of("tag", "markdown", "content", display))));
        return card;
    }

    /** 回复失败时兜底为发送新消息，避免用户等待无结果。 */
    private void replyQuietly(LarkChannel channel, NormalizedMessage message, String text) {
        SendInput input = SendInput.text(text);
        try {
            SendResult result = channel.send(message.getChatId(), input,
                    SendOptions.newBuilder().replyTo(message.getMessageId()).build())
                    .get(SEND_TIMEOUT_SECONDS, TimeUnit.SECONDS);
            log.info("飞书回复成功：chatId={}, 回复消息Id={}, 内容长度={}",
                    message.getChatId(), result.getMessageId(), text.length());
        } catch (Exception e) {
            try {
                SendResult fallback = channel.send(message.getChatId(), input)
                        .get(SEND_TIMEOUT_SECONDS, TimeUnit.SECONDS);
                log.warn("飞书回复失败后已改发新消息：chatId={}, 新消息Id={}",
                        message.getChatId(), fallback.getMessageId());
            } catch (Exception fallbackError) {
                log.error("飞书回复彻底失败：chatId={}, 原消息Id={}",
                        message.getChatId(), message.getMessageId(), fallbackError);
            }
        }
    }

    private String safeTitle(String senderName) {
        String name = senderName == null || senderName.isBlank() ? "用户" : senderName.trim();
        return name.length() > 20 ? name.substring(0, 20) : name;
    }
}
