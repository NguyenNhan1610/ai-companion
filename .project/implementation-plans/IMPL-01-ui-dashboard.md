# IMPL-01: UI Dashboard for Claude Code Plugin

**Date:** 2026-04-09 **Method:** Phased delivery **Phases:** 4 **Total tasks:** 42 **Critical path:** P1-T01 → P1-T04 → P1-T07 → P2-T01 → P2-T08 → P3-T01

***

## Overview

A local web dashboard shipped with the AI Companion plugin that provides:

1. **Chat-style session feed** — real-time rendering of all Claude Code hook events (tool calls, diffs, bash output, agent lifecycle, user prompts) as typed widgets

2. **BlockNote project editor** — rich editor for `.project/` documents (ADR, FDR, IMPL, TODO, cascades, knowledge)

3. **Embedded terminal** — xterm.js PTY in the same project directory

4. **Codex/Copilot job dashboard** — live job status, progress, actions

Launched via `/ai:setup --init`, scoped to the current project repo, binds `127.0.0.1` only.

***

## Architecture

```text
┌──────────────────────────────────────────────────────────────────┐
│  Browser (localhost:{port})                                       │
│  ┌──────────┬────────────────────────────────────┬─────────────┐ │
│  │ Sidebar  │  Chat Feed (WebSocket)             │  Editor     │ │
│  │ FileTree │  ┌─ UserPrompt widget ───────────┐ │  BlockNote  │ │
│  │          │  │  ┌─ BashCommand widget ──────┐ │ │            │ │
│  │ .claude/ │  │  │  ┌─ CodeDiff widget ────┐ │ │ │  .md/.yaml │ │
│  │ project/ │  │  │  │  ┌─ AgentStart ────┐ │ │ │ │  files     │ │
│  │          │  │  │  │  │  ┌─ JobStatus ┐ │ │ │ │ │            │ │
│  │          │  └──┴──┴──┴──┴────────────┘ │ │ │ │ │            │ │
│  │          │  ┌─ TerminalBlock (xterm) ──────┐ │ │            │ │
│  └──────────┴──┴─────────────────────────────┘──┴─────────────┘ │
└──────────────────────────────────────────────────────────────────┘
        │ REST (files)              │ WS (events)       │ WS (PTY)
        ▼                          ▼                    ▼
┌──────────────────────────────────────────────────────────────────┐
│  Fastify Server (127.0.0.1:{port})                                │
│  ┌──────────┐  ┌──────────────┐  ┌──────────┐  ┌─────────────┐ │
│  │ /files/* │  │ /events (WS) │  │ /term(WS)│  │ /jobs/*     │ │
│  │ CRUD     │  │ EventBus     │  │ node-pty │  │ state watch │ │
│  └──────────┘  └──────────────┘  └──────────┘  └─────────────┘ │
└──────────────────────────────────────────────────────────────────┘
        ▲ POST /events                     ▲ fs.watch
        │                                  │
┌───────┴──────────────────────────────────┴──────────────────────┐
│  Claude Code Hooks (existing + enhanced)                         │
│  PreToolUse ─→ ui-event-emitter.sh ─→ POST /events              │
│  PostToolUse ─→ cascade-logger.sh + ui-event-emitter.sh         │
│  UserPromptSubmit ─→ cascade-prompt-logger.sh + ui-event-emitter│
│  Stop ─→ lint-on-stop.sh + ui-event-emitter.sh                  │
│  SubagentStop ─→ ui-event-emitter.sh                             │
└──────────────────────────────────────────────────────────────────┘
```

***

## Shared Event Schema

Every event flowing through the system:

```typescript
interface SessionEvent {
  id: string;                // crypto.randomUUID()
  ts: string;                // ISO-8601 timestamp
  type:
    | "user_prompt"          // UserPromptSubmit hook
    | "tool_call"            // PreToolUse hook
    | "tool_result"          // PostToolUse hook
    | "agent_start"          // PreToolUse where tool=Agent
    | "agent_stop"           // SubagentStop hook
    | "stop_requested"       // Stop hook (allowed)
    | "stop_blocked"         // Stop hook (exit 2 — lint/review gate)
    | "job_update"           // Job state file change
    | "session_start"        // SessionStart hook
    | "session_end";         // SessionEnd hook
  tool?: string;             // Bash, Edit, Write, Read, Grep, Glob, Agent, etc.
  input?: Record<string, unknown>;   // tool_input from hook stdin
  output?: Record<string, unknown>;  // tool_result from hook stdin
  signal?: string;           // [NEW] [REVISION] [ACCEPTED] [CONTINUE] [QUESTION]
  blocked?: boolean;         // stop was prevented
  message?: string;          // human-readable summary
  meta?: Record<string, unknown>;    // extra context (job ID, agent name, etc.)
}
```

***

## Phase 1: Server Infrastructure + Event Pipeline

**Goal:** Fastify server, WebSocket event bus, universal hook emitter, server lifecycle management. No UI yet — verify with `wscat` and curl.

**Depends on:** Nothing (foundation)

### P1-T01: Initialize UI package

**Create** `plugins/ai/ui/package.json`

