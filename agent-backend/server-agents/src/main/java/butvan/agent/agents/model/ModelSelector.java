package butvan.agent.agents.model;

public record ModelSelector(
        String vendor,
        String name,
        String apiKey,
        Double temperature,
        Boolean stream) {

    public static ModelSelector of(String vendor, String name, String apiKey) {
        return new ModelSelector(vendor, name, apiKey, 0.7, true);
    }
}
