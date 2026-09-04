import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Download, FileText, Heart, Plus, RotateCcw, Search, Trash2, Upload, X } from 'lucide-react';
import { clearRecordTrash, createRecord, createRecordTab, deleteRecordTab, exportRecordBackup, fetchRecords,
  fetchRecordTabs, fetchRecordTrash, importRecordBackup, restoreRecord, trashRecord, updateRecord, updateRecordFlags } from '../../services/recordApi';
import type { RecordEntry, RecordTab, RecordType, SaveRecordInput } from '../../types/record';
import { RecordEditor } from './RecordEditor';
import { RECORD_TYPES } from './recordTypes';
import { useMessage } from '../common/Message';
import styles from './RecordPage.module.css';

const TYPE_LABELS = Object.fromEntries(RECORD_TYPES.map((item) => [item.value, item.label])) as Record<RecordType, string>;
type EditorTarget = { entry?: RecordEntry; tabId?: string; type: RecordType };
const SUMMARY_COPY_KEY = 'butvan-record-summary-copy';
const DEFAULT_SUMMARY_COPY = '持续积累八股文和面试题，把零散记忆变成可以表达的答案。';

function formatDate(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
function displayTitle(entry: RecordEntry) { return entry.title || entry.contentText.split('\n')[0] || '无标题记录'; }
function mondayOf(date: Date) { const result = new Date(date); result.setDate(result.getDate() - ((result.getDay() + 6) % 7)); return result; }
function typeForTab(tab?: RecordTab): RecordType {
  if (tab?.systemKey === 'weekly_review') return 'weekly_review';
  if (tab?.systemKey === 'journal') return 'journal';
  if (tab?.systemKey === 'reading') return 'reading';
  if (tab?.systemKey === 'knowledge' || tab?.systemKey === 'interview') return 'learning';
  return 'quick';
}

/** 极简资料看板：全部内容通过统一 Tab 导航和统一写作编辑器管理。 */
export function RecordPage() {
  const { showMessage } = useMessage();
  const today = useMemo(() => new Date(), []);
  const todayKey = formatDate(today);
  const [records, setRecords] = useState<RecordEntry[]>([]);
  const [tabs, setTabs] = useState<RecordTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<EditorTarget | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [summaryCopy, setSummaryCopy] = useState(() => localStorage.getItem(SUMMARY_COPY_KEY) || DEFAULT_SUMMARY_COPY);
  const [summaryDraft, setSummaryDraft] = useState(summaryCopy);
  const [editingSummaryCopy, setEditingSummaryCopy] = useState(false);
  const [newTabName, setNewTabName] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [trashEntries, setTrashEntries] = useState<RecordEntry[] | null>(null);
  const [clearingTrash, setClearingTrash] = useState(false);
  const [confirmClearTrash, setConfirmClearTrash] = useState(false);
  const range = useMemo(() => { const from = new Date(today); from.setFullYear(from.getFullYear() - 1); const to = new Date(today); to.setFullYear(to.getFullYear() + 1); return { from: formatDate(from), to: formatDate(to) }; }, [today]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [recordItems, tabItems] = await Promise.all([fetchRecords(range.from, range.to, { query: query.trim() }), fetchRecordTabs()]);
      setRecords(recordItems); setTabs(tabItems);
    } catch (reason) { showMessage('error', reason instanceof Error ? reason.message : '资料加载失败'); }
    finally { setLoading(false); }
  }, [query, range.from, range.to, showMessage]);
  useEffect(() => { const timer = window.setTimeout(() => void load(), query ? 250 : 0); return () => window.clearTimeout(timer); }, [load, query]);

  const activeTab = tabs.find((tab) => tab.id === activeTabId);
  const visibleRecords = activeTabId === 'all' ? records : records.filter((entry) => entry.tabId === activeTabId);
  const startOfWeek = formatDate(mondayOf(today));
  const weekLearning = records.filter((entry) => entry.type === 'learning' && entry.recordDate >= startOfWeek && entry.recordDate <= todayKey);
  const weekReviews = records.filter((entry) => entry.type === 'weekly_review' && entry.recordDate >= startOfWeek && entry.recordDate <= todayKey);
  const learningDays = new Set(weekLearning.map((entry) => entry.recordDate)).size;

  const save = async (input: SaveRecordInput) => {
    if (!input.tabId) throw new Error('请选择这篇资料所属的 Tab');
    setSaving(true);
    try {
      if (editing?.entry) await updateRecord(editing.entry.id, editing.entry.version, input); else await createRecord(input);
      setEditing(null); await load(); showMessage('success', '资料已保存');
    } catch (reason) { showMessage('error', reason instanceof Error ? reason.message : '保存失败'); throw reason; }
    finally { setSaving(false); }
  };

  const beginCreate = () => setEditing({ tabId: activeTab?.id, type: typeForTab(activeTab) });
  const remove = async (entry: RecordEntry) => {
    if (confirmDeleteId !== entry.id) { setConfirmDeleteId(entry.id); return; }
    setDeletingId(entry.id);
    try { await trashRecord(entry.id, entry.version); setConfirmDeleteId(null); await load(); showMessage('success', '资料已移入回收站'); }
    catch (reason) { showMessage('error', reason instanceof Error ? reason.message : '删除失败'); }
    finally { setDeletingId(null); }
  };

  const clearTrash = async () => {
    if (clearingTrash) return;
    if (!confirmClearTrash) { setConfirmClearTrash(true); return; }
    setClearingTrash(true);
    try {
      const count = await clearRecordTrash();
      setTrashEntries([]);
      showMessage('success', count ? `已永久删除 ${count} 条资料` : '回收站已经是空的');
    } catch (reason) {
      showMessage('error', reason instanceof Error ? reason.message : '清空回收站失败');
    } finally {
      setClearingTrash(false);
      setConfirmClearTrash(false);
    }
  };

  if (editing) return <RecordEditor date={editing.entry?.recordDate ?? todayKey} entry={editing.entry}
    initialType={editing.entry?.type ?? editing.type} initialTabId={editing.entry?.tabId ?? editing.tabId}
    tabs={tabs} saving={saving} onSave={save} onBack={() => setEditing(null)} />;

  return <main className={styles.workspace}>
    <div className={styles.commandBar}>
      <div className={styles.search}><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索资料" /></div>
      <div className={styles.actions}>
        <button className={styles.iconButton} onClick={() => void exportRecordBackup()} title="导出备份"><Download size={14} /></button>
        <label className={styles.iconButton} title="导入备份"><Upload size={14} /><input type="file" accept=".zip,application/zip" onChange={async (event) => {
          const file = event.target.files?.[0]; if (!file) return;
          if (window.confirm('导入会替换当前全部资料，确定继续吗？')) try { const count = await importRecordBackup(file); await load(); showMessage('success', `已恢复 ${count} 条资料`); } catch (reason) { showMessage('error', reason instanceof Error ? reason.message : '导入失败'); }
          event.target.value = '';
        }} /></label>
        <button className={styles.iconButton} onClick={() => void fetchRecordTrash().then(setTrashEntries)} title="回收站"><Trash2 size={14} /></button>
        <button className={styles.primaryButton} onClick={beginCreate}><Plus size={15} />新增资料</button>
      </div>
    </div>
    <div className={styles.dashboard}>
      <section className={styles.summary} aria-label="本周学习情况">
        <div><strong>{learningDays}<small>/ 7</small></strong><span>本周学习天数</span></div>
        <div><strong>{weekLearning.length}</strong><span>本周新增资料</span></div>
        <div><strong>{weekReviews.length ? <Check size={20} /> : '—'}</strong><span>{weekReviews.length ? `已完成 ${weekReviews.length} 次复盘` : '本周尚未复盘'}</span></div>
        {editingSummaryCopy ? <input className={styles.summaryCopyInput} value={summaryDraft} autoFocus maxLength={120}
          aria-label="学习提示文案" onChange={(event) => setSummaryDraft(event.target.value)} onBlur={() => {
            const nextCopy = summaryDraft.trim() || DEFAULT_SUMMARY_COPY;
            setSummaryCopy(nextCopy); setSummaryDraft(nextCopy); localStorage.setItem(SUMMARY_COPY_KEY, nextCopy); setEditingSummaryCopy(false);
          }} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') { setSummaryDraft(summaryCopy); setEditingSummaryCopy(false); } }} />
          : <p className={styles.summaryCopy} tabIndex={0} role="button" aria-label="学习提示文案，双击编辑" title="双击编辑" onDoubleClick={() => setEditingSummaryCopy(true)}
            onKeyDown={(event) => { if (event.key === 'Enter' || event.key === 'F2') setEditingSummaryCopy(true); }}>{summaryCopy}</p>}
      </section>

      <section className={styles.library}>
        <div className={styles.libraryHeader}><div><h1>{activeTab?.name ?? '全部资料'}</h1><span>{visibleRecords.length} 篇</span></div>
          {activeTab && !activeTab.systemKey && <button className={styles.deleteTabButton} onClick={async () => { if (window.confirm(`删除 Tab“${activeTab.name}”？其中资料仍会保留在全部资料中。`)) { await deleteRecordTab(activeTab.id); setActiveTabId('all'); await load(); } }}>删除 Tab</button>}
        </div>
        <nav className={styles.tabs} aria-label="资料分类">
          <button className={activeTabId === 'all' ? styles.activeTab : ''} onClick={() => setActiveTabId('all')}>全部</button>
          {tabs.map((tab) => <button key={tab.id} className={activeTabId === tab.id ? styles.activeTab : ''} onClick={() => setActiveTabId(tab.id)}>{tab.name}</button>)}
          {newTabName === null ? <button className={styles.addTab} onClick={() => setNewTabName('')}><Plus size={13} />新建 Tab</button> :
            <form className={styles.newTabForm} onSubmit={async (event) => { event.preventDefault(); if (!newTabName.trim()) return; try { const tab = await createRecordTab(newTabName); setNewTabName(null); await load(); setActiveTabId(tab.id); } catch (reason) { showMessage('error', reason instanceof Error ? reason.message : 'Tab 创建失败'); } }}>
              <input value={newTabName} onChange={(event) => setNewTabName(event.target.value)} placeholder="Tab 名称" autoFocus maxLength={20} />
              <button type="submit">创建</button><button type="button" onClick={() => setNewTabName(null)}><X size={13} /></button>
            </form>}
        </nav>

        <div className={styles.recordList}>{loading ? <div className={styles.empty}>正在加载…</div> : visibleRecords.length ? visibleRecords.map((entry) => <article key={entry.id} className={styles.recordRow} onClick={() => setEditing({ entry, type: entry.type })} tabIndex={0}>
          <div className={styles.recordDate}><strong>{entry.recordDate.slice(8)}</strong><span>{entry.recordDate.slice(5, 7)}月</span></div>
          <div className={styles.recordContent}><div><strong>{displayTitle(entry)}</strong>{entry.pinned && <span>置顶</span>}</div><p>{entry.contentText || '暂无正文'}</p>
            <footer><span>{TYPE_LABELS[entry.type]}</span>{entry.tags.map((tag) => <span key={tag}>#{tag}</span>)}</footer></div>
          <div className={styles.rowActions}>
            <button onClick={async (event) => { event.stopPropagation(); try { await updateRecordFlags(entry.id, entry.version, { favorite: !entry.favorite }); await load(); } catch (reason) { showMessage('error', reason instanceof Error ? reason.message : '收藏失败'); } }} aria-label="收藏"><Heart size={14} fill={entry.favorite ? 'currentColor' : 'none'} /></button>
            <button className={confirmDeleteId === entry.id ? styles.confirmDelete : ''} disabled={deletingId === entry.id} onClick={(event) => { event.stopPropagation(); void remove(entry); }}>{confirmDeleteId === entry.id ? (deletingId === entry.id ? '删除中…' : '确认删除') : <Trash2 size={14} />}</button>
          </div>
        </article>) : <div className={styles.empty}><FileText size={20} /><strong>这个 Tab 还没有资料</strong><span>点击“新增资料”，内容会直接归入当前 Tab。</span><button onClick={beginCreate}>新增第一篇资料</button></div>}</div>
      </section>
    </div>

    {trashEntries && <div className={styles.trashPage}><div className={styles.trashHeader}><div><h2>回收站</h2><span>{trashEntries.length} 条资料</span></div><div>{trashEntries.length > 0 && <button type="button" className={confirmClearTrash ? styles.confirmClear : ''} disabled={clearingTrash} onClick={() => void clearTrash()}>{clearingTrash ? '清空中…' : confirmClearTrash ? '确认清空' : '清空'}</button>}<button type="button" disabled={clearingTrash} onClick={() => { setConfirmClearTrash(false); setTrashEntries(null); }} aria-label="关闭回收站"><X size={16} /></button></div></div>
      <div className={styles.trashList}>{trashEntries.length ? trashEntries.map((entry) => <article key={entry.id}><div><strong>{displayTitle(entry)}</strong><span>{entry.recordDate}</span></div><button onClick={async () => { await restoreRecord(entry.id, entry.version); setTrashEntries(await fetchRecordTrash()); await load(); }}><RotateCcw size={14} />恢复</button></article>) : <div className={styles.empty}>回收站是空的</div>}</div></div>}
  </main>;
}
