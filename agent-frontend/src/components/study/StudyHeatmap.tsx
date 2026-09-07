import { useEffect, useMemo, useRef } from 'react';
import type { StudyDayStat } from '../../types/study';
import styles from './StudyHeatmap.module.css';

interface StudyHeatmapProps {
  days: StudyDayStat[];
  to: string;
}

const DAY_MS = 86_400_000;

function parseDate(dateKey: string): Date { return new Date(`${dateKey}T12:00:00`); }
function formatDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function durationLabel(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  if (minutes < 1) return seconds > 0 ? '不足 1 分钟' : '没有学习';
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours ? `${hours} 小时${rest ? ` ${rest} 分钟` : ''}` : `${minutes} 分钟`;
}
function heatLevel(seconds: number): number {
  if (seconds <= 0) return 0;
  if (seconds < 1_800) return 1;
  if (seconds < 3_600) return 2;
  if (seconds < 7_200) return 3;
  return 4;
}

/** 最近一年学习热力图：按周排布，并以每日累计学习时长计算色阶。 */
export function StudyHeatmap({ days, to }: StudyHeatmapProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { cells, monthLabels } = useMemo(() => {
    const end = parseDate(to);
    const start = new Date(end.getTime() - 364 * DAY_MS);
    start.setDate(start.getDate() - start.getDay());
    const endOfWeek = new Date(end);
    endOfWeek.setDate(endOfWeek.getDate() + (6 - endOfWeek.getDay()));
    const totals = new Map(days.map((day) => [day.date, day.durationSeconds]));
    const nextCells: Array<{ date: string; durationSeconds: number; future: boolean }> = [];
    const nextLabels: Array<{ label: string; column: number }> = [];
    let previousMonth = -1;
    let column = 1;

    for (let cursor = new Date(start); cursor <= endOfWeek; cursor.setDate(cursor.getDate() + 1)) {
      if (cursor.getDay() === 0) column = Math.floor((cursor.getTime() - start.getTime()) / (7 * DAY_MS)) + 1;
      if (cursor <= end && cursor.getMonth() !== previousMonth) {
        nextLabels.push({ label: new Intl.DateTimeFormat('zh-CN', { month: 'short' }).format(cursor), column });
        previousMonth = cursor.getMonth();
      }
      const date = formatDate(cursor);
      nextCells.push({ date, durationSeconds: totals.get(date) ?? 0, future: cursor > end });
    }
    return { cells: nextCells, monthLabels: nextLabels };
  }, [days, to]);
  const columns = Math.ceil(cells.length / 7);

  useEffect(() => {
    const container = scrollRef.current;
    if (container) container.scrollLeft = container.scrollWidth;
  }, [cells.length]);

  return <div className={styles.heatmap}>
    <div className={styles.scroll} ref={scrollRef}>
      <div className={styles.canvas} style={{ '--heatmap-columns': columns } as React.CSSProperties}>
        <div className={styles.months} aria-hidden="true">
          {monthLabels.map((month) => <span key={`${month.label}-${month.column}`} style={{ gridColumn: month.column }}>{month.label}</span>)}
        </div>
        <div className={styles.plot}>
          <div className={styles.weekdays} aria-hidden="true"><span /><span>一</span><span /><span>三</span><span /><span>五</span><span /></div>
          <div className={styles.cells} role="img" aria-label="最近一年每日学习时长热力图">
            {cells.map((cell) => <span key={cell.date} className={`${styles.cell} ${styles[`level${heatLevel(cell.durationSeconds)}`]} ${cell.future ? styles.future : ''}`}
              title={cell.future ? '' : `${cell.date} · ${durationLabel(cell.durationSeconds)}`} aria-hidden="true" />)}
          </div>
        </div>
      </div>
    </div>
    <div className={styles.legend} aria-label="热力图图例"><span>少</span>{[0, 1, 2, 3, 4].map((level) => <i key={level} className={styles[`level${level}`]} />)}<span>多</span></div>
  </div>;
}
