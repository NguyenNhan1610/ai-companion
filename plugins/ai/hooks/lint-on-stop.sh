#!/bin/bash
# Stop hook: batch lint/typecheck all files changed since last user prompt
# Reads cascade log, deduplicates files, runs appropriate linters, blocks stop on errors

set -euo pipefail

input=$(cat)
cwd=$(echo "$input" | jq -r '.cwd // empty')

[ -z "$cwd" ] && { echo '{}'; exit 0; }
[ ! -d "$cwd" ] && { echo '{}'; exit 0; }

# Anchor on the git repo root, not whatever subdirectory $cwd happens to be.
# Falls back to $cwd if we're not inside a git checkout.
project_root=$(cd "$cwd" && git rev-parse --show-toplevel 2>/dev/null || true)
[ -z "$project_root" ] && project_root="$cwd"
cwd="$project_root"

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(dirname "$(dirname "$(readlink -f "$0")")")}"
LINT_CONFIGS="$PLUGIN_ROOT/lint-configs"

# Get branch name
branch=$(cd "$cwd" && git branch --show-current 2>/dev/null || echo "detached")
[ -z "$branch" ] && branch="detached"
safe_branch=$(echo "$branch" | sed 's/[^a-zA-Z0-9._-]/-/g')

cascade_file="$cwd/.claude/cascades/$safe_branch.md"

# No cascade = nothing to check
[ ! -f "$cascade_file" ] && { echo '{}'; exit 0; }

# Extract unique file paths from the last session segment (after last ## User: separator)
# Get content after the last "## [" header
last_segment=$(tac "$cascade_file" | sed '/^## \[/q' | tac)

# Extract file paths from entries like: - [HH:MM:SS] EDIT `path/to/file` L123
py_files=()
ts_files=()
all_changed=()

cwd_abs=$(cd "$cwd" && pwd -P 2>/dev/null || echo "$cwd")

