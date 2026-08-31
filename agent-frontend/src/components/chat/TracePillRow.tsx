import React, { useState } from 'react';
import {
  AlertCircle,
  ChevronDown,
  Command,
  Database,
  FileCode2,
  FileText,
  Search,
  Terminal,
  Check,
  Globe,
  ExternalLink,
  Cpu,
} from 'lucide-react';
import type { TraceNode, ToolDefinition } from '../../types/chat';
import { TerminalCommand } from './TerminalCommand';
import { FileDiff } from './FileDiff';
import styles from './TracePillRow.module.css';

interface TracePillRowProps {
  node: TraceNode;
  isActive: boolean;
  isFinished: boolean;
  toolRegistry?: Record<string, ToolDefinition>;
}

interface IconRenderProps {
  className?: string;
  style?: React.CSSProperties;
  'aria-hidden'?: boolean;
}

function renderDynamicIcon(
  icon: TraceNode['icon'],
  iconClassName?: string
): React.ReactNode {
  if (!icon) return null;
  if (React.isValidElement(icon)) return icon;
  if (typeof icon === 'function') {
    return React.createElement(icon as React.ComponentType<IconRenderProps>, {
      className: styles.dynamicIcon,
      style: iconClassName ? { color: iconClassName } : undefined,
      'aria-hidden': true,
    });
  }
  return null;
}

