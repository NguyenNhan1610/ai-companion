---
description: Run the full planning pipeline for a feature (FDR -> validate -> IMPL -> validate -> TODO -> validate). Use when user wants to plan a complete feature end-to-end, generate all planning documents in one go, or run the full FDR-to-TODO chain with automatic validation.
argument-hint: '[--scope backend|frontend|fullstack|api|data] [--method pragmatic|tdd|agile|kanban|shape-up] <feature description>'
context: fork
allowed-tools: Read, Glob, Grep, Bash(node:*), Bash(git:*), Agent, AskUserQuestion
---

Run the full planning pipeline: FDR → validate → IMPL → validate → TODO → validate.

Each stage writes a document, validates it against its upstream, and feeds the result to the next stage. The PostToolUse validation hook provides automatic coverage checking at each Write — if the hook detects gaps, the agent revises before proceeding.

Raw user request:
$ARGUMENTS

## Pipeline

### Stage 1: Feature Development Record

Spawn the `ai:feature-development-record` subagent with the user's full request (including any `--scope` flag).

Wait for it to complete. From its output, extract:
- The FDR file path (e.g., `.project/feature-development-records/FDR-03-session-caching.md`)
- The FDR document ID (e.g., `FDR-03`)

The PostToolUse validation hook will automatically check upstream AAC coverage during the Write. If the hook blocks with gaps, the FDR agent will revise — this happens transparently within the agent.

### Stage 2: Validate FDR

After the FDR agent completes, run an explicit validation to confirm coverage:

1. Read the FDR file header to find the `Source ADR:` field.
2. If a source ADR exists (not `—`):
   - Spawn the `ai:validate` subagent with: `{ADR-ID} {FDR-ID}`
   - Report the verdict: PASS, PARTIAL, or FAIL.
   - If FAIL: stop the pipeline and report the gaps. Do not proceed to IMPL.
3. If no source ADR (lite flow): skip validation, proceed.

### Stage 3: Implementation Plan

Spawn the `ai:implement` subagent with:
- `--from {FDR file path}` (the exact path from Stage 1)
- Pass through any `--method` flag from the user's original request (default: pragmatic)

Wait for it to complete. Extract:
- The IMPL file path (e.g., `.project/implementation-plans/IMPL-03-session-caching.md`)
- The IMPL document ID (e.g., `IMPL-03`)

The PostToolUse validation hook will check FAC→EAC coverage during the Write.

### Stage 4: Validate IMPL

After the IMPL agent completes, run explicit validation:

1. Spawn the `ai:validate` subagent with: `{FDR-ID} {IMPL-ID}`
2. Report the verdict.
3. If FAIL: stop the pipeline and report the gaps. Do not proceed to TODO.

### Stage 5: TODO Tracking

Spawn the `ai:todo` subagent with:
- `--from {IMPL file path}` (the exact path from Stage 3)

Wait for it to complete. Extract:
- The TODO file path (e.g., `.project/todo-lists/TODO-03-session-caching.yaml`)
- The TODO document ID (e.g., `TODO-03`)

### Stage 6: Validate TODO

After the TODO agent completes, run explicit validation:

1. Spawn the `ai:validate` subagent with: `{IMPL-ID} {TODO-ID}`
2. Report the verdict.

### Final Report

After all stages complete, output a summary:

```
## Pipeline Complete

| Stage | Document | Status |
|-------|----------|--------|
| FDR   | `{FDR path}` | {PASS/PARTIAL/FAIL or "lite flow"} |
| IMPL  | `{IMPL path}` | {PASS/PARTIAL/FAIL} |
| TODO  | `{TODO path}` | {PASS/PARTIAL/FAIL} |

### Next Steps
```

Then output a `next_actions` JSON block with real paths and IDs:
```json
{
  "next_actions": [
    { "action": "View the Kanban board", "command": "/ai:todo board" },
    { "action": "Run full traceability audit", "command": "/ai:trace {FDR-ID} --verify" },
    { "action": "Start implementation", "command": "Ready to implement — tasks are in {TODO path}" }
  ]
}
```

## Operating Rules

- Each subagent runs in foreground — wait for completion before proceeding.
- Extract file paths and document IDs from agent output. Never use placeholder values.
- If any validation stage returns FAIL, stop the pipeline immediately and report which upstream items are missing. The user can fix the gaps manually and re-run from that stage.
- If any subagent fails or errors, report the failure and stop. Do not skip stages.
- Pass `--scope` to the FDR agent and `--method` to the IMPL agent. Other flags apply to the pipeline itself.
- Do NOT implement the feature. This command only produces planning documents.
