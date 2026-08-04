import React from 'react';
import styles from './Toggle.module.css';

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
}

export const Toggle: React.FC<ToggleProps> = ({
  checked,
  onChange,
  label,
  disabled = false,
}) => {
  const handleClick = () => {
    if (!disabled) {
      onChange(!checked);
    }
  };

  return (
    <div
      className={`${styles.toggleContainer} ${disabled ? styles.disabled : ''}`}
      onClick={handleClick}
    >
      <div className={`${styles.switch} ${checked ? styles.checked : ''}`}>
        <div className={`${styles.thumb} ${checked ? styles.thumbChecked : ''}`} />
      </div>
      {label && <span className={styles.label}>{label}</span>}
    </div>
  );
};
