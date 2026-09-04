import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, Download, FileText, GraduationCap, Heart, MoreHorizontal,
  Plus, RotateCcw, Search, Trash2, Upload, X } from 'lucide-react';
import { clearRecordTrash, createRecord, exportRecordBackup, fetchRecords, fetchRecordTrash,
  importRecordBackup, restoreRecord, trashRecord, updateRecord, updateRecordFlags } from '../../services/recordApi';
import type { RecordEntry, RecordType, SaveRecordInput } from '../../types/record';
import { TopBar } from '../common/TopBar';
import { RecordEditor } from './RecordEditor';
import { RECORD_TYPES } from './recordTypes';
import styles from './RecordPage.module.css';

const TYPE_LABELS = Object.fromEntries(RECORD_TYPES.map((item) => [item.value, item.label])) as Record<RecordType, string>;
type TopicFilter = 'all' | '八股文' | '面试题';
type EditorTarget = RecordEntry | { type: RecordType };

function formatDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function displayTitle(entry: RecordEntry) { return entry.title || entry.contentText.split('\n')[0] || '无标题记录'; }
function mondayOf(date: Date) {
  const result = new Date(date); result.setHours(0, 0, 0, 0); result.setDate(result.getDate() - ((result.getDay() + 6) % 7)); return result;
}
function matchesTopic(entry: RecordEntry, topic: TopicFilter) {
  return topic === 'all' || entry.tags.includes(topic) || `${entry.title ?? ''} ${entry.contentText}`.includes(topic);
}

