import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CalendarDays,
  ChevronDown,
  CircleAlert,
  CloudSun,
  ListChecks,
  RefreshCw,
  WalletCards,
} from 'lucide-react';
import { fetchDailyDay, formatLocalDate } from '../../../services/dailyEvents';
import { fetchDailyContextSummary, type DailyContextSummary } from '../../../services/dailyContextApi';
import { fetchFinanceExpenseChart, fetchFinanceOverview } from '../../../services/financeApi';
import {
  getFeaturePreferences,
  subscribeFeaturePreferences,
} from '../../../services/featurePreferences';
import type { DailyDay } from '../../../types/dailyEvent';
import type { FinanceExpenseChart, FinanceOverview } from '../../../types/finance';
import { overviewTodos } from '../overview/overviewData';
import styles from './ChatTopBarInformation.module.css';

type TopBarModuleId = 'date' | 'todos' | 'finance' | 'weather';
type FeatureDestination = 'calendar' | 'finance' | 'study';

interface ChatTopBarInformationProps {
  onOpenFeature: (feature: FeatureDestination) => void;
}

interface ResourceState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/** 聊天顶栏的个人信息入口；各领域数据独立加载，单项故障不会影响其他入口。 */
export function ChatTopBarInformation({ onOpenFeature }: ChatTopBarInformationProps) {
  const [preferences, setPreferences] = useState(getFeaturePreferences);
  const [activeModule, setActiveModule] = useState<TopBarModuleId | null>(null);
  const [today, setToday] = useState(() => new Date());
  const rootRef = useRef<HTMLDivElement>(null);

  const dateKey = formatLocalDate(today);
  const loadToday = useCallback(
    () => fetchDailyDay(new Date(`${dateKey}T12:00:00`)),
    [dateKey],
  );
  const loadFinance = useCallback(async () => {
    const [overview, chart] = await Promise.all([
      fetchFinanceOverview(),
      fetchFinanceExpenseChart('month'),
    ]);
    return { overview, chart };
  }, []);
  const loadDailyContext = useCallback(
    () => fetchDailyContextSummary(
      dateKey,
      preferences.chatTopBar.showWeather,
      preferences.chatTopBar.showHoliday,
    ),
    [dateKey, preferences.chatTopBar.showHoliday, preferences.chatTopBar.showWeather],
  );
  const todoResource = useTopBarResource(preferences.chatTopBar.showTodos, loadToday, dateKey);
  const financeResource = useTopBarResource(preferences.chatTopBar.showFinance, loadFinance, dateKey);
  const dailyContextResource = useTopBarResource(
    preferences.chatTopBar.showWeather || preferences.chatTopBar.showHoliday,
    loadDailyContext,
    dateKey,
  );

  useEffect(() => subscribeFeaturePreferences(setPreferences), []);

  useEffect(() => {
    const updateDate = () => setToday(new Date());
    const timer = window.setInterval(updateDate, 30_000);
    window.addEventListener('focus', updateDate);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', updateDate);
    };
  }, []);

  useEffect(() => {
    if (activeModule === 'date'
        && !preferences.chatTopBar.showDate
        && !preferences.chatTopBar.showHoliday) setActiveModule(null);
    if (activeModule === 'todos' && !preferences.chatTopBar.showTodos) setActiveModule(null);
    if (activeModule === 'finance' && !preferences.chatTopBar.showFinance) setActiveModule(null);
    if (activeModule === 'weather' && !preferences.chatTopBar.showWeather) setActiveModule(null);
  }, [activeModule, preferences.chatTopBar]);

  useEffect(() => {
    if (!activeModule) return;
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setActiveModule(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActiveModule(null);
    };
    document.addEventListener('pointerdown', closeOnOutsidePress);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePress);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [activeModule]);

  const visible = preferences.chatTopBar;
  if (!visible.showDate && !visible.showTodos && !visible.showFinance
      && !visible.showHoliday && !visible.showWeather) return null;

  const toggle = (module: TopBarModuleId) => {
    setActiveModule((current) => current === module ? null : module);
  };

  return (
    <div ref={rootRef} className={styles.root} aria-label="今日信息">
      <div className={styles.triggers}>
        {(visible.showDate || visible.showHoliday) && (
          <InformationTrigger
            moduleId="date"
            icon={<CalendarDays size={14} />}
            summary={dateSummary(today, visible.showHoliday ? dailyContextResource : null)}
            active={activeModule === 'date'}
            onClick={() => toggle('date')}
          />
        )}
        {visible.showTodos && (
          <InformationTrigger
            moduleId="todos"
            icon={<ListChecks size={14} />}
            summary={todoSummary(todoResource)}
            active={activeModule === 'todos'}
            onClick={() => toggle('todos')}
          />
        )}
        {visible.showFinance && (
          <InformationTrigger
            moduleId="finance"
            icon={<WalletCards size={14} />}
            summary={financeSummary(financeResource, dateKey)}
            active={activeModule === 'finance'}
            onClick={() => toggle('finance')}
          />
        )}
        {visible.showWeather && (
          <InformationTrigger
            moduleId="weather"
            icon={<CloudSun size={14} />}
            summary={weatherSummary(dailyContextResource)}
            active={activeModule === 'weather'}
            onClick={() => toggle('weather')}
          />
        )}
      </div>

      <div
        id="chat-topbar-detail"
        className={`${styles.panel} ${activeModule ? styles.panelOpen : ''}`}
        aria-hidden={!activeModule}
      >
        <div className={styles.panelInner}>
          {activeModule === 'date' && (
            <DateDetail
              date={today}
              showHoliday={visible.showHoliday}
              resource={dailyContextResource}
            />
          )}
          {activeModule === 'todos' && (
            <TodoDetail
              resource={todoResource}
              onOpen={() => onOpenFeature('calendar')}
            />
          )}
          {activeModule === 'finance' && (
            <FinanceDetail
              date={dateKey}
              resource={financeResource}
              onOpen={() => onOpenFeature('finance')}
            />
          )}
          {activeModule === 'weather' && <WeatherDetail resource={dailyContextResource} />}
        </div>
      </div>
    </div>
  );
}

