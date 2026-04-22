---
id: IMPL-{NN}
type: implementation-plan
slug: {kebab-slug}
title: {Feature/Decision Title}
status: draft                                   # draft | active | superseded | deprecated
upstream:                                       # FDR is canonical; may also include ADR directly
  - .claude/project/feature-development-records/FDR-{NN}-{slug}.md
downstream: []                                  # patched by TODO generator
supersedes: []
superseded_by: null
source_tp: null                                 # full path to TP or null for lite flow
method: {pragmatic|tdd|agile|kanban|shape-up}
total_effort: {summary string}
critical_path_duration: {e.g., 14d}
parallel_tracks: {number}
created: {YYYY-MM-DD}
updated: {YYYY-MM-DD}
---

# IMPL-{NN}: {Feature/Decision Title}

---

## Source Summary

{One paragraph summarizing the FDR/ADR — what we're building and why.}

## Engineering Acceptance Criteria

<!-- EACs: Code-level quality gates. Each traces to ≥1 FAC from FDR and ≥1 TC from TP.
     When no TP exists, traces_to_tc uses inline test case IDs (iTC-{N}). -->

| ID | Gate | traces_to_fac | traces_to_tc | Verification | Task |
|----|------|--------------|-------------|-------------|------|
| EAC-{N} | {code-level deliverable statement} | FAC-{N} | {TC-{N} or iTC-{N}} | {unit test / integration test / assertion} | T{NN} |

<!-- FLOW FRAGMENT: If lite flow (Source TP is "—"), insert Inline Test Cases section
     from references/flow-lite.md here. -->

## Task DAG

<!-- Mermaid flowchart with color-coded tracks. Bold critical path edges.
     classDef: foundation=#cce5ff, core=#d4edda, testing=#fff3cd,
     hardening=#f8d7da, observability=#e2d5f1, rollout=#d6d8db -->

```mermaid
graph TD
    T01["T01: Example task<br/>0.5d"]:::foundation
    T02["T02: Next task<br/>1d"]:::core
    T01 --> T02

    classDef foundation fill:#cce5ff,stroke:#004085
    classDef core fill:#d4edda,stroke:#155724
    classDef testing fill:#fff3cd,stroke:#856404
    classDef hardening fill:#f8d7da,stroke:#721c24
    classDef observability fill:#e2d5f1,stroke:#563d7c
    classDef rollout fill:#d6d8db,stroke:#383d41
```

## Critical Path

```
T{NN} (Xd) → T{NN} (Xd) → ... → T{NN} (Xd)
```

**Critical path duration:** {N} days
**Total effort (all tracks):** {N} days
**Parallelism savings:** ~{N} days

## Parallel Tracks

| Track | Tasks | Can run in parallel with |
|-------|-------|------------------------|
| {track name} | T{NN}, T{NN} | {other tracks/tasks} |

## Task Details

<!-- Generate one section per task. Every task uses this exact format: -->

#### T{NN}: {Task title}
- **Track:** {foundation|core|testing|hardening|observability|rollout}
- **Depends on:** {T{NN}, T{NN} or "—" for root tasks}
- **Effort:** {0.5d|1d|1.5d|2d}
- **Files:** `{file1}`, `{file2}`
- **Description:** {What exactly to do}
- **Done when:** {Concrete acceptance criteria}
- **Acceptance criteria:** [{EAC-N}] — EAC IDs this task must satisfy
- **Function ref:** {`function_name` from FDR §Function Contracts or "N/A"}
- **Behavior rows:** [{B-N}] from FDR §I/O Tables or "N/A"

## Risk Mitigations from Source

| Risk (from FDR/ADR) | Implemented in Task | Verified in Task |
|---------------------|--------------------|--------------------|
| {R{N}: risk name} | T{NN} ({how}) | T{NN} ({test type}) |

## Summary

| Metric | Value |
|--------|-------|
| Total tasks | {N} |
| Total effort | {N} days |
| Critical path | {N} days |
| Parallel tracks | {N} |
| Root tasks (start immediately) | T{NN}, T{NN} |
| Final task | T{NN} |
| Risk mitigations | {N} |
| Edge cases covered | {N} |
| Tests planned | {N} test tasks |
| EACs defined | {N} |
| Inline TCs | {N (if no TP) or "— (TP exists)"} |
