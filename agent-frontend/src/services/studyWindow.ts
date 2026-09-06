import { primaryMonitor } from '@tauri-apps/api/window';

const STUDY_WINDOW_LABEL = 'study-widget';

function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/** 显示系统级学习小窗；浏览器开发环境会安全忽略该请求。 */
export async function showDesktopStudyWindow(): Promise<boolean> {
  if (!isTauriRuntime()) return false;
  const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
  const existing = await WebviewWindow.getByLabel(STUDY_WINDOW_LABEL);
  if (existing) {
    await existing.show();
    return true;
  }

  const width = 336;
  const height = 224;
  const margin = 20;
  const monitor = await primaryMonitor();
  const workAreaPosition = monitor?.workArea.position.toLogical(monitor.scaleFactor);
  const workAreaSize = monitor?.workArea.size.toLogical(monitor.scaleFactor);
  const fallbackX = window.screen.availWidth - width - margin;
  const fallbackY = window.screen.availHeight - height - margin;
  const widget = new WebviewWindow(STUDY_WINDOW_LABEL, {
    url: '/?view=study-widget',
    title: '正在学习',
    width,
    height,
    x: workAreaPosition && workAreaSize
      ? workAreaPosition.x + workAreaSize.width - width - margin
      : fallbackX,
    y: workAreaPosition && workAreaSize
      ? workAreaPosition.y + workAreaSize.height - height - margin
      : fallbackY,
    alwaysOnTop: true,
    decorations: false,
    resizable: false,
    skipTaskbar: true,
    visible: true,
    focus: false,
  });
  await new Promise<void>((resolve, reject) => {
    void widget.once('tauri://created', () => resolve());
    void widget.once('tauri://error', (event) => reject(new Error(String(event.payload))));
  });
  return true;
}

/** 隐藏已创建的系统小窗，并保留实例供下一次学习快速恢复。 */
export async function hideDesktopStudyWindow(): Promise<void> {
  if (!isTauriRuntime()) return;
  const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
  const existing = await WebviewWindow.getByLabel(STUDY_WINDOW_LABEL);
  if (existing) await existing.hide();
}
