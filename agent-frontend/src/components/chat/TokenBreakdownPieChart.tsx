import React, { useId } from 'react';
import type { InputTokenBreakdown } from '../../types/chat';
import { formatTokenCount } from './tokenUsageFormat';
import styles from './TokenBreakdownPieChart.module.css';

interface TokenBreakdownPieChartProps {
  breakdown: InputTokenBreakdown;
}

interface ChartSegment {
  key: keyof InputTokenBreakdown;
  label: string;
  value: number;
  color: string;
}

const SEGMENT_DEFINITIONS: Array<Omit<ChartSegment, 'value'>> = [
  { key: 'systemPromptTokens', label: '系统提示', color: '#2563eb' },
  { key: 'historyTokens', label: '历史消息', color: '#7c3aed' },
  { key: 'currentUserTokens', label: '当前输入', color: '#0f766e' },
  { key: 'toolSchemaTokens', label: '工具定义', color: '#d97706' },
  { key: 'toolResultTokens', label: '工具结果', color: '#dc2626' },
  { key: 'ragContextTokens', label: 'RAG 上下文', color: '#0284c7' },
  { key: 'otherTokens', label: '其他 / 协议', color: '#64748b' },
];

const CHART_CENTER = 60;
const CHART_RADIUS = 52;

/** 使用 SVG 饼图与文字图例展示输入 Token 构成，避免仅依赖颜色传达数据。 */
export const TokenBreakdownPieChart: React.FC<TokenBreakdownPieChartProps> = ({ breakdown }) => {
  const titleId = useId();
  const segments = SEGMENT_DEFINITIONS
    .map((segment) => ({ ...segment, value: breakdown[segment.key] }))
    .filter((segment) => segment.value > 0);
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);

  if (total <= 0) return null;

  let currentAngle = -90;
  const slices = segments.map((segment) => {
    const startAngle = currentAngle;
    const sweepAngle = (segment.value / total) * 360;
    currentAngle += sweepAngle;
    return { ...segment, startAngle, endAngle: currentAngle, sweepAngle };
  });

  return (
    <div className={styles.chart}>
      <svg
        className={styles.pie}
        viewBox="0 0 120 120"
        role="img"
        aria-labelledby={titleId}
      >
        <title id={titleId}>输入 Token 构成占比</title>
        {slices.map((slice) => slice.sweepAngle >= 359.999 ? (
          <circle
            key={slice.key}
            cx={CHART_CENTER}
            cy={CHART_CENTER}
            r={CHART_RADIUS}
            fill={slice.color}
          />
        ) : (
          <path
            key={slice.key}
            d={describeSlice(slice.startAngle, slice.endAngle)}
            fill={slice.color}
          />
        ))}
      </svg>

      <ul className={styles.legend} aria-label="输入 Token 构成图例">
        {segments.map((segment) => (
          <li key={segment.key}>
            <span className={styles.swatch} style={{ backgroundColor: segment.color }} aria-hidden="true" />
            <span className={styles.legendLabel}>{segment.label}</span>
            <span className={styles.legendValue}>
              {formatTokenCount(segment.value)} · {formatPercentage(segment.value, total)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

function describeSlice(startAngle: number, endAngle: number): string {
  const start = pointOnCircle(startAngle);
  const end = pointOnCircle(endAngle);
  const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;
  return [
    `M ${CHART_CENTER} ${CHART_CENTER}`,
    `L ${start.x} ${start.y}`,
    `A ${CHART_RADIUS} ${CHART_RADIUS} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`,
    'Z',
  ].join(' ');
}

function pointOnCircle(angle: number): { x: number; y: number } {
  const radians = (angle * Math.PI) / 180;
  return {
    x: CHART_CENTER + CHART_RADIUS * Math.cos(radians),
    y: CHART_CENTER + CHART_RADIUS * Math.sin(radians),
  };
}

function formatPercentage(value: number, total: number): string {
  const percentage = (value / total) * 100;
  if (percentage < 0.1) return '<0.1%';
  return `${percentage < 1 ? percentage.toFixed(1) : Math.round(percentage)}%`;
}
