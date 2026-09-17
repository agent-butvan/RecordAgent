import React, { useCallback } from 'react';
import styles from './LeverSwitch.module.css';

export interface LeverSwitchProps {
  /** 是否选中受控状态 */
  checked: boolean;
  /** 状态改变回调 */
  onChange: (checked: boolean) => void;
  /** 文本标签 */
  label?: string;
  /** 是否在开关右侧显示文本标签，默认为 true */
  showLabel?: boolean;
  /** 是否禁用 */
  disabled?: boolean;
  /** 尺寸大小，支持 'md' (默认) 和 'sm' (紧凑) */
  size?: 'sm' | 'md';
  /** 自定义外层 class */
  className?: string;
  /** 元素 ID */
  id?: string;
  /** 表单名称 */
  name?: string;
  /** 无障碍语义标签 */
  'aria-label'?: string;
}

/**
 * LeverSwitch 拟物机械拨杆开关组件
 * 模拟物理摇杆在开启与关闭时的摆动、弹性回弹与底座科技微光。
 */
export const LeverSwitch: React.FC<LeverSwitchProps> = ({
  checked,
  onChange,
  label,
  showLabel = true,
  disabled = false,
  size = 'md',
  className = '',
  id,
  name,
  'aria-label': ariaLabel,
}) => {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!disabled) {
        onChange(e.target.checked);
      }
    },
    [disabled, onChange]
  );

  const handleContainerClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // 避免当点击 label 时重复触发或失焦
      if (e.target instanceof HTMLInputElement) {
        return;
      }
      if (!disabled) {
        onChange(!checked);
      }
    },
    [checked, disabled, onChange]
  );

  return (
    <div
      className={`${styles.toggleContainer} ${checked ? styles.checked : ''} ${
        size === 'sm' ? styles.sizeSm : ''
      } ${disabled ? styles.disabled : ''} ${className}`.trim()}
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel || label}
      aria-disabled={disabled}
      onClick={handleContainerClick}
    >
      <div className={styles.switchArea}>
        <input
          id={id}
          name={name}
          className={styles.toggleInput}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={handleChange}
          tabIndex={disabled ? -1 : 0}
          aria-label={ariaLabel || label}
        />
        <div className={styles.toggleHandleWrapper}>
          <div className={styles.toggleHandle}>
            <div className={styles.toggleHandleKnob} />
            <div className={styles.toggleHandleBarWrapper}>
              <div className={styles.toggleHandleBar} />
            </div>
          </div>
        </div>
        <div className={styles.toggleBase}>
          <div className={styles.toggleBaseInside} />
        </div>
      </div>
      {label && showLabel && <span className={styles.label}>{label}</span>}
    </div>
  );
};

export default LeverSwitch;
