---
description: Run a full codebase AI review, optionally focused on a specific aspect
argument-hint: '[--model <provider:model>] [--wait|--background] [language[/techstack]:aspect]'
allowed-tools: Read, Glob, Grep, Bash(node:*), Bash(git:*), AskUserQuestion
---

Run a full codebase review through the shared plugin runtime.
Reviews the entire codebase (not just diffs). Optionally filter by aspect (security, performance, architecture, antipatterns) and/or language/techstack.
The provider (Codex, Claude) is selected via `--model provider:model` or the default from config. For full codebase reviews `--model claude:max` (Opus with 1M context) is recommended for best results.

Raw slash-command arguments:
`$ARGUMENTS`

Core constraint:
- This command is review-only.
- Do not fix issues, apply patches, or suggest that you are about to make changes.
- Your only job is to run the review and return the output verbatim to the user.

Execution mode rules:
- If the raw arguments include `--wait`, do not ask. Run the review in the foreground.
- If the raw arguments include `--background`, do not ask. Run the review in a Claude background task.
- Otherwise, always recommend background (full codebase reviews are large and take significant time).
- Then use `AskUserQuestion` exactly once with two options, putting the recommended option first and suffixing its label with `(Recommended)`:
  - `Run in background`
  - `Wait for results`

Argument handling:
- Preserve the user's arguments exactly.
- Do not strip `--wait` or `--background` yourself.
- Do not add extra review instructions or rewrite the user's intent.
- `/ai:review` accepts an optional aspect specifier as the first positional argument.
- Valid aspects: `security`, `performance`, `architecture`, `antipatterns`
- Aspect format: `aspect` or `language:aspect` or `language/techstack:aspect`
  - Examples: `security`, `python:performance`, `python/fastapi:security`, `typescript/nextjs:architecture`
- When an aspect is provided, the review uses a dedicated prompt template for that aspect.
- When no aspect is provided, the review does a comprehensive general sweep.
- This command does not support `--base` or `--scope` — it always reviews the full codebase. For diff-based reviews, use `/ai:git-review` or `/ai:finding-review`.

Foreground flow:
- Run:
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/ai-companion.mjs" review "$ARGUMENTS"
```
- Return the command stdout verbatim, exactly as-is.
- Do not paraphrase, summarize, or add commentary before or after it.
- Do not fix any issues mentioned in the review output.

Background flow:
- Launch the review with `Bash` in the background:
```typescript
Bash({
  command: `node "${CLAUDE_PLUGIN_ROOT}/scripts/ai-companion.mjs" review "$ARGUMENTS"`,
  description: "AI codebase review",
  run_in_background: true
})
```
- Do not call `BashOutput` or wait for completion in this turn.
- After launching the command, tell the user: "Codebase review started in the background. Check `/ai:status` for progress."
