---
description: Validate whether a downstream planning document fulfills its upstream document's requirements. Use when user wants to check document coverage, verify stage transition completeness, or validate after generating a new document.
argument-hint: '<upstream-doc-id> [→|->|to] <downstream-doc-id>'
context: fork
allowed-tools: Read, Glob, Grep, Bash(node:*), Bash(git:*), AskUserQuestion
---

Route this request to the `ai:validate` subagent.

Raw user request:
$ARGUMENTS

The validation agent performs pairwise structural checks by:
1. **Parsing** two document IDs (or auto-discovering upstream from a single ID)
2. **Loading** only the relevant pair-specific fragment (one of 7 pair files)
3. **Extracting** tables and cross-reference columns from both documents
4. **Checking** each criterion: coverage, orphan traces, structural completeness
5. **Reporting** per-criterion PASS/FAIL/WARN with specific gaps
6. **Saving** to `.claude/project/validations/VAL-{NN}-{upstream}-to-{downstream}.md`

Valid pairs: ADR→FDR, FDR→TP, FDR→IMPL, TP→IMPL, IMPL→TODO, ADR→IMPL (skip), FDR→TODO (skip)

Operating rules:
- Load ONLY the relevant pair fragment — never load all 7.
- This is a structural check (table cross-refs), NOT a code evidence check. Use `/ai:trace` for that.
- Every gap must reference a specific upstream item ID.
- Do NOT modify either document. Only report.
