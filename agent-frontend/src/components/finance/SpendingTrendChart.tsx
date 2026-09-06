import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { FinanceChartRange, FinanceExpenseChart } from '../../types/finance';
import { trendBuckets, trendCeiling, trendTicks } from './spendingTrendData';
import styles from './SpendingTrendChart.module.css';

const RANGE_OPTIONS: Array<{ value: FinanceChartRange; label: string }> = [
  { value: 'week', label: '本周' }, { value: 'month', label: '本月' }, { value: 'year', label: '今年' },
];
const CATEGORY_COLORS = ['#aabbd5', '#ddc0ae', '#afcbbf', '#c8b9d2', '#d9cca8', '#b5c9d2', '#dbb9bb', '#c1c9b6'];
const money = (value: number) => new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(value);
const compactMoney = (value: number) => value >= 10000
  ? `${Number((value / 10000).toFixed(2))}万` : `${Number(value.toFixed(2))}`;
const dateLabel = (date: string, range: FinanceChartRange) => range === 'year'
  ? `${Number(date.slice(5, 7))}月` : `${Number(date.slice(5, 7))}/${Number(date.slice(8))}`;
const fullDateLabel = (date: string, range: FinanceChartRange) => range === 'year'
  ? `${date.slice(0, 4)}年${Number(date.slice(5, 7))}月` : `${date.slice(0, 4)}年${Number(date.slice(5, 7))}月${Number(date.slice(8))}日`;

interface SpendingTrendChartProps {
  chart: FinanceExpenseChart | null;
  range: FinanceChartRange;
  loading: boolean;
  error: string | null;
  onRangeChange: (range: FinanceChartRange) => void;
}

