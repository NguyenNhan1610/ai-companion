---
description: Run a multi-agent council discussion that analyzes the codebase from multiple perspectives
argument-hint: '[--model <provider:model>] --roles security,performance,architecture [topic or instruction text]'
allowed-tools: Read, Glob, Grep, Bash(node:*), Bash(git:*), AskUserQuestion
---

Run a multi-agent council through the shared plugin runtime.
Multiple AI agents analyze the codebase independently, then debate each other's findings, and a synthesis agent produces the final verdict.

The provider (Codex, Claude) is selected via `--model provider:model`. Claude tiers: `--model claude:fast` (Haiku, only for trivial councils), `--model claude:code` (Sonnet, the default), `--model claude:max` (Opus with 1M context, recommended for high-stakes synthesis).

Raw slash-command arguments:
`$ARGUMENTS`

Core constraint:
- This command is review-only.
- Do not fix issues, apply patches, or suggest that you are about to make changes.
- Your only job is to run the council and return the output verbatim to the user.

Execution mode rules:
- If the raw arguments include `--wait`, do not ask. Run the council in the foreground.
- If the raw arguments include `--background`, do not ask. Run the council in a Claude background task.
- Otherwise, always recommend background (council runs multiple agents and takes significant time).
- Then use `AskUserQuestion` exactly once with two options, putting the recommended option first and suffixing its label with `(Recommended)`:
  - `Run in background`
  - `Wait for results`

Argument handling:
- Preserve the user's arguments exactly.
- Do not strip `--wait` or `--background` yourself.
- `--roles` accepts comma-separated role names: security, performance, architecture, antipatterns, attacker, defender, judge, or custom freeform roles.
- Default roles if `--roles` is omitted: security,performance,architecture
- Maximum 7 roles.
- Positional text after flags becomes the council topic/instruction.

Foreground flow:
- Run:
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/ai-companion.mjs" council "$ARGUMENTS"
```
- Return the command stdout verbatim, exactly as-is.
- Do not paraphrase, summarize, or add commentary before or after it.
- Do not fix any issues mentioned in the council output.

Background flow:
- Launch the council with `Bash` in the background:
```typescript
Bash({
  command: `node "${CLAUDE_PLUGIN_ROOT}/scripts/ai-companion.mjs" council "$ARGUMENTS"`,
  description: "AI council",
  run_in_background: true
})
```
- Do not call `BashOutput` or wait for completion in this turn.
- After launching the command, tell the user: "Council started in the background. Check `/ai:status` for progress."
