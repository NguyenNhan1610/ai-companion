# Claude Code Automation Patterns

Technical reference for composing hooks, skills, agents, and commands into manual, semi-automated, and fully automated workflows.

---

## 1. Component Reference

### 1.1 Hooks

Event-driven shell scripts that fire at specific lifecycle points. Each hook receives JSON on stdin and returns a JSON decision on stdout.

**Lifecycle Events:**

| Event | When it fires | Context | Can block? |
|---|---|---|---|
| `SessionStart` | New Claude Code session begins | Main | No |
| `SessionEnd` | Session terminates | Main | No |
| `UserPromptSubmit` | User sends a message | Main | No |
| `PreToolUse` | Before a tool executes | Main or Agent | Yes (prevents tool execution) |
| `PostToolUse` | After a tool completes | Main or Agent | Yes (sends error feedback to assistant) |
| `Stop` | Assistant attempts to stop | Main | Yes (forces assistant to continue) |
| `SubagentStop` | A subagent finishes | Main | Yes (forces main assistant to act) |

**Hook Input (stdin):**
```json
{
  "tool_name": "Write",
  "tool_input": { "file_path": "/path/to/file", "content": "..." },
  "cwd": "/project/root",
  "session_id": "abc123",
  "stop_hook_active": false
}
```

**Hook Decisions (stdout):**
```json
{}                                              // approve (no action)
{"decision": "block", "reason": "Fix X first"} // block with feedback
```

**Registration (hooks.json):**
```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "bash \"${CLAUDE_PLUGIN_ROOT}/hooks/my-hook.sh\"",
            "timeout": 15
          }
        ]
      }
    ]
  }
}
```

**Key behaviors:**
- `matcher` filters by tool name (PreToolUse/PostToolUse) or `*` for all
- Hooks run sequentially within an event group
- `CLAUDE_PLUGIN_ROOT` resolves to the plugin's installation directory
- Hooks must exit within `timeout` seconds or they're killed
- A non-zero exit code with no stderr produces a silent non-blocking error

### 1.2 Skills

Reusable content modules stored as `skills/{name}/SKILL.md`. Skills serve two purposes:

1. **Description in context** — the frontmatter `description:` field is always present in the system prompt, enabling auto-triggering
2. **Body loaded on demand** — the full content is injected only when invoked (via Skill tool) or referenced by an agent

**Skill structure:**
```
skills/
  validation/
    SKILL.md              # Frontmatter + body content
    references/           # Supporting files (templates, fragments)
      pair-adr-fdr.md
      pair-fdr-impl.md
      val-report-template.md
```

**SKILL.md frontmatter:**
```yaml
---
name: validation
description: Validate pairwise fulfillment between planning documents...
user-invocable: true
---
```

**Loading mechanisms:**

| Mechanism | What loads | When |
|---|---|---|
| Always in context | `description:` field (one line) | Session start |
| Skill tool invocation | Full body | User triggers or model auto-invokes |
| Agent `skills:` reference | Full body | Agent is spawned |
| `references/` files | On demand | Agent uses Read tool |

**Key insight:** Skills are the **shared content layer** for agents. An agent with `skills: [validation]` gets the validation methodology injected into its context without duplicating it in the agent body.

### 1.3 Agents

Forked execution contexts with specific tools and skills. Agents run in isolation — they don't see the main conversation history.

**Agent frontmatter:**
```yaml
---
name: feature-development-record
description: Generate Feature Development Records with edge cases...
tools: Read, Glob, Grep, Bash, Agent
skills:
  - mermaid-charts
---
```

**Key properties:**
- `tools:` restricts which tools the agent can use
- `skills:` injects skill bodies into the agent's context
- Agents can spawn sub-agents via the `Agent` tool (composition)
- When an agent stops, `SubagentStop` hooks fire in the parent context
- Agents have access to `CLAUDE_PLUGIN_ROOT` for plugin-relative paths

