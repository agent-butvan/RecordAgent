import { useMemo, useState } from "react"
import { Check, Copy } from "lucide-react"
import { NodeViewWrapper, NodeViewContent, type NodeViewProps } from "@tiptap/react"
import {
  getLanguageDisplayName,
  resolveLanguage,
} from "./codeBlockLanguages"
import styles from "./TiptapCodeBlockView.module.css"

const COMMON_LANGUAGES = [
  { value: "", label: "自动识别" },
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "tsx", label: "TSX / React" },
  { value: "python", label: "Python" },
  { value: "java", label: "Java" },
  { value: "c", label: "C" },
  { value: "cpp", label: "C++" },
  { value: "csharp", label: "C#" },
  { value: "go", label: "Go" },
  { value: "rust", label: "Rust" },
  { value: "bash", label: "Bash / Shell" },
  { value: "sql", label: "SQL" },
  { value: "json", label: "JSON" },
  { value: "yaml", label: "YAML" },
  { value: "html", label: "HTML" },
  { value: "css", label: "CSS" },
  { value: "markdown", label: "Markdown" },
  { value: "dockerfile", label: "Dockerfile" },
]

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
      <div className={styles.header}>
        <div className={styles.left}>
          <span className={styles.dot} />
          <select
            contentEditable={false}
            value={currentLang}
            onChange={(e) => updateAttributes({ language: e.target.value })}
            className={styles.select}
            title="切换代码语言"
          >
            {COMMON_LANGUAGES.map((lang) => (
              <option key={lang.value} value={lang.value}>
                {lang.value === "" ? `自动识别 (${displayName})` : lang.label}
              </option>
            ))}
          </select>
        </div>
        <button
          contentEditable={false}
          type="button"
          onClick={handleCopy}
          className={styles.copyBtn}
          title={copied ? "已复制" : "复制代码"}
          aria-label={copied ? "代码已复制" : "复制代码"}
        >
          {copied ? <Check size={14} className={styles.copiedIcon} /> : <Copy size={14} />}
        </button>
      </div>
      <NodeViewContent<'pre'> as="pre" className={styles.codeArea} />
    </NodeViewWrapper>
  )
}
