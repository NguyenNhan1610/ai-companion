# ADR-01: Native Per-Request Token Metrics and Session Metrics via statusLine Stdin

**Status:** Proposed
**Date:** 2026-04-13
**Author:** AI Companion Team
**Scope:** Backend
**Deciders:** Plugin maintainers

---

## Context

Claude Code invokes the configured `statusLine.command` approximately every 300ms, piping a JSON payload to stdin. This payload contains **native, authoritative token accounting** — the same numbers Claude Code shows via `/context`. The data is cumulative (updated after each API response), giving real-time visibility into token consumption across all four cache tiers, context window utilization, and session-level cost/duration metrics.

The reference implementation [jarrodwatts/claude-hud](https://github.com/jarrodwatts/claude-hud) (`src/types.ts`, `src/stdin.ts`, `src/transcript.ts`, `src/speed-tracker.ts`, `src/cost.ts`) demonstrates how to consume this contract. This ADR decides how to adopt it for per-request token visibility and session metrics in the AI Companion plugin.

---

## Decision

Adopt the Claude Code native statusLine stdin JSON contract as the authoritative source for per-request token metrics and session metrics. Consume the exact fields listed below; use optional chaining for all access since every field may be absent.

---

## Implementation Method

### Why statusLine, Not Hooks

Claude Code hook events (`PostToolUse`, `Stop`, `SessionEnd`, etc.) receive only `session_id`, `transcript_path`, `cwd`, `permission_mode`, and event-specific fields (tool name/input/result). **No hook event receives token usage, cost, or session metrics.** The `statusLine.command` contract is the only integration point that delivers native token/cost data.

### Current State

The plugin uses a bash statusline script (`/root/.claude/statusline-command.sh`) that extracts 3 fields:

```bash
model=$(echo "$input" | jq -r '.model.display_name // empty')
used=$(echo "$input" | jq -r '.context_window.used_percentage // empty')
cwd=$(echo "$input" | jq -r '.cwd // empty')
```

Output: `user@host:dir | Opus 4.6 | ctx: 45%`

### Target State

Replace the bash script with a Node.js statusline handler at `plugins/ai/scripts/statusline-handler.mjs` that:

1. **Reads full StdinData** — parse the complete JSON from stdin (not just 3 fields)
2. **Extracts all 4 token buckets** — `input_tokens`, `output_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens`
3. **Computes per-request deltas** — cache previous cumulative values in a temp file, diff on next invocation to get per-request token speed and token-per-request counts
4. **Reads session metrics** — `cost.total_cost_usd`, `total_duration_ms`, `total_api_duration_ms`, `total_lines_added/removed`
5. **Renders multi-line output** with token breakdown and session metrics

### File Changes

| File | Action | Purpose |
|------|--------|---------|
| `plugins/ai/scripts/statusline-handler.mjs` | **Create** | Node.js statusline script that reads stdin JSON, extracts tokens + session metrics, computes deltas, renders output |
| `plugins/ai/scripts/lib/statusline-cache.mjs` | **Create** | Delta cache: read/write previous cumulative values to temp file for per-request diff |
| `plugins/ai/commands/setup.md` | **Update** | Add step to write `statusLine.command` pointing at the new handler into `~/.claude/settings.json` |
| `plugins/ai/hooks/hooks.json` | **No change** | Hooks cannot provide token data; no hook changes needed |

### statusline-handler.mjs Architecture

```
stdin (JSON ~1KB) → parse StdinData
  ├── context_window.current_usage → 4 token buckets (cumulative)
  ├── context_window.used_percentage → native context % (or fallback calc)
  ├── cost.* → session cost, duration, API duration, lines added/removed
  └── model.display_name → model badge
  
delta cache (read prev → diff → write current)
  ├── Δ output_tokens / Δ time → tok/s speed
  └── Δ input_tokens → tokens consumed since last invocation

render → stdout (multi-line ANSI)
  Line 1: [Model] ████░░░░ 45% | in: 38k out: 7k cache: 12k | $0.42
  Line 2: speed: 42.1 tok/s | api: 65% of wall time | +120 -30 lines
```

### Delta Cache Strategy

Since stdin provides **cumulative** session totals (not per-request), we derive per-request deltas by caching the previous reading:

```javascript
// statusline-cache.mjs
const CACHE_PATH = '/tmp/.claude-statusline-cache.json';

export function computeDeltas(current) {
  const prev = readCache();
  const deltas = {
    outputSpeed: null,       // tok/s
    inputDelta: 0,           // tokens since last invocation
    outputDelta: 0,          // tokens since last invocation  
  };
  
  if (prev && current.ts - prev.ts > 0 && current.ts - prev.ts <= 2000) {
    const dtSec = (current.ts - prev.ts) / 1000;
    deltas.outputDelta = current.outputTokens - prev.outputTokens;
    deltas.inputDelta = current.inputTokens - prev.inputTokens;
    if (deltas.outputDelta > 0) {
      deltas.outputSpeed = deltas.outputDelta / dtSec;
    }
  }
  
  writeCache(current);
  return deltas;
}
```

### Setup Integration

The `/ai:setup` command (or a new `/ai:statusline` command) will write the statusLine config:

```json
{
  "statusLine": {
    "type": "command",
    "command": "node \"/path/to/plugins/ai/scripts/statusline-handler.mjs\""
  }
}
```

This replaces the current bash script. The setup command resolves the absolute path from `CLAUDE_PLUGIN_ROOT` at install time.

---

## Section 1: Per-Request Token Metrics (Stdin Native)

### 1.1 Schema

Claude Code delivers these fields on stdin every ~300ms. Values are **cumulative session totals**, updated after each API response:

```typescript
interface StdinData {
  model?: {
    id?: string;           // e.g. "claude-opus-4-6"
    display_name?: string; // "Opus 4.6 (1M context)"
  };
  context_window?: {
    context_window_size?: number;  // max tokens (200000 or 1048576)
    current_usage?: {
      input_tokens?: number;                  // uncached input tokens sent
      output_tokens?: number;                 // tokens generated by model
      cache_creation_input_tokens?: number;   // tokens written to prompt cache this session
      cache_read_input_tokens?: number;       // tokens read from prompt cache this session
    } | null;
    used_percentage?: number | null;      // 0-100, native (v2.1.6+), accounts for autocompact buffer
    remaining_percentage?: number | null; // inverse of used_percentage
  };
}
```

**Evidence:** `claude-hud/src/types.ts:4-19` — the `StdinData` interface. `claude-hud/src/stdin.ts:134-170` — `getTotalTokens()`, `getContextPercent()`, `getBufferedPercent()` all read from this schema.

### 1.2 Total Token Computation

Total context tokens consumed = sum of all four buckets:

```typescript
// claude-hud/src/stdin.ts:134-141
function getTotalTokens(stdin: StdinData): number {
  const usage = stdin.context_window?.current_usage;
  return (
    (usage?.input_tokens ?? 0) +
    (usage?.cache_creation_input_tokens ?? 0) +
    (usage?.cache_read_input_tokens ?? 0)
  );
}
```

Note: `output_tokens` is tracked separately — it does not count toward context window consumption but is critical for cost calculation and speed tracking.

### 1.3 Context Percentage (Native vs Fallback)

```typescript
// claude-hud/src/stdin.ts:147-170
function getContextPercent(stdin: StdinData): number {
  // Prefer native percentage (v2.1.6+) — accurate, matches /context
  const native = stdin.context_window?.used_percentage;
  if (typeof native === 'number' && !Number.isNaN(native)) {
    return Math.min(100, Math.max(0, Math.round(native)));
  }

  // Fallback: manual calculation (pre-v2.1.6)
  const size = stdin.context_window?.context_window_size;
  if (!size || size <= 0) return 0;
  const totalTokens = getTotalTokens(stdin);
  return Math.min(100, Math.round((totalTokens / size) * 100));
}
```

The native `used_percentage` accounts for Claude Code's internal autocompact buffer (`AUTOCOMPACT_BUFFER_PERCENT = 0.165` per `claude-hud/src/constants.ts`). Manual calculation does not, which is why it underestimates context pressure.

### 1.4 Per-Request Delta: Output Token Speed

Since stdin values are cumulative, per-request deltas require diffing between invocations. claude-hud does this for output token speed:

```typescript
// claude-hud/src/speed-tracker.ts:56-78
function getOutputSpeed(stdin: StdinData): number | null {
  const outputTokens = stdin.context_window?.current_usage?.output_tokens;
  // Read previous cache, compute delta
  const deltaTokens = outputTokens - previous.outputTokens;
  const deltaMs = now - previous.timestamp;
  if (deltaTokens > 0 && deltaMs > 0 && deltaMs <= 2000) {
    return deltaTokens / (deltaMs / 1000); // tokens/sec
  }
}
```

This pattern (cache previous value → diff on next invocation) applies to any per-request metric we want to derive from the cumulative stdin values.

### 1.5 Per-Message Token Usage (Transcript JSONL)

The transcript file (path from `stdin.transcript_path`) contains per-message `usage` blocks on `type: "assistant"` lines:

```typescript
// claude-hud/src/transcript.ts:9-23, 234-239
interface TranscriptLine {
  type?: string;  // "assistant"
  message?: {
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
    };
  };
}

// Accumulation (lines 234-239):
if (entry.type === 'assistant' && entry.message?.usage) {
  sessionTokens.inputTokens += usage.input_tokens;
  sessionTokens.outputTokens += usage.output_tokens;
  sessionTokens.cacheCreationTokens += usage.cache_creation_input_tokens;
  sessionTokens.cacheReadTokens += usage.cache_read_input_tokens;
}
```

This gives **per-assistant-response granularity** but has caveats:
- After autocompact, transcript retains full history while actual live usage drops — sums will overestimate
- Transcript parsing is heavier than stdin reading (JSONL line-by-line vs single JSON blob)
- claude-hud mitigates cost via mtime-based caching (`transcript.ts:88-178`)

### 1.6 Display Formats

claude-hud renders token data in two modes (`session-line.ts:201-248`):

**Session token totals** (opt-in via `showSessionTokens`):
```
tok: 45k (in: 38k, out: 7k)
```

**Token breakdown at high context** (auto at ≥85% `used_percentage`):
```
[Opus] █████████░ 87% (in: 150k, cache: 42k)
```

**Output speed** (opt-in via `showSpeed`):
```
out: 42.1 tok/s
```

---

## Section 2: Session Metrics (Stdin Native)

### 2.1 Schema

```typescript
interface StdinData {
  cost?: {
    total_cost_usd?: number | null;        // cumulative session cost (billing-accurate)
    total_duration_ms?: number | null;     // wall-clock session duration
    total_api_duration_ms?: number | null; // API call time only (excludes tool execution)
    total_lines_added?: number | null;     // lines added across all file edits
    total_lines_removed?: number | null;   // lines removed across all file edits
  } | null;
}
```

**Evidence:** `claude-hud/src/types.ts:21-29`.

### 2.2 Native Cost vs Transcript Estimation

claude-hud uses a two-tier cost resolution (`cost.ts:130-151`):

```typescript
function resolveSessionCost(stdin, sessionTokens): SessionCostDisplay | null {
  // Tier 1: native cost from stdin (authoritative)
  const native = stdin.cost?.total_cost_usd;
  if (typeof native === 'number' && Number.isFinite(native)) {
    return { totalUsd: native, source: 'native' };
  }

  // Tier 2: estimate from transcript token sums + model pricing tables
  const estimate = estimateSessionCost(stdin, sessionTokens);
  if (estimate) {
    return { totalUsd: estimate.totalUsd, source: 'estimate' };
  }
  return null;
}
```

The estimation fallback uses model-specific pricing (`cost.ts:26-32`):
- Opus 4: $15/M input, $75/M output
- Sonnet 4: $3/M input, $15/M output
- Haiku 3.5: $0.8/M input, $4/M output
- Cache write: 1.25× input rate; cache read: 0.1× input rate

### 2.3 Session Duration

Derived from transcript `sessionStart` timestamp (`index.ts:123-140`):
```typescript
function formatSessionDuration(sessionStart?: Date): string {
  const ms = Date.now() - sessionStart.getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "<1m";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ${mins % 60}m`;
}
```

### 2.4 API Duration Ratio

`total_api_duration_ms / total_duration_ms` gives the fraction of session time spent waiting for API responses vs tool execution. This is not displayed by claude-hud but is available in the stdin contract for instrumentation.

---

## Section 3: Why Native Over Estimation

| Factor | Native (stdin) | Estimated (transcript) |
|--------|---------------|----------------------|
| **Autocompact** | Reflects post-compaction state | Sums full pre-compaction history → overestimates |
| **1M context** | 1% = 10K tokens, needs exact accounting | Heuristic drift compounds at scale |
| **Cache tiers** | 4 separate buckets, correct multipliers | Requires per-message deduplication, retry handling |
| **Cost** | `total_cost_usd` from Claude Code billing | Estimate via pricing tables, tilde-prefixed |
| **Parity with /context** | Identical numbers | Approximation that may confuse users |
| **Performance** | Single JSON parse (~1KB payload) | Line-by-line JSONL parse of growing file |

---

## Section 4: Fallback Behavior

| Condition | Behavior |
|---|---|
| `used_percentage` absent (pre-v2.1.6) | Manual: `(total_tokens / context_window_size) × 100` with autocompact buffer heuristic |
| `current_usage` absent | Show `ctx: --`; skip token breakdown |
| `output_tokens` absent | Speed tracker returns null; hide speed display |
| `cost.total_cost_usd` absent | Estimate from transcript tokens × model pricing; prefix with `~` |
| `cost.total_duration_ms` absent | Derive from transcript `sessionStart` timestamp |
| Complete stdin failure (TTY, empty pipe, timeout) | Static `[Initializing...]` message; no crash |

---

## Section 5: Stdin Contract Details

### 5.1 Invocation Cadence

Claude Code calls `statusLine.command` approximately every **300ms**. The script must complete within this budget. All I/O is stdin (JSON read) + stdout (rendered output). No network calls.

### 5.2 Stdin Reader Timeouts

Per `claude-hud/src/stdin.ts:15-17`:
- **First byte timeout:** 250ms — if no data arrives, return null (not an error)
- **Idle timeout:** 30ms — after data starts flowing, if 30ms pass without new data, attempt parse
- **Max stdin bytes:** 256KB — safety cap; real payloads are well under 1KB

### 5.3 Settings Configuration

```json
{
  "statusLine": {
    "type": "command",
    "command": "node \"/path/to/statusline-handler.mjs\""
  }
}
```

Written to `~/.claude/settings.json`. Claude Code reads it on startup.

---

## Architecture Acceptance Criteria (AAC)

| ID | Criterion | Verification |
|----|-----------|-------------|
| AAC-01 | `statusline-handler.mjs` reads and parses all 4 token buckets from stdin | Unit test: pipe sample JSON, verify extraction |
| AAC-02 | Prefer native `used_percentage` when present; fall back to manual calculation when absent | Unit test: with/without `used_percentage` |
| AAC-03 | `statusline-cache.mjs` computes per-request output token speed via delta between consecutive invocations | Unit test: two sequential calls with different `output_tokens` values |
| AAC-04 | Display session token totals (cumulative input + output + cache) on Line 1 | Unit test: verify formatted output |
| AAC-05 | Display token breakdown at ≥85% context usage | Unit test: verify breakdown appears at 85%, hidden at 84% |
| AAC-06 | Display native `cost.total_cost_usd` and `total_duration_ms` on Line 2 | Unit test: verify cost/duration rendering |
| AAC-07 | Graceful null/absent handling for every field via optional chaining; empty stdin produces `[Initializing...]` | Unit test with empty `StdinData` |
| AAC-08 | Complete within 200ms including stdin read | Performance test with typical payload |
| AAC-09 | `/ai:setup` writes `statusLine.command` pointing at `statusline-handler.mjs` into `~/.claude/settings.json` | Integration test: run setup, verify settings.json |

---

## References

- **Reference implementation:** [jarrodwatts/claude-hud](https://github.com/jarrodwatts/claude-hud)
  - `src/types.ts:4-40` — `StdinData` interface (canonical schema)
  - `src/stdin.ts:134-170` — token computation, context percentage, native vs fallback
  - `src/stdin.ts:15-132` — stdin reader with timeout guards
  - `src/speed-tracker.ts` — per-request output token speed via delta caching
  - `src/transcript.ts:207-239` — per-message token accumulation from transcript JSONL
  - `src/cost.ts:117-151` — native vs estimated cost resolution
  - `src/cost.ts:23-24` — cache tier multipliers (write=1.25×, read=0.1×)
  - `src/render/session-line.ts:201-248` — token display and breakdown rendering
  - `src/constants.ts` — `AUTOCOMPACT_BUFFER_PERCENT = 0.165`

---

## Consequences

### Positive
- Exact token visibility matching Claude Code's own `/context` output
- All 4 cache tiers tracked natively (input, output, cache write, cache read)
- Per-request delta computation enables output speed display
- Native cost eliminates estimation drift

### Negative
- Stdin contract is undocumented by Anthropic — could change without notice (mitigated by optional chaining)
- Cumulative-only stdin means per-request deltas require state caching between invocations
- Node.js cold start (~50-80ms) vs bash (~5ms) per invocation

### Neutral
- Transcript JSONL remains available for per-message granularity if needed in future
- `remaining_percentage` intentionally excluded as redundant inverse of `used_percentage`
