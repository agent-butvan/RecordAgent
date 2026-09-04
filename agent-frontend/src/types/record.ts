export type RecordType = 'quick' | 'learning' | 'weekly_review' | 'reading' | 'journal';

export interface RecordEntry {
  id: string;
  recordDate: string;
  type: RecordType;
  title: string | null;
  contentHtml: string;
  contentText: string;
  tags: string[];
  pinned: boolean;
  favorite: boolean;
  archived: boolean;
  trashedAt: string | null;
  weekYear: number | null;
  weekNumber: number | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface RecordDaySummary {
  date: string;
  count: number;
  weeklyReviewCompleted: boolean;
}

export interface SaveRecordInput {
  recordDate: string;
  type: RecordType;
  title?: string;
  contentHtml: string;
  contentText: string;
  tags: string[];
}

export interface RecordAttachment {
  id: string;
  recordId: string;
  originalName: string;
  mediaType: string;
  sizeBytes: number;
  createdAt: string;
}
