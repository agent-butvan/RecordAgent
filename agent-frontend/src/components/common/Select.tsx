import React from 'react';
import { ChevronDown } from 'lucide-react';
import styles from './Select.module.css';

export interface SelectOption {
  label: string;
  value: string;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: SelectOption[];
  icon?: React.ReactNode;
}

export const Select: React.FC<SelectProps> = ({
  options,
  icon,
  className = '',
  ...props
}) => {
  return (
    <div className={styles.selectWrapper}>
      <select className={`${styles.select} ${className}`} {...props}>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown size={14} className={styles.chevronIcon} />
    </div>
  );
};
