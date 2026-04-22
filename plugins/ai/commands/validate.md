---
description: Validate whether a downstream planning document fulfills its upstream document's requirements. Use when user wants to check document coverage, verify stage transition completeness, or validate after generating a new document.
argument-hint: '<upstream-doc-id> [→|->|to] <downstream-doc-id>'
allowed-tools: Read, Glob, Grep, Bash(node:*), Bash(git:*), Write
---

Perform pairwise validation **inline in this conversation**. Do NOT spawn a subagent.

Raw user request:
$ARGUMENTS

## Steps

1. **Parse arguments**: strip `→`, `->`, `to` separators. Extract two document IDs, or one for auto-discovery mode.
2. **Identify stage types** from ID prefixes: `ADR-*`→adr, `FDR-*`→fdr, `TP-*`→tp, `IMPL-*`→impl, `TODO-*`→todo.
3. **Order upstream/downstream** by chain rank `adr < fdr < tp < impl < todo`. Lower rank = upstream.
4. **Auto-discovery** (single argument): Read the document's header — FDR has `Source ADR:`, TP has `Source FDR:`, IMPL has `Source:`, TODO has `source_impl:`.
5. **Load the pair fragment**: `plugins/ai/skills/validation/references/pair-{upstream}-{downstream}.md`. Valid pairs: `adr-fdr`, `fdr-tp`, `fdr-impl`, `tp-impl`, `impl-todo`, `adr-impl`, `fdr-todo`. Invalid pair → emit error "Invalid pair. Valid pairs: ADR→FDR, FDR→TP, FDR→IMPL, TP→IMPL, IMPL→TODO, ADR→IMPL (skip), FDR→TODO (skip)".
6. **Read both docs**, extract tables + cross-reference columns.
7. **Check each criterion** from the pair fragment: coverage, orphan traces, structural completeness. Every gap must reference a specific upstream item ID.
8. **Write report** to `.claude/project/validations/VAL-{NN}-{upstream}-to-{downstream}.md` with per-criterion PASS/FAIL/WARN.

## Rules

- Load ONLY the pair-specific fragment — not all 7.
- Structural check only (table cross-refs). For code-evidence checks, use `/ai:trace`.
- Do NOT modify either document. Only write the VAL report.
- If a pair is marked `(skip)` (ADR→IMPL, FDR→TODO), note it and exit cleanly.
