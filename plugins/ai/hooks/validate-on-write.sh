#!/bin/bash
# PostToolUse hook on Write: advisory-only coverage check for planning documents.
#
# Previously blocked planning-doc Writes with `decision: block` to force the
# planning agent into a revise-and-retry loop (up to 3 attempts). That cascade
# of forced LLM passes made B/C commands look stuck in initial state for
# several minutes and sometimes never resolved cleanly.
#
# Now performs the same cross-reference check but only emits a stderr notice.
# Coverage gaps are flagged for the user, not force-corrected by the agent.

set -euo pipefail

input=$(cat)
tool_name=$(echo "$input" | jq -r '.tool_name // empty')
file_path=$(echo "$input" | jq -r '.tool_input.file_path // empty')

[ "$tool_name" != "Write" ] && { echo '{}'; exit 0; }
[ -z "$file_path" ] && { echo '{}'; exit 0; }

doc_type=""
id_prefix=""
case "$file_path" in
  */.claude/project/feature-development-records/FDR-*.md)                     doc_type="fdr";  id_prefix="FDR"  ;;
  */.claude/project/test-plans/TP-*.md)               doc_type="tp";   id_prefix="TP"   ;;
  */.claude/project/implementation-plans/IMPL-*.md)   doc_type="impl"; id_prefix="IMPL" ;;
  */.claude/project/todo-lists/TODO-*.yaml)                doc_type="todo"; id_prefix="TODO" ;;
  *) echo '{}'; exit 0 ;;
esac

[ ! -f "$file_path" ] && { echo '{}'; exit 0; }

doc_id=$(basename "$file_path" | grep -oP "${id_prefix}-\d+" | head -1 || true)
[ -z "$doc_id" ] && { echo '{}'; exit 0; }

project_root=$(echo "$file_path" | grep -oP '^.*(?=/\.claude/project/)' || true)
[ -z "$project_root" ] && { echo '{}'; exit 0; }

upstream_type=""
header_pattern=""
upstream_id_pattern=""
case "$doc_type" in
  fdr)  upstream_type="adr";  header_pattern="Source ADR:";   upstream_id_pattern='AAC-[0-9]+'  ;;
  tp)   upstream_type="fdr";  header_pattern="Source FDR:";   upstream_id_pattern='FAC-[0-9]+'  ;;
  impl) upstream_type="fdr";  header_pattern="Source:";       upstream_id_pattern='FAC-[0-9]+'  ;;
  todo) upstream_type="impl"; header_pattern="source_impl:";  upstream_id_pattern='T[0-9]{2,}'  ;;
esac

upstream_ref=$(head -40 "$file_path" | grep -i "$header_pattern" | head -1 \
  | sed "s/.*${header_pattern}[[:space:]]*//" | tr -d '`' | xargs 2>/dev/null || true)

case "$upstream_ref" in
  ""|"-"|"N/A"|"n/a"|"none"|"None") echo '{}'; exit 0 ;;
esac

upstream_id=$(echo "$upstream_ref" | grep -oP '(ADR|FDR|TP|IMPL)-[0-9]+' | head -1 || true)
[ -z "$upstream_id" ] && { echo '{}'; exit 0; }

upstream_dir=""
case "$upstream_type" in
  adr)  upstream_dir="$project_root/.claude/project/architecture-decision-records" ;;
  fdr)  upstream_dir="$project_root/.claude/project/feature-development-records" ;;
  tp)   upstream_dir="$project_root/.claude/project/test-plans" ;;
  impl) upstream_dir="$project_root/.claude/project/implementation-plans" ;;
esac

upstream_file=""
if [ -n "$upstream_dir" ] && [ -d "$upstream_dir" ]; then
  upstream_file=$(find "$upstream_dir" -maxdepth 1 -name "${upstream_id}*" -type f 2>/dev/null | head -1 || true)
fi
[ -z "$upstream_file" ] || [ ! -f "$upstream_file" ] && { echo '{}'; exit 0; }

mapfile -t upstream_ids < <(grep -oP "$upstream_id_pattern" "$upstream_file" | sort -u 2>/dev/null || true)
total=${#upstream_ids[@]}
[ "$total" -eq 0 ] && { echo '{}'; exit 0; }

downstream_content=$(cat "$file_path")
missing=()
for uid in "${upstream_ids[@]}"; do
  if ! echo "$downstream_content" | grep -qF "$uid"; then
    missing+=("$uid")
  fi
done

[ ${#missing[@]} -eq 0 ] && { echo '{}'; exit 0; }

covered=$((total - ${#missing[@]}))
pct=$((covered * 100 / total))

# Advisory only — stderr notice, do not block the Write.
{
  printf 'validate-on-write: %s -> %s coverage %d/%d (%d%%); missing: %s\n' \
    "$upstream_id" "$doc_id" "$covered" "$total" "$pct" "${missing[*]}"
} >&2

echo '{}'
exit 0
