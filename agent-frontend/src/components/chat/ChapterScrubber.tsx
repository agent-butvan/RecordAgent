import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type MotionValue,
} from 'framer-motion';
import styles from './ChapterScrubber.module.css';

export interface Chapter {
  /** 稳定的唯一标识。 */
  id: string;
  /** 预览卡上的加粗标题。 */
  title: string;
  /** 标题下的补充说明（卡片内最多三行）。 */
  description?: React.ReactNode;
  /** 标题上方的小号弱化标签（如时间戳或步骤号）。 */
  meta?: React.ReactNode;
}

export interface ChapterScrubberProps {
  /** 从上到下渲染的章节，每章对应一个刻度。 */
  chapters: Chapter[];
  /** 预览卡朝哪一侧展开；靠近视口边缘时自动翻转。默认 "right"。 */
  side?: 'left' | 'right';
  /** 指针位于波峰时刻度伸长的长度（px）。默认 56。 */
  peakLength?: number;
  /** 刻度静止时的长度（px）。默认 14。 */
  restLength?: number;
  /** 每行高度（px），即刻度间距。默认 10。 */
  rowHeight?: number;
  /** 放大波的半径（行数），指针影响范围。默认 4。 */
  radius?: number;
  /** 标记一个常驻的“当前位置”章节（如 Agent 当前执行到哪一步）。 */
  currentIndex?: number;
  /** 激活（悬停/聚焦）章节变化时触发。 */
  onActiveChange?: (chapter: Chapter | null, index: number) => void;
  /** 点击、Enter 或 Space 选择章节时触发。 */
  onSelect?: (chapter: Chapter, index: number) => void;
  /** 时间轨的无障碍名称。默认 "Chapters"。 */
  label?: string;
  className?: string;
}

const CARD_WIDTH = 260;
const GAP = 20;
// 紧贴指针的近临界阻尼弹簧：几乎没有延迟且不过冲，波浪像吸附在指针上。
const POINTER_SPRING = { stiffness: 700, damping: 52, mass: 0.5 };
// 更柔和的升降弹簧：波浪从容地隆起与回落。
const STRENGTH_SPRING = { stiffness: 260, damping: 30, mass: 0.6 };

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

/**
 * 升余弦隆起：波峰处为 1，超出半径归零，两端斜率为零，
 * 因此波浪边缘没有接缝——这正是丝滑衰减的来源。
 */
function bump(distance: number, radius: number) {
  if (distance >= radius) return 0;
  return 0.5 * (1 + Math.cos(Math.PI * (distance / radius)));
}

interface TickProps {
  index: number;
  pointer: MotionValue<number>;
  strength: MotionValue<number>;
  radius: number;
  restLength: number;
  peakLength: number;
  isCurrent: boolean;
}

const Tick = React.memo(function Tick({
  index,
  pointer,
  strength,
  radius,
  restLength,
  peakLength,
  isCurrent,
}: TickProps) {
  const width = useTransform(() => {
    const rise = strength.get() * bump(Math.abs(index - pointer.get()), radius);
    return restLength + rise * (peakLength - restLength);
  });
  const opacity = useTransform(() => {
    const rise = strength.get() * bump(Math.abs(index - pointer.get()), radius);
    const base = isCurrent ? 0.85 : 0.3;
    return base + rise * (1 - base);
  });
  const scaleY = useTransform(() => {
    const rise = strength.get() * bump(Math.abs(index - pointer.get()), radius);
    // 波峰处仅轻微加粗（2px → 约 2.8px）；伸长承载主要视觉变化。
    return 1 + rise * 0.4;
  });

  return (
    <motion.span
      aria-hidden="true"
      style={{ width, opacity, scaleY }}
      className={`${styles.tickBase} ${isCurrent ? styles.tickCurrent : styles.tick}`}
    />
  );
});

