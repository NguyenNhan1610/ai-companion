---
description: Generate a traceability report linking decisions, plans, tasks, code, tests, and knowledge. Use when user wants to verify feature completeness, audit evidence, check readiness to ship, or trace a decision through implementation.
argument-hint: '[--verify] [--query "natural language question"] <document-id or feature name>'
allowed-tools: Read, Glob, Grep, Bash(node:*), Bash(git:*), Write
---

Produce a traceability report **inline in this conversation**. Do NOT spawn a subagent.

Raw user request:
$ARGUMENTS

## Usage

- `/ai:trace FDR-03` — trace from FDR through IMPL, TODO, cascade, code, tests.
- `/ai:trace ADR-05` — trace from ADR through all downstream docs.
- `/ai:trace --verify FDR-03` — strict mode: flag every gap as a finding with ship/no-ship verdict.
- `/ai:trace --query "Is session caching fully implemented?"` — natural-language query.

## Steps

1. **Resolve the starting document**: if an ID is given, locate it by scanning the canonical directory for that stage (e.g., `.claude/project/feature-development-records/FDR-03-*.md`); if a feature name, pick the most recent matching FDR/ADR.
2. **Walk the graph via frontmatter**: read the seed's `upstream:` and `downstream:` lists (full relative paths) and traverse both directions transitively. Each doc yields its own frontmatter edges — no globbing, no prose-header parsing.
3. **Schema-validate each doc on the walk**:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/lib/planning-docs.mjs" validate <path>
   ```
   Schema failures are recorded as high-severity gaps but do not abort the walk.
4. **Collect code evidence**: use Grep/Read to find file:line citations supporting each task/EAC. Every citation must be verified by reading the actual file.
5. **Collect test evidence**: grep tests that exercise the functions referenced.
6. **Cross-reference**: check every upstream item (AAC / FAC / TC / EAC / task id) is traced through to code and tests. Flag gaps with severity — high (blocks ship), medium (should fix), low (nice to have). Dangling `upstream:` / `downstream:` paths are always high-severity.
7. **Optional `--verify`**: produce a ship/no-ship verdict based on highs + medium count.
8. **Write report** to `.claude/project/traceability-reports/TRACE-{NN}-{slug}.md`, then run `node planning-docs.mjs sync <trace-path>` so the seed doc's `downstream:` list gets updated.

## Rules

- Every file:line citation must be verified by reading the actual file.
- Do NOT fix any gaps. Only report.
- Use `Grep` + `Read` in parallel batches for evidence collection (not Agent subagents).
- Reference the traceability skill template at `plugins/ai/skills/traceability/references/trace-template.md` for the report structure.
