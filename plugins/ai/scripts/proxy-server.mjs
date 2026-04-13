#!/usr/bin/env node
/**
 * Reverse proxy for Claude Code API requests.
 *
 * Sits between Claude Code and api.anthropic.com as a pure passthrough.
 * Logs full request/response pairs to daily JSONL files for deep telemetry:
 * cache hit rate, quota burn, context size, per-session stats.
 *
 * Performance: The hot path is stream piping — upstreamRes.pipe(clientRes).
 * All logging, stats, and SSE fan-out are async and off the critical path.
 *
 * Security: API keys are stripped from log entries (still forwarded upstream).
 * Stripped headers: x-api-key, authorization, cookie, proxy-authorization.
 * Binds to 127.0.0.1 only (not 0.0.0.0).
 *
 * Ported from ccproxycache/reverse-proxy/main.py (Python) to Node.js.
 *
 * Reference: FDR-02-proxy-metrics-integration.md
 */

import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import process from "node:process";
import { URL } from "node:url";

// ── Configuration ────────────────────────────────────────────────────

const PROXY_PORT = parseInt(process.env.PROXY_PORT || "7001", 10);
const UPSTREAM_URL = process.env.ANTHROPIC_FORWARD_URL || "https://api.anthropic.com";
const LOG_DIR = process.env.PROXY_LOG_DIR || path.join(process.cwd(), ".claude", "proxy-logs");
const LOG_MAX_DAYS = parseInt(process.env.PROXY_LOG_MAX_DAYS || "30", 10);
const STATS_FILE = process.env.PROXY_STATS_FILE || "";
const MAX_SSE_CLIENTS = 5;
const MAX_BODY_LOG_BYTES = 100 * 1024; // 100KB truncation for logged request bodies
const UPSTREAM_TIMEOUT_MS = 600_000; // 10 minutes for streaming

// ── Headers ──────────────────────────────────────────────────────────

/** Hop-by-hop headers that must not be forwarded (HTTP spec). */
const HOP_BY_HOP = new Set([
  "connection", "keep-alive", "proxy-authenticate", "proxy-authorization",
  "te", "trailers", "transfer-encoding", "upgrade",
]);

/** Additional headers stripped from the request before forwarding. */
const STRIP_REQUEST = new Set(["host"]);

/** Headers stripped from upstream response before relaying to client. */
const STRIP_RESPONSE = new Set(["transfer-encoding", "connection", "content-encoding"]);

/** Auth headers stripped from JSONL log entries (still forwarded to upstream). */
const STRIP_LOG_HEADERS = new Set([
  "x-api-key", "authorization", "cookie", "proxy-authorization",
]);

// ── Uptime ───────────────────────────────────────────────────────────

const START_TIME = Date.now();

// ── SSE client registry ──────────────────────────────────────────────

/** @type {Set<import("node:http").ServerResponse>} */
const sseClients = new Set();

function broadcastSSE(jsonLine) {
  for (const client of sseClients) {
    try {
      client.write(`data: ${jsonLine}\n\n`);
    } catch {
      sseClients.delete(client);
    }
  }
}

// ── Stats accumulator ────────────────────────────────────────────────

const stats = {
  proxyPort: PROXY_PORT,
  upSince: new Date().toISOString(),
  totalRequests: 0,
  totalErrors: 0,
  cacheHitRate: 0,
  cacheSummary: {
    cacheCreationTokens: 0,
    cacheReadTokens: 0,
    uncachedInputTokens: 0,
  },
  quotaBurn: {
    last5h: null,
    last7d: null,
  },
  lastRequest: null,
  updatedAt: new Date().toISOString(),
};

