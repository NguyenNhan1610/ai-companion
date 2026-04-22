---
description: Extract, index, search, and suggest reusable knowledge from project documents
argument-hint: 'extract [--from DOC] | search <keywords> [--tag tag1,tag2] | suggest | list'
allowed-tools: Read, Glob, Grep, Bash(node:*), Bash(git:*), Write, Edit
---

Manage the project knowledge base **inline in this conversation**. Do NOT spawn a subagent.

Raw user request:
$ARGUMENTS

## Subcommands

- `extract` — scan `.project/{adr,fdr,implementation_plans,cascades,debug}/*.md` for new reusable knowledge; write entries under `.project/knowledge-entries/{type}/`.
- `extract --from FDR-03` — extract only from the named document.
- `search <keywords>` — grep across `.project/knowledge-entries/**/*.md` for matching entries.
- `search --tag python,security` — filter by tags.
- `suggest` — given the current working context (recent cascade segment + open files), surface the most relevant knowledge entries.
- `list` — print all knowledge entries with `id`, `title`, `type`, `tags`, `confidence`.

## Rules

- Knowledge entries are YAML-front-matter markdown at `.project/knowledge-entries/{type}/{id}.md`.
- Template: `plugins/ai/skills/knowledge-base/references/knowledge-entry-template.md`.
- Every entry needs: `id`, `title`, `type` (pattern|lesson|decision|antipattern), `tags`, `source` references, `confidence` (0-1), `trigger_patterns`.
- **Deduplicate**: do not create entries that overlap significantly with existing ones — search first.
- Update `.project/knowledge-entries/index.yaml` after every extraction.
- Use Read/Write/Edit directly; no subagent, no Agent tool.