### 1.4 Commands

User-invocable entry points registered as `commands/{name}.md`. Each command gets a `/ai:{name}` slash command.

**Command frontmatter:**
```yaml
---
description: Generate a Feature Development Record...
argument-hint: '[--scope backend|frontend] <feature description>'
context: fork
allowed-tools: Read, Glob, Grep, Bash(node:*), Agent, AskUserQuestion
---
```

**Key properties:**
- `context: fork` runs the command in an isolated context (like an agent)
- `allowed-tools` restricts tool access (supports glob patterns like `Bash(node:*)`)
- `$ARGUMENTS` is replaced with the user's input after the command name
- Commands route to agents via text instructions: "Route to the `ai:X` subagent"
- Commands can also invoke scripts directly via Bash

---

## 2. Composition Patterns

### Pattern 1: Command → Agent → Skills

The standard invocation chain. User types a command, which forks to an agent, which loads skills for methodology.

```
User: /ai:feature-development-record Add session caching
  |
  v
Command (feature-development-record.md)
  | context: fork
  | "Route to ai:feature-development-record subagent"
  |
  v
Agent (fdr.md)
  | tools: Read, Glob, Grep, Bash, Agent
  | skills: [mermaid-charts]
  |   -> mermaid-charts SKILL.md body injected
  |
  | Phase 0: Init & number
  | Phase 1: Map codebase
  | Phase 2: Design
  | Phase 3: Stress-test
  | Phase 4: Assess risks
  | Phase 5: Plan
  | Phase 6: Write -> .claude/project/fdr/FDR-01-session-caching.md
  |
  v
SubagentStop fires in main context
```

### Pattern 2: PostToolUse Feedback Loop

A hook intercepts a tool call and blocks with feedback, forcing the agent to revise and retry.

```
Agent writes FDR-01.md
  |
  v
PostToolUse/Write fires (inside agent context)
  |
  v
validate-on-write.sh
  | 1. Detect planning doc path
  | 2. Read header -> Source ADR: ADR-01
  | 3. Read ADR-01 -> extract AAC-1, AAC-2, AAC-3, AAC-4
  | 4. Grep FDR-01 for each AAC ID
  | 5. Missing: AAC-3, AAC-4
  |
  v
Block: "2/4 items covered (50%). Missing: AAC-3, AAC-4. Attempt 1/3."
  |
  v
Agent receives feedback -> revises FDR -> writes again
  |
  v
PostToolUse/Write fires again
  | All 4 AAC IDs found
  |
  v
Approve: {} (pass)
```

**Guard rails:**
- Max 3 attempts before auto-approving (prevents infinite loops)
- Skips lite flow (upstream = "---")
- Skips when upstream doc doesn't exist
- Fast-exits for non-planning files (no overhead on normal writes)

### Pattern 3: SubagentStop Safety Net

After an agent finishes, a hook in the main context triggers follow-up work.

```
FDR agent finishes
  |
  v
SubagentStop hook fires (main context)
  |
  v
auto-validate-on-stage.sh
  | 1. Read cascade log for last segment
  | 2. Find Write entries to .claude/project/fdr/FDR-*.md
  | 3. Match found
  |
  v
Block: "Planning doc written. Spawn auto-validate agent."
  |
  v
Main Claude spawns ai:auto-validate agent
  | skills: [validation, mermaid-charts]
  | 1. Read FDR header -> Source ADR: ADR-01
  | 2. Cross-reference tables
  | 3. Report inline verdict: PASS/PARTIAL/FAIL
  |
  v
Main conversation continues with verdict visible
```

### Pattern 4: Stop Gate

A Stop hook prevents the session from ending until a condition is met.

