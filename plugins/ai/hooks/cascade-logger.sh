#!/bin/bash
# PostToolUse hook: logs file changes to .claude/cascades/{branch}.md
# Runs silently after Edit, Write, MultiEdit, and Bash tool uses.

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

action=""
file_path=""
detail=""

case "$tool_name" in
  Edit)
    file_path=$(echo "$input" | jq -r '.tool_input.file_path // empty')
    action="EDIT"
    ;;
  MultiEdit)
    file_path=$(echo "$input" | jq -r '.tool_input.file_path // empty')
    action="EDIT"
    ;;
  Write)
    file_path=$(echo "$input" | jq -r '.tool_input.file_path // empty')
    # Check if file existed before this write (tool_result may indicate)
    if echo "$input" | jq -e '.tool_input.content' >/dev/null 2>&1; then
      action="CREATE"
    fi
    ;;
  Bash)
    cmd=$(echo "$input" | jq -r '.tool_input.command // empty')
    # Detect file removal
    if echo "$cmd" | grep -qE '(^|\s)(rm|unlink|git\s+rm)\s'; then
      action="REMOVE"
      # Try to extract file path from rm command
      file_path=$(echo "$cmd" | grep -oP '(?:rm|unlink|git\s+rm)\s+(?:-[a-zA-Z]*\s+)*\K[^\s;|&]+' | head -1 || true)
    # Detect file move/rename
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

# Make path relative to cwd if absolute
if [[ "$file_path" == /* ]]; then
  rel_path=$(realpath --relative-to="$cwd" "$file_path" 2>/dev/null || echo "$file_path")
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

# Append entry
echo "- $action \`$rel_path\`$detail" >> "$cascade_file"

# Silent success
echo '{}'
exit 0
