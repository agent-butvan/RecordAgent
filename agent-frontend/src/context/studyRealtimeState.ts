import { createContext, useContext } from 'react';
import type { StudySession } from '../types/study';

export interface StudyRealtimeState {
  activeSession: StudySession | null;
  ready: boolean;
  syncGeneration: number;
  updatedAt: number;
}

export const StudyRealtimeContext = createContext<StudyRealtimeState | null>(null);

/** 读取当前 WebView 的权威学习状态。 */
export function useStudyRealtime(): StudyRealtimeState {
  const value = useContext(StudyRealtimeContext);
  if (!value) throw new Error('useStudyRealtime 必须在 StudyRealtimeProvider 内使用');
  return value;
}
