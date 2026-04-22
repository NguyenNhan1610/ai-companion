#!/bin/bash
# PostToolUse hook: logs file changes to .project/cascades/{branch}.md
# Format: - [HH:MM:SS] ACTION `filepath` L{start}-{end}

set -euo pipefail

input=$(cat)

tool_name=$(echo "$input" | jq -r '.tool_name // empty')
cwd=$(echo "$input" | jq -r '.cwd // empty')

[ -z "$tool_name" ] && { echo '{}'; exit 0; }
[ -z "$cwd" ] && { echo '{}'; exit 0; }

# Get git root and branch name — use git root (not cwd) so cascades always
# land in the project root, even when subagents set cwd to a subdirectory.
git_root=$(cd "$cwd" && git rev-parse --show-toplevel 2>/dev/null || echo "")
[ -z "$git_root" ] && { echo '{}'; exit 0; }

branch=$(cd "$cwd" && git branch --show-current 2>/dev/null || echo "detached")
[ -z "$branch" ] && branch="detached"

# Sanitize branch for filename
safe_branch=$(echo "$branch" | sed 's/[^a-zA-Z0-9._-]/-/g')

# Detect agent context — subagents get their own subfolder under cascades/
agent_type=$(echo "$input" | jq -r '.agent_type // .subagent_type // empty')
if [ -n "$agent_type" ]; then
  # Sanitize agent type for directory name
  safe_agent=$(echo "$agent_type" | sed 's/[^a-zA-Z0-9._-]/-/g')
  cascade_dir="$git_root/.project/cascades/$safe_agent"
else
  cascade_dir="$git_root/.project/cascades"
fi
cascade_file="$cascade_dir/$safe_branch.md"

# Timestamp
ts=$(date '+%H:%M:%S')

action=""
file_path=""
detail=""
line_info=""

case "$tool_name" in
  Edit)
    file_path=$(echo "$input" | jq -r '.tool_input.file_path // empty')
    action="EDIT"
    # Compute line info by locating the first line of new_string in the
    # post-edit file. PostToolUse fires AFTER the edit, so old_string has
    # been replaced and is no longer in the file — searching for old_string
    # silently fails. new_string was just written, so it's guaranteed to
    # be present (modulo collisions with pre-existing identical content,
    # in which case grep picks the earliest match, which is still usually
    # the edit site).
    new_string_file=$(mktemp)
    echo "$input" | jq -r '.tool_input.new_string // empty' > "$new_string_file"
    if [ -s "$new_string_file" ] && [ -n "$file_path" ] && [ -f "$file_path" ]; then
      line_count=$(wc -l < "$new_string_file")
      [ -n "$(tail -c 1 "$new_string_file")" ] && line_count=$((line_count + 1))
      first_line=$(head -1 "$new_string_file")
      if [ -n "$first_line" ]; then
        line_start=$(grep -nF -- "$first_line" "$file_path" 2>/dev/null | head -1 | cut -d: -f1 || true)
        if [ -n "$line_start" ]; then
          line_end=$((line_start + line_count - 1))
          if [ "$line_start" -eq "$line_end" ]; then
            line_info=" L${line_start}"
          else
            line_info=" L${line_start}-${line_end}"
          fi
        fi
      fi
    fi
    rm -f "$new_string_file"
    ;;
  MultiEdit)
    file_path=$(echo "$input" | jq -r '.tool_input.file_path // empty')
    action="EDIT"
    # For MultiEdit, locate the first edit's new_string in the post-edit
    # file. The report uses a trailing + to signal multiple edits: L123+
    new_string_file=$(mktemp)
    echo "$input" | jq -r '.tool_input.edits[0].new_string // empty' > "$new_string_file"
    if [ -s "$new_string_file" ] && [ -n "$file_path" ] && [ -f "$file_path" ]; then
      first_line=$(head -1 "$new_string_file")
      if [ -n "$first_line" ]; then
        line_start=$(grep -nF -- "$first_line" "$file_path" 2>/dev/null | head -1 | cut -d: -f1 || true)
        if [ -n "$line_start" ]; then
          edit_count=$(echo "$input" | jq -r '(.tool_input.edits // []) | length')
          if [ "${edit_count:-0}" -gt 1 ]; then
            line_info=" L${line_start}+"
          else
            line_info=" L${line_start}"
          fi
        fi
      fi
    fi
    rm -f "$new_string_file"
    ;;
  Write)
    file_path=$(echo "$input" | jq -r '.tool_input.file_path // empty')
    action="CREATE"
    if [ -n "$file_path" ] && [ -f "$file_path" ]; then
      total_lines=$(wc -l < "$file_path" 2>/dev/null || echo 0)
      # wc -l undercounts if the file has no trailing newline
      [ -n "$(tail -c 1 "$file_path" 2>/dev/null)" ] && total_lines=$((total_lines + 1))
      if [ "${total_lines:-0}" -gt 0 ]; then
        line_info=" L1-${total_lines}"
      fi
    fi
    ;;
  Bash)
    cmd=$(echo "$input" | jq -r '.tool_input.command // empty')
    if echo "$cmd" | grep -qE '(^|\s)(rm|unlink|git\s+rm)\s'; then
      action="REMOVE"
      file_path=$(echo "$cmd" | grep -oP '(?:rm|unlink|git\s+rm)\s+(?:-[a-zA-Z]*\s+)*\K[^\s;|&]+' | head -1 || true)
    elif echo "$cmd" | grep -qE '(^|\s)mv\s'; then
      action="MOVE"
      file_path=$(echo "$cmd" | grep -oP 'mv\s+(?:-[a-zA-Z]*\s+)*\K[^\s;|&]+' | head -1 || true)
      dest=$(echo "$cmd" | grep -oP 'mv\s+(?:-[a-zA-Z]*\s+)*[^\s;|&]+\s+\K[^\s;|&]+' | head -1 || true)
      [ -n "$dest" ] && detail=" -> \`$dest\`"
    fi
    ;;
esac

# Nothing to log
[ -z "$action" ] || [ -z "$file_path" ] && { echo '{}'; exit 0; }

# Skip self-logging
case "$file_path" in
  */.project/cascades/*) echo '{}'; exit 0 ;;
esac

# Make path relative to git root (not cwd) for consistent cascade entries
if [[ "$file_path" == "$git_root/"* ]]; then
  rel_path="${file_path#"$git_root/"}"
elif [[ "$file_path" == /* ]]; then
  rel_path=$(python3 -c "import os.path; print(os.path.relpath('$file_path', '$git_root'))" 2>/dev/null || echo "$file_path")
else
  # file_path is already relative — make it relative to git root via cwd
  abs_path="$cwd/$file_path"
  if [[ "$abs_path" == "$git_root/"* ]]; then
    rel_path="${abs_path#"$git_root/"}"
  else
    rel_path="$file_path"
  fi
fi

# Ensure cascade directory exists
mkdir -p "$cascade_dir"

# Create file with header if new
if [ ! -f "$cascade_file" ]; then
  echo "# Cascade: $branch" > "$cascade_file"
  echo "" >> "$cascade_file"
fi

# Append entry with timestamp and line info
echo "- [$ts] $action \`$rel_path\`${line_info}${detail}" >> "$cascade_file"

# Silent success
echo '{}'
exit 0
