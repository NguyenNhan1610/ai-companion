#!/usr/bin/env node
/**
 * Native statusLine handler for AI Companion plugin.
 * Reads the full Claude Code stdin JSON contract, extracts per-request
 * token metrics (4 cache-tier buckets) and session metrics (cost, duration,
 * lines), computes per-request deltas, and renders multi-line ANSI output.
 *
 * Invoked by Claude Code every ~300ms via settings.json statusLine.command.
 * Must complete within 200ms budget.
 *
 * Reference: ADR-01-native-statusline-stdin-telemetry.md
 */

import { computeDeltas } from "./lib/statusline-cache.mjs";

// ── ANSI helpers ──────────────────────────────────────────────────────
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const CYAN = "\x1b[36m";
const MAGENTA = "\x1b[35m";

// ── A1: Stdin reader with timeout guards ──────────────────────────────
const FIRST_BYTE_TIMEOUT_MS = 250;
const IDLE_TIMEOUT_MS = 30;
const MAX_STDIN_BYTES = 256 * 1024;

async function readStdin() {
  if (process.stdin.isTTY) return null;

  return new Promise((resolve) => {
    let raw = "";
    let settled = false;
    let sawData = false;
    let firstByteTimer;
    let idleTimer;

    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(firstByteTimer);
      clearTimeout(idleTimer);
      process.stdin.off("data", onData);
      process.stdin.off("end", onEnd);
      process.stdin.off("error", onError);
      process.stdin.pause();
      resolve(value);
    };

    const tryParse = () => {
      const trimmed = raw.trim();
      if (!trimmed) return null;
      try { return JSON.parse(trimmed); } catch { return undefined; }
    };

    const onData = (chunk) => {
      sawData = true;
      clearTimeout(firstByteTimer);
      raw += String(chunk);
      if (Buffer.byteLength(raw, "utf8") > MAX_STDIN_BYTES) { finish(null); return; }
      const parsed = tryParse();
      if (parsed !== undefined) { finish(parsed); return; }
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => finish(tryParse() ?? null), IDLE_TIMEOUT_MS);
    };

    const onEnd = () => finish(tryParse() ?? null);
    const onError = () => finish(null);

    process.stdin.setEncoding("utf8");
    firstByteTimer = setTimeout(() => { if (!sawData) finish(null); }, FIRST_BYTE_TIMEOUT_MS);
    process.stdin.on("data", onData);
    process.stdin.on("end", onEnd);
    process.stdin.on("error", onError);
  });
}

// ── A2: StdinData parser + token extraction ───────────────────────────
function parseTokens(stdin) {
  const usage = stdin?.context_window?.current_usage;
  return {
    input: usage?.input_tokens ?? 0,
    output: usage?.output_tokens ?? 0,
    cacheCreation: usage?.cache_creation_input_tokens ?? 0,
    cacheRead: usage?.cache_read_input_tokens ?? 0,
  };
}

function totalInputTokens(tokens) {
  return tokens.input + tokens.cacheCreation + tokens.cacheRead;
}

// ── A3: Context percentage (native + fallback) ────────────────────────
function getContextPercent(stdin, tokens) {
  const native = stdin?.context_window?.used_percentage;
  if (typeof native === "number" && Number.isFinite(native)) {
    return Math.min(100, Math.max(0, Math.round(native)));
  }
  const size = stdin?.context_window?.context_window_size;
  if (!size || size <= 0) return 0;
  return Math.min(100, Math.round((totalInputTokens(tokens) / size) * 100));
}

// ── A4: Session metrics extraction ────────────────────────────────────
function getSessionMetrics(stdin) {
  const cost = stdin?.cost;
  return {
    costUsd: typeof cost?.total_cost_usd === "number" && Number.isFinite(cost.total_cost_usd) ? cost.total_cost_usd : null,
    durationMs: typeof cost?.total_duration_ms === "number" ? cost.total_duration_ms : null,
    apiDurationMs: typeof cost?.total_api_duration_ms === "number" ? cost.total_api_duration_ms : null,
    linesAdded: typeof cost?.total_lines_added === "number" ? cost.total_lines_added : null,
    linesRemoved: typeof cost?.total_lines_removed === "number" ? cost.total_lines_removed : null,
  };
}

// ── Formatting helpers ────────────────────────────────────────────────
function fmtTokens(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}k`;
  return String(n);
}

function fmtCost(usd) {
  if (usd >= 1) return `$${usd.toFixed(2)}`;
  if (usd >= 0.1) return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(4)}`;
}

