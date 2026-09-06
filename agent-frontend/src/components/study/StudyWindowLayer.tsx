import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { getFeaturePreferences, subscribeFeaturePreferences } from '../../services/featurePreferences';
import { fetchActiveStudySession, finishStudySession } from '../../services/studyApi';
import { notifyStudySessionChanged, subscribeStudySessionChanges } from '../../services/studySessionEvents';
import { hideDesktopStudyWindow, showDesktopStudyWindow } from '../../services/studyWindow';
import type { StudyWindowMode } from '../../types/preferences';
import type { StudySession } from '../../types/study';
import { ActiveStudyCard } from './ActiveStudyCard';
import { useMessage } from '../common/Message';
import styles from './StudyWindowLayer.module.css';

const POSITION_KEY = 'butvan.studyWidgetPosition';
const WIDGET_WIDTH = 336;
const WIDGET_HEIGHT = 224;
const VIEWPORT_MARGIN = 18;

function defaultPosition() {
  return {
    x: Math.max(VIEWPORT_MARGIN, window.innerWidth - WIDGET_WIDTH - VIEWPORT_MARGIN),
    y: Math.max(VIEWPORT_MARGIN, window.innerHeight - WIDGET_HEIGHT - VIEWPORT_MARGIN),
  };
}

function readPosition() {
  try {
    const saved = JSON.parse(localStorage.getItem(POSITION_KEY) ?? '{}') as { x?: number; y?: number };
    if (Number.isFinite(saved.x) && Number.isFinite(saved.y)) return { x: saved.x!, y: saved.y! };
  } catch {
    // 使用右下角默认位置。
  }
  return defaultPosition();
}

function clampPosition(position: { x: number; y: number }) {
  return {
    x: Math.min(Math.max(VIEWPORT_MARGIN, position.x), Math.max(VIEWPORT_MARGIN, window.innerWidth - WIDGET_WIDTH - VIEWPORT_MARGIN)),
    y: Math.min(Math.max(VIEWPORT_MARGIN, position.y), Math.max(VIEWPORT_MARGIN, window.innerHeight - WIDGET_HEIGHT - VIEWPORT_MARGIN)),
  };
}

/** 主应用中的学习小窗协调层，负责模式切换、会话同步和应用内拖动。 */
export function StudyWindowLayer() {
  const { showMessage } = useMessage();
  const [mode, setMode] = useState<StudyWindowMode>(() => getFeaturePreferences().studyWindowMode);
  const [session, setSession] = useState<StudySession | null>(null);
  const [now, setNow] = useState(Date.now());
  const [saving, setSaving] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);
  const [hiddenSessionId, setHiddenSessionId] = useState<string | null>(null);
  const [position, setPosition] = useState(readPosition);
  const positionRef = useRef(position);
  positionRef.current = position;
  const dragRef = useRef<{ pointerId: number; offsetX: number; offsetY: number } | null>(null);
  const activeSessionId = session?.id;

  const reload = useCallback(() => {
    void fetchActiveStudySession().then((active) => {
      setSession(active);
      if (!active) setHiddenSessionId(null);
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    reload();
    const interval = window.setInterval(reload, 5_000);
    const unsubscribe = subscribeStudySessionChanges(reload);
    return () => {
      window.clearInterval(interval);
      unsubscribe();
    };
  }, [reload]);

  useEffect(() => subscribeFeaturePreferences((preferences) => setMode(preferences.studyWindowMode)), []);
  useEffect(() => {
    if (!session) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(interval);
  }, [session]);

  useEffect(() => {
    if (mode === 'desktop' && activeSessionId) {
      void showDesktopStudyWindow()
        .then((shown) => {
          if (!shown) showMessage('error', '系统学习小窗仅在桌面应用中可用。');
        })
        .catch((cause) => showMessage('error', cause instanceof Error ? cause.message : '系统学习小窗打开失败。'));
    } else {
      void hideDesktopStudyWindow().catch(() => undefined);
    }
  }, [mode, activeSessionId, showMessage]);

  useEffect(() => {
    const onResize = () => setPosition((current) => clampPosition(current));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('button')) return;
    dragRef.current = { pointerId: event.pointerId, offsetX: event.clientX - position.x, offsetY: event.clientY - position.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setPosition(clampPosition({ x: event.clientX - drag.offsetX, y: event.clientY - drag.offsetY }));
  };
  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    localStorage.setItem(POSITION_KEY, JSON.stringify(positionRef.current));
    event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const finish = async () => {
    if (!session) return;
    setSaving(true);
    setFinishError(null);
    try {
      await finishStudySession(session.id, session.version);
      setSession(null);
      notifyStudySessionChanged();
    } catch (cause) {
      setFinishError(cause instanceof Error ? cause.message : '结束学习失败，请重试。');
    } finally {
      setSaving(false);
    }
  };

  if (mode !== 'in-app' || !session || hiddenSessionId === session.id) return null;
  const elapsed = Math.max(0, Math.floor((now - new Date(session.startedAt).getTime()) / 1_000));
  return (
    <div
      className={styles.widget}
      style={{ transform: `translate3d(${position.x}px, ${position.y}px, 0)` }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <ActiveStudyCard
        session={session}
        elapsedSeconds={elapsed}
        compact
        draggable
        saving={saving}
        error={finishError}
        onFinish={() => void finish()}
        onHide={() => setHiddenSessionId(session.id)}
      />
    </div>
  );
}
