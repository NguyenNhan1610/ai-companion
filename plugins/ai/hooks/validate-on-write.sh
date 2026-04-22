#!/bin/bash
# PostToolUse hook on Write: advisory-only schema + coverage check for
# planning documents using the planning-docs.mjs parser.
#
# Previously blocked with decision:block to force a revise-retry loop.
# That caused B/C commands to appear stuck. Now stderr-advisory only.
#
# Two checks:
#   1. Schema: node planning-docs.mjs validate <file> — fails on missing
#      frontmatter, invalid enums, dangling upstream paths, DAG cycles.
#   2. Coverage: for each declared upstream, check that upstream AC IDs
#      (AAC-NN / FAC-NN / EAC-NN / task-NN) appear somewhere in this doc.

set -euo pipefail

input=$(cat)
tool_name=$(echo "$input" | jq -r '.tool_name // empty')
file_path=$(echo "$input" | jq -r '.tool_input.file_path // empty')

[ "$tool_name" != "Write" ] && { echo '{}'; exit 0; }
[ -z "$file_path" ] && { echo '{}'; exit 0; }

# Only interested in planning docs.
case "$file_path" in
  */.project/architecture-decision-records/ADR-*.md) ;;
  */.project/feature-development-records/FDR-*.md) ;;
  */.project/test-plans/TP-*.md) ;;
  */.project/implementation-plans/IMPL-*.md) ;;
  */.project/todo-lists/TODO-*.yaml) ;;
  */.project/handoff-records/HANDOFF-*.md) ;;
  */.project/traceability-reports/TRACE-*.md) ;;
  */.project/validation-reports/VAL-*.md) ;;
  *) echo '{}'; exit 0 ;;
esac

[ ! -f "$file_path" ] && { echo '{}'; exit 0; }

project_root=$(echo "$file_path" | grep -oP '^.*(?=/\.project/)' || true)
[ -z "$project_root" ] && { echo '{}'; exit 0; }

# Locate planning-docs.mjs — prefer the plugin cache version, else fall
# back to any installed copy.
planning_docs_mjs=""
if [ -n "${CLAUDE_PLUGIN_ROOT:-}" ] && [ -f "${CLAUDE_PLUGIN_ROOT}/scripts/lib/planning-docs.mjs" ]; then
  planning_docs_mjs="${CLAUDE_PLUGIN_ROOT}/scripts/lib/planning-docs.mjs"
else
  planning_docs_mjs=$(find "${HOME:-/root}/.claude/plugins" -path '*/scripts/lib/planning-docs.mjs' 2>/dev/null | sort -V | tail -n 1 || true)
fi

# ── 1) Schema validation ────────────────────────────────────────────────
if [ -n "$planning_docs_mjs" ] && [ -f "$planning_docs_mjs" ]; then
  schema_errors=$(cd "$project_root" && node "$planning_docs_mjs" validate "$file_path" 2>&1 || true)
  if ! echo "$schema_errors" | grep -q "^OK"; then
    echo "$schema_errors" | sed 's/^/validate-on-write (schema): /' >&2
  fi
fi

# ── 2) Coverage: upstream AC IDs must appear in this doc ────────────────
# Read upstream: list from frontmatter via python3 (same bridge pattern).
upstream_paths=$(python3 - "$file_path" <<'PY' 2>/dev/null || true
import sys, yaml
path = sys.argv[1]
with open(path) as f:
    raw = f.read()
try:
    if path.endswith((".yaml", ".yml")):
        doc = yaml.safe_load(raw) or {}
    else:
        if raw.startswith("---\n"):
            end = raw.find("\n---", 4)
            if end < 0: sys.exit(0)
            doc = yaml.safe_load(raw[4:end]) or {}
        else:
            sys.exit(0)
    for u in (doc.get("upstream") or []):
        print(u)
except Exception:
    pass
PY
)

[ -z "$upstream_paths" ] && { echo '{}'; exit 0; }

doc_id=$(basename "$file_path" | grep -oP '^[A-Z]+-[0-9]+' | head -1 || true)
downstream_content=$(cat "$file_path")
any_gaps=0

while IFS= read -r rel; do
  [ -z "$rel" ] && continue
  abs="$project_root/$rel"
  [ ! -f "$abs" ] && continue

  # Pick AC ID pattern based on the upstream type (inferred from path).
  case "$rel" in
    */architecture-decision-records/*) pattern='AAC-[0-9]+' ;;
    */feature-development-records/*)   pattern='FAC-[0-9]+' ;;
    */test-plans/*)                    pattern='TC-[0-9]+'  ;;
    */implementation-plans/*)          pattern='EAC-[0-9]+' ;;
    *) continue ;;
  esac

  mapfile -t upstream_ids < <(grep -oP "$pattern" "$abs" | sort -u 2>/dev/null || true)
  total=${#upstream_ids[@]}
  [ "$total" -eq 0 ] && continue

  missing=()
  for uid in "${upstream_ids[@]}"; do
    if ! echo "$downstream_content" | grep -qF "$uid"; then
      missing+=("$uid")
    fi
  done
  [ ${#missing[@]} -eq 0 ] && continue

  upstream_id=$(basename "$abs" | grep -oP '^[A-Z]+-[0-9]+' | head -1 || true)
  covered=$((total - ${#missing[@]}))
  pct=$((covered * 100 / total))
  printf 'validate-on-write (coverage): %s -> %s %d/%d (%d%%); missing: %s\n' \
    "$upstream_id" "$doc_id" "$covered" "$total" "$pct" "${missing[*]}" >&2
  any_gaps=1
done <<< "$upstream_paths"

echo '{}'
exit 0
