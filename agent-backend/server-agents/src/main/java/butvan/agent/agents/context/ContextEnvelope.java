package butvan.agent.agents.context;

import java.util.List;

/** 一次组装的只读上下文结果，由中间件临时注入 Model Call。 */
public record ContextEnvelope(String rendered, List<ContextBlock> blocks, int estimatedTokens) {

    public ContextEnvelope {
        rendered = rendered == null ? "" : rendered.strip();
        blocks = blocks == null ? List.of() : List.copyOf(blocks);
        estimatedTokens = Math.max(0, estimatedTokens);
    }

    public static ContextEnvelope empty() {
        return new ContextEnvelope("", List.of(), 0);
    }

    public boolean isEmpty() {
        return rendered.isBlank();
    }

}
