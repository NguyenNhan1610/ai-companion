#!/bin/bash
# Stop hook: batch lint/typecheck all files changed since last user prompt
# Reads cascade log, deduplicates files, runs appropriate linters, blocks stop on errors

set -euo pipefail

input=$(cat)
cwd=$(echo "$input" | jq -r '.cwd // empty')

[ -z "$cwd" ] && { echo '{}'; exit 0; }

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

while IFS= read -r line; do
  filepath=$(echo "$line" | grep -oP '`\K[^`]+' | head -1 || true)
  [ -z "$filepath" ] && continue

  full_path="$cwd/$filepath"
  [ ! -f "$full_path" ] && continue

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
    ruff_out=$(cd "$cwd" && ruff check --config "$LINT_CONFIGS/ruff.toml" --output-format text "${py_files[@]}" 2>&1) || true
    if [ -n "$ruff_out" ]; then
      errors+="## Ruff (Python lint)\n$ruff_out\n\n"
    fi
  fi

  # Check if pyright is available
  if command -v pyright &>/dev/null; then
    pyright_out=$(cd "$cwd" && pyright --project "$LINT_CONFIGS/pyrightconfig.json" "${py_files[@]}" 2>&1) || true
    if echo "$pyright_out" | grep -q "error:"; then
      pyright_errors=$(echo "$pyright_out" | grep "error:" || true)
      errors+="## Pyright (Python typecheck)\n$pyright_errors\n\n"
    fi
  fi

  # Check Python compilation
  for pyfile in "${py_files[@]}"; do
    compile_out=$(cd "$cwd" && python3 -m py_compile "$pyfile" 2>&1) || true
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
      eslint_out=$(cd "$cwd" && eslint --quiet "${ts_files[@]}" 2>&1) || true
    else
      eslint_out=$(cd "$cwd" && eslint --config "$LINT_CONFIGS/eslint.config.mjs" --quiet "${ts_files[@]}" 2>&1) || true
    fi
    if [ -n "$eslint_out" ]; then
      errors+="## ESLint (TypeScript/JS lint)\n$eslint_out\n\n"
    fi
  fi

  # Check if tsc is available — only run on specific changed files
  if command -v tsc &>/dev/null; then
    # Use project tsconfig if exists, otherwise use bundled — but always check specific files only
    if [ -f "$cwd/tsconfig.json" ]; then
      tsc_out=$(cd "$cwd" && tsc --noEmit --pretty false "${ts_files[@]}" 2>&1 | head -50) || true
    else
      tsc_out=$(cd "$cwd" && tsc --noEmit --pretty false --strict --moduleResolution bundler --module ESNext --target ES2022 --jsx react-jsx --skipLibCheck "${ts_files[@]}" 2>&1 | head -50) || true
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

# Output as systemMessage to Claude
echo "{\"continue\": false, \"systemMessage\": \"$(echo -e "$report" | sed 's/"/\\"/g' | tr '\n' ' ')\"}"
exit 2
