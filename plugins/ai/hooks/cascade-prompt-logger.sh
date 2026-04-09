#!/bin/bash
# UserPromptSubmit hook: adds user prompt separators to cascade log
# Creates session segments for grouping changes by user request

set -euo pipefail

input=$(cat)

user_prompt=$(echo "$input" | jq -r '.user_prompt // empty')
cwd=$(echo "$input" | jq -r '.cwd // empty')

[ -z "$user_prompt" ] && { echo '{}'; exit 0; }
[ -z "$cwd" ] && { echo '{}'; exit 0; }

# Skip very short prompts (likely just "y" or "ok")
prompt_len=${#user_prompt}
[ "$prompt_len" -lt 5 ] && { echo '{}'; exit 0; }

# Get branch name
branch=$(cd "$cwd" && git branch --show-current 2>/dev/null || echo "detached")
[ -z "$branch" ] && branch="detached"

safe_branch=$(echo "$branch" | sed 's/[^a-zA-Z0-9._-]/-/g')

cascade_dir="$cwd/.claude/cascades"
cascade_file="$cascade_dir/$safe_branch.md"

ts=$(date '+%H:%M:%S')

# Truncate long prompts for the header (keep first 120 chars)
truncated=$(echo "$user_prompt" | head -1 | cut -c1-120)
[ ${#user_prompt} -gt 120 ] && truncated="${truncated}..."

# Ensure cascade directory exists
mkdir -p "$cascade_dir"

# Create file with header if new
if [ ! -f "$cascade_file" ]; then
  echo "# Cascade: $branch" > "$cascade_file"
fi

# Append prompt separator
echo "" >> "$cascade_file"
echo "## [$ts] User: $truncated" >> "$cascade_file"
echo "" >> "$cascade_file"

echo '{}'
exit 0