function updateStats(logEntry) {
  stats.totalRequests++;
  if (logEntry.error || (logEntry.response_status && logEntry.response_status >= 400)) {
    stats.totalErrors++;
  }

  const usage = logEntry.response_usage;
  if (usage) {
    const cacheCreate = usage.cache_creation_input_tokens || 0;
    const cacheRead = usage.cache_read_input_tokens || 0;
    const input = usage.input_tokens || 0;

    stats.cacheSummary.cacheCreationTokens += cacheCreate;
    stats.cacheSummary.cacheReadTokens += cacheRead;
    stats.cacheSummary.uncachedInputTokens += input;

    const totalCached = stats.cacheSummary.cacheReadTokens + stats.cacheSummary.cacheCreationTokens;
    if (totalCached > 0) {
      stats.cacheHitRate = stats.cacheSummary.cacheReadTokens / totalCached;
    }

    stats.lastRequest = {
      timestamp: logEntry.timestamp,
      model: logEntry.model,
      elapsedMs: Math.round((logEntry.elapsed_s || 0) * 1000),
      inputTokens: input,
      outputTokens: usage.output_tokens || 0,
      cacheReadTokens: cacheRead,
      cacheCreationTokens: cacheCreate,
    };
  }

  // Extract quota info from response headers
  const rh = logEntry.response_headers;
  if (rh) {
    const u5h = parseFloat(rh["anthropic-ratelimit-unified-5h-utilization"]);
    const u7d = parseFloat(rh["anthropic-ratelimit-unified-7d-utilization"]);
    if (Number.isFinite(u5h)) {
      stats.quotaBurn.last5h = {
        utilization: u5h,
        reset: parseInt(rh["anthropic-ratelimit-unified-5h-reset"] || "0", 10) || null,
      };
    }
    if (Number.isFinite(u7d)) {
      stats.quotaBurn.last7d = {
        utilization: u7d,
        reset: parseInt(rh["anthropic-ratelimit-unified-7d-reset"] || "0", 10) || null,
      };
    }
  }

  stats.updatedAt = new Date().toISOString();
}

let statsWriteTimer = null;

function startStatsSync() {
  if (!STATS_FILE) return;
  statsWriteTimer = setInterval(() => {
    const tmpFile = `${STATS_FILE}.tmp`;
    try {
      fs.writeFileSync(tmpFile, JSON.stringify(stats, null, 2) + "\n", "utf8");
      fs.renameSync(tmpFile, STATS_FILE);
    } catch {
      // Ignore write failures — stats file is best-effort
    }
  }, 5000);
  statsWriteTimer.unref();
}

// ── JSONL Logging ────────────────────────────────────────────────────

function todayLogPath() {
  const date = new Date().toISOString().slice(0, 10);
  return path.join(LOG_DIR, `${date}.jsonl`);
}

function stripAuthHeaders(headers) {
  const stripped = {};
  for (const [k, v] of Object.entries(headers)) {
    if (!STRIP_LOG_HEADERS.has(k.toLowerCase())) {
      stripped[k] = v;
    }
  }
  return stripped;
}

function appendLog(entry) {
  // Runtime assertion: verify no auth headers leaked
  if (entry.request_headers) {
    for (const key of STRIP_LOG_HEADERS) {
      if (key in entry.request_headers || key.toLowerCase() in entry.request_headers) {
        delete entry.request_headers[key];
        delete entry.request_headers[key.toLowerCase()];
      }
    }
  }

  const line = JSON.stringify(entry, jsonReplacer) + "\n";
  const logPath = todayLogPath();

  // Async write — never blocks the hot path
  fs.appendFile(logPath, line, { mode: 0o600 }, (err) => {
    if (err && err.code === "ENOENT") {
      // Directory may have been removed; recreate and retry once
      try {
        fs.mkdirSync(LOG_DIR, { recursive: true, mode: 0o700 });
        fs.appendFileSync(logPath, line, { mode: 0o600 });
      } catch { /* give up silently */ }
    }
  });

  // Update stats (microsecond-level — in-memory counters only)
  updateStats(entry);

  // Fan out to SSE clients (deferred)
  if (sseClients.size > 0) {
    process.nextTick(() => broadcastSSE(JSON.stringify(entry, jsonReplacer)));
  }
}

function jsonReplacer(_key, value) {
  if (typeof value === "bigint") return Number(value);
  return value;
}

