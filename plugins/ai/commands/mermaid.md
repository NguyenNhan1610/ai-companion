---
description: Validate Mermaid.js diagram syntax from inline content
argument-hint: 'validate <mermaid content>'
allowed-tools: Bash(node:*), Bash(mmdc:*), Read
---

Validate a Mermaid.js diagram. Rendering is no longer supported — this command only checks syntax.

Raw slash-command arguments:
`$ARGUMENTS`

Subcommand:
- `validate <content>` — check Mermaid syntax and report errors

Content is inline Mermaid text passed as positional arguments.

Execution:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/mermaid-helper.mjs" $ARGUMENTS
```

Return the command output verbatim.

If mmdc is not installed, tell the user to run `/ai:setup --install-mermaid`.
