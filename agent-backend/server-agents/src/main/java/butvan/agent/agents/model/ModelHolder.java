package butvan.agent.agents.model;

import io.agentscope.core.model.Model;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.concurrent.atomic.AtomicReference;

@Component
public class ModelHolder {

    private static final Logger log = LoggerFactory.getLogger(ModelHolder.class);

    private final AtomicReference<Model> currentModel = new AtomicReference<>();

    private volatile ModelSelector currentSelector;

    public void updateModel(ModelSelector selector) {
        if (selector == null) {
            throw new IllegalArgumentException("ModelSelector cannot be null");
        }
        Model newModel = ModelFactory.create(selector);
        this.currentModel.set(newModel);
        this.currentSelector = selector;
        log.info("ModelHolder updated with new model: Vendor=[{}], Name=[{}]", selector.vendor(), selector.name());
    }

    public Model getModel() {
        Model model = currentModel.get();
        if (model == null) {
            throw new IllegalStateException("Model has not been initialized in ModelHolder");
        }
        return model;
    }

    public ModelSelector getCurrentSelector() {
        return currentSelector;
    }
}
