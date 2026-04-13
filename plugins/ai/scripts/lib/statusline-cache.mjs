import fs from "node:fs";

const CACHE_PATH = "/tmp/.claude-statusline-cache.json";

/**
 * Compute per-request deltas by diffing against the previous cached reading.
 * Persists the last non-zero input/output deltas so they remain visible
 * between API calls (when cumulative values don't change).
 *
 * @param {{ inputTokens: number, outputTokens: number, ts: number }} current
 * @returns {{ lastInputDelta: number|null, lastOutputDelta: number|null }}
 */
export function computeDeltas(current) {
  const prev = readCache();
  let lastInputDelta = prev?.lastInputDelta ?? null;
  let lastOutputDelta = prev?.lastOutputDelta ?? null;

  if (prev) {
    const inputDiff = current.inputTokens - (prev.inputTokens ?? 0);
    const outputDiff = current.outputTokens - (prev.outputTokens ?? 0);

    // Only update stored delta when tokens actually changed (new API response)
    if (inputDiff > 0) lastInputDelta = inputDiff;
    if (outputDiff > 0) lastOutputDelta = outputDiff;
  }

  writeCache({ ...current, lastInputDelta, lastOutputDelta });
  return { lastInputDelta, lastOutputDelta };
}

function readCache() {
  try {
    const raw = fs.readFileSync(CACHE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    if (typeof parsed.ts === "number") return parsed;
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
      lastInputDelta: data.lastInputDelta,
      lastOutputDelta: data.lastOutputDelta,
    }), "utf8");
  } catch {
    // Non-fatal — treat next invocation as first.
  }
}
