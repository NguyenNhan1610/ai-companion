---
description: Generate a traceability report linking decisions, plans, tasks, code, tests, and knowledge
argument-hint: '[--verify] [--query "natural language question"] <document-id or feature name>'
context: fork
allowed-tools: Read, Glob, Grep, Bash(node:*), Bash(git:*), Agent, AskUserQuestion
---

Route this request to the `ai:trace` subagent.

Raw user request:
$ARGUMENTS

The trace agent produces a traceability report by walking the entire document chain and cross-referencing evidence.

Usage:
- `/ai:trace FDR-03` — trace from FDR through IMPL, TODO, cascade, code, tests
- `/ai:trace ADR-05` — trace from ADR through all downstream documents
- `/ai:trace --verify FDR-03` — strict mode: flag every gap as a finding
- `/ai:trace --query "Is session caching fully implemented?"` — natural language query

Execution mode:
- Default to foreground.
- `--background` / `--wait` for execution mode control.

Operating rules:
- The trace agent spawns parallel sub-agents for fast evidence collection.
- Every file:line citation must be verified by reading the actual file.
- Gaps are flagged with severity: high (blocks ship), medium (should fix), low (nice to have).
- The `--verify` flag produces a ship/no-ship verdict.
- Saves report to `.claude/project/traces/TRACE-{NN}-{slug}.md`.
- Do NOT fix any gaps. Only report them.
