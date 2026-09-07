import { useId, type ReactNode, type SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import styles from './Select.module.css';

export interface SelectOption {
  label: string;
  value: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  options: readonly SelectOption[];
  label?: ReactNode;
  description?: ReactNode;
  error?: string;
  placeholder?: string;
  icon?: ReactNode;
  fieldSize?: 'sm' | 'md' | 'lg';
  appearance?: 'outline' | 'ghost';
  fullWidth?: boolean;
  containerClassName?: string;
}

/** 保留原生表单语义，并统一标签、状态与视觉反馈的全局选择器。 */
export function Select({
  options,
  label,
  description,
  error,
  placeholder,
  icon,
  fieldSize = 'sm',
  appearance = 'outline',
  fullWidth = false,
  containerClassName = '',
  className = '',
  id,
  disabled,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  ...props
}: SelectProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const messageId = `${selectId}-message`;
  const describedBy = [ariaDescribedBy, (error || description) ? messageId : undefined]
    .filter(Boolean)
    .join(' ') || undefined;
  const rootClassName = [styles.field, fullWidth ? styles.fullWidth : '', containerClassName]
    .filter(Boolean)
    .join(' ');
  const selectClassName = [styles.select, styles[fieldSize], styles[appearance], icon ? styles.withIcon : '', className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={rootClassName}>
      {label && <label className={styles.label} htmlFor={selectId}>{label}</label>}
      <div className={styles.control}>
        {icon && <span className={styles.leadingIcon} aria-hidden="true">{icon}</span>}
        <select
          {...props}
          id={selectId}
          className={selectClassName}
          disabled={disabled}
          aria-describedby={describedBy}
          aria-invalid={error ? true : ariaInvalid}
        >
          {placeholder && <option value="" disabled>{placeholder}</option>}
          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown size={14} className={styles.chevronIcon} aria-hidden="true" />
      </div>
      {(error || description) && (
        <p id={messageId} className={error ? styles.error : styles.description} role={error ? 'alert' : undefined}>
          {error ?? description}
        </p>
      )}
    </div>
  );
}