function readLogs(date, limit = 200) {
  const entries = [];
  let paths;

  if (date) {
    paths = [path.join(LOG_DIR, `${date}.jsonl`)];
  } else {
    try {
      paths = fs.readdirSync(LOG_DIR)
        .filter(f => f.endsWith(".jsonl"))
        .sort()
        .reverse()
        .map(f => path.join(LOG_DIR, f));
    } catch {
      return [];
    }
  }

  for (const p of paths) {
    let content;
    try { content = fs.readFileSync(p, "utf8"); } catch { continue; }
    for (const line of content.split("\n")) {
      if (!line.trim()) continue;
      try { entries.push(JSON.parse(line)); } catch { /* skip */ }
    }
  }

  entries.sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));
  return entries.slice(0, limit);
}

function getLogDates() {
  try {
    return fs.readdirSync(LOG_DIR)
      .filter(f => f.endsWith(".jsonl"))
      .map(f => f.replace(".jsonl", ""))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

// ── Log rotation ─────────────────────────────────────────────────────

function cleanupOldLogs() {
  if (LOG_MAX_DAYS <= 0) return;
  try {
    const files = fs.readdirSync(LOG_DIR).filter(f => f.endsWith(".jsonl"));
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - LOG_MAX_DAYS);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    let cleaned = 0;

    for (const f of files) {
      const dateStr = f.replace(".jsonl", "");
      if (dateStr < cutoffStr) {
        try {
          fs.unlinkSync(path.join(LOG_DIR, f));
          cleaned++;
        } catch { /* skip */ }
      }
    }

    if (cleaned > 0) {
      process.stderr.write(`[proxy] cleaned ${cleaned} old log file(s)\n`);
    }
  } catch { /* log dir may not exist yet */ }
}

// ── SSE Parsing ──────────────────────────────────────────────────────

function parseSSEChunks(chunks) {
  const textParts = [];
  const usage = {};

  for (const chunk of chunks) {
    if (!chunk.startsWith("data: ")) continue;
    const payload = chunk.slice(6);
    let event;
    try { event = JSON.parse(payload); } catch { continue; }
    const etype = event.type || "";

    if (etype === "content_block_delta") {
      const delta = event.delta;
      if (delta?.type === "text_delta") {
        textParts.push(delta.text || "");
      }
    } else if (etype === "message_delta") {
      if (event.usage) Object.assign(usage, event.usage);
    } else if (etype === "message_start") {
      const u = event.message?.usage;
      if (u) Object.assign(usage, u);
    }
  }

  return { text: textParts.join(""), usage };
}

// ── Header Helpers ───────────────────────────────────────────────────

function forwardHeaders(incomingHeaders) {
  const skip = new Set([...HOP_BY_HOP, ...STRIP_REQUEST]);
  const out = {};
  for (const [k, v] of Object.entries(incomingHeaders)) {
    if (!skip.has(k.toLowerCase())) {
      out[k] = Array.isArray(v) ? v.join(", ") : v;
    }
  }
  return out;
}

function relayResponseHeaders(upstreamRes, clientRes) {
  for (const [k, v] of Object.entries(upstreamRes.headers)) {
    if (!STRIP_RESPONSE.has(k.toLowerCase())) {
      try { clientRes.setHeader(k, v); } catch { /* skip invalid headers */ }
    }
  }
}

// ── Request Body Collector ───────────────────────────────────────────

function collectBody(req, maxBytes = 10 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;

    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        req.destroy(new Error("Request body too large"));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

// ── Upstream Request ─────────────────────────────────────────────────

function makeUpstreamRequest(method, reqPath, headers, body) {
  const upstream = new URL(reqPath, UPSTREAM_URL);
  const transport = upstream.protocol === "https:" ? https : http;

  return new Promise((resolve, reject) => {
    const opts = {
      hostname: upstream.hostname,
      port: upstream.port || (upstream.protocol === "https:" ? 443 : 80),
      path: upstream.pathname + upstream.search,
      method,
      headers,
      timeout: UPSTREAM_TIMEOUT_MS,
    };

    const upReq = transport.request(opts, (upRes) => resolve(upRes));
    upReq.on("error", reject);
    upReq.on("timeout", () => {
      upReq.destroy(new Error("upstream timeout"));
    });

    if (body) {
      upReq.end(body);
    } else {
      upReq.end();
    }
  });
}

// ── Response Handlers ────────────────────────────────────────────────

function relayFullResponse(upstreamRes, clientRes, logEntry, startTime) {
  const chunks = [];

  upstreamRes.on("data", (chunk) => chunks.push(chunk));
  upstreamRes.on("end", () => {
    const responseBytes = Buffer.concat(chunks);
    const elapsed = (Date.now() - startTime) / 1000;

    try {
      clientRes.writeHead(upstreamRes.statusCode, upstreamRes.statusMessage);
      relayResponseHeaders(upstreamRes, clientRes);
      clientRes.setHeader("Content-Length", responseBytes.length);
      clientRes.end(responseBytes);
    } catch { /* client disconnected */ }

    // Off hot path: log the response
    if (logEntry) {
      let respJson;
      try { respJson = JSON.parse(responseBytes.toString("utf8")); } catch {
        respJson = { _raw: responseBytes.toString("utf8", 0, Math.min(responseBytes.length, 2048)) };
      }

      logEntry.elapsed_s = Math.round(elapsed * 1000) / 1000;
      logEntry.response_status = upstreamRes.statusCode;
      logEntry.response_headers = Object.fromEntries(
        Object.entries(upstreamRes.headers).map(([k, v]) => [k, Array.isArray(v) ? v.join(", ") : v])
      );
      logEntry.response_body = respJson;
      logEntry.response_usage = respJson?.usage || null;
      appendLog(logEntry);
    }
  });

  upstreamRes.on("error", () => {
    try { clientRes.end(); } catch { /* ignore */ }
  });
}

function relayStreamResponse(upstreamRes, clientRes, logEntry, startTime) {
  // Write response headers to client FIRST — then pipe chunks at wire speed
  try {
    clientRes.writeHead(upstreamRes.statusCode, upstreamRes.statusMessage);
    relayResponseHeaders(upstreamRes, clientRes);
  } catch {
    return; // client already gone
  }

  // CRITICAL PERFORMANCE: pipe upstream directly to client.
  // This is the zero-overhead hot path — chunks flow kernel-to-kernel.
  upstreamRes.pipe(clientRes);

  // Passive tap: collect chunks for logging WITHOUT blocking the pipe.
  // This listener runs in parallel with the pipe — it cannot delay delivery.
  const sseChunks = [];
  let lineBuffer = "";

  upstreamRes.on("data", (chunk) => {
    // Accumulate raw SSE lines for post-stream parsing
    lineBuffer += chunk.toString("utf8");
    const lines = lineBuffer.split("\n");
    lineBuffer = lines.pop(); // keep incomplete line for next chunk

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed) sseChunks.push(trimmed);
    }
  });

  upstreamRes.on("end", () => {
    // Flush any remaining line buffer
    if (lineBuffer.trim()) sseChunks.push(lineBuffer.trim());

    const elapsed = (Date.now() - startTime) / 1000;

    // Off hot path: parse SSE chunks and log
    if (logEntry) {
      const { text, usage } = parseSSEChunks(sseChunks);

      logEntry.elapsed_s = Math.round(elapsed * 1000) / 1000;
      logEntry.response_status = upstreamRes.statusCode;
      logEntry.response_headers = Object.fromEntries(
        Object.entries(upstreamRes.headers).map(([k, v]) => [k, Array.isArray(v) ? v.join(", ") : v])
      );
      logEntry.response_usage = usage;
      logEntry.response_text = text;
      logEntry.response_chunk_count = sseChunks.length;
      appendLog(logEntry);
    }
  });

  // Handle client disconnect (EPIPE) — don't crash, just stop piping
  clientRes.on("error", () => {
    try { upstreamRes.destroy(); } catch { /* ignore */ }
  });

  upstreamRes.on("error", () => {
    try { clientRes.end(); } catch { /* ignore */ }
  });
}

