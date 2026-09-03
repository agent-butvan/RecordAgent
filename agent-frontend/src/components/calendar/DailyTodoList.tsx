import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import type { CalendarTodo } from '../../types/calendar';
import { DailyRecordDeleteButton } from './DailyRecordDeleteButton';
import styles from './DailyTodoList.module.css';

interface DailyTodoListProps {
  todos: CalendarTodo[];
  onToggle: (todoId: string) => void;
  onDelete: (todo: CalendarTodo) => void;
}

const priorityLabels = {
  high: '重要',
  medium: '计划',
  low: '生活',
} as const;

/** 带手绘划线反馈的当日待办清单。 */
export const DailyTodoList: React.FC<DailyTodoListProps> = ({ todos, onToggle, onDelete }) => {
  if (todos.length === 0) {
    return <p className={styles.empty}>这一天没有待办，留给自己一点空白。</p>;
  }

  return (
    <div className={styles.list}>
      {todos.map((todo) => (
        <div key={todo.id} className={styles.item}>
          <label className={styles.toggle}>
            <input
              className={styles.checkboxInput}
              type="checkbox"
              checked={todo.completed}
              onChange={() => onToggle(todo.id)}
              aria-label={`标记“${todo.title}”完成`}
            />
            <span className={styles.checkbox} aria-hidden="true">
              {todo.completed && <Check size={13} strokeWidth={2.6} />}
            </span>
          </label>
          <span className={styles.todoContent}>
            <span className={styles.todoLine}>
              <span className={todo.completed ? styles.todoTitleDone : styles.todoTitle}>{todo.title}</span>
              <motion.svg
                viewBox="0 0 340 32"
                preserveAspectRatio="none"
                className={styles.strike}
                aria-hidden="true"
              >
                <motion.path
                  d="M 8 16.5 C 49 7, 89 12, 128 16 C 169 21, 215 8, 258 14 C 288 18, 314 11, 334 15"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeWidth="2"
                  initial={false}
                  animate={{ pathLength: todo.completed ? 1 : 0, opacity: todo.completed ? 1 : 0 }}
                  transition={{ pathLength: { duration: 0.52, ease: 'easeInOut' }, opacity: { duration: 0.01, delay: todo.completed ? 0 : 0.52 } }}
                />
              </motion.svg>
            </span>
            <span className={styles.meta}>
              <span className={`${styles.priority} ${styles[`priority${todo.priority[0].toUpperCase()}${todo.priority.slice(1)}`]}`}>{priorityLabels[todo.priority]}</span>
              {todo.time && <span>{todo.time}</span>}
            </span>
          </span>
          <DailyRecordDeleteButton label={`待办“${todo.title}”`} onDelete={() => onDelete(todo)} />
        </div>
      ))}
    </div>
  );
};
