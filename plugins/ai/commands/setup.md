---
description: Check whether the AI backend CLI is ready and optionally init project, toggle review gate, install coding rules, or install Mermaid.js
argument-hint: '[--init] [--init --ui] [--provider codex|copilot|claude] [--enable-review-gate|--disable-review-gate] [--install-rules ...] [--install-mermaid] [--install-statusline] [--install-proxy]'
allowed-tools: Bash(node:*), Bash(npm:*), AskUserQuestion
---

Run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/ai-companion.mjs" setup --json $ARGUMENTS
```

Use `--provider codex`, `--provider copilot`, or `--provider claude` to check a specific backend. Without `--provider`, the default provider from config is checked.

If the result says the backend is unavailable and npm is available:
- For Codex: use `AskUserQuestion` to ask whether Claude should install Codex now via `npm install -g @openai/codex`.
- For Copilot: tell the user to install from https://docs.github.com/copilot/how-tos/copilot-cli
- For Claude: tell the user to install Claude Code from https://claude.com/claude-code

If the backend is installed but not authenticated:
- For Codex: preserve the guidance to run `!codex login`.
- For Copilot: preserve the guidance to run `!copilot login`.
- For Claude: tell the user to launch `!claude` interactively once to sign in (credentials are stored in `~/.claude`).

If `--install-rules` is provided:
- Copies bundled coding rules into the project's `.claude/rules/` directory.
- Accepts comma-separated specifiers: `python`, `fastapi`, `django`, `typescript`, `nextjs`
- Techstack specifiers (fastapi, django, nextjs) include the base language rules automatically.
- Skips files that already exist in the target directory.
- Examples:
  - `--install-rules fastapi` — installs FastAPI + Python rules
  - `--install-rules nextjs` — installs Next.js + TypeScript rules
  - `--install-rules fastapi,nextjs` — installs both stacks

If `--install-statusline` is provided:
- Writes the `statusLine` config to `~/.claude/settings.json` pointing at the plugin's `statusline-handler.mjs`.
- The handler reads native token metrics (input, output, cache creation, cache read) and session metrics (cost, duration, lines) from Claude Code's stdin contract.
- User must restart Claude Code after installation.

If `--install-proxy` is provided:
- Starts a reverse proxy between Claude Code and api.anthropic.com for API telemetry.
- Logs all requests/responses to `.claude/proxy-logs/` as daily JSONL files.
- Sets `ANTHROPIC_BASE_URL` to route traffic through the proxy.
- Use `/ai:status --proxy` to view live metrics (cache hit%, quota burn, cost).
- The proxy is pure passthrough — it does NOT modify requests or responses.

Output rules:
- Present the final setup output to the user.
