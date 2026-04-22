<!-- FDR flow fragment: loaded when full flow (ADR exists in chain).
     Applies to: ADR → FDR → TP → IMPL → TODO pipeline. -->

## Full Flow Guidance

### ADR Inheritance
1. Read the source ADR specified in `--adr` flag or found in `.claude/project/adr/`
2. Extract the AAC table from the ADR
3. Record inherited AAC IDs for the FDR header `Inherits AAC` field

### Header Fields
Set these header values in the FDR:
- `**Source ADR:** ADR-{NN}-{slug}`
- `**Inherits AAC:** AAC-1, AAC-2, ...` (list all AAC IDs from source ADR)

### FAC Table
In the Feature Acceptance Criteria table, populate `traces_to_aac` with real AAC IDs from the source ADR. Every AAC must be covered by at least one FAC — if any AAC lacks a FAC, add one.

### AAC → FAC Verification
Before writing the FDR, verify:
- Every AAC from the source ADR has at least one FAC that traces to it
- No orphan traces (FAC references an AAC that doesn't exist in the ADR)

### Downstream
The FDR in full flow produces:
- `**Downstream:** TP-{NN}, IMPL-{NN}, TODO-{NN}`
