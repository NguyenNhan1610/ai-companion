---
description: Show the dependency DAG of a todo-list with status, priority, effort, critical path, and ready set. ASCII by default.
argument-hint: '[TODO-NN] [--critical-path] [--ready] [--format ascii|mermaid|json]'
allowed-tools: Read, Glob, Bash(node:*)
---

Render the dependency DAG of a todo-list **inline in this conversation**. Do NOT spawn a subagent.

Raw slash-command arguments:
`$ARGUMENTS`

## Execution

Run and return the stdout verbatim:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/task-graph.mjs" $ARGUMENTS
```

## Usage

- `/ai:task-graph` — render the newest todo-list in `.claude/project/todo-lists/` as an ASCII tree.
- `/ai:task-graph TODO-03` — render a specific todo-list by id.
- `/ai:task-graph TODO-03 --critical-path` — print only the critical path, effort-weighted.
- `/ai:task-graph TODO-03 --ready` — print only the ready set (tasks with no unmet hard/data dependencies).
- `/ai:task-graph TODO-03 --format mermaid` — emit a fenced mermaid block for embedding in docs.
- `/ai:task-graph TODO-03 --format json` — machine-readable graph for downstream tooling.

## Output contract

Default ASCII output includes: doc id, title, ready set, critical path with effort points, parallel-track count, then a tree. Edge styles:

- `═══ [hard]` — downstream blocked until source is complete.
- `─── (soft)` — advisory ordering; downstream may proceed but tooling will warn.
- `═D═ [data]` — source produces an artifact the downstream consumes.

Nodes show as `task-NN [priority effort status] title`. Unreachable tasks (disconnected from any root) are listed separately.

## Rules

- Read-only. Never modify the todo-list.
- If validation errors exist, the script prints them to stderr and still renders the current DAG.
- Legacy todos in `.claude/project/todos/` are still readable during the transition, but new ones belong in `.claude/project/todo-lists/`.
