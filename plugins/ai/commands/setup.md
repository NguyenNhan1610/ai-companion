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
- Use `/ai:status --proxy` to view live metrics (cache hit%, quota burn, cost).
- The proxy is pure passthrough — it does NOT modify requests or responses.
- **IMPORTANT — Activate routing:** After the proxy starts, you MUST also write `ANTHROPIC_BASE_URL` into `~/.claude/settings.json` so Claude Code routes traffic through the proxy. Read the current settings, add/update the `env` object with `ANTHROPIC_BASE_URL`, and write it back:
  ```bash
  node -e "
    const fs = require('fs');
    const p = require('path').join(process.env.HOME || '/root', '.claude', 'settings.json');
    let s = {}; try { s = JSON.parse(fs.readFileSync(p, 'utf8')); } catch {}
    s.env = s.env || {};
    s.env.ANTHROPIC_BASE_URL = 'http://127.0.0.1:{PORT}';
    fs.writeFileSync(p, JSON.stringify(s, null, 2) + '\n');
    console.log('Set ANTHROPIC_BASE_URL in', p);
  "
  ```
  Replace `{PORT}` with the `port` value from the JSON result.
- Then tell the user: "Proxy is running. **Restart Claude Code** (`/exit` then relaunch) to activate API routing through the proxy. On restart, the statusline will show proxy metrics."
- On subsequent sessions, the SessionStart hook also injects the env var automatically if the proxy process is still alive.

Output rules:
- Present the final setup output to the user.