```json
{
  "name": "@ai-companion/dashboard",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "concurrently \"vite\" \"tsx watch server/index.ts\"",
    "build": "vite build && tsx server/build.ts",
    "build:server": "esbuild server/index.ts --bundle --platform=node --format=esm --outdir=dist/server --external:node-pty",
    "preview": "node dist/server/index.js"
  },
  "dependencies": {
    "fastify": "^5.x",
    "@fastify/websocket": "^11.x",
    "@fastify/static": "^8.x",
    "@fastify/cors": "^10.x"
  },
  "devDependencies": {
    "vite": "^6.x",
    "react": "^19.x",
    "react-dom": "^19.x",
    "@vitejs/plugin-react": "^4.x",
    "typescript": "^5.x",
    "tsx": "^4.x",
    "esbuild": "^0.24.x",
    "concurrently": "^9.x",
    "@types/react": "^19.x",
    "@types/react-dom": "^19.x",
    "@types/node": "^22.x"
  }
}
```

**Create** `plugins/ai/ui/tsconfig.json` — strict, ESM, path aliases `@server/*`, `@/*`.

**Create** `plugins/ai/ui/vite.config.ts` — React plugin, proxy `/api` and `/ws` to Fastify dev port.

**Acceptance:** `npm install` succeeds, `npx vite build` produces `dist/`.

***

### P1-T02: Event schema + types

**Create** `plugins/ai/ui/shared/types.ts`

Define:

* `SessionEvent` interface (as above)

* `EventType` union type

* `ToolName` union type (all Claude Code tools)

* `SignalTag` union type

* `JobState` interface (mirrors existing job state shape)

* `FileEntry` interface (for project file tree)

* Helper: `createEvent(type, data) → SessionEvent` with auto-generated id + ts

**Acceptance:** Types compile, used by both server and client.

***

### P1-T03: Fastify server skeleton

**Create** `plugins/ai/ui/server/index.ts`

* Parse CLI args: `--project-root <path>`, `--port <number>` (default 0 = auto)

* Register plugins: `@fastify/cors` (localhost only), `@fastify/static` (serve `dist/client/`), `@fastify/websocket`

* Bind to `127.0.0.1` only (security: never expose to network)

* On listen: write port to `{projectRoot}/.claude/.ui-port`

* On shutdown (SIGTERM/SIGINT): remove `.ui-port` file

* Health endpoint: `GET /api/health` → `{ status: "ok", projectRoot, uptime }`

* Graceful shutdown with 5s timeout

**Acceptance:** Server starts, writes port file, `/api/health` responds, `Ctrl-C` removes port file.

***

### P1-T04: WebSocket event bus

**Create** `plugins/ai/ui/server/lib/event-bus.ts`

* `EventBus` class:

  * `clients: Set<WebSocket>` — connected browser clients

  * `history: SessionEvent[]` — last 500 events (ring buffer) for late joiners

  * `emit(event: SessionEvent)` — broadcast to all clients + append to history

  * `subscribe(ws: WebSocket)` — add client, send history replay, listen for close

  * `unsubscribe(ws: WebSocket)` — remove client

**Create** `plugins/ai/ui/server/routes/events.ts`

* `POST /api/events` — receive event JSON from hooks, validate, `bus.emit()`

  * Validate: must have `type` field, reject unknown types

  * Auto-generate `id` and `ts` if missing

  * Return `204 No Content`

* `GET /ws/events` (WebSocket upgrade) — `bus.subscribe(ws)`

  * On connect: replay `bus.history` as batch message

  * On message from client: ignore (read-only stream)

**Acceptance:** `curl -X POST localhost:{port}/api/events -d '{"type":"session_start"}'` → event arrives in `wscat -c ws://localhost:{port}/ws/events`.

***

### P1-T05: Universal hook event emitter

**Create** `plugins/ai/hooks/ui-event-emitter.sh`

```bash
#!/bin/bash
# Fire-and-forget: POST hook event to UI server
# Usage: echo "$hook_json" | ui-event-emitter.sh <event_type>
# Exits immediately if UI server not running (no .ui-port file)
set -euo pipefail

input=$(cat)
cwd=$(echo "$input" | jq -r '.cwd // empty')
[ -z "$cwd" ] && { echo '{}'; exit 0; }

port_file="$cwd/.claude/.ui-port"
[ -f "$port_file" ] || { echo '{}'; exit 0; }
port=$(cat "$port_file")
[ -z "$port" ] && { echo '{}'; exit 0; }

event_type="${1:-unknown}"
ts=$(date -u '+%Y-%m-%dT%H:%M:%S.%3NZ')

# Build event payload — pass through full hook input as data
payload=$(echo "$input" | jq -c --arg type "$event_type" --arg ts "$ts" \
  '{type: $type, ts: $ts, tool: .tool_name, input: .tool_input, output: .tool_result, signal: .signal, message: .message, meta: {hook_event: $type}}')

# Fire and forget — don't block the hook
curl -s -X POST "http://127.0.0.1:$port/api/events" \
  -H 'Content-Type: application/json' \
  -d "$payload" --max-time 1 &>/dev/null &

echo '{}'
exit 0
```

**Acceptance:** With server running, trigger any hook → event appears in WebSocket stream.

***

### P1-T06: Register new hooks in hooks.json

