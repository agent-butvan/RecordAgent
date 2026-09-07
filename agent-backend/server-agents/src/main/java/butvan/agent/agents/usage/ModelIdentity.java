package butvan.agent.agents.usage;

/** 一次模型调用使用的供应商与模型快照。 */
public record ModelIdentity(String vendor, String model) {

    public ModelIdentity {
        vendor = normalize(vendor, "unknown-vendor");
        model = normalize(model, "unknown-model");
    }

    private static String normalize(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.strip();
    }
}
