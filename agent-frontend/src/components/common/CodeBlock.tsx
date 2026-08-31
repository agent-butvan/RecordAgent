import React, { useMemo, useState } from 'react';
import hljs from 'highlight.js/lib/core';
import typescript from 'highlight.js/lib/languages/typescript';
import javascript from 'highlight.js/lib/languages/javascript';
import python from 'highlight.js/lib/languages/python';
import java from 'highlight.js/lib/languages/java';
import json from 'highlight.js/lib/languages/json';
import markdown from 'highlight.js/lib/languages/markdown';
import bash from 'highlight.js/lib/languages/bash';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import plaintext from 'highlight.js/lib/languages/plaintext';
import diff from 'highlight.js/lib/languages/diff';
import sql from 'highlight.js/lib/languages/sql';
import yaml from 'highlight.js/lib/languages/yaml';
import { Copy, Check } from 'lucide-react';
import styles from './CodeBlock.module.css';

// 按需注册常用语言，避免整包 highlight.js 导致体积膨胀
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('python', python);
hljs.registerLanguage('java', java);
hljs.registerLanguage('json', json);
hljs.registerLanguage('markdown', markdown);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('css', css);
hljs.registerLanguage('plaintext', plaintext);
hljs.registerLanguage('diff', diff);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('yaml', yaml);

const LANGUAGE_ALIASES: Record<string, string> = {
  tsx: 'typescript',
  jsx: 'javascript',
  react: 'typescript',
  sh: 'bash',
  shell: 'bash',
  md: 'markdown',
  plain: 'plaintext',
  text: 'plaintext',
};

/** 将展示语言名映射为 highlight.js 可识别的语言；未知时返回 undefined。 */
function toHighlightLanguage(language?: string): string | undefined {
  if (!language) return undefined;
  const name = language.trim().toLowerCase();
  const candidate = LANGUAGE_ALIASES[name] ?? name;
  return hljs.getLanguage(candidate) ? candidate : undefined;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** 语法高亮：优先按指定语言，未识别时自动探测，最终回退为纯文本。 */
function highlightCode(code: string, language?: string): string {
  const lang = toHighlightLanguage(language);
  try {
    if (lang) {
      return hljs.highlight(code, { language: lang }).value;
    }
    return hljs.highlightAuto(code).value;
  } catch {
    return escapeHtml(code);
  }
}

export interface CodeBlockProps {
  /** 语言标签，例如 tsx / React / python / json */
  language?: string;
  /** 文件名，可选 */
  filename?: string;
  /** 代码内容 */
  code: string;
  className?: string;
}

/**
 * AI Coding Agent 代码展示卡片：语言 badge + 文件名 + 一键复制 + 柔和语法高亮。
 * 视觉参照 Cursor / Claude Code / Vercel 的浅色开发者工具风格。
 */
export const CodeBlock: React.FC<CodeBlockProps> = ({
  language,
  filename,
  code,
  className = '',
}) => {
  const [copied, setCopied] = useState(false);
  const highlighted = useMemo(() => highlightCode(code, language), [code, language]);
  const displayLanguage = (language || '').trim() || '代码';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // 剪贴板不可用时静默忽略
    }
  };

  return (
    <div className={`${styles.card} ${className}`}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.langBadge}>{displayLanguage}</span>
          {filename && (
            <span className={styles.filename} title={filename}>
              {filename}
            </span>
          )}
        </div>
        <button
          type="button"
          className={styles.copyBtn}
          onClick={handleCopy}
          title={copied ? '已复制' : '复制代码'}
          aria-label={copied ? '代码已复制' : '复制代码'}
        >
          {copied ? <Check size={15} /> : <Copy size={15} />}
        </button>
      </div>
      <pre className={styles.codeArea}>
        <code dangerouslySetInnerHTML={{ __html: highlighted }} />
      </pre>
    </div>
  );
};

export default CodeBlock;