// ── Request Handlers ─────────────────────────────────────────────────

async function handlePost(req, res) {
  const startTime = Date.now();

  // Collect request body — we need model/stream metadata for routing.
  // Request body upload is local (fast). The performance-critical path
  // is the response streaming, which uses pipe().
  let rawBody;
  try {
    rawBody = await collectBody(req);
  } catch {
    sendJson(res, 400, { error: "failed to read request body" });
    return;
  }

  let body;
  try {
    body = JSON.parse(rawBody.toString("utf8"));
  } catch {
    body = { _raw: rawBody.toString("utf8", 0, Math.min(rawBody.length, 2048)) };
  }

  const model = body.model || "unknown";
  const isStreaming = body.stream === true;

  // Build log entry with stripped auth headers
  const logEntry = {
    timestamp: new Date().toISOString(),
    method: "POST",
    path: req.url,
    model,
    is_streaming: isStreaming,
    request_headers: stripAuthHeaders(req.headers),
    request_body: rawBody.length > MAX_BODY_LOG_BYTES
      ? { _truncated: true, _size: rawBody.length, model, stream: isStreaming }
      : body,
  };

  // Forward to upstream
  const headers = forwardHeaders(req.headers);
  headers["content-length"] = String(rawBody.length);

  let upstreamRes;
  try {
    upstreamRes = await makeUpstreamRequest("POST", req.url, headers, rawBody);
  } catch (err) {
    const elapsed = (Date.now() - startTime) / 1000;
    logEntry.error = String(err.message || err);
    logEntry.elapsed_s = Math.round(elapsed * 1000) / 1000;
    appendLog(logEntry);
    sendJson(res, 502, { error: `upstream error: ${err.message || err}` });
    return;
  }

  // Route to streaming or full relay based on response content type + request flag
  const contentType = upstreamRes.headers["content-type"] || "";
  if (isStreaming && contentType.includes("text/event-stream")) {
    relayStreamResponse(upstreamRes, res, logEntry, startTime);
  } else {
    relayFullResponse(upstreamRes, res, logEntry, startTime);
  }
}