function InformationTrigger({
  moduleId,
  icon,
  summary,
  active,
  onClick,
}: {
  moduleId: TopBarModuleId;
  icon: React.ReactNode;
  summary: string;
  active: boolean;
  onClick: () => void;
}) {
  const label = moduleId === 'date' ? '日期' : moduleId === 'todos' ? '待办'
    : moduleId === 'finance' ? '财务' : '天气';
  return (
    <button
      type="button"
      className={`${styles.trigger} ${active ? styles.triggerActive : ''}`}
      aria-label={`${label}：${summary}`}
      aria-expanded={active}
      aria-controls="chat-topbar-detail"
      onClick={onClick}
    >
      <span className={styles.triggerIcon} aria-hidden="true">{icon}</span>
      <span className={styles.triggerSummary}>{summary}</span>
      <ChevronDown className={styles.chevron} size={12} aria-hidden="true" />
    </button>
  );
}

function DateDetail({
  date,
  showHoliday,
  resource,
}: {
  date: Date;
  showHoliday: boolean;
  resource: ResourceState<DailyContextSummary>;
}) {
  const fullDate = new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(date);
  const dayOfYear = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86_400_000);
  const remaining = (isLeapYear(date.getFullYear()) ? 366 : 365) - dayOfYear;
  return (
    <section className={styles.detailSection} aria-labelledby="topbar-date-title">
      <div className={styles.detailHeading}>
        <CalendarDays size={18} aria-hidden="true" />
        <div>
          <h2 id="topbar-date-title">{fullDate}</h2>
          <p>今天是今年的第 {dayOfYear} 天，还剩 {remaining} 天。</p>
          {showHoliday && <HolidayStatus resource={resource} />}
        </div>
      </div>
    </section>
  );
}

function HolidayStatus({ resource }: { resource: ResourceState<DailyContextSummary> }) {
  if (resource.loading && !resource.data) return <p className={styles.contextState}>正在读取节假日信息…</p>;
  if (resource.error && !resource.data) return <p className={styles.contextError}>{resource.error}</p>;
  if (resource.data?.holidayError) return <p className={styles.contextError}>{resource.data.holidayError}</p>;
  const holiday = resource.data?.holiday;
  if (!holiday) return <p className={styles.contextState}>暂无节假日信息。</p>;
  return (
    <div className={styles.holidayDetail}>
      <strong>{holiday.name || holiday.description}</strong>
      <span>{holiday.dayOff ? '今日休息' : holiday.dayCode === 3 ? '今日调休上班' : '今日工作'}</span>
      {holiday.lunarDate && <span>农历 {holiday.lunarDate}</span>}
      {holiday.tip && <p>{holiday.tip}</p>}
    </div>
  );
}