**Edit** `plugins/ai/hooks/hooks.json`

Add event emitter to ALL existing hook events (alongside existing hooks, not replacing):

```json
{
  "PreToolUse": [{
    "matcher": "*",
    "hooks": [{
      "type": "command",
      "command": "bash \"${CLAUDE_PLUGIN_ROOT}/hooks/ui-event-emitter.sh\" tool_call",
      "timeout": 2
    }]
  }],
  "PostToolUse": [
    { "...existing cascade-logger entry..." },
    {
      "matcher": "*",
      "hooks": [{
        "type": "command",
        "command": "bash \"${CLAUDE_PLUGIN_ROOT}/hooks/ui-event-emitter.sh\" tool_result",
        "timeout": 2
      }]
    }
  ],
  "SubagentStop": [{
    "matcher": "*",
    "hooks": [{
      "type": "command",
      "command": "bash \"${CLAUDE_PLUGIN_ROOT}/hooks/ui-event-emitter.sh\" agent_stop",
      "timeout": 2
    }]
  }],
  "UserPromptSubmit": [
    { "...existing prompt-logger entry..." },
    {
      "hooks": [{
        "type": "command",
        "command": "bash \"${CLAUDE_PLUGIN_ROOT}/hooks/ui-event-emitter.sh\" user_prompt",
        "timeout": 2
      }]
    }
  ],
  "Stop": [
    { "...existing review-gate + lint entries..." },
    {
      "hooks": [{
        "type": "command",
        "command": "bash \"${CLAUDE_PLUGIN_ROOT}/hooks/ui-event-emitter.sh\" stop_requested",
        "timeout": 2
      }]
    }
  ],
  "SessionStart": [
    { "...existing lifecycle entry..." },
    {
      "hooks": [{
        "type": "command",
        "command": "bash \"${CLAUDE_PLUGIN_ROOT}/hooks/ui-event-emitter.sh\" session_start",
        "timeout": 2
      }]
    }
  ],
  "SessionEnd": [
    { "...existing lifecycle entry..." },
    {
      "hooks": [{
        "type": "command",
        "command": "bash \"${CLAUDE_PLUGIN_ROOT}/hooks/ui-event-emitter.sh\" session_end",
        "timeout": 2
      }]
    }
  ]
}
```

**Key:** PostToolUse matcher changes from `Edit|Write|MultiEdit|Bash` to `*` for the emitter entry (cascade-logger keeps its specific matcher). This captures Read, Grep, Glob, Agent, WebSearch, etc.

**Acceptance:** All 7 hook events fire the emitter. Existing hooks still work unchanged.

***

### P1-T07: Job state watcher

**Create** `plugins/ai/ui/server/lib/job-watcher.ts`

* Watch Codex/Copilot job state directory: `{CLAUDE_PLUGIN_DATA}/state/{workspace}/jobs/`

* `fs.watch` on the directory for file changes

* On change: read the changed `.log` or state file, parse job status

* Emit `job_update` events to EventBus with:

  * `meta.jobId`, `meta.kind`, `meta.status`, `meta.phase`, `meta.summary`, `meta.elapsed`

* Debounce: 500ms per job ID to avoid flooding on rapid writes

* Graceful: if directory doesn't exist, skip watching (no Codex jobs)

**Acceptance:** Start a Codex review → `job_update` events stream to WebSocket.

***

### P1-T08: Server lifecycle in setup command

**Edit** `plugins/ai/commands/setup.md` and `plugins/ai/scripts/ai-companion.mjs`

Add `--ui` flag to `/ai:setup --init`:

1. After creating project directories, check if UI is built (`plugins/ai/ui/dist/server/index.js` exists)

2. If built, spawn server as background process:

```bash
node "${CLAUDE_PLUGIN_ROOT}/ui/dist/server/index.js" \
  --project-root "$PWD" --port 0 &
```

1. Write PID to `.claude/.ui-pid`

2. Wait for `.claude/.ui-port` to appear (max 5s)

3. Print: `Dashboard: http://127.0.0.1:{port}`

4. Open browser if possible: `xdg-open` / `open`

**Edit** `plugins/ai/scripts/session-lifecycle-hook.mjs`:

* On `SessionEnd`: read `.claude/.ui-pid`, send SIGTERM, remove `.ui-pid` and `.ui-port`

**Acceptance:** `/ai:setup --init --ui` starts server, session end kills it.

***

### P1-T09: Add .ui-port and .ui-pid to .gitignore

**Edit** `.gitignore` (or `.claude/.gitignore`)

```text
.claude/.ui-port
.claude/.ui-pid
```

**Acceptance:** `git status` does not show UI runtime files.

***

### Phase 1 Verification

1. `cd plugins/ai/ui && npm install && npm run build:server`

2. `node dist/server/index.js --project-root /tmp/test --port 3210`

3. `curl localhost:3210/api/health` → `{"status":"ok"}`

4. `wscat -c ws://localhost:3210/ws/events` → connected

5. `curl -X POST localhost:3210/api/events -H 'Content-Type: application/json' -d '{"type":"user_prompt","message":"test"}'` → event appears in wscat

6. Kill server → `.ui-port` removed

***