/** 极简学习与复盘看板；首页只负责观察和查找，写作始终进入独立编辑页。 */
export function RecordPage() {
  const today = useMemo(() => new Date(), []);
  const todayKey = formatDate(today);
  const [records, setRecords] = useState<RecordEntry[]>([]);
  const [query, setQuery] = useState('');
  const [topic, setTopic] = useState<TopicFilter>('all');
  const [editing, setEditing] = useState<EditorTarget | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);
  const [trashEntries, setTrashEntries] = useState<RecordEntry[] | null>(null);
  const range = useMemo(() => {
    const from = new Date(today); from.setFullYear(from.getFullYear() - 1);
    const to = new Date(today); to.setFullYear(to.getFullYear() + 1);
    return { from: formatDate(from), to: formatDate(to) };
  }, [today]);

  const load = useCallback(async () => {
    setLoading(true);
    try { setRecords(await fetchRecords(range.from, range.to, { query: query.trim() })); }
    catch (reason) { setFeedback({ kind: 'error', text: reason instanceof Error ? reason.message : '记录加载失败' }); }
    finally { setLoading(false); }
  }, [query, range.from, range.to]);
  useEffect(() => { const timer = window.setTimeout(() => void load(), query ? 250 : 0); return () => window.clearTimeout(timer); }, [load, query]);

  const startOfWeek = formatDate(mondayOf(today));
  const weekRecords = records.filter((entry) => entry.recordDate >= startOfWeek && entry.recordDate <= todayKey);
  const weekLearning = weekRecords.filter((entry) => entry.type === 'learning');
  const learningDays = new Set(weekLearning.map((entry) => entry.recordDate)).size;
  const reviewRecords = records.filter((entry) => entry.type === 'weekly_review');
  const weekReviews = reviewRecords.filter((entry) => entry.recordDate >= startOfWeek && entry.recordDate <= todayKey);
  const studyRecords = records.filter((entry) => entry.type === 'learning' && matchesTopic(entry, topic));
  const recentRecords = records.filter((entry) => entry.type !== 'learning' && entry.type !== 'weekly_review').slice(0, 6);
  const interviewTotal = records.filter((entry) => matchesTopic(entry, '面试题')).length;
  const knowledgeTotal = records.filter((entry) => matchesTopic(entry, '八股文')).length;

  const save = async (input: SaveRecordInput) => {
    setSaving(true);
    try {
      if (editing && 'id' in editing) await updateRecord(editing.id, editing.version, input); else await createRecord(input);
      setEditing(null); await load(); setFeedback({ kind: 'success', text: '记录已保存' });
    } catch (reason) {
      setFeedback({ kind: 'error', text: reason instanceof Error ? reason.message : '保存失败' });
      throw reason;
    } finally { setSaving(false); }
  };
  const remove = async (entry: RecordEntry) => {
    if (!window.confirm(`将“${displayTitle(entry)}”移入回收站？`)) return;
    try { await trashRecord(entry.id, entry.version); await load(); }
    catch (reason) { setFeedback({ kind: 'error', text: reason instanceof Error ? reason.message : '删除失败' }); }
  };

  if (editing) {
    const existing = 'id' in editing ? editing : null;
    return <main className={styles.workspace}>
      <TopBar title={existing ? '编辑记录' : '新建记录'} subtitle={TYPE_LABELS[existing?.type ?? editing.type]}
        icon={<FileText size={15} />} actions={<button className={styles.secondaryButton} onClick={() => setEditing(null)}><ArrowLeft size={14} />返回看板</button>} />
      <div className={styles.editorCanvas}>
        <RecordEditor key={existing?.id ?? editing.type} date={existing?.recordDate ?? todayKey} entry={existing}
          initialType={existing?.type ?? editing.type} saving={saving} onSave={save} onClose={() => setEditing(null)} />
      </div>
    </main>;
  }

  const RecordRow = ({ entry }: { entry: RecordEntry }) => <article className={styles.recordRow} onClick={() => setEditing(entry)} tabIndex={0}>
    <div className={styles.rowMain}><div className={styles.rowTitle}><strong>{displayTitle(entry)}</strong>{entry.pinned && <span>置顶</span>}</div>
      <p>{entry.contentText || '暂无正文'}</p><div className={styles.rowMeta}><time>{entry.recordDate}</time><span>{TYPE_LABELS[entry.type]}</span>{entry.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div></div>
    <div className={styles.rowActions}>
      <button onClick={async (event) => { event.stopPropagation(); await updateRecordFlags(entry.id, entry.version, { favorite: !entry.favorite }); await load(); }} aria-label="收藏"><Heart size={14} fill={entry.favorite ? 'currentColor' : 'none'} /></button>
      <button onClick={(event) => { event.stopPropagation(); void remove(entry); }} aria-label="移入回收站"><Trash2 size={14} /></button>
    </div>
  </article>;

  return <main className={styles.workspace}>
    <TopBar title="记录" subtitle="学习与复盘" icon={<FileText size={15} />} actions={<>
      <button className={styles.iconButton} onClick={() => void exportRecordBackup().catch((reason) => setFeedback({ kind: 'error', text: reason.message }))} title="导出备份"><Download size={14} /></button>
      <label className={styles.iconButton} title="导入备份"><Upload size={14} /><input type="file" accept=".zip,application/zip" onChange={async (event) => {
        const file = event.target.files?.[0]; if (!file) return;
        if (window.confirm('导入会替换当前全部记录，确定继续吗？')) try { const count = await importRecordBackup(file); await load(); setFeedback({ kind: 'success', text: `已恢复 ${count} 条记录` }); } catch (reason) { setFeedback({ kind: 'error', text: reason instanceof Error ? reason.message : '导入失败' }); }
        event.target.value = '';
      }} /></label>
      <button className={styles.iconButton} onClick={() => void fetchRecordTrash().then(setTrashEntries)} title="回收站"><Trash2 size={14} /></button>
      <button className={styles.primaryButton} onClick={() => setEditing({ type: 'quick' })}><Plus size={15} />新建记录</button>
    </>} />
    {feedback && <div className={`${styles.feedback} ${feedback.kind === 'success' ? styles.success : ''}`}>{feedback.text}<button onClick={() => setFeedback(null)}>关闭</button></div>}
    <div className={styles.dashboard}>
      <header className={styles.intro}><div><h1>今天学到的，留下来。</h1><p>整理八股文和面试题，也给每一周留一次诚实的复盘。</p></div>
        <div className={styles.search}><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索全部记录" /></div></header>
      <section className={styles.metrics} aria-label="学习概况">
        <div><strong>{learningDays}<small>/ 7</small></strong><span>本周学习天数</span></div><div><strong>{weekLearning.length}</strong><span>本周学习记录</span></div>
        <div><strong>{knowledgeTotal}</strong><span>八股文沉淀</span></div><div><strong>{interviewTotal}</strong><span>面试题积累</span></div>
      </section>
      <div className={styles.board}>
        <section className={styles.studyPanel}>
          <div className={styles.sectionHeader}><div><h2>学习资料</h2><p>持续整理，面试时才有可以调用的答案。</p></div><button onClick={() => setEditing({ type: 'learning' })}><Plus size={14} />记录学习</button></div>
          <nav className={styles.topicTabs} aria-label="学习资料分类">{([['all', '全部'], ['八股文', '八股文'], ['面试题', '面试题']] as const).map(([value, label]) => <button key={value} className={topic === value ? styles.activeTab : ''} onClick={() => setTopic(value)}>{label}</button>)}</nav>
          <div className={styles.recordRows}>{loading ? <div className={styles.empty}>正在加载…</div> : studyRecords.length ? studyRecords.slice(0, 8).map((entry) => <RecordRow key={entry.id} entry={entry} />) : <div className={styles.empty}><GraduationCap size={20} /><strong>还没有这类学习资料</strong><span>从一道今天遇到的面试题开始。</span></div>}</div>
        </section>
        <aside className={styles.reviewPanel}>
          <div className={styles.sectionHeader}><div><h2>本周复盘</h2><p>{startOfWeek} 至今</p></div></div>
          <div className={`${styles.reviewState} ${weekReviews.length ? styles.reviewDone : ''}`}><span className={styles.reviewIcon}>{weekReviews.length ? <Check size={17} /> : <MoreHorizontal size={17} />}</span><div><strong>{weekReviews.length ? '本周已复盘' : '本周尚未复盘'}</strong><p>{weekReviews.length ? `已写下 ${weekReviews.length} 篇，可以继续补充。` : '回头看一眼，下一周会走得更稳。'}</p></div></div>
          <button className={styles.reviewButton} onClick={() => setEditing({ type: 'weekly_review' })}>{weekReviews.length ? '再写一篇复盘' : '开始本周复盘'}</button>
          <div className={styles.reviewHistory}><h3>最近复盘</h3>{reviewRecords.slice(0, 4).map((entry) => <button key={entry.id} onClick={() => setEditing(entry)}><span>{displayTitle(entry)}</span><time>{entry.recordDate}</time></button>)}{!reviewRecords.length && <p>写过的周复盘会出现在这里。</p>}</div>
        </aside>
      </div>
      <section className={styles.recentSection}><div className={styles.sectionHeader}><div><h2>最近记录</h2><p>随记、读书心得与每日手记。</p></div></div>
        <div className={styles.recentGrid}>{recentRecords.map((entry) => <button key={entry.id} onClick={() => setEditing(entry)}><span>{TYPE_LABELS[entry.type]} · {entry.recordDate}</span><strong>{displayTitle(entry)}</strong><p>{entry.contentText}</p></button>)}{!recentRecords.length && <div className={styles.empty}>最近还没有其他记录。</div>}</div></section>
    </div>
    {trashEntries && <div className={styles.trashPage}><div className={styles.trashHeader}><div><h2>回收站</h2><span>{trashEntries.length} 条记录</span></div><div>{trashEntries.length > 0 && <button onClick={async () => { if (window.confirm('永久删除回收站中的全部记录？')) { await clearRecordTrash(); setTrashEntries([]); } }}>清空</button>}<button onClick={() => setTrashEntries(null)} aria-label="关闭回收站"><X size={16} /></button></div></div>
      <div className={styles.trashList}>{trashEntries.length ? trashEntries.map((entry) => <article key={entry.id}><div><strong>{displayTitle(entry)}</strong><span>{entry.recordDate} · {TYPE_LABELS[entry.type]}</span></div><button onClick={async () => { await restoreRecord(entry.id, entry.version); setTrashEntries(await fetchRecordTrash()); await load(); }}><RotateCcw size={14} />恢复</button></article>) : <div className={styles.empty}>回收站是空的</div>}</div></div>}
  </main>;
}
