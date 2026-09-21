import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { CheckIcon } from '@phosphor-icons/react';
import {
  ArrowUpRight,
  CalendarDays,
  ChevronDown,
  CircleAlert,
  Clock,
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Compass,
  Droplets,
  ListChecks,
  MapPin,
  RefreshCw,
  Sparkles,
  Sun,
  Thermometer,
  TrendingDown,
  TrendingUp,
  WalletCards,
  Wind,
  X,
} from 'lucide-react';
import { fetchDailyDay, setDailyTodoCompleted, formatLocalDate } from '../../../services/dailyEvents';
import { fetchDailyContextSummary, type DailyContextSummary } from '../../../services/dailyContextApi';
import { fetchFinanceExpenseChart, fetchFinanceOverview } from '../../../services/financeApi';
import {
  getFeaturePreferences,
  subscribeFeaturePreferences,
} from '../../../services/featurePreferences';
import type { DailyDay, TodoDailyEvent } from '../../../types/dailyEvent';
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

/** 天气以小面积语义色区分晴、雨、雷暴与阴天。 */
function getWeatherVisual(condition: string = '', size = 13) {
  const c = condition.trim();
  if (c.includes('雷')) {
    return {
      icon: <CloudLightning size={size} />,
      className: styles.weatherStorm,
      label: condition || '雷阵雨',
    };
  }
  if (c.includes('暴雨') || c.includes('大雨')) {
    return {
      icon: <CloudRain size={size} />,
      className: styles.weatherRain,
      label: condition || '大雨',
    };
  }
  if (c.includes('雨')) {
    return {
      icon: <CloudDrizzle size={size} />,
      className: styles.weatherRain,
      label: condition || '小雨',
    };
  }
  if (c.includes('雪')) {
    return {
      icon: <CloudSnow size={size} />,
      className: styles.weatherCool,
      label: condition || '雪',
    };
  }
  if (c.includes('阴')) {
    return {
      icon: <Cloud size={size} />,
      className: styles.weatherCloud,
      label: condition || '阴',
    };
  }
  if (c.includes('多云')) {
    return {
      icon: <CloudSun size={size} />,
      className: styles.weatherCloud,
      label: condition || '多云',
    };
  }
  if (c.includes('晴')) {
    return {
      icon: <Sun size={size} />,
      className: styles.weatherSun,
      label: condition || '晴',
    };
  }
  if (c.includes('风')) {
    return {
      icon: <Wind size={size} />,
      className: styles.weatherCool,
      label: condition || '有风',
    };
  }
  if (c.includes('雾') || c.includes('霾')) {
    return {
      icon: <CloudFog size={size} />,
      className: styles.weatherCloud,
      label: condition || '雾霾',
    };
  }
  return {
    icon: <CloudSun size={size} />,
    className: styles.weatherCloud,
    label: condition || '多云',
  };
}

