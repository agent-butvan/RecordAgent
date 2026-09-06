import { useEffect, useId, useState } from 'react';
import styles from './CategoryPicker.module.css';

const CUSTOM_VALUE = '__custom_category__';

interface CategoryPickerProps {
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
  disabled?: boolean;
}

/** 支持选择已知分类或输入新分类的统一控件。 */
export function CategoryPicker({ options, value, onChange, label = '分类', disabled = false }: CategoryPickerProps) {
  const selectId = useId();
  const [customMode, setCustomMode] = useState(Boolean(value && !options.includes(value)));

  useEffect(() => {
    if (value) setCustomMode(!options.includes(value));
  }, [options, value]);

  const selectValue = customMode ? CUSTOM_VALUE : value;

  return <div className={styles.field}>
    <label htmlFor={selectId}>{label}</label>
    <select
      id={selectId}
      value={selectValue}
      disabled={disabled}
      onChange={(event) => {
        if (event.target.value === CUSTOM_VALUE) {
          setCustomMode(true);
          onChange('');
        } else {
          setCustomMode(false);
          onChange(event.target.value);
        }
      }}
    >
      {options.map((option) => <option key={option} value={option}>{option}</option>)}
      <option value={CUSTOM_VALUE}>＋ 自定义分类</option>
    </select>
    {customMode && <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      maxLength={40}
      placeholder="输入新分类，保存后自动记住"
      aria-label={`自定义${label}`}
      disabled={disabled}
      required
      autoFocus
    />}
  </div>;
}
