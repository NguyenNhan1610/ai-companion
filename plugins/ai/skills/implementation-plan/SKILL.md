---
name: implementation-plan
description: Generate DAG-based implementation plans from FDR or ADR documents. Use when user wants to create an implementation checklist, break down a feature into tasks with dependencies, identify critical path, plan parallel work tracks, or convert an FDR/ADR into actionable tasks.
user-invocable: true
---

# Implementation Plans

Transform FDR/ADR documents into DAG-based task plans with dependencies, parallel tracks, and critical path analysis.

## Command

```bash
/ai:implement --from .claude/project/feature-development-records/FDR-03-session-caching.md
/ai:implement --from .claude/project/architecture-decision-records/ADR-05-redis.md
/ai:implement --from .claude/project/feature-development-records/FDR-03-session-caching.md --method tdd
/ai:implement --from .claude/project/feature-development-records/FDR-03-session-caching.md --method agile
/ai:implement --from .claude/project/feature-development-records/FDR-03-session-caching.md --tp .claude/project/test-plans/TP-03-session-caching.md
/ai:implement --from .claude/project/feature-development-records/FDR-03-session-caching.md --lite
```

## Flow Modes

| Flag | Effect |
|------|--------|
| *(default)* | Auto-detects: if TP exists, links EAC→TC; if not, generates inline TCs |
| `--lite` | Explicit lite flow: generates `## Inline Test Cases` with `iTC-` IDs (no TP needed) |
| `--tp <path>` | Explicit full flow: reads TP, links EAC→TC, back-fills TP with EAC IDs |

## Methods

| Method | Description |
|--------|-------------|
| `pragmatic` (default) | Tests first for critical paths, incremental delivery, feature flags |
| `tdd` | Every task paired with test-first: red → green → refactor |
| `agile` | Sprint-sized user stories with acceptance criteria |
| `kanban` | Flat prioritized backlog with WIP limits |
| `shape-up` | 6-week appetite with scopes and hill charts |

## Output

Saved to `.claude/project/implementation-plans/IMPL-{NN}-{slug}.md` with:
- **Engineering Acceptance Criteria (EAC)** table tracing to FAC and TC
- **Per-task acceptance criteria**, function refs, and behavior row refs
- **Source TP cross-reference** (when TP exists); **Inline Test Cases** (when no TP)
- Task DAG rendered as Mermaid (embedded inline)
- Critical path identified and highlighted
- Parallel tracks mapped
- Per-task details: ID, files, dependencies, effort, done criteria
- Risk mitigation traceability back to source FDR/ADR

## References

- `references/impl-template.md` — core output format (always loaded)
- `references/flow-lite.md` — inline test cases template (lite flow, no TP)
- `references/method-pragmatic.md` — default hybrid method
- `references/method-tdd.md` — test-driven development
- `references/method-agile.md` — scrum/sprint planning
- `references/method-kanban.md` — flow-based with WIP limits
- `references/method-shape-up.md` — fixed appetite, variable scope
