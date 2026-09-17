import { useMemo, useState } from 'react';
import { Pencil, RotateCcw } from 'lucide-react';
import {
  getSlashCommandStates,
  type SlashCommandDefinition,
  type SlashCommandExecution,
} from '../../features/slash-command/slashCommands';
import {
  resetSlashCommandDetails,
  setSlashCommandDetails,
  setSlashCommandEnabled,
} from '../../features/slash-command/slashCommandPreferences';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import { FormField } from '../common/FormField';
import { Modal } from '../common/Modal';
import { TextInput } from '../common/TextInput';
import { LeverSwitch } from '../common/LeverSwitch';
import { SettingsPageLayout } from './SettingsPageLayout';
import styles from './SlashCommandSettingsPage.module.css';

const EXECUTION_LABELS: Record<SlashCommandExecution, string> = {
  LOCAL: '本地操作',
  QUERY: '数据查询',
  CONTEXT_PROMPT: '模型指令',
};

interface EditDraft {
  command: SlashCommandDefinition;
  description: string;
  usage: string;
  customized: boolean;
}

/** 管理内置 Slash Command 的启用状态与用户可见帮助信息。 */
export function SlashCommandSettingsPage() {
  const [states, setStates] = useState(() => getSlashCommandStates());
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);

  const enabledCount = useMemo(
    () => states.filter((state) => state.enabled).length,
    [states],
  );

  const refresh = () => setStates(getSlashCommandStates());

  const handleEnabledChange = (command: SlashCommandDefinition, enabled: boolean) => {
    setSlashCommandEnabled(command.name, enabled);
    refresh();
  };

  const openEditor = (command: SlashCommandDefinition, customized: boolean) => {
    setEditDraft({
      command,
      description: command.description,
      usage: command.usage,
      customized,
    });
  };

  const saveDetails = () => {
    if (!editDraft) return;
    const description = editDraft.description.trim();
    const usage = editDraft.usage.trim();
    if (!description || !usage) return;
    setSlashCommandDetails(editDraft.command.name, { description, usage });
    setEditDraft(null);
    refresh();
  };

  const resetDetails = () => {
    if (!editDraft) return;
    resetSlashCommandDetails(editDraft.command.name);
    setEditDraft(null);
    refresh();
  };

  return (
    <SettingsPageLayout
      title="指令配置"
      description="查看聊天中可用的 Slash Command，并管理每条指令的状态和帮助信息。"
      actions={<Badge variant="default">{enabledCount} / {states.length} 已启用</Badge>}
      density="compact"
    >
      <div className={styles.legend}>
        <span>命令名是执行标识，暂不支持修改。</span>
        <span>禁用后不会出现在输入建议或 /help 中，也无法执行。</span>
      </div>

      <div className={styles.commandList}>
        {states.map(({ command, enabled, customized }) => (
          <article
            key={command.name}
            className={`${styles.commandRow} ${enabled ? '' : styles.commandRowDisabled}`}
          >
            <div className={styles.commandIdentity}>
              <code>/{command.name}</code>
              <div className={styles.commandMeta}>
                <Badge variant="default">{EXECUTION_LABELS[command.execution]}</Badge>
                {customized && <Badge variant="primary">已修改</Badge>}
                {command.aliases.length > 0 && (
                  <span>别名：/{command.aliases.join('、/')}</span>
                )}
              </div>
            </div>

            <div className={styles.commandCopy}>
              <strong>{command.description}</strong>
              <code>{command.usage}</code>
            </div>

            <div className={styles.commandActions}>
              <Button
                variant="ghost"
                size="sm"
                icon={<Pencil size={13} />}
                onClick={() => openEditor(command, customized)}
                aria-label={`编辑 /${command.name}`}
              >
                编辑
              </Button>
              <LeverSwitch
                checked={enabled}
                onChange={(next) => handleEnabledChange(command, next)}
                label={enabled ? '已启用' : '已禁用'}
                showLabel={false}
              />
            </div>
          </article>
        ))}
      </div>

      <Modal
        open={editDraft !== null}
        title={editDraft ? `编辑 /${editDraft.command.name}` : '编辑指令'}
        width={540}
        onClose={() => setEditDraft(null)}
      >
        {editDraft && (
          <form
            className={styles.editForm}
            onSubmit={(event) => {
              event.preventDefault();
              saveDetails();
            }}
          >
            <FormField label="作用描述" htmlFor="slash-command-description" required>
              <TextInput
                id="slash-command-description"
                value={editDraft.description}
                onChange={(event) => setEditDraft({ ...editDraft, description: event.target.value })}
                autoFocus
                required
              />
            </FormField>
            <FormField
              label="用法"
              htmlFor="slash-command-usage"
              hint="该内容会显示在 /help 的指令详情和缺少参数提示中。"
              required
            >
              <TextInput
                id="slash-command-usage"
                className={styles.usageInput}
                value={editDraft.usage}
                onChange={(event) => setEditDraft({ ...editDraft, usage: event.target.value })}
                required
              />
            </FormField>
            <div className={styles.editActions}>
              <div>
                {editDraft.customized && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    icon={<RotateCcw size={13} />}
                    onClick={resetDetails}
                  >
                    恢复默认
                  </Button>
                )}
              </div>
              <div className={styles.primaryActions}>
                <Button type="button" variant="outline" onClick={() => setEditDraft(null)}>取消</Button>
                <Button type="submit" variant="primary">保存修改</Button>
              </div>
            </div>
          </form>
        )}
      </Modal>
    </SettingsPageLayout>
  );
}
