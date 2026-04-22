---
id: TP-{NN}
type: test-plan
slug: {kebab-slug}
title: {Feature Title} Test Plan
status: draft                                   # draft | active | superseded | deprecated
upstream:
  - .claude/project/feature-development-records/FDR-{NN}-{slug}.md
downstream: []                                  # patched by IMPL generator
supersedes: []
superseded_by: null
framework: {Vitest | Jest | Pytest | other}
inherits_aac: []                                # e.g. [AAC-01, AAC-02]
inherits_fac: []                                # e.g. [FAC-01, FAC-02, FAC-03]
baseline: {N existing tests across M files}
target: {~N+X tests across ~M+Y files}
created: {YYYY-MM-DD}
updated: {YYYY-MM-DD}
---

# TP-{NN}: {Feature Title} Test Plan

---

## Test Plan Summary

{One paragraph: what this test plan covers, which feature, what's in/out of scope.}

## Objectives

- Verify all FACs from FDR-{NN}
- Prove all AAC invariants from ADR-{NN} (if applicable)
- Ensure no regression in existing {N} tests
- {Additional objectives}

## Shared Test Fixtures

<!-- Imported from FDR-{NN} §Canonical Test Fixtures — used across all test files -->

| Fixture ID | Source | Description | Used By TCs |
|-----------|--------|-------------|-------------|
| {FIX-N from FDR} | FDR-{NN} | {description} | TC-{N}, TC-{M} |

**Implementation:** fixtures live in `{path/to/__fixtures__/}` and are imported by all test files. This ensures test data matches FDR definitions exactly.

## Test Cases

| ID | Description | Type | Priority | traces_to_fac | traces_to_eac | Fixture | Test Data | Input | Expected Result | Status |
|----|-------------|------|----------|--------------|--------------|---------|-----------|-------|----------------|--------|
| TC-{N} | {what the test verifies} | {unit/integration/e2e} | {P0/P1/P2} | {FAC-N} | {-- (back-filled by IMPL)} | {FIX-N or "—"} | {concrete test data} | {specific input} | {specific expected output} | {draft/ready/implemented/passing/failing} |

## Traceability Matrices

### FAC → TC Coverage

| FAC ID | FAC Description | Test Cases | Coverage |
|--------|----------------|------------|----------|
| FAC-{N} | {description from FDR} | TC-{N}, TC-{M} | {Full/Partial/None} |

### AAC → TC Coverage

<!-- Omit this section if Source ADR is "—" -->

| AAC ID | AAC Invariant | Test Cases | Coverage |
|--------|-------------|------------|----------|
| AAC-{N} | {invariant from ADR} | TC-{N}, TC-{M} | {Full/Partial/None} |

### Edge Case → TC Coverage

| Edge Case | FDR Ref | Severity | Test Cases | Coverage |
|-----------|---------|----------|------------|----------|
| {E{N} scenario} | FDR-{XX} E{N} | {H/M/L} | TC-{N} | {Full/Partial/None} |

### Risk → TC Coverage

| Risk | FDR Ref | Severity | Test Cases | Coverage |
|------|---------|----------|------------|----------|
| {R{N} risk} | FDR-{XX} R{N} | {H/M/L} | TC-{N} | {Full/Partial/None} |

## I/O Table Test Mapping

<!-- Each FDR I/O table row maps to a TC. -->

| FDR I/O Row | Function | Input | Expected | TC |
|------------|----------|-------|----------|-----|
| B-{N} | `{function}` | {input from FDR} | {output from FDR} | TC-{N} |

## Test Environment

| Component | Details |
|-----------|---------|
| Runtime | {Node 20 / Python 3.12 / etc.} |
| Test framework | {Vitest / Jest / Pytest} |
| Browser env | {jsdom / happy-dom / real browser} |
| Key dependencies | {mocked or real} |
| CI | {GitHub Actions / etc.} |
| Feature flag | `{FLAG_NAME}=true` for test runs |

## Entry / Exit Criteria

### Entry
- [ ] FDR-{NN} accepted
- [ ] Test framework confirmed working
- [ ] Shared fixtures created

### Exit
- [ ] All TC-{N} status = passing or explicitly waived with rationale
- [ ] Test count ≥ {target}
- [ ] Zero open P0/P1 defects
- [ ] Traceability matrix 100% covered (every FAC has ≥1 TC)

## Coverage Summary

| Dimension | Covered | Total | Percentage |
|-----------|---------|-------|-----------|
| FAC coverage | {N} | {total FACs} | {%} |
| AAC coverage | {N} | {total AACs} | {%} |
| Edge cases | {N} | {total edges} | {%} |
| Risks | {N} | {total risks} | {%} |
| I/O table rows | {N} | {total rows} | {%} |
| **Overall** | **{N}** | **{total}** | **{%}** |

## Gaps

| # | Gap | Severity | Source | Action Needed |
|---|-----|----------|--------|---------------|
| G{N} | {what FAC/edge/risk lacks a TC} | {High/Med/Low} | {FDR ref} | {specific action} |

---

**Downstream documents:**
- IMPL: {IMPL-{NN} or "—"}
- TODO: {TODO-{NN} or "—"}