/** 收支折线叠加分类堆叠柱，悬浮明细随选中日期定位，支持键盘逐期浏览。 */
export const SpendingTrendChart: React.FC<SpendingTrendChartProps> = ({ chart, range, loading, error, onRangeChange }) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const helpId = useId();
  const [width, setWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const barClipId = useId();
  const displayedRange = chart?.range ?? range;
  const days = useMemo(() => trendBuckets(chart?.days ?? [], displayedRange), [chart, displayedRange]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const update = () => setWidth(Math.floor(host.clientWidth));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);
  useEffect(() => setActiveIndex(null), [chart, range]);

  const categories = useMemo(() => {
    const totals = new Map<string, number>();
    days.forEach((day) => day.categories.forEach((item) => totals.set(item.category, (totals.get(item.category) ?? 0) + item.amount)));
    return [...totals.keys()].sort();
  }, [days]);
  const categoryColor = (category: string) => CATEGORY_COLORS[Math.max(0, categories.indexOf(category)) % CATEGORY_COLORS.length];
  const hasData = days.some((day) => day.total > 0 || day.income > 0);
  const activeDay = activeIndex === null ? null : days[activeIndex];
  const height = 248;
  const margin = { top: 18, right: 16, bottom: 30, left: 58 };
  const plotWidth = Math.max(1, width - margin.left - margin.right);
  const plotHeight = height - margin.top - margin.bottom;
  const ceiling = trendCeiling(Math.max(0, ...days.flatMap((day) => [day.total, day.income])));
  const step = plotWidth / Math.max(1, days.length);
  const x = (index: number) => margin.left + step * (index + .5);
  const y = (amount: number) => margin.top + plotHeight * (1 - amount / ceiling);
  const line = (field: 'total' | 'income') => days.map((day, index) => `${index ? 'L' : 'M'} ${x(index)} ${y(day[field])}`).join(' ');
  const interactive = !loading && !error && hasData;
  const barWidth = Math.min(36, step * .62);
  const tooltipWidth = Math.min(236, Math.max(0, width - 16));
  const activeX = activeIndex === null ? 0 : x(activeIndex);
  const tooltipLeft = Math.max(8, Math.min(width - tooltipWidth - 8,
    activeX + tooltipWidth + 24 < width ? activeX + 18 : activeX - tooltipWidth - 18));

  const selectFromPointer = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!interactive) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const localX = (event.clientX - bounds.left) * width / bounds.width;
    setActiveIndex(Math.max(0, Math.min(days.length - 1, Math.floor((localX - margin.left) / step))));
  };
  const selectFromKeyboard = (event: React.KeyboardEvent<SVGSVGElement>) => {
    if (!interactive) return;
    let next = activeIndex ?? 0;
    if (event.key === 'ArrowRight') next += 1;
    else if (event.key === 'ArrowLeft') next -= 1;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = days.length - 1;
    else if (event.key === 'Escape') { setActiveIndex(null); return; }
    else return;
    event.preventDefault();
    setActiveIndex(Math.max(0, Math.min(days.length - 1, next)));
  };

  return <section className={styles.section} aria-labelledby={titleId} aria-busy={loading}>
    <div className={styles.heading}>
      <div><h2 id={titleId}>收支趋势</h2><p>{chart ? `${chart.from.replaceAll('-', '/')} — ${chart.to.replaceAll('-', '/')}` : '查看收支变化'} · {displayedRange === 'year' ? '按月汇总' : '按日统计'}</p></div>
      <div className={styles.rangeSwitch} role="group" aria-label="收支趋势时间范围">
        {RANGE_OPTIONS.map((option) => <button type="button" key={option.value} aria-pressed={range === option.value}
          className={range === option.value ? styles.rangeActive : ''} onClick={() => onRangeChange(option.value)}>{option.label}</button>)}
      </div>
    </div>
    <div className={styles.summary}>
      <dl className={styles.periodTotals}>
        <div><dt><i className={styles.expenseSwatch} />区间支出</dt><dd className={styles.expenseText}>{chart ? money(chart.totalExpense) : '—'}</dd></div>
        <div><dt><i className={styles.incomeSwatch} />区间收入</dt><dd className={styles.incomeText}>{chart ? money(chart.totalIncome) : '—'}</dd></div>
        <div><dt>区间结余</dt><dd>{chart ? money(chart.totalIncome - chart.totalExpense) : '—'}</dd></div>
      </dl>
    </div>
    <div className={styles.chartHost} ref={hostRef} onPointerLeave={() => setActiveIndex(null)}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setActiveIndex(null); }}>
      {width > 0 && <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} role="group"
        tabIndex={interactive ? 0 : -1} aria-label="收支趋势图" aria-describedby={helpId}
        onPointerMove={selectFromPointer} onPointerDown={selectFromPointer} onKeyDown={selectFromKeyboard}
        onFocus={() => { if (interactive) setActiveIndex((current) => current ?? 0); }}>
        {[0, .25, .5, .75, 1].map((ratio) => <g key={ratio} aria-hidden="true">
          <line x1={margin.left} x2={width - margin.right} y1={y(ceiling * ratio)} y2={y(ceiling * ratio)} className={ratio === 0 ? styles.baseline : styles.gridLine} />
          <text x={margin.left - 10} y={y(ceiling * ratio) + 3} textAnchor="end" className={styles.axisLabel}>
            {compactMoney(ceiling * ratio)}{ratio === 1 ? '元' : ''}
          </text>
        </g>)}
        <g aria-hidden="true" className={loading ? styles.pendingData : undefined}>
          {interactive && activeDay && activeIndex !== null && <line x1={x(activeIndex)} x2={x(activeIndex)} y1={margin.top} y2={y(0)} className={styles.cursorLine} />}
          {days.map((day, index) => {
            let accumulated = 0;
            const segments = [...day.categories].filter((item) => item.amount > 0)
              .sort((a, b) => categories.indexOf(a.category) - categories.indexOf(b.category));
            const total = segments.reduce((sum, item) => sum + item.amount, 0);
            return <g key={day.date} className={activeIndex !== null && activeIndex !== index ? styles.barDimmed : styles.bar}>
              <defs><clipPath id={`${barClipId}-${index}`}><rect x={x(index) - barWidth / 2} y={y(total)}
                width={barWidth} height={total / ceiling * plotHeight} rx={Math.min(4, barWidth / 4)} /></clipPath></defs>
              <g clipPath={`url(#${barClipId}-${index})`}>{segments.map((item) => {
                accumulated += item.amount;
                return <rect key={item.category} x={x(index) - barWidth / 2} y={y(accumulated)}
                  width={barWidth} height={item.amount / ceiling * plotHeight} fill={categoryColor(item.category)}
                  stroke="var(--bg-app)" strokeWidth={.6} />;
              })}</g>
            </g>;
          })}
          {hasData && <><path d={line('total')} className={styles.expenseLine} /><path d={line('income')} className={styles.incomeLine} /></>}
          {hasData && days.map((day, index) => (days.length <= 12 || activeIndex === index) && <g key={day.date}>
            <circle cx={x(index)} cy={y(day.total)} r={activeIndex === index ? 4 : 2.5} className={styles.expensePoint} />
            <rect x={x(index) - (activeIndex === index ? 3.5 : 2)} y={y(day.income) - (activeIndex === index ? 3.5 : 2)}
              width={activeIndex === index ? 7 : 4} height={activeIndex === index ? 7 : 4} className={styles.incomePoint} />
          </g>)}
        </g>
        {trendTicks(days.length, plotWidth).map((index) => <text key={days[index].date} x={x(index)} y={height - 9} textAnchor="middle" className={styles.axisLabel}>{dateLabel(days[index].date, displayedRange)}</text>)}
      </svg>}
      {loading ? <div className={styles.state} role="status">正在更新收支趋势…</div>
        : error ? <div className={`${styles.state} ${styles.error}`} role="alert">{error}</div>
          : !hasData && <div className={styles.state}><strong>这个区间还没有收支记录</strong><span>记一笔后，趋势会显示在这里。</span></div>}
      {interactive && activeDay && <div className={styles.tooltip} role="status" aria-live="polite" aria-atomic="true"
        style={{ left: tooltipLeft, width: tooltipWidth }}>
        <strong className={styles.tooltipDate}>{fullDateLabel(activeDay.date, displayedRange)}</strong>
        <div className={styles.tooltipTotals}>
          <span>支出 <b className={styles.expenseText}>{money(activeDay.total)}</b></span>
          <span>收入 <b className={styles.incomeText}>{money(activeDay.income)}</b></span>
        </div>
        <div className={styles.tooltipCategories}>{activeDay.categories.length ? [...activeDay.categories]
          .sort((a, b) => categories.indexOf(a.category) - categories.indexOf(b.category))
          .map((item) => <div key={item.category}><span><i style={{ backgroundColor: categoryColor(item.category) }} />{item.category}</span><b>{money(item.amount)}</b></div>) : <p>暂无支出分类</p>}</div>
      </div>}
    </div>
    <p className={styles.visuallyHidden} id={helpId}>实线圆点为支出，虚线方点为收入，柱体显示支出分类。聚焦图表后，可用左右方向键切换日期，Home 和 End 跳至首尾，Escape 关闭明细。</p>
  </section>;
};
