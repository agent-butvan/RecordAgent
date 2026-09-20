import { useCallback, useState } from 'react';
import { DotsThree } from '@phosphor-icons/react';
import { fetchFinanceOverview, fetchFinanceExpenseChart } from '../../../services/financeApi';
import { Modal } from '../../common/Modal';
import type { FinanceTransaction } from '../../../types/finance';
import { useOverviewResource } from './useOverviewResource';
import styles from './SessionOverview.module.css';

export interface FinanceTilesProps {
  date: string;
  refreshKey: number;
  onOpenFinance: () => void;
  onCreate: () => void;
}

const money = (value: number, currency = 'CNY') => new Intl.NumberFormat('zh-CN', { style: 'currency', currency }).format(value);

export function FinanceTile({ date, refreshKey, onCreate }: Pick<FinanceTilesProps, 'date' | 'refreshKey' | 'onCreate'>) {
  const load = useCallback(async () => {
    const [overview, chart] = await Promise.all([fetchFinanceOverview(), fetchFinanceExpenseChart('month')]);
    return { overview, chart };
  }, []);
  const { data, loading, error, reload } = useOverviewResource(load, `${date}:${refreshKey}`);
  const today = data?.chart.days.find((day) => day.date === date);
  const trend = data?.chart.days.slice(-7) ?? [];
  const trendMaximum = Math.max(1, ...trend.flatMap((day) => [day.total, day.income]));

  const getPointCoords = (day: (typeof trend)[0], index: number, field: 'total' | 'income') => {
    const x = trend.length <= 1 ? 250 : (index / (trend.length - 1)) * 500;
    const y = 135 - (day[field] / trendMaximum) * 105;
    return { x: Math.round(x), y: Math.round(y) };
  };

  const trendPoints = (field: 'total' | 'income') => trend.map((day, index) => {
    const pt = getPointCoords(day, index, field);
    return `${pt.x},${pt.y}`;
  }).join(' ');

  let peakIndex = -1;
  let peakValue = 0;
  trend.forEach((day, index) => {
    if (day.total > peakValue) {
      peakValue = day.total;
      peakIndex = index;
    }
  });
  const peakPoint = peakIndex >= 0 ? getPointCoords(trend[peakIndex], peakIndex, 'total') : null;
  const todayCount = data?.overview.transactions.filter((item) => item.date === date).length ?? 0;
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const handleChartMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (trend.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const index = Math.min(trend.length - 1, Math.max(0, Math.round(ratio * (trend.length - 1))));
    setHoveredIndex(index);
  };

  const handleChartMouseLeave = () => {
    setHoveredIndex(null);
  };

  const activeDay = hoveredIndex !== null ? trend[hoveredIndex] : null;
  const activeExpensePoint = hoveredIndex !== null && activeDay ? getPointCoords(activeDay, hoveredIndex, 'total') : null;
  const activeIncomePoint = hoveredIndex !== null && activeDay ? getPointCoords(activeDay, hoveredIndex, 'income') : null;

  let tooltipTransform = 'translate(-50%, -100%)';
  if (hoveredIndex === 0) {
    tooltipTransform = 'translate(0%, -100%)';
  } else if (hoveredIndex !== null && hoveredIndex === trend.length - 1) {
    tooltipTransform = 'translate(-100%, -100%)';
  }

  return (
    <section className={`${styles.tile} ${styles.finance}`}>
      <div className={styles.tileHead}>
        <div>
          <div className={styles.eyebrow}>FINANCE</div>
          <div className={styles.title}>今日花销</div>
        </div>
        <button type="button" className={styles.more} onClick={onCreate} title="记一笔" aria-label="记一笔">
          <DotsThree size={18} weight="bold" />
        </button>
      </div>

      {loading ? (
        <p className={styles.empty}>正在加载花销数据…</p>
      ) : error ? (
        <p className={styles.error} onClick={() => void reload()}>{error}</p>
      ) : data ? (
        <>
          <div className={styles.financeTop}>
            <div>
              <div className={styles.moneyMain}>
                <span>¥</span>{(today?.total ?? 0).toFixed(2)}
              </div>
              <div className={styles.metaLine}>
                <span className={styles.dotMini} /> 今日 {todayCount} 笔流水
              </div>
            </div>
            <div className={styles.budget}>
              本月预算使用
              <b>{money(data.overview.monthExpense)}</b>
            </div>
          </div>

          <div className={styles.chartLegend}>
            <span className={styles.legendItem}>
              <span className={styles.legendLineExpense} />
              支出
            </span>
            <span className={styles.legendItem}>
              <span className={styles.legendLineIncome} />
              收入
            </span>
          </div>

          <div
            className={styles.chart}
            onMouseMove={handleChartMouseMove}
            onMouseLeave={handleChartMouseLeave}
          >
            <div className={styles.chartGrid}>
              <i /><i /><i /><i />
            </div>
            <svg viewBox="0 0 500 150" preserveAspectRatio="none" aria-hidden="true">
              {trend.length > 0 && (
                <>
                  <polyline fill="none" stroke="#b5473d" strokeWidth="2" points={trendPoints('total')} />
                  <polyline fill="none" stroke="#177245" strokeWidth="2" strokeDasharray="5 4" points={trendPoints('income')} />
                  {peakPoint && hoveredIndex === null && (
                    <circle cx={peakPoint.x} cy={peakPoint.y} r="3.4" fill="#fff" stroke="#b5473d" strokeWidth="2" />
                  )}
                  {activeExpensePoint && activeIncomePoint && (
                    <>
                      <line
                        x1={activeExpensePoint.x}
                        y1={10}
                        x2={activeExpensePoint.x}
                        y2={135}
                        stroke="#cbd5e1"
                        strokeWidth="1.5"
                        strokeDasharray="3 3"
                      />
                      <circle cx={activeExpensePoint.x} cy={activeExpensePoint.y} r="4.5" fill="#b5473d" stroke="#ffffff" strokeWidth="2" />
                      <circle cx={activeIncomePoint.x} cy={activeIncomePoint.y} r="4.5" fill="#177245" stroke="#ffffff" strokeWidth="2" />
                    </>
                  )}
                </>
              )}
            </svg>

            {hoveredIndex !== null && activeDay && activeExpensePoint && (
              <div
                className={styles.chartTooltip}
                style={{
                  left: `${(activeExpensePoint.x / 500) * 100}%`,
                  transform: tooltipTransform,
                }}
              >
                <div className={styles.tooltipDate}>
                  {Number(activeDay.date.slice(5, 7))}月{Number(activeDay.date.slice(8))}日
                </div>
                <div className={styles.tooltipRow}>
                  <span><span className={`${styles.tooltipDot} ${styles.tooltipDotExpense}`} />支出</span>
                  <span className={styles.tooltipExpense}>{money(activeDay.total)}</span>
                </div>
                <div className={styles.tooltipRow}>
                  <span><span className={`${styles.tooltipDot} ${styles.tooltipDotIncome}`} />收入</span>
                  <span className={styles.tooltipIncome}>{money(activeDay.income)}</span>
                </div>
              </div>
            )}
          </div>
          <div className={styles.chartLabels}>
            {trend.map((day) => (
              <span key={day.date}>{Number(day.date.slice(5, 7))}/{Number(day.date.slice(8))}</span>
            ))}
          </div>

          <div className={styles.financeSplit}>
            <div className={`${styles.financeStat} ${styles.red}`}>
              <span>本月支出</span>
              <b>{money(data.overview.monthExpense)}</b>
            </div>
            <div className={`${styles.financeStat} ${styles.green}`}>
              <span>本月收入</span>
              <b>{money(data.overview.monthIncome)}</b>
            </div>
            <div className={styles.financeStat}>
              <span>理财收益</span>
              <b>{money(data.overview.monthYield)}</b>
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}

export function FinanceMiniTile({ date, refreshKey, onOpenFinance }: Pick<FinanceTilesProps, 'date' | 'refreshKey' | 'onOpenFinance'>) {
  const load = useCallback(async () => {
    const overview = await fetchFinanceOverview();
    return overview;
  }, []);
  const { data, loading, error, reload } = useOverviewResource(load, `${date}:${refreshKey}`);
  const [selected, setSelected] = useState<FinanceTransaction | null>(null);

  return (
    <>
      <section className={`${styles.tile} ${styles.financeMini}`}>
        <div className={styles.tileHead} style={{ marginBottom: 4 }}>
          <div>
            <div className={styles.eyebrow}>RECENT</div>
            <div className={styles.title}>最近流水</div>
          </div>
          <span className={styles.pill} onClick={onOpenFinance}>查看全部</span>
        </div>

        {loading ? (
          <p className={styles.empty}>正在加载流水…</p>
        ) : error ? (
          <p className={styles.error} onClick={() => void reload()}>{error}</p>
        ) : data && data.transactions.length === 0 ? (
          <p className={styles.empty}>暂无流水记录。</p>
        ) : data ? (
          data.transactions.slice(0, 3).map((item) => {
            const isAdjustment = item.transactionType === 'adjustment_increase'
              || item.transactionType === 'adjustment_decrease';
            const isOut = item.transactionType === 'expense'
              || item.transactionType === 'transfer_out'
              || item.transactionType === 'adjustment_decrease';
            return (
              <button
                type="button"
                key={item.id}
                className={styles.flowRow}
                onClick={() => setSelected(item)}
              >
                <div>
                  <div className={styles.flowName}>{item.note || item.category}</div>
                  <div className={styles.flowMeta}>{item.accountName} · {item.time}</div>
                </div>
                <div className={`${styles.flowMoney} ${isAdjustment ? styles.adjustment : isOut ? styles.out : styles.in}`}>
                  {isOut ? '−' : '+'}{money(item.amount, item.currency)}
                </div>
              </button>
            );
          })
        ) : null}
      </section>

      <Modal open={selected !== null} title="流水详情" onClose={() => setSelected(null)} centered width={480}>
        {selected && (
          <>
            <div className={styles.metric}>
              <strong>{selected.transactionType === 'expense'
                || selected.transactionType === 'transfer_out'
                || selected.transactionType === 'adjustment_decrease' ? '−' : '+'}{money(selected.amount, selected.currency)}</strong>
              <span>{selected.transactionType === 'expense'
                ? '支出'
                : selected.transactionType === 'yield'
                ? '收益'
                : selected.transactionType === 'transfer_out' || selected.transactionType === 'transfer_in'
                ? '划账'
                : selected.transactionType === 'adjustment_increase' || selected.transactionType === 'adjustment_decrease'
                ? '余额校准（非收支）'
                : '收入'}</span>
            </div>
            <p>{selected.note || selected.category}</p>
            <dl className={styles.stats}>
              <div><dt>账户</dt><dd>{selected.accountName}</dd></div>
              <div><dt>分类</dt><dd>{selected.category}</dd></div>
              <div><dt>发生时间</dt><dd>{selected.date} {selected.time}</dd></div>
            </dl>
          </>
        )}
      </Modal>
    </>
  );
}

export function FinanceOverviewCard(props: FinanceTilesProps) {
  return (
    <>
      <FinanceTile date={props.date} refreshKey={props.refreshKey} onCreate={props.onCreate} />
      <FinanceMiniTile date={props.date} refreshKey={props.refreshKey} onOpenFinance={props.onOpenFinance} />
    </>
  );
}