async function handleGet(req, res) {
  const url = new URL(req.url, `http://localhost:${PROXY_PORT}`);
  const pathname = url.pathname;

  // Health check
  if (pathname === "/health") {
    sendJson(res, 200, {
      status: "healthy",
      uptime: Math.round((Date.now() - START_TIME) / 1000),
      port: PROXY_PORT,
    });
    return;
  }

  // Dashboard API: list logs
  if (pathname === "/api/logs") {
    const date = url.searchParams.get("date") || null;
    const limit = parseInt(url.searchParams.get("limit") || "200", 10);
    const entries = readLogs(date, limit);
    sendJsonCors(res, 200, { entries, count: entries.length });
    return;
  }

  // Dashboard API: list available dates
  if (pathname === "/api/logs/dates") {
    sendJsonCors(res, 200, { dates: getLogDates() });
    return;
  }

  // Dashboard API: SSE live stream
  if (pathname === "/api/logs/stream") {
    handleSSEStream(req, res);
    return;
  }

  // Dashboard API: stats
  if (pathname === "/api/stats") {
    sendJsonCors(res, 200, stats);
    return;
  }

  // Forward other GET requests to upstream
  const headers = forwardHeaders(req.headers);
  try {
    const upstreamRes = await makeUpstreamRequest("GET", req.url, headers, null);
    relayFullResponse(upstreamRes, res, null, Date.now());
  } catch (err) {
    sendJson(res, 502, { error: `upstream error: ${err.message || err}` });
  }
}

function handleOptions(_req, res) {
  res.writeHead(204, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "*",
  });
  res.end();
}

