#!/bin/bash
# Stop / SubagentStop hook: reminds the assistant to reconcile its work
# against .project/todo-lists/ whenever the last turn touched source
# files outside .claude/** and .claude-plugin/** and not covered by
# .gitignore.
#
# Emits a blocking systemMessage that the assistant sees and can act
# on (by running /ai:todo update) before the turn actually ends.
# Re-entry is guarded by .stop_hook_active in the hook payload.

set -euo pipefail

input=$(cat)
cwd=$(echo "$input" | jq -r '.cwd // empty')
stop_hook_active=$(echo "$input" | jq -r '.stop_hook_active // false')

# Re-entry guard: once we've already nudged and the assistant is
# continuing, let the second Stop succeed without another nudge.
[ "$stop_hook_active" = "true" ] && { echo '{}'; exit 0; }

[ -z "$cwd" ] && { echo '{}'; exit 0; }
[ ! -d "$cwd" ] && { echo '{}'; exit 0; }

# Anchor on the git repo root. Fall back to cwd when not in a repo.
project_root=$(cd "$cwd" && git rev-parse --show-toplevel 2>/dev/null || true)
[ -z "$project_root" ] && project_root="$cwd"
cwd="$project_root"

# Locate the cascade log for the current branch.
branch=$(cd "$cwd" && git branch --show-current 2>/dev/null || echo "detached")
[ -z "$branch" ] && branch="detached"
safe_branch=$(echo "$branch" | sed 's/[^a-zA-Z0-9._-]/-/g')

cascade_file="$cwd/.claude/cascades/$safe_branch.md"

# No cascade = nothing to reconcile.
[ ! -f "$cascade_file" ] && { echo '{}'; exit 0; }

# Scope filter: the TODO-reconciliation nudge is only meaningful when the
# user is actually running an implementation workflow. Scan the recent
# cascade for a user prompt blockquote that invoked /ai:implement,
# /ai:plan, or /ai:implementation-plan. Recent = within the last 500
# lines, which is roughly the last 20 turns of heavy work.
#
# If no such trigger is present, exit silently. No implementation
# workflow = no TODO board to maintain = no nudge.
if ! tail -n 500 "$cascade_file" 2>/dev/null \
    | grep -qE '^>[[:space:]]*/ai:(implement|plan|implementation)'; then
  echo '{}'
  exit 0
fi

# Extract the last session segment (entries after the most recent "## [" header).
last_segment=$(tac "$cascade_file" | sed '/^## \[/q' | tac) || true

cwd_abs=$(cd "$cwd" && pwd -P 2>/dev/null || echo "$cwd")

# Collect unique, non-excluded, non-gitignored file paths.
tracked_files=()
seen=""

while IFS= read -r line; do
  filepath=$(echo "$line" | grep -oP '`\K[^`]+' | head -1 || true)
  [ -z "$filepath" ] && continue

  # Reject absolute paths and any path containing .. segments — cascade
  # entries should always be relative to the git root.
  case "$filepath" in
    /*|*..*) continue ;;
  esac

  # Hard exclude: plugin meta directories. Even if the user edits
  # .project/feature-development-records/FDR-01.md, that's not "source code" — it's
  # AI Companion bookkeeping. Same for .claude-plugin/.
  case "$filepath" in
    .claude/*|.claude-plugin/*) continue ;;
  esac

  full_path="$cwd/$filepath"
  [ ! -f "$full_path" ] && continue

  # Resolved path must live under the repo root.
  resolved=$(cd "$(dirname "$full_path")" 2>/dev/null && pwd -P)/$(basename "$full_path")
  case "$resolved" in
    "$cwd_abs"/*) ;;
    *) continue ;;
  esac

  # Gitignore check via git itself — the authoritative source of what
  # counts as "tracked source code" in this project. Falls back to
  # allowing the file if git isn't available.
  if (cd "$cwd" && git check-ignore -q "$filepath" 2>/dev/null); then
    continue
  fi

  # Deduplicate.
  case " $seen " in
    *" $filepath "*) continue ;;
  esac
  seen="$seen $filepath"
  tracked_files+=("$filepath")
done <<< "$last_segment"

# No tracked source edits → nothing to nudge about.
[ ${#tracked_files[@]} -eq 0 ] && { echo '{}'; exit 0; }

# Cap the displayed file list to keep the hook output well under the
# 16KB limit. Claude Code truncates silently above that.
display_limit=20
total=${#tracked_files[@]}
if [ "$total" -gt "$display_limit" ]; then
  displayed=("${tracked_files[@]:0:$display_limit}")
  extra=$((total - display_limit))
else
  displayed=("${tracked_files[@]}")
  extra=0
fi

file_list=$(printf -- "- \`%s\`\n" "${displayed[@]}")
if [ "$extra" -gt 0 ]; then
  file_list="${file_list}- ... and ${extra} more"
fi

reminder="Before stopping, reconcile your work against \`.project/todo-lists/\`.

Your last turn modified ${total} tracked source file(s):
${file_list}

Action required:
1. Run \`/ai:todo update\` to record progress on ONLY the tasks these edits advanced.
2. Do NOT mark a task you did not actually work on.
3. Do NOT mark a task complete unless its scope is fully covered AND its tests pass.
4. If none of these files map to any existing task, say so in one line and stop — do not invent work.
5. If the TODO already reflects reality, say so in one line and stop — do not touch files needlessly.

When you have finished reconciling (or confirmed no updates are needed), stop normally."

payload=$(jq -n --arg reason "$reminder" '{decision: "block", reason: $reason}')
echo "$payload"
exit 0