/** 聊天顶栏的个人信息入口；统一轻量浮窗，通过顶栏切换模块并直接完成待办 */
export function ChatTopBarInformation({ onOpenFeature }: ChatTopBarInformationProps) {
  const [preferences, setPreferences] = useState(getFeaturePreferences);
  const [activeModule, setActiveModule] = useState<TopBarModuleId | null>(null);
  const [today, setToday] = useState(() => new Date());
  const rootRef = useRef<HTMLDivElement>(null);
  const popoverId = useId();

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
      if (event.key === 'Escape') {
        rootRef.current?.querySelector<HTMLButtonElement>('[aria-expanded="true"]')?.focus();
        setActiveModule(null);
      }
    };
    document.addEventListener('pointerdown', closeOnOutsidePress);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePress);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [activeModule]);

  const weatherVisual = useMemo(() => {
    return getWeatherVisual(dailyContextResource.data?.weather?.condition, 13);
  }, [dailyContextResource.data?.weather?.condition]);

  const visible = preferences.chatTopBar;
  if (!visible.showDate && !visible.showTodos && !visible.showFinance
      && !visible.showHoliday && !visible.showWeather) return null;

  const toggle = (module: TopBarModuleId) => {
    setActiveModule((current) => current === module ? null : module);
  };

  return (
    <div ref={rootRef} className={styles.root} aria-label="今日概况">
      {/* 顶部胶囊触发按钮群 */}
      <div className={styles.triggers} role="toolbar" aria-label="顶栏状态概览">
        {(visible.showDate || visible.showHoliday) && (
          <InformationTrigger
            moduleId="date"
            icon={<CalendarDays size={13} />}
            summary={dateSummary(today, visible.showHoliday ? dailyContextResource : null)}
            active={activeModule === 'date'}
            controlsId={popoverId}
            onClick={() => toggle('date')}
          />
        )}
        {visible.showTodos && (
          <InformationTrigger
            moduleId="todos"
            icon={<ListChecks size={13} />}
            summary={todoSummary(todoResource)}
            active={activeModule === 'todos'}
            controlsId={popoverId}
            onClick={() => toggle('todos')}
          />
        )}
        {visible.showFinance && (() => {
          const fin = financeSummary(financeResource, dateKey);
          return (
            <InformationTrigger
              moduleId="finance"
              icon={<WalletCards size={13} />}
              summary={fin.node}
              ariaSummary={fin.text}
              active={activeModule === 'finance'}
              controlsId={popoverId}
              onClick={() => toggle('finance')}
            />
          );
        })()}
        {visible.showWeather && (
          <InformationTrigger
            moduleId="weather"
            icon={
              <span className={`${styles.weatherIcon} ${weatherVisual.className}`}>
                {weatherVisual.icon}
              </span>
            }
            summary={weatherSummary(dailyContextResource)}
            active={activeModule === 'weather'}
            controlsId={popoverId}
            onClick={() => toggle('weather')}
          />
        )}
      </div>

      {/* 悬浮 Popover 卡片面板 */}
      {activeModule && (
        <div
          id={popoverId}
          className={styles.popover}
          role="dialog"
          aria-modal="false"
          aria-label={`${activeModule === 'date' ? '日期' : activeModule === 'todos' ? '待办' : activeModule === 'finance' ? '财务' : '天气'}详情`}
        >
          <button
            type="button"
            className={styles.closeBtn}
            onClick={() => setActiveModule(null)}
            aria-label="关闭详情面板"
            title="关闭（Esc）"
          >
            <X size={13} />
          </button>

          {/* 模块主体内容渲染 */}
          <div className={styles.popoverBody}>
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
                date={dateKey}
                onOpen={() => {
                  setActiveModule(null);
                  onOpenFeature('calendar');
                }}
              />
            )}
            {activeModule === 'finance' && (
              <FinanceDetail
                date={dateKey}
                resource={financeResource}
                onOpen={() => {
                  setActiveModule(null);
                  onOpenFeature('finance');
                }}
              />
            )}
            {activeModule === 'weather' && (
              <WeatherDetail resource={dailyContextResource} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function InformationTrigger({
  moduleId,
  icon,
  summary,
  ariaSummary,
  active,
  controlsId,
  onClick,
}: {
  moduleId: TopBarModuleId;
  icon: React.ReactNode;
  summary: React.ReactNode;
  ariaSummary?: string;
  active: boolean;
  controlsId: string;
  onClick: () => void;
}) {
  const label = moduleId === 'date' ? '日期' : moduleId === 'todos' ? '待办'
    : moduleId === 'finance' ? '财务' : '天气';
  return (
    <button
      type="button"
      className={`${styles.trigger} ${active ? styles.triggerActive : ''}`}
      aria-label={`${label}：${ariaSummary ?? (typeof summary === 'string' ? summary : '')}`}
      aria-expanded={active}
      aria-controls={controlsId}
      onClick={onClick}
    >
      <span className={styles.triggerIcon} aria-hidden="true">{icon}</span>
      <span className={styles.triggerSummary}>{summary}</span>
      <ChevronDown className={styles.chevron} size={11} aria-hidden="true" />
    </button>
  );
}

/* ============================
   Date & Holiday 详情组件
   ============================ */
function DateDetail({
  date,
  showHoliday,
  resource,
}: {
  date: Date;
  showHoliday: boolean;
  resource: ResourceState<DailyContextSummary>;
}) {
  const fullDateText = new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(date);

  const monthDayText = new Intl.DateTimeFormat('zh-CN', {
    month: 'long',
    day: 'numeric',
  }).format(date);

  const weekdayText = new Intl.DateTimeFormat('zh-CN', {
    weekday: 'long',
  }).format(date);

  const year = date.getFullYear();
  const totalDays = isLeapYear(year) ? 366 : 365;
  const startOfYear = new Date(year, 0, 0);
  const dayOfYear = Math.floor((date.getTime() - startOfYear.getTime()) / 86_400_000);
  const remaining = totalDays - dayOfYear;
  const progressPercent = Math.min(100, Math.max(0, ((dayOfYear / totalDays) * 100))).toFixed(1);

  const holiday = resource.data?.holiday;

  return (
    <div aria-labelledby="topbar-date-title">
      {/* 头部标题与标识 */}
      <div className={styles.cardHeader}>
        <div className={styles.cardTitleBlock}>
          <CalendarDays size={15} className={styles.triggerIcon} />
          <div>
            <h2 id="topbar-date-title" className={styles.cardTitle}>{weekdayText}</h2>
            <p className={styles.cardSubtitle}>{year} 年 · 第 {Math.ceil(dayOfYear / 7)} 周</p>
          </div>
        </div>
      </div>

      {/* Hero 日期区 */}
      <div className={styles.dateHeroCard}>
        <div className={styles.dateHeroTop}>
          <div>
            <div className={styles.dateBigNumber}>{monthDayText}</div>
            <div className={styles.dateFullText}>{fullDateText}</div>
          </div>
          <div className={styles.badgeRow}>
            {holiday?.lunarDate && (
              <span className={`${styles.badge} ${styles.badgeLunar}`}>
                农历 {holiday.lunarDate}
              </span>
            )}
            {showHoliday && holiday && (
              <span
                className={`${styles.badge} ${
                  holiday.dayOff
                    ? styles.badgeRest
                    : holiday.dayCode === 3
                    ? styles.badgeWorkShift
                    : styles.badgeNormal
                }`}
              >
                {holiday.dayOff
                  ? '今日休假'
                  : holiday.dayCode === 3
                  ? '调休上班'
                  : '工作日'}
              </span>
            )}
          </div>
        </div>

        {holiday?.name && (
          <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
            <Sparkles size={12} style={{ color: 'var(--text-muted)' }} />
            <span style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--text-secondary)' }}>
              {holiday.name}
            </span>
          </div>
        )}

        {holiday?.tip && (
          <div className={styles.tipBox}>
            {holiday.tip}
          </div>
        )}
      </div>

      {/* 当周日历带 (Week Strip) */}
      <WeekStrip currentDate={date} />

      {/* 年度进度可视化条 */}
      <div className={styles.progressCard}>
        <div className={styles.progressInfo}>
          <span className={styles.progressLabel}>{year} 年度进度</span>
          <span className={styles.progressValue}>
            第 {dayOfYear} 天 / 剩余 {remaining} 天 · {progressPercent}%
          </span>
        </div>
        <div className={styles.progressBarTrack}>
          <div
            className={styles.progressBarFill}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
    </div>
  );
}

/** 渲染当周 7 天迷你日历带 */
function WeekStrip({ currentDate }: { currentDate: Date }) {
  const currentDayOfWeek = currentDate.getDay();
  const mondayOffset = currentDayOfWeek === 0 ? -6 : 1 - currentDayOfWeek;
  const monday = new Date(currentDate);
  monday.setDate(currentDate.getDate() + mondayOffset);

  const weekDays = ['一', '二', '三', '四', '五', '六', '日'].map((label, index) => {
    const dayDate = new Date(monday);
    dayDate.setDate(monday.getDate() + index);
    const isToday = dayDate.toDateString() === currentDate.toDateString();
    const isWeekend = index >= 5;
    return {
      label,
      dateNum: dayDate.getDate(),
      isToday,
      isWeekend,
    };
  });

  return (
    <div className={styles.weekStrip} aria-label="本周日程带">
      {weekDays.map((day) => (
        <div key={day.label} className={styles.weekDayCol}>
          <span className={styles.weekDayLabel}>周{day.label}</span>
          <span
            className={`${styles.weekDayNumber} ${
              day.isToday
                ? styles.weekDayToday
                : day.isWeekend
                ? styles.weekDayWeekend
                : ''
            }`}
          >
            {day.dateNum}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ============================
   Weather 天气详情组件
   ============================ */
function WeatherDetail({ resource }: { resource: ResourceState<DailyContextSummary> }) {
  if (resource.loading && !resource.data) {
    return <div className={styles.stateContainer}>正在获取实时天气信息…</div>;
  }
  if (resource.error && !resource.data) {
    return (
      <div className={styles.stateContainer}>
        <CircleAlert size={18} style={{ margin: '0 auto 6px', color: 'var(--text-muted)' }} />
        <div>{resource.error}</div>
        <button type="button" className={styles.retryBtn} onClick={resource.reload}>
          <RefreshCw size={11} /> 重试
        </button>
      </div>
    );
  }
  if (resource.data?.weatherError) {
    return (
      <div className={styles.stateContainer}>
        <CircleAlert size={18} style={{ margin: '0 auto 6px', color: 'var(--text-muted)' }} />
        <div>{resource.data.weatherError}</div>
        <button type="button" className={styles.retryBtn} onClick={resource.reload}>
          <RefreshCw size={11} /> 重试
        </button>
      </div>
    );
  }

  const weather = resource.data?.weather;
  if (!weather) {
    return (
      <div className={styles.stateContainer}>
        <CloudSun size={22} style={{ margin: '0 auto 6px', color: 'var(--text-muted)' }} />
        <div>未配置天气密钥或暂无实时数据</div>
      </div>
    );
  }

  const weatherVisual = getWeatherVisual(weather.condition, 14);

  return (
    <div aria-labelledby="topbar-weather-title">
      <div className={styles.cardHeader}>
        <div className={styles.cardTitleBlock}>
          <span className={`${styles.weatherIcon} ${weatherVisual.className}`}>
            {weatherVisual.icon}
          </span>
          <div>
            <h2 id="topbar-weather-title" className={styles.cardTitle}>实时天气</h2>
            <p className={styles.cardSubtitle}>和风天气气象数据</p>
          </div>
        </div>
      </div>

      {/* Hero 天气区 */}
      <div className={styles.weatherHeroCard}>
        <div className={styles.weatherHeroTop}>
          <div className={styles.locationBadge}>
            <MapPin size={12} />
            <span>{weather.locationName}</span>
          </div>
          <span className={styles.weatherConditionTag}>
            <span className={`${styles.weatherIcon} ${weatherVisual.className}`}>
              {weatherVisual.icon}
            </span>
            <span>{weather.condition}</span>
          </span>
        </div>

        <div className={styles.weatherHeroMain}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className={`${styles.weatherIcon} ${weatherVisual.className}`}>
              {getWeatherVisual(weather.condition, 32).icon}
            </span>
            <div className={styles.weatherDegree}>
              {roundWeather(weather.temperature)}°
            </div>
          </div>
          <div className={styles.weatherDegreeSub}>
            体感 {roundWeather(weather.feelsLike)}{weather.temperatureUnit}
          </div>
        </div>
      </div>

      {/* 2x2 指标极简网格（无灰底） */}
      <div className={styles.weatherBentoGrid}>
        <div className={styles.weatherBentoItem}>
          <div className={styles.weatherBentoHeader}>
            <Thermometer size={12} />
            <span>体感温度</span>
          </div>
          <div className={styles.weatherBentoVal}>
            {roundWeather(weather.feelsLike)}{weather.temperatureUnit}
          </div>
        </div>

        <div className={styles.weatherBentoItem}>
          <div className={styles.weatherBentoHeader}>
            <Droplets size={12} />
            <span>相对湿度</span>
          </div>
          <div className={styles.weatherBentoVal}>
            {weather.humidityPercent}%
          </div>
        </div>

        <div className={styles.weatherBentoItem}>
          <div className={styles.weatherBentoHeader}>
            <Wind size={12} />
            <span>风向与风速</span>
          </div>
          <div className={styles.weatherBentoVal} style={{ fontSize: 12 }}>
            {weather.windDirection || '微风'} · {roundWeather(weather.windSpeed)} {weather.windSpeedUnit}
          </div>
        </div>

        <div className={styles.weatherBentoItem}>
          <div className={styles.weatherBentoHeader}>
            <Compass size={12} />
            <span>数据来源</span>
          </div>
          <div className={styles.weatherBentoVal} style={{ fontSize: 12 }}>
            和风天气
          </div>
        </div>
      </div>

      {weather.attributionUrl && (
        <a
          className={styles.attributionLink}
          href={weather.attributionUrl}
          target="_blank"
          rel="noreferrer"
        >
          和风天气数据来源说明 ↗
        </a>
      )}
    </div>
  );
}

/* ============================
   Todos 待办详情组件（支持直接勾选完成）
   ============================ */
function TodoDetail({
  resource,
  date,
  onOpen,
}: {
  resource: ResourceState<DailyDay>;
  date: string;
  onOpen: () => void;
}) {
  const [localTodos, setLocalTodos] = useState<TodoDailyEvent[]>([]);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (resource.data) {
      setLocalTodos(overviewTodos(resource.data));
    }
  }, [resource.data]);

  const completedCount = localTodos.filter((t) => t.details.completed).length;
  const percent = localTodos.length > 0 ? Math.round((completedCount / localTodos.length) * 100) : 0;

  const handleToggle = async (todo: TodoDailyEvent) => {
    if (pendingIds.has(todo.id)) return;
    const nextCompleted = !todo.details.completed;
    const todoDate = new Date(`${date}T12:00:00`);

    // 乐观更新状态，以确保即时触发动效
    setLocalTodos((prev) =>
      prev.map((item) =>
        item.id === todo.id
          ? {
              ...item,
              details: { ...item.details, completed: nextCompleted },
              version: item.version + 1,
            }
          : item,
      ),
    );
    setPendingIds((prev) => new Set(prev).add(todo.id));

    try {
      await setDailyTodoCompleted(todo.id, nextCompleted, todo.version, todoDate);
      resource.reload();
    } catch {
      // 失败回滚
      setLocalTodos((prev) =>
        prev.map((item) => (item.id === todo.id ? todo : item)),
      );
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(todo.id);
        return next;
      });
    }
  };

  return (
    <div aria-labelledby="topbar-todo-title">
      <div className={styles.cardHeader}>
        <div className={styles.cardTitleBlock}>
          <ListChecks size={15} className={styles.triggerIcon} />
          <div>
            <h2 id="topbar-todo-title" className={styles.cardTitle}>今日待办</h2>
            <p className={styles.cardSubtitle}>
              {localTodos.length ? `已完成 ${completedCount} / ${localTodos.length} 项` : '今日暂无安排'}
            </p>
          </div>
        </div>
        <button type="button" className={styles.actionBtn} onClick={onOpen}>
          <span>日历</span>
          <ArrowUpRight size={11} />
        </button>
      </div>

      <ResourceBody resource={resource} empty="今天还没有待办事项。">
        {localTodos.length > 0 && (
          <div className={styles.todoProgressBanner} role="progressbar" aria-label="今日待办完成进度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
            <div className={styles.progressBarTrack}>
              <div
                className={styles.progressBarFill}
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        )}

        {localTodos.length === 0 ? (
          <div className={styles.emptyCelebration}>
            <ListChecks size={22} style={{ margin: '0 auto 4px', color: 'var(--text-muted)' }} />
            <p>今天没有待办事项。</p>
          </div>
        ) : (
          <div className={styles.todoList}>
            {localTodos.map((todo) => (
              <div key={todo.id} className={styles.todoRow}>
                <div className={styles.todoLeft}>
                  <label className={styles.toggle}>
                    <input
                      className={styles.checkboxInput}
                      type="checkbox"
                      checked={todo.details.completed}
                      disabled={pendingIds.has(todo.id)}
                      onChange={() => handleToggle(todo)}
                      aria-label={`${todo.details.completed ? '取消完成' : '标记完成'}：${todo.title}`}
                    />
                    <span className={styles.checkbox} aria-hidden="true">
                      {todo.details.completed && <CheckIcon size={11} weight="bold" />}
                    </span>
                  </label>
                  <div className={styles.todoContent}>
                    <span className={styles.todoLine}>
                      <span className={todo.details.completed ? styles.todoTitleDone : styles.todoTitle}>
                        {todo.title}
                      </span>

                    </span>
                  </div>
                </div>
                <div className={styles.todoMeta}>
                  {todo.details.time && (
                    <span className={styles.todoTime}>
                      <Clock size={10} />
                      {todo.details.time}
                    </span>
                  )}
                  {todo.details.priority === 'high' && !todo.details.completed && <span
                    className={
                      todo.details.priority === 'high'
                        ? styles.priorityHigh
                        : todo.details.priority === 'medium'
                        ? styles.priorityMedium
                        : styles.priorityLow
                    }
                  >
                    {priorityLabel(todo.details.priority)}
                  </span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </ResourceBody>
    </div>
  );
}

/* ============================
   Finance 财务详情组件（收支通过文字与正负号区分）
   ============================ */
function FinanceDetail({
  date,
  resource,
  onOpen,
}: {
  date: string;
  resource: ResourceState<{ overview: FinanceOverview; chart: FinanceExpenseChart }>;
  onOpen: () => void;
}) {
  const todayDay = resource.data?.chart.days.find((day) => day.date === date);
  const todayExpense = todayDay?.total ?? 0;
  const todayIncome = todayDay?.income ?? 0;

  const monthExpense = resource.data?.overview.monthExpense ?? 0;
  const monthIncome = resource.data?.overview.monthIncome ?? 0;
  const monthBalance = monthIncome - monthExpense;

  const transactions = resource.data?.overview.transactions.filter((item) => item.date === date).slice(0, 5) ?? [];

  return (
    <div aria-labelledby="topbar-finance-title">
      <div className={styles.cardHeader}>
        <div className={styles.cardTitleBlock}>
          <WalletCards size={15} className={styles.triggerIcon} />
          <div>
            <h2 id="topbar-finance-title" className={styles.cardTitle}>今日收支</h2>
            <p className={styles.cardSubtitle}>今日流水与本月累计</p>
          </div>
        </div>
        <button type="button" className={styles.actionBtn} onClick={onOpen}>
          <span>财务</span>
          <ArrowUpRight size={11} />
        </button>
      </div>

      <ResourceBody resource={resource} empty="暂无财务记录。">
        {/* 今日双核收支卡（无灰色背景） */}
        <div className={styles.financeDualHero}>
          <div className={styles.financeCard}>
            <div className={styles.financeCardHeader}>
              <TrendingDown size={12} />
              <span>今日支出</span>
            </div>
            <div className={`${styles.financeCardVal} ${styles.expenseVal}`}>
              {todayExpense > 0 ? `-${formatMoney(todayExpense)}` : '¥0.00'}
            </div>
          </div>

          <div className={styles.financeCard}>
            <div className={styles.financeCardHeader}>
              <TrendingUp size={12} />
              <span>今日收入</span>
            </div>
            <div className={`${styles.financeCardVal} ${styles.incomeVal}`}>
              {todayIncome > 0 ? `+${formatMoney(todayIncome)}` : '¥0.00'}
            </div>
          </div>
        </div>

        {/* 本月汇总与结余条（无灰色背景） */}
        <div className={styles.monthSummaryBar}>
          <span>月支出 <strong>{formatMoney(monthExpense)}</strong></span>
          <span>月收入 <strong>{formatMoney(monthIncome)}</strong></span>
          <span>
            净结余{' '}
            <strong>
              {formatMoney(monthBalance)}
            </strong>
          </span>
        </div>

        {/* 今日流水清单 */}
        <div className={styles.transactionHeader}>今日明细</div>
        {transactions.length > 0 ? (
          <div className={styles.transactionList}>
            {transactions.map((item) => {
              const isOutflow = item.transactionType === 'expense'
                || item.transactionType === 'transfer_out'
                || item.transactionType === 'adjustment_decrease';
              return (
                <div key={item.id} className={styles.transactionRow}>
                  <div className={styles.transactionLeft}>
                    <span
                      className={styles.categoryTag}
                    >
                      {item.category || '其它'}
                    </span>
                    <div>
                      <span className={styles.transactionTitle}>{item.note || item.category}</span>
                      <span className={styles.transactionAccount}>{item.accountName}</span>
                    </div>
                  </div>
                  <span
                    className={`${styles.transactionAmount} ${isOutflow ? styles.expenseVal : styles.incomeVal}`}
                  >
                    {isOutflow ? '-' : '+'}
                    {formatMoney(item.amount, item.currency)}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ padding: '10px 0 12px', textAlign: 'center', fontSize: 11, color: 'var(--text-muted)' }}>
            今日暂无流水记账
          </div>
        )}
      </ResourceBody>
    </div>
  );
}

function ResourceBody<T>({
  resource,
  empty,
  children,
}: {
  resource: ResourceState<T>;
  empty: string;
  children: React.ReactNode;
}) {
  if (resource.loading && !resource.data) {
    return <div className={styles.stateContainer}>正在加载数据…</div>;
  }
  if (resource.error && !resource.data) {
    return (
      <div className={styles.stateContainer}>
        <CircleAlert size={18} style={{ margin: '0 auto 6px', color: 'var(--text-muted)' }} />
        <div>{resource.error}</div>
        <button type="button" className={styles.retryBtn} onClick={resource.reload}>
          <RefreshCw size={11} /> 重试
        </button>
      </div>
    );
  }
  if (!resource.data) {
    return <div className={styles.stateContainer}>{empty}</div>;
  }
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
  if (resource.error && !resource.data) return '待办不可用';
  const todos = resource.data ? overviewTodos(resource.data) : [];
  const completed = todos.filter((todo) => todo.details.completed).length;
  return todos.length ? `待办 ${completed}/${todos.length}` : '今日无待办';
}

function financeSummary(
  resource: ResourceState<{ overview: FinanceOverview; chart: FinanceExpenseChart }>,
  date: string,
): { node: React.ReactNode; text: string } {
  if (resource.loading && !resource.data) return { node: '收支加载中', text: '收支加载中' };
  if (resource.error && !resource.data) return { node: '收支不可用', text: '收支不可用' };
  const today = resource.data?.chart.days.find((day) => day.date === date);
  const expense = today?.total ?? 0;
  const income = today?.income ?? 0;
  const expenseText = formatCompactMoney(expense);
  const incomeText = formatCompactMoney(income);

  return {
    node: (
      <span className={styles.triggerFinanceCapsule}>
        <span className={styles.triggerExpense}>支 {expenseText}</span>
        <span className={styles.triggerFinanceSep}>·</span>
        <span className={styles.triggerIncome}>收 {incomeText}</span>
      </span>
    ),
    text: `支 ${expenseText} · 收 ${incomeText}`,
  };
}

function formatCompactDate(date: Date): string {
  return new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', weekday: 'short' }).format(date);
}

function dateSummary(date: Date, resource: ResourceState<DailyContextSummary> | null): string {
  const dateText = formatCompactDate(date);
  if (!resource) return dateText;
  if (resource.loading && !resource.data) return `${dateText} · 加载中`;
  const holiday = resource.data?.holiday;
  if (!holiday) return dateText;
  const status = holiday.name || (holiday.dayOff ? '休假' : holiday.dayCode === 3 ? '调休' : '工作日');
  return `${dateText} · ${status}`;
}

function weatherSummary(resource: ResourceState<DailyContextSummary>): string {
  if (resource.loading && !resource.data) return '天气加载中';
  if (resource.data?.weatherError || resource.error) return '天气不可用';
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

