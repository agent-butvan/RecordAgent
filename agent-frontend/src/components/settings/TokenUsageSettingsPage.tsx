import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { fetchTokenUsageOverview } from '../../services/tokenUsageService';
import type { TokenUsageOverview } from '../../types/tokenUsage';
import { formatTokenCount } from '../chat/tokenUsageFormat';
import { Button } from '../common/Button';
import { SettingsPageLayout } from './SettingsPageLayout';
import styles from './TokenUsageSettingsPage.module.css';

type UsageRange = '7d' | '30d' | 'all';

const PURPOSE_LABELS: Record<string, string> = {
  CHAT: '聊天',
  SESSION_TITLE: '会话标题',
  CONTEXT_COMPACTION: '上下文压缩',
  BACKGROUND_AGENT: '后台 Agent',
};

/** 设置中的全局 Token 用量读模型，只在进入页面和主动切换范围时查询。 */
export const TokenUsageSettingsPage: React.FC = () => {
  const [range, setRange] = useState<UsageRange>('30d');
  const [overview, setOverview] = useState<TokenUsageOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const dateRange = useMemo(() => createDateRange(range), [range]);
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setOverview(await fetchTokenUsageOverview(dateRange));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '读取 Token 用量失败');
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => { void load(); }, [load]);

  return (
    <SettingsPageLayout
      title="Token 用量"
      description="汇总聊天与会话标题等模型调用；数据来自本地聊天记录，SQLite 仅用于统计查询。"
      actions={(
        <Button variant="outline" icon={<RefreshCw size={14} />} onClick={() => void load()} disabled={loading}>
          刷新
        </Button>
      )}
    >
      <div className={styles.rangeTabs} role="group" aria-label="统计时间范围">
        {([
          ['7d', '近 7 天'],
          ['30d', '近 30 天'],
          ['all', '全部'],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={`${styles.rangeTab} ${range === value ? styles.rangeTabActive : ''}`}
            aria-pressed={range === value}
            onClick={() => setRange(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {loading && !overview && <div className={styles.state}>正在汇总本地 Token 用量…</div>}
      {error && !overview && (
        <div className={styles.state} role="alert">
          <p>{error}</p>
          <Button variant="outline" onClick={() => void load()}>重新加载</Button>
        </div>
      )}
      {overview && <UsageContent overview={overview} stale={Boolean(error)} />}
    </SettingsPageLayout>
  );
};

const UsageContent: React.FC<{ overview: TokenUsageOverview; stale: boolean }> = ({ overview, stale }) => {
  const { totals } = overview;
  const maxDailyTokens = Math.max(1, ...overview.daily.map((item) => item.totalTokens));
  return (
    <div className={styles.content} aria-live="polite">
      {stale && <p className={styles.staleNotice}>刷新失败，当前显示上次成功加载的数据。</p>}
      <section className={styles.summary} aria-labelledby="usage-summary-title">
        <div>
          <h2 id="usage-summary-title">总消耗</h2>
          <strong>{formatTokenCount(totals.totalTokens)}</strong>
          <span>tokens</span>
        </div>
        <dl className={styles.summaryDetails}>
          <div><dt>输入</dt><dd>{formatTokenCount(totals.inputTokens)}</dd></div>
          <div><dt>输出</dt><dd>{formatTokenCount(totals.outputTokens)}</dd></div>
          <div><dt>缓存输入</dt><dd>{formatTokenCount(totals.cachedInputTokens)}</dd></div>
          <div><dt>模型调用</dt><dd>{totals.reportedCallCount}/{totals.modelCallCount}</dd></div>
          <div><dt>已统计轮次</dt><dd>{totals.trackedTurnCount}/{totals.turnCount}</dd></div>
        </dl>
      </section>

      {totals.status !== 'COMPLETE' && totals.modelCallCount > 0 && (
        <p className={styles.completenessNote}>部分模型调用未返回用量，当前合计可能偏低。</p>
      )}

      <section className={styles.section} aria-labelledby="usage-trend-title">
        <div className={styles.sectionHeading}>
          <h2 id="usage-trend-title">每日趋势</h2>
          <span>{overview.daily.length} 个有用量的日期</span>
        </div>
        {overview.daily.length === 0 ? (
          <p className={styles.empty}>所选范围内暂无可统计的 Token 用量。</p>
        ) : (
          <div className={styles.chart} role="img" aria-label="每日 Token 用量柱状图">
            {overview.daily.map((item) => (
              <div className={styles.chartColumn} key={item.date}>
                <div
                  className={styles.chartBar}
                  style={{ height: `${Math.max(4, item.totalTokens / maxDailyTokens * 100)}%` }}
                  title={`${item.date}：${item.totalTokens.toLocaleString()} tokens`}
                />
                <span>{formatShortDate(item.date)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className={styles.breakdowns}>
        <BreakdownTable
          title="输入构成"
          rows={[
            ['system', 'System Prompt', overview.breakdown.systemPromptTokens],
            ['history', 'History', overview.breakdown.historyTokens],
            ['user', 'Current User', overview.breakdown.currentUserTokens],
            ['schema', 'Tool Schema', overview.breakdown.toolSchemaTokens],
            ['result', 'Tool Result', overview.breakdown.toolResultTokens],
            ['rag', 'RAG Context', overview.breakdown.ragContextTokens],
            ['other', 'Other / Protocol', overview.breakdown.otherTokens],
          ]}
        />
        <UsageTable
          title="按模型"
          rows={overview.byModel.map((item) => ({
            key: `${item.vendor}/${item.model}`,
            label: item.model || '未知模型',
            detail: item.vendor || '未知供应商',
            tokens: item.totalTokens,
            calls: item.modelCallCount,
          }))}
        />
        <UsageTable
          title="按用途"
          rows={overview.byPurpose.map((item) => ({
            key: item.purpose,
            label: PURPOSE_LABELS[item.purpose] || item.purpose,
            detail: `${item.reportedCallCount}/${item.modelCallCount} 次已上报`,
            tokens: item.totalTokens,
            calls: item.modelCallCount,
          }))}
        />
        <BreakdownTable
          title="按工具"
          rows={overview.byTool.map((item) => ([
            item.toolName,
            item.toolName,
            item.schemaTokens + item.resultTokens,
          ]))}
          details={Object.fromEntries(overview.byTool.map((item) => ([
            item.toolName,
            `schema ${formatTokenCount(item.schemaTokens)} · result ${formatTokenCount(item.resultTokens)}`,
          ])))}
        />
      </div>
    </div>
  );
};

const UsageTable: React.FC<{
  title: string;
  rows: Array<{ key: string; label: string; detail: string; tokens: number; calls: number }>;
}> = ({ title, rows }) => (
  <section className={styles.section} aria-label={title}>
    <div className={styles.sectionHeading}><h2>{title}</h2></div>
    {rows.length === 0 ? <p className={styles.empty}>暂无数据</p> : (
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr><th>项目</th><th>调用</th><th>Token</th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <td><strong>{row.label}</strong><span>{row.detail}</span></td>
                <td>{row.calls}</td>
                <td>{formatTokenCount(row.tokens)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </section>
);

const BreakdownTable: React.FC<{
  title: string;
  rows: Array<[string, string, number]>;
  details?: Record<string, string>;
}> = ({ title, rows, details = {} }) => (
  <section className={styles.section} aria-label={title}>
    <div className={styles.sectionHeading}><h2>{title}</h2></div>
    {rows.length === 0 ? <p className={styles.empty}>暂无数据</p> : (
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr><th>项目</th><th>Token</th></tr></thead>
          <tbody>
            {rows.map(([key, label, tokens]) => (
              <tr key={key}>
                <td><strong>{label}</strong>{details[key] && <span>{details[key]}</span>}</td>
                <td>{formatTokenCount(tokens)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </section>
);

function createDateRange(range: UsageRange): { from?: string; to?: string } {
  if (range === 'all') return {};
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - (range === '7d' ? 6 : 29));
  return { from: formatLocalDate(from), to: formatLocalDate(to) };
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatShortDate(value: string): string {
  const [, month, day] = value.split('-');
  return `${month}/${day}`;
}