## Phase 2: Chat Feed UI + Event Widgets

**Goal:** React frontend with scrollable chat feed, 14 typed widgets, auto-scroll, event filtering. Full real-time session visualization.

**Depends on:** Phase 1 (server + event bus)

### P2-T01: React app skeleton

**Create** `plugins/ai/ui/src/main.tsx` — React 19 root, strict mode **Create** `plugins/ai/ui/src/App.tsx` — layout shell with sidebar + main area **Create** `plugins/ai/ui/src/index.css` — CSS reset, dark theme variables, monospace font base **Create** `plugins/ai/ui/index.html` — Vite entry point

Layout:

```text
┌─────────────┬────────────────────────────────┐
│  Sidebar    │  ChatFeed                       │
│  (240px)    │  (flex-grow)                    │
│             │                                  │
│  [filter]   │  [event] [event] [event]        │
│  [tree]     │  ...                             │
│             │  [terminal input]                │
└─────────────┴────────────────────────────────┘
```

**Acceptance:** `npm run dev` opens browser with empty layout shell.

***

### P2-T02: WebSocket client hook

**Create** `plugins/ai/ui/src/hooks/useEventStream.ts`

```typescript
function useEventStream(url: string): {
  events: SessionEvent[];
  connected: boolean;
  clear: () => void;
}
```

* Connect to `ws://{host}/ws/events`

* Auto-reconnect with exponential backoff (1s, 2s, 4s, max 30s)

* On connect: receive history replay batch

* On message: append to event array (React state)

* `clear()`: reset events array

* Cleanup on unmount

**Acceptance:** Hook connects, reconnects after server restart, events accumulate in state.

***

### P2-T03: ChatFeed container

**Create** `plugins/ai/ui/src/feed/ChatFeed.tsx`

* Scrollable container with `overflow-y: auto`

* Maps `events[]` to widget components via `EventRouter`

* Auto-scroll to bottom on new events (with "scroll lock" — disable auto-scroll if user scrolled up, re-enable on scroll to bottom)

* Shows connection status indicator (green dot / red dot + "reconnecting...")

* Empty state: "Waiting for session events..."

**Create** `plugins/ai/ui/src/feed/EventRouter.tsx`

* Switch on `event.type` + `event.tool` to select widget:

```text
user_prompt          → UserPrompt
tool_call + Bash     → BashCommand (preview)
tool_result + Bash   → BashCommand (with output)
tool_call + Edit     → CodeDiff (pending)
tool_result + Edit   → CodeDiff (with diff)
tool_result + Write  → FileCreate
tool_result + Read   → FileRead
tool_result + Grep   → SearchResult
tool_result + Glob   → SearchResult
tool_call + Agent    → AgentStart
agent_stop           → AgentResult
job_update           → JobStatus
stop_blocked         → LintResult or ReviewResult (from meta)
stop_requested       → SessionEvent
session_start/end    → SessionEvent
tool_result + WebSearch/WebFetch → WebResult
tool_call + AskUserQuestion     → QuestionWidget
*                    → GenericEvent (fallback)
```

**Acceptance:** Events render as correct widget types in scrollable feed.

***

### P2-T04: Core widgets — UserPrompt + SessionEvent

**Create** `plugins/ai/ui/src/feed/widgets/UserPrompt.tsx`

* Chat bubble (left-aligned, distinct background)

* Signal tag badge: colored pill — `[NEW]` blue, `[REVISION]` orange, `[ACCEPTED]` green, `[CONTINUE]` gray, `[QUESTION]` purple

* Timestamp in header

* Full prompt text (preserve newlines, markdown optional)

* Compact: first line visible, expand on click for long prompts

**Create** `plugins/ai/ui/src/feed/widgets/SessionEvent.tsx`

* Thin horizontal divider line with centered label

* `session_start`: "Session started" + timestamp + session ID

* `session_end`: "Session ended" + duration

* `stop_requested`: "Claude stopped" (if not blocked)

* Minimal height, muted colors

**Acceptance:** User prompts render with signal badges, session events as dividers.

***

### P2-T05: Tool widgets — BashCommand + CodeDiff + FileCreate

**Create** `plugins/ai/ui/src/feed/widgets/BashCommand.tsx`

* Dark terminal-style card

* Header: `$ {command}` (truncated to 120 chars, full on expand)

* Body: stdout/stderr output in `<pre>` with syntax highlighting (basic ANSI color parsing)

* Collapsible: collapsed by default if output > 20 lines

* Exit code badge: green for 0, red for non-zero

* Copy button for command and output

**Create** `plugins/ai/ui/src/feed/widgets/CodeDiff.tsx`

* Card with file path header + line range badge (`L45-67`)

* Unified diff view: red lines (removed), green lines (added)

* Parse `old_string` and `new_string` from event input to generate diff

* Use a simple inline diff algorithm (no heavy deps — `diff` npm package is 15KB)

* Collapsible for large diffs (> 30 lines)

* "Pending" state during `tool_call` (before result arrives): show spinner + file path

**Create** `plugins/ai/ui/src/feed/widgets/FileCreate.tsx`

* Card with file path + "NEW" badge

* Preview: first 20 lines of content with line numbers

