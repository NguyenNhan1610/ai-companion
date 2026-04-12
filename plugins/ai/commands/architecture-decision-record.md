---
description: Generate a deep technical Architecture Decision Record with Mermaid diagrams. Use when user wants to document an architecture decision, compare design alternatives, evaluate trade-offs, or asks about system design documentation or technical decision records.
argument-hint: '[--scope module|system|api|data|infra] <decision topic or question>'
context: fork
allowed-tools: Read, Glob, Grep, Bash(node:*), Bash(git:*), Agent, AskUserQuestion
---

Route this request to the `ai:architecture-decision-record` subagent.

Raw user request:
$ARGUMENTS

The ADR agent produces a comprehensive Architecture Decision Record by:
1. **Exploring** the codebase to understand current architecture and constraints
2. **Analyzing** alternatives with trade-offs, risks, and evidence
3. **Rendering** Mermaid diagrams (current state, proposed state, comparison) as SVG + raw code
4. **Writing** the ADR document following the structured template

Execution mode:
- If `--background` is present, run in background.
- If `--wait` is present, run in foreground.
- Otherwise, default to foreground.

Scope:
- `--scope module` — component/module-level decision (default)
- `--scope system` — system-wide architecture decision
- `--scope api` — API design decision
- `--scope data` — data model/storage decision
- `--scope infra` — infrastructure/deployment decision

Operating rules:
- The ADR agent explores the codebase directly using Read, Grep, Glob, Bash.
- It renders Mermaid diagrams using `node "${CLAUDE_PLUGIN_ROOT}/scripts/mermaid-helper.mjs"`.
- Both rendered SVG paths AND raw Mermaid code blocks are included in the output.
- The final output must follow the ADR template exactly.
- Do NOT implement the decision. Only document it.
