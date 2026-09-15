import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { CalendarDays, CloudSun, Pencil, RefreshCw } from 'lucide-react';
import {
  fetchDailyContextConfig,
  fetchQWeatherConsoleSummary,
  resolveDailyContextLocation,
  saveDailyContextConfig,
  type DailyContextConfig,
  type QWeatherConsoleSummary,
} from '../../services/dailyContextApi';
import { detectCurrentCoordinates, DeviceLocationError } from '../../services/deviceLocation';
import { openLocationPrivacySettings } from '../../services/systemSettings';
import type { ChatTopBarPreferences } from '../../types/preferences';
import { Button } from '../common/Button';
import { useMessage } from '../common/Message';
import { Toggle } from '../common/Toggle';
import {
  DailyContextConfigModal,
  type DailyContextFormState,
  type DailyContextProvider,
} from './DailyContextConfigModal';
import { SettingsPageLayout } from './SettingsPageLayout';
import styles from './DailyContextSettingsPage.module.css';

interface DailyContextSettingsPageProps {
  chatTopBar: ChatTopBarPreferences;
  onChatTopBarChange: (key: keyof ChatTopBarPreferences, visible: boolean) => void;
}

const EMPTY_FORM: DailyContextFormState = {
  qweatherApiHost: '', qweatherApiKey: '', locationName: '', latitude: '', longitude: '', tianApiKey: '',
};

const QWEATHER_CONSOLE_PROJECT_URL = 'https://console.qweather.com/project';

