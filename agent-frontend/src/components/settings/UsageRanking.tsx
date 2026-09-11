import { useId, useMemo, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronUp, Search } from 'lucide-react';
import { Button } from '../common/Button';
import { Select } from '../common/Select';
import { formatTokenCount } from '../chat/tokenUsageFormat';
import { percentage } from './tokenUsageAnalytics';
import styles from './UsageRanking.module.css';

export interface UsageRankingRow {
  key: string;
  label: string;
  detail?: string;
  tokens: number;
  calls?: number;
}

/** 统一展示用量排行，长列表提供搜索、排序与渐进展开。 */
export function UsageRanking({ title, description, icon, rows, searchable = false }: {
  title: string; description: string; icon: ReactNode; rows: UsageRankingRow[]; searchable?: boolean;
}) {
  const id = useId();
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('tokens');
  const total = rows.reduce((sum, row) => sum + row.tokens, 0);
  const filtered = useMemo(() => rows.filter(row => `${row.label} ${row.detail ?? ''}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
    .sort((a, b) => sort === 'name' ? a.label.localeCompare(b.label) : b.tokens - a.tokens || a.label.localeCompare(b.label)), [rows, query, sort]);
  const visible = expanded ? filtered : filtered.slice(0, 5);
  return <section className={styles.section} aria-labelledby={`${id}-title`}>
    <header className={styles.heading}><span className={styles.icon} aria-hidden="true">{icon}</span><div><h2 id={`${id}-title`}>{title}</h2><p>{description}</p></div><span className={styles.count}>{rows.length} 项</span></header>
    {searchable && rows.length > 0 && <div className={styles.filters}>
      <label className={styles.search}><Search size={14} aria-hidden="true" /><input aria-label={`搜索${title}`} placeholder="搜索工具名称" value={query} onChange={event => { setQuery(event.target.value); setExpanded(false); }} /></label>
      <Select aria-label={`${title}排序`} appearance="ghost" value={sort} onChange={event => setSort(event.target.value)} options={[{ value: 'tokens', label: '用量优先' }, { value: 'name', label: '名称排序' }]} />
    </div>}
    <ol className={styles.list} id={`${id}-list`}>
      {visible.map((row, index) => <li key={row.key}>
        <span className={styles.rank}>{String(index + 1).padStart(2, '0')}</span>
        <div className={styles.item}><div className={styles.row}><strong title={row.label}>{row.label}</strong><span>{formatTokenCount(row.tokens)}</span></div>
          <div className={styles.track} aria-hidden="true"><span style={{ width: `${total > 0 ? row.tokens / total * 100 : 0}%` }} /></div>
          <div className={styles.meta}><span>{row.detail}{row.calls !== undefined ? ` · ${row.calls.toLocaleString()} 次调用` : ''}</span><span>{percentage(row.tokens, total)}</span></div>
        </div>
      </li>)}
    </ol>
    {filtered.length === 0 && <p className={styles.empty}>{query ? '没有匹配的工具，试试其他名称。' : '所选范围内暂无数据。'}</p>}
    {filtered.length > 5 && <Button variant="ghost" size="sm" aria-expanded={expanded} aria-controls={`${id}-list`} icon={expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />} onClick={() => setExpanded(!expanded)}>{expanded ? '收起列表' : `展开其余 ${filtered.length - 5} 项`}</Button>}
  </section>;
}
