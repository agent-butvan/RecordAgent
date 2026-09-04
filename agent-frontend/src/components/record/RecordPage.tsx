import { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen, CalendarCheck, ChevronLeft, ChevronRight, FileText, GraduationCap,
  Download, Heart, NotebookPen, Pin, Plus, RotateCcw, Search, StickyNote, Trash2, Upload, X } from 'lucide-react';
import { clearRecordTrash, createRecord, exportRecordBackup, fetchRecordDays, fetchRecords, fetchRecordTrash, importRecordBackup, restoreRecord, trashRecord, updateRecord, updateRecordFlags } from '../../services/recordApi';
import type { RecordDaySummary, RecordEntry, RecordType, SaveRecordInput } from '../../types/record';
import { TopBar } from '../common/TopBar';
import { RecordEditor } from './RecordEditor';
import { RECORD_TYPES } from './recordTypes';
import styles from './RecordPage.module.css';

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];
const TYPE_META: Record<RecordType, { label: string; icon: typeof StickyNote }> = {
  quick: { label: '随记', icon: StickyNote }, learning: { label: '每日学习', icon: GraduationCap },
  weekly_review: { label: '每周复盘', icon: CalendarCheck }, reading: { label: '读书心得', icon: BookOpen },
  journal: { label: '每日手记', icon: NotebookPen },
};

