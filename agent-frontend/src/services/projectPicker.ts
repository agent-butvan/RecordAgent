import { open } from '@tauri-apps/plugin-dialog';

export function canPickProjectDirectory(): boolean {
  return typeof window !== 'undefined' && "__TAURI_INTERNALS__" in window;
}

/** 使用桌面原生目录选择器选择单个项目根目录。 */
export async function pickProjectDirectory(): Promise<string | null> {
  if (!canPickProjectDirectory()) return null;
  const selected = await open({ directory: true, multiple: false, title: '选择项目目录' });
  return typeof selected === 'string' ? selected : null;
}
