import { useEffect, useState } from 'react';
import type { SaveTaskMailSettings } from '../../types/automation';
import { fetchTaskMailSettings, saveTaskMailSettings, testTaskMail } from '../../services/automationApi';
import { getTaskBackground, isTaskDesktop, requestTaskNotificationPermission, setTaskBackground } from '../../services/taskDesktop';
import { SettingsGroup, SettingsRow } from '../settings/SettingsGroup';
import { SettingsPageLayout } from '../settings/SettingsPageLayout';
import { TextInput } from '../common/TextInput';
import { Button } from '../common/Button';
import { useMessage } from '../common/Message';
import { EmailBindingModal } from '../account/EmailBindingModal';
import styles from './TaskSettings.module.css';

export function TaskSettings() {
  const [form, setForm] = useState<SaveTaskMailSettings | null>(null);
  const [recipient, setRecipient] = useState<string | null>(null);
  const [background, setBackground] = useState(false);
  const [binding, setBinding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { showMessage } = useMessage();
  async function load() {
    setError('');
    try {
      const value = await fetchTaskMailSettings();
      setForm({ host:value.host,port:value.port,username:value.username,from:value.from,auth:value.auth,starttls:true,password:'',enabled:value.enabled });
      setRecipient(value.maskedRecipient); setBackground(await getTaskBackground());
    } catch (e) { setError(e instanceof Error ? e.message : '配置读取失败'); }
  }
  useEffect(() => { void load(); }, []);
  async function action(work: () => Promise<void>) {
    setBusy(true); setError(''); try { await work(); } catch (e) { setError(e instanceof Error ? e.message : '操作失败'); } finally { setBusy(false); }
  }
  const field = (key: 'host' | 'username' | 'from' | 'password', label: string) => <SettingsRow label={label} labelFor={`mail-${key}`} control={<TextInput id={`mail-${key}`} type={key === 'password' ? 'password' : 'text'} autoComplete={key === 'password' ? 'new-password' : 'off'} value={form?.[key] ?? ''} disabled={busy} onChange={e => setForm(f => f ? {...f,[key]:e.target.value} : f)} />} />;
  return <SettingsPageLayout title="任务设置" description="管理任务通知、邮箱与后台运行。"><div className={styles.body}>
    <SettingsGroup title="桌面提醒" description="应用完全退出后，定时任务与邮件发送停止。">
      <SettingsRow label="系统通知权限" description="由你主动授权，系统专注模式仍可能抑制通知" control={<Button disabled={busy || !isTaskDesktop()} onClick={() => void action(async () => { const granted = await requestTaskNotificationPermission(); showMessage(granted ? 'success' : 'info', granted ? '系统通知已允许' : '通知尚未允许，请检查系统设置'); })}>开启通知</Button>} />
      <SettingsRow label="关闭主窗口后在后台运行" description="可从菜单栏图标重新打开或彻底退出" control={<input aria-label="后台运行" type="checkbox" checked={background} disabled={busy || !isTaskDesktop()} onChange={e => { const value = e.target.checked; void action(async () => { await setTaskBackground(value); setBackground(value); showMessage('success','后台设置已保存'); }); }} />} />
    </SettingsGroup>
    <SettingsGroup title="收件邮箱" description="第一版仅向当前已验证邮箱发送。">
      <SettingsRow label={recipient ?? '尚未绑定邮箱'} description="先配置 SMTP，再通过验证码绑定邮箱" control={<Button disabled={busy} onClick={() => setBinding(true)}>绑定邮箱</Button>} />
      {form && <SettingsRow label="允许任务发送邮件" description="关闭后不会发送新的任务邮件" control={<input aria-label="允许任务邮件" type="checkbox" checked={form.enabled} disabled={busy} onChange={e => setForm({...form,enabled:e.target.checked})} />} />}
    </SettingsGroup>
    {form && <SettingsGroup title="发件服务" description="使用 STARTTLS 加密。认证凭据仅保存在本机，留空保持原凭据。">
      {field('host','SMTP 服务器')}
      <SettingsRow label="端口" labelFor="mail-port" control={<TextInput id="mail-port" type="number" min={1} max={65535} value={form.port} disabled={busy} onChange={e => setForm({...form,port:Number(e.target.value)})} />} />
      {field('username','发信用户名')}{field('from','发件邮箱')}{field('password','SMTP 认证凭据')}
    </SettingsGroup>}
    {error && <p role="alert" className={styles.error}>{error}<Button variant="ghost" onClick={() => void load()}>重新读取</Button></p>}
    <div className={styles.actions}><Button variant="outline" disabled={busy || !recipient} onClick={() => void action(async () => { const result = await testTaskMail(); showMessage(result.status === 'SUBMITTED' ? 'success' : 'error', result.status === 'SUBMITTED' ? '测试邮件已提交，请检查收件箱' : result.message); })}>发送测试邮件</Button><Button variant="primary" disabled={busy || !form} onClick={() => void action(async () => { if (form) { await saveTaskMailSettings(form); setForm({...form,password:''}); showMessage('success','邮件设置已保存'); } })}>保存邮件设置</Button></div>
    {binding && <EmailBindingModal open onClose={() => { setBinding(false); void load(); }} onBound={() => { setBinding(false); void load(); }} />}
  </div></SettingsPageLayout>;
}
