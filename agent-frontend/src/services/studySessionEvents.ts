import { emit, listen } from '@tauri-apps/api/event';

export const STUDY_SESSION_CHANGED_EVENT = 'butvan:study-session-changed';

export function notifyStudySessionChanged(): void {
  if ('__TAURI_INTERNALS__' in window) {
    void emit(STUDY_SESSION_CHANGED_EVENT);
  } else {
    window.dispatchEvent(new Event(STUDY_SESSION_CHANGED_EVENT));
  }
}

/** 同时监听当前 WebView 和其它 Tauri 窗口发出的学习状态变化。 */
export function subscribeStudySessionChanges(listener: () => void): () => void {
  let disposed = false;
  let unlistenTauri: (() => void) | undefined;
  window.addEventListener(STUDY_SESSION_CHANGED_EVENT, listener);
  if ('__TAURI_INTERNALS__' in window) {
    void listen(STUDY_SESSION_CHANGED_EVENT, listener)
      .then((unlisten) => {
        if (disposed) unlisten();
        else unlistenTauri = unlisten;
      });
  }
  return () => {
    disposed = true;
    window.removeEventListener(STUDY_SESSION_CHANGED_EVENT, listener);
    unlistenTauri?.();
  };
}