/** 天气与节假日供应商设置；后端只返回密钥是否存在，不回传密钥正文。 */
export function DailyContextSettingsPage({
  chatTopBar,
  onChatTopBarChange,
}: DailyContextSettingsPageProps) {
  const { showMessage } = useMessage();
  const [config, setConfig] = useState<DailyContextConfig | null>(null);
  const [form, setForm] = useState<DailyContextFormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [editingProvider, setEditingProvider] = useState<DailyContextProvider | null>(null);
  const [consoleSummary, setConsoleSummary] = useState<QWeatherConsoleSummary | null>(null);
  const [consoleLoading, setConsoleLoading] = useState(false);

  const loadConsoleSummary = useCallback(async (refresh: boolean) => {
    setConsoleLoading(true);
    try {
      const nextSummary = await fetchQWeatherConsoleSummary(refresh);
      setConsoleSummary(nextSummary);
      const permissionErrors = [nextSummary.financeError, nextSummary.usageError]
        .filter((message, index, errors): message is string => Boolean(message) && errors.indexOf(message) === index);
      if (permissionErrors.length > 0) {
        showMessage('error', permissionErrors.join('；'), {
          action: {
            label: '打开凭据权限设置',
            onClick: () => { window.open(QWEATHER_CONSOLE_PROJECT_URL, '_blank', 'noopener,noreferrer'); },
          },
        });
      }
    } catch (cause) {
      showMessage('error', cause instanceof Error ? cause.message : '和风控制台数据读取失败');
    } finally {
      setConsoleLoading(false);
    }
  }, [showMessage]);

  useEffect(() => {
    fetchDailyContextConfig()
      .then((loaded) => {
        setConfig(loaded);
        setForm({
          ...EMPTY_FORM,
          qweatherApiHost: loaded.qweatherApiHost,
          locationName: loaded.locationName,
          latitude: loaded.latitude?.toString() ?? '',
          longitude: loaded.longitude?.toString() ?? '',
        });
        if (loaded.qweatherApiKeyConfigured && loaded.qweatherApiHost) {
          void loadConsoleSummary(false);
        }
      })
      .catch((cause) => showMessage('error', cause instanceof Error ? cause.message : '配置读取失败'))
      .finally(() => setLoading(false));
  }, [loadConsoleSummary, showMessage]);

  const update = (key: keyof DailyContextFormState, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const save = async () => {
    if (!editingProvider) return;
    const latitude = optionalNumber(form.latitude);
    const longitude = optionalNumber(form.longitude);
    if (editingProvider === 'weather' && (latitude === undefined || longitude === undefined)) {
      showMessage('error', '经纬度必须填写有效数字。');
      return;
    }
    setSaving(true);
    try {
      const saved = await saveDailyContextConfig({
        qweatherApiHost: form.qweatherApiHost,
        qweatherApiKey: form.qweatherApiKey,
        clearQweatherApiKey: false,
        locationName: form.locationName,
        latitude: latitude ?? config?.latitude ?? null,
        longitude: longitude ?? config?.longitude ?? null,
        tianApiKey: form.tianApiKey,
        clearTianApiKey: false,
      });
      setConfig(saved);
      setForm((current) => ({ ...current, qweatherApiKey: '', tianApiKey: '' }));
      setEditingProvider(null);
      showMessage('success', '天气与节假日配置已保存到本机。');
      if (saved.qweatherApiKeyConfigured && saved.qweatherApiHost) {
        void loadConsoleSummary(true);
      }
    } catch (cause) {
      showMessage('error', cause instanceof Error ? cause.message : '配置保存失败');
    } finally {
      setSaving(false);
    }
  };

  const locate = async () => {
    setLocating(true);
    try {
      const coordinates = await detectCurrentCoordinates();
      setForm((current) => ({
        ...current,
        locationName: '当前位置',
        latitude: String(coordinates.latitude),
        longitude: String(coordinates.longitude),
      }));

      try {
        const resolved = await resolveDailyContextLocation(coordinates.latitude, coordinates.longitude);
        setForm((current) => ({ ...current, locationName: resolved.locationName }));
        showMessage('success', `已识别为${resolved.locationName}，定位精度约 ${coordinates.accuracy} 米；请保存配置。`);
      } catch (cause) {
        showMessage('error', cause instanceof Error
          ? `${cause.message}；经纬度已填入，可以直接保存。`
          : '地点名称识别失败；经纬度已填入，可以直接保存。');
      }
    } catch (cause) {
      if (cause instanceof DeviceLocationError && cause.reason === 'permission-denied') {
        try {
          await openLocationPrivacySettings();
          showMessage('error', '定位权限未开启，已打开系统定位设置。授权后返回此页面，再次点击“识别当前位置”。', {
            action: { label: '重新打开系统定位设置', onClick: () => void openLocationSettings() },
            duration: 0,
          });
        } catch (settingsCause) {
          showMessage('error', settingsCause instanceof Error ? settingsCause.message : '无法打开系统定位设置');
        }
        return;
      }
      showMessage('error', cause instanceof Error ? cause.message : '自动定位失败');
    } finally {
      setLocating(false);
    }
  };

  const openLocationSettings = async () => {
    try {
      await openLocationPrivacySettings();
      showMessage('info', '已重新打开系统定位设置。授权后返回此页面，再次点击“识别当前位置”。', {
        action: { label: '重新打开系统定位设置', onClick: () => void openLocationSettings() },
        duration: 0,
      });
    } catch (cause) {
      showMessage('error', cause instanceof Error ? cause.message : '无法打开系统定位设置');
    }
  };

  const weatherConfigured = Boolean(config?.qweatherApiKeyConfigured && config.qweatherApiHost.trim());
  const holidayConfigured = Boolean(config?.tianApiKeyConfigured);

  const openConfigModal = (provider: DailyContextProvider) => {
    setForm({
      ...EMPTY_FORM,
      qweatherApiHost: config?.qweatherApiHost ?? '',
      locationName: config?.locationName ?? '',
      latitude: config?.latitude?.toString() ?? '',
      longitude: config?.longitude?.toString() ?? '',
    });
    setEditingProvider(provider);
  };

  return (
    <SettingsPageLayout title="天气与节假日" description="配置聊天顶栏使用的外部数据源，密钥仅保存在本机。">
      {loading ? <p className={styles.state}>正在读取配置…</p> : (
        <div className={styles.content}>
          <section className={styles.section} aria-labelledby="weather-settings-title">
            <ProviderRow
              icon={<CloudSun size={17} />}
              headingId="weather-settings-title"
              title="和风天气"
              description="使用专属 API Host 和 API KEY 获取当前天气。"
              configured={weatherConfigured}
              enabled={chatTopBar.showWeather}
              enabledLabel="在聊天顶栏显示天气"
              onConfigure={() => openConfigModal('weather')}
              onEnabledChange={(checked) => onChatTopBarChange('showWeather', checked)}
            />
            {weatherConfigured && (
              <QWeatherConsolePanel
                summary={consoleSummary}
                loading={consoleLoading}
                onRefresh={() => void loadConsoleSummary(true)}
              />
            )}
          </section>

          <section className={styles.section} aria-labelledby="holiday-settings-title">
            <ProviderRow
              icon={<CalendarDays size={17} />}
              headingId="holiday-settings-title"
              title="天聚数行节假日"
              description="识别法定节假日、双休日和调休上班。"
              configured={holidayConfigured}
              enabled={chatTopBar.showHoliday}
              enabledLabel="在聊天顶栏显示节假日"
              onConfigure={() => openConfigModal('holiday')}
              onEnabledChange={(checked) => onChatTopBarChange('showHoliday', checked)}
            />
          </section>
        </div>
      )}
      <DailyContextConfigModal
        open={editingProvider !== null}
        provider={editingProvider}
        form={form}
        weatherConfigured={weatherConfigured}
        holidayConfigured={holidayConfigured}
        saving={saving}
        locating={locating}
        onClose={() => { if (!saving) setEditingProvider(null); }}
        onChange={update}
        onLocate={() => void locate()}
        onSubmit={() => void save()}
      />
    </SettingsPageLayout>
  );
}

function ProviderRow({
  icon,
  headingId,
  title,
  description,
  configured,
  enabled,
  enabledLabel,
  onConfigure,
  onEnabledChange,
}: {
  icon: ReactNode;
  headingId: string;
  title: string;
  description: string;
  configured: boolean;
  enabled: boolean;
  enabledLabel: string;
  onConfigure: () => void;
  onEnabledChange: (enabled: boolean) => void;
}) {
  return (
    <article className={styles.providerRow}>
      <div className={styles.providerMain}>
        <span className={styles.providerIcon} aria-hidden="true">{icon}</span>
        <div className={styles.providerCopy}>
          <h2 id={headingId}>{title}</h2>
          <p>{description}</p>
          <div className={styles.statusList} aria-label={`${title}状态`}>
            <StatusPill active={configured}>{configured ? '已配置' : '未配置'}</StatusPill>
            <StatusPill active={enabled} tone="blue">{enabled ? '已开启' : '未开启'}</StatusPill>
          </div>
        </div>
      </div>
      <div className={styles.providerActions}>
        <Button
          type="button"
          variant="outline"
          size="sm"
          icon={<Pencil size={13} />}
          onClick={onConfigure}
        >
          {configured ? '编辑配置' : '去配置'}
        </Button>
        <Toggle
          checked={enabled}
          onChange={onEnabledChange}
          label={enabledLabel}
          showLabel={false}
        />
      </div>
    </article>
  );
}

function StatusPill({ children, active, tone = 'green' }: { children: string; active: boolean; tone?: 'green' | 'blue' }) {
  return <span className={`${styles.statusPill} ${active ? styles.statusActive : styles.statusInactive} ${tone === 'blue' ? styles.statusBlue : ''}`}>{children}</span>;
}

function QWeatherConsolePanel({
  summary,
  loading,
  onRefresh,
}: {
  summary: QWeatherConsoleSummary | null;
  loading: boolean;
  onRefresh: () => void;
}) {
  const finance = summary?.finance;
  const usage = summary?.usage;
  const hasData = Boolean(finance || usage);

  return (
    <section
      className={styles.consolePanel}
      aria-labelledby="qweather-console-title"
      aria-busy={loading}
      aria-live="polite"
    >
      <div className={styles.consoleHeading}>
        <div>
          <h3 id="qweather-console-title">用量与费用</h3>
          <p>来自和风控制台 API，数据通常延迟一小时以上。</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          icon={<RefreshCw className={loading ? styles.refreshing : ''} size={13} />}
          disabled={loading}
          onClick={onRefresh}
        >
          {loading ? '刷新中' : '刷新'}
        </Button>
      </div>

      {loading && !hasData && <p className={styles.consoleState}>正在读取用量与费用…</p>}

      {hasData && (
        <>
          <dl className={styles.consoleMetrics}>
            <Metric label="账户余额" value={finance ? formatMoney(finance.balance, finance.currency) : '—'} />
            <Metric label="本月费用" value={finance ? formatMoney(finance.thisMonthCharges, finance.currency) : '—'} />
            <Metric label="昨日费用" value={finance ? formatMoney(finance.previousDayCharges, finance.currency) : '—'} />
            <Metric
              label={`待支付账单${finance?.pendingBillCount ? ` · ${finance.pendingBillCount} 笔` : ''}`}
              value={finance ? formatMoney(finance.pendingAmountDue, finance.currency) : '—'}
              warning={Boolean(finance?.pendingBillCount)}
            />
            <Metric label="24 小时成功请求" value={usage ? formatCount(usage.successRequests) : '—'} />
            <Metric label="24 小时失败请求" value={usage ? formatCount(usage.errorRequests) : '—'} warning={Boolean(usage?.errorRequests)} />
          </dl>

          {usage && usage.apis.length > 0 && (
            <div className={styles.usageBreakdown}>
              <div className={styles.usageHeader}><span>API</span><span>成功</span><span>失败</span></div>
              {usage.apis.map((item) => (
                <div className={styles.usageRow} key={item.api}>
                  <span>{formatApiName(item.api)}</span>
                  <span>{formatCount(item.successRequests)}</span>
                  <span className={item.errorRequests ? styles.errorCount : undefined}>{formatCount(item.errorRequests)}</span>
                </div>
              ))}
            </div>
          )}

          <p className={styles.consoleTimestamp}>
            数据截止：{formatAsOf(usage?.asOf ?? finance?.asOf)}
          </p>
        </>
      )}
    </section>
  );
}

function Metric({ label, value, warning = false }: { label: string; value: string; warning?: boolean }) {
  return <div><dt>{label}</dt><dd className={warning ? styles.metricWarning : undefined}>{value}</dd></div>;
}

function formatMoney(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

function formatCount(value: number): string {
  return new Intl.NumberFormat('zh-CN').format(value);
}

function formatAsOf(value?: string): string {
  if (!value) return '未知';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false });
}

function formatApiName(api: string): string {
  const names: Record<string, string> = {
    Weather: '天气', Geo: '地理位置', WeatherAlert: '天气预警',
    WeatherIndices: '天气指数', AirQuality: '空气质量', Console: '控制台',
  };
  return names[api] ?? api;
}

function optionalNumber(value: string): number | null | undefined {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
