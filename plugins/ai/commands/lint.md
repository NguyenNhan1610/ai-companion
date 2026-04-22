---
description: Run batch lint and typecheck on recently changed files. Use when user asks to lint, typecheck, check code quality, run ruff, eslint, pyright, or tsc.
argument-hint: '[--fix] [--all] [file paths...]'
allowed-tools: Bash(node:*), Bash(ruff:*), Bash(eslint:*), Bash(tsc:*), Bash(pyright:*), Bash(python3:*), Read, Glob, AskUserQuestion
---

Run lint and typecheck on files changed in the current session.

Raw slash-command arguments:
`$ARGUMENTS`

Behavior:
- Without args: lint all files from the current cascade (`.project/cascades/{branch}.md`)
- With `--all`: lint all Python and TypeScript files in the project
- With `--fix`: auto-fix what's safe (`ruff check --fix`, `eslint --fix`)
- With file paths: lint only those specific files

Tools to run (in parallel where possible):

**Python files (*.py):**
1. `ruff check --config "${CLAUDE_PLUGIN_ROOT}/lint-configs/ruff.toml"` — lint + security + style
2. `pyright --project "${CLAUDE_PLUGIN_ROOT}/lint-configs/pyrightconfig.json"` — type checking
3. `python3 -m py_compile` — syntax verification

**TypeScript/JS files (*.ts, *.tsx, *.js, *.jsx, *.mjs):**
1. `eslint` — lint + best practices (use project config if exists, otherwise bundled)
2. `tsc --noEmit` — type checking (use project tsconfig if exists, otherwise bundled)

If `--fix` is specified:
- Run `ruff check --fix` for Python
- Run `eslint --fix` for TypeScript/JS
- Report what was auto-fixed

Present results grouped by tool with file:line citations.
If all clean, report "All checks passed" with file count.
