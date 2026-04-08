---
name: hypothesis-debugging
description: Hypothesis-based debugging with visual decision trees. Use when user describes a bug, performance issue, flaky test, or unexpected behavior and wants structured investigation with evidence-based diagnosis. Also trigger when user says debug, investigate, diagnose, root cause, why does this fail, or hypothesis.
user-invocable: true
---

# Hypothesis Debugging

Structured debugging using the scientific method: observe, hypothesize, test, conclude.

## Command

```bash
/ai:debug The API returns 500 when submitting special characters
/ai:debug --type performance The dashboard takes 8 seconds to load
/ai:debug --type flaky The user registration test fails randomly in CI
/ai:debug --type behavior Users see stale data after updating their profile
```

## Debug Types

| Type | Focus | Examples |
|------|-------|---------|
| `bug` (default) | Error paths, input validation, state corruption | 500 errors, crashes, exceptions |
| `performance` | N+1 queries, blocking I/O, memory, algorithms | Slow pages, high CPU, timeouts |
| `flaky` | Race conditions, timing, shared state, isolation | Tests pass locally but fail in CI |
| `behavior` | State management, caching, event ordering | Works but shows wrong data |

## Process

1. **Observe** — Claude agents explore the codebase for evidence (grep, read, git log)
2. **Hypothesize** — Generate 3-5 ranked hypotheses with testable predictions
3. **Test** — Codex agents write and run test scripts for each hypothesis
4. **Conclude** — Render Mermaid decision tree, produce diagnosis report

## Output

The report includes:
- Evidence collected from codebase exploration
- Mermaid decision tree with color-coded results (green=confirmed, red=rejected, yellow=inconclusive)
- Per-hypothesis analysis with evidence and test results
- Root cause explanation with code references
- Recommended fix (read-only — does not apply changes)

## When to Use

- When a bug needs systematic investigation, not just a quick fix
- When the root cause is unclear and you want to rule out possibilities
- When a flaky test needs methodical analysis
- When you want a visual decision tree showing the investigation

## Detailed Methodology

See `references/methodology.md` for:
- Full 4-phase process with checklists
- Hypothesis quality criteria and templates
- Test script patterns for common scenarios
- Debug type guides (bug, performance, flaky, behavior)
- Mermaid decision tree patterns (basic, nested)
- Anti-patterns in debugging (shotgun debugging, confirmation bias, etc.)
