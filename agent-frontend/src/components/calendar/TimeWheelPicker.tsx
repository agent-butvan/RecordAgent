import React, { useEffect, useMemo, useRef, useState } from 'react';
import { animate, motion, useMotionValue, useTransform } from 'framer-motion';
import type { MotionValue, PanInfo } from 'framer-motion';
import { CaretDownIcon, CheckIcon, ClockIcon, XIcon } from '@phosphor-icons/react';
import styles from './TimeWheelPicker.module.css';

const ITEM_HEIGHT = 28;
const WHEEL_THRESHOLD = 48;
const HOURS = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, '0'));

interface WheelColumnProps {
  items: string[];
  selectedIndex: number;
  ariaLabel: string;
  onSelect: (index: number) => void;
}

interface WheelItemProps {
  item: string;
  index: number;
  y: MotionValue<number>;
  selected: boolean;
  onSelect: () => void;
}

interface TimeWheelPickerProps {
  name: string;
  ariaLabel: string;
  defaultValue?: string;
  required?: boolean;
}

function currentTimeParts(): { hour: number; minute: number } {
  const now = new Date();
  return { hour: now.getHours(), minute: now.getMinutes() };
}

function parseTime(value?: string): { hour: number; minute: number } {
  if (!value) return currentTimeParts();
  const [hour, minute] = value.split(':').map(Number);
  return {
    hour: Number.isFinite(hour) ? Math.min(23, Math.max(0, hour)) : 0,
    minute: Number.isFinite(minute) ? Math.min(59, Math.max(0, minute)) : 0,
  };
}

function parseManualTime(value: string): { hour: number; minute: number } | null {
  const match = /^(\d{1,2}):([0-5]\d)$/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour <= 23 ? { hour, minute } : null;
}

const WheelItem: React.FC<WheelItemProps> = ({ item, index, y, selected, onSelect }) => {
  const itemPosition = useTransform(y, (latest) => index * ITEM_HEIGHT + latest + ITEM_HEIGHT);
  const opacity = useTransform(itemPosition, [0, ITEM_HEIGHT, ITEM_HEIGHT * 2], [0.24, 1, 0.24]);
  const scale = useTransform(itemPosition, [0, ITEM_HEIGHT, ITEM_HEIGHT * 2], [0.88, 1, 0.88]);

  return (
    <motion.button
      type="button"
      className={`${styles.wheelItem} ${selected ? styles.wheelItemSelected : ''}`}
      style={{ opacity, scale }}
      tabIndex={-1}
      onClick={onSelect}
    >
      {item}
    </motion.button>
  );
};

const WheelColumn: React.FC<WheelColumnProps> = ({ items, selectedIndex, ariaLabel, onSelect }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const y = useMotionValue(-selectedIndex * ITEM_HEIGHT);
  const valueRef = useRef(selectedIndex);
  const onSelectRef = useRef(onSelect);
  const wheelDeltaRef = useRef(0);
  const wheelLockUntilRef = useRef(0);

  useEffect(() => {
    valueRef.current = selectedIndex;
    onSelectRef.current = onSelect;
  });

  useEffect(() => {
    const controls = animate(y, -selectedIndex * ITEM_HEIGHT, {
      type: 'spring',
      stiffness: 360,
      damping: 34,
    });
    return () => controls.stop();
  }, [selectedIndex, y]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (Date.now() < wheelLockUntilRef.current) return;

      wheelDeltaRef.current += event.deltaY;
      if (Math.abs(wheelDeltaRef.current) < WHEEL_THRESHOLD) return;

      const direction = wheelDeltaRef.current > 0 ? 1 : -1;
      wheelDeltaRef.current = 0;
      wheelLockUntilRef.current = Date.now() + 90;
      const next = Math.min(items.length - 1, Math.max(0, valueRef.current + direction));
      if (next !== valueRef.current) onSelectRef.current(next);
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [items.length]);

  const selectFromDrag = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const projectedY = y.get() + info.velocity.y * 0.06;
    const next = Math.min(items.length - 1, Math.max(0, Math.round(-projectedY / ITEM_HEIGHT)));
    onSelect(next);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const delta = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0;
    if (!delta) return;
    event.preventDefault();
    onSelect(Math.min(items.length - 1, Math.max(0, selectedIndex + delta)));
  };

  const constraints = useMemo(() => ({
    top: -(items.length - 1) * ITEM_HEIGHT,
    bottom: 0,
  }), [items.length]);

  return (
    <div
      ref={containerRef}
      className={styles.wheelColumn}
      role="spinbutton"
      tabIndex={0}
      aria-label={ariaLabel}
      aria-valuenow={selectedIndex}
      aria-valuemin={0}
      aria-valuemax={items.length - 1}
      aria-valuetext={items[selectedIndex]}
      onKeyDown={handleKeyDown}
    >
      <span className={styles.selection} aria-hidden="true" />
      <motion.div
        className={styles.wheelTrack}
        style={{ y }}
        drag="y"
        dragConstraints={constraints}
        dragElastic={0.08}
        onDragEnd={selectFromDrag}
      >
        {items.map((item, index) => (
          <WheelItem
            key={item}
            item={item}
            index={index}
            y={y}
            selected={index === selectedIndex}
            onSelect={() => onSelect(index)}
          />
        ))}
      </motion.div>
    </div>
  );
};

