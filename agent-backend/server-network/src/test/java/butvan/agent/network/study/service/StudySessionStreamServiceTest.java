package butvan.agent.network.study.service;

import butvan.agent.network.study.event.StudySessionChangedEvent;
import butvan.agent.network.study.model.StudyModels.StudySession;
import org.junit.jupiter.api.Test;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
/** 验证学习状态实时流的订阅隔离、状态读取和停机清理。 */
class StudySessionStreamServiceTest {

    @Test
    void subscribesWithSnapshotAndReadsFreshStateAfterChange() {
        StubStudyService studyService = new StubStudyService();
        StudySessionStreamService service = new StudySessionStreamService(studyService);

        SseEmitter emitter = service.subscribe("owner-a");
        service.onStudySessionChanged(new StudySessionChangedEvent(
                "owner-a", "study-1", StudySessionChangedEvent.ChangeType.STARTED));

        assertEquals(1, service.subscriberCount());
        assertEquals(2, studyService.readCount);
        emitter.complete();
    }

    @Test
    void closesInfiniteStreamsWhenApplicationContextIsClosing() throws Exception {
        StudyService studyService = new StubStudyService();
        StudySessionStreamService service = new StudySessionStreamService(studyService);
        SseEmitter emitter = service.subscribe("owner-a");

        service.onApplicationContextClosed();

        assertEquals(0, service.subscriberCount());
        assertThrows(IllegalStateException.class,
                () -> emitter.send(SseEmitter.event().name("changed").data("late-event")));
        SseEmitter lateEmitter = service.subscribe("owner-a");
        assertEquals(0, service.subscriberCount());
        assertThrows(IllegalStateException.class,
                () -> lateEmitter.send(SseEmitter.event().name("changed").data("late-event")));
    }

    @Test
    void removesSubscriberWhenInitialSnapshotCannotBeRead() {
        StubStudyService studyService = new StubStudyService();
        studyService.failReads = true;
        StudySessionStreamService service = new StudySessionStreamService(studyService);

        assertThrows(IllegalStateException.class, () -> service.subscribe("owner-a"));
        assertEquals(0, service.subscriberCount());
    }

    @Test
    void notificationFailureDoesNotTurnCommittedWriteIntoFailure() {
        StubStudyService studyService = new StubStudyService();
        StudySessionStreamService service = new StudySessionStreamService(studyService);
        service.subscribe("owner-a");
        studyService.failReads = true;

        assertDoesNotThrow(() -> service.onStudySessionChanged(new StudySessionChangedEvent(
                "owner-a", "study-1", StudySessionChangedEvent.ChangeType.FINISHED)));
    }

    /** 只覆盖实时流所依赖的读取 seam，避免测试依赖字节码代理。 */
    private static final class StubStudyService extends StudyService {
        private int readCount;
        private boolean failReads;

        private StubStudyService() {
            super(null, null, null, event -> { });
        }

        @Override
        public StudySession getActive(String ownerId) {
            readCount++;
            if (failReads) throw new IllegalStateException("read failed");
            return null;
        }
    }
}