while IFS= read -r line; do
  filepath=$(echo "$line" | grep -oP '`\K[^`]+' | head -1 || true)
  [ -z "$filepath" ] && continue

  # Reject absolute paths and any path containing .. segments — cascade entries
  # should be cwd-relative. A path like "../../../tmp/..." can resolve to a real
  # file outside the project and poison the lint run.
  case "$filepath" in
    /*|*..*) continue ;;
  esac

  full_path="$cwd/$filepath"
  [ ! -f "$full_path" ] && continue

  # Final containment check: resolved path must live under $cwd_abs.
  resolved=$(cd "$(dirname "$full_path")" 2>/dev/null && pwd -P)/$(basename "$full_path")
  case "$resolved" in
    "$cwd_abs"/*) ;;
    *) continue ;;
  esac

  # Skip excluded directories
  case "$filepath" in
    tests/*|test/*|__tests__/*|*_test.py|*_test.ts|*.test.ts|*.test.tsx|*.spec.ts|*.spec.tsx) continue ;;
    .venv/*|venv/*|env/*|.env/*) continue ;;
    node_modules/*|.next/*|out/*|dist/*|build/*|coverage/*) continue ;;
    __pycache__/*|.mypy_cache/*|.pytest_cache/*|.ruff_cache/*) continue ;;
    migrations/*|*.min.js|*.min.css|*.map|*.lock) continue ;;
    .git/*|.claude/*) continue ;;
  esac

  # Deduplicate
  already=false
  for f in "${all_changed[@]+"${all_changed[@]}"}"; do
    [ "$f" = "$filepath" ] && already=true && break
  done
  $already && continue

  all_changed+=("$filepath")

  case "$filepath" in
    *.py) py_files+=("$filepath") ;;
    *.ts|*.tsx|*.js|*.jsx|*.mjs) ts_files+=("$filepath") ;;
  esac
done <<< "$last_segment"

# Nothing to lint
[ ${#all_changed[@]} -eq 0 ] && { echo '{}'; exit 0; }

errors=""
warnings=""

# --- Python linting ---
if [ ${#py_files[@]} -gt 0 ]; then
  # Check if ruff is available
  if command -v ruff &>/dev/null; then
    ruff_rc=0
    ruff_raw=$(cd "$cwd" && ruff check --config "$LINT_CONFIGS/ruff.toml" --output-format concise "${py_files[@]}" 2>&1) || ruff_rc=$?
    if [ "$ruff_rc" -ne 0 ] && [ -n "$ruff_raw" ]; then
      ruff_total=$(echo "$ruff_raw" | wc -l)
      ruff_out=$(echo "$ruff_raw" | head -20)
      errors+="## Ruff (Python lint)\n$ruff_out\n"
      if [ "$ruff_total" -gt 20 ]; then
        errors+="... ($((ruff_total - 20)) more ruff findings truncated)\n"
      fi
      errors+="\n"
    fi
  fi

  # Check if pyright is available
  if command -v pyright &>/dev/null; then
    pyright_out=$(cd "$cwd" && pyright --project "$LINT_CONFIGS/pyrightconfig.json" "${py_files[@]}" 2>&1) || true
    if echo "$pyright_out" | grep -q "error:"; then
      pyright_all=$(echo "$pyright_out" | grep "error:" || true)
      pyright_total=$(echo "$pyright_all" | wc -l)
      pyright_errors=$(echo "$pyright_all" | head -15)
      errors+="## Pyright (Python typecheck)\n$pyright_errors\n"
      if [ "$pyright_total" -gt 15 ]; then
        errors+="... ($((pyright_total - 15)) more pyright errors truncated)\n"
      fi
      errors+="\n"
    fi
  fi

  # Check Python compilation
  for pyfile in "${py_files[@]}"; do
    compile_out=$(cd "$cwd" && python3 -m py_compile "$pyfile" 2>&1 | head -5) || true
    if [ -n "$compile_out" ]; then
      errors+="## Python compile error\n$compile_out\n\n"
    fi
  done
fi

# --- TypeScript/JavaScript linting ---
if [ ${#ts_files[@]} -gt 0 ]; then
  # Check if eslint is available
  if command -v eslint &>/dev/null; then
    # Use project eslint config if exists, otherwise use bundled
    if [ -f "$cwd/eslint.config.mjs" ] || [ -f "$cwd/eslint.config.js" ] || [ -f "$cwd/.eslintrc.js" ] || [ -f "$cwd/.eslintrc.json" ]; then
      eslint_raw=$(cd "$cwd" && eslint --quiet "${ts_files[@]}" 2>&1) || true
    else
      eslint_raw=$(cd "$cwd" && eslint --config "$LINT_CONFIGS/eslint.config.mjs" --quiet "${ts_files[@]}" 2>&1) || true
    fi
    if [ -n "$eslint_raw" ]; then
      eslint_total=$(echo "$eslint_raw" | wc -l)
      eslint_out=$(echo "$eslint_raw" | head -25)
      errors+="## ESLint (TypeScript/JS lint)\n$eslint_out\n"
      if [ "$eslint_total" -gt 25 ]; then
        errors+="... ($((eslint_total - 25)) more eslint lines truncated)\n"
      fi
      errors+="\n"
    fi
  fi

  # Check if tsc is available — only run on .ts/.tsx files (skip .js/.mjs/.jsx)
  tsc_files=()
  for f in "${ts_files[@]}"; do
    case "$f" in
      *.ts|*.tsx) tsc_files+=("$f") ;;
    esac
  done

  if [ ${#tsc_files[@]} -gt 0 ] && command -v tsc &>/dev/null; then
    if [ -f "$cwd/tsconfig.json" ]; then
      tsc_out=$(cd "$cwd" && tsc --noEmit --pretty false "${tsc_files[@]}" 2>&1 | head -50) || true
    else
      tsc_out=$(cd "$cwd" && tsc --noEmit --pretty false --strict --moduleResolution bundler --module ESNext --target ES2022 --jsx react-jsx --skipLibCheck "${tsc_files[@]}" 2>&1 | head -50) || true
    fi
    if echo "$tsc_out" | grep -q "error TS"; then
      tsc_errors=$(echo "$tsc_out" | grep "error TS" | head -20 || true)
      errors+="## TypeScript (typecheck)\n$tsc_errors\n\n"
    fi
  fi
fi

# No errors = allow stop
if [ -z "$errors" ]; then
  echo '{"continue": true}'
  exit 0
fi

# Errors found = block stop and report
file_count=${#all_changed[@]}
py_count=${#py_files[@]}
ts_count=${#ts_files[@]}

report="# Lint Check Failed\n\n"
report+="Checked $file_count files ($py_count Python, $ts_count TypeScript/JS) from recent changes.\n\n"
report+="$errors"
report+="Fix the errors above before stopping. Run \`/ai:lint\` for the full report."

# Hard cap total message size to stay well under Claude Code's hook output limit (~16KB).
# systemMessage gets JSON-escaped, so keep raw payload under ~10KB.
rendered=$(echo -e "$report")
max_bytes=10000
if [ "${#rendered}" -gt "$max_bytes" ]; then
  rendered="${rendered:0:$max_bytes}

... (report truncated; run \`/ai:lint\` for the full output)"
fi

# Output as systemMessage to Claude
echo "{\"continue\": false, \"systemMessage\": \"$(printf '%s' "$rendered" | sed 's/\\/\\\\/g; s/"/\\"/g' | tr '\n' ' ')\"}"
exit 2
