"use client"

import React, { useEffect, useMemo, useState } from "react"
import { Check, Copy } from "lucide-react"
import { codeToHtml } from "shiki"
import { cn } from "@/lib/utils"

import {
  getLanguageDisplayName,
  parseLanguageAndFilename,
  resolveLanguage,
} from "./codeBlockLanguages"
import styles from "./code-block.module.css"

/* --------------------------------------------------------------------------
 * CodeBlock 组件群 - 参考“新增资料界面”中的卡片风格实现
 * -------------------------------------------------------------------------- */

export type CodeBlockProps = {
  children?: React.ReactNode
  className?: string
  /** 兼容直接传入 code 的单体用法 */
  code?: string
  language?: string
  filename?: string
  theme?: string
} & React.HTMLProps<HTMLDivElement>

export function CodeBlock({
  children,
  className,
  code,
  language,
  filename,
  theme = "github-light",
  ...props
}: CodeBlockProps) {
  // 如果直接传入 code，按完整卡片模式渲染（无缝兼容 MarkdownContent 与 MermaidBlock）
  if (code !== undefined) {
    const { language: parsedLang, filename: parsedFilename } = parseLanguageAndFilename(language, filename)
    const resolvedLang = resolveLanguage(parsedLang, code)
    const displayName = getLanguageDisplayName(resolvedLang)

    return (
      <div
        className={cn(styles.wrapper, className)}
        {...props}
      >
        <div className={styles.floatingToolbar} contentEditable={false}>
          {parsedFilename && (
            <span
              className={styles.filename}
              title={parsedFilename}
            >
              {parsedFilename}
            </span>
          )}
          <span className={styles.langLabel}>
            {displayName}
          </span>
          <CodeBlockCopyButton code={code} />
        </div>
        <CodeBlockCode code={code} language={resolvedLang} theme={theme} />
      </div>
    )
  }

  // 组合式容器用法
  return (
    <div
      className={cn(styles.wrapper, className)}
      {...props}
    >
      {children}
    </div>
  )
}

export type CodeBlockGroupProps = React.HTMLAttributes<HTMLDivElement>

export function CodeBlockGroup({
  children,
  className,
  ...props
}: CodeBlockGroupProps) {
  return (
    <div
      className={cn(styles.floatingToolbar, className)}
      {...props}
    >
      {children}
    </div>
  )
}

export type CodeBlockCodeProps = {
  code: string
  language?: string
  theme?: string
  className?: string
} & React.HTMLProps<HTMLDivElement>

export function CodeBlockCode({
  code,
  language = "tsx",
  theme = "github-light",
  className,
  ...props
}: CodeBlockCodeProps) {
  const [highlightedHtml, setHighlightedHtml] = useState<string | null>(null)

  const resolvedLang = useMemo(
    () => resolveLanguage(language, code),
    [language, code]
  )

  useEffect(() => {
    let cancelled = false

    async function highlight() {
      if (!code) {
        setHighlightedHtml("<pre><code></code></pre>")
        return
      }

      try {
        const html = await codeToHtml(code, {
          lang: resolvedLang,
          theme,
        })
        if (!cancelled) setHighlightedHtml(html)
      } catch {
        // 如果特定语言解析失败，优雅降级为 plaintext
        try {
          const fallbackHtml = await codeToHtml(code, {
            lang: "plaintext",
            theme,
          })
          if (!cancelled) setHighlightedHtml(fallbackHtml)
        } catch {
          // 最终兜底
          if (!cancelled) setHighlightedHtml(null)
        }
      }
    }

    void highlight()
    return () => {
      cancelled = true
    }
  }, [code, resolvedLang, theme])

  const classNames = cn(styles.codeArea, className)

  // SSR / 加载等待状态：呈现干净的原始代码段
  return highlightedHtml ? (
    <div
      className={classNames}
      dangerouslySetInnerHTML={{ __html: highlightedHtml }}
      {...props}
    />
  ) : (
    <div className={classNames} {...props}>
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  )
}

export function CodeBlockCopyButton({
  code,
  className,
}: {
  code: string
  className?: string
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      // ignore clipboard errors
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn(styles.copyBtn, className)}
      title={copied ? "已复制" : "复制代码"}
      aria-label={copied ? "代码已复制" : "复制代码"}
    >
      {copied ? <Check size={13} className={styles.copiedIcon} /> : <Copy size={13} />}
    </button>
  )
}

export default CodeBlock