* Language detection from extension for basic syntax highlighting

* Expandable to show full content

**Acceptance:** Bash commands show terminal-style output, edits show color diffs, new files show preview.

***

### P2-T06: Tool widgets — FileRead + SearchResult + WebResult

**Create** `plugins/ai/ui/src/feed/widgets/FileRead.tsx`

* Compact inline chip/badge (not a full card — reads are frequent and noisy)

* Shows: file icon + relative path + line range if present

* Click to expand: show read content (if available in event output)

* Can be grouped: consecutive reads collapse into "Read 5 files" expandable

**Create** `plugins/ai/ui/src/feed/widgets/SearchResult.tsx`

* Card for Grep/Glob results

* Header: search icon + pattern + file count

* Grep: show matching lines with highlights

* Glob: show file list as chips

* Collapsible if > 10 results

**Create** `plugins/ai/ui/src/feed/widgets/WebResult.tsx`

* Card for WebSearch/WebFetch

* WebSearch: query + result titles/snippets

* WebFetch: URL + response preview (truncated)

* Link icon in header

**Acceptance:** Reads show as compact chips, search results highlight matches.

***

### P2-T07: Agent + Job widgets

**Create** `plugins/ai/ui/src/feed/widgets/AgentStart.tsx`

* Card with agent icon + description

* Spinner animation while agent is running

* Shows: agent type, prompt preview (truncated), timestamp

* Indentation or left-border to visually group child events

**Create** `plugins/ai/ui/src/feed/widgets/AgentResult.tsx`

* Card replacing spinner with checkmark/X

* Duration badge

* Collapsible output

* Success/failure color coding

**Create** `plugins/ai/ui/src/feed/widgets/JobStatus.tsx`

* Card for Codex/Copilot jobs

* Shows: job ID, kind, status, phase, elapsed time

* Progress bar (if deterministic) or spinner

* Action buttons: `[View Result]` `[Cancel]` (trigger `/ai:result` / `/ai:cancel` via REST endpoint)

* Auto-updates as `job_update` events arrive (keyed by jobId, replace previous card)

* Status colors: running=blue, completed=green, failed=red, cancelled=gray

**Create** `plugins/ai/ui/src/feed/widgets/QuestionWidget.tsx`

* Card with question mark icon

* Shows the question text

* State: "pending" (waiting for user) → "answered" (after response)

* Options rendered as chips if present

**Acceptance:** Agent lifecycle shows start/running/complete states, jobs show live progress.

***

### P2-T08: Event filtering + sidebar controls

**Create** `plugins/ai/ui/src/layout/Sidebar.tsx`

* **Filter section** (top):

  * Toggle buttons for event categories:

    * `Prompts` (user_prompt)

    * `Tools` (tool_call, tool_result)

    * `Agents` (agent_start, agent_stop)

    * `Jobs` (job_update)

    * `System` (session_start, session_end, stop_*)

  * Tool sub-filters: Bash, Edit, Write, Read, Search (Grep+Glob)

  * Text search: filter events by content match

  * "Show reads" toggle (off by default — reads are noisy)

* **Stats section** (bottom):

  * Event count by type

  * Session duration

  * Connection status

**Acceptance:** Toggling filters instantly shows/hides events in feed. Read events hidden by default.

***

### P2-T09: Event grouping + noise reduction

**Create** `plugins/ai/ui/src/feed/EventGrouper.ts`

Logic to reduce visual noise:

1. **Consecutive reads**: Group 3+ consecutive `Read` events into a single "Read N files" expandable

2. **Tool call + result pairing**: Match `tool_call` with its `tool_result` by tool name + timestamp proximity → render as single widget with pending→complete transition

3. **Rapid glob/grep**: Group consecutive search operations into "Searched N patterns" summary

4. **Agent nesting**: Indent events between `agent_start` and `agent_stop` with a left border

**Acceptance:** Feed is readable even during high-throughput operations (e.g., agent reading 20 files).

***

### P2-T10: Dark/light theme + responsive layout

**Create** `plugins/ai/ui/src/styles/theme.ts`

* CSS custom properties for colors, spacing, typography

* Dark theme (default): dark backgrounds, high contrast text, colored badges

* Light theme: inverted, accessible contrast ratios

* Theme toggle in sidebar header

* Persist preference in localStorage

**Acceptance:** Theme toggle works, colors readable in both modes.

***

### Phase 2 Verification

1. `npm run dev` → browser shows chat feed

2. Trigger Claude Code actions (edit file, run bash, search) → widgets appear in real-time

3. User prompts show signal tags

4. Agent spawns show nested events

5. Codex jobs show progress

6. Filter toggles work

7. Auto-scroll works, scroll lock works

8. 100+ events render without lag

***

## Phase 3: BlockNote Project Editor

**Goal:** Rich document editor for `.project/` files using BlockNote. File tree navigation, markdown round-trip, custom blocks for YAML frontmatter and Mermaid.

**Depends on:** Phase 1 (server file routes), Phase 2 (layout shell)

### P3-T01: File CRUD REST API

**Create** `plugins/ai/ui/server/routes/files.ts`

Scoped to `{projectRoot}/.project/` only — reject any path traversal.

