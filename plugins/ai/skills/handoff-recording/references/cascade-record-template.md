# REC-{NN}: {Feature/Change Title}

**Date:** {YYYY-MM-DD}
**Branch:** {branch name}
**Session segments:** {count}
**Files changed:** {total} ({N} created, {N} edited, {N} removed)

---

## Traceability

| Document | Link | Status |
|----------|------|--------|
| ADR | [{ADR-XX-title}](../adr/ADR-XX-slug.md) | {Accepted/Proposed} |
| FDR | [{FDR-XX-title}](../fdr/FDR-XX-slug.md) | {In Progress/Completed} |
| IMPL | [{IMPL-XX-title}](../implementation_plans/IMPL-XX-slug.md) | {In Progress/Completed} |

*If no planning documents found, note: "No planning documents found for this implementation."*

### Task Completion (from IMPL)

| Task | Title | Status | Evidence |
|------|-------|--------|----------|
| T{NN} | {title} | Done | `{file}:{lines}` {action} at [{HH:MM}] |
| T{NN} | {title} | Partial | {what's done}, {what's missing} |
| T{NN} | {title} | Not started | — |

### FDR Edge Case Coverage

| Edge Case | FDR Ref | Handled | Implementation |
|-----------|---------|---------|----------------|
| E{N}: {name} | FDR-{XX} {section} | Yes | `{file}:{line}` — {how it's handled} |
| E{N}: {name} | FDR-{XX} {section} | No | Not yet implemented |

### Risk Mitigation Coverage

| Risk | FDR Ref | Mitigated | Implementation |
|------|---------|-----------|----------------|
| R{N}: {name} | FDR-{XX} R{N} | Yes | `{file}:{lines}` — {how it's mitigated} |
| R{N}: {name} | FDR-{XX} R{N} | No | Pending {IMPL task} |

## Summary

{One paragraph: what was built, why, and current state.}

## Session Timeline

### [{HH:MM}] {User prompt text}
- [{HH:MM:SS}] Created `{file}` — {description}
  - `{file}:{lines}` — {specific implementation detail}
- [{HH:MM:SS}] Edited `{file}` L{start}-{end} — {description}

### [{HH:MM}] {Next user prompt}
- [{HH:MM:SS}] Edited `{file}` L{start}-{end} — {description}

## Changes by Module

### {module_name}/

| File | Lines | Action | Description |
|------|-------|--------|-------------|
| `{file}` | {start}-{end} | CREATE | {what it does} |
| `{file}` | {start}-{end} | EDIT | {what changed} |

### {another_module}/

| File | Lines | Action | Description |
|------|-------|--------|-------------|
| `{file}` | {line} | EDIT | {what changed} |

## Key Decisions Made

{Decisions made during implementation that deviated from or refined the FDR/ADR. Each with file:line evidence.}

- **Decision:** {what was decided}
  - **Reason:** {why}
  - **Evidence:** `{file}:{line}` — {code that reflects this decision}
  - **FDR deviation:** {how this differs from the plan, if applicable}

## Architecture Impact

![Architecture Impact](./REC-{NN}-{slug}-impact.svg)

<details>
<summary>Mermaid source</summary>

```mermaid
graph TD
    subgraph Changed
        A["{module A}"]
        B["{module B}"]
    end
    subgraph Unchanged
        C["{module C}"]
    end
    A --> C
    B --> A

    style A fill:#d4edda
    style B fill:#fff3cd
```

</details>

## Test Coverage

| Test | File:Line | Covers | Edge Cases |
|------|-----------|--------|-----------|
| {test_name} | `{file}:{lines}` | {what it tests} | {E{N} if applicable} |

## Known Gaps

| Gap | Related To | Priority | Next Step |
|-----|-----------|----------|-----------|
| {what's missing} | {FDR-XX E{N} / IMPL T{NN}} | {High/Medium/Low} | {action to take} |

## Handoff Notes

{Context for the next person picking this up. Include:}
- What's working and verified
- What's incomplete and why
- Any gotchas or surprises encountered
- Links to source documents for full context
