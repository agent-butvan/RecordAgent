"use client"

import * as React from "react"
import { CheckIcon, ChevronDownIcon, PencilIcon } from "lucide-react"
import {
  AnimatePresence,
  LayoutGroup,
  motion,
  type HTMLMotionProps,
} from "framer-motion"
import { createPortal } from "react-dom"
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/* =============================================================================
 * ModelSelector — Motoko UI
 *
 * Cursor-style AI model picker: label + muted Effort/Fast/Thinking, hover Edit,
 * and a side panel for Effort / Context / Fast / Thinking.
 *
 *   <ModelSelector value={sel} onValueChange={setSel} models={models}>
 *     <ModelSelectorTrigger>
 *       <ModelSelectorValue />
 *     </ModelSelectorTrigger>
 *     <ModelSelectorContent />
 *   </ModelSelector>
 *
 *   <ModelSelectorKit value={sel} onValueChange={setSel} />
 * ============================================================================= */

// ---------------------------------------------------------------------------
// Motion tokens
// ---------------------------------------------------------------------------

const EASE = [0.2, 0, 0, 1] as const
const SPRING_SOFT = { type: "spring" as const, stiffness: 420, damping: 32 }
const SPRING_PRESS = { type: "spring" as const, stiffness: 500, damping: 28 }
const SPRING_ICON = { type: "spring" as const, duration: 0.3, bounce: 0 }

const MENU_PANEL_CLASS = cn(
  "bg-popover text-popover-foreground overflow-hidden rounded-2xl border-2 border-border p-1.5",
  "shadow-[0_8px_30px_-8px_rgba(8,8,8,0.18),0_2px_8px_-2px_rgba(8,8,8,0.08)]",
  "dark:shadow-[0_8px_30px_-8px_rgba(0,0,0,0.45),0_2px_8px_-2px_rgba(0,0,0,0.3)]"
)

type PresenceProps = Pick<
  HTMLMotionProps<"span">,
  "initial" | "animate" | "exit" | "transition"
>

const FADE_ONLY: PresenceProps = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
}

const ICON_SWAP: PresenceProps = {
  initial: { opacity: 0, scale: 0.25, filter: "blur(4px)" },
  animate: { opacity: 1, scale: 1, filter: "blur(0px)" },
  exit: { opacity: 0, scale: 0.25, filter: "blur(4px)" },
  transition: SPRING_ICON,
}

function scaleBlurPresence(reduceMotion: boolean): PresenceProps {
  if (reduceMotion) return FADE_ONLY
  return {
    initial: { opacity: 0, scale: 0.9, filter: "blur(4px)" },
    animate: { opacity: 1, scale: 1, filter: "blur(0px)" },
    exit: { opacity: 0, scale: 0.9, filter: "blur(4px)" },
    transition: SPRING_ICON,
  }
}

function menuPresence(reduceMotion: boolean): PresenceProps {
  if (reduceMotion) return FADE_ONLY
  return {
    initial: { opacity: 0, y: 6, scale: 0.96, filter: "blur(4px)" },
    animate: { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" },
    exit: { opacity: 0, y: 4, scale: 0.98, filter: "blur(2px)" },
    transition: { duration: 0.2, ease: EASE },
  }
}

function flyoutPresence(reduceMotion: boolean): PresenceProps {
  if (reduceMotion) return FADE_ONLY
  return {
    initial: { opacity: 0, x: -6, scale: 0.98, filter: "blur(4px)" },
    animate: { opacity: 1, x: 0, scale: 1, filter: "blur(0px)" },
    exit: { opacity: 0, x: -4, scale: 0.98, filter: "blur(2px)" },
    transition: { duration: 0.18, ease: EASE },
  }
}

function valuePresence(reduceMotion: boolean): PresenceProps {
  return reduceMotion ? FADE_ONLY : ICON_SWAP
}

const listVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 4 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.2, ease: EASE },
  },
}

const itemVariantsReduced = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.15 } },
}

// ---------------------------------------------------------------------------
// Public types & defaults
// ---------------------------------------------------------------------------

export type AiModelEffort = "high" | "medium" | "low"

export type AiModel = {
  id: string
  /** Display name, e.g. "Opus 4.5" or "Cursor Grok 4.5". */
  label: string
  description?: string
  efforts?: AiModelEffort[]
  contexts?: Array<string | number>
  supportsFast?: boolean
  supportsThinking?: boolean
  defaultEffort?: AiModelEffort
  defaultContext?: string | number
  defaultFast?: boolean
  defaultThinking?: boolean
  disabled?: boolean
}

/** Full selection: model id + per-model runtime options. */
export type AiModelSelection = {
  id: string
  effort?: AiModelEffort
  context?: string
  fast?: boolean
  thinking?: boolean
}