function WeatherDetail({ resource }: { resource: ResourceState<DailyContextSummary> }) {
  if (resource.loading && !resource.data) {
    return <section className={styles.detailSection}><p className={styles.state}>正在读取天气…</p></section>;
  }
  if (resource.error && !resource.data) {
    return <section className={styles.detailSection}><p className={styles.contextError}>{resource.error}</p></section>;
  }
  if (resource.data?.weatherError) {
    return <section className={styles.detailSection}><p className={styles.contextError}>{resource.data.weatherError}</p></section>;
  }
  const weather = resource.data?.weather;
  if (!weather) return <section className={styles.detailSection}><p className={styles.state}>暂无天气信息。</p></section>;
  return (
    <section className={styles.detailSection} aria-labelledby="topbar-weather-title">
      <div className={styles.detailHeading}>
        <CloudSun size={18} aria-hidden="true" />
        <div><h2 id="topbar-weather-title">{weather.locationName} · {weather.condition}</h2><p>数据来源：和风天气</p></div>
      </div>
      <dl className={styles.weatherMetrics}>
        <div><dt>当前温度</dt><dd>{roundWeather(weather.temperature)}{weather.temperatureUnit}</dd></div>
        <div><dt>体感温度</dt><dd>{roundWeather(weather.feelsLike)}{weather.temperatureUnit}</dd></div>
        <div><dt>相对湿度</dt><dd>{weather.humidityPercent}%</dd></div>
        <div><dt>风速</dt><dd>{roundWeather(weather.windSpeed)} {weather.windSpeedUnit}</dd></div>
      </dl>
      <a className={styles.attribution} href={weather.attributionUrl} target="_blank" rel="noreferrer">和风天气数据来源说明</a>
    </section>
  );
}

function TodoDetail({ resource, onOpen }: { resource: ResourceState<DailyDay>; onOpen: () => void }) {
  const todos = resource.data ? overviewTodos(resource.data) : [];
  const remaining = todos.filter((todo) => !todo.details.completed);
  return (
    <section className={styles.detailSection} aria-labelledby="topbar-todo-title">
      <DetailHeader
        icon={<ListChecks size={18} />}
        title="今日待办"
        description={todos.length ? `已完成 ${todos.length - remaining.length} 项，共 ${todos.length} 项` : '今天的任务安排'}
        action="打开日历"
        onAction={onOpen}
      />
      <ResourceBody resource={resource} empty="今天暂无待办事项。">
        {todos.length === 0 ? <p className={styles.state}>今天暂无待办事项。</p> : <div className={styles.itemList}>
          {remaining.slice(0, 5).map((todo) => (
            <div className={styles.itemRow} key={todo.id}>
              <span className={styles.todoMarker} aria-hidden="true" />
              <span>{todo.title}</span>
              <time>{todo.details.time || priorityLabel(todo.details.priority)}</time>
            </div>
          ))}
          {remaining.length === 0 && todos.length > 0 && <p className={styles.success}>今日待办已全部完成。</p>}
        </div>}
      </ResourceBody>
    </section>
  );
}

