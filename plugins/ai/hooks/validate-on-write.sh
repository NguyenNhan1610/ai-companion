#!/bin/bash
# PostToolUse hook on Write: validates planning documents against upstream.
# Creates a feedback loop — blocks the Write with specific gap feedback
# so the planning agent revises until coverage passes.
# Max 3 attempts before approving with a warning.

set -euo pipefail

input=$(cat)
tool_name=$(echo "$input" | jq -r '.tool_name // empty')
file_path=$(echo "$input" | jq -r '.tool_input.file_path // empty')

# Fast exit: only interested in Write
[ "$tool_name" != "Write" ] && { echo '{}'; exit 0; }
[ -z "$file_path" ] && { echo '{}'; exit 0; }

# Fast exit: only planning documents
doc_type=""
id_prefix=""
case "$file_path" in
  */.claude/project/fdr/FDR-*.md)                    doc_type="fdr";  id_prefix="FDR"  ;;
  */.claude/project/test_plans/TP-*.md)               doc_type="tp";   id_prefix="TP"   ;;
  */.claude/project/implementation_plans/IMPL-*.md)   doc_type="impl"; id_prefix="IMPL" ;;
  */.claude/project/todos/TODO-*.yaml)                doc_type="todo"; id_prefix="TODO" ;;
  *) echo '{}'; exit 0 ;;
esac

[ ! -f "$file_path" ] && { echo '{}'; exit 0; }

# Extract document ID from filename
doc_id=$(basename "$file_path" | grep -oP "${id_prefix}-\d+" | head -1 || true)
[ -z "$doc_id" ] && { echo '{}'; exit 0; }

# --- Iteration tracking (max 3 attempts) ---
attempt_key=$(echo "$file_path" | md5sum | cut -d' ' -f1)
attempt_file="/tmp/.claude-validate-${attempt_key}"
attempt=1
if [ -f "$attempt_file" ]; then
  stored=$(cat "$attempt_file" 2>/dev/null || echo "0")
  attempt=$((stored + 1))
fi

if [ "$attempt" -gt 3 ]; then
  rm -f "$attempt_file"
  echo '{}'; exit 0
fi

# --- Locate project root and upstream ---
project_root=$(echo "$file_path" | grep -oP '^.*(?=/\.claude/project/)' || true)
[ -z "$project_root" ] && { echo '{}'; exit 0; }

# Map doc type to upstream type and header field
upstream_type=""
header_pattern=""
upstream_id_pattern=""
case "$doc_type" in
  fdr)  upstream_type="adr";  header_pattern="Source ADR:";   upstream_id_pattern='AAC-[0-9]+'  ;;
  tp)   upstream_type="fdr";  header_pattern="Source FDR:";   upstream_id_pattern='FAC-[0-9]+'  ;;
  impl) upstream_type="fdr";  header_pattern="Source:";       upstream_id_pattern='FAC-[0-9]+'  ;;
  todo) upstream_type="impl"; header_pattern="source_impl:";  upstream_id_pattern='T[0-9]{2,}'  ;;
esac

# Extract upstream reference from document header (first 40 lines)
upstream_ref=$(head -40 "$file_path" | grep -i "$header_pattern" | head -1 \
  | sed "s/.*${header_pattern}[[:space:]]*//" | tr -d '`' | xargs 2>/dev/null || true)

# Skip if no upstream (lite flow, top of chain)
case "$upstream_ref" in
  ""|"—"|"-"|"N/A"|"n/a"|"none"|"None")
    rm -f "$attempt_file"
    echo '{}'; exit 0 ;;
esac

# Extract upstream ID from reference (handles both "ADR-02" and full paths)
upstream_id=$(echo "$upstream_ref" | grep -oP '(ADR|FDR|TP|IMPL)-[0-9]+' | head -1 || true)
[ -z "$upstream_id" ] && { rm -f "$attempt_file"; echo '{}'; exit 0; }

# Find upstream file by globbing
upstream_dir=""
case "$upstream_type" in
  adr)  upstream_dir="$project_root/.claude/project/adr" ;;
  fdr)  upstream_dir="$project_root/.claude/project/fdr" ;;
  tp)   upstream_dir="$project_root/.claude/project/test_plans" ;;
  impl) upstream_dir="$project_root/.claude/project/implementation_plans" ;;
esac

upstream_file=""
if [ -n "$upstream_dir" ] && [ -d "$upstream_dir" ]; then
  upstream_file=$(find "$upstream_dir" -maxdepth 1 -name "${upstream_id}*" -type f 2>/dev/null | head -1 || true)
fi
[ -z "$upstream_file" ] || [ ! -f "$upstream_file" ] && { rm -f "$attempt_file"; echo '{}'; exit 0; }

# --- Cross-reference check ---
# Extract upstream item IDs from upstream doc
mapfile -t upstream_ids < <(grep -oP "$upstream_id_pattern" "$upstream_file" | sort -u 2>/dev/null || true)
total=${#upstream_ids[@]}

# No upstream IDs = can't validate structurally, skip
[ "$total" -eq 0 ] && { rm -f "$attempt_file"; echo '{}'; exit 0; }

# Check each upstream ID appears somewhere in the downstream doc
downstream_content=$(cat "$file_path")
missing=()
for uid in "${upstream_ids[@]}"; do
  if ! echo "$downstream_content" | grep -qF "$uid"; then
    # Extract a brief description from the upstream table row
    desc=$(grep -F "$uid" "$upstream_file" | head -1 \
      | sed 's/^[[:space:]]*|[[:space:]]*//' \
      | sed 's/[[:space:]]*|.*//' \
      | head -c 80 || true)
    [ "$desc" = "$uid" ] && desc=""
    if [ -n "$desc" ]; then
      missing+=("${uid} — ${desc}")
    else
      missing+=("${uid}")
    fi
  fi
done

covered=$((total - ${#missing[@]}))

# PASS — all upstream items covered
if [ ${#missing[@]} -eq 0 ]; then
  rm -f "$attempt_file"
  echo '{}'; exit 0
fi

# FAIL — gaps found, record attempt and block
echo "$attempt" > "$attempt_file"
pct=$((covered * 100 / total))

# Build gap list (cap at 8)
gap_list=""
shown=0
for gap in "${missing[@]}"; do
  gap_list="${gap_list}
- ${gap}"
  shown=$((shown + 1))
  if [ "$shown" -ge 8 ] && [ ${#missing[@]} -gt 8 ]; then
    gap_list="${gap_list}
- ... and $((${#missing[@]} - 8)) more"
    break
  fi
done

reason="Auto-validation: ${upstream_id} → ${doc_id} — ${covered}/${total} items covered (${pct}%)
${gap_list}

Revise the document to reference or address these upstream items, then Write the complete file again.
Attempt ${attempt}/3."

jq -n --arg reason "$reason" '{decision: "block", reason: $reason}'
exit 0
