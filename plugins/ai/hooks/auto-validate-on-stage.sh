#!/bin/bash
# SubagentStop hook: auto-validate a newly written planning document
# against its upstream document. Fires after any subagent stops and
# checks the cascade log for Write entries targeting planning doc paths.
#
# Emits a blocking systemMessage that tells the assistant to spawn the
# auto-validate agent. Re-entry is guarded by stop_hook_active.

set -euo pipefail

input=$(cat)
cwd=$(echo "$input" | jq -r '.cwd // empty')
stop_hook_active=$(echo "$input" | jq -r '.stop_hook_active // false')

# Re-entry guard: if the auto-validate agent itself just stopped,
# don't trigger another round of validation.
[ "$stop_hook_active" = "true" ] && { echo '{}'; exit 0; }

[ -z "$cwd" ] && { echo '{}'; exit 0; }
[ ! -d "$cwd" ] && { echo '{}'; exit 0; }

# Anchor on the git repo root.
project_root=$(cd "$cwd" && git rev-parse --show-toplevel 2>/dev/null || true)
[ -z "$project_root" ] && project_root="$cwd"
cwd="$project_root"

# Locate the cascade log for the current branch.
branch=$(cd "$cwd" && git branch --show-current 2>/dev/null || echo "detached")
[ -z "$branch" ] && branch="detached"
safe_branch=$(echo "$branch" | sed 's/[^a-zA-Z0-9._-]/-/g')

cascade_file="$cwd/.claude/cascades/$safe_branch.md"

# No cascade = nothing to check.
[ ! -f "$cascade_file" ] && { echo '{}'; exit 0; }

# Extract the last session segment (entries after the most recent "## [" header).
last_segment=$(tac "$cascade_file" | sed '/^## \[/q' | tac) || true

# Scan for Write entries that target planning document paths.
# Planning doc patterns:
#   .claude/project/fdr/FDR-*.md
#   .claude/project/adr/ADR-*.md
#   .claude/project/test_plans/TP-*.md
#   .claude/project/implementation_plans/IMPL-*.md
#   .claude/project/todos/TODO-*.yaml
#
# Exclude validation reports — don't self-trigger.
planning_docs=()
seen=""

while IFS= read -r line; do
  filepath=$(echo "$line" | grep -oP '`\K[^`]+' | head -1 || true)
  [ -z "$filepath" ] && continue

  # Only match planning document paths.
  case "$filepath" in
    .claude/project/fdr/FDR-*.md) ;;
    .claude/project/test_plans/TP-*.md) ;;
    .claude/project/implementation_plans/IMPL-*.md) ;;
    .claude/project/todos/TODO-*.yaml) ;;
    *) continue ;;
  esac

  # Skip ADR (top of chain, nothing to validate against).
  # Skip validation reports (don't self-trigger).
  case "$filepath" in
    .claude/project/adr/*) continue ;;
    .claude/project/validations/*) continue ;;
  esac

  # Must be a WRITE entry (not just a Read reference).
  case "$line" in
    *WRITE*|*CREATE*|*write*|*create*) ;;
    *) continue ;;
  esac

  # File must exist.
  [ ! -f "$cwd/$filepath" ] && continue

  # Deduplicate.
  case " $seen " in
    *" $filepath "*) continue ;;
  esac
  seen="$seen $filepath"
  planning_docs+=("$filepath")
done <<< "$last_segment"

# No planning docs written = nothing to validate.
[ ${#planning_docs[@]} -eq 0 ] && { echo '{}'; exit 0; }

# Build the list of docs to validate.
doc_list=$(printf -- "- \`%s\`\n" "${planning_docs[@]}")

message="A planning document was just written. Run auto-validation against its upstream.

Documents to validate:
${doc_list}

Spawn the \`ai:auto-validate\` agent with the file path(s) above. The agent will:
1. Read each document's header to find its upstream reference
2. Skip if upstream is \"\u2014\" (lite flow) or doesn't exist
3. Run a brief pairwise coverage check
4. Report an inline PASS/PARTIAL/FAIL verdict

Do NOT write a full VAL report \u2014 just report the brief verdict and suggest \`/ai:validate\` for the full report if gaps are found."

payload=$(jq -n --arg reason "$message" '{decision: "block", reason: $reason}')
echo "$payload"
exit 0
