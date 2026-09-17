import type { FormEvent } from 'react';
import { LocateFixed } from 'lucide-react';
import { Button } from '../common/Button';
import { FormField } from '../common/FormField';
import { Modal } from '../common/Modal';
import { TextInput } from '../common/TextInput';
import styles from './DailyContextConfigModal.module.css';

export type DailyContextProvider = 'weather' | 'holiday';

export interface DailyContextFormState {
  qweatherApiHost: string;
  qweatherApiKey: string;
  locationName: string;
  latitude: string;
  longitude: string;
  tianApiKey: string;
}

interface DailyContextConfigModalProps {
  open: boolean;
  provider: DailyContextProvider | null;
  form: DailyContextFormState;
  weatherConfigured: boolean;
  holidayConfigured: boolean;
  saving: boolean;
  locating: boolean;
  onClose: () => void;
  onChange: (key: keyof DailyContextFormState, value: string) => void;
  onLocate: () => void;
  onSubmit: () => void;
}

/** 天气与节假日服务的集中配置弹框，页面摘要不直接暴露输入项。 */
export function DailyContextConfigModal({
  open,
  provider,
  form,
  weatherConfigured,
  holidayConfigured,
  saving,
  locating,
  onClose,
  onChange,
  onLocate,
  onSubmit,
}: DailyContextConfigModalProps) {
  const isWeather = provider === 'weather';

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <Modal
      open={open}
      title={isWeather ? '配置和风天气' : '配置天聚数行节假日'}
      onClose={onClose}
      width={560}
      centered
    >
      <form className={styles.form} onSubmit={handleSubmit}>
        <p className={styles.description}>
          {isWeather
            ? '填写和风天气服务信息，用于获取聊天顶栏中的实时天气。'
            : '填写节假日服务 API KEY，用于识别法定节假日和调休安排。'}
        </p>

        {isWeather ? (
          <>
            <div className={styles.fieldGrid}>
              <FormField label="API Host" htmlFor="qweather-api-host" hint="控制台 → 设置中的专属 qweatherapi.com 域名">
                <TextInput
                  id="qweather-api-host"
                  value={form.qweatherApiHost}
                  onChange={(event) => onChange('qweatherApiHost', event.target.value)}
                  placeholder="abcxyz.qweatherapi.com"
                  autoFocus
                />
              </FormField>
              <FormField
                label="API KEY"
                htmlFor="qweather-api-key"
                hint={weatherConfigured ? '已配置；留空保持原密钥' : '尚未配置'}
              >
                <TextInput
                  id="qweather-api-key"
                  type="password"
                  autoComplete="off"
                  value={form.qweatherApiKey}
                  onChange={(event) => onChange('qweatherApiKey', event.target.value)}
                  placeholder={weatherConfigured ? '••••••••••••' : '输入 API KEY'}
                />
              </FormField>
            </div>

            <FormField label="地点名称" htmlFor="daily-context-location" hint="仅用于聊天顶栏展示">
              <TextInput
                id="daily-context-location"
                value={form.locationName}
                onChange={(event) => onChange('locationName', event.target.value)}
                placeholder="例如：上海"
              />
            </FormField>

            <div className={styles.coordinateGrid}>
              <FormField label="纬度" htmlFor="daily-context-latitude" hint="-90 至 90">
                <TextInput
                  id="daily-context-latitude"
                  inputMode="decimal"
                  value={form.latitude}
                  onChange={(event) => onChange('latitude', event.target.value)}
                  placeholder="31.23"
                />
              </FormField>
              <FormField label="经度" htmlFor="daily-context-longitude" hint="-180 至 180">
                <TextInput
                  id="daily-context-longitude"
                  inputMode="decimal"
                  value={form.longitude}
                  onChange={(event) => onChange('longitude', event.target.value)}
                  placeholder="121.47"
                />
              </FormField>
            </div>

            <div className={styles.locationAction}>
              <Button
                type="button"
                variant="outline"
                size="sm"
                icon={<LocateFixed size={14} />}
                disabled={locating || saving}
                onClick={onLocate}
              >
                {locating ? '正在识别位置…' : '识别当前位置'}
              </Button>
              <span>仅在点击后请求系统定位权限，识别结果不会自动保存。</span>
            </div>
          </>
        ) : (
          <FormField
            label="API KEY"
            htmlFor="tian-api-key"
            hint={holidayConfigured ? '已配置；留空保持原密钥' : '尚未配置'}
          >
            <TextInput
              id="tian-api-key"
              type="password"
              autoComplete="off"
              value={form.tianApiKey}
              onChange={(event) => onChange('tianApiKey', event.target.value)}
              placeholder={holidayConfigured ? '••••••••••••' : '输入 API KEY'}
              autoFocus
            />
          </FormField>
        )}

        <div className={styles.actions}>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>取消</Button>
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? '保存中…' : '保存配置'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
