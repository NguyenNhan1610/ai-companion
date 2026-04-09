#!/bin/bash
# UserPromptSubmit hook: adds user prompt separators with signal tags to cascade log
# Tags: [NEW] [REVISION] [ACCEPTED] [CONTINUE] [QUESTION] [INCOMPLETE]
# Captures full prompt text in blockquote for handoff analysis

set -euo pipefail

input=$(cat)

user_prompt=$(echo "$input" | jq -r '.user_prompt // empty')
cwd=$(echo "$input" | jq -r '.cwd // empty')

[ -z "$user_prompt" ] && { echo '{}'; exit 0; }
[ -z "$cwd" ] && { echo '{}'; exit 0; }

# Skip very short prompts (likely just "y" or "ok" or single char)
prompt_len=${#user_prompt}
[ "$prompt_len" -lt 5 ] && { echo '{}'; exit 0; }

# Detect signal tag from prompt content
prompt_lower=$(echo "$user_prompt" | tr '[:upper:]' '[:lower:]')
tag="[NEW]"

# Check satisfaction signals (order matters — most specific first)
if echo "$prompt_lower" | grep -qE '(^(no|wrong|not what|doesn.t work|broken|fail|bug|error|missing|incomplete|still |why (isn.t|doesn.t|won.t|can.t))|fix (it|this|the)|that.s (wrong|not|incorrect)|doesn.t (handle|work|support)|not (right|correct|working))'; then
  tag="[REVISION]"
elif echo "$prompt_lower" | grep -qE '(^(good|great|perfect|nice|thanks|thank you|looks good|lgtm|approved|ship it|yes,? (that|this)|exactly|correct)|well done|that.s (right|correct|good|better|what i))'; then
  tag="[ACCEPTED]"
elif echo "$prompt_lower" | grep -qE '(^(continue|keep going|go on|resume|more|next step|carry on|proceed)|keep (going|working))'; then
  tag="[CONTINUE]"
elif echo "$prompt_lower" | grep -qE '(^(why|how|what|where|when|which|can you explain|tell me|show me|describe)|.+\?$)'; then
  tag="[QUESTION]"
elif echo "$prompt_lower" | grep -qE '(^(now |also |add |create |implement |build |make |update |change |move |remove |delete |refactor |extract ))'; then
  tag="[NEW]"
fi

# Get branch name
branch=$(cd "$cwd" && git branch --show-current 2>/dev/null || echo "detached")
[ -z "$branch" ] && branch="detached"

safe_branch=$(echo "$branch" | sed 's/[^a-zA-Z0-9._-]/-/g')

cascade_dir="$cwd/.claude/cascades"
cascade_file="$cascade_dir/$safe_branch.md"

ts=$(date '+%H:%M:%S')

# Truncate for header line (first line, max 120 chars)
truncated=$(echo "$user_prompt" | head -1 | cut -c1-120)
[ ${#user_prompt} -gt 120 ] && truncated="${truncated}..."

# Ensure cascade directory exists
mkdir -p "$cascade_dir"

# Create file with header if new
if [ ! -f "$cascade_file" ]; then
  echo "# Cascade: $branch" > "$cascade_file"
fi

# Append prompt separator with tag
echo "" >> "$cascade_file"
echo "## [$ts] $tag User: $truncated" >> "$cascade_file"

# Append full prompt as blockquote (for handoff analysis)
echo "" >> "$cascade_file"
echo "$user_prompt" | while IFS= read -r line; do
  echo "> $line" >> "$cascade_file"
done
echo "" >> "$cascade_file"

echo '{}'
exit 0
