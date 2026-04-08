---
description: Validate and render Mermaid.js diagrams from inline content
argument-hint: 'validate|render [--format svg|png] [-o output] <mermaid content>'
allowed-tools: Bash(node:*), Bash(mmdc:*), Read, AskUserQuestion
---

Validate or render a Mermaid.js diagram.

Raw slash-command arguments:
`$ARGUMENTS`

Subcommands:
- `validate <content>` — check Mermaid syntax and report errors
- `render <content>` — render to SVG (default) and save to file
- `render --format png <content>` — render to PNG
- `render -o path/to/output.svg <content>` — render to specific output path

Content is inline Mermaid text passed as positional arguments.

Execution:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/mermaid-helper.mjs" $ARGUMENTS
```

Return the command output verbatim. For render results, also tell the user the output file path.

If mmdc is not installed, tell the user to run `/ai:setup --install-mermaid`.
