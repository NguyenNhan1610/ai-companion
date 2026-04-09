---
name: handoff-recording
description: Analyze cascade change logs and produce structured implementation records with traceability. Use when user wants to document what was built, create a handoff record, trace implementation to planning documents, or says cascade, record, handoff, document changes, what did I build.
user-invocable: true
---

# Handoff Recording

Analyze raw cascade change logs and produce structured implementation records with full traceability to ADR/FDR/IMPL documents.

## Command

```bash
/ai:cascade                                # Analyze all changes in current cascade
/ai:cascade Add session caching feature    # With context label
/ai:cascade --since 2h                     # Only last 2 hours
/ai:cascade --since today                  # Today's changes
```

## What It Produces

Saved to `.claude/project/cascades/REC-{NN}-{slug}.md`:

- **Traceability table** — links to source ADR/FDR/IMPL documents
- **Task completion** — which IMPL tasks are done, partial, not started (with evidence)
- **Edge case coverage** — which FDR edge cases have handlers (with file:line citations)
- **Risk mitigation** — which FDR risks are mitigated (with implementation evidence)
- **Session timeline** — changes grouped by user prompt segments with timestamps
- **Changes by module** — file:line citations for every change
- **Test coverage** — what tests were added, what gaps remain
- **Known gaps** — what's incomplete, linked to source documents
- **Architecture impact** — Mermaid diagram of what changed

## Document Flow

```
ADR (decision) → FDR (feature plan) → IMPL (task DAG) → code → /ai:cascade (record)
                                                                      ↓
                                                              REC-{NN} traces back to all three
```

## Template Reference

See `references/cascade-record-template.md` for the full output format.
