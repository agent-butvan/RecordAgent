package butvan.agent.agents.session;

import butvan.agent.agents.identity.CurrentUserProvider;
import butvan.agent.agents.session.dto.CreateSessionRequest;
import butvan.agent.agents.session.dto.SessionDetailDto;
import butvan.agent.agents.session.dto.SessionSummaryDto;
import io.agentscope.core.state.AgentStateStore;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * 会话生命周期协调服务。
 *
 * <p>Controller 只调用本类；本类按固定顺序协调目录册、消息投影和 AgentScope 状态，
 * 使删除动作可理解且不污染 Controller。</p>
 */
@Service
@RequiredArgsConstructor
public class SessionLifecycleService {

    private final SessionCatalogService sessionCatalogService;
    private final TranscriptService transcriptService;
    private final CurrentUserProvider currentUserProvider;
    private final AgentStateStore agentStateStore;


    public List<SessionSummaryDto> listSessions() {
        return sessionCatalogService.listActive();
    }

    public SessionSummaryDto createSession(CreateSessionRequest request) {
        return sessionCatalogService.create(request);
    }

    public SessionDetailDto getDetail(String sessionId) {
        SessionSummaryDto summary = sessionCatalogService.requireActive(sessionId);
        return new SessionDetailDto(summary, transcriptService.list(sessionId));
    }

    public SessionSummaryDto updateTitle(String sessionId, String title) {
        return sessionCatalogService.updateTitle(sessionId, title);
    }

    /**
     * 删除顺序必须固定：先阻止新请求，在删除应用消息，随后删除AgentState，最后一出目录册
     * @param sessionId
     */
    public void deleteSession(String sessionId) {
        sessionCatalogService.markDeleting(sessionId);
        transcriptService.delete(sessionId);

        agentStateStore.delete(currentUserProvider.currentUserId(), sessionId);
        sessionCatalogService.remove(sessionId);
    }
}
