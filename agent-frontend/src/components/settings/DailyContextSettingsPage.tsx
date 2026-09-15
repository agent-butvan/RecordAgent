import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import {
  fetchDailyContextConfig,
  saveDailyContextConfig,
  type DailyContextConfig,
} from '../../services/dailyContextApi';
import type { ChatTopBarPreferences } from '../../types/preferences';
import { Button } from '../common/Button';
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
  const [config, setConfig] = useState<DailyContextConfig | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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
      })
      .catch((cause) => setMessage({ type: 'error', text: cause instanceof Error ? cause.message : '配置读取失败' }))
      .finally(() => setLoading(false));
  }, []);

  const update = (key: keyof FormState, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const save = async () => {
    const latitude = optionalNumber(form.latitude);
    const longitude = optionalNumber(form.longitude);
    if (latitude === undefined || longitude === undefined) {
      setMessage({ type: 'error', text: '经纬度必须填写有效数字。' });
      return;
    }
    setSaving(true);
    setMessage(null);
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
      setMessage({ type: 'success', text: '天气与节假日配置已保存到本机。' });
    } catch (cause) {
      setMessage({ type: 'error', text: cause instanceof Error ? cause.message : '配置保存失败' });
    } finally {
      setSaving(false);
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
            </div>
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

          {message && <p className={message.type === 'error' ? styles.error : styles.success} role={message.type === 'error' ? 'alert' : 'status'}>{message.text}</p>}
          <div className={styles.actions}><Button variant="primary" icon={<Save size={14} />} disabled={saving} onClick={() => void save()}>{saving ? '保存中…' : '保存配置'}</Button></div>
        </div>
      )}
    </SettingsPageLayout>
  );
}

function Field({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return <label className={styles.field}><span>{label}</span>{children}<small>{hint}</small></label>;
}

function optionalNumber(value: string): number | null | undefined {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