function fmtDuration(ms) {
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "<1m";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ${mins % 60}m`;
}

function contextColor(percent) {
  if (percent >= 85) return RED;
  if (percent >= 70) return YELLOW;
  return GREEN;
}

function renderBar(percent, width = 10) {
  const filled = Math.round((percent / 100) * width);
  const empty = width - filled;
  const color = contextColor(percent);
  return `${color}${"█".repeat(filled)}${"░".repeat(empty)}${RESET}`;
}

// ── C1: Render Line 1 — model, progress bar, tokens (with deltas), cost
function renderLine1(stdin, tokens, contextPct, session, deltas) {
  const model = stdin?.model?.display_name?.replace(/\s*\([^)]*\bcontext\b[^)]*\)/i, "").trim()
    || stdin?.model?.id || "Unknown";

  const parts = [];

  // Model badge + context bar + percentage
  const color = contextColor(contextPct);
  parts.push(`${CYAN}${BOLD}[${model}]${RESET} ${renderBar(contextPct)} ${color}${contextPct}%${RESET}`);

  // Token display with inline per-request deltas: in: 136k (+2.1k) out: 12 (+8)
  const inDelta = deltas.lastInputDelta ? ` ${YELLOW}(+${fmtTokens(deltas.lastInputDelta)})${RESET}${DIM}` : "";
  const outDelta = deltas.lastOutputDelta ? ` ${YELLOW}(+${fmtTokens(deltas.lastOutputDelta)})${RESET}${DIM}` : "";

  if (contextPct >= 85) {
    // C2: Per-bucket breakdown at high context
    parts.push(`${DIM}in: ${fmtTokens(tokens.input)}${inDelta} cw: ${fmtTokens(tokens.cacheCreation)} cr: ${fmtTokens(tokens.cacheRead)}${RESET}`);
  } else {
    parts.push(`${DIM}in: ${fmtTokens(totalInputTokens(tokens))}${inDelta} out: ${fmtTokens(tokens.output)}${outDelta}${RESET}`);
  }

  // Cost
  if (session.costUsd !== null) {
    parts.push(`${DIM}cost: ${fmtCost(session.costUsd)}${RESET}`);
  }

  return parts.join(" │ ");
}

// ── C3: Render Line 2 — API ratio, duration, lines changed ───────────
function renderLine2(session) {
  const parts = [];

  // API duration ratio
  if (session.apiDurationMs !== null && session.durationMs !== null && session.durationMs > 0) {
    const ratio = Math.round((session.apiDurationMs / session.durationMs) * 100);
    parts.push(`${DIM}api: ${ratio}%${RESET}`);
  }

  // Session duration
  if (session.durationMs !== null) {
    parts.push(`${DIM}time: ${fmtDuration(session.durationMs)}${RESET}`);
  }

  // Lines changed
  if (session.linesAdded !== null || session.linesRemoved !== null) {
    const added = session.linesAdded ?? 0;
    const removed = session.linesRemoved ?? 0;
    parts.push(`${DIM}lines: ${RESET}${GREEN}+${added}${RESET} ${RED}-${removed}${RESET}`);
  }

  return parts.length > 0 ? parts.join(" │ ") : null;
}

// ── C4: Graceful degradation ──────────────────────────────────────────
function renderFallback() {
  return `${DIM}[AI Companion] Initializing...${RESET}`;
}

// ── Main ──────────────────────────────────────────────────────────────
async function main() {
  try {
    const stdin = await readStdin();

    if (!stdin) {
      process.stdout.write(renderFallback() + "\n");
      return;
    }

    const tokens = parseTokens(stdin);
    const contextPct = getContextPercent(stdin, tokens);
    const session = getSessionMetrics(stdin);
    const deltas = computeDeltas({
      inputTokens: totalInputTokens(tokens),
      outputTokens: tokens.output,
      ts: Date.now(),
    });

    // Line 1: model + context bar + tokens (with per-request deltas) + cost
    const line1 = renderLine1(stdin, tokens, contextPct, session, deltas);
    process.stdout.write(line1 + "\n");

    // Line 2: api ratio + duration + lines (only if any data)
    const line2 = renderLine2(session);
    if (line2) {
      process.stdout.write(line2 + "\n");
    }
  } catch {
    process.stdout.write(renderFallback() + "\n");
  }
}

main();