```
User says "done" / assistant attempts to stop
  |
  v
Stop hook fires
  |
  +-> stop-review-gate-hook.mjs
  |   | Check config.stopReviewGate
  |   | If enabled: run Codex review task
  |   | If issues: block with review findings
  |   | If clean: approve
  |
  +-> lint-on-stop.sh
  |   | Parse cascade log for changed files
  |   | Run ruff, pyright, eslint, tsc
  |   | If errors: block with lint report
  |   | If clean: approve
  |
  +-> todo-reminder-on-stop.sh
  |   | Check if implementation workflow active
  |   | Scan cascade for source file changes
  |   | If tracked files changed: block
  |   | "Run /ai:todo update before stopping"
  |
  v
All hooks approve -> session stops
Any hook blocks -> assistant continues with feedback
```

### Pattern 5: Cascade Logging + Reconstruction

Every file change is logged in real-time, then reconstructed into structured records.

```
Agent edits src/auth.ts
  |
  v
PostToolUse/Edit fires
  |
  v
cascade-logger.sh
  | Appends to .claude/cascades/main.md:
  | "- [14:23:07] EDIT `src/auth.ts` L45-67"
  |
  v
(... more edits throughout session ...)
  |
  v
User: /ai:cascade --since 2h
  |
  v
cascade agent
  | 1. Read .claude/cascades/main.md
  | 2. Read git diff + git log
  | 3. Group changes by user prompt segments
  | 4. Cross-reference with FDR/IMPL tasks
  | 5. Write .claude/project/cascades/REC-01-auth-refactor.md
```

### Pattern 6: Knowledge Injection

Past experience is automatically surfaced during planning.

```
User: /ai:feature-development-record Add rate limiting
  |
  v
FDR agent Phase 0.5: CONSULT KNOWLEDGE BASE
  | 1. Read .claude/project/knowledge/index.yaml
  | 2. Match "rate limiting" against trigger_patterns
  | 3. Found: KN-03-rate-limiter-token-bucket.md
  |      trigger_patterns: [rate limit, throttl, token bucket]
  |      type: pattern
  |      solution: "Use token bucket with Redis backend..."
  | 4. Include in FDR under "Relevant Past Knowledge"
  |
  v
FDR incorporates past experience into design
```

### Pattern 7: Agent Spawns Sub-Agents

Agents can compose by spawning sub-agents for parallel work.

```
/ai:trace FDR-03 --verify
  |
  v
trace agent
  | Phase 1: Discover document chain
  | Phase 2: Spawn 3 parallel sub-agents
  |
  +-> Sub-agent A: Document Discovery
  |   | Glob all .claude/project/ for references
  |   | Build dependency graph
  |
  +-> Sub-agent B: Code Evidence
  |   | For each IMPL task, verify code exists
  |   | Check file:line references are current
  |
  +-> Sub-agent C: Test Verification
  |   | For each TC, verify test file exists
  |   | Check test assertions match TC criteria
  |
  v
trace agent collects results -> ship/no-ship verdict
```

### Pattern 8: Multi-Backend Delegation

Commands delegate to different AI backends through a unified interface.

```
/ai:rescue --model codex:gpt-5.4 Fix the auth race condition
  |
  v
rescue command -> rescue agent
  | skills: [ai-cli-runtime, gpt-5-4-prompting]
  |
  | 1. gpt-5-4-prompting skill -> compose tight prompt
  | 2. ai-cli-runtime skill -> invoke:
  |    node ai-companion.mjs task --model codex:gpt-5.4 --write "<prompt>"
  |
  v
ai-companion.mjs -> lib/codex/index.mjs -> Codex CLI
  | Job tracked in .claude/ai/job-{id}.json
  | Streaming output via broker WebSocket
  |
  v
Result returned verbatim to user
```

---

## 3. Workflow Recipes

### 3.1 Manual Workflow (User-Driven)

Each step is explicitly invoked by the user.

