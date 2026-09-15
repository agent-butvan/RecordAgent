import { useEffect, useState } from 'react';
import { ExternalLink, LocateFixed, RefreshCw, Save } from 'lucide-react';
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
import { TextInput } from '../common/TextInput';
import { Toggle } from '../common/Toggle';
import { SettingsPageLayout } from './SettingsPageLayout';
import styles from './DailyContextSettingsPage.module.css';

interface DailyContextSettingsPageProps {
  chatTopBar: ChatTopBarPreferences;
  onChatTopBarChange: (key: keyof ChatTopBarPreferences, visible: boolean) => void;
}

interface FormState {
  qweatherApiHost: string;
  qweatherApiKey: string;
  locationName: string;
  latitude: string;
  longitude: string;
  tianApiKey: string;
}

const EMPTY_FORM: FormState = {
  qweatherApiHost: '', qweatherApiKey: '', locationName: '', latitude: '', longitude: '', tianApiKey: '',
};

/** 天气与节假日供应商设置；后端只返回密钥是否存在，不回传密钥正文。 */
export function DailyContextSettingsPage({
  chatTopBar,
  onChatTopBarChange,
}: DailyContextSettingsPageProps) {
  const { showMessage } = useMessage();
  const [config, setConfig] = useState<DailyContextConfig | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [consoleSummary, setConsoleSummary] = useState<QWeatherConsoleSummary | null>(null);
  const [consoleLoading, setConsoleLoading] = useState(false);
  const [consoleError, setConsoleError] = useState<string | null>(null);

  const loadConsoleSummary = async (refresh: boolean) => {
    setConsoleLoading(true);
    setConsoleError(null);
    try {
      setConsoleSummary(await fetchQWeatherConsoleSummary(refresh));
    } catch (cause) {
      setConsoleError(cause instanceof Error ? cause.message : '和风控制台数据读取失败');
    } finally {
      setConsoleLoading(false);
    }
  };

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
  }, [showMessage]);

  const update = (key: keyof FormState, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const save = async () => {
    const latitude = optionalNumber(form.latitude);
    const longitude = optionalNumber(form.longitude);
    if (latitude === undefined || longitude === undefined) {
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
        latitude,
        longitude,
        tianApiKey: form.tianApiKey,
        clearTianApiKey: false,
      });
      setConfig(saved);
      setForm((current) => ({ ...current, qweatherApiKey: '', tianApiKey: '' }));
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

  return (
    <SettingsPageLayout title="天气与节假日" description="配置聊天顶栏使用的外部数据源，密钥仅保存在本机。">
      {loading ? <p className={styles.state}>正在读取配置…</p> : (
        <div className={styles.content}>
          <section className={styles.section} aria-labelledby="weather-settings-title">
            <div className={styles.sectionHeading}>
              <div><h2 id="weather-settings-title">和风天气</h2><p>使用专属 API Host 和 API KEY 获取当前天气。</p></div>
              <Toggle checked={chatTopBar.showWeather} onChange={(checked) => onChatTopBarChange('showWeather', checked)} label="在聊天顶栏显示天气" />
            </div>
            <div className={styles.formGrid}>
              <Field label="API Host" hint="控制台 → 设置中的专属 qweatherapi.com 域名">
                <TextInput value={form.qweatherApiHost} onChange={(event) => update('qweatherApiHost', event.target.value)} placeholder="abcxyz.qweatherapi.com" />
              </Field>
              <Field label="API KEY" hint={config?.qweatherApiKeyConfigured ? '已配置；留空保持原密钥' : '尚未配置'}>
                <TextInput type="password" autoComplete="off" value={form.qweatherApiKey} onChange={(event) => update('qweatherApiKey', event.target.value)} placeholder={config?.qweatherApiKeyConfigured ? '••••••••••••' : '输入 API KEY'} />
              </Field>
              <Field label="地点名称" hint="仅用于界面展示">
                <TextInput value={form.locationName} onChange={(event) => update('locationName', event.target.value)} placeholder="例如：上海" />
              </Field>
              <div className={styles.coordinateFields}>
                <Field label="纬度" hint="-90 至 90"><TextInput inputMode="decimal" value={form.latitude} onChange={(event) => update('latitude', event.target.value)} placeholder="31.23" /></Field>
                <Field label="经度" hint="-180 至 180"><TextInput inputMode="decimal" value={form.longitude} onChange={(event) => update('longitude', event.target.value)} placeholder="121.47" /></Field>
              </div>
              <div className={styles.locationAction}>
                <Button
                  variant="outline"
                  icon={<LocateFixed size={14} />}
                  disabled={locating}
                  onClick={() => void locate()}
                >
                  {locating ? '正在识别位置…' : '识别当前位置'}
                </Button>
                <small>仅在点击后请求系统定位权限；识别结果不会自动保存。</small>
              </div>
            </div>
            <QWeatherConsolePanel
              configured={Boolean(config?.qweatherApiKeyConfigured && config.qweatherApiHost)}
              summary={consoleSummary}
              loading={consoleLoading}
              error={consoleError}
              onRefresh={() => void loadConsoleSummary(true)}
            />
          </section>

          <section className={styles.section} aria-labelledby="holiday-settings-title">
            <div className={styles.sectionHeading}>
              <div><h2 id="holiday-settings-title">天聚数行节假日</h2><p>识别法定节假日、双休日和调休上班。</p></div>
              <Toggle checked={chatTopBar.showHoliday} onChange={(checked) => onChatTopBarChange('showHoliday', checked)} label="在聊天顶栏显示节假日" />
            </div>
            <Field label="API KEY" hint={config?.tianApiKeyConfigured ? '已配置；留空保持原密钥' : '尚未配置'}>
              <TextInput type="password" autoComplete="off" value={form.tianApiKey} onChange={(event) => update('tianApiKey', event.target.value)} placeholder={config?.tianApiKeyConfigured ? '••••••••••••' : '输入 API KEY'} />
            </Field>
          </section>

          <div className={styles.actions}><Button variant="primary" icon={<Save size={14} />} disabled={saving} onClick={() => void save()}>{saving ? '保存中…' : '保存配置'}</Button></div>
        </div>
      )}
    </SettingsPageLayout>
  );
}

