---
description: Generate a DAG-based implementation plan from an FDR or ADR document
argument-hint: '--from <path-to-fdr-or-adr> [--method pragmatic|tdd|agile|kanban|shape-up]'
context: fork
allowed-tools: Read, Glob, Grep, Bash(node:*), Bash(git:*), Agent, AskUserQuestion
---

Route this request to the `ai:implement` subagent.

Raw user request:
$ARGUMENTS

The implement agent:
1. Reads the source FDR or ADR document
2. Extracts implementation plan, edge cases, risks, affected files, testing strategy
3. Builds a DAG (Directed Acyclic Graph) of implementation tasks with dependencies
4. Generates a structured checklist with parallel tracks and critical path
5. Embeds the DAG as a validated fenced ```mermaid``` block in the IMPL markdown (no .svg file is written)
6. Saves to `.claude/project/implementation_plans/IMPL-{NN}-{slug}.md`

Execution mode:
- Default to foreground.
- `--background` / `--wait` for execution mode control.

Method:
- `--method pragmatic` (default) — hybrid: tests first for critical paths, incremental delivery, feature flags
- `--method tdd` — strict test-driven: every task starts with a failing test
- `--method agile` — sprint-sized user stories with acceptance criteria
- `--method kanban` — flat prioritized tasks with WIP limits
- `--method shape-up` — 6-week appetite with scopes and hill chart

Operating rules:
- The agent reads the source document and explores the codebase for additional context.
- Tasks must form a valid DAG — no circular dependencies.
- Each task specifies: ID, title, description, affected files, depends-on (task IDs), effort estimate, assignable track.
- The critical path must be identified and highlighted.
- Parallel tracks must be explicit (tasks with no dependency between them can run simultaneously).
- Do NOT implement. Only produce the plan.
