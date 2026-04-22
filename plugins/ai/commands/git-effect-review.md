---
description: Analyze the downstream risk and impact of a specific git commit on the current codebase
argument-hint: '[--model <provider:model>] [--wait|--background] [commit-hash]'
allowed-tools: Read, Glob, Grep, Bash(node:*), Bash(git:*), AskUserQuestion
---

Run a commit impact analysis through the shared plugin runtime.
Analyzes the effect of a specific commit on the rest of the codebase: breaking changes, regression risk, cascading effects, security exposure, and test gaps.
Default: analyzes the most recent commit (HEAD).
The provider (Codex, Claude) is selected via `--model provider:model` or the default from config.

Raw slash-command arguments:
`$ARGUMENTS`

Core constraint:
- This command is review-only.
- Do not fix issues, apply patches, or suggest that you are about to make changes.
- Your only job is to run the review and return the output verbatim to the user.

Execution mode rules:
- If the raw arguments include `--wait`, do not ask. Run in the foreground.
- If the raw arguments include `--background`, do not ask. Run in a Claude background task.
- Otherwise, always recommend background (impact analysis collects significant context).
- Then use `AskUserQuestion` exactly once with two options, putting the recommended option first and suffixing its label with `(Recommended)`:
  - `Run in background`
  - `Wait for results`

Argument handling:
- Preserve the user's arguments exactly.
- Do not strip `--wait` or `--background` yourself.
- The first positional argument (if present and not a flag) is the commit hash to analyze.
- If no commit hash is provided, the script defaults to HEAD.

Foreground flow:
- Run:
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/ai-companion.mjs" git-effect-review "$ARGUMENTS"
```
- Return the command stdout verbatim, exactly as-is.
- Do not paraphrase, summarize, or add commentary before or after it.
- Do not fix any issues mentioned in the review output.

Background flow:
- Launch the review with `Bash` in the background:
```typescript
Bash({
  command: `node "${CLAUDE_PLUGIN_ROOT}/scripts/ai-companion.mjs" git-effect-review "$ARGUMENTS"`,
  description: "AI git effect review",
  run_in_background: true
})
```
- Do not call `BashOutput` or wait for completion in this turn.
- After launching the command, tell the user: "Git effect review started in the background. Check `/ai:status` for progress."