export const DEFAULT_AI_MODELS: AiModel[] = [
  {
    id: "opus-4.5",
    label: "Opus 4.5",
    description: "Powerful reasoning for complex coding and agentic tasks.",
    efforts: ["high", "medium", "low"],
    contexts: ["200K", "1M"],
    supportsFast: true,
    supportsThinking: true,
    defaultEffort: "high",
    defaultContext: "200K",
    defaultFast: true,
  },
  {
    id: "cursor-grok-4.5",
    label: "Cursor Grok 4.5",
    description: "Fast, capable model tuned for coding workflows.",
    efforts: ["high", "medium", "low"],
    contexts: ["128K", "256K"],
    supportsFast: true,
    supportsThinking: true,
    defaultEffort: "high",
    defaultContext: "128K",
    defaultFast: true,
  },
  {
    id: "gpt-5",
    label: "GPT-5",
    description: "General-purpose reasoning with strong code generation.",
    efforts: ["high", "medium", "low"],
    contexts: ["128K", "400K"],
    supportsFast: true,
    supportsThinking: true,
    defaultEffort: "medium",
    defaultContext: "128K",
  },
  {
    id: "gemini-2.5",
    label: "Gemini 2.5",
    description: "Long-context model for large files and repositories.",
    efforts: ["high", "medium", "low"],
    contexts: ["1M"],
    supportsFast: true,
    supportsThinking: false,
    defaultEffort: "low",
    defaultContext: "1M",
    defaultFast: true,
  },
]

const EFFORT_LABEL: Record<AiModelEffort, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
}

export interface ModelSelectorProps {
  children: React.ReactNode
  models?: AiModel[]
  value?: AiModelSelection
  defaultValue?: AiModelSelection
  onValueChange?: (value: AiModelSelection) => void
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  disabled?: boolean
  className?: string
  "aria-label"?: string
}

export interface ModelSelectorTriggerProps extends Omit<
  HTMLMotionProps<"button">,
  "children"
> {
  children?: React.ReactNode
}

export type ModelSelectorValueProps = React.HTMLAttributes<HTMLSpanElement>

export interface ModelSelectorContentProps extends Omit<
  HTMLMotionProps<"div">,
  "children"
> {
  children?: React.ReactNode
  side?: "top" | "bottom"
}

export interface ModelSelectorKitProps {
  models?: AiModel[]
  value?: AiModelSelection
  defaultValue?: AiModelSelection
  onValueChange?: (value: AiModelSelection) => void
  disabled?: boolean
  className?: string
  "aria-label"?: string
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface ModelSelectorContextValue {
  open: boolean
  setOpen: (open: boolean) => void
  selection: AiModelSelection
  selectModel: (id: string) => void
  patchSelection: (patch: Partial<AiModelSelection>) => void
  models: AiModel[]
  selectedModel: AiModel | undefined
  disabled: boolean
  reduceMotion: boolean
  triggerRef: React.RefObject<HTMLButtonElement | null>
  contentRef: React.RefObject<HTMLDivElement | null>
  contentId: string
  layoutGroupId: string
  activeIndex: number
  setActiveIndex: (index: number) => void
  optionIds: string[]
  ariaLabel: string
  side: "top" | "bottom"
  setSide: (side: "top" | "bottom") => void
  editingId: string | null
  setEditingId: (id: string | null) => void
  previewId: string | null
  setPreviewId: (id: string | null) => void
  getConfigFor: (model: AiModel) => AiModelSelection
}

function optionDomId(contentId: string, modelId: string) {
  return `${contentId}-option-${modelId}`
}

function firstEnabledIndex(models: AiModel[], optionIds: string[]) {
  for (let i = 0; i < optionIds.length; i++) {
    const model = models.find((m) => m.id === optionIds[i])
    if (model && !model.disabled) return i
  }
  return 0
}

function lastEnabledIndex(models: AiModel[], optionIds: string[]) {
  for (let i = optionIds.length - 1; i >= 0; i--) {
    const model = models.find((m) => m.id === optionIds[i])
    if (model && !model.disabled) return i
  }
  return Math.max(0, optionIds.length - 1)
}

const ModelSelectorContext =
  React.createContext<ModelSelectorContextValue | null>(null)

function useModelSelectorContext(component: string): ModelSelectorContextValue {
  const ctx = React.useContext(ModelSelectorContext)
  if (!ctx) {
    throw new Error(`${component} must be used within <ModelSelector>`)
  }
  return ctx
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function assignRef<T>(
  node: T | null,
  ...refs: Array<React.Ref<T> | undefined>
) {
  for (const ref of refs) {
    if (typeof ref === "function") {
      ref(node)
    } else if (ref) {
      ;(ref as React.MutableRefObject<T | null>).current = node
    }
  }
}

function usePrefersReducedMotion() {
  const [reduceMotion, setReduceMotion] = React.useState(false)

  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    const sync = () => setReduceMotion(mq.matches)
    sync()
    mq.addEventListener("change", sync)
    return () => mq.removeEventListener("change", sync)
  }, [])

