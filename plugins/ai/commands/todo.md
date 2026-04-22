---
description: Track implementation tasks with status, tickets, evidence, and traceability. Use when user wants to track task progress, create todos, update task status, view kanban board, sync from cascade, or link tickets.
argument-hint: '[--from IMPL-XX] [board|update [T{NN} --status pending|in-progress|complete|blocked|cancelled]] [--ticket ID] [--sync]'
context: fork
allowed-tools: Read, Glob, Grep, Bash(node:*), Bash(git:*), Write, Edit, Agent
---

Route this request to the `ai:todo` subagent.

Raw user request:
$ARGUMENTS

The todo agent manages structured task tracking with full traceability.

Subcommands:
- No args or `board` — show current TODO status as Kanban board
- `--from IMPL-XX` — generate TODO file from an IMPL plan
- `update` (no task id) — reconcile task state with recent source-file edits in the current cascade segment. Invoked automatically by the Stop / SubagentStop hook when the last turn modified tracked files; also callable directly by the user.
- `update T{NN} --status {status}` — update a single task's status
- `update T{NN} --ticket {ID}` — link external ticket
- `--sync` — auto-detect completed tasks from cascade log

Execution mode:
- Default to foreground.

Operating rules:
- TODO files are YAML at `.claude/project/todos/TODO-{NN}-{slug}.yaml`
- The agent can Read, Write, and Edit TODO files directly.
- Status transitions must be valid: pending→in-progress→complete, pending→cancelled, any→blocked.
- Every status change should include evidence (file:line) when available.
- Traceability to IMPL/FDR/ADR is maintained via references field.
