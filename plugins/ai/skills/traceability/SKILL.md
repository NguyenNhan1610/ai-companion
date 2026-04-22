---
name: traceability
description: Generate traceability reports linking decisions, plans, tasks, code, tests, and knowledge. Use when user wants to verify feature completeness, audit evidence, check readiness to ship, validate coverage, trace a decision through implementation, or asks about traceability, verification, audit, coverage, readiness, ship check.
user-invocable: true
---

# Traceability Reports

Walk the entire document chain, cross-reference evidence, verify code, and produce a coverage report with gap analysis.

## Command

```bash
/ai:trace FDR-03                    # Trace feature from plan to implementation
/ai:trace ADR-05                    # Trace decision through all downstream docs
/ai:trace --verify FDR-03           # Strict mode: ship/no-ship verdict
/ai:trace --query "Is session caching fully implemented?"
```

## What It Checks

| Dimension | What's verified |
|-----------|----------------|
| Document chain | ADR → FDR → **TP** → IMPL → TODO → cascade → knowledge all linked |
| Acceptance chain | AAC → FAC → EAC → TC fully linked, no broken references |
| Test plan | TP exists (optional), covers all FAC, linked to IMPL via EAC |
| Edge cases | FDR edge case → IMPL task → TODO status → code exists → test exists |
| Risks | FDR risk → IMPL mitigation → code evidence |
| Tasks | IMPL task → TODO status → cascade timestamp → file verified |
| Tests | IMPL test task → test file exists → tests passing |
| Knowledge | Relevant entries were considered and applied |

## Output

Saved to `.claude/project/traceability-reports/TRACE-{NN}-{slug}.md`:
- Acceptance Criteria Chain matrices (AAC→FAC→EAC→TC with code verification)
- Document chain diagram (Mermaid with color-coded status, TP included)
- Edge case coverage matrix with file:line verification
- Risk mitigation coverage with code evidence
- Task completion with cascade timestamps
- Test coverage map
- Gap summary with severity and actions
- Coverage percentages per dimension
- Verdict (with `--verify`): READY TO SHIP / NOT READY / NEEDS REVIEW

## How It Works

1. **Discover** (3 parallel sub-agents): find documents, verify code, collect test evidence
2. **Cross-reference**: build matrices linking every plan item to implementation evidence
3. **Gap analysis**: identify missing items by severity
4. **Render**: Mermaid chain diagram + coverage report
5. **Verdict**: ship/no-ship based on high-severity gaps

## Template Reference

See `references/trace-template.md` for the full output format.
