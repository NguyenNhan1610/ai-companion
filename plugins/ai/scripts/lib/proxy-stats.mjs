/**
 * Proxy stats reader — used by /ai:status --proxy and statusline-handler.mjs.
 *
 * The proxy-server.mjs writes stats to resolveStateDir(cwd)/proxy-stats.json
 * every 5 seconds via atomic tmp+rename. This module reads that file.
 *
 * Pricing constants for cost estimation (USD per million tokens).
 *
 * Reference: FDR-02-proxy-metrics-integration.md, IMPL-05 C1
 */

import fs from "node:fs";
import path from "node:path";
import { resolveStateDir } from "./state.mjs";

// ── Pricing (USD per million tokens) ─────────────────────────────────

const PRICING = {
  opus:   { input: 5,  cacheWrite5m: 6.25,  cacheWrite1h: 10,   cacheRead: 0.50,  output: 25 },
  sonnet: { input: 3,  cacheWrite5m: 3.75,  cacheWrite1h: 6,    cacheRead: 0.30,  output: 15 },
  haiku:  { input: 1,  cacheWrite5m: 1.25,  cacheWrite1h: 2,    cacheRead: 0.10,  output: 5 },
};

export function getPricing(model) {
  if (!model) return PRICING.sonnet;
  const m = model.toLowerCase();
  if (m.includes("opus")) return PRICING.opus;
  if (m.includes("haiku")) return PRICING.haiku;
  return PRICING.sonnet;
}

// ── Stats file reader ────────────────────────────────────────────────

const PROXY_STATS_FILE = "proxy-stats.json";

export function resolveProxyStatsFile(cwd) {
  return path.join(resolveStateDir(cwd), PROXY_STATS_FILE);
}

/**
 * Read proxy stats file. Returns null if not found, stale (>maxAgeMs), or corrupt.
 */
export function readProxyStats(cwd, maxAgeMs = 30_000) {
  const statsFile = resolveProxyStatsFile(cwd);
  try {
    const stat = fs.statSync(statsFile);
    if (maxAgeMs > 0 && Date.now() - stat.mtimeMs > maxAgeMs) return null;
    return JSON.parse(fs.readFileSync(statsFile, "utf8"));
  } catch {
    return null;
  }
}

// ── Cost estimation for a single log entry ───────────────────────────

export function calcEntryCost(usage, model) {
  if (!usage) return 0;
  const p = getPricing(model);

  const input = (usage.input_tokens || 0) / 1_000_000 * p.input;
  const output = (usage.output_tokens || 0) / 1_000_000 * p.output;
  const cacheRead = (usage.cache_read_input_tokens || 0) / 1_000_000 * p.cacheRead;

  const cc = usage.cache_creation;
  let cacheWrite;
  if (cc && (cc.ephemeral_5m_input_tokens || cc.ephemeral_1h_input_tokens)) {
    cacheWrite = ((cc.ephemeral_5m_input_tokens || 0) / 1_000_000 * p.cacheWrite5m)
      + ((cc.ephemeral_1h_input_tokens || 0) / 1_000_000 * p.cacheWrite1h);
  } else {
    cacheWrite = (usage.cache_creation_input_tokens || 0) / 1_000_000 * p.cacheWrite1h;
  }

  return input + cacheWrite + cacheRead + output;
}
