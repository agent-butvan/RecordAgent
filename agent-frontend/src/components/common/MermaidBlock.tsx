import React, { useEffect, useId, useMemo, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { CodeBlock } from './CodeBlock';
import styles from './MermaidBlock.module.css';

type MermaidApi = (typeof import('mermaid'))['default'];
type RenderResult = Awaited<ReturnType<MermaidApi['render']>>;

let mermaidPromise: Promise<MermaidApi> | null = null;
let renderQueue: Promise<void> = Promise.resolve();
let renderCount = 0;

/** Mermaid 体积较大，仅在消息确实包含图表时加载。 */
async function loadMermaid(): Promise<MermaidApi> {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then(({ default: mermaid }) => {
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        suppressErrorRendering: true,
        theme: 'base',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
        themeVariables: {
          primaryColor: '#eff6ff',
          primaryBorderColor: '#93c5fd',
          primaryTextColor: '#0f172a',
          lineColor: '#64748b',
          secondaryColor: '#f8fafc',
          tertiaryColor: '#ffffff',
          clusterBkg: '#f8fafc',
          clusterBorder: '#cbd5e1',
          fontSize: '14px',
        },
      });
      return mermaid;
    });
  }
  return mermaidPromise;
}

/** Mermaid 使用共享配置，串行渲染可避免多张图同时更新内部状态。 */
function renderMermaid(id: string, source: string): Promise<RenderResult> {
  const task = renderQueue.then(async () => {
    const mermaid = await loadMermaid();
    return mermaid.render(id, source);
  });
  renderQueue = task.then(
    () => undefined,
    () => undefined
  );
  return task;
}

/** 容忍模型偶尔输出的 Unicode 箭头简写，例如 `A → B`。 */
function normalizeMermaidSource(source: string): string {
  return source.trim().replace(/[ \t]+(?:→|⟶|⟹)[ \t]+/g, ' --> ');
}

export interface MermaidBlockProps {
  code: string;
}

/** 将 Markdown 的 mermaid 代码围栏渲染为图表，失败时回退显示原始源码。 */
export const MermaidBlock: React.FC<MermaidBlockProps> = ({ code }) => {
  const reactId = useId();
  const diagramId = useMemo(() => `mermaid-${reactId.replace(/[^a-zA-Z0-9_-]/g, '')}`, [reactId]);
  const source = useMemo(() => normalizeMermaidSource(code), [code]);
  const [svg, setSvg] = useState('');
  const [error, setError] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    setSvg('');
    setError(false);

    const currentRenderId = `${diagramId}-${++renderCount}`;
    renderMermaid(currentRenderId, source)
      .then((result) => {
        if (active) setSvg(result.svg);
      })
      .catch(() => {
        if (active) setError(true);
      });

    return () => {
      active = false;
    };
  }, [diagramId, source]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // 剪贴板不可用时保留图表，不影响阅读。
    }
  };

  if (error) {
    return (
      <div className={styles.fallback}>
        <p role="alert">Mermaid 图表语法有误，已显示原始内容。</p>
        <CodeBlock language="mermaid" code={code} />
      </div>
    );
  }

  return (
    <figure className={styles.card} aria-label="Mermaid 图表">
      <figcaption className={styles.header}>
        <span className={styles.label}>Mermaid</span>
        <button
          type="button"
          className={styles.copyButton}
          onClick={handleCopy}
          title={copied ? '已复制' : '复制图表源码'}
          aria-label={copied ? '图表源码已复制' : '复制图表源码'}
        >
          {copied ? <Check size={15} /> : <Copy size={15} />}
        </button>
      </figcaption>
      <div
        className={`${styles.diagram} ${svg ? styles.ready : styles.loading}`}
        aria-busy={!svg}
        aria-live="polite"
      >
        {svg ? (
          <div className={styles.svgWrap} dangerouslySetInnerHTML={{ __html: svg }} />
        ) : (
          <span className={styles.loadingText}>正在绘制图表…</span>
        )}
      </div>
    </figure>
  );
};

export default MermaidBlock;