function handleSSEStream(req, res) {
  if (sseClients.size >= MAX_SSE_CLIENTS) {
    sendJson(res, 503, { error: "too many SSE clients" });
    return;
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });
  res.write("\n"); // initial flush

  sseClients.add(res);

  req.on("close", () => sseClients.delete(res));
  res.on("close", () => sseClients.delete(res));
  res.on("error", () => sseClients.delete(res));
}

// ── JSON helpers ─────────────────────────────────────────────────────

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  try {
    res.writeHead(status, {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(body),
    });
    res.end(body);
  } catch { /* client disconnected */ }
}

function sendJsonCors(res, status, data) {
  const body = JSON.stringify(data, jsonReplacer);
  try {
    res.writeHead(status, {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(body),
      "Access-Control-Allow-Origin": "*",
    });
    res.end(body);
  } catch { /* client disconnected */ }
}

// ── Startup self-test ────────────────────────────────────────────────

function selfTestHeaderStripping() {
  const testHeaders = {
    "x-api-key": "sk-ant-secret",
    "authorization": "Bearer secret",
    "cookie": "session=abc",
    "proxy-authorization": "Basic creds",
    "content-type": "application/json",
    "x-claude-code-session-id": "test-123",
  };

  const stripped = stripAuthHeaders(testHeaders);
  for (const key of STRIP_LOG_HEADERS) {
    if (key in stripped) {
      process.stderr.write(`[proxy] FATAL: header stripping self-test failed for '${key}'\n`);
      process.exit(1);
    }
  }

  if (!stripped["content-type"] || !stripped["x-claude-code-session-id"]) {
    process.stderr.write("[proxy] FATAL: header stripping removed non-auth headers\n");
    process.exit(1);
  }
}

// ── Server ───────────────────────────────────────────────────────────

function createProxyServer() {
  return http.createServer(async (req, res) => {
    try {
      if (req.method === "OPTIONS") {
        handleOptions(req, res);
      } else if (req.method === "POST") {
        await handlePost(req, res);
      } else if (req.method === "GET") {
        await handleGet(req, res);
      } else {
        sendJson(res, 405, { error: "method not allowed" });
      }
    } catch (err) {
      process.stderr.write(`[proxy] unhandled error: ${err.message || err}\n`);
      try { sendJson(res, 500, { error: "internal proxy error" }); } catch { /* ignore */ }
    }
  });
}

// ── Main ─────────────────────────────────────────────────────────────

function main() {
  // Self-test header stripping
  selfTestHeaderStripping();

  // Ensure log directory
  fs.mkdirSync(LOG_DIR, { recursive: true, mode: 0o700 });

  // Cleanup old logs
  cleanupOldLogs();

  // Start stats sync
  startStatsSync();

  const server = createProxyServer();

  // Bind to 127.0.0.1 only (NOT 0.0.0.0 — security requirement)
  server.listen(PROXY_PORT, "127.0.0.1", () => {
    const msg = JSON.stringify({
      status: "started",
      port: PROXY_PORT,
      upstream: UPSTREAM_URL,
      logDir: LOG_DIR,
      statsFile: STATS_FILE || null,
      pid: process.pid,
    });
    process.stderr.write(`[proxy] ${msg}\n`);
  });

  server.on("error", (err) => {
    process.stderr.write(`[proxy] server error: ${err.message}\n`);
    process.exit(1);
  });

  // Graceful shutdown
  const shutdown = () => {
    process.stderr.write("[proxy] shutting down\n");
    if (statsWriteTimer) clearInterval(statsWriteTimer);

    // Final stats write
    if (STATS_FILE) {
      try {
        fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2) + "\n", "utf8");
      } catch { /* ignore */ }
    }

    // Close SSE clients
    for (const client of sseClients) {
      try { client.end(); } catch { /* ignore */ }
    }
    sseClients.clear();

    server.close(() => process.exit(0));
    // Force exit after 5s if graceful close hangs
    setTimeout(() => process.exit(0), 5000).unref();
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main();