  return reduceMotion
}

function useControllableState<T>({
  value,
  defaultValue,
  onChange,
}: {
  value: T | undefined
  defaultValue: T
  onChange?: (value: T) => void
}): [T, (next: T | ((prev: T) => T)) => void] {
  const [uncontrolled, setUncontrolled] = React.useState(defaultValue)
  const isControlled = value !== undefined
  const current = isControlled ? value : uncontrolled

  const setValue = React.useCallback(
    (next: T | ((prev: T) => T)) => {
      const resolved =
        typeof next === "function" ? (next as (prev: T) => T)(current) : next
      if (!isControlled) setUncontrolled(resolved)
      onChange?.(resolved)
    },
    [isControlled, onChange, current]
  )

  return [current, setValue]
}

export function formatContext(
  context: string | number | undefined
): string | null {
  if (context === undefined || context === "") return null
  if (typeof context === "number") {
    if (context >= 1_000_000) return `${(context / 1_000_000).toFixed(0)}M`
    if (context >= 1_000) return `${Math.round(context / 1_000)}K`
    return String(context)
  }
  return String(context)
}

function defaultSelectionFor(model: AiModel): AiModelSelection {
  return {
    id: model.id,
    effort: model.defaultEffort ?? model.efforts?.[0],
    context:
      formatContext(model.defaultContext ?? model.contexts?.[0]) ?? undefined,
    fast: model.defaultFast ?? false,
    thinking: model.defaultThinking ?? false,
  }
}

function resolveSelection(
  models: AiModel[],
  value?: AiModelSelection
): AiModelSelection {
  const model = models.find((m) => m.id === value?.id) ?? models[0]
  if (!model) {
    return { id: value?.id ?? "" }
  }
  const base = defaultSelectionFor(model)
  if (!value || value.id !== model.id) return base
  return {
    id: model.id,
    effort: value.effort ?? base.effort,
    context: value.context ?? base.context,
    fast: value.fast ?? base.fast,
    thinking: value.thinking ?? base.thinking,
  }
}

/** Renders "Opus 4.5 High Fast" with muted modifiers. */
function ModelLabelParts({
  model,
  selection,
  className,
}: {
  model: AiModel | undefined
  selection: AiModelSelection
  className?: string
}) {
  if (!model) {
    return (
      <span className={cn("text-muted-foreground", className)}>Select model</span>
    )
  }

  const mods: string[] = []
  if (selection.effort) mods.push(EFFORT_LABEL[selection.effort])
  if (selection.fast) mods.push("Fast")
  if (selection.thinking) mods.push("Thinking")

  return (
    <span className={cn("flex min-w-0 items-baseline gap-1.5", className)}>
      <span className="text-foreground truncate font-medium">{model.label}</span>
      {mods.map((mod) => (
        <span
          key={mod}
          className="text-muted-foreground/70 shrink-0 font-medium tabular-nums"
        >
          {mod}
        </span>
      ))}
    </span>
  )
}

function MenuCheckmark({
  visible,
  reduceMotion,
  className,
}: {
  visible: boolean
  reduceMotion: boolean
  className?: string
}) {
  return (
    <AnimatePresence initial={false}>
      {visible ? (
        <motion.span
          key="check"
          {...scaleBlurPresence(reduceMotion)}
          className={cn("flex shrink-0", className)}
        >
          <CheckIcon className="size-3.5" aria-hidden />
        </motion.span>
      ) : null}
    </AnimatePresence>
  )
}

function OptionChip({
  selected,
  onClick,
  children,
  disabled,
  reduceMotion,
}: {
  selected: boolean
  onClick: () => void
  children: React.ReactNode
  disabled?: boolean
  reduceMotion: boolean
}) {
  return (
    <motion.button
      type="button"
      disabled={disabled}
      onClick={onClick}
      whileTap={disabled ? undefined : { scale: 0.96 }}
      transition={SPRING_PRESS}
      className={cn(
        "flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium",
        "transition-[background-color,color,box-shadow,opacity] duration-150 ease-[cubic-bezier(0.2,0,0,1)]",
        "focus-visible:ring-ring/50 focus-visible:ring-2 focus-visible:outline-none",
        selected
          ? "bg-muted text-foreground shadow-[inset_0_0_0_1px_rgba(123,123,123,0.16)]"
          : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
        disabled && "pointer-events-none opacity-40"
      )}
    >
      <span>{children}</span>
      <span className="flex size-3.5 shrink-0 items-center justify-center">
        <MenuCheckmark
          visible={selected}
          reduceMotion={reduceMotion}
          className="text-foreground"
        />
      </span>
    </motion.button>
  )
}

