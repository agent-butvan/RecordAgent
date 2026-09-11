import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Plus, ArrowUp, Mic } from 'lucide-react';
import { ModelSelector } from '../model/ModelSelector';
import { PermissionModeSelector } from './PermissionModeSelector';
import type { SessionPermissionMode } from '../../types/chat';
import { useMessage } from '../common/Message';
import {
  createSpeechRecognition,
  isSpeechRecognitionSupported,
  requestMicrophoneAccess,
  type SpeechRecognitionController,
} from '../../services/speechRecognition';
import styles from './PromptInput.module.css';

interface PromptInputProps {
  value: string;
  onValueChange: (value: string) => void;
  onSend: () => void;
  onOpenSettings: () => void;
  className?: string;
  placeholder?: string;
  permissionMode: SessionPermissionMode;
  onPermissionModeChange: (mode: SessionPermissionMode) => void;
  isPermissionModeDisabled?: boolean;
  isPermissionModeSaving?: boolean;
  onInputKeyDown?: (event: React.KeyboardEvent<HTMLTextAreaElement>) => boolean;
  suggestionListId?: string;
  leadingContent?: React.ReactNode;
  canSend?: boolean;
}

/**
 * AI 对话输入框：可组合前置标签、自动增高文本域与底部工具条。
 * 工具条左侧保留附件占位与 AI 模型选择，右侧为语音听写与发送按钮。
 */
export const PromptInput: React.FC<PromptInputProps> = ({
  value,
  onValueChange,
  onSend,
  onOpenSettings,
  className,
  placeholder = '随心输入',
  permissionMode,
  onPermissionModeChange,
  isPermissionModeDisabled = false,
  isPermissionModeSaving = false,
  onInputKeyDown,
  suggestionListId,
  leadingContent,
  canSend,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const speechRecognitionRef = useRef<SpeechRecognitionController | null>(null);
  const dictationBasePromptRef = useRef('');
  const finalDictationRef = useRef('');
  const [isDictating, setIsDictating] = useState(false);
  const [isRequestingMicrophone, setIsRequestingMicrophone] = useState(false);
  const { showMessage } = useMessage();

  useEffect(() => () => speechRecognitionRef.current?.abort(), []);

  // 输入内容变化时按内容自动增高，最高不超过 200px。
  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (onInputKeyDown?.(e)) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  const handleDictation = async () => {
    if (isDictating) {
      const recognition = speechRecognitionRef.current;
      speechRecognitionRef.current = null;
      setIsDictating(false);
      recognition?.stop();
      return;
    }
    if (!isSpeechRecognitionSupported()) {
      showMessage('error', '当前桌面环境不支持语音识别。');
      return;
    }

    setIsRequestingMicrophone(true);
    try {
      await requestMicrophoneAccess();
    } catch (error) {
      showMessage('error', error instanceof Error ? error.message : '无法访问麦克风，请稍后重试。');
      return;
    } finally {
      setIsRequestingMicrophone(false);
    }

    dictationBasePromptRef.current = value;
    finalDictationRef.current = '';
    const recognition = createSpeechRecognition({
      onTranscript: (text, isFinal) => {
        if (isFinal) finalDictationRef.current += text;
        onValueChange(`${dictationBasePromptRef.current}${finalDictationRef.current}${isFinal ? '' : text}`);
      },
      onError: (message) => {
        // WebView 在识别失败时不一定派发 onend，错误发生后必须主动释放录音状态。
        speechRecognitionRef.current = null;
        setIsDictating(false);
        showMessage('error', message);
      },
      onEnd: () => {
        speechRecognitionRef.current = null;
        setIsDictating(false);
      },
    });
    if (!recognition) return;

    speechRecognitionRef.current = recognition;
    setIsDictating(true);
    try {
      recognition.start();
    } catch {
      speechRecognitionRef.current = null;
      setIsDictating(false);
      showMessage('error', '无法启动语音识别，请稍后重试。');
    }
  };

  const hasValue = value.trim().length > 0;
  const isSendEnabled = canSend ?? hasValue;

  return (
    <div className={`${styles.container} ${className || ''}`}>
      {leadingContent && <div className={styles.leadingContent}>{leadingContent}</div>}
      <textarea
        ref={textareaRef}
        rows={1}
        className={styles.textarea}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        onKeyDown={handleKeyDown}
        aria-expanded={Boolean(suggestionListId)}
        aria-controls={suggestionListId}
      />

      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <button
            type="button"
            className={styles.iconBtn}
            title="添加附件（即将推出）"
            aria-label="添加附件（即将推出）"
            disabled
          >
            <Plus size={18} />
          </button>

          <div className={styles.divider} />

          <PermissionModeSelector
            value={permissionMode}
            onChange={onPermissionModeChange}
            disabled={isPermissionModeDisabled}
            isSaving={isPermissionModeSaving}
          />

          <ModelSelector onOpenSettings={onOpenSettings} />
        </div>

        <div className={styles.toolbarRight}>
          <button
            type="button"
            className={`${styles.iconBtn} ${isDictating ? styles.micBtnActive : ''}`}
            title={isDictating ? '停止听写' : '开始语音听写'}
            aria-label={isDictating ? '停止听写' : '开始语音听写'}
            aria-pressed={isDictating}
            onClick={handleDictation}
            disabled={isRequestingMicrophone}
          >
            <Mic size={18} />
          </button>

          <button
            type="button"
            className={`${styles.sendBtn} ${isSendEnabled ? styles.sendBtnActive : ''}`}
            onClick={onSend}
            title="发送消息 (Enter)"
            aria-label="发送消息"
            disabled={!isSendEnabled}
          >
            <ArrowUp size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default PromptInput;
