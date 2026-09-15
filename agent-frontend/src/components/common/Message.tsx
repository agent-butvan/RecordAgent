import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { CheckCircle2, CircleAlert, Info, X } from 'lucide-react';
import styles from './Message.module.css';

export type MessageTone = 'success' | 'error' | 'info';

export interface MessageOptions {
  action?: {
    label: string;
    onClick: () => void;
  };
  /** 毫秒；设为 0 时持续显示，直到被新消息替换或用户关闭。 */
  duration?: number;
}

interface MessageContextValue {
  showMessage: (tone: MessageTone, text: string, options?: MessageOptions) => void;
}

const MessageContext = createContext<MessageContextValue | null>(null);

interface ActiveMessage extends MessageOptions {
  id: number;
  tone: MessageTone;
  text: string;
}

/** 统一的窗口级顶部操作反馈；上下文错误应由所属组件就地呈现。 */
const ToastMessage: React.FC<{ message: ActiveMessage; onClose: () => void }> = ({ message, onClose }) => {
  const { tone, text, action } = message;
  const Icon = tone === 'success' ? CheckCircle2 : tone === 'error' ? CircleAlert : Info;
  return (
    <div className={`${styles.message} ${styles[tone]}`} role={tone === 'error' ? 'alert' : 'status'}>
      <Icon size={14} aria-hidden="true" />
      <span className={styles.text}>{text}</span>
      {action && (
        <button type="button" className={styles.action} onClick={() => { onClose(); action.onClick(); }}>
          {action.label}
        </button>
      )}
      <button type="button" className={styles.close} onClick={onClose} aria-label="关闭提示">
        <X size={13} aria-hidden="true" />
      </button>
    </div>
  );
};

/** 将全局提示渲染在应用顶部，统一处理自动关闭行为。 */
export const MessageProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [message, setMessage] = useState<ActiveMessage | null>(null);
  const nextId = useRef(0);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeMessage = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
    setMessage(null);
  }, []);
  const showMessage = useCallback((tone: MessageTone, text: string, options: MessageOptions = {}) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    const id = ++nextId.current;
    setMessage({ id, tone, text, ...options });
    const duration = options.duration ?? (tone === 'error' ? 8000 : 4500);
    closeTimer.current = duration > 0 ? setTimeout(() => setMessage(null), duration) : null;
  }, []);

  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  return <MessageContext.Provider value={{ showMessage }}>
    {children}
    <div className={styles.viewport} aria-live="polite" aria-atomic="true" aria-relevant="additions text">
      {message && <ToastMessage key={message.id} message={message} onClose={closeMessage} />}
    </div>
  </MessageContext.Provider>;
};

/** 在任意子组件中触发顶部全局提示。 */
export function useMessage(): MessageContextValue {
  const context = useContext(MessageContext);
  if (!context) throw new Error('useMessage 必须在 MessageProvider 内使用');
  return context;
}