function ToggleChip({
  selected,
  onClick,
  children,
  reduceMotion,
}: {
  selected: boolean
  onClick: () => void
  children: React.ReactNode
  reduceMotion: boolean
}) {
  return (
    <motion.button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      whileTap={{ scale: 0.96 }}
      transition={SPRING_PRESS}
      className={cn(
        "flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium",
        "transition-[background-color,color,box-shadow,opacity] duration-150 ease-[cubic-bezier(0.2,0,0,1)]",
        "focus-visible:ring-ring/50 focus-visible:ring-2 focus-visible:outline-none",
        selected
          ? "bg-muted text-foreground shadow-[inset_0_0_0_1px_rgba(123,123,123,0.2)]"
          : "text-muted-foreground/70 hover:bg-muted/70 hover:text-muted-foreground"
      )}
    >
      <span>{children}</span>
      <span className="flex size-3.5 shrink-0 items-center justify-center">
        <MenuCheckmark
          visible={selected}
          reduceMotion={reduceMotion}
          className="text-foreground"
        />
      </span>
    </motion.button>
  )
}

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------

function ModelSelector({
  children,
  models = DEFAULT_AI_MODELS,
  value: valueProp,
  defaultValue,
  onValueChange,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  disabled = false,
  className,
  "aria-label": ariaLabel = "AI models",
}: ModelSelectorProps) {
  const reduceMotion = usePrefersReducedMotion()
  const layoutGroupId = React.useId()
  const contentId = React.useId()
  const triggerRef = React.useRef<HTMLButtonElement | null>(null)
  const contentRef = React.useRef<HTMLDivElement | null>(null)

  const initial =
    defaultValue ?? (models[0] ? defaultSelectionFor(models[0]) : { id: "" })

  const [selection, setSelection] = useControllableState({
    value: valueProp,
    defaultValue: initial,
    onChange: onValueChange,
  })

  const [open, setOpenState] = useControllableState({
    value: openProp,
    defaultValue: defaultOpen,
    onChange: onOpenChange,
  })

  const [activeIndex, setActiveIndex] = React.useState(0)
  const [side, setSide] = React.useState<"top" | "bottom">("top")
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [previewId, setPreviewId] = React.useState<string | null>(null)

  const optionIds = React.useMemo(() => models.map((m) => m.id), [models])

  // Cache last config per model so switching models restores options
  const configCacheRef = React.useRef<Record<string, AiModelSelection>>({})

  // Always expose a fully-resolved selection (fills effort/context/fast defaults)
  const resolved = resolveSelection(models, selection)

  React.useEffect(() => {
    if (resolved.id) configCacheRef.current[resolved.id] = resolved
  }, [resolved])

  const selectedModel = models.find((m) => m.id === resolved.id) ?? models[0]

  const getConfigFor = React.useCallback(
    (model: AiModel): AiModelSelection => {
      if (resolved.id === model.id) return resolved
      return configCacheRef.current[model.id] ?? defaultSelectionFor(model)
    },
    [resolved]
  )

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (disabled && next) return
      setOpenState(next)
      if (!next) {
        setEditingId(null)
        setPreviewId(null)
      }
    },
    [disabled, setOpenState]
  )

  const selectModel = React.useCallback(
    (id: string) => {
      const model = models.find((m) => m.id === id)
      if (!model || model.disabled) return
      const next = resolveSelection(models, { ...getConfigFor(model), id })
      setSelection(next)
      setEditingId(null)
      setOpen(false)
      triggerRef.current?.focus()
    },
    [models, getConfigFor, setSelection, setOpen]
  )

  const patchSelection = React.useCallback(
    (patch: Partial<AiModelSelection>) => {
      setSelection((prev) => {
        const id = patch.id ?? prev.id
        const model = models.find((m) => m.id === id)
        const base = model
          ? id === prev.id
            ? resolveSelection(models, prev)
            : (configCacheRef.current[id] ?? defaultSelectionFor(model))
          : prev
        const next = resolveSelection(models, { ...base, ...patch, id })
        configCacheRef.current[id] = next
        return next
      })
    },
    [models, setSelection]
  )

  React.useEffect(() => {
    if (!open) return
    const idx = optionIds.indexOf(resolved.id)
    setActiveIndex(idx >= 0 ? idx : firstEnabledIndex(models, optionIds))
  }, [open, optionIds, resolved.id, models])

  React.useEffect(() => {
    if (!open) return

    const onPointer = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null
      if (!target) return
      const inTrigger = triggerRef.current?.contains(target)
      const inContent = contentRef.current?.contains(target)
      if (!inTrigger && !inContent) setOpen(false)
    }

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        if (editingId) {
          setEditingId(null)
          return
        }
        setOpen(false)
        triggerRef.current?.focus()
        return
      }

      if (editingId || optionIds.length === 0) return

      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault()
        const delta = event.key === "ArrowDown" ? 1 : -1
        setActiveIndex((prev) => {
          let next = prev
          for (let i = 0; i < optionIds.length; i++) {
            next = (next + delta + optionIds.length) % optionIds.length
            const model = models.find((m) => m.id === optionIds[next])
            if (!model?.disabled) break
          }
          return next
        })
        return
      }

      if (event.key === "Enter" || event.key === " ") {
        const target = event.target as HTMLElement | null
        if (target?.closest("[data-slot='model-selector-item']")) return
        if (target?.closest("[data-slot='model-selector-edit']")) return
        event.preventDefault()
        const id = optionIds[activeIndex]
        if (id) selectModel(id)
        return
      }

      if (event.key === "Home") {
        event.preventDefault()
        setActiveIndex(firstEnabledIndex(models, optionIds))
        return
      }
      if (event.key === "End") {
        event.preventDefault()
        setActiveIndex(lastEnabledIndex(models, optionIds))
      }
    }

    document.addEventListener("mousedown", onPointer)
    document.addEventListener("touchstart", onPointer)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onPointer)
      document.removeEventListener("touchstart", onPointer)
      document.removeEventListener("keydown", onKey)
    }
  }, [open, setOpen, optionIds, activeIndex, models, selectModel, editingId])

  React.useEffect(() => {
    if (disabled) setOpen(false)
  }, [disabled, setOpen])

  return (
    <ModelSelectorContext.Provider
      value={{
        open,
        setOpen,
        selection: resolved,
        selectModel,
        patchSelection,
        models,
        selectedModel,
        disabled,
        reduceMotion,
        triggerRef,
        contentRef,
        contentId,
        layoutGroupId,
        activeIndex,
        setActiveIndex,
        optionIds,
        ariaLabel,
        side,
        setSide,
        editingId,
        setEditingId,
        previewId,
        setPreviewId,
        getConfigFor,
      }}
    >
      <div
        data-slot="model-selector"
        data-state={open ? "open" : "closed"}
        className={cn("relative inline-flex", className)}
      >
        {children}
      </div>
    </ModelSelectorContext.Provider>
  )
}