```
1. /ai:architecture-decision-record Migrate to event sourcing
   -> ADR-01-event-sourcing.md

2. /ai:validate ADR-01
   -> (auto-discovers no upstream, skips)

3. /ai:feature-development-record --scope data Migrate orders to event sourcing
   -> FDR-01-event-sourcing-orders.md

4. /ai:validate ADR-01 FDR-01
   -> VAL-01-ADR-01-to-FDR-01.md (AAC coverage check)

5. /ai:test-plan --from FDR-01 --adr ADR-01
   -> TP-01-event-sourcing-orders.md

6. /ai:validate FDR-01 TP-01
   -> VAL-02-FDR-01-to-TP-01.md (FAC->TC coverage)

7. /ai:implement --from FDR-01 --method tdd
   -> IMPL-01-event-sourcing-orders.md

8. /ai:validate FDR-01 IMPL-01
   -> VAL-03-FDR-01-to-IMPL-01.md (FAC->EAC coverage)

9. /ai:todo --from IMPL-01
   -> TODO-01-event-sourcing-orders.yaml

10. (implement the feature)

11. /ai:todo update  (reconcile progress)
12. /ai:cascade      (document what was built)
13. /ai:trace FDR-01 --verify  (ship/no-ship audit)
```

### 3.2 Semi-Automated Workflow (Hook-Assisted)

User invokes commands; hooks provide automatic validation and reminders.

```
1. User: /ai:feature-development-record Add session caching

2. FDR agent writes FDR-01.md
   -> [AUTO] PostToolUse/Write: validate-on-write.sh
      Checks AAC coverage against source ADR
      If gaps -> blocks, agent revises, re-writes
      Loop until PASS or 3 attempts

3. FDR agent finishes
   -> [AUTO] SubagentStop: auto-validate-on-stage.sh
      Spawns auto-validate agent for brief coverage check
      Reports inline PASS/PARTIAL/FAIL

4. User: /ai:implement --from FDR-01

5. IMPL agent writes IMPL-01.md
   -> [AUTO] PostToolUse/Write: validate-on-write.sh
      Checks FAC coverage in EAC table
      Feedback loop until covered

6. IMPL agent finishes
   -> [AUTO] SubagentStop: auto-validate-on-stage.sh

7. User: /ai:todo --from IMPL-01

8. User implements the feature...
   -> [AUTO] PostToolUse/Edit|Write|Bash: cascade-logger.sh
      Every file change logged to .claude/cascades/main.md

9. User says "done"
   -> [AUTO] Stop: lint-on-stop.sh
      Blocks if lint/typecheck errors in changed files
   -> [AUTO] Stop: todo-reminder-on-stop.sh
      Blocks if implementation workflow active
      "Run /ai:todo update before stopping"

10. User: /ai:todo update
    -> [AUTO] SubagentStop: todo-reminder approves on re-entry
```

### 3.3 Fully Automated Workflow (Chained Agents)

A single command triggers a full planning chain with validation at each stage. This can be built as a custom command or agent.

**Example: `commands/plan-feature.md`**
```yaml
---
description: Run the full planning chain for a feature (FDR -> IMPL -> TODO)
argument-hint: '<feature description>'
context: fork
allowed-tools: Read, Glob, Grep, Bash(node:*), Agent, AskUserQuestion
---

Execute the full planning pipeline:

1. Spawn the ai:feature-development-record agent with: $ARGUMENTS
   Wait for it to complete and extract the FDR path from its output.

2. Spawn the ai:implement agent with: --from {FDR path}
   Wait for completion, extract IMPL path.

3. Spawn the ai:todo agent with: --from {IMPL path}
   Wait for completion.

At each stage, the PostToolUse validation hook automatically
checks upstream coverage and forces revision if gaps are found.

Report the final state: FDR path, IMPL path, TODO path.
```

**What happens automatically at each stage:**

