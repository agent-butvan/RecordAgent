# Example: new skincare landing page

**User request:** "Làm landing page cho dịch vụ chăm sóc da chuyên nghiệp"

## Requirements

- Product type: Beauty/Spa service
- Style keywords: elegant, professional, soft
- Industry: Beauty/Wellness
- Stack: html-tailwind for this standalone example; use the existing stack in a repository

## Generate design recommendations

```bash
python3 "$UI_SKILL_DIR/scripts/search.py" "beauty spa wellness service elegant" --design-system -p "Serenity Spa"
```

**Output:** Complete design system with pattern, style, colors, typography, effects, and anti-patterns.

## Optional targeted searches

```bash
# Get UX guidelines for animation and accessibility
python3 "$UI_SKILL_DIR/scripts/search.py" "animation accessibility" --domain ux

# Get alternative typography options if needed
python3 "$UI_SKILL_DIR/scripts/search.py" "elegant luxury serif" --domain typography
```

## Stack guidelines

```bash
python3 "$UI_SKILL_DIR/scripts/search.py" "layout responsive form" --stack html-tailwind
```

**Then:** Synthesize design system + detailed searches and implement the design.
