import fs from "node:fs";

const CACHE_PATH = "/tmp/.claude-statusline-cache.json";
const MAX_DELTA_MS = 2000;

/**
 * Compute per-request deltas by diffing against the previous cached reading.
 * @param {{ inputTokens: number, outputTokens: number, ts: number }} current
 * @returns {{ outputSpeed: number|null, inputDelta: number, outputDelta: number }}
 */
export function computeDeltas(current) {
  const prev = readCache();
  const deltas = { outputSpeed: null, inputDelta: 0, outputDelta: 0 };

  if (prev && current.ts - prev.ts > 0 && current.ts - prev.ts <= MAX_DELTA_MS) {
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

function readCache() {
  try {
    const raw = fs.readFileSync(CACHE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    if (typeof parsed.outputTokens === "number" && typeof parsed.ts === "number") {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function writeCache(data) {
  try {
    fs.writeFileSync(CACHE_PATH, JSON.stringify({
      inputTokens: data.inputTokens,
      outputTokens: data.outputTokens,
      ts: data.ts,
    }), "utf8");
  } catch {
    // Non-fatal — treat next invocation as first.
  }
}
