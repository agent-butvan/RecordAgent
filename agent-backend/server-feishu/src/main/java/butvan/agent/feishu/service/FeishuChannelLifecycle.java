package butvan.agent.feishu.service;

import butvan.agent.feishu.config.FeishuConfigData;
import butvan.agent.feishu.config.FeishuProperties;
import com.lark.oapi.channel.ChannelEventHandler;
import com.lark.oapi.channel.LarkChannel;
import com.lark.oapi.channel.LarkChannelFactory;
import com.lark.oapi.channel.config.LarkChannelOptions;
import com.lark.oapi.channel.model.BotIdentity;
import com.lark.oapi.channel.model.ChannelErrorEvent;
import com.lark.oapi.channel.model.NormalizedMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.SmartLifecycle;
import org.springframework.stereotype.Component;

import java.util.concurrent.TimeUnit;

/**
 * 飞书长连接生命周期管理。
 *
 * <p>应用启动后建立 WebSocket 长连接（无需公网回调地址），
 * 未配置或连接失败时只记录日志，不阻塞主应用启动。</p>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class FeishuChannelLifecycle implements SmartLifecycle {

    private static final long CONNECT_TIMEOUT_SECONDS = 30;
    private static final long DISCONNECT_TIMEOUT_SECONDS = 10;

    private final FeishuProperties feishuProperties;
    private final FeishuChatService feishuChatService;

    private volatile LarkChannel channel;
    private volatile boolean running;

    @Override
    public void start() {
        FeishuConfigData config = feishuProperties.load();
        if (!config.isReady()) {
            log.info("飞书机器人未启用：请在 ~/.butvan-agent/config.json 配置 feishu 节点（enabled=true、appId、appSecret）后重启");
            return;
        }

        LarkChannel built = LarkChannelFactory.createLarkChannel(
                LarkChannelOptions.newBuilder(config.appId(), config.appSecret())
                        .transport("websocket")
                        .build()
        );

        built.on("message", new ChannelEventHandler<NormalizedMessage>() {
            @Override
            public void handle(NormalizedMessage message) {
                feishuChatService.handle(built, message);
            }
        });
        built.on("error", (ChannelErrorEvent event) ->
                log.error("飞书长连接处理异常：event={}", event.getEventName(), event.getError()));
        built.on("reconnecting", (Object ignored) -> log.warn("飞书长连接正在重连..."));
        built.on("reconnected", (Object ignored) -> log.info("飞书长连接已恢复"));

        try {
            BotIdentity identity = built.connect().get(CONNECT_TIMEOUT_SECONDS, TimeUnit.SECONDS);
            this.channel = built;
            this.running = true;
            log.info("飞书机器人长连接已建立：botName={}, botOpenId={}", identity.getName(), identity.getOpenId());
        } catch (Exception e) {
            log.error("飞书机器人长连接建立失败，请检查 App ID/App Secret 及网络后重启", e);
        }
    }

    @Override
    public void stop() {
        LarkChannel current = channel;
        this.channel = null;
        this.running = false;
        if (current != null) {
            try {
                current.disconnect().get(DISCONNECT_TIMEOUT_SECONDS, TimeUnit.SECONDS);
                log.info("飞书长连接已关闭");
            } catch (Exception e) {
                log.warn("飞书长连接关闭失败", e);
            }
        }
    }

    @Override
    public boolean isRunning() {
        return running;
    }

    @Override
    public boolean isAutoStartup() {
        return true;
    }
}
