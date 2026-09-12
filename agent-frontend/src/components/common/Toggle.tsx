import React from 'react';
import styles from './Toggle.module.css';

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  showLabel?: boolean;
  disabled?: boolean;
}

export const Toggle: React.FC<ToggleProps> = ({
  checked,
  onChange,
  label,
  showLabel = true,
  disabled = false,
}) => {
  const handleClick = () => {
    if (!disabled) {
      onChange(!checked);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!disabled) {
        onChange(!checked);
      }
    }
  };

  return (
    <div
      className={`${styles.toggleContainer} ${disabled ? styles.disabled : ''}`}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      tabIndex={disabled ? -1 : 0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <div className={`${styles.switch} ${checked ? styles.checked : ''}`}>
        <div className={`${styles.thumb} ${checked ? styles.thumbChecked : ''}`} />
      </div>
      {label && showLabel && <span className={styles.label}>{label}</span>}
    </div>
  );
};