* `GET /api/files/tree` → recursive directory listing as JSON tree

```json
[
  { "name": "adr", "type": "dir", "children": [
    { "name": "ADR-05-redis.md", "type": "file", "size": 2048, "modified": "..." }
  ]},
  { "name": "fdr", "type": "dir", "children": [...] }
]
```

* `GET /api/files/:path(*)` → read file content (raw text)

* `PUT /api/files/:path(*)` → write file content (create or overwrite)

* `DELETE /api/files/:path(*)` → delete file

* `POST /api/files/mkdir/:path(*)` → create directory

Security:

* Resolve all paths, verify they're under `.project/`

* Reject paths containing `..`, symlinks outside scope

* Max file size: 1MB

**Create** `plugins/ai/ui/server/lib/file-watcher.ts`

* `fs.watch` on `.project/` recursively

* Emit `file_changed` events to EventBus (for editor refresh)

* Debounce: 300ms per file path

**Acceptance:** curl CRUD operations work, file tree reflects actual directory.

***

### P3-T02: File tree sidebar component

**Create** `plugins/ai/ui/src/editor/FileTree.tsx`

* Fetch tree from `GET /api/files/tree`

* Collapsible directory nodes with icons

* File icons by extension: `.md` document, `.yaml` data, `.svg` image

* Click file → opens in editor panel

* Right-click context menu: New file, New folder, Delete, Rename

* Auto-refresh on `file_changed` events from WebSocket

* Active file highlighted

* Directory groups: adr/, fdr/, implementation_plans/, todos/, cascades/, knowledge/, traces/

**Acceptance:** Tree shows all project files, click opens file, auto-refreshes on external changes.

***

### P3-T03: BlockNote editor integration

**Install** `@blocknote/core`, `@blocknote/react`, `@blocknote/mantine` (or `@blocknote/shadcn`)

**Create** `plugins/ai/ui/src/editor/DocumentEditor.tsx`

* BlockNote editor instance

* Markdown round-trip:

  * On open: `GET /api/files/:path` → parse markdown → BlockNote blocks

  * On save: BlockNote blocks → serialize to markdown → `PUT /api/files/:path`

* Auto-save: debounced (2s after last edit), with dirty indicator

* Manual save: `Ctrl+S` / `Cmd+S`

* Toolbar: headings, bold, italic, code, lists, links, tables

* Read-only mode for cascade records (REC-*.md)

**Acceptance:** Open ADR markdown, edit in BlockNote, save, re-open — content round-trips correctly.

***

### P3-T04: Custom BlockNote blocks — YAML frontmatter

**Create** `plugins/ai/ui/src/editor/blocks/FrontmatterBlock.tsx`

* Detects YAML frontmatter (`---` delimited) at file start

* Renders as a structured form:

  * Key-value pairs as label + input

  * Status fields as dropdown (Proposed/Accepted/Deprecated)

  * Date fields as date picker

  * Tags as chip input

* Serializes back to YAML `---` block on save

* Non-editable keys (name, date) shown as read-only

**Acceptance:** FDR/ADR frontmatter renders as form, edits serialize correctly.

***

### P3-T05: Custom BlockNote blocks — Mermaid diagrams

**Create** `plugins/ai/ui/src/editor/blocks/MermaidBlock.tsx`

* Detects fenced code blocks with `mermaid` language

* Split view: code editor (left) + live preview (right)

* Preview: render Mermaid in-browser using `mermaid` npm package (client-side, no mmdc needed)

* Syntax validation: red border + error message on invalid syntax

* "Copy SVG" button

* "Export" button → calls server-side `/ai:mermaid render` for high-quality SVG/PNG

**Acceptance:** Mermaid blocks in ADR/FDR render live diagrams, edits update preview.

***

### P3-T06: Custom BlockNote blocks — TODO YAML

**Create** `plugins/ai/ui/src/editor/blocks/TodoBlock.tsx`

* For `.yaml` files in `todos/` directory

* Parse YAML task arrays

* Render as Kanban-style card list grouped by status:

  * Columns: `pending` | `in_progress` | `complete` | `blocked`

* Each card shows: title, priority badge, assignee, ticket link, evidence

* Click card → expand with full details

* Drag between columns → updates status in YAML

* Serialize back to YAML on save

**Acceptance:** TODO YAML files render as Kanban board, drag updates status.

***

### P3-T07: Template insertion toolbar

**Create** `plugins/ai/ui/src/editor/TemplateToolbar.tsx`

* Dropdown button "Insert Template" in editor toolbar

* Options based on current directory:

  * `adr/` → ADR template skeleton

  * `fdr/` → FDR template skeleton

  * `implementation_plans/` → IMPL template skeleton

  * `knowledge/patterns/` → Pattern template

  * `knowledge/lessons/` → Lesson template

* Inserts template at cursor position

* Auto-generates next number (reads existing files)

**Acceptance:** Insert ADR template in adr/ folder → correctly numbered skeleton appears.

***

### P3-T08: Split view — feed + editor

**Update** `plugins/ai/ui/src/App.tsx`

* Three-panel layout: Sidebar | ChatFeed | Editor

* Resizable panels (drag handles)

* Editor panel collapsible (toggle button)