function FinanceDetail({
  date,
  resource,
  onOpen,
}: {
  date: string;
  resource: ResourceState<{ overview: FinanceOverview; chart: FinanceExpenseChart }>;
  onOpen: () => void;
}) {
  const today = resource.data?.chart.days.find((day) => day.date === date);
  const transactions = resource.data?.overview.transactions.filter((item) => item.date === date).slice(0, 4) ?? [];
  return (
    <section className={styles.detailSection} aria-labelledby="topbar-finance-title">
      <DetailHeader
        icon={<WalletCards size={18} />}
        title="今日收支"
        description="今日流水与本月累计"
        action="打开财务"
        onAction={onOpen}
      />
      <ResourceBody resource={resource} empty="今天暂无收支记录。">
        {resource.data && (
          <div className={styles.financeLayout}>
            <dl className={styles.metrics}>
              <div><dt>今日支出</dt><dd className={styles.expense}>{formatMoney(today?.total ?? 0)}</dd></div>
              <div><dt>今日收入</dt><dd className={styles.income}>{formatMoney(today?.income ?? 0)}</dd></div>
              <div><dt>本月支出</dt><dd>{formatMoney(resource.data.overview.monthExpense)}</dd></div>
              <div><dt>本月收入</dt><dd>{formatMoney(resource.data.overview.monthIncome)}</dd></div>
            </dl>
            {transactions.length > 0 && (
              <div className={styles.itemList}>
                {transactions.map((item) => (
                  <div className={styles.itemRow} key={item.id}>
                    <span>{item.note || item.category}</span>
                    <small>{item.accountName}</small>
                    <strong className={item.transactionType === 'expense' ? styles.expense : styles.income}>
                      {item.transactionType === 'expense' ? '−' : '+'}{formatMoney(item.amount, item.currency)}
                    </strong>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </ResourceBody>
    </section>
  );
}

function DetailHeader({ icon, title, description, action, onAction }: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <div className={styles.detailHeader}>
      <div className={styles.detailHeading}>
        <span aria-hidden="true">{icon}</span>
        <div><h2>{title}</h2><p>{description}</p></div>
      </div>
      <button type="button" className={styles.openFeature} onClick={onAction}>{action}</button>
    </div>
  );
}

function ResourceBody<T>({ resource, empty, children }: {
  resource: ResourceState<T>;
  empty: string;
  children: React.ReactNode;
}) {
  if (resource.loading && !resource.data) return <p className={styles.state}>正在加载…</p>;
  if (resource.error && !resource.data) {
    return (
      <button type="button" className={styles.errorState} onClick={resource.reload}>
        <CircleAlert size={15} aria-hidden="true" />
        <span>{resource.error}</span>
        <RefreshCw size={14} aria-hidden="true" />
      </button>
    );
  }
  if (!resource.data) return <p className={styles.state}>{empty}</p>;
  return <>{children}</>;
}

function useTopBarResource<T>(enabled: boolean, load: () => Promise<T>, refreshKey: string): ResourceState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);

  const reload = useCallback(() => {
    if (!enabled) return;
    const request = ++generation.current;
    setLoading(true);
    setError(null);
    load()
      .then((next) => { if (request === generation.current) setData(next); })
      .catch((cause) => {
        if (request === generation.current) {
          setError(cause instanceof Error ? cause.message : '信息读取失败，请重试。');
        }
      })
      .finally(() => { if (request === generation.current) setLoading(false); });
  }, [enabled, load]);

  useEffect(() => {
    const requestGeneration = generation;
    if (!enabled) {
      requestGeneration.current++;
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }
    reload();
    const refresh = () => { if (document.visibilityState === 'visible') reload(); };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      requestGeneration.current++;
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [enabled, refreshKey, reload]);

  return { data, loading, error, reload };
}

function todoSummary(resource: ResourceState<DailyDay>): string {
  if (resource.loading && !resource.data) return '待办加载中';
  if (resource.error && !resource.data) return '待办暂不可用';
  const todos = resource.data ? overviewTodos(resource.data) : [];
  const completed = todos.filter((todo) => todo.details.completed).length;
  return todos.length ? `待办 ${completed}/${todos.length}` : '今日无待办';
}

function financeSummary(
  resource: ResourceState<{ overview: FinanceOverview; chart: FinanceExpenseChart }>,
  date: string,
): string {
  if (resource.loading && !resource.data) return '收支加载中';
  if (resource.error && !resource.data) return '收支暂不可用';
  const today = resource.data?.chart.days.find((day) => day.date === date);
  return `支 ${formatCompactMoney(today?.total ?? 0)} · 收 ${formatCompactMoney(today?.income ?? 0)}`;
}

function formatCompactDate(date: Date): string {
  return new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', weekday: 'short' }).format(date);
}

function dateSummary(date: Date, resource: ResourceState<DailyContextSummary> | null): string {
  const dateText = formatCompactDate(date);
  if (!resource) return dateText;
  if (resource.loading && !resource.data) return `${dateText} · 节假日加载中`;
  const holiday = resource.data?.holiday;
  if (!holiday) return dateText;
  const status = holiday.name || (holiday.dayOff ? '休息日' : holiday.dayCode === 3 ? '调休上班' : '工作日');
  return `${dateText} · ${status}`;
}

function weatherSummary(resource: ResourceState<DailyContextSummary>): string {
  if (resource.loading && !resource.data) return '天气加载中';
  if (resource.data?.weatherError || resource.error) return '天气暂不可用';
  const weather = resource.data?.weather;
  return weather ? `${weather.condition} ${roundWeather(weather.temperature)}${weather.temperatureUnit}` : '天气未配置';
}

function roundWeather(value: number): string {
  return new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 1 }).format(value);
}

function formatCompactMoney(value: number): string {
  return new Intl.NumberFormat('zh-CN', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

function formatMoney(value: number, currency = 'CNY'): string {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function priorityLabel(priority: 'high' | 'medium' | 'low'): string {
  return priority === 'high' ? '高优先级' : priority === 'low' ? '低优先级' : '普通';
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}
