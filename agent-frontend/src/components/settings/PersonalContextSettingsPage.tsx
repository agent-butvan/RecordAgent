import { useEffect, useState } from 'react';
import { BrainCircuit, Database, FileText, PauseCircle, Save, Trash2 } from 'lucide-react';
import {
  clearPersonalContextProfile,
  fetchPersonalContext,
  updatePersonalContextEnabled,
  updatePersonalContextProfile,
} from '../../services/personalContextService';
import type { PersonalContextSettings } from '../../types/personalContext';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';
import { Toggle } from '../common/Toggle';
import { formatTokenCount } from '../chat/tokenUsageFormat';
import { SettingsPageLayout } from './SettingsPageLayout';
import styles from './PersonalContextSettingsPage.module.css';

/** 用户可控的稳定画像与相关记忆自动注入设置。 */
export function PersonalContextSettingsPage() {
  const [settings, setSettings] = useState<PersonalContextSettings | null>(null);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmingClear, setConfirmingClear] = useState(false);

  const apply = (next: PersonalContextSettings) => {
    setSettings(next);
    setDraft(next.profile);
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      apply(await fetchPersonalContext());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '读取个人上下文失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const mutate = async (operation: () => Promise<PersonalContextSettings>, success: string) => {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      apply(await operation());
      setNotice(success);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '保存个人上下文失败');
      return false;
    } finally {
      setSaving(false);
    }
  };

  if (loading && !settings) return <SettingsPageLayout title="个人上下文" description="控制 Agent 自动了解你的方式。"><div className={styles.state} role="status">正在读取本地设置…</div></SettingsPageLayout>;
  if (!settings) return <SettingsPageLayout title="个人上下文" description="控制 Agent 自动了解你的方式。"><div className={styles.state} role="alert"><p>{error}</p><Button variant="outline" onClick={() => void load()}>重新加载</Button></div></SettingsPageLayout>;

  const dirty = draft !== settings.profile;
  const atLimit = draft.length >= settings.maxProfileChars;
  const sourceLabel = settings.source === 'legacy' ? '来自旧版 MEMORY.md' : settings.source === 'explicit' ? '由你维护' : '尚未填写';

  return <SettingsPageLayout title="个人上下文" description="用有界的稳定画像与相关记忆，让 Agent 了解你，同时控制每轮上下文成本。">
    <div className={styles.content}>
      <section className={styles.switchRow} aria-labelledby="context-switch-title">
        <div className={styles.switchCopy}>
          <span className={styles.icon}><BrainCircuit size={18} aria-hidden="true" /></span>
          <div><h2 id="context-switch-title">自动使用个人上下文</h2><p>{settings.enabled ? '对话时注入画像，并按当前问题召回少量相关记忆。' : '已暂停自动注入，画像与记忆仍保留在本机。'}</p></div>
        </div>
        <Toggle checked={settings.enabled} disabled={saving} label={settings.enabled ? '已开启' : '已暂停'} onChange={(enabled) => void mutate(() => updatePersonalContextEnabled(enabled), enabled ? '已开启个人上下文' : '已暂停个人上下文')} />
      </section>

      <dl className={styles.budgets} aria-label="单次调用 Token 硬预算">
        <div><dt><FileText size={14} />个人画像</dt><dd>≤ {formatTokenCount(settings.profileTokenBudget)}</dd></div>
        <div><dt><Database size={14} />相关记忆</dt><dd>≤ {formatTokenCount(settings.memoryTokenBudget)}</dd></div>
        <div><dt><PauseCircle size={14} />合计上限</dt><dd>≤ {formatTokenCount(settings.totalTokenBudget)}</dd></div>
      </dl>

      <section className={styles.editor} aria-labelledby="profile-editor-title">
        <div className={styles.editorHeading}><div><h2 id="profile-editor-title">个人画像</h2><p>写入长期稳定的信息，例如沟通偏好、常用技术栈与工作习惯；不要填写密钥或密码。</p></div><span>{sourceLabel}</span></div>
        {settings.source === 'legacy' && <p className={styles.legacyNote}>当前内容从旧版画像读取。保存后会创建独立画像文件，后续由你直接维护。</p>}
        <textarea className={styles.textarea} value={draft} maxLength={settings.maxProfileChars} onChange={(event) => { setDraft(event.target.value); setNotice(null); }} placeholder={'例如：\n- 偏好简短、先给结论的中文回复\n- 常用 React、TypeScript 与 Spring Boot\n- 做重大取舍前希望先看到方案与风险'} aria-describedby="profile-help" />
        <div className={styles.editorFooter} id="profile-help"><span className={atLimit ? styles.limit : ''}>{draft.length.toLocaleString()} / {settings.maxProfileChars.toLocaleString()} 字符 · 已保存画像约 {formatTokenCount(settings.estimatedTokens)} tokens</span><div className={styles.actions}><Button variant="ghost" icon={<Trash2 size={14} />} disabled={saving || (!draft && settings.source === 'explicit')} onClick={() => setConfirmingClear(true)}>清空画像</Button><Button variant="primary" icon={<Save size={14} />} disabled={saving || !dirty} onClick={() => void mutate(() => updatePersonalContextProfile(draft), '个人画像已保存')}>{saving ? '正在保存' : '保存画像'}</Button></div></div>
      </section>

      {(error || notice) && <p className={error ? styles.error : styles.notice} role={error ? 'alert' : 'status'}>{error || notice}</p>}
      <p className={styles.privacy}>画像、开关与记忆均保存在本机。相关记忆只按问题临时检索，含敏感标记的片段不会自动注入；暂停不会删除任何数据。</p>
    </div>

    <Modal open={confirmingClear} title="清空个人画像" onClose={() => setConfirmingClear(false)}>
      <div className={styles.confirm}><p>清空后，Agent 将不再自动使用当前画像。历史记忆文件不会被删除。</p><div><Button variant="outline" onClick={() => setConfirmingClear(false)}>取消</Button><Button variant="danger" disabled={saving} onClick={() => void mutate(clearPersonalContextProfile, '个人画像已清空').then((ok) => { if (ok) setConfirmingClear(false); })}>确认清空</Button></div></div>
    </Modal>
  </SettingsPageLayout>;
}
