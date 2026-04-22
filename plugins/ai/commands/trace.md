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

1. **Resolve the starting document**: if an ID is given, locate it under `.claude/project/`; if a feature name, search for the most recent matching FDR/ADR.
2. **Walk the chain**: ADR → FDR → TP → IMPL → TODO. Read each doc that exists. Record its ID, path, and key items (AAC/FAC/TC/EAC/task IDs).
3. **Collect code evidence**: use Grep/Read to find file:line citations supporting each task/EAC. Every citation must be verified by reading the actual file.
4. **Collect test evidence**: grep tests that exercise the functions referenced.
5. **Cross-reference**: check that every upstream item is traced through to code and tests. Flag gaps with severity — high (blocks ship), medium (should fix), low (nice to have).
6. **Optional `--verify`**: produce a ship/no-ship verdict based on highs + medium count.
7. **Write report** to `.claude/project/traces/TRACE-{NN}-{slug}.md`.

## Rules

- Every file:line citation must be verified by reading the actual file.
- Do NOT fix any gaps. Only report.
- Use `Grep` + `Read` in parallel batches for evidence collection (not Agent subagents).
- Reference the traceability skill template at `plugins/ai/skills/traceability/references/trace-template.md` for the report structure.
