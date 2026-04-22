#!/bin/bash
# SubagentStop hook: advisory-only notice about newly written planning
# documents. Fires after any subagent stops and checks the cascade log
# for Write entries targeting planning doc paths.
#
# Previously blocked and forced the outer assistant to spawn ai:auto-validate.
# That caused B/C subagents to appear stuck in initial state because the
# forced nested spawn never cleanly resolved the original SubagentStop.
# Now writes an advisory line to stderr and returns an empty decision so
# the subagent call completes normally.

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
planning_docs=()
seen=""

while IFS= read -r line; do
  filepath=$(echo "$line" | grep -oP '`\K[^`]+' | head -1 || true)
  [ -z "$filepath" ] && continue

  case "$filepath" in
    .claude/project/feature-development-records/FDR-*.md) ;;
    .claude/project/test-plans/TP-*.md) ;;
    .claude/project/implementation-plans/IMPL-*.md) ;;
    .claude/project/todo-lists/TODO-*.yaml) ;;
    *) continue ;;
  esac

  case "$filepath" in
    .claude/project/architecture-decision-records/*) continue ;;
    .claude/project/validation-reports/*) continue ;;
  esac

  case "$line" in
    *WRITE*|*CREATE*|*write*|*create*) ;;
    *) continue ;;
  esac

  [ ! -f "$cwd/$filepath" ] && continue

  case " $seen " in
    *" $filepath "*) continue ;;
  esac
  seen="$seen $filepath"
  planning_docs+=("$filepath")
done <<< "$last_segment"

[ ${#planning_docs[@]} -eq 0 ] && { echo '{}'; exit 0; }

# Advisory notice only — log to stderr, do not block.
{
  printf 'auto-validate-on-stage: planning document(s) written; run /ai:validate for coverage verification:\n'
  printf -- "- %s\n" "${planning_docs[@]}"
} >&2

echo '{}'
exit 0
