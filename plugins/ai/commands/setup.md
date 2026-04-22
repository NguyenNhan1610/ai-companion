---
description: Check whether the AI backend CLI is ready and optionally init project, toggle review gate, install coding rules, or install Mermaid.js
argument-hint: '[--init] [--init --ui] [--provider codex|claude] [--enable-review-gate|--disable-review-gate] [--install-rules ...] [--engine claude|windsurf|codex|copilot|all] [--install-mermaid] [--install-statusline]'
allowed-tools: Bash(node:*), Bash(npm:*), AskUserQuestion
---

Run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/ai-companion.mjs" setup --json $ARGUMENTS
```

Use `--provider codex` or `--provider claude` to check a specific backend. Without `--provider`, the default provider from config is checked.

If the result says the backend is unavailable and npm is available:
- For Codex: use `AskUserQuestion` to ask whether Claude should install Codex now via `npm install -g @openai/codex`.
- For Claude: tell the user to install Claude Code from https://claude.com/claude-code

If the backend is installed but not authenticated:
- For Codex: preserve the guidance to run `!codex login`.
- For Claude: tell the user to launch `!claude` interactively once to sign in (credentials are stored in `~/.claude`).

If `--install-rules` is provided:
- Installs bundled coding rules for one or more AI coding engines. Default engine is `claude` only.
- Specifiers (comma-separated): `python`, `fastapi`, `django`, `typescript`, `nextjs`. Techstack specifiers pull in the base language rules automatically.
- Engines via `--engine`: `claude` | `windsurf` | `codex` | `copilot` | `all`.

Per-engine output:

| Engine | Target | Shape |
|---|---|---|
| `claude` | `.claude/rules/{stack}/*.md` | One file per topic. Skips existing files. |
| `windsurf` | `.windsurf/rules/*.md` | One file per topic, flat directory. Skips existing. |
| `codex` | `AGENTS.md` at repo root | Single file, contributions wrapped in `<!-- BEGIN ai-companion-rules -->` ... `<!-- END ai-companion-rules -->` markers. Re-running replaces only the marked block. |
| `copilot` | `.github/copilot-instructions.md` | Same marker convention as `codex`. |

Examples:
- `--install-rules fastapi` — FastAPI + Python rules into `.claude/rules/`.
- `--install-rules nextjs --engine windsurf` — Next.js + TypeScript rules into `.windsurf/rules/`.
- `--install-rules fastapi,nextjs --engine all` — all stacks into all four engine locations.

If `--install-statusline` is provided:
- Writes the `statusLine` config to `~/.claude/settings.json` pointing at the plugin's `statusline-handler.mjs`.
- The handler reads native token metrics (input, output, cache creation, cache read) and session metrics (cost, duration, lines) from Claude Code's stdin contract.
- User must restart Claude Code after installation.

Output rules:
- Present the final setup output to the user.