ModelSelector.displayName = "ModelSelector"

// ---------------------------------------------------------------------------
// Trigger
// ---------------------------------------------------------------------------

const ModelSelectorTrigger = React.forwardRef<
  HTMLButtonElement,
  ModelSelectorTriggerProps
>(({ className, children, disabled, onClick, ...props }, ref) => {
  const {
    open,
    setOpen,
    triggerRef,
    contentId,
    disabled: rootDisabled,
    selectedModel,
    selection,
  } = useModelSelectorContext("ModelSelectorTrigger")

  const isDisabled = disabled || rootDisabled
  const label = selectedModel
    ? [
        selectedModel.label,
        selection.effort ? EFFORT_LABEL[selection.effort] : null,
        selection.fast ? "Fast" : null,
        selection.thinking ? "Thinking" : null,
      ]
        .filter(Boolean)
        .join(" ")
    : "Select model"

  return (
    <motion.button
      ref={(node) => assignRef(node, ref, triggerRef)}
      type="button"
      disabled={isDisabled}
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-controls={contentId}
      aria-label={`Model: ${label}`}
      data-slot="model-selector-trigger"
      data-state={open ? "open" : "closed"}
      onClick={(event) => {
        onClick?.(event)
        if (event.defaultPrevented || isDisabled) return
        setOpen(!open)
      }}
      whileHover={isDisabled ? undefined : { scale: 1.02, y: -1 }}
      whileTap={isDisabled ? undefined : { scale: 0.96 }}
      transition={SPRING_PRESS}
      className={cn(
        "text-muted-foreground flex min-h-9 cursor-pointer items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs font-medium",
        "transition-[background-color,color,box-shadow,opacity] duration-200 ease-[cubic-bezier(0.2,0,0,1)]",
        "hover:bg-muted hover:text-foreground",
        "focus-visible:ring-ring/50 focus-visible:ring-2 focus-visible:outline-none",
        "disabled:pointer-events-none disabled:opacity-40",
        open && "bg-muted text-foreground",
        className
      )}
      {...props}
    >
      {children ?? <ModelSelectorValue />}
      <motion.span
        animate={{ rotate: open ? 180 : 0 }}
        transition={{ duration: 0.2, ease: EASE }}
        className="flex shrink-0"
      >
        <ChevronDownIcon className="size-3.5 opacity-60" aria-hidden />
      </motion.span>
    </motion.button>
  )
})
ModelSelectorTrigger.displayName = "ModelSelectorTrigger"

