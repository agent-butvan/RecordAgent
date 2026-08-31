import React from 'react';
import { ToolCall } from './ToolCall';
import styles from './ToolCallDemo.module.css';

/**
 * ToolCall 组件演示：三个示例卡片（成功 / 执行中 / 失败）。
 */
export const ToolCallDemo: React.FC = () => {
  return (
    <div className={styles.demo}>
      <div className={styles.heading}>
        <p className={styles.title}>Agent Tool Calls</p>
        <p className={styles.subtitle}>实时工具执行记录</p>
      </div>

      <ToolCall
        tool="search_web"
        status="success"
        resultCount={3}
        arguments={{ query: 'spring physics easing' }}
        result={[
          'motion.dev — Spring options',
          'developer.mozilla.org — easing-function',
          'web.dev — Animations guide',
        ]}
        defaultOpen
      />

      <ToolCall tool="read_file" status="running" file="src/app/page.tsx" />

      <ToolCall
        tool="run_tests"
        status="failed"
        arguments={{ script: 'npm run test' }}
        error="AssertionError: expected 3 to equal 4\n    at tests/auth.test.ts:42"
      />
    </div>
  );
};
