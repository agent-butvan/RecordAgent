import { useRef } from 'react';
import { StickyTodoNote, type StickyTodoItem } from './StickyTodoNote';
import styles from './CalendarStickyNotes.module.css';

const WEEK_ITEMS: StickyTodoItem[] = [
  { id: 'week-leetcode', text: '完成 3 道 LeetCode', done: true },
  { id: 'week-knowledge', text: '学习 2 个八股文知识点', done: true },
  { id: 'week-tags', text: '整理资料库标签', done: true },
  { id: 'week-report', text: '完成 1 篇周报', done: false },
  { id: 'week-review', text: '复盘本周学习记录', done: false },
];

const MONTH_ITEMS: StickyTodoItem[] = [
  { id: 'month-calendar', text: '完善 Agent 工作台日历', done: true },
  { id: 'month-study', text: '累计学习时长 40 小时', done: true },
  { id: 'month-records', text: '输出 8 篇学习记录', done: true },
  { id: 'month-blog', text: '完成博客优化', done: false },
  { id: 'month-java', text: '复习 Java 基础知识树', done: false },
];

/** 日历便签舞台：复刻参考中的双便签初始位置并约束拖拽边界。 */
export function CalendarStickyNotes() {
  const boardRef = useRef<HTMLDivElement>(null);

  return (
    <section className={styles.board} ref={boardRef} aria-label="待办便签">
      <StickyTodoNote
        title="本周待办"
        subtitle="Week Focus"
        tone="yellow"
        items={WEEK_ITEMS}
        initialX={0}
        initialY={38}
        rotation={-2.4}
        constraintsRef={boardRef}
      />
      <StickyTodoNote
        title="本月待办"
        subtitle="Month Goals"
        tone="green"
        items={MONTH_ITEMS}
        initialX={292}
        initialY={50}
        rotation={2.1}
        constraintsRef={boardRef}
      />
    </section>
  );
}
