import {
  animate,
  motion,
  useDragControls,
  useMotionValue,
} from 'framer-motion';
import { useEffect, useRef, useState, type PointerEvent, type RefObject } from 'react';
import styles from './StickyTodoNote.module.css';

export interface StickyTodoItem {
  id: string;
  text: string;
  done: boolean;
  pending?: boolean;
}

export type StickyTodoTone = 'yellow' | 'green' | 'blue';

interface StickyTodoNoteProps {
  title: string;
  subtitle?: string;
  tone?: StickyTodoTone;
  items: StickyTodoItem[];
  initialX: number;
  initialY: number;
  rotation?: number;
  constraintsRef: RefObject<HTMLDivElement | null>;
  onToggle: (item: StickyTodoItem) => void;
}

let topZIndex = 5;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

/** 拟真待办便签：包含纸张展开、勾选进度、拖拽抬起、速度倾斜与松手回弹。 */
export function StickyTodoNote({
  title,
  subtitle,
  tone = 'yellow',
  items,
  initialX,
  initialY,
  rotation = 0,
  constraintsRef,
  onToggle,
}: StickyTodoNoteProps) {
  const [dragging, setDragging] = useState(false);
  const [zIndex, setZIndex] = useState(2);
  const noteRef = useRef<HTMLElement>(null);
  const x = useMotionValue(initialX);
  const y = useMotionValue(initialY);
  const rotate = useMotionValue(rotation);
  const dragControls = useDragControls();
  const completed = items.filter((item) => item.done).length;
  const progress = items.length ? (completed / items.length) * 100 : 0;

  useEffect(() => {
    const board = constraintsRef.current;
    if (!board) return;
    const keepInsideBoard = () => {
      const note = noteRef.current;
      if (!note) return;
      x.set(clamp(x.get(), 0, Math.max(0, board.clientWidth - note.offsetWidth)));
      y.set(clamp(y.get(), 0, Math.max(0, board.clientHeight - note.offsetHeight)));
    };
    const observer = new ResizeObserver(keepInsideBoard);
    observer.observe(board);
    observer.observe(noteRef.current!);
    keepInsideBoard();
    return () => observer.disconnect();
  }, [constraintsRef, x, y]);

  const beginDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    if ((event.target as HTMLElement).closest('button')) return;
    topZIndex += 1;
    setZIndex(topZIndex);
    setDragging(true);
    dragControls.start(event);
  };

  const finishDrag = () => {
    setDragging(false);
    void animate(rotate, rotation, {
      type: 'spring',
      stiffness: 150,
      damping: 9,
      mass: 0.75,
    });
  };

  return (
    <motion.article
      ref={noteRef}
      className={styles.note}
      data-tone={tone}
      style={{ x, y, zIndex }}
      drag
      dragControls={dragControls}
      dragListener={false}
      dragConstraints={constraintsRef}
      dragElastic={0}
      dragMomentum={false}
      onDrag={(_, info) => {
        rotate.set(
          rotation +
            clamp(info.velocity.x / 135, -7, 7) +
            clamp(info.velocity.y / -850, -2.5, 2.5),
        );
      }}
      onDragEnd={finishDrag}
      onPointerCancel={finishDrag}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.12, duration: 0.15 }}
    >
      <motion.div
        className={styles.shell}
        style={{ rotate }}
        initial={{ rotate: rotation - 3.5 }}
        animate={{ rotate: rotation }}
        transition={{ type: 'spring', stiffness: 165, damping: 8, delay: 0.2 }}
      >
        <motion.div
          className={`${styles.paper} ${dragging ? styles.dragging : ''}`}
          onPointerDown={beginDrag}
          initial={{ scaleY: 0.09, scaleX: 0.96, y: -18, opacity: 0.92 }}
          animate={
            dragging
              ? {
                  scaleY: 1,
                  scaleX: 1.025,
                  y: -10,
                  opacity: 1,
                  filter: 'brightness(1.018)',
                  boxShadow:
                    '0 38px 64px rgba(40,50,62,.18), 0 14px 22px rgba(30,36,45,.11)',
                }
              : {
                  scaleY: 1,
                  scaleX: 1,
                  y: 0,
                  opacity: 1,
                  filter: 'brightness(1)',
                  boxShadow:
                    '0 26px 45px var(--note-shadow), 0 9px 18px rgba(25,35,48,.08)',
                }
          }
          transition={
            dragging
              ? { duration: 0.22, ease: 'easeOut' }
              : {
                  type: 'spring',
                  stiffness: 180,
                  damping: 13,
                  mass: 0.9,
                  delay: 0.12,
                }
          }
        >
          <svg
            className={styles.paperGrain}
            viewBox="0 0 304 302"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <filter id={`sticky-noise-${tone}`}>
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.9"
                numOctaves="2"
                seed="7"
              />
              <feColorMatrix type="saturate" values="0" />
            </filter>
            <rect width="100%" height="100%" fill="transparent" />
          </svg>

          <motion.div
            className={styles.tape}
            initial={{ opacity: 0, y: -28, rotate: -13, scale: 0.82 }}
            animate={{ opacity: 0.76, y: 0, rotate: -4, scale: 1 }}
            transition={{
              type: 'spring',
              stiffness: 360,
              damping: 16,
              delay: 0.26,
            }}
          />
          <span className={`${styles.crease} ${styles.creaseA}`} />
          <span className={`${styles.crease} ${styles.creaseB}`} />

          <motion.header
            className={styles.head}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, delay: 0.55 }}
          >
            <div className={styles.titleLine}>
              <h3>{title}</h3>
              {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
            </div>
            <button className={styles.menu} aria-label="更多" type="button">
              <span>•••</span>
            </button>
          </motion.header>

          <div className={styles.list}>
            {items.map((item, index) => (
              <motion.button
                className={`${styles.todo} ${item.done ? styles.done : ''}`}
                key={item.id}
                type="button"
                onClick={() => onToggle(item)}
                disabled={item.pending}
                aria-label={`${item.done ? '取消完成' : '标记完成'}：${item.text}`}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.65 + index * 0.045 }}
              >
                <motion.span
                  className={styles.check}
                  animate={
                    item.done ? { scale: [0.88, 1.12, 1] } : { scale: 1 }
                  }
                  transition={{ duration: 0.22 }}
                >
                  {item.done && (
                    <motion.svg viewBox="0 0 20 20" fill="none">
                      <motion.path
                        d="M5 10.2 8.2 13.25 15 6.7"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        initial={{ pathLength: 0, opacity: 0 }}
                        animate={{ pathLength: 1, opacity: 1 }}
                        transition={{ duration: 0.18 }}
                      />
                    </motion.svg>
                  )}
                </motion.span>
                <span className={styles.label}>{item.text}</span>
              </motion.button>
            ))}
          </div>

          <motion.footer
            className={styles.footer}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, delay: 0.83 }}
          >
            <div className={styles.track}>
              <motion.div
                className={styles.bar}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.45, ease: 'easeOut' }}
              />
            </div>
            <div className={styles.count}>
              {completed}/{items.length} 已完成
            </div>
          </motion.footer>

          <motion.div
            className={styles.curl}
            initial={{ scale: 0.35, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{
              type: 'spring',
              stiffness: 320,
              damping: 15,
              delay: 0.76,
            }}
          />
        </motion.div>
      </motion.div>
    </motion.article>
  );
}
