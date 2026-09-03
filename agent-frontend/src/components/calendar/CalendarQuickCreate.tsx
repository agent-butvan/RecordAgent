import React, { useState } from 'react';
import {
  ArrowLeft,
  CalendarClock,
  CheckSquare2,
  NotebookPen,
  Plus,
  WalletCards,
} from 'lucide-react';
import type { CalendarRecordDraft, TodoPriority } from '../../types/calendar';
import { Modal } from '../common/Modal';
import { TimeWheelPicker } from './TimeWheelPicker';
import styles from './CalendarQuickCreate.module.css';

type RecordKind = CalendarRecordDraft['kind'];
type ModalRecordKind = Exclude<RecordKind, 'journal'>;

interface CalendarQuickCreateProps {
  selectedDate: Date;
  onCreate: (draft: CalendarRecordDraft) => void;
  onWriteJournal: () => void;
}

const RECORD_OPTIONS = [
  { kind: 'todo', label: '新建待办', description: '记录要完成的事项', icon: CheckSquare2 },
  { kind: 'schedule', label: '添加日程', description: '安排时间与地点', icon: CalendarClock },
  { kind: 'expense', label: '记一笔', description: '记录当天收支明细', icon: WalletCards },
  { kind: 'journal', label: '写手记', description: '留下当天的想法', icon: NotebookPen },
] satisfies Array<{ kind: RecordKind; label: string; description: string; icon: typeof CheckSquare2 }>;

const FORM_TITLES: Record<ModalRecordKind, string> = {
  todo: '新建待办',
  schedule: '添加日程',
  expense: '记一笔',
};

const valueOf = (formData: FormData, key: string): string => String(formData.get(key) ?? '').trim();

const timeAfter = (minutesToAdd: number): string => {
  const date = new Date(Date.now() + minutesToAdd * 60_000);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

/** 日历顶栏快捷记录入口：在当前选中日期内创建四类日记录。 */
export const CalendarQuickCreate: React.FC<CalendarQuickCreateProps> = ({ selectedDate, onCreate, onWriteJournal }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeKind, setActiveKind] = useState<ModalRecordKind | null>(null);
  const selectedDateLabel = `${selectedDate.getMonth() + 1}月${selectedDate.getDate()}日`;

  const closeModal = () => {
    setIsOpen(false);
    setActiveKind(null);
  };

  const submitRecord = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeKind) return;

    const formData = new FormData(event.currentTarget);
    let draft: CalendarRecordDraft;
    if (activeKind === 'todo') {
      draft = {
        kind: 'todo',
        title: valueOf(formData, 'title'),
        time: valueOf(formData, 'time') || undefined,
        priority: (valueOf(formData, 'priority') || 'medium') as TodoPriority,
      };
    } else if (activeKind === 'schedule') {
      draft = {
        kind: 'schedule',
        title: valueOf(formData, 'title'),
        startTime: valueOf(formData, 'startTime'),
        endTime: valueOf(formData, 'endTime'),
        location: valueOf(formData, 'location') || undefined,
      };
    } else {
      draft = {
        kind: 'expense',
        category: valueOf(formData, 'category'),
        note: valueOf(formData, 'note'),
        amount: Number(valueOf(formData, 'amount')),
        time: valueOf(formData, 'time'),
      };
    }

    onCreate(draft);
    closeModal();
  };

  return (
    <div className={styles.container}>
      <button
        type="button"
        className={styles.trigger}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        onClick={() => setIsOpen(true)}
      >
        <Plus size={14} strokeWidth={2} />
        新建记录
      </button>

      <Modal
        open={isOpen}
        title={activeKind ? FORM_TITLES[activeKind] : '新建记录'}
        onClose={closeModal}
        width={640}
        centered
        className={styles.modal}
      >
        {activeKind ? (
          <form className={styles.form} onSubmit={submitRecord}>
            <div className={styles.formHeading}>
              <button type="button" className={styles.backButton} aria-label="返回记录类型" onClick={() => setActiveKind(null)}>
                <ArrowLeft size={15} />
              </button>
              <span>记录到 {selectedDateLabel}</span>
            </div>

            {activeKind === 'todo' && <>
              <label className={styles.field}>待办内容<input name="title" required autoFocus placeholder="例如：整理项目笔记" /></label>
              <div className={styles.fieldRow}>
                <div className={styles.field}><span>时间</span><TimeWheelPicker name="time" ariaLabel="待办时间" /></div>
                <label className={styles.field}>优先级<select name="priority" defaultValue="medium"><option value="high">重要</option><option value="medium">计划</option><option value="low">生活</option></select></label>
              </div>
            </>}

            {activeKind === 'schedule' && <>
              <label className={styles.field}>日程名称<input name="title" required autoFocus placeholder="例如：产品评审会" /></label>
              <div className={styles.fieldRow}>
                <div className={styles.field}><span>开始</span><TimeWheelPicker name="startTime" ariaLabel="日程开始时间" defaultValue={timeAfter(0)} required /></div>
                <div className={styles.field}><span>结束</span><TimeWheelPicker name="endTime" ariaLabel="日程结束时间" defaultValue={timeAfter(30)} required /></div>
              </div>
              <label className={styles.field}>地点<input name="location" placeholder="选填" /></label>
            </>}

            {activeKind === 'expense' && <>
              <div className={styles.fieldRow}>
                <label className={styles.field}>金额<input name="amount" type="number" min="0.01" step="0.01" required autoFocus placeholder="0.00" /></label>
                <label className={styles.field}>分类<input name="category" required placeholder="餐饮" /></label>
              </div>
              <label className={styles.field}>说明<input name="note" required placeholder="例如：午餐" /></label>
              <div className={styles.field}><span>时间</span><TimeWheelPicker name="time" ariaLabel="记账时间" defaultValue={timeAfter(0)} required /></div>
            </>}

            <div className={styles.formActions}>
              <button type="button" className={styles.cancelButton} onClick={closeModal}>取消</button>
              <button type="submit" className={styles.submitButton}>保存到 {selectedDateLabel}</button>
            </div>
          </form>
        ) : (
          <div className={styles.menu} aria-label="选择记录类型">
            <p className={styles.menuIntro}>选择记录类型，内容将添加到 <strong>{selectedDateLabel}</strong></p>
            <div className={styles.optionGrid}>
              {RECORD_OPTIONS.map(({ kind, label, description, icon: Icon }) => (
                <button
                  type="button"
                  key={kind}
                  onClick={() => {
                    if (kind === 'journal') {
                      closeModal();
                      onWriteJournal();
                      return;
                    }
                    setActiveKind(kind);
                  }}
                >
                  <span className={styles.optionIcon}><Icon size={17} strokeWidth={1.8} /></span>
                  <span><strong>{label}</strong><small>{description}</small></span>
                </button>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default CalendarQuickCreate;