function formatDate(date: Date) {
  const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}-${String(date.getDate()).padStart(2, '0')}`;
}
function addDays(date: Date, count: number) { const next = new Date(date); next.setDate(next.getDate() + count); return next; }
function monthRange(date: Date) {
  return { from: formatDate(new Date(date.getFullYear(), date.getMonth(), 1)), to: formatDate(new Date(date.getFullYear(), date.getMonth() + 1, 0)) };
}
function displayTitle(entry: RecordEntry) { return entry.title || entry.contentText.split('\n')[0] || '无标题记录'; }

/** 以月历为主线的记录总览，支持快速输入、筛选和完整编辑。 */
export function RecordPage() {
  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(formatDate(today));
  const [records, setRecords] = useState<RecordEntry[]>([]);
  const [summaries, setSummaries] = useState<RecordDaySummary[]>([]);
  const [query, setQuery] = useState('');
  const [type, setType] = useState<RecordType | ''>('');
  const [editing, setEditing] = useState<RecordEntry | 'new' | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [trashEntries, setTrashEntries] = useState<RecordEntry[] | null>(null);

  const range = useMemo(() => monthRange(cursor), [cursor]);
  const summaryMap = useMemo(() => new Map(summaries.map((item) => [item.date, item])), [summaries]);
  const selectedRecords = records.filter((entry) => entry.recordDate === selectedDate);
  const allTags = useMemo(() => Array.from(new Set(records.flatMap((entry) => entry.tags))).slice(0, 12), [records]);
  const monthCount = summaries.reduce((total, item) => total + item.count, 0);

  const days = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7;
    const start = addDays(first, -offset);
    return Array.from({ length: 42 }, (_, index) => addDays(start, index));
  }, [cursor]);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [items, dayItems] = await Promise.all([
        fetchRecords(range.from, range.to, { type, query: query.trim() }), fetchRecordDays(range.from, range.to),
      ]);
      setRecords(items); setSummaries(dayItems);
    } catch (reason) { setError(reason instanceof Error ? reason.message : '记录加载失败'); }
    finally { setLoading(false); }
  }, [query, range.from, range.to, type]);

  useEffect(() => { const timer = window.setTimeout(() => void load(), query ? 250 : 0); return () => window.clearTimeout(timer); }, [load, query]);

  const save = async (input: SaveRecordInput) => {
    setSaving(true);
    try {
      if (editing && editing !== 'new') await updateRecord(editing.id, editing.version, input);
      else await createRecord(input);
      setEditing(null); setSelectedDate(input.recordDate); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : '保存失败'); }
    finally { setSaving(false); }
  };

  const toggleFlag = async (entry: RecordEntry, flag: 'pinned' | 'favorite') => {
    try { await updateRecordFlags(entry.id, entry.version, { [flag]: !entry[flag] }); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : '状态修改失败'); }
  };

  const remove = async (entry: RecordEntry) => {
    if (!window.confirm(`将“${displayTitle(entry)}”移入回收站？`)) return;
    try { await trashRecord(entry.id, entry.version); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : '删除失败'); }
  };

  return (
    <main className={styles.workspace}>
      <TopBar title="记录" subtitle={`${cursor.getFullYear()} 年 ${cursor.getMonth() + 1} 月 · ${monthCount} 篇`}
        icon={<FileText size={15} />} actions={<>
          <button className={styles.secondaryButton} onClick={() => void exportRecordBackup().catch((reason) => setError(reason.message))}><Download size={14} />导出</button>
          <label className={styles.secondaryButton}><Upload size={14} />导入<input type="file" accept=".zip,application/zip" onChange={async (event) => {
            const file = event.target.files?.[0]; if (!file) return;
            if (!window.confirm('导入会替换当前全部记录，确定继续吗？')) { event.target.value = ''; return; }
            try { const count = await importRecordBackup(file); await load(); setError(`已从备份恢复 ${count} 条记录`); }
            catch (reason) { setError(reason instanceof Error ? reason.message : '备份导入失败'); }
            finally { event.target.value = ''; }
          }} /></label>
          <button className={styles.secondaryButton} onClick={() => void fetchRecordTrash().then(setTrashEntries).catch((reason) => setError(reason.message))}><Trash2 size={14} />回收站</button>
          <button className={styles.newButton} onClick={() => setEditing('new')}><Plus size={15} />新建记录</button>
        </>} />
      {error && <div className={styles.error}>{error}<button onClick={() => setError('')}>关闭</button></div>}
      <div className={styles.layout}>
        <section className={styles.primary}>
          <RecordEditor date={selectedDate} compact saving={saving} onSave={save} />
          <div className={styles.calendarHeader}>
            <div><h2>{cursor.getFullYear()}年 {cursor.getMonth() + 1}月</h2><span>点击日期查看当天的全部记录</span></div>
            <div className={styles.monthNav}>
              <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} aria-label="上个月"><ChevronLeft size={16} /></button>
              <button onClick={() => { setCursor(new Date(today.getFullYear(), today.getMonth(), 1)); setSelectedDate(formatDate(today)); }}>今天</button>
              <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} aria-label="下个月"><ChevronRight size={16} /></button>
            </div>
          </div>
          <div className={styles.weekRow}>{WEEKDAYS.map((day) => <span key={day}>{day}</span>)}</div>
          <div className={styles.calendarGrid}>
            {days.map((day) => {
              const key = formatDate(day); const summary = summaryMap.get(key); const outside = day.getMonth() !== cursor.getMonth();
              return <button key={key} className={`${styles.day} ${outside ? styles.outside : ''} ${key === selectedDate ? styles.selected : ''} ${key === formatDate(today) ? styles.today : ''}`}
                onClick={() => { setSelectedDate(key); if (outside) setCursor(new Date(day.getFullYear(), day.getMonth(), 1)); }}>
                <span className={styles.dayNumber}>{day.getDate()}</span>
                {summary && <span className={styles.dayMeta}><i />{summary.count} 篇{summary.weeklyReviewCompleted && <b>已复盘</b>}</span>}
              </button>;
            })}
          </div>
        </section>

        <aside className={styles.sidePanel}>
          <div className={styles.searchBox}><Search size={15} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索标题与正文" /></div>
          <div className={styles.typeFilters}>
            <button className={!type ? styles.filterActive : ''} onClick={() => setType('')}>全部</button>
            {RECORD_TYPES.map((item) => <button key={item.value} className={type === item.value ? styles.filterActive : ''} onClick={() => setType(item.value)}>{item.label}</button>)}
          </div>
          <div className={styles.dayTitle}>
            <div><h2>{Number(selectedDate.slice(8))} 日</h2><span>{selectedDate}</span></div>
            <button onClick={() => setEditing('new')}><Plus size={15} />添加</button>
          </div>
          <div className={styles.recordList}>
            {loading ? <div className={styles.empty}>正在加载记录…</div> : selectedRecords.length === 0 ?
              <div className={styles.empty}><StickyNote size={22} /><strong>这一天还没有记录</strong><span>写下一个想法、学习成果或生活片段。</span></div> :
              selectedRecords.map((entry) => { const MetaIcon = TYPE_META[entry.type].icon; return (
                <article key={entry.id} className={styles.recordItem} onClick={() => setEditing(entry)} tabIndex={0}>
                  <div className={styles.recordMeta}><span><MetaIcon size={13} />{TYPE_META[entry.type].label}</span><time>{new Date(entry.updatedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</time></div>
                  <h3>{displayTitle(entry)}</h3><p>{entry.contentText || '暂无正文'}</p>
                  <div className={styles.recordFooter}><div>{entry.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div>
                    <div className={styles.itemActions}>
                      <button className={entry.pinned ? styles.activeAction : ''} onClick={(e) => { e.stopPropagation(); void toggleFlag(entry, 'pinned'); }} title="置顶"><Pin size={14} /></button>
                      <button className={entry.favorite ? styles.activeAction : ''} onClick={(e) => { e.stopPropagation(); void toggleFlag(entry, 'favorite'); }} title="收藏"><Heart size={14} /></button>
                      <button onClick={(e) => { e.stopPropagation(); void remove(entry); }} title="移入回收站"><Trash2 size={14} /></button>
                    </div></div>
                </article>); })}
          </div>
          {allTags.length > 0 && <div className={styles.tagCloud}><strong>本月标签</strong><div>{allTags.map((tag) => <span key={tag}>#{tag}</span>)}</div></div>}
        </aside>
      </div>
      {editing && <div className={styles.editorPage}><RecordEditor date={selectedDate} entry={editing === 'new' ? null : editing} saving={saving} onSave={save} onClose={() => setEditing(null)} /></div>}
      {trashEntries && <div className={styles.trashPage}>
        <div className={styles.trashHeader}><div><h2>回收站</h2><span>{trashEntries.length} 条记录，清空前可随时恢复</span></div><div>
          {trashEntries.length > 0 && <button onClick={async () => { if (window.confirm('永久删除回收站中的全部记录？')) { await clearRecordTrash(); setTrashEntries([]); } }}>清空回收站</button>}
          <button onClick={() => setTrashEntries(null)} aria-label="关闭回收站"><X size={16} /></button>
        </div></div>
        <div className={styles.trashList}>{trashEntries.length === 0 ? <div className={styles.empty}>回收站是空的</div> : trashEntries.map((entry) =>
          <article key={entry.id}><div><strong>{displayTitle(entry)}</strong><span>{entry.recordDate} · {TYPE_META[entry.type].label}</span></div>
            <button onClick={async () => { await restoreRecord(entry.id, entry.version); setTrashEntries(await fetchRecordTrash()); await load(); }}><RotateCcw size={14} />恢复</button></article>)}</div>
      </div>}
    </main>
  );
}
