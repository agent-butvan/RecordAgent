import React, { useId, useState } from 'react';
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
  { key: 'systemPromptTokens', label: 'System Prompt', color: 'var(--chart-system)' },
  { key: 'historyTokens', label: 'History', color: 'var(--chart-history)' },
  { key: 'currentUserTokens', label: 'Current User', color: 'var(--chart-current-user)' },
  { key: 'toolSchemaTokens', label: 'Tool Schema', color: 'var(--chart-tool-schema)' },
  { key: 'toolResultTokens', label: 'Tool Result', color: 'var(--chart-tool-result)' },
  { key: 'profileContextTokens', label: 'Personal Profile', color: 'var(--chart-profile)' },
  { key: 'memoryRecallTokens', label: 'Memory Recall', color: 'var(--chart-memory)' },
  { key: 'ragContextTokens', label: 'RAG Context', color: 'var(--chart-rag)' },
  { key: 'otherTokens', label: 'Other / Protocol', color: 'var(--chart-other)' },
];

const CHART_CENTER = 60;
const CHART_RADIUS = 50;

/** 可交互的极简 SVG 饼图，并以文本列表完整呈现每项 Token 与占比。 */
export const TokenBreakdownPieChart: React.FC<TokenBreakdownPieChartProps> = ({ breakdown }) => {
  const titleId = useId();
  const [hoveredKey, setHoveredKey] = useState<keyof InputTokenBreakdown | null>(null);
  const [selectedKey, setSelectedKey] = useState<keyof InputTokenBreakdown | null>(null);
  const segments = SEGMENT_DEFINITIONS
    .map((segment) => ({ ...segment, value: breakdown[segment.key] }))
    .filter((segment) => segment.value > 0);
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);

  if (total <= 0) return null;

  const activeKey = hoveredKey ?? selectedKey;
  const activeSegment = segments.find((segment) => segment.key === activeKey) ?? null;
  let currentAngle = -90;
  const slices = segments.map((segment) => {
    const startAngle = currentAngle;
    const sweepAngle = (segment.value / total) * 360;
    currentAngle += sweepAngle;
    return { ...segment, startAngle, endAngle: currentAngle };
  });
  const toggleSelection = (key: keyof InputTokenBreakdown) => {
    setSelectedKey((current) => current === key ? null : key);
  };

  return (
    <div className={styles.chart}>
      <div className={styles.visual}>
        <svg
          className={`${styles.pie} ${activeKey ? styles.pieHasActive : ''}`}
          viewBox="0 0 120 120"
          role="group"
          aria-labelledby={titleId}
        >
          <title id={titleId}>输入 Token 构成占比，可通过键盘或指针选择分类</title>
          {slices.map((slice) => {
            const percentage = formatPercentage(slice.value, total);
            const selected = selectedKey === slice.key;
            return (
              <path
                key={slice.key}
                className={`${styles.slice} ${activeKey === slice.key ? styles.sliceActive : ''}`}
                d={describeSlice(slice.startAngle, slice.endAngle)}
                fill={slice.color}
                tabIndex={0}
                role="button"
                aria-label={`${slice.label}，${formatTokenCount(slice.value)} tokens，占 ${percentage}`}
                aria-pressed={selected}
                onMouseEnter={() => setHoveredKey(slice.key)}
                onMouseLeave={() => setHoveredKey(null)}
                onFocus={() => setHoveredKey(slice.key)}
                onBlur={() => setHoveredKey(null)}
                onClick={() => toggleSelection(slice.key)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' && event.key !== ' ') return;
                  event.preventDefault();
                  toggleSelection(slice.key);
                }}
              />
            );
          })}
        </svg>

        <div className={styles.readout} aria-live="polite">
          <span className={styles.readoutLabel}>{activeSegment?.label ?? 'Input Total'}</span>
          <strong>{formatTokenCount(activeSegment?.value ?? total)}</strong>
          <span className={styles.readoutMeta}>
            {activeSegment ? `tokens · ${formatPercentage(activeSegment.value, total)}` : `tokens · ${segments.length} categories`}
          </span>
        </div>
      </div>

      <ul className={styles.breakdownList} aria-label="输入 Token 构成明细">
        {segments.map((segment) => {
          const selected = selectedKey === segment.key;
          return (
            <li key={segment.key}>
              <button
                type="button"
                className={`${styles.breakdownRow} ${activeKey === segment.key ? styles.breakdownRowActive : ''}`}
                aria-pressed={selected}
                onMouseEnter={() => setHoveredKey(segment.key)}
                onMouseLeave={() => setHoveredKey(null)}
                onFocus={() => setHoveredKey(segment.key)}
                onBlur={() => setHoveredKey(null)}
                onClick={() => toggleSelection(segment.key)}
              >
                <span className={styles.swatch} style={{ backgroundColor: segment.color }} aria-hidden="true" />
                <span className={styles.breakdownLabel}>{segment.label}</span>
                <span className={styles.breakdownTokens}>{formatTokenCount(segment.value)} tokens</span>
                <span className={styles.breakdownPercentage}>{formatPercentage(segment.value, total)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

function describeSlice(startAngle: number, endAngle: number): string {
  const start = pointOnCircle(startAngle);
  const end = pointOnCircle(endAngle);
  const sweepAngle = endAngle - startAngle;

  if (sweepAngle >= 359.999) {
    const opposite = pointOnCircle(startAngle + 180);
    return [
      `M ${CHART_CENTER} ${CHART_CENTER}`,
      `L ${start.x} ${start.y}`,
      `A ${CHART_RADIUS} ${CHART_RADIUS} 0 1 1 ${opposite.x} ${opposite.y}`,
      `A ${CHART_RADIUS} ${CHART_RADIUS} 0 1 1 ${start.x} ${start.y}`,
      'Z',
    ].join(' ');
  }

  const largeArcFlag = sweepAngle > 180 ? 1 : 0;
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
