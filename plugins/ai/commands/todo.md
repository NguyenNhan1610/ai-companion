---
description: Manage a todo-list with DAG-first structure, priorities, confidence, and effort. Use to create, update, or view a todo-list.
argument-hint: '[--from IMPL-XX] [board|update [task-NN --status <status>]] [--ticket ID] [--sync]'
context: fork
allowed-tools: Read, Glob, Grep, Bash(node:*), Bash(git:*), Write, Edit, Agent
---

Route this request to the `todo` subagent.

Raw user request:
$ARGUMENTS

## Subcommands

- No args or `board` — render the todo-list as a kanban board (status columns).
- `--from IMPL-03` — generate a new todo-list from an implementation-plan. Tasks inherit EAC acceptance traces from the IMPL plan; dependency edges come from the IMPL DAG.
- `update task-NN --status <status>` — set a task's status. Valid values: `pending` | `ready` | `in-progress` | `blocked` | `in-review` | `complete` | `cancelled`.
- `update task-NN --ticket <ID>` — link an external ticket.
- `update task-NN --evidence file:line` — append evidence to a task.
- `update` (no id) — reconcile task states against recent source-file edits in the current cascade segment. Also callable from the Stop/SubagentStop hook.
- `--sync` — auto-detect completed tasks from the cascade log and flip their status.

## File format

- Path: `.project/todo-lists/TODO-{NN}-{slug}.yaml`
- Schema: DAG-first (header → `dependencies:` → `computed:` → `tasks:`). See `plugins/ai/skills/todo-tracking/references/todo-schema.yaml`.
- Task fields: `id` (kebab `task-NN`), `title`, `status`, `priority` (P0-P3), `confidence` (0..1), `effort` (XS/S/M/L/XL), `acceptance_trace` (list of EAC/FAC/AAC ids), `evidence` (list of `{file, line?, kind}`), `ticket`, `assigned_to`, `notes`.
- Dependencies: explicit `dependencies:` list with `from`, `to`, `kind` (`hard` | `soft` | `data`), `reason`.
- Upstream/downstream: full relative paths from the repo root, enforced by `planning-docs.mjs`.

## Operating rules

- After every write, call `node "${CLAUDE_PLUGIN_ROOT}/scripts/lib/planning-docs.mjs"` via a small validation script to confirm the DAG is cycle-free and all fields parse.
- Regenerate the `computed:` block (roots, ready, critical path, parallel tracks) on every write — never hand-edit it.
- Status propagation: a task whose hard/data predecessors are all `complete` can move `pending → ready` automatically.
- For rendering the DAG, direct the user to `/ai:task-graph` instead of embedding large ASCII trees in the kanban response.
- Do NOT rewrite upstream planning documents; only reference them by path.