// ---------------------------------------------------------------------------
// Value
// ---------------------------------------------------------------------------

function ModelSelectorValue({ className, ...props }: ModelSelectorValueProps) {
  const { selectedModel, selection, reduceMotion } =
    useModelSelectorContext("ModelSelectorValue")

  return (
    <span
      data-slot="model-selector-value"
      className={cn("relative flex min-w-0 items-center", className)}
      {...props}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={`${selection.id}-${selection.effort}-${selection.fast}-${selection.thinking}`}
          {...valuePresence(reduceMotion)}
          className="flex min-w-0"
        >
          <ModelLabelParts
            model={selectedModel}
            selection={selection}
            className="text-sm"
          />
        </motion.span>
      </AnimatePresence>
    </span>
  )
}
ModelSelectorValue.displayName = "ModelSelectorValue"

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

const ModelSelectorContent = React.forwardRef<
  HTMLDivElement,
  ModelSelectorContentProps
>(({ className, children, side: sideProp = "top", style, ...props }, ref) => {
  const {
    open,
    contentId,
    triggerRef,
    contentRef,
    reduceMotion,
    ariaLabel,
    setSide,
    editingId,
    previewId,
    models,
    activeIndex,
    optionIds,
  } = useModelSelectorContext("ModelSelectorContent")

  const [mounted, setMounted] = React.useState(false)
  const [coords, setCoords] = React.useState<{
    top: number
    left: number
  } | null>(null)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  React.useEffect(() => {
    setSide(sideProp)
  }, [sideProp, setSide])

  React.useLayoutEffect(() => {
    if (!open) return

    const update = () => {
      const trigger = triggerRef.current
      if (!trigger) return
      const rect = trigger.getBoundingClientRect()
      if (sideProp === "bottom") {
        setCoords({
          top: rect.bottom + 8,
          left: rect.left,
        })
      } else {
        setCoords({
          top: rect.top - 8,
          left: rect.left,
        })
      }
    }

    update()
    window.addEventListener("resize", update)
    window.addEventListener("scroll", update, true)
    return () => {
      window.removeEventListener("resize", update)
      window.removeEventListener("scroll", update, true)
    }
  }, [open, triggerRef, sideProp])

  if (!mounted) return null

  const list = children ?? <ModelSelectorDefaultItems />
  const editingModel = models.find((m) => m.id === editingId)
  const previewModel = models.find((m) => m.id === previewId)
  const panelModel = editingModel ?? previewModel
  const activeModelId = optionIds[activeIndex]
  const activeOptionId = activeModelId
    ? optionDomId(contentId, activeModelId)
    : undefined

  return createPortal(
    <AnimatePresence>
      {open && coords ? (
        <motion.div
          key={contentId}
          ref={(node) => assignRef(node, ref, contentRef)}
          data-slot="model-selector-content"
          data-editing={editingId ? "" : undefined}
          {...menuPresence(reduceMotion)}
          style={{
            position: "fixed",
            top: coords.top,
            left: coords.left,
            transform: sideProp === "top" ? "translateY(-100%)" : undefined,
            zIndex: 50,
            ...style,
          }}
          className={cn("flex origin-top-left items-start gap-3", className)}
          {...props}
        >
          <div
            id={contentId}
            role="listbox"
            aria-label={ariaLabel}
            aria-activedescendant={activeOptionId}
            data-slot="model-selector-listbox"
            className="min-w-0"
          >
            {list}
          </div>

          <AnimatePresence initial={false}>
            {panelModel ? (
              <ModelSidePanel
                key="model-side-panel"
                model={panelModel}
                editing={!!editingModel}
              />
            ) : null}
          </AnimatePresence>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  )
})
ModelSelectorContent.displayName = "ModelSelectorContent"

// ---------------------------------------------------------------------------
// Default list
// ---------------------------------------------------------------------------

function ModelSelectorDefaultItems() {
  const { models, layoutGroupId, reduceMotion, editingId, setPreviewId } =
    useModelSelectorContext("ModelSelectorDefaultItems")

  return (
    <LayoutGroup id={layoutGroupId}>
      <motion.ul
        role="presentation"
        variants={listVariants}
        initial={reduceMotion ? false : "hidden"}
        animate="show"
        className={cn(MENU_PANEL_CLASS, "flex min-w-64 flex-col gap-0.5")}
        onMouseLeave={() => {
          if (!editingId) setPreviewId(null)
        }}
      >
        {models.map((model) => (
          <li key={model.id} role="none">
            <ModelSelectorItem model={model} />
          </li>
        ))}
      </motion.ul>
    </LayoutGroup>
  )
}

// ---------------------------------------------------------------------------
// Stable side panel shell
// ---------------------------------------------------------------------------

function ModelSidePanel({
  model,
  editing,
}: {
  model: AiModel
  editing: boolean
}) {
  const { reduceMotion } = useModelSelectorContext("ModelSidePanel")

  return (
    <motion.aside
      data-slot="model-selector-side-panel"
      aria-label={
        editing ? `${model.label} settings` : `${model.label} details`
      }
      {...flyoutPresence(reduceMotion)}
      className={cn(MENU_PANEL_CLASS, "flex w-56 shrink-0 flex-col gap-3 p-3")}
    >
      {editing ? (
        <ModelEditPanelContent model={model} />
      ) : (
        <ModelInfoPanelContent model={model} />
      )}
    </motion.aside>
  )
}

// ---------------------------------------------------------------------------
// Hover info side panel
// ---------------------------------------------------------------------------

function ModelInfoPanelContent({ model }: { model: AiModel }) {
  const contexts = model.contexts
    ?.map((context) => formatContext(context))
    .filter(Boolean)
    .join(" · ")

  return (
    <>
      <div className="text-foreground text-sm font-semibold">{model.label}</div>
      {model.description ? (
        <p className="text-muted-foreground text-xs leading-relaxed text-pretty">
          {model.description}
        </p>
      ) : null}
      {contexts ? (
        <div className="mt-1 flex flex-col gap-1">
          <span className="text-muted-foreground/70 text-[10px] font-semibold tracking-wide uppercase">
            Context
          </span>
          <span className="text-muted-foreground text-xs font-medium tabular-nums">
            {contexts}
          </span>
        </div>
      ) : null}
    </>
  )
}

// ---------------------------------------------------------------------------
// Edit side panel
// ---------------------------------------------------------------------------

function ModelEditPanelContent({ model }: { model: AiModel }) {
  const { getConfigFor, patchSelection, reduceMotion } =
    useModelSelectorContext("ModelEditPanelContent")

  const config = getConfigFor(model)
  const efforts = model.efforts ?? []
  const contexts = model.contexts ?? []

  return (
    <>
      {efforts.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <div className="text-muted-foreground/70 px-0.5 text-[10px] font-semibold tracking-wide uppercase">
            Effort
          </div>
          <div className="flex flex-col gap-0.5">
            {efforts.map((effort) => (
              <OptionChip
                key={effort}
                selected={config.effort === effort}
                reduceMotion={reduceMotion}
                onClick={() => patchSelection({ id: model.id, effort })}
              >
                {EFFORT_LABEL[effort]}
              </OptionChip>
            ))}
          </div>
        </div>
      ) : null}

      {contexts.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <div className="text-muted-foreground/70 px-0.5 text-[10px] font-semibold tracking-wide uppercase">
            Context
          </div>
          <div className="flex flex-col gap-0.5">
            {contexts.map((ctx) => {
              const label = formatContext(ctx) ?? String(ctx)
              return (
                <OptionChip
                  key={label}
                  selected={config.context === label}
                  reduceMotion={reduceMotion}
                  onClick={() =>
                    patchSelection({ id: model.id, context: label })
                  }
                >
                  <span className="tabular-nums">{label}</span>
                </OptionChip>
              )
            })}
          </div>
        </div>
      ) : null}

      {(model.supportsFast || model.supportsThinking) && (
        <div className="flex flex-col gap-1.5">
          <div className="text-muted-foreground/70 px-0.5 text-[10px] font-semibold tracking-wide uppercase">
            Modes
          </div>
          <div className="flex flex-col gap-0.5">
            {model.supportsFast ? (
              <ToggleChip
                selected={!!config.fast}
                reduceMotion={reduceMotion}
                onClick={() =>
                  patchSelection({ id: model.id, fast: !config.fast })
                }
              >
                Fast
              </ToggleChip>
            ) : null}
            {model.supportsThinking ? (
              <ToggleChip
                selected={!!config.thinking}
                reduceMotion={reduceMotion}
                onClick={() =>
                  patchSelection({
                    id: model.id,
                    thinking: !config.thinking,
                  })
                }
              >
                Thinking
              </ToggleChip>
            ) : null}
          </div>
        </div>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Item
// ---------------------------------------------------------------------------

function ModelSelectorItem({ model }: { model: AiModel }) {
  const {
    selection,
    selectModel,
    reduceMotion,
    layoutGroupId,
    contentId,
    activeIndex,
    setActiveIndex,
    optionIds,
    editingId,
    setEditingId,
    setPreviewId,
    getConfigFor,
    patchSelection,
  } = useModelSelectorContext("ModelSelectorItem")

  const isActive = model.id === selection.id
  const isEditing = editingId === model.id
  const optionIndex = optionIds.indexOf(model.id)
  const isHighlighted = optionIndex === activeIndex && optionIndex >= 0
  const isDisabled = !!model.disabled
  const config = getConfigFor(model)
  const optionId = optionDomId(contentId, model.id)

  const optionRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    if (isHighlighted) {
      optionRef.current?.scrollIntoView({ block: "nearest" })
    }
  }, [isHighlighted])

  return (
    <motion.div
      variants={reduceMotion ? itemVariantsReduced : itemVariants}
      className={cn(
        "group/item relative flex w-full items-center gap-1 rounded-xl",
        "transition-colors duration-150 ease-[cubic-bezier(0.2,0,0,1)]",
        isActive ? "text-foreground" : "text-muted-foreground",
        isHighlighted && !isActive && "bg-muted/50",
        isEditing && "bg-muted/80",
        isDisabled && "pointer-events-none opacity-40"
      )}
      onMouseEnter={() => {
        if (!isDisabled && optionIndex >= 0) {
          setActiveIndex(optionIndex)
          if (!editingId) setPreviewId(model.id)
        }
      }}
    >
      {isActive ? (
        <motion.span
          layoutId={`${layoutGroupId}-active`}
          className="bg-muted absolute inset-0 rounded-xl"
          transition={SPRING_SOFT}
        />
      ) : null}

      {/* Option has no nested buttons — Edit is a sibling for valid listbox a11y. */}
      <div
        ref={optionRef}
        id={optionId}
        role="option"
        aria-selected={isActive}
        aria-disabled={isDisabled || undefined}
        data-slot="model-selector-item"
        data-highlighted={isHighlighted ? "" : undefined}
        data-active={isActive ? "" : undefined}
        data-editing={isEditing ? "" : undefined}
        onClick={() => {
          if (!isDisabled) selectModel(model.id)
        }}
        className={cn(
          "relative z-10 flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-xl px-2.5 py-2 text-left",
          "transition-transform duration-150 ease-[cubic-bezier(0.2,0,0,1)]",
          !isDisabled && "active:scale-[0.98]"
        )}
      >
        <span className="min-w-0 flex-1">
          <ModelLabelParts
            model={model}
            selection={config}
            className="text-sm"
          />
        </span>
        {isActive ? (
          <MenuCheckmark
            visible
            reduceMotion={reduceMotion}
            className="text-foreground"
          />
        ) : (
          <span className="size-3.5 shrink-0" aria-hidden />
        )}
      </div>

      <motion.button
        type="button"
        data-slot="model-selector-edit"
        aria-label={`Edit ${model.label} settings`}
        aria-expanded={isEditing}
        disabled={isDisabled}
        onClick={(event) => {
          event.stopPropagation()
          if (isEditing) {
            setEditingId(null)
            return
          }
          // Opening edit selects this model’s config into the active selection
          // so the panel edits the live value, without closing the list.
          patchSelection({ ...config, id: model.id })
          setEditingId(model.id)
        }}
        whileTap={isDisabled ? undefined : { scale: 0.96 }}
        transition={SPRING_PRESS}
        className={cn(
          "relative z-10 mr-1 flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-lg",
          "text-muted-foreground/70 opacity-0 transition-[opacity,background-color,color] duration-150 ease-[cubic-bezier(0.2,0,0,1)]",
          "hover:bg-accent hover:text-foreground",
          "focus-visible:ring-ring/50 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:outline-none",
          "group-hover/item:opacity-100",
          (isEditing || isHighlighted) && "opacity-100",
          isEditing && "bg-accent text-foreground"
        )}
      >
        <PencilIcon className="size-3.5" aria-hidden />
      </motion.button>
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// Kit
// ---------------------------------------------------------------------------

function ModelSelectorKit({
  models = DEFAULT_AI_MODELS,
  value,
  defaultValue,
  onValueChange,
  disabled,
  className,
  "aria-label": ariaLabel,
}: ModelSelectorKitProps) {
  return (
    <ModelSelector
      models={models}
      value={value}
      defaultValue={defaultValue}
      onValueChange={onValueChange}
      disabled={disabled}
      className={className}
      aria-label={ariaLabel}
    >
      <ModelSelectorTrigger>
        <ModelSelectorValue />
      </ModelSelectorTrigger>
      <ModelSelectorContent />
    </ModelSelector>
  )
}
ModelSelectorKit.displayName = "ModelSelectorKit"

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export {
  ModelSelector,
  ModelSelectorTrigger,
  ModelSelectorValue,
  ModelSelectorContent,
  ModelSelectorKit,
  defaultSelectionFor,
}

export default ModelSelectorKit
