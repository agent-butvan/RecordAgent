package butvan.agent.agents.context;

import java.util.regex.Pattern;

/** 个人上下文共享的确定性敏感内容过滤规则。 */
final class PersonalContextSafety {

    private static final Pattern SENSITIVE_CONTENT = Pattern.compile(
            "(?i)(api[_ -]?key|access[_ -]?token|password|passwd|secret|密码|密钥|令牌|身份证|银行卡|账户余额|病历)");

    private PersonalContextSafety() {
    }

    static boolean containsSensitive(String content) {
        return content != null && SENSITIVE_CONTENT.matcher(content).find();
    }
}
