import { useCallback, useEffect, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { fetchActiveStudySession, finishStudySession } from '../../services/studyApi';
import { notifyStudySessionChanged } from '../../services/studySessionEvents';
import type { StudySession } from '../../types/study';
import { ActiveStudyCard } from './ActiveStudyCard';
import styles from './SystemStudyWindow.module.css';

/** Tauri 独立窗口入口，只承载当前学习状态与结束操作。 */
export function SystemStudyWindow() {
  const [session, setSession] = useState<StudySession | null>(null);
  const [now, setNow] = useState(Date.now());
  const [saving, setSaving] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);

  const reload = useCallback(() => {
    void fetchActiveStudySession().then(async (active) => {
      setSession(active);
      if (!active) await getCurrentWindow().hide();
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    reload();
    const poll = window.setInterval(reload, 3_000);
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => { window.clearInterval(poll); window.clearInterval(timer); };
  }, [reload]);

  const finish = async () => {
    if (!session) return;
    setSaving(true);
    setFinishError(null);
    try {
      await finishStudySession(session.id, session.version);
      notifyStudySessionChanged();
      await getCurrentWindow().hide();
    } catch (cause) {
      setFinishError(cause instanceof Error ? cause.message : '结束学习失败，请重试。');
    } finally {
      setSaving(false);
    }
  };

  if (!session) return <div className={styles.loading}>正在读取学习状态…</div>;
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
