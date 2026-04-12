---
name: coding-rules
description: Internal skill that loads project coding rules into agent context based on detected tech stack
user-invocable: false
---

# Coding Rules Injection

When this skill is loaded, detect the project's tech stack and read the matching coding rules before starting your main work.

## Detection

Check the project root for tech stack indicators:

| Indicator | Stack | Rules to read |
|---|---|---|
| `tsconfig.json` or `**/*.ts` | TypeScript | `.claude/rules/typescript/typescript-*.md` |
| `next.config.*` or `app/layout.tsx` | Next.js | `.claude/rules/typescript/nextjs-*.md` |
| `pyproject.toml` or `**/*.py` | Python | `.claude/rules/python/python-*.md` |
| `manage.py` or `django` in deps | Django | `.claude/rules/python/django-*.md` |
| `fastapi` in deps | FastAPI | `.claude/rules/python/fastapi-*.md` |

## Process

1. Use `Glob` to check for the indicator files at the project root.
2. For each detected stack, use `Glob` to find matching rule files under `.claude/rules/`.
3. If no `.claude/rules/` directory exists, skip silently.
4. Read each matching rule file (they are short — typically 30-40 lines each).
5. Apply these rules as constraints during your work:
   - **DO** items are required patterns to follow.
   - **DON'T** items are patterns to avoid.
   - **ANTIPATTERNS** are specific mistakes to watch for and flag.

## Scope

Only read rules for stacks actually present in the project. Do not read all rules.
Keep total rule loading under 5 files to avoid context bloat.
Prioritize: security rules > architecture rules > antipatterns > performance.
