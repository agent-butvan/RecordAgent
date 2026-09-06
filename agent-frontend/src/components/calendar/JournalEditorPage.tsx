import React, { useState } from 'react';
import type { CalendarJournal } from '../../types/calendar';
import { WritingEditorPage } from '../common/WritingEditorPage';

interface JournalEditorPageProps {
  date: Date;
  initialJournal?: CalendarJournal;
  onBack: () => void;
  onSave: (journal: CalendarJournal) => void;
  error?: string | null;
}

const WEEKDAY_FULL = '日一二三四五六';

/** 独立手记编辑页：为当天提供无干扰的长文写作体验。 */
export const JournalEditorPage: React.FC<JournalEditorPageProps> = ({ date, initialJournal, onBack, onSave, error }) => {
  const [mood, setMood] = useState(initialJournal?.mood ?? '');
  const dateLabel = `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 星期${WEEKDAY_FULL[date.getDay()]}`;
  return <WritingEditorPage backLabel="日历" identity="手记" detail={dateLabel}
    initialTitle={initialJournal?.title} initialBody={initialJournal?.excerpt} error={error} onBack={onBack}
    meta={<input value={mood} onChange={(event) => setMood(event.target.value)} placeholder="记录此刻的心情" aria-label="此刻的心情" />}
    onSave={({ title, body }) => onSave({ title, excerpt: body, mood: mood.trim() || '未标注心情', updatedAt: new Date().toISOString() })} />;
};

export default JournalEditorPage;
