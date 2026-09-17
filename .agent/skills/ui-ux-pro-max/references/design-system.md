# Generate a design system

For a new or explicitly replaced visual system, use `--design-system` to obtain recommendations, then reconcile them with the brief and repository constraints:

```bash
python3 "$UI_SKILL_DIR/scripts/search.py" "<product_type> <industry> <keywords>" --design-system [-p "Project Name"]
```

This command:

1. Searches 5 domains in parallel (product, style, color, landing, typography)
2. Applies reasoning rules from `ui-reasoning.csv` to select best matches
3. Returns complete design system: pattern, style, colors, typography, effects
4. Includes anti-patterns to avoid

**Example:**
```bash
python3 "$UI_SKILL_DIR/scripts/search.py" "beauty spa wellness service" --design-system -p "Serenity Spa"
```

## Persist: Master + Overrides

For an authorized persistent design artifact, add `--persist`. Output is relative to the current working directory, or `--output-dir <path>` when supplied. The project slug is the project name lowercased with spaces replaced by hyphens. This command rewrites MASTER.md and the selected page file; inspect and preserve existing user content before using it:

```bash
python3 "$UI_SKILL_DIR/scripts/search.py" "<query>" --design-system --persist -p "Project Name"
```

This creates:

- `design-system/<project-slug>/MASTER.md` — Global Source of Truth with all design rules
- `design-system/<project-slug>/pages/` — Folder for page-specific overrides

**With page-specific override:**
```bash
python3 "$UI_SKILL_DIR/scripts/search.py" "<query>" --design-system --persist -p "Project Name" --page "dashboard"
```

This also creates:

- `design-system/<project-slug>/pages/dashboard.md` — Page-specific deviations from Master

**How hierarchical retrieval works:**

1. When building a specific page (e.g., "Checkout"), first check `design-system/<project-slug>/pages/checkout.md`
2. If the page file exists, its rules **override** the Master file
3. If not, use `design-system/<project-slug>/MASTER.md` exclusively

## Output Formats

The `--design-system` flag supports two output formats:

```bash
# ASCII box (default) - best for terminal display
python3 "$UI_SKILL_DIR/scripts/search.py" "fintech crypto" --design-system

# Markdown - best for documentation
python3 "$UI_SKILL_DIR/scripts/search.py" "fintech crypto" --design-system -f markdown
```

For a complete example, read [examples/design-system.md](../examples/design-system.md).