* When file opened: show editor panel, reduce feed width

* When no file open: feed takes full width

* Keyboard shortcut: `Ctrl+B` toggle sidebar, `Ctrl+E` toggle editor

**Acceptance:** All three panels visible, resizable, collapsible.

***

### Phase 3 Verification

1. File tree shows all `.project/` directories

2. Click ADR file → opens in BlockNote with formatted content

3. Edit + save → file on disk updated with correct markdown

4. YAML frontmatter renders as form

5. Mermaid blocks show live preview

6. TODO files render as Kanban

7. Insert template works

8. External changes (from Claude Code) trigger refresh

9. Split view resizable

***

## Phase 4: Terminal Integration

**Goal:** Embedded xterm.js terminal in the chat feed, running in the same project directory. Not the Claude Code session itself — a sibling shell for manual commands.

**Depends on:** Phase 1 (server), Phase 2 (feed layout)

### P4-T01: node-pty server-side setup

**Add dependency:** `node-pty` to `plugins/ai/ui/package.json`

**Create** `plugins/ai/ui/server/lib/pty.ts`

* `PtyManager` class:

  * `spawn(cwd: string, shell?: string)` → create PTY with project cwd

    * Default shell: `process.env.SHELL || '/bin/bash'`

    * Env: inherit `process.env` + add `TERM=xterm-256color`

    * Cols/rows: 120x30 default

  * `resize(cols: number, rows: number)` → resize PTY

  * `write(data: string)` → write to PTY stdin

  * `onData(callback: (data: string) => void)` → PTY stdout

  * `kill()` → terminate PTY process

* Single PTY per server instance (one terminal per dashboard)

* Auto-kill on server shutdown

**Create** `plugins/ai/ui/server/routes/terminal.ts`

* `GET /ws/terminal` (WebSocket upgrade):

  * On connect: spawn PTY if not exists, attach

  * Client → server messages:

    * `{ type: "input", data: "..." }` — write to PTY

    * `{ type: "resize", cols: N, rows: N }` — resize PTY

  * Server → client messages:

    * `{ type: "output", data: "..." }` — PTY stdout

    * `{ type: "exit", code: N }` — PTY process exited

  * On disconnect: keep PTY alive (reconnectable)

  * On second connection: attach to existing PTY (session sharing)

**Acceptance:** `wscat` connects to terminal WS, can send commands, receive output.

***

### P4-T02: xterm.js terminal component

**Add dependencies:** `@xterm/xterm`, `@xterm/addon-fit`, `@xterm/addon-web-links`, `@xterm/addon-search`

**Create** `plugins/ai/ui/src/terminal/TerminalPanel.tsx`

* xterm.js `Terminal` instance with:

  * `FitAddon` — auto-resize to container

  * `WebLinksAddon` — clickable URLs

  * `SearchAddon` — `Ctrl+Shift+F` search

* WebSocket connection to `/ws/terminal`

* On data (user types) → send to WS

* On WS message → write to terminal

* Send resize events on container resize (via ResizeObserver)

* Toolbar: Clear, Search, Copy, Paste, Fullscreen toggle

* Theme: match dashboard dark/light theme

**Acceptance:** Terminal renders, typing works, output displays, resize works.

***

### P4-T03: Terminal integration in chat feed

**Update** `plugins/ai/ui/src/App.tsx`

Two terminal modes:

1. **Docked panel** (default):

   * Fixed-height panel at bottom of chat feed (like VS Code terminal)

   * Drag handle to resize height

   * Toggle button to show/hide

   * Keyboard shortcut: `` Ctrl+` `` to toggle

2. **Inline block** (optional):

   * When user runs Bash commands via Claude Code, the BashCommand widget has an "Open in terminal" button

   * Clicking creates an inline terminal block in the feed pre-filled with the command

**Acceptance:** Terminal panel shows at bottom, toggleable, resizable.

***

### P4-T04: Cascade live feed panel

**Create** `plugins/ai/ui/src/feed/CascadeFeed.tsx`

Separate tab/view that shows the raw cascade log in real-time:

* Read `.claude/cascades/{branch}.md` on load

* `fs.watch` via server → WebSocket push on changes

* Rendered as formatted markdown with:

  * Signal tag color coding

  * File paths as clickable links (open in editor)

  * Timestamps highlighted

  * User prompt sections visually distinct

* Auto-scroll with scroll lock

This is the "raw log" view vs the "chat widget" view — user can switch between them.

**Acceptance:** Cascade log renders live, updates on new entries, links clickable.

***

### P4-T05: node-pty fallback for environments without native deps

**Create** `plugins/ai/ui/server/lib/pty-fallback.ts`

Not all environments support `node-pty` (requires `node-gyp`, Python, C++ compiler). Provide fallback:

* Try to `import("node-pty")` dynamically

* If fails: fall back to `child_process.spawn` with `script -q /dev/null bash` (Unix PTY emulation)

* Fallback limitations: no resize, no raw mode, basic I/O only

* Log warning: "node-pty not available, using basic terminal (install node-pty for full experience)"

**Acceptance:** Dashboard works without node-pty installed (degraded terminal).

***

### Phase 4 Verification

1. Terminal panel appears at bottom of chat feed

2. Typing `ls` shows directory listing

3. `cd` works, prompt updates

4. Terminal resizes with panel

5. `Ctrl+C` kills running process

6. Reconnect after page refresh preserves terminal session

7. Without node-pty: fallback terminal works (basic I/O)

8. Cascade feed shows raw log with color coding

***

## Phase 5 (Future): Advanced Features

Not in initial scope, but designed for:

### P5-T01: Command palette

* `Ctrl+K` opens command palette

* Quick access to all `/ai:*` commands

* Type to filter, Enter to execute via REST endpoint

### P5-T02: Diff review viewer

* When Codex review completes, render findings inline

* Click finding → jumps to file in editor at exact line

### P5-T03: Knowledge graph visualization

* D3.js force graph of knowledge entries

* Nodes: patterns, lessons, decisions, antipatterns

* Edges: references, triggers, related-to

### P5-T04: Multi-session support

* Tab bar for multiple concurrent sessions

* Each tab has its own event stream and terminal

### P5-T05: Notification system

* Browser notifications for:

  * Codex job completed

  * Lint gate blocked stop

  * Review gate finding

***

## Dependency DAG

```text
P1-T01 (package init)
  ├── P1-T02 (types) ──────────────────────────────────┐
  ├── P1-T03 (server skeleton) ─┬── P1-T04 (event bus) ┤
  │                              │                       │
  │                              ├── P1-T07 (job watch)  │
  │                              │                       │
  │   P1-T05 (hook emitter) ────┤                       │
  │   P1-T06 (hooks.json) ──────┘                       │
  │                                                      │
  ├── P1-T08 (setup command) ←── P1-T03                 │
  └── P1-T09 (.gitignore) — independent                 │
                                                         │
