---
name: validation
description: Validate pairwise fulfillment between planning documents (ADR, FDR, TP, IMPL, TODO). Use when user wants to check if a downstream document covers all requirements from its upstream document, verify stage transition completeness, or check document coverage after generating a new document.
user-invocable: true
---

# Document Validation

Fast pairwise checks that a downstream document fulfills its upstream document's requirements. Reads tables, cross-references IDs, reports gaps.

## Command

```bash
/ai:validate ADR-05 FDR-03              # explicit pair
/ai:validate FDR-03 → IMPL-03          # arrow syntax
/ai:validate FDR-03 IMPL-03            # arrow optional
/ai:validate FDR-03                     # auto-discovers upstream from frontmatter
/ai:validate ADR-05 IMPL-03            # skip-step validation
```

## How upstream is resolved

In auto-discovery mode (single argument), the downstream doc's `upstream:` frontmatter list is read directly — no prose-header parsing. Each entry is a full relative path, so the upstream file is loaded without globbing.

When two IDs are passed explicitly, the agent globs the canonical directory for each stage (e.g., `.project/feature-development-records/FDR-{NN}*.md`) and then verifies the downstream's `upstream:` list contains the upstream path — mismatch is a PARTIAL verdict at best.

Before producing a VAL report, both docs are schema-validated via `planning-docs.mjs validate`. Malformed frontmatter short-circuits the run with a clear error (no VAL report is written).

## Valid Pairs

| Pair | What's checked |
|------|---------------|
| ADR → FDR | AAC→FAC coverage, contracts referenced, integration points, new types |
| FDR → TP | FAC→TC, I/O rows→TC, edge cases→TC, risks→TC, fixture alignment |
| FDR → IMPL | FAC→EAC, functions→tasks, edge cases→tasks, risks→tasks, I/O→behavior rows |
| TP → IMPL | TC→EAC back-fill, no orphan TCs, fixture consistency |
| IMPL → TODO | Task existence, acceptance_trace (EAC/FAC/AAC), dependency graph |
| ADR → IMPL | AAC→EAC transitive (through FDR if exists), integration points→tasks |
| FDR → TODO | FAC in acceptance_trace, edge case tracking, risk tracking |

## Validate vs Trace

| | `/ai:validate` | `/ai:trace` |
|-|----------------|-------------|
| Scope | One pair (2 docs) | Full chain (all docs) |
| Checks | Table cross-refs | Code evidence + test execution |
| Speed | Fast | Slow (3 sub-agents) |
| When | After generating a doc | Before shipping |

## Output

Saved to `.project/validation-reports/VAL-{NN}-{upstream}-to-{downstream}.md` with:
- Per-criterion PASS/FAIL/WARN verdicts
- Coverage detail tables showing which items pass/fail
- Gaps summary with severity and action needed
- Overall coverage percentage and verdict

## Auto-Trigger

After generating any document, the producing agent suggests validation:
```
> Tip: validate coverage with /ai:validate {upstream-id} {this-doc-id}
```

## References

- `references/val-report-template.md` — output format
- `references/pair-adr-fdr.md` — ADR→FDR criteria (5 checks)
- `references/pair-fdr-tp.md` — FDR→TP criteria (6 checks)
- `references/pair-fdr-impl.md` — FDR→IMPL criteria (6 checks)
- `references/pair-tp-impl.md` — TP→IMPL criteria (3 checks)
- `references/pair-impl-todo.md` — IMPL→TODO criteria (6 checks)
- `references/pair-adr-impl.md` — ADR→IMPL skip-step criteria (3 checks)
- `references/pair-fdr-todo.md` — FDR→TODO skip-step criteria (3 checks)
