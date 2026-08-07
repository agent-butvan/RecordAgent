package butvan.agent.agents.session;

import butvan.agent.agents.agent.AgentStreamEvent;

import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * 单次 Agent 流式会话的运行状态。
 *
 * <p>会话持有生产者与 SSE 消费者之间的有界队列，并统一管理客户端断开后的取消动作。</p>
 */
public final class AgentStreamSession {

    /**
     * 队列是生产者和消费者之间的缓冲区
     * 最多缓存 64 条事件。
     */
    private final BlockingQueue<AgentStreamEvent> queue = new LinkedBlockingQueue<>(64);

    /**
     * 客户端断开时设为 {@code true}，让生产者主动结束工作。
     */
    private final AtomicBoolean cancelled = new AtomicBoolean(false);

    /**
     * 保存生产者虚拟线程。
     */
    private volatile Thread producerThread;

    /**
     * 获取供 Controller 消费的流事件队列。
     *
     * @return 流事件队列
     */
    public BlockingQueue<AgentStreamEvent> queue() {
        return queue;
    }

    /**
     * 绑定本会话的 Agent 事件生产线程。
     *
     * @param producerThread 生产线程
     */
    public void bindProducer(Thread producerThread) {
        this.producerThread = producerThread;
    }

    /**
     * 判断当前会话是否已取消。
     *
     * @return 已取消时返回 {@code true}
     */
    public boolean isCancelled() {
        return cancelled.get();
    }

    /**
     * 取消会话并中断仍在运行的生产线程。
     */
    public void cancel() {
        // 先设置标识，即使线程还未启动，也能在启动后看到取消状态
        cancelled.set(true);
        if (producerThread != null) {
            // 如果线程正卡在 queue.put() 或等待模型流，interrupt 让它尽快醒来。
            producerThread.interrupt();
        }
    }
}
