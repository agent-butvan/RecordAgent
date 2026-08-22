"use client"

import * as React from "react"

import {
  ModelSelector,
  ModelSelectorContent,
  ModelSelectorTrigger,
  ModelSelectorValue,
  type AiModelSelection,
} from "./ai-model-select"

// ONLY DEFAULT EXPORT WILL BE TREATED AS A DEMO
export default function DemoOne() {
  const [selection, setSelection] = React.useState<AiModelSelection>({
    id: "opus-4.5",
    effort: "high",
    context: "200K",
    fast: true,
    thinking: false,
  })

  const summary = [
    selection.id,
    selection.effort,
    selection.fast ? "fast" : null,
    selection.thinking ? "thinking" : null,
    selection.context,
  ]
    .filter(Boolean)
    .join(" · ")

  return (
    <div className="flex w-full max-w-lg flex-col items-center justify-center gap-6 px-2 py-10">
      <ModelSelector value={selection} onValueChange={setSelection}>
        <ModelSelectorTrigger className="bg-muted min-h-10 rounded-2xl border-2 border-border px-3 py-2">
          <ModelSelectorValue className="text-sm" />
        </ModelSelectorTrigger>
        <ModelSelectorContent side="bottom" />
      </ModelSelector>
      <p className="text-muted-foreground text-center text-xs tabular-nums">
        {summary}
      </p>
    </div>
  )
}
