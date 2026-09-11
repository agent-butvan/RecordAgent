---
name: ui-ux-pro-max
description: Search the bundled UI/UX database for styles, palettes, typography, charts, and stack guidance. Use when a design decision needs reference options or a new visual system needs recommendations.
---
# UI/UX design reference

Use the database to resolve design questions within the user's brief. Repository architecture, existing components, design conventions, and authorization boundaries govern implementation.

## Choose the relevant route

- **Local fix, review, or refinement:** inspect the affected component and existing visual system. Use [references/search.md](references/search.md) only for an unresolved question; generating a new design system is unnecessary.
- **New visual system or explicit redesign:** read [references/design-system.md](references/design-system.md). Extract the product, style, industry, and stack from the brief and code, then use recommendations within those constraints.
- **Quality work on UI:** read the affected sections of [references/quality.md](references/quality.md), including accessibility requirements. Follow repository verification policy.
- **Search cannot run because Python is missing:** read [references/setup.md](references/setup.md).
- **A complete generation example is needed:** read [examples/design-system.md](examples/design-system.md).

Load only the references needed for the current request. Reuse the project's actual stack; `html-tailwind` is a fallback only for a new standalone surface without one. Persistent design files are optional and must preserve existing user content.

## Run the bundled search

Resolve `UI_SKILL_DIR` to the absolute directory containing this SKILL.md; it contains [scripts/search.py](scripts/search.py). Reference commands use this variable and run with the target project as cwd. Use an available Python 3 interpreter.

```bash
python3 "$UI_SKILL_DIR/scripts/search.py" "<query>" --domain ux
```
