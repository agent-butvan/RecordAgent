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

/* --------------------------------------------------------------------------
 * CodeBlock 组件群
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
  // 如果直接传入 code，按完整卡片模式渲染（兼容现有 MarkdownContent 与 MermaidBlock）
  if (code !== undefined) {
    const { language: parsedLang, filename: parsedFilename } = parseLanguageAndFilename(language, filename)
    const resolvedLang = resolveLanguage(parsedLang, code)
    const displayName = getLanguageDisplayName(resolvedLang)

    return (
      <div
        className={cn(
          "not-prose my-3 flex w-full flex-col overflow-clip rounded-xl border border-[#e2e8f0] bg-white text-[#1f2937]",
          className
        )}
        {...props}
      >
        <CodeBlockGroup>
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-[#2563eb]/70" />
            <span className="text-xs font-semibold text-[#0f172a]">
              {displayName}
            </span>
            {parsedFilename && (
              <span
                className="max-w-[240px] truncate font-mono text-[12px] text-[#64748b]"
                title={parsedFilename}
              >
                {parsedFilename}
              </span>
            )}
          </div>
          <CodeBlockCopyButton code={code} />
        </CodeBlockGroup>
        <CodeBlockCode code={code} language={resolvedLang} theme={theme} />
      </div>
    )
  }

  // 组合式容器用法
  return (
    <div
      className={cn(
        "not-prose my-3 flex w-full flex-col overflow-clip rounded-xl border border-[#e2e8f0] bg-white text-[#1f2937]",
        className
      )}
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
      className={cn(
        "flex min-h-[40px] items-center justify-between border-b border-[#f1f5f9] bg-[#f8fafc]/80 px-3.5 py-1.5 text-xs text-[#64748b]",
        className
      )}
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

  const classNames = cn(
    "w-full overflow-x-auto font-mono text-[13px] leading-[1.65] text-[#1f2937] [&>pre]:m-0 [&>pre]:!bg-transparent [&>pre]:p-3.5 [&>pre]:font-mono [&>pre_code]:font-mono",
    className
  )

  // SSR / 加载等待状态：呈现干净的原始代码段
  return highlightedHtml ? (
    <div
      className={classNames}
      dangerouslySetInnerHTML={{ __html: highlightedHtml }}
      {...props}
    />
  ) : (
    <div className={classNames} {...props}>
      <pre className="m-0 p-3.5">
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
      className={cn(
        "inline-flex h-7 w-7 items-center justify-center rounded-md text-[#64748b] transition-colors duration-150 hover:bg-[#e2e8f0]/60 hover:text-[#0f172a] focus-visible:outline-2 focus-visible:outline-[#2563eb]",
        className
      )}
      title={copied ? "已复制" : "复制代码"}
      aria-label={copied ? "代码已复制" : "复制代码"}
    >
      {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
    </button>
  )
}

export default CodeBlock
