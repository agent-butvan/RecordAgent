import { useState, type FormEvent } from 'react';
import { Button } from './Button';
import { Modal } from './Modal';
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
  const [customOpen, setCustomOpen] = useState(false);
  const [customValue, setCustomValue] = useState('');
  const selectableOptions = value && !options.includes(value) ? [...options, value] : options;

  const closeCustomModal = () => {
    setCustomOpen(false);
    setCustomValue('');
  };

  const submitCustomCategory = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const nextValue = customValue.trim();
    if (!nextValue) return;
    onChange(nextValue);
    closeCustomModal();
  };

  return <div className={styles.field}>
    <Select
      label={label}
      options={[
        ...selectableOptions.map((option) => ({ label: option, value: option })),
        { label: '＋ 自定义分类', value: CUSTOM_VALUE },
      ]}
      value={value}
      disabled={disabled}
      fieldSize="md"
      fullWidth
      onChange={(event) => {
        if (event.target.value === CUSTOM_VALUE) {
          setCustomOpen(true);
          setCustomValue('');
        } else {
          onChange(event.target.value);
        }
      }}
    />
    <Modal open={customOpen} title={`自定义${label}`} onClose={closeCustomModal} width={380} centered>
      <form className={styles.customForm} onSubmit={submitCustomCategory}>
        <label>
          <span>分类名称</span>
          <input
            value={customValue}
            onChange={(event) => setCustomValue(event.target.value)}
            maxLength={40}
            placeholder="输入新的分类名称"
            aria-label={`自定义${label}`}
            required
            autoFocus
          />
        </label>
        <p>保存记录后，系统会自动记住这个分类。</p>
        <div className={styles.actions}>
          <Button type="button" variant="outline" onClick={closeCustomModal}>取消</Button>
          <Button type="submit" variant="primary" disabled={!customValue.trim()}>使用此分类</Button>
        </div>
      </form>
    </Modal>
  </div>;
}
