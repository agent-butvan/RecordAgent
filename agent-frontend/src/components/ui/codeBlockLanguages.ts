/* --------------------------------------------------------------------------
 * 语言别名与元数据标准化
 * -------------------------------------------------------------------------- */

export const LANGUAGE_ALIASES: Record<string, string> = {
  js: "javascript",
  javascript: "javascript",
  node: "javascript",
  jsx: "jsx",
  ts: "typescript",
  typescript: "typescript",
  tsx: "tsx",
  py: "python",
  python: "python",
  python3: "python",
  rb: "ruby",
  ruby: "ruby",
  rs: "rust",
  rust: "rust",
  sh: "bash",
  shell: "bash",
  bash: "bash",
  zsh: "bash",
  fish: "bash",
  yml: "yaml",
  yaml: "yaml",
  md: "markdown",
  markdown: "markdown",
  mdx: "mdx",
  golang: "go",
  go: "go",
  java: "java",
  c: "c",
  cpp: "cpp",
  "c++": "cpp",
  cs: "csharp",
  csharp: "csharp",
  "c#": "csharp",
  sql: "sql",
  json: "json",
  jsonc: "jsonc",
  json5: "json5",
  html: "html",
  xml: "xml",
  svg: "xml",
  css: "css",
  scss: "scss",
  less: "less",
  docker: "dockerfile",
  dockerfile: "dockerfile",
  makefile: "makefile",
  make: "makefile",
  toml: "toml",
  ini: "ini",
  graphql: "graphql",
  gql: "graphql",
  diff: "diff",
  patch: "diff",
  kotlin: "kotlin",
  kt: "kotlin",
  swift: "swift",
  php: "php",
  plaintext: "plaintext",
  text: "plaintext",
  txt: "plaintext",
  plain: "plaintext",
};

export const DISPLAY_NAMES: Record<string, string> = {
  typescript: "TypeScript",
  tsx: "TSX",
  javascript: "JavaScript",
  jsx: "JSX",
  python: "Python",
  bash: "Bash",
  rust: "Rust",
  go: "Go",
  java: "Java",
  c: "C",
  cpp: "C++",
  csharp: "C#",
  sql: "SQL",
  json: "JSON",
  yaml: "YAML",
  markdown: "Markdown",
  html: "HTML",
  xml: "XML",
  css: "CSS",
  scss: "SCSS",
  less: "Less",
  dockerfile: "Dockerfile",
  makefile: "Makefile",
  toml: "TOML",
  ini: "INI",
  graphql: "GraphQL",
  diff: "Diff",
  kotlin: "Kotlin",
  swift: "Swift",
  ruby: "Ruby",
  php: "PHP",
  plaintext: "Text",
};

/** 解析可能携带前缀或文件名的语言字符串，例如 `python:main.py` 或 `language-typescript` */
export function parseLanguageAndFilename(
  rawLang?: string,
  passedFilename?: string
): { language?: string; filename?: string } {
  if (!rawLang) return { language: undefined, filename: passedFilename };
  let lang = rawLang.trim();
  if (lang.startsWith("language-")) {
    lang = lang.slice(9);
  }
  let filename = passedFilename;
  if (lang.includes(":") && !passedFilename) {
    const [l, ...rest] = lang.split(":");
    lang = l;
    filename = rest.join(":");
  }
  if (lang.startsWith(".")) {
    lang = lang.slice(1);
  }
  return { language: lang, filename };
}

/** 智能推断未声明或纯文本代码的语言 */
export function detectLanguage(code: string): string {
  const trimmed = code.trim();
  if (!trimmed) return "plaintext";

  // JSON
  if (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  ) {
    try {
      JSON.parse(trimmed);
      return "json";
    } catch {
      // ignore
    }
  }

  // HTML / XML
  if (
    /^(<!DOCTYPE|<html|<div|<svg|<\?xml)/i.test(trimmed) ||
    (/<[a-z][\s\S]*>/i.test(trimmed) && /<\/[a-z]+>$/i.test(trimmed))
  ) {
    return "html";
  }

  // TypeScript / JSX / TSX / JavaScript
  if (
    /^(import\s+[\s\S]+?from\s+['"][^'"]+['"]|export\s+(default\s+)?(function|const|let|var|class|interface|type)|interface\s+\w+|type\s+\w+\s*=|const\s+\w+\s*[:=]|function\s+\w+\()/m.test(
      trimmed
    )
  ) {
    if (/<[A-Z]\w*(\s+[^>]*)?\/?>|<\/[A-Z]\w*>|<div|<span|<p\b/i.test(trimmed)) {
      return "tsx";
    }
    return "typescript";
  }

  // Shell script
  if (
    /^#!(\/usr)?\/bin\/(bash|sh|zsh)/.test(trimmed) ||
    /^(npm|pnpm|yarn|bun|git|curl|docker|cd|ls|cat|export\s+[A-Za-z_]\w*=|\.\/|sudo)\s+/m.test(trimmed)
  ) {
    return "bash";
  }

  // Python
  if (
    /^(import\s+[\w.]+|from\s+[\w.]+\s+import|def\s+\w+\(|class\s+\w+:|print\(|if __name__ == ['"]__main__['"]:)/m.test(
      trimmed
    )
  ) {
    return "python";
  }

  // SQL
  if (
    /^(SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM|CREATE\s+TABLE|ALTER\s+TABLE|DROP\s+TABLE)\s+/im.test(
      trimmed
    )
  ) {
    return "sql";
  }

  // Rust
  if (
    /^(fn\s+\w+\(|pub\s+fn|use\s+std::|struct\s+\w+\s*\{|impl\s+\w+|let\s+mut\s+)/m.test(
      trimmed
    )
  ) {
    return "rust";
  }

  // Go
  if (
    /^(package\s+\w+|func\s+\w+\(|import\s*\([\s\S]*\)|type\s+\w+\s+struct)/m.test(
      trimmed
    )
  ) {
    return "go";
  }

  // CSS
  if (
    /^[.#]?[\w-]+(?:\s*,\s*[.#]?[\w-]+)*\s*\{\s*[\w-]+\s*:\s*[^;]+;/m.test(
      trimmed
    )
  ) {
    return "css";
  }

  return "plaintext";
}

/** 标准化语言名称并提供自动推断 */
export function resolveLanguage(lang?: string, code = ""): string {
  if (!lang || lang.trim() === "" || lang.trim().toLowerCase() === "code") {
    return detectLanguage(code);
  }
  const clean = lang.trim().toLowerCase();
  return LANGUAGE_ALIASES[clean] || clean;
}

/** 语言友好展示名称 */
export function getLanguageDisplayName(lang: string): string {
  return DISPLAY_NAMES[lang] || lang.toUpperCase();
}
