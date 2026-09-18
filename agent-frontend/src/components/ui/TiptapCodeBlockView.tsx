import { useMemo, useState } from "react"
import { Check, Copy } from "lucide-react"
import { NodeViewWrapper, NodeViewContent, type NodeViewProps } from "@tiptap/react"
import {
  COMMON_CODE_LANGUAGES,
  getLanguageDisplayName,
  resolveLanguage,
} from "./codeBlockLanguages"
import styles from "./TiptapCodeBlockView.module.css"

export function TiptapCodeBlockView({ node, updateAttributes }: NodeViewProps) {
  const [copied, setCopied] = useState(false)
  const currentLang = (node.attrs.language as string) || ""
  const codeText = node.textContent

  const detectedLang = useMemo(
    () => resolveLanguage(currentLang, codeText),
    [currentLang, codeText]
  )
  const displayName = getLanguageDisplayName(detectedLang)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(codeText)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      // ignore clipboard error
    }
  }

  return (
    <NodeViewWrapper className={styles.wrapper}>
      <div className={styles.floatingToolbar} contentEditable={false}>
        <div className={styles.langSelectorWrapper}>
          <select
            tabIndex={-1}
            contentEditable={false}
            value={currentLang}
            onChange={(e) => updateAttributes({ language: e.target.value })}
            className={styles.select}
            title="切换代码语言"
          >
            {COMMON_CODE_LANGUAGES.map((lang) => (
              <option key={lang.value} value={lang.value}>
                {lang.value === ""
                  ? detectedLang && detectedLang !== "plaintext"
                    ? `${displayName} (自动)`
                    : "自动识别"
                  : lang.label}
              </option>
            ))}
          </select>
        </div>
        <button
          tabIndex={-1}
          contentEditable={false}
          type="button"
          onClick={handleCopy}
          className={styles.copyBtn}
          title={copied ? "已复制" : "复制代码"}
          aria-label={copied ? "代码已复制" : "复制代码"}
        >
          {copied ? <Check size={13} className={styles.copiedIcon} /> : <Copy size={13} />}
        </button>
      </div>
      <pre className={styles.codeArea}>
        <NodeViewContent<'code'> as="code" className={styles.code} />
      </pre>
    </NodeViewWrapper>
  )
}
