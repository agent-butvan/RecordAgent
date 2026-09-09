# Phase boundaries

A **phase** is a chunk of work such as design, implementation, or QA. Its boundary is a convenient point to reconsider context needs, not a requirement to stop or reset. Respond to actual context pressure whenever it arises, using the host's available mechanisms rather than a fixed token threshold.

## Options

| Option | When it helps | What to preserve |
| --- | --- | --- |
| Continue | The next work benefits from the current context and there is room to proceed. | Relevant reasoning and the active objective. |
| Clear | The previous context is irrelevant to a separately scoped task, and the host supports clearing. | Any decisions needed later must already be recorded; do not discard unfinished work. |
| Handoff | Work moves to another harness, directory, colleague, or separately scoped task. | A portable summary with links to primary artifacts. |
| Subagent | An independent, bounded task benefits from delegation, and delegation is available and authorized. | The task scope and necessary evidence; return findings to the coordinating session. |
| Compact | Context pressure warrants a summary, or the host performs automatic compaction. | The objective, user decisions, constraints, completed work, open questions, and next steps. |

Choose by relevance, cost, and portability; these options are not an ordered checklist. A new ticket does not require a new session. Compaction does not complete or cancel the task: resume outstanding work from the preserved state.

## Primary evidence and summaries

Summaries can omit reasoning, so keep decisions and their rationale in durable artifacts and reference specs, issues, commits, and source files instead of duplicating them. When a later decision depends on detail the summary lacks, retrieve that detail from the relevant source. Preserve sensitive-data redaction in any handoff.
