import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { FinanceChartRange, FinanceExpenseChart } from '../../types/finance';
import styles from './SpendingTrendChart.module.css';

const RANGE_OPTIONS: Array<{ value: FinanceChartRange; label: string }> = [
  { value: 'week', label: '本周' },
  { value: 'month', label: '本月' },
  { value: 'year', label: '今年' },
];
const CATEGORY_COLORS = ['#aabbd5', '#ddc0ae', '#afcbbf', '#c8b9d2', '#d9cca8', '#b5c9d2', '#dbb9bb', '#c1c9b6'];

function categoryColor(category: string): string {
  const index = [...category].reduce((total, character) => total + (character.codePointAt(0) ?? 0), 0);
  return CATEGORY_COLORS[index % CATEGORY_COLORS.length];
}

function compactMoney(value: number): string {
  if (value >= 10000) return `¥${(value / 10000).toFixed(value >= 100000 ? 0 : 1)}万`;
  return `¥${Math.round(value)}`;
}

function dateLabel(date: string, range: FinanceChartRange): string {
  const [, month, day] = date.split('-');
  return range === 'year' ? `${Number(month)}月` : `${Number(month)}/${Number(day)}`;
}

function fullDateLabel(date: string): string {
  const [year, month, day] = date.split('-');
  return `${year}年${Number(month)}月${Number(day)}日`;
}

