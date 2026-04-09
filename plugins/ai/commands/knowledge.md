---
description: Extract, index, search, and suggest reusable knowledge from project documents
argument-hint: 'extract [--from DOC] | search <keywords> [--tag tag1,tag2] | suggest | list'
context: fork
allowed-tools: Read, Glob, Grep, Bash(node:*), Bash(git:*), Write, Edit, Agent, AskUserQuestion
---

Route this request to the `ai:knowledge` subagent.

Raw user request:
$ARGUMENTS

The knowledge agent manages a project knowledge base extracted from ADR/FDR/IMPL/cascade/debug documents.

Subcommands:
- `extract` — scan all project docs, extract new knowledge entries
- `extract --from FDR-03` — extract from a specific document
- `search <keywords>` — search by keywords across all entries
- `search --tag python,security` — search by tags
- `suggest` — suggest relevant knowledge for the current task/context
- `list` — list all knowledge entries with type, tags, confidence

Execution mode:
- Default to foreground.

Operating rules:
- Knowledge entries are YAML+markdown at `.claude/project/knowledge/{type}/`
- The agent can Read, Write, and Edit knowledge files directly.
- Every entry must have: id, title, type, tags, source references, confidence, trigger_patterns.
- Deduplicate: don't create entries that overlap significantly with existing ones.
- Update `index.yaml` after every extraction.
