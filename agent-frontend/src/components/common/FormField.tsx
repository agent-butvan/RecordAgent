import React from 'react';
import styles from './FormField.module.css';

export interface FormFieldProps {
  label: string;
  htmlFor?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}

/**
 * 统一的表单字段容器：标签 + 控件 + 可选提示。
 */
export const FormField: React.FC<FormFieldProps> = ({
  label,
  htmlFor,
  hint,
  required = false,
  children,
}) => {
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={htmlFor}>
        {label}
        {required && <span className={styles.required} aria-hidden="true"> *</span>}
      </label>
      {children}
      {hint && <span className={styles.hint}>{hint}</span>}
    </div>
  );
};