```
/ai:plan-feature Add multi-tenant session caching
  |
  v
Stage 1: FDR
  | Agent explores codebase, writes FDR
  | [AUTO] validate-on-write.sh checks AAC coverage -> revision loop
  | [AUTO] SubagentStop -> auto-validate verdict
  | Output: FDR-02-multi-tenant-session-caching.md
  |
  v
Stage 2: IMPL
  | Agent reads FDR, builds DAG, writes IMPL
  | [AUTO] validate-on-write.sh checks FAC coverage -> revision loop
  | [AUTO] SubagentStop -> auto-validate verdict
  | Output: IMPL-02-multi-tenant-session-caching.md
  |
  v
Stage 3: TODO
  | Agent reads IMPL, generates task board
  | [AUTO] validate-on-write.sh checks task coverage -> revision loop
  | Output: TODO-02-multi-tenant-session-caching.yaml
  |
  v
Done: 3 validated documents ready for implementation
```

### 3.4 Review Workflows

**Quick diff review (manual):**
```
/ai:git-review                    # Review uncommitted changes
/ai:git-review --scope branch     # Review all commits on current branch
```

**Full codebase review (background):**
```
/ai:review                        # General sweep (background recommended)
/ai:review security               # Security-focused review
/ai:review python/fastapi:performance  # Stack-specific aspect
```

**Adversarial challenge:**
```
/ai:adversarial-review             # Challenge design choices
/ai:council --roles security,performance,maintainability
                                   # Multi-agent panel discussion
```

**Automated review gate (hook-driven):**
```
# Enable: /ai:setup --enable-review-gate
# On every Stop, review-gate runs a Codex review
# Blocks stop if issues found -> assistant must address them
```

### 3.5 Debugging Workflow

```
/ai:debug The auth middleware returns 403 for valid tokens after deployment
  |
  v
debug agent
  | skills: [ai-cli-runtime, mermaid-charts, hypothesis-debugging]
  |
  | Phase 1: Generate hypotheses from symptom
  |   H1: Token expiry mismatch between environments
  |   H2: CORS preflight consuming the token
  |   H3: Key rotation not propagated to new deployment
  |
  | Phase 2: Test each hypothesis
  |   For each H: write test script -> run via ai-cli-runtime
  |   -> .claude/project/scripts/hypothesis/H01_token_expiry.py
  |   -> .claude/project/scripts/hypothesis/H01_token_expiry_result.json
  |
  | Phase 3: Decision tree (Mermaid)
  |   Color-coded: green=confirmed, red=rejected, yellow=inconclusive
  |
  v
Report: "H3 confirmed — key rotation script skips the staging cluster"
```

---

## 4. Hook Design Patterns

### 4.1 Fast-Exit Filter

Every hook should exit immediately for irrelevant events. The fast path must be cheap.

```bash
#!/bin/bash
set -euo pipefail

input=$(cat)
tool_name=$(echo "$input" | jq -r '.tool_name // empty')
file_path=$(echo "$input" | jq -r '.tool_input.file_path // empty')

# Fast exit: only care about Write to planning docs
[ "$tool_name" != "Write" ] && { echo '{}'; exit 0; }
case "$file_path" in
  */.claude/project/fdr/FDR-*.md) ;;
  */.claude/project/implementation_plans/IMPL-*.md) ;;
  *) echo '{}'; exit 0 ;;
esac

# ... expensive validation logic only runs for matching files
```

### 4.2 Re-Entry Guard

Prevent hooks from re-triggering when the assistant acts on their feedback.

```bash
stop_hook_active=$(echo "$input" | jq -r '.stop_hook_active // false')
[ "$stop_hook_active" = "true" ] && { echo '{}'; exit 0; }
```

### 4.3 Iteration Limiter

Prevent infinite feedback loops with attempt tracking.

```bash
attempt_file="/tmp/.claude-validate-$(echo "$file_path" | md5sum | cut -d' ' -f1)"
attempt=1
[ -f "$attempt_file" ] && attempt=$(( $(cat "$attempt_file") + 1 ))

if [ "$attempt" -gt 3 ]; then
  rm -f "$attempt_file"
  echo '{}'; exit 0  # approve after max attempts
fi

# ... validation logic ...

# On failure: record attempt
echo "$attempt" > "$attempt_file"
jq -n --arg reason "Fix X. Attempt $attempt/3." '{decision:"block",reason:$reason}'

# On success: clean up
rm -f "$attempt_file"
echo '{}'
```