/** 24 小时时间滚轮，支持拖拽、滚轮和方向键选择。 */
export const TimeWheelPicker: React.FC<TimeWheelPickerProps> = ({ name, ariaLabel, defaultValue, required = false }) => {
  const initial = useMemo(() => parseTime(defaultValue), [defaultValue]);
  const [hour, setHour] = useState(initial.hour);
  const [minute, setMinute] = useState(initial.minute);
  const [inputValue, setInputValue] = useState(defaultValue ?? (required ? `${HOURS[initial.hour]}:${MINUTES[initial.minute]}` : ''));
  const [isOpen, setIsOpen] = useState(false);
  const formattedValue = `${HOURS[hour]}:${MINUTES[minute]}`;

  const updateHour = (nextHour: number) => {
    setHour(nextHour);
    setInputValue(`${HOURS[nextHour]}:${MINUTES[minute]}`);
  };

  const updateMinute = (nextMinute: number) => {
    setMinute(nextMinute);
    setInputValue(`${HOURS[hour]}:${MINUTES[nextMinute]}`);
  };

  const updateFromInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.value.replace(/[^\d:]/g, '').slice(0, 5);
    setInputValue(nextValue);
    const parsed = parseManualTime(nextValue);
    if (parsed) {
      setHour(parsed.hour);
      setMinute(parsed.minute);
    }
  };

  const normalizeInput = () => {
    const parsed = parseManualTime(inputValue);
    if (parsed) setInputValue(`${HOURS[parsed.hour]}:${MINUTES[parsed.minute]}`);
  };

  const confirmWheelValue = () => {
    setInputValue(formattedValue);
    setIsOpen(false);
  };

  return (
    <div className={styles.picker}>
      <div
        className={`${styles.trigger} ${isOpen ? styles.triggerOpen : ''}`}
      >
        <ClockIcon size={14} aria-hidden="true" />
        <input
          type="text"
          name={name}
          value={inputValue}
          required={required}
          inputMode="numeric"
          maxLength={5}
          pattern="(?:[01]?\d|2[0-3]):[0-5]\d"
          title="请输入 00:00 到 23:59 之间的时间"
          placeholder="HH:MM"
          aria-label={`${ariaLabel}，可直接输入`}
          onChange={updateFromInput}
          onBlur={normalizeInput}
        />
        <button
          type="button"
          className={styles.toggleButton}
          aria-label={`${isOpen ? '收起' : '展开'}${ariaLabel}滚轮`}
          aria-expanded={isOpen}
          onClick={() => setIsOpen((current) => !current)}
        >
          <CaretDownIcon size={14} className={isOpen ? styles.chevronOpen : ''} />
        </button>
      </div>

      {isOpen && (
        <div className={styles.wheelPanel} role="group" aria-label={`${ariaLabel}滚轮`}>
          <div className={styles.wheels}>
            <WheelColumn items={HOURS} selectedIndex={hour} ariaLabel="小时" onSelect={updateHour} />
            <span className={styles.colon} aria-hidden="true">:</span>
            <WheelColumn items={MINUTES} selectedIndex={minute} ariaLabel="分钟" onSelect={updateMinute} />
          </div>
          <div className={styles.actions}>
            {!required && (
              <button type="button" onClick={() => { setInputValue(''); setIsOpen(false); }}>
                <XIcon size={12} />清除
              </button>
            )}
            <button type="button" className={styles.doneButton} onClick={confirmWheelValue}>
              <CheckIcon size={12} weight="bold" />完成
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TimeWheelPicker;