export function ChapterScrubber({
  chapters,
  side = 'right',
  peakLength = 56,
  restLength = 14,
  rowHeight = 10,
  radius = 4,
  currentIndex,
  onActiveChange,
  onSelect,
  label = 'Chapters',
  className,
}: ChapterScrubberProps) {
  const prefersReducedMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const buttonsRef = useRef<Array<HTMLButtonElement | null>>([]);
  // 使用命名空间 id，保证多实例下选项 id 唯一，且不依赖 chapter.id 是合法且无冲突的 DOM id。
  const baseId = React.useId();
  const optionId = (index: number) => `${baseId}-opt-${index}`;

  const rawPointer = useMotionValue(0);
  const rawStrength = useMotionValue(0);
  const springPointer = useSpring(rawPointer, POINTER_SPRING);
  const springStrength = useSpring(rawStrength, STRENGTH_SPRING);
  // 减少动态效果偏好：去掉时间缓动，保留空间波浪，隆起即时发生。
  const pointer = prefersReducedMotion ? rawPointer : springPointer;
  const strength = prefersReducedMotion ? rawStrength : springStrength;

  const [activeIndex, setActiveIndex] = useState(0);
  const [engaged, setEngaged] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [cardHeight, setCardHeight] = useState(0);
  const hoveringRef = useRef(false);
  const focusedRef = useRef<number | null>(null);
  const activeRef = useRef(0);

  const commitActive = useCallback((index: number) => {
    if (index !== activeRef.current) {
      activeRef.current = index;
      setActiveIndex(index);
    }
  }, []);

  const last = chapters.length - 1;

  useEffect(() => {
    onActiveChange?.(
      engaged ? chapters[activeIndex] : null,
      engaged ? activeIndex : -1,
    );
  }, [engaged, activeIndex, chapters, onActiveChange]);

  // 测量卡片高度，使卡片纵向移动被限制在时间轨范围内。
  useEffect(() => {
    if (cardRef.current) setCardHeight(cardRef.current.offsetHeight);
  }, [activeIndex]);

  // 若卡片会溢出视口，则向空间更大的一侧翻转。
  useEffect(() => {
    if (!engaged) return;
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vw = el.ownerDocument.defaultView?.innerWidth ?? 0;
    const need = CARD_WIDTH + GAP + 8;
    let useRight = side === 'right';
    if (useRight && vw - rect.right < need && rect.left >= need) {
      useRight = false;
    }
    if (!useRight && rect.left < need && vw - rect.right >= need) {
      useRight = true;
    }
    setFlipped(useRight !== (side === 'right'));
  }, [engaged, activeIndex, side]);

  const resolvedSide =
    side === 'right'
      ? flipped
        ? 'left'
        : 'right'
      : flipped
        ? 'right'
        : 'left';

  const totalHeight = chapters.length * rowHeight;
  // 同一时刻只有一个刻度可 Tab 聚焦（roving tabindex）。
  const rovingIndex = engaged ? activeIndex : (currentIndex ?? 0);

  const cardTop = useTransform(pointer, (p) => {
    const half = cardHeight / 2;
    const center = clamp(
      (p + 0.5) * rowHeight,
      half,
      Math.max(half, totalHeight - half),
    );
    return center - half;
  });
  const cardScale = useTransform(strength, [0, 1], [0.97, 1]);
  const cardX = useTransform(
    strength,
    [0, 1],
    [resolvedSide === 'right' ? -6 : 6, 0],
  );

  const engageAt = (pointerRow: number, activeAt: number) => {
    rawPointer.set(pointerRow);
    rawStrength.set(1);
    commitActive(clamp(activeAt, 0, last));
    if (!engaged) setEngaged(true);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const el = listRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const row = (event.clientY - rect.top) / rowHeight - 0.5;
    hoveringRef.current = true;
    engageAt(clamp(row, -0.5, last + 0.5), Math.round(row));
  };

  const handlePointerLeave = () => {
    hoveringRef.current = false;
    if (focusedRef.current != null) {
      rawPointer.set(focusedRef.current);
    } else {
      rawStrength.set(0);
      setEngaged(false);
    }
  };

  const handleBlur = (event: React.FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      focusedRef.current = null;
      if (!hoveringRef.current) {
        rawStrength.set(0);
        setEngaged(false);
      }
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    let next = focusedRef.current ?? activeRef.current;
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        next = Math.min(last, next + 1);
        break;
      case 'ArrowUp':
      case 'ArrowLeft':
        next = Math.max(0, next - 1);
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = last;
        break;
      default:
        return;
    }
    event.preventDefault();
    buttonsRef.current[next]?.focus();
  };

  return (
    <div
      ref={containerRef}
      style={{ width: peakLength }}
      className={`${styles.container} ${className ?? ''}`}
    >
      <div
        ref={listRef}
        role="listbox"
        aria-label={label}
        aria-orientation="vertical"
        aria-activedescendant={engaged ? optionId(activeIndex) : undefined}
        className={styles.list}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
      >
        {chapters.map((chapter, index) => {
          const isCurrent = index === currentIndex;
          const descText =
            typeof chapter.description === 'string'
              ? `. ${chapter.description}`
              : '';
          return (
            <button
              ref={(el) => {
                buttonsRef.current[index] = el;
              }}
              key={chapter.id}
              id={optionId(index)}
              type="button"
              role="option"
              aria-selected={isCurrent}
              aria-label={`${chapter.title}${descText}`}
              tabIndex={index === rovingIndex ? 0 : -1}
              onFocus={() => {
                focusedRef.current = index;
                engageAt(index, index);
              }}
              onClick={() => onSelect?.(chapter, index)}
              style={{ height: rowHeight }}
              className={`${styles.rowBtn} ${
                resolvedSide === 'left' ? styles.rowBtnLeft : styles.rowBtnRight
              }`}
            >
              <Tick
                index={index}
                pointer={pointer}
                strength={strength}
                radius={radius}
                restLength={restLength}
                peakLength={peakLength}
                isCurrent={isCurrent}
              />
            </button>
          );
        })}
      </div>

      {chapters[activeIndex] ? (
        <motion.div
          ref={cardRef}
          aria-hidden="true"
          style={{
            top: cardTop,
            x: cardX,
            scale: cardScale,
            opacity: strength,
            transformOrigin: resolvedSide === 'right' ? 'left center' : 'right center',
            ...(resolvedSide === 'right'
              ? { left: peakLength + GAP }
              : { right: peakLength + GAP }),
          }}
          className={styles.card}
        >
          {chapters[activeIndex].meta ? (
            <div className={styles.cardMeta}>{chapters[activeIndex].meta}</div>
          ) : null}
          <div className={styles.cardTitle}>{chapters[activeIndex].title}</div>
          {chapters[activeIndex].description ? (
            <p className={styles.cardDesc}>
              {chapters[activeIndex].description}
            </p>
          ) : null}
        </motion.div>
      ) : null}
    </div>
  );
}

export default ChapterScrubber;
