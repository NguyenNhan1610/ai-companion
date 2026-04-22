---
description: Generate a structured test plan with traceability matrices from an FDR document. Use when user wants to create a test plan, define test cases from a feature spec, or bridge FDR to IMPL with test coverage.
argument-hint: '--from <path-to-fdr> [--adr <path-to-adr>]'
context: fork
allowed-tools: Read, Glob, Grep, Bash(node:*), Bash(git:*), Agent, AskUserQuestion
---

Route this request to the `ai:test-plan` subagent.

Raw user request:
$ARGUMENTS

The test-plan agent produces a structured test plan by:
1. **Extracting** FAC, I/O tables, edge cases, risks, and fixtures from the source FDR
2. **Inheriting** AAC and invariants from the source ADR (if provided)
3. **Deriving** test cases (TC) with concrete data, each tracing to at least one FAC
4. **Building** traceability matrices: FAC→TC, AAC→TC, Edge→TC, Risk→TC
5. **Identifying** coverage gaps by severity
6. **Saving** to `.project/test-plans/TP-{NN}-{slug}.md`

Operating rules:
- Every TC must trace to at least one FAC.
- Test data must be concrete, not placeholder.
- `traces_to_eac` is left empty ("--") — back-filled when IMPL is generated.
- Do NOT write test code. Only produce the plan.
