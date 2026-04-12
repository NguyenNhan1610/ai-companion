---
description: Analyze cascade change log and produce a structured implementation record with traceability. Use when user wants to document what was built, create a handoff record, or trace implementation to planning documents.
argument-hint: '[--since 1h|2h|today] [feature description or context]'
context: fork
allowed-tools: Read, Glob, Grep, Bash(node:*), Bash(git:*), Agent, AskUserQuestion
---

Route this request to the `ai:cascade` subagent.

Raw user request:
$ARGUMENTS

The cascade agent:
1. Reads `.claude/cascades/{branch}.md` for the raw change log with timestamps
2. Reads `git diff` + `git log` for actual code changes
3. Explores changed files to understand intent and trace to source documents
4. Groups changes by user prompt segments
5. Checks traceability to FDR/ADR/IMPL documents in `.claude/project/`
6. Writes structured record to `.claude/project/cascades/REC-{NN}-{slug}.md`

Execution mode:
- Default to foreground.
- `--background` / `--wait` for execution mode control.

Time filter:
- `--since 1h` — only changes from last hour
- `--since 2h` — last 2 hours
- `--since today` — today's changes
- No flag — all changes in current cascade

Operating rules:
- Every file:line citation must be verified by reading the actual file.
- Traceability to FDR/ADR/IMPL is required — scan `.claude/project/` for related documents.
- Task completion status must reference specific IMPL tasks by ID.
- Edge case and risk coverage must reference specific FDR items.
- Do NOT implement or fix anything. Only document what was done.
