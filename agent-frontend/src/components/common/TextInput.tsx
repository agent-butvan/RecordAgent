import React from 'react';
import styles from './TextInput.module.css';

export interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

/**
 * 统一风格的文本输入框，与 Select(md)、Button 尺寸体系一致。
 */
export const TextInput: React.FC<TextInputProps> = ({
  className = '',
  invalid = false,
  ...props
}) => {
  return (
    <input
      className={`${styles.input} ${invalid ? styles.invalid : ''} ${className}`}
      {...props}
    />
  );
};
