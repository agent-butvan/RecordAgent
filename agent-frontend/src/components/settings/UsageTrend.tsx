import { useMemo, useState } from 'react';
import { ChartColumn, ChartNoAxesCombined, ChartSpline } from 'lucide-react';
import type { TokenUsageOverview } from '../../types/tokenUsage';
import { Button } from '../common/Button';
import { Select } from '../common/Select';
import { formatTokenCount } from '../chat/tokenUsageFormat';
import { buildTrend, type TrendMetric, type TrendPeriod } from './tokenUsageAnalytics';
import styles from './UsageTrend.module.css';

const METRICS: { value: TrendMetric; label: string }[] = [
  { value: 'totalTokens', label: '总 Token' }, { value: 'inputTokens', label: '输入 Token' },
  { value: 'outputTokens', label: '输出 Token' }, { value: 'modelCallCount', label: '调用次数' },
];
const PERIODS: { value: TrendPeriod; label: string }[] = [{ value: 'day', label: '按日' }, { value: 'week', label: '按周' }, { value: 'month', label: '按月' }];

/** 自适应趋势图：补齐日期、聚合周期，并支持键盘访问每个数据点。 */
export function UsageTrend({ overview }: { overview: TokenUsageOverview }) {
  const [metric, setMetric] = useState<TrendMetric>('totalTokens');
  const [period, setPeriod] = useState<TrendPeriod>(overview.from ? 'day' : 'month');
  const [mode, setMode] = useState('bar');
  const [selected, setSelected] = useState<string | null>(null);
  const points = useMemo(() => buildTrend(overview, period), [overview, period]);
  const max = Math.max(1, ...points.map(point => point[metric]));
  const active = points.find(point => point.date === selected) ?? points.at(-1);
  const metricLabel = METRICS.find(item => item.value === metric)?.label;
  const unit = metric === 'modelCallCount' ? '次' : 'tokens';
  const coordinates = points.map((point, index) => `${(index + 0.5) / points.length * 1000},${160 - point[metric] / max * 144}`);
  return <section className={styles.section} aria-labelledby="usage-trend-title">
    <header className={styles.heading}><div className={styles.title}><ChartNoAxesCombined size={18} aria-hidden="true" /><div><h2 id="usage-trend-title">用量趋势</h2><p>查看消耗节奏，找到用量高峰</p></div></div>
      <div className={styles.controls}>
        <Select aria-label="趋势统计指标" appearance="ghost" options={METRICS} value={metric} onChange={event => setMetric(METRICS.find(item => item.value === event.target.value)!.value)} />
        <Select aria-label="趋势聚合周期" appearance="ghost" options={PERIODS} value={period} onChange={event => { setPeriod(PERIODS.find(item => item.value === event.target.value)!.value); setSelected(null); }} />
        <div className={styles.modes} role="group" aria-label="图表类型"><Button size="sm" variant="ghost" aria-label="柱状图" aria-pressed={mode === 'bar'} onClick={() => setMode('bar')}><ChartColumn size={15} /></Button><Button size="sm" variant="ghost" aria-label="折线图" aria-pressed={mode === 'line'} onClick={() => setMode('line')}><ChartSpline size={15} /></Button></div>
      </div>
    </header>
    {overview.daily.length === 0 ? <p className={styles.empty}>所选范围内暂无调用记录，开始聊天后即可查看趋势。</p> : <>
      <div className={styles.readout} aria-live="polite"><span>{active?.date}{period === 'week' ? ' 起一周' : period === 'month' ? ' 所在月' : ''}</span><strong>{formatTokenCount(active?.[metric] ?? 0)}</strong><span>{unit} · {metricLabel}</span></div>
      <div className={styles.chart}>
        <span className={styles.scale}>{formatTokenCount(max)}</span>
        <svg viewBox="0 0 1000 164" preserveAspectRatio="none" aria-hidden="true">
          {mode === 'line' && points.length > 1 && <><polygon className={styles.area} points={`${coordinates[0]?.split(',')[0]},164 ${coordinates.join(' ')} ${coordinates.at(-1)?.split(',')[0]},164`} /><polyline className={styles.line} points={coordinates.join(' ')} vectorEffect="non-scaling-stroke" /></>}
          {points.map((point, index) => {
            const x = (index + 0.5) / points.length * 1000;
            const height = point[metric] / max * 144;
            return mode === 'bar' ? <rect key={point.date} className={point.date === active?.date ? styles.activeBar : styles.bar} x={x - Math.min(22, 800 / points.length) / 2} y={160 - height} width={Math.min(22, 800 / points.length)} height={height} rx="2" />
              : <circle key={point.date} className={styles.dot} cx={x} cy={160 - height} r={point.date === active?.date || points.length === 1 ? 3 : 0} />;
          })}
        </svg>
        <div className={styles.hitAreas} role="group" aria-label="选择日期查看用量">
          {points.map(point => <button key={point.date} type="button" aria-label={`${point.date}${period === 'week' ? ' 起一周' : period === 'month' ? ' 所在月' : ''}：${point[metric].toLocaleString()} ${unit}`} aria-pressed={point.date === active?.date} title={`${point.date}：${point[metric].toLocaleString()} ${unit}`} onMouseEnter={() => setSelected(point.date)} onFocus={() => setSelected(point.date)} onClick={() => setSelected(point.date)} />)}
        </div>
      </div>
      <div className={styles.axis}><span>{points[0]?.date}</span><span>{period === 'day' ? '自然日' : period === 'week' ? '周一开始 · 首尾仅统计所选范围' : '自然月 · 首尾仅统计所选范围'}</span><span>{points.at(-1)?.date}</span></div>
    </>}
  </section>;
}