P2-T01 (React skeleton) ←── P1-T03, P1-T04              │
  ├── P2-T02 (WS hook) ←── P1-T04                       │
  ├── P2-T03 (ChatFeed) ←── P2-T02                      │
  │     ├── P2-T04 (UserPrompt + Session widgets)        │
  │     ├── P2-T05 (Bash + Diff + FileCreate widgets)   │
  │     ├── P2-T06 (Read + Search + Web widgets)         │
  │     ├── P2-T07 (Agent + Job widgets) ←── P1-T07     │
  │     └── P2-T09 (Event grouping)                      │
  ├── P2-T08 (Sidebar filters) ←── P2-T03               │
  └── P2-T10 (Theme) — independent                      │
                                                         │
P3-T01 (File CRUD API) ←── P1-T03 ──────────────────────┘
  ├── P3-T02 (File tree) ←── P3-T01
  ├── P3-T03 (BlockNote editor) ←── P3-T01
  │     ├── P3-T04 (Frontmatter block)
  │     ├── P3-T05 (Mermaid block)
  │     └── P3-T06 (TODO Kanban block)
  ├── P3-T07 (Template toolbar) ←── P3-T03
  └── P3-T08 (Split view) ←── P2-T03, P3-T03

P4-T01 (node-pty) ←── P1-T03
  ├── P4-T02 (xterm.js) ←── P4-T01
  ├── P4-T03 (Feed integration) ←── P4-T02, P2-T03
  ├── P4-T04 (Cascade live feed) ←── P2-T03, P3-T01
  └── P4-T05 (PTY fallback) ←── P4-T01
```

## Critical Path

```text
P1-T01 → P1-T03 → P1-T04 → P2-T01 → P2-T02 → P2-T03 → P2-T05 → P2-T08
                                                                      ↓
                                                              Usable MVP
```

**MVP = Phase 1 + Phase 2** — real-time session feed with all widgets. This alone is high-value.

***

## Files Summary

| Phase     | New Files                                                                          | Modified Files                                          |
| --------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------- |
| P1        | 8 (package, types, server, event-bus, routes, emitter, watcher)                    | 3 (hooks.json, setup.md, session-lifecycle, .gitignore) |
| P2        | 18 (React app, hooks, feed, 14 widgets, grouper, theme)                            | 0                                                       |
| P3        | 10 (file routes, watcher, tree, editor, 4 custom blocks, toolbar, layout)          | 1 (App.tsx)                                             |
| P4        | 6 (pty, terminal route, xterm component, feed integration, cascade feed, fallback) | 1 (App.tsx)                                             |
| **Total** | **42 new**                                                                         | **5 modified**                                          |

***

## Tech Stack Summary

| Layer            | Technology         | Version | Size                      |
| ---------------- | ------------------ | ------- | ------------------------- |
| Server           | Fastify            | 5.x     | ~200KB                    |
| WebSocket        | @fastify/websocket | 11.x    | ~20KB                     |
| Frontend         | React              | 19.x    | ~45KB                     |
| Bundler          | Vite               | 6.x     | dev only                  |
| Editor           | BlockNote          | latest  | ~200KB                    |
| Terminal         | @xterm/xterm       | 5.x     | ~150KB                    |
| PTY              | node-pty           | 1.x     | native                    |
| Diff             | diff               | 7.x     | ~15KB                     |
| Diagrams         | mermaid            | 11.x    | ~500KB (client-side only) |
| **Total bundle** |                    |         | **~1.1MB gzipped**        |
