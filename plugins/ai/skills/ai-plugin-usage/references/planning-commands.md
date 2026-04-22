# Planning Commands

## `/ai:architecture-decision-record` — ADR

Generate a comprehensive ADR with Mermaid diagrams grounded in your codebase.

```bash
/ai:architecture-decision-record Should we use Redis or Memcached for caching?
/ai:architecture-decision-record --scope api REST vs GraphQL for the mobile API
/ai:architecture-decision-record --scope data Normalize orders table or use JSONB?
```

Scopes: `module` (default), `system`, `api`, `data`, `infra`

Outputs: Context, decision drivers, 2-3 options with trade-offs, comparison table, 3 Mermaid diagrams, implementation plan.

## `/ai:feature-development-record` — FDR

Plan a feature with deep codebase analysis, edge cases, risk assessment against existing codebase, and implementation roadmap.

```bash
/ai:feature-development-record Add multi-tenant session caching
/ai:feature-development-record --scope fullstack Add real-time notifications
/ai:feature-development-record --scope frontend,lite Add dashboard widget
```

Scopes: `backend` (default), `frontend`, `fullstack`, `api`, `data`. Add `,lite` for FDR→IMPL→TODO flow (no ADR/TP).

Outputs: Dependency graph, data flow, edge cases, risk matrix, testing strategy, timeline, rollout plan. Saved to `.project/feature-development-records/`.

## `/ai:test-plan` — Test Plan from FDR

```bash
/ai:test-plan --from FDR-03
/ai:test-plan --from FDR-03 --adr ADR-05
```

Generates structured test plan with FAC→TC traceability matrices. Saved to `.project/test-plans/`.

## `/ai:implement` — DAG-Based Implementation Plan

```bash
/ai:implement --from .project/feature-development-records/FDR-03-session-caching.md
/ai:implement --from .project/feature-development-records/FDR-03.md --method tdd
```

Methods: `pragmatic` (default), `tdd`, `agile`, `kanban`, `shape-up`

Outputs: Task DAG with Mermaid diagram, critical path, parallel tracks, per-task details. Saved to `.project/implementation-plans/`.

## `/ai:todo` — Task Tracking

```bash
/ai:todo                              # Show Kanban board
/ai:todo --from IMPL-03               # Generate from IMPL plan
/ai:todo update T06 --status complete # Update status
/ai:todo update T06 --ticket JIRA-125 # Link ticket
/ai:todo --sync                       # Auto-sync from cascade
```

Statuses: `pending`, `in-progress`, `complete`, `blocked`, `cancelled`. Saved to `.project/todo-lists/`.

## `/ai:validate` — Pairwise Stage Validation

```bash
/ai:validate ADR-05 FDR-03            # Check ADR→FDR coverage
/ai:validate FDR-03 IMPL-03           # Check FDR→IMPL coverage
/ai:validate FDR-03                    # Auto-discover upstream
```

Valid pairs: ADR→FDR, FDR→TP, FDR→IMPL, TP→IMPL, IMPL→TODO, ADR→IMPL (skip), FDR→TODO (skip). Saved to `.project/validation-reports/`.

## `/ai:trace` — Traceability Report

```bash
/ai:trace FDR-03                      # Trace from FDR to implementation
/ai:trace --verify FDR-03             # Ship/no-ship verdict
```

Uses 3 parallel sub-agents. Produces: document chain diagram, coverage matrices, gap analysis, overall percentage. Saved to `.project/traceability-reports/`.

## Document Flow

```
ADR → FDR → TP → IMPL → TODO → code → test → cascade → review
```

Minimum viable chain: `FDR → IMPL → TODO` (lite mode)
Acceptance hierarchy: `AAC (ADR) → FAC (FDR) → TC (TP) → EAC (IMPL) → acceptance_trace (TODO)`