function QWeatherConsolePanel({
  configured,
  summary,
  loading,
  error,
  onRefresh,
}: {
  configured: boolean;
  summary: QWeatherConsoleSummary | null;
  loading: boolean;
  error: string | null;
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
          disabled={!configured || loading}
          onClick={onRefresh}
        >
          {loading ? '刷新中' : '刷新'}
        </Button>
      </div>

      {!configured && <p className={styles.consoleState}>保存 API Host 和 API KEY 后即可查看控制台摘要。</p>}
      {configured && loading && !hasData && <p className={styles.consoleState}>正在读取用量与费用…</p>}
      {configured && error && <p className={styles.consoleError} role="alert">{error}</p>}

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

      {configured && summary?.financeError && <PermissionNotice message={summary.financeError} />}
      {configured && summary?.usageError && <PermissionNotice message={summary.usageError} />}
    </section>
  );
}

function Metric({ label, value, warning = false }: { label: string; value: string; warning?: boolean }) {
  return <div><dt>{label}</dt><dd className={warning ? styles.metricWarning : undefined}>{value}</dd></div>;
}

function PermissionNotice({ message }: { message: string }) {
  return (
    <div className={styles.permissionNotice}>
      <p>{message}</p>
      <a href="https://console.qweather.com/project" target="_blank" rel="noreferrer">
        打开凭据权限设置 <ExternalLink size={12} aria-hidden="true" />
      </a>
    </div>
  );
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

function Field({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return <label className={styles.field}><span>{label}</span>{children}<small>{hint}</small></label>;
}

function optionalNumber(value: string): number | null | undefined {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