function smoothLinePath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  const slopes = points.slice(1).map((point, index) =>
    (point.y - points[index].y) / (point.x - points[index].x));
  const tangents = points.map((_point, index) => {
    if (index === 0) return slopes[0];
    if (index === points.length - 1) return slopes.at(-1) ?? 0;
    const previous = slopes[index - 1];
    const next = slopes[index];
    return previous * next <= 0 ? 0 : (2 * previous * next) / (previous + next);
  });
  return points.slice(1).reduce((path, point, index) => {
    const previous = points[index];
    const distance = point.x - previous.x;
    const firstControlX = previous.x + distance / 3;
    const secondControlX = point.x - distance / 3;
    const firstControlY = previous.y + tangents[index] * distance / 3;
    const secondControlY = point.y - tangents[index + 1] * distance / 3;
    return `${path} C ${firstControlX.toFixed(2)} ${firstControlY.toFixed(2)}, ${secondControlX.toFixed(2)} ${secondControlY.toFixed(2)}, ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
  }, `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`);
}

interface SpendingTrendChartProps {
  chart: FinanceExpenseChart | null;
  range: FinanceChartRange;
  loading: boolean;
  error: string | null;
  onRangeChange: (range: FinanceChartRange) => void;
}

interface HoverState {
  index: number;
  left: number;
}

/** 同一时间轴上叠加每日收支折线与按支出分类构成的堆叠柱。 */
export const SpendingTrendChart: React.FC<SpendingTrendChartProps> = ({ chart, range, loading, error, onRangeChange }) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<HoverState | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const update = () => setWidth(Math.max(520, Math.floor(host.clientWidth)));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  useEffect(() => setHover(null), [chart]);

  const categories = useMemo(() => {
    const totals = new Map<string, number>();
    chart?.days.forEach((day) => day.categories.forEach((item) => totals.set(item.category, (totals.get(item.category) ?? 0) + item.amount)));
    return [...totals.entries()].sort((left, right) => right[1] - left[1]).map(([category]) => category);
  }, [chart]);

  const days = chart?.days ?? [];
  const displayedRange = chart?.range ?? range;
  const activeDay = hover ? days[hover.index] : null;
  const height = 252;
  const margin = { top: 16, right: 14, bottom: 30, left: 48 };
  const plotWidth = Math.max(1, width - margin.left - margin.right);
  const plotHeight = height - margin.top - margin.bottom;
  const maxValue = Math.max(1, ...days.flatMap((day) => [day.total, day.income]));
  const dataInset = days.length > 1 ? Math.min(22, plotWidth / 4) : 0;
  const dataWidth = Math.max(1, plotWidth - dataInset * 2);
  const step = days.length > 1 ? dataWidth / (days.length - 1) : dataWidth;
  const barWidth = Math.max(2.5, Math.min(24, step * 0.7));
  const x = (index: number) => days.length > 1
    ? margin.left + dataInset + step * index
    : margin.left + plotWidth / 2;
  const y = (value: number) => margin.top + plotHeight - (value / maxValue) * plotHeight;
  const cellBounds = (index: number) => ({
    start: index === 0 ? margin.left : (x(index - 1) + x(index)) / 2,
    end: index === days.length - 1 ? width - margin.right : (x(index) + x(index + 1)) / 2,
  });
  const expenseLine = smoothLinePath(days.map((day, index) => ({ x: x(index), y: y(day.total) })));
  const incomeLine = smoothLinePath(days.map((day, index) => ({ x: x(index), y: y(day.income) })));
  const tickIndexes = days.reduce<number[]>((result, _day, index) => {
    const isYearTick = displayedRange === 'year' && (index === 0 || days[index - 1]?.date.slice(5, 7) !== days[index].date.slice(5, 7));
    const interval = Math.max(1, Math.ceil(days.length / (displayedRange === 'week' ? 7 : 6)));
    if (isYearTick || (displayedRange !== 'year' && (index % interval === 0 || index === days.length - 1))) result.push(index);
    return result;
  }, []);

  const showHover = (index: number) => {
    const host = hostRef.current;
    if (!host || width <= 0) return;
    const bounds = host.getBoundingClientRect();
    const naturalLeft = (x(index) / width) * bounds.width;
    const left = Math.min(bounds.width - 100, Math.max(100, naturalLeft));
    setHover((current) => current?.index === index && current.left === left ? current : { index, left });
  };

  return <section className={styles.section} aria-labelledby="spending-trend-title">
    <div className={styles.heading}>
      <div><h2 id="spending-trend-title">收支趋势</h2><p>双折线展示每日收支，柱体展示支出分类构成</p></div>
      <div className={styles.rangeSwitch} aria-label="收支趋势时间范围">
        {RANGE_OPTIONS.map((option) => <button type="button" key={option.value} aria-pressed={range === option.value}
          className={range === option.value ? styles.rangeActive : ''} onClick={() => onRangeChange(option.value)}>{option.label}</button>)}
      </div>
    </div>

    <div className={styles.chartHost} ref={hostRef} onMouseLeave={() => setHover(null)}>
      {width > 0 && <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby="expense-chart-title expense-chart-description">
        <title id="expense-chart-title">每日收支趋势与支出分类堆叠图</title>
        <desc id="expense-chart-description">每日支出和收入分别以折线连接，每根柱子由当天不同支出分类堆叠组成，可悬停查看明细。</desc>
        {[0, .5, 1].map((ratio) => {
          const gridY = margin.top + plotHeight * (1 - ratio);
          return <g key={ratio}><line x1={margin.left} x2={width - margin.right} y1={gridY} y2={gridY} className={styles.gridLine} />
            <text x={margin.left - 9} y={gridY + 3} textAnchor="end" className={styles.axisLabel}>{compactMoney(maxValue * ratio)}</text></g>;
        })}
        {hover && <rect x="0" y={margin.top}
          width={cellBounds(hover.index).end - cellBounds(hover.index).start} height={plotHeight} className={styles.hoverBand}
          style={{ transform: `translateX(${cellBounds(hover.index).start}px)` }} />}
        <g key={`${chart?.range}-${chart?.from}`} className={styles.dataLayer}>
          {days.map((day, index) => {
            let accumulated = 0;
            return <g key={day.date}>{day.categories.map((item) => {
              const segmentHeight = (item.amount / maxValue) * plotHeight;
              accumulated += item.amount;
              const isDimmed = hover !== null && hover.index !== index;
              return <rect key={item.category} x={x(index) - barWidth / 2} y={y(accumulated)} width={barWidth}
                height={Math.max(.5, segmentHeight)} rx="1.5" fill={categoryColor(item.category)} className={isDimmed ? styles.barDimmed : styles.bar} />;
            })}</g>;
          })}
          {expenseLine && <path d={expenseLine} className={styles.expenseLine} />}
          {incomeLine && <path d={incomeLine} className={styles.incomeLine} />}
          {days.filter((day) => day.total > 0).map((day) => {
            const index = days.indexOf(day);
            return <circle key={`expense-${day.date}`} cx={x(index)} cy={y(day.total)}
              r={hover?.index === index ? 3.6 : 2.4} className={`${styles.trendPoint} ${styles.expensePoint}`} />;
          })}
          {days.filter((day) => day.income > 0).map((day) => {
            const index = days.indexOf(day);
            return <circle key={`income-${day.date}`} cx={x(index)} cy={y(day.income)}
              r={hover?.index === index ? 3.6 : 2.4} className={`${styles.trendPoint} ${styles.incomePoint}`} />;
          })}
        </g>
        {hover && <line x1="0" x2="0" y1={margin.top} y2={margin.top + plotHeight} className={styles.hoverLine}
          style={{ transform: `translateX(${x(hover.index)}px)` }} />}
        {tickIndexes.map((index) => <text key={days[index].date} x={x(index)} y={height - 8} textAnchor="middle" className={styles.axisLabel}>{dateLabel(days[index].date, displayedRange)}</text>)}
        {days.map((day, index) => <rect key={`hit-${day.date}`} x={cellBounds(index).start} y={margin.top}
          width={cellBounds(index).end - cellBounds(index).start} height={plotHeight}
          className={styles.hitArea} tabIndex={day.total > 0 || day.income > 0 ? 0 : -1} role="img"
          aria-label={`${fullDateLabel(day.date)}，支出 ¥${day.total.toFixed(2)}，收入 ¥${day.income.toFixed(2)}`}
          onMouseEnter={() => showHover(index)}
          onFocus={() => showHover(index)} onBlur={() => setHover(null)} />)}
      </svg>}

      {activeDay && <div className={styles.tooltip}
        style={{ '--tooltip-x': `${hover?.left ?? 0}px` } as React.CSSProperties} role="status">
        <div key={activeDay.date} className={styles.tooltipContent}>
          <div className={styles.tooltipHeading}><span>{fullDateLabel(activeDay.date)}</span></div>
          <div className={styles.tooltipTotals}>
            <span><i className={styles.expenseSwatch} />支出<strong>¥{activeDay.total.toFixed(2)}</strong></span>
            <span><i className={styles.incomeSwatch} />收入<strong>¥{activeDay.income.toFixed(2)}</strong></span>
          </div>
          {activeDay.categories.length ? <div className={styles.tooltipRows}>{activeDay.categories.map((item) => <div key={item.category}>
            <span><i style={{ backgroundColor: categoryColor(item.category) }} />{item.category}</span><b>¥{item.amount.toFixed(2)}</b>
          </div>)}</div> : <p>当天暂无支出分类</p>}
        </div>
      </div>}
      {loading && <div className={styles.loadingState} aria-live="polite"><span />正在更新…</div>}
      {error && <div className={styles.errorState} role="alert">{error}</div>}
    </div>

    <div className={styles.chartFooter}>
      <div className={styles.periodTotals}>
        <span>区间支出 <strong>¥{(chart?.totalExpense ?? 0).toFixed(2)}</strong></span>
        <span>区间收入 <strong>¥{(chart?.totalIncome ?? 0).toFixed(2)}</strong></span>
      </div>
      <div className={styles.legend}>
        <span><i className={styles.expenseLineSwatch} />支出</span>
        <span><i className={styles.incomeLineSwatch} />收入</span>
        {categories.map((category) => <span key={category}><i style={{ backgroundColor: categoryColor(category) }} />{category}</span>)}
      </div>
    </div>
  </section>;
};
