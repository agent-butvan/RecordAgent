import { useEffect, useState } from 'react';
import { Select } from './Select';
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
  const [customMode, setCustomMode] = useState(Boolean(value && !options.includes(value)));

  useEffect(() => {
    if (value) setCustomMode(!options.includes(value));
  }, [options, value]);

  const selectValue = customMode ? CUSTOM_VALUE : value;

  return <div className={styles.field}>
    <Select
      label={label}
      options={[
        ...options.map((option) => ({ label: option, value: option })),
        { label: '＋ 自定义分类', value: CUSTOM_VALUE },
      ]}
      value={selectValue}
      disabled={disabled}
      fieldSize="md"
      fullWidth
      onChange={(event) => {
        if (event.target.value === CUSTOM_VALUE) {
          setCustomMode(true);
          onChange('');
        } else {
          setCustomMode(false);
          onChange(event.target.value);
        }
      }}
    />
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
