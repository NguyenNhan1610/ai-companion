#!/bin/bash
# PostToolUse hook: logs file changes to .claude/cascades/{branch}.md
# Format: - [HH:MM:SS] ACTION `filepath` L{start}-{end}

set -euo pipefail

input=$(cat)

tool_name=$(echo "$input" | jq -r '.tool_name // empty')
cwd=$(echo "$input" | jq -r '.cwd // empty')

[ -z "$tool_name" ] && { echo '{}'; exit 0; }
[ -z "$cwd" ] && { echo '{}'; exit 0; }

# Get branch name
branch=$(cd "$cwd" && git branch --show-current 2>/dev/null || echo "detached")
[ -z "$branch" ] && branch="detached"

# Sanitize branch for filename
safe_branch=$(echo "$branch" | sed 's/[^a-zA-Z0-9._-]/-/g')

cascade_dir="$cwd/.claude/cascades"
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
    # Try to find line number from old_string
    # Extract old_string to a temp file to preserve multi-line content
    old_string_file=$(mktemp)
    echo "$input" | jq -r '.tool_input.old_string // empty' > "$old_string_file"
    if [ -s "$old_string_file" ] && [ -n "$file_path" ] && [ -f "$file_path" ]; then
      # Count lines in old_string
      line_count=$(wc -l < "$old_string_file")
      # Add 1 if file doesn't end with newline (wc -l undercounts)
      [ -n "$(tail -c 1 "$old_string_file")" ] && line_count=$((line_count + 1))
      # Get first line for grep matching
      first_line=$(head -1 "$old_string_file")
      if [ -n "$first_line" ]; then
        line_start=$(grep -nF "$first_line" "$file_path" 2>/dev/null | head -1 | cut -d: -f1 || true)
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
    rm -f "$old_string_file"
    ;;
  MultiEdit)
    file_path=$(echo "$input" | jq -r '.tool_input.file_path // empty')
    action="EDIT"
    ;;
  Write)
    file_path=$(echo "$input" | jq -r '.tool_input.file_path // empty')
    action="CREATE"
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
  */.claude/cascades/*) echo '{}'; exit 0 ;;
esac

# Make path relative to cwd
if [[ "$file_path" == "$cwd/"* ]]; then
  rel_path="${file_path#"$cwd/"}"
elif [[ "$file_path" == /* ]]; then
  rel_path=$(python3 -c "import os.path; print(os.path.relpath('$file_path', '$cwd'))" 2>/dev/null || echo "$file_path")
else
  rel_path="$file_path"
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