### 4.4 SIGPIPE-Safe Pipelines

When using `tac | sed '/pattern/q' | tac` to extract the last section of a file, `sed` quitting early sends SIGPIPE to `tac`. With `set -euo pipefail`, this kills the script.

```bash
# WRONG: exits 141 (SIGPIPE)
last_segment=$(tac "$file" | sed '/^## \[/q' | tac)

# RIGHT: absorb SIGPIPE
last_segment=$(tac "$file" | sed '/^## \[/q' | tac) || true
```

### 4.5 Fire-and-Forget Side Effects

For non-blocking notifications (UI events, logging), run in background.

```bash
curl -s -X POST "http://127.0.0.1:$port/api/events" \
  -H 'Content-Type: application/json' \
  -d "$payload" --max-time 1 &>/dev/null &

echo '{}'
exit 0
```

---

## 5. Skill Design Patterns

### 5.1 Shared Content Layer

Skills hold methodology that multiple agents need. Instead of duplicating validation rules in every agent, put them in a skill and reference via `skills:`.

```yaml
# agents/auto-validate.md
skills:
  - validation       # Gets full validation methodology
  - mermaid-charts   # Gets diagram syntax reference
```

The agent body focuses on orchestration; the skill provides domain knowledge.

### 5.2 References Directory

Skills can include supporting files that agents Read on demand.

```
skills/validation/
  SKILL.md                          # Loaded via skills: reference
  references/
    pair-adr-fdr.md                 # Agent reads when validating ADR->FDR
    pair-fdr-impl.md                # Agent reads when validating FDR->IMPL
    val-report-template.md          # Agent reads when writing report
```

Agents access these via: `Read "references/pair-adr-fdr.md"` in their body text. The path resolves relative to the skill directory.

### 5.3 Internal vs User-Invocable

```yaml
# User-invocable: appears in command suggestions, can be auto-triggered
name: validation
description: Validate pairwise fulfillment...
user-invocable: true

# Internal: only loaded by agents via skills:, minimal description
name: ai-cli-runtime
description: Internal runtime helper for rescue and debug agents
user-invocable: false
```

Internal skills should have short descriptions to minimize context overhead.

---

## 6. Agent Design Patterns

### 6.1 Phased Execution

Structure agents as numbered phases for predictable behavior.

```markdown
### Phase 0: INIT
  - Create directories, discover existing documents, assign ID

### Phase 0.5: CONSULT KNOWLEDGE BASE
  - Read index.yaml, match trigger_patterns, surface past experience

### Phase 1-N: CORE WORK
  - Domain-specific phases (map, design, assess, plan, etc.)

### Phase N+1: WRITE
  - Save output following template from references/
  - Embed Mermaid diagrams as fenced blocks
  - Output next_actions JSON with copy-paste commands
```

### 6.2 Next Actions Contract

Every planning agent outputs a `next_actions` JSON block with the exact commands for the next step.

```json
{
  "next_actions": [
    {
      "action": "Validate FDR against source ADR",
      "command": "/ai:validate ADR-01 FDR-03"
    },
    {
      "action": "Create implementation plan",
      "command": "/ai:implement --from .claude/project/fdr/FDR-03-session-caching.md"
    }
  ]
}
```

Commands use real document IDs and file paths from the current session, never placeholders.

### 6.3 Sub-Agent Composition

Agents can spawn sub-agents for parallel work.

```markdown
## Phase 2: PARALLEL EVIDENCE COLLECTION

Spawn 3 sub-agents in parallel:

1. **Document Discovery** — Glob .claude/project/ for all related documents
2. **Code Evidence** — Grep source files for function signatures from IMPL tasks
3. **Test Verification** — Check test files exist and match TC criteria

Collect results from all 3 before proceeding to Phase 3.
```

