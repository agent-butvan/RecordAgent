import { useEffect, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { finishStudySession } from '../../services/studyApi';
import { useStudyRealtime } from '../../context/studyRealtimeState';
import { ActiveStudyCard } from './ActiveStudyCard';
import styles from './SystemStudyWindow.module.css';

/** Tauri 独立窗口入口，只承载当前学习状态与结束操作。 */
export function SystemStudyWindow() {
  const { activeSession: session, ready } = useStudyRealtime();
  const [now, setNow] = useState(Date.now());
  const [saving, setSaving] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);

  useEffect(() => {
    if (ready && !session) void getCurrentWindow().hide();
  }, [ready, session]);

  useEffect(() => {
    if (!session) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [session]);

  const finish = async () => {
    if (!session) return;
    setSaving(true);
    setFinishError(null);
    try {
      await finishStudySession(session.id, session.version);
      await getCurrentWindow().hide();
    } catch (cause) {
      setFinishError(cause instanceof Error ? cause.message : '结束学习失败，请重试。');
    } finally {
      setSaving(false);
    }
  };

  if (!session) return <div className={styles.loading}>{ready ? '当前没有进行中的学习' : '正在读取学习状态…'}</div>;
  const elapsed = Math.max(0, Math.floor((now - new Date(session.startedAt).getTime()) / 1_000));
  const windowHandle = getCurrentWindow();
  const startDragging = (event: ReactPointerEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest('button')) return;
    void windowHandle.startDragging();
  };
  return (
    <main className={styles.window} onPointerDown={startDragging}>
      <ActiveStudyCard
        session={session}
        elapsedSeconds={elapsed}
        compact
        draggable
        saving={saving}
        error={finishError}
        onFinish={() => void finish()}
        onHide={() => void windowHandle.hide()}
        onResizeStart={(event) => {
          event.stopPropagation();
          void windowHandle.startResizeDragging('SouthEast');
        }}
      />
    </main>
  );
}
