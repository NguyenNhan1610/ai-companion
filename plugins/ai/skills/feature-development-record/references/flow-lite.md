<!-- FDR flow fragment: loaded when --scope includes "lite" (no ADR in chain).
     Applies to: FDR → IMPL → TODO pipeline without upstream ADR or TP. -->

## Lite Flow Guidance

### Header Fields
Set these header values in the FDR:
- `**Source ADR:** —`
- `**Inherits AAC:** —`

### FAC Table
In the Feature Acceptance Criteria table, set `traces_to_aac` to `"—"` for ALL rows. There is no upstream ADR to trace to.

### Lite Invariants
Add a `### Lite Invariants` subsection immediately after the FAC table:

```markdown
### Lite Invariants

<!-- Informal system-level constraints this feature must not violate.
     In lite flow (no ADR), these replace formal AAC inheritance.
     Not full AACs with testable predicates, but enough to guide tests. -->

- {Constraint 1 — e.g., "Must not break existing API contract for /api/users"}
- {Constraint 2 — e.g., "Session data must remain tenant-isolated"}
- {Constraint 3 — e.g., "Page load time must stay under 2s P95"}
```

### Downstream
The FDR in lite flow produces:
- `**Downstream:** IMPL-{NN}, TODO-{NN}` (no TP reference)
