---
description: Track implementation tasks with status, tickets, evidence, and traceability. Use when user wants to track task progress, create todos, update task status, view kanban board, sync from cascade, or link tickets.
argument-hint: '[--from IMPL-XX] [board|update [T{NN} --status pending|in-progress|complete|blocked|cancelled]] [--ticket ID] [--sync]'
allowed-tools: Read, Glob, Grep, Bash(node:*), Bash(git:*), Write, Edit
---

Manage TODO tracking **inline in this conversation**. Do NOT spawn a subagent.

Raw user request:
$ARGUMENTS

## Subcommands

- (no args) or `board` — render the current TODO file(s) as a Kanban board (pending / in-progress / complete / blocked / cancelled columns).
- `--from IMPL-XX` — create a new TODO YAML from the named IMPL plan. Use the schema at `plugins/ai/skills/todo-tracking/references/todo-schema.yaml`.
- `update T{NN} --status {status}` — update a single task's status. Valid transitions: `pending→in-progress→complete`, `pending→cancelled`, `any→blocked`.
- `update T{NN} --ticket {ID}` — link an external ticket ID to the task.
- `update` (no task id) — reconcile task states against recent source-file edits in the current cascade segment.
- `--sync` — auto-detect completed tasks from the cascade log and mark them complete with evidence.

## Rules

- TODO files are YAML at `.claude/project/todos/TODO-{NN}-{slug}.yaml`.
- Read, Write, Edit directly. No subagent.
- Every status change should include evidence (file:line) when available.
- Keep traceability fields (`source_impl`, `traces_to`) intact on every update.
- When generating from IMPL, copy each task's `acceptance_trace` (EAC/FAC/AAC refs) into the TODO entry.
