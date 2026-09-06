import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  BookOpenIcon,
  ChartBarIcon,
  ClockCounterClockwiseIcon,
  PencilSimpleIcon,
  PlayIcon,
  PlusIcon,
  StopIcon,
  TrashIcon,
} from '@phosphor-icons/react';
import {
  createManualStudySession,
  deleteStudySession,
  fetchActiveStudySession,
  fetchStudySessions,
  fetchStudyStatistics,
  finishStudySession,
  startStudySession,
  updateStudySession,
} from '../../services/studyApi';
import { formatLocalDate } from '../../services/dailyEvents';
import type { SaveStudySessionInput, StudySession, StudyStatistics } from '../../types/study';
import { Button } from '../common/Button';
import { useMessage } from '../common/Message';
import { TopBar } from '../common/TopBar';
import { StudyRecordModal } from './StudyRecordModal';
import { STUDY_CATEGORIES } from './studyCategories';
import styles from './StudyPage.module.css';

const TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

function shiftedDate(days: number): Date {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date;
}

function startOfMonth(): Date {
  const date = new Date();
  date.setDate(1);
  date.setHours(12, 0, 0, 0);
  return date;
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  if (minutes < 1) return seconds > 0 ? '不足 1 分钟' : '0 分钟';
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${minutes} 分钟`;
  return rest ? `${hours} 小时 ${rest} 分钟` : `${hours} 小时`;
}

function formatTimer(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  return [Math.floor(safe / 3600), Math.floor(safe % 3600 / 60), safe % 60]
    .map((value) => String(value).padStart(2, '0')).join(':');
}

function formatTime(instant: string): string {
  return new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    .format(new Date(instant));
}

function weekday(date: string): string {
  return new Intl.DateTimeFormat('zh-CN', { weekday: 'short' }).format(new Date(`${date}T12:00:00`));
}

/** 学习记录工作台：将即时打卡、补卡、历史维护和统计集中在单一页面。 */
export function StudyPage() {
  const { showMessage } = useMessage();
  const [active, setActive] = useState<StudySession | null>(null);
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [weekStats, setWeekStats] = useState<StudyStatistics | null>(null);
  const [monthStats, setMonthStats] = useState<StudyStatistics | null>(null);
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<string>('八股文');
  const [now, setNow] = useState(Date.now());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recordError, setRecordError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<StudySession | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setError(null);
    const today = formatLocalDate(new Date());
    try {
      const [nextActive, recent, nextWeek, nextMonth] = await Promise.all([
        fetchActiveStudySession(),
        fetchStudySessions(formatLocalDate(shiftedDate(-30)), today, TIMEZONE),
        fetchStudyStatistics(formatLocalDate(shiftedDate(-6)), today, TIMEZONE),
        fetchStudyStatistics(formatLocalDate(startOfMonth()), today, TIMEZONE),
      ]);
      setActive(nextActive);
      setSessions(recent);
      setWeekStats(nextWeek);
      setMonthStats(nextMonth);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '学习记录加载失败，请稍后重试。');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [active]);

  const elapsed = active ? Math.max(0, Math.floor((now - new Date(active.startedAt).getTime()) / 1_000)) : 0;
  const todayKey = formatLocalDate(new Date());
  const todaySeconds = (weekStats?.days.find((day) => day.date === todayKey)?.durationSeconds ?? 0)
    + (active ? Math.max(0, elapsed - active.durationSeconds) : 0);
  const completedSessions = sessions.filter((session) => session.endedAt !== null);
  const chartMax = Math.max(1, ...(weekStats?.days.map((day) => day.durationSeconds) ?? [1]));

  const begin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!content.trim()) return;
    setSaving(true);
    try {
      setActive(await startStudySession(content.trim(), category, TIMEZONE));
      setContent('');
      await reload();
      showMessage('success', '学习已开始');
    } catch (cause) {
      showMessage('error', cause instanceof Error ? cause.message : '开始学习失败');
    } finally { setSaving(false); }
  };

  const finish = async () => {
    if (!active) return;
    setSaving(true);
    try {
      await finishStudySession(active.id, active.version);
      await reload();
      showMessage('success', '本次学习已记录');
    } catch (cause) {
      showMessage('error', cause instanceof Error ? cause.message : '结束学习失败');
    } finally { setSaving(false); }
  };

  const openManual = () => {
    setEditing(null);
    setRecordError(null);
    setModalOpen(true);
  };

  const openEdit = (session: StudySession) => {
    setEditing(session);
    setRecordError(null);
    setModalOpen(true);
  };

  const saveRecord = async (input: SaveStudySessionInput) => {
    setSaving(true);
    setRecordError(null);
    try {
      if (editing) await updateStudySession(editing.id, editing.version, input);
      else await createManualStudySession(input);
      setModalOpen(false);
      setEditing(null);
      await reload();
      showMessage('success', editing ? '学习记录已更新' : '补卡完成');
    } catch (cause) {
      setRecordError(cause instanceof Error ? cause.message : '学习记录保存失败');
    } finally { setSaving(false); }
  };

  const remove = async (session: StudySession) => {
    if (confirmDeleteId !== session.id) {
      setConfirmDeleteId(session.id);
      return;
    }
    setSaving(true);
    try {
      await deleteStudySession(session.id, session.version);
      setConfirmDeleteId(null);
      await reload();
      showMessage('success', '学习记录已删除');
    } catch (cause) {
      showMessage('error', cause instanceof Error ? cause.message : '删除失败');
    } finally { setSaving(false); }
  };

  return <main className={styles.workspace}>
    <TopBar title="学习记录" subtitle="把专注的时间留下来" icon={<BookOpenIcon size={15} />}
      actions={<Button type="button" variant="outline" size="sm" icon={<PlusIcon size={13} />} onClick={openManual}>补卡</Button>} />
    <div className={styles.page}>
      <div className={styles.content}>
        {error && <div className={styles.dataError} role="alert"><span>{error}</span><button onClick={() => void reload()}>重新加载</button></div>}
        <section className={styles.overview} aria-label="学习概览">
          <div className={styles.todayBlock}><span>今天已学习</span><strong>{formatDuration(todaySeconds)}</strong><small>{weekStats?.days.find((day) => day.date === todayKey)?.sessionCount ?? 0} 段已完成记录</small></div>
          <dl className={styles.periodStats}>
            <div><dt>近 7 天</dt><dd>{formatDuration(weekStats?.totalDurationSeconds ?? 0)}</dd></div>
            <div><dt>本月累计</dt><dd>{formatDuration(monthStats?.totalDurationSeconds ?? 0)}</dd></div>
            <div><dt>本月学习日</dt><dd>{monthStats?.studyDays ?? 0} 天</dd></div>
          </dl>
        </section>

        <div className={styles.mainLayout}>
          <section className={styles.focusPanel}>
            <div className={styles.sectionHeading}><div><h2>{active ? '正在学习' : '开始一段学习'}</h2><span>{active ? '计时由开始时间持续累积' : '写下这段时间准备专注的内容'}</span></div></div>
            {active ? <div className={styles.activeSession}>
              <div className={styles.timer} aria-label={`已学习 ${formatDuration(elapsed)}`}>{formatTimer(elapsed)}</div>
              <div className={styles.activeMeta}><span>{active.category}</span><strong>{active.content}</strong><small>{formatTime(active.startedAt)} 开始</small></div>
              <Button type="button" variant="primary" size="lg" icon={<StopIcon size={15} weight="fill" />}
                onClick={() => void finish()} disabled={saving}>{saving ? '正在结束…' : '结束本次学习'}</Button>
            </div> : <form className={styles.startForm} onSubmit={(event) => void begin(event)}>
              <label className={styles.contentField}><span>学习内容</span><textarea value={content}
                onChange={(event) => setContent(event.target.value)} maxLength={200} required
                placeholder="例如：复习 JVM 内存模型，整理常见面试题" /></label>
              <div className={styles.startActions}>
                <label><span className={styles.visuallyHidden}>学习分类</span><select value={category} onChange={(event) => setCategory(event.target.value)}>
                  {STUDY_CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}
                </select></label>
                <Button type="submit" variant="primary" icon={<PlayIcon size={14} weight="fill" />}
                  disabled={saving || !content.trim()}>{saving ? '正在开始…' : '开始学习'}</Button>
              </div>
            </form>}

            <section className={styles.history}>
              <div className={styles.sectionHeading}><div><h2>最近记录</h2><span>近 30 天已完成的学习</span></div><strong>{completedSessions.length} 段</strong></div>
              {loading ? <div className={styles.loading}>正在读取学习记录…</div> : completedSessions.length ? <div className={styles.sessionList}>
                {completedSessions.slice(0, 12).map((session) => <article className={styles.sessionRow} key={session.id}>
                  <time dateTime={session.startedAt}><strong>{new Date(session.startedAt).getDate()}</strong><span>{new Intl.DateTimeFormat('zh-CN', { month: 'short' }).format(new Date(session.startedAt))}</span></time>
                  <div className={styles.sessionBody}><div><strong>{session.content}</strong><span>{session.category}</span></div>
                    <p>{formatTime(session.startedAt)} — {session.endedAt ? new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit' }).format(new Date(session.endedAt)) : ''} · {formatDuration(session.durationSeconds)}</p></div>
                  <div className={styles.rowActions}>
                    <button type="button" title="编辑" aria-label={`编辑“${session.content}”`} onClick={() => openEdit(session)}><PencilSimpleIcon size={13} /></button>
                    <button type="button" className={confirmDeleteId === session.id ? styles.confirmDelete : ''}
                      title={confirmDeleteId === session.id ? '再次点击确认删除' : '删除'} aria-label={`删除“${session.content}”`}
                      onClick={() => void remove(session)}>{confirmDeleteId === session.id ? '确认' : <TrashIcon size={13} />}</button>
                  </div>
                </article>)}
              </div> : <div className={styles.empty}><ClockCounterClockwiseIcon size={19} /><strong>还没有学习记录</strong><span>开始一次学习，或使用右上角补卡。</span></div>}
            </section>
          </section>

          <aside className={styles.insightPanel}>
            <div className={styles.sectionHeading}><div><h2>近 7 天节奏</h2><span>每天的有效学习时长</span></div><ChartBarIcon size={15} /></div>
            <div className={styles.chart} aria-label="近七天学习时长柱状图">
              {weekStats?.days.map((day) => <div className={styles.chartDay} key={day.date}>
                <div className={styles.barTrack} title={`${day.date} · ${formatDuration(day.durationSeconds)}`}>
                  <i style={{ height: `${Math.max(day.durationSeconds ? 8 : 0, day.durationSeconds / chartMax * 100)}%` }} />
                </div>
                <strong>{day.durationSeconds ? Math.round(day.durationSeconds / 60) : '—'}</strong>
                <span>{weekday(day.date)}</span>
              </div>)}
            </div>
            <p className={styles.chartNote}>柱顶数字为分钟；跨天学习会自动拆分到对应日期。</p>
            <dl className={styles.insightList}>
              <div><dt>日均时长</dt><dd>{formatDuration(weekStats?.averageDailySeconds ?? 0)}</dd></div>
              <div><dt>学习天数</dt><dd>{weekStats?.studyDays ?? 0} / 7 天</dd></div>
              <div><dt>完成次数</dt><dd>{weekStats?.sessionCount ?? 0} 次</dd></div>
            </dl>
          </aside>
        </div>
      </div>
    </div>
    <StudyRecordModal open={modalOpen} session={editing} saving={saving} error={recordError}
      onClose={() => { if (!saving) { setModalOpen(false); setEditing(null); setRecordError(null); } }} onSave={saveRecord} />
  </main>;
}

export default StudyPage;