export const TracePillRow: React.FC<TracePillRowProps> = ({
  node,
  isActive,
  isFinished: _isFinished,
  toolRegistry = {},
}) => {
  const [open, setOpen] = useState(false);

  const toolDef = node.toolName ? toolRegistry[node.toolName] : undefined;
  const isCommandNode = Boolean(node.command || node.type === 'terminal' || node.type === 'command');

  const hasDetails = Boolean(
    isCommandNode ||
      node.renderContent ||
      toolDef?.renderCustomContent ||
      node.diffRows ||
      node.codeSnippet ||
      (node.details && node.details.length > 0) ||
      (node.sources && node.sources.length > 0) ||
      node.args ||
      node.result
  );

  const primaryText =
    node.primary ||
    (isCommandNode ? '运行' : undefined) ||
    (typeof toolDef?.label === 'function' ? toolDef.label(node.args) : toolDef?.label) ||
    toolDef?.name ||
    node.type;

  const secondaryText =
    node.secondary ||
    node.command ||
    (toolDef?.formatChip ? toolDef.formatChip(node.args, node.result) : undefined) ||
    (typeof node.args === 'string' ? node.args : undefined);

  const isMono = node.mono ?? (isCommandNode || Boolean(toolDef?.monoChip));

  const renderIcon = () => {
    if (isActive) {
      return <span className={styles.spinner} aria-hidden="true" />;
    }
    if (node.status === 'failed' || (node.exitCode !== undefined && node.exitCode > 0)) {
      return <AlertCircle className={styles.iconFail} aria-hidden="true" />;
    }
    if (node.icon) return renderDynamicIcon(node.icon, node.iconClassName);
    if (toolDef?.icon) return renderDynamicIcon(toolDef.icon, toolDef.iconClassName);

    const semanticKey =
      `${node.primary || ''} ${node.toolName || ''} ${node.type || ''} ${node.command || ''}`.toLowerCase();

    if (semanticKey.includes('read') || semanticKey.includes('inspect') || semanticKey.includes('parse')) {
      return <FileText className={styles.iconMuted} aria-hidden="true" />;
    }
    if (
      semanticKey.includes('edit') ||
      semanticKey.includes('write') ||
      semanticKey.includes('patch') ||
      semanticKey.includes('create')
    ) {
      return <FileCode2 className={styles.iconAmber} aria-hidden="true" />;
    }
    if (
      isCommandNode ||
      semanticKey.includes('run') ||
      semanticKey.includes('test') ||
      semanticKey.includes('compile') ||
      semanticKey.includes('tsc') ||
      semanticKey.includes('exec')
    ) {
      return <Terminal className={styles.iconViolet} aria-hidden="true" />;
    }
    if (semanticKey.includes('search') || semanticKey.includes('query') || semanticKey.includes('lookup')) {
      return <Search className={styles.iconBlue} aria-hidden="true" />;
    }
    if (
      semanticKey.includes('db') ||
      semanticKey.includes('database') ||
      semanticKey.includes('sql') ||
      semanticKey.includes('redis')
    ) {
      return <Database className={styles.iconEmerald} aria-hidden="true" />;
    }
    if (semanticKey.includes('deploy') || semanticKey.includes('canary') || semanticKey.includes('cluster')) {
      return <Cpu className={styles.iconSky} aria-hidden="true" />;
    }
    if (node.type === 'step') {
      return <Check className={styles.iconEmerald} aria-hidden="true" />;
    }
    return <Command className={styles.iconMuted} aria-hidden="true" />;
  };

  return (
    <div className={styles.container}>
      <button
        type="button"
        disabled={!hasDetails}
        aria-expanded={open}
        onClick={() => hasDetails && setOpen((v) => !v)}
        className={`${styles.trigger} ${hasDetails ? styles.triggerClickable : ''}`}
      >
        <span className={styles.iconWrap}>
          <span className={`${styles.iconSlot} ${hasDetails ? styles.iconHoverable : ''} ${open ? styles.iconHidden : ''}`}>
            {renderIcon()}
          </span>
          {hasDetails && (
            <ChevronDown
              className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}
              aria-hidden="true"
            />
          )}
        </span>

        <span className={styles.primary}>{primaryText}</span>

        {secondaryText && (
          <span className={`${styles.chip} ${isMono ? styles.chipMono : ''}`}>
            <span className={styles.chipText}>{secondaryText}</span>
          </span>
        )}

        {(node.add !== undefined || node.del !== undefined) && (
          <span className={styles.counts}>
            {node.add !== undefined && node.add > 0 && (
              <span className={styles.addCount}>+{node.add}</span>
            )}
            {node.del !== undefined && node.del > 0 && (
              <span className={styles.delCount}>−{node.del}</span>
            )}
          </span>
        )}
      </button>

      {hasDetails && (
        <div className={`${styles.details} ${open ? styles.detailsOpen : ''}`}>
          <div className={styles.detailsInner}>
            <div className={styles.detailsList}>
              {node.renderContent ? (
                node.renderContent()
              ) : toolDef?.renderCustomContent ? (
                toolDef.renderCustomContent({ args: node.args, result: node.result, node })
              ) : null}

              {isCommandNode && node.command && (
                <TerminalCommand
                  command={node.command}
                  output={node.output}
                  exitCode={node.exitCode ?? 0}
                  durationMs={node.durationMs}
                  isRunning={isActive}
                />
              )}

              {node.diffRows && (
                <FileDiff
                  file={node.diffFile || (typeof node.secondary === 'string' ? node.secondary : 'patch.ts')}
                  rows={node.diffRows}
                />
              )}

              {!isCommandNode && node.details && node.details.length > 0 && (
                <div className={styles.detailLines}>
                  {node.details.map((line, lIdx) => (
                    <span
                      key={lIdx}
                      className={`${styles.detailLine} ${
                        line.tone === 'add'
                          ? styles.detailAdd
                          : line.tone === 'del'
                          ? styles.detailDel
                          : line.tone === 'ctx'
                          ? styles.detailCtx
                          : line.tone === 'error'
                          ? styles.detailError
                          : styles.detailMuted
                      }`}
                    >
                      {line.text}
                    </span>
                  ))}
                </div>
              )}

              {!isCommandNode && !node.diffRows && node.codeSnippet && (
                <div className={styles.codeSnippet}>
                  <pre className={styles.codePre}>{node.codeSnippet}</pre>
                </div>
              )}

              {node.sources && node.sources.length > 0 && (
                <div className={styles.sources}>
                  {node.sources.map((src, sIdx) => (
                    <a
                      key={sIdx}
                      href={src.url || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.sourceLink}
                    >
                      <Globe className={styles.sourceGlobe} aria-hidden="true" />
                      <span>{src.name}</span>
                      <ExternalLink className={styles.sourceExternal} aria-hidden="true" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
