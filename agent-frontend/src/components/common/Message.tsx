import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { CheckCircle2, CircleAlert, Info } from 'lucide-react';
import styles from './Message.module.css';

export type MessageTone = 'success' | 'error' | 'info';

export interface MessageProps {
  tone: MessageTone;
  children: React.ReactNode;
  className?: string;
}

interface MessageContextValue {
  showMessage: (tone: MessageTone, text: string) => void;
}

const MessageContext = createContext<MessageContextValue | null>(null);

/** 统一的表单内成功、错误与提示信息组件。 */
export const Message: React.FC<MessageProps> = ({ tone, children, className = '' }) => {
  const Icon = tone === 'success' ? CheckCircle2 : tone === 'error' ? CircleAlert : Info;
  return (
    <p className={`${styles.message} ${styles[tone]} ${className}`} role={tone === 'error' ? 'alert' : 'status'}>
      <Icon size={14} aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
};

/** 将全局提示渲染在应用顶部，统一处理自动关闭行为。 */
export const MessageProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [message, setMessage] = useState<{ tone: MessageTone; text: string } | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showMessage = useCallback((tone: MessageTone, text: string) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setMessage({ tone, text });
    closeTimer.current = setTimeout(() => setMessage(null), 8000);
  }, []);

  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  return <MessageContext.Provider value={{ showMessage }}>
    {children}
    <div className={styles.viewport} aria-live="polite" aria-atomic="true">
      {message && <Message tone={message.tone}>{message.text}</Message>}
    </div>
  </MessageContext.Provider>;
};

/** 在任意子组件中触发顶部全局提示。 */
export function useMessage(): MessageContextValue {
  const context = useContext(MessageContext);
  if (!context) throw new Error('useMessage 必须在 MessageProvider 内使用');
  return context;
}
