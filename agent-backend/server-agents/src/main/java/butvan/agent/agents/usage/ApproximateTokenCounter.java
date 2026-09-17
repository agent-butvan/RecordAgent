package butvan.agent.agents.usage;

import org.springframework.stereotype.Component;

/**
 * 无网络依赖的保守 Token 估算器。
 *
 * <p>当前模型配置允许任意供应商与模型名，AgentScope 2.0.0 又未暴露统一 tokenizer，
 * 因而先按每个非 ASCII code point 一个 Token、每四个 ASCII 字符一个 Token 估算。
 * 该结果只用于解释输入构成，计费总量始终以 Provider Usage 为准。</p>
 */
@Component
public class ApproximateTokenCounter implements TokenCounter {

    private static final String COUNTER_ID = "approximate-v1";

    @Override
    public int count(String text) {
        if (text == null || text.isEmpty()) return 0;
        int asciiCharacters = 0;
        int nonAsciiCodePoints = 0;
        for (int offset = 0; offset < text.length();) {
            int codePoint = text.codePointAt(offset);
            if (codePoint <= 0x7F) asciiCharacters++;
            else nonAsciiCodePoints++;
            offset += Character.charCount(codePoint);
        }
        return nonAsciiCodePoints + (asciiCharacters + 3) / 4;
    }

    @Override
    public String id() {
        return COUNTER_ID;
    }
}
