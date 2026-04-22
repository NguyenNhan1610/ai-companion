---
name: test-plan
description: Generate structured test plans with traceability matrices from FDR documents. Use when user wants to create a test plan, define test cases from a feature spec, bridge FDR to IMPL with test coverage, or asks about test planning, test traceability, test coverage matrices.
user-invocable: true
---

# Test Plans

Generate structured test plans from FDR documents with full traceability to acceptance criteria, edge cases, and risks.

## Command

```bash
/ai:test-plan --from .claude/project/feature-development-records/FDR-03-session-caching.md
/ai:test-plan --from .claude/project/feature-development-records/FDR-03-session-caching.md --adr .claude/project/architecture-decision-records/ADR-05-redis.md
```

## What You Get

1. **Test Cases (TC)** with concrete data, inputs, and expected results
2. **FAC → TC traceability** — every Feature Acceptance Criterion has test coverage
3. **AAC → TC traceability** — inherited architectural invariants are verified (when ADR exists)
4. **Edge Case → TC mapping** — every FDR edge case has a test case
5. **Risk → TC mapping** — every risk mitigation is tested
6. **I/O Table → TC mapping** — every FDR behavior row maps to a test
7. **Shared fixtures** from FDR canonical test data
8. **Gap analysis** — uncovered criteria flagged by severity
9. **Coverage summary** — percentages across all dimensions

## Document Flow

```
ADR (AAC) ─┐
            ├─→ FDR (FAC, I/O tables, edge cases) ─→ TP (TC with traceability) ─→ IMPL (EAC, back-fills TC→EAC)
            │                                                                    ↘
            │                                                                     TODO (acceptance_trace)
            │
            └─ (optional — TP works without ADR, FAC traces set to "—")
```

## Pipeline Configurations

| Config | Chain | What Happens |
|--------|-------|-------------|
| **Full** | ADR → FDR → TP | AAC + FAC inherited, full traceability |
| **No ADR** | FDR → TP | FAC only, `traces_to_aac: "—"`, AAC matrix omitted |

## Output

Saved to `.claude/project/test-plans/TP-{NN}-{slug}.md` with traceability matrices, coverage summary, and gap analysis.

## Template Reference

See `references/tp-template.md` for the complete output format.