---

## 7. Composition Matrix

How each component type can interact with others:

| From \ To | Hook | Skill | Agent | Command |
|---|---|---|---|---|
| **Hook** | Sequential in same event | - | Emits message that triggers agent spawn | - |
| **Skill** | - | - | Injected via `skills:` | Body can reference commands as documentation |
| **Agent** | Triggers SubagentStop | Loaded via `skills:` | Spawns via Agent tool | Routes via text instruction |
| **Command** | Triggers PostToolUse when tools run | Invokable via Skill tool | Routes to named agent | - |

**Key constraints:**
- Hooks cannot directly spawn agents (they emit messages that the assistant acts on)
- Skills cannot call commands (they're passive content, not executable)
- Commands cannot load skills (no `skills:` field; only agents can)
- Agents cannot register hooks (hooks are static in hooks.json)

---

## 8. Context & Loading Summary

```
Session Start
  |
  v
Always in context (description lines only):
  +-- 23 command descriptions (~50 chars each)
  +-- 14 skill descriptions (~100 chars each)
  +-- 12 agent descriptions (~100 chars each)
  Total: ~5 KB baseline

On demand (loaded when invoked):
  +-- Command body: loaded when user types /command or model auto-invokes
  +-- Skill body: loaded when Skill tool fires or agent skills: references it
  +-- Agent body: loaded when Agent tool spawns it
  +-- references/*: loaded when agent uses Read tool

Never in context:
  +-- Hook scripts (bash/node, executed externally)
  +-- ai-companion.mjs and lib/ scripts (executed via Bash tool)
  +-- .claude/cascades/ logs (read on demand by agents)
  +-- .claude/ai/ job state (managed by scripts)
```

---

## 9. Building New Workflows

### Recipe: Add a new automated check

1. **Write the hook script** (`hooks/my-check.sh`)
   - Read stdin JSON, extract relevant fields
   - Fast-exit for irrelevant events
   - Do the check
   - Return `{}` (pass) or `{"decision": "block", "reason": "..."}` (fail)

2. **Register in hooks.json** under the appropriate event
   - PostToolUse for tool-specific checks
   - Stop for end-of-session gates
   - SubagentStop for post-agent follow-up

3. **Test with mock input:**
   ```bash
   echo '{"tool_name":"Write","tool_input":{"file_path":"/path"},"cwd":"/project"}' \
     | bash hooks/my-check.sh
   ```

### Recipe: Add a new planning stage

1. **Create the skill** (`skills/my-stage/SKILL.md` + `references/`)
   - Define the methodology and output template
   - Set `user-invocable: true` with trigger keywords in description

2. **Create the agent** (`agents/my-stage.md`)
   - Set `skills: [my-stage, mermaid-charts]`
   - Define phased process
   - End with Write to `.claude/project/my-stage/` + next_actions JSON

3. **Create the command** (`commands/my-stage.md`)
   - Set `context: fork` and `allowed-tools`
   - Route to the agent
   - The existing PostToolUse validation hook will auto-validate if the output path matches planning doc patterns

4. **Add validation pair** (if integrating with existing chain)
   - Create `skills/validation/references/pair-{upstream}-{my-stage}.md`
   - Update validate agent's pair list

### Recipe: Chain multiple agents

Create a command that spawns agents sequentially:

```markdown
---
description: Run FDR -> IMPL -> TODO pipeline
context: fork
allowed-tools: Read, Glob, Grep, Bash(node:*), Agent
---

1. Spawn ai:feature-development-record with: $ARGUMENTS
   Extract FDR path from output.

2. Spawn ai:implement with: --from {FDR path}
   Extract IMPL path from output.

3. Spawn ai:todo with: --from {IMPL path}

Report all 3 document paths.
```

Each spawn triggers PostToolUse validation hooks automatically.
