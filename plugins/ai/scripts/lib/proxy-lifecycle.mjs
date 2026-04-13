/**
 * Proxy lifecycle management — follows the broker-lifecycle.mjs pattern.
 *
 * Manages spawn/teardown of proxy-server.mjs as a detached child process,
 * with pid/port files, health polling, auto-restart, and port conflict scanning.
 *
 * Reference: FDR-02-proxy-metrics-integration.md, IMPL-05 B1/B3/B4
 */

import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolveStateDir } from "./state.mjs";

const PROXY_STATE_FILE = "proxy.json";
const DEFAULT_PORT = 7001;
const PORT_SCAN_MAX = 7999;
const HEALTH_POLL_INTERVAL_MS = 50;
const HEALTH_TIMEOUT_MS = 2000;

// ── State persistence ────────────────────────────────────────────────

function resolveProxyStateFile(cwd) {
  return path.join(resolveStateDir(cwd), PROXY_STATE_FILE);
}

export function loadProxySession(cwd) {
  const stateFile = resolveProxyStateFile(cwd);
  if (!fs.existsSync(stateFile)) return null;
  try {
    return JSON.parse(fs.readFileSync(stateFile, "utf8"));
  } catch {
    return null;
  }
}

export function saveProxySession(cwd, session) {
  const stateDir = resolveStateDir(cwd);
  fs.mkdirSync(stateDir, { recursive: true });
  fs.writeFileSync(
    resolveProxyStateFile(cwd),
    JSON.stringify(session, null, 2) + "\n",
    "utf8"
  );
}

export function clearProxySession(cwd) {
  const stateFile = resolveProxyStateFile(cwd);
  try { fs.unlinkSync(stateFile); } catch { /* ignore */ }
}

// ── Process checks ───────────────────────────────────────────────────

function isProcessAlive(pid) {
  if (!Number.isFinite(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

// ── Health check ─────────────────────────────────────────────────────

function checkHealth(port, timeoutMs = 1000) {
  return new Promise((resolve) => {
    const req = http.get(
      { hostname: "127.0.0.1", port, path: "/health", timeout: timeoutMs },
      (res) => {
        let data = "";
        res.on("data", (chunk) => { data += chunk; });
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data);
            resolve(parsed.status === "healthy");
          } catch {
            resolve(false);
          }
        });
      }
    );
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForHealth(port, timeoutMs = HEALTH_TIMEOUT_MS) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await checkHealth(port, 500)) return true;
    await new Promise((r) => setTimeout(r, HEALTH_POLL_INTERVAL_MS));
  }
  return false;
}

// ── Port scanning ────────────────────────────────────────────────────

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "127.0.0.1");
  });
}

async function findAvailablePort(startPort = DEFAULT_PORT) {
  for (let port = startPort; port <= PORT_SCAN_MAX; port++) {
    if (await isPortAvailable(port)) return port;
  }
  return null;
}

// ── Combined check ───────────────────────────────────────────────────

export async function isProxyRunning(cwd) {
  const session = loadProxySession(cwd);
  if (!session) return false;

  // Both pid AND health must pass
  if (!isProcessAlive(session.pid)) {
    clearProxySession(cwd);
    return false;
  }

  return checkHealth(session.port);
}

// ── Start proxy ──────────────────────────────────────────────────────

export async function startProxy(cwd, options = {}) {
  // Check for existing running proxy
  const existing = loadProxySession(cwd);
  if (existing && isProcessAlive(existing.pid)) {
    const healthy = await checkHealth(existing.port);
    if (healthy) return existing;

    // Process alive but unhealthy — kill and restart
    stopProxy(cwd);
  } else if (existing) {
    // Stale session — clean up
    clearProxySession(cwd);
  }

  // Find available port
  const port = await findAvailablePort(options.port || DEFAULT_PORT);
  if (port === null) {
    return { error: `No available port in range ${DEFAULT_PORT}-${PORT_SCAN_MAX}. All ports occupied.` };
  }

  // Resolve paths
  const scriptPath = options.scriptPath
    || fileURLToPath(new URL("../proxy-server.mjs", import.meta.url));
  const logDir = options.logDir || path.join(cwd, ".claude", "proxy-logs");
  const statsFile = path.join(resolveStateDir(cwd), "proxy-stats.json");
  const sessionDir = fs.mkdtempSync(path.join(os.tmpdir(), "cc-proxy-"));
  const pidFile = path.join(sessionDir, "proxy.pid");
  const logFile = path.join(sessionDir, "proxy.log");

  // Spawn detached child
  const logFd = fs.openSync(logFile, "a");
  const child = spawn(process.execPath, [scriptPath], {
    cwd,
    detached: true,
    stdio: ["ignore", logFd, logFd],
    env: {
      ...process.env,
      PROXY_PORT: String(port),
      PROXY_LOG_DIR: logDir,
      PROXY_STATS_FILE: statsFile,
    },
  });
  child.unref();
  fs.closeSync(logFd);

  // Write pid file
  try {
    fs.writeFileSync(pidFile, String(child.pid), "utf8");
  } catch { /* ignore */ }

  // Wait for health
  const ready = await waitForHealth(port);
  if (!ready) {
    // Cleanup on failure
    try { process.kill(child.pid, "SIGTERM"); } catch { /* ignore */ }
    try { fs.unlinkSync(pidFile); } catch { /* ignore */ }
    try { fs.rmdirSync(sessionDir); } catch { /* ignore */ }
    return { error: "Proxy failed to start (health check timed out)" };
  }

  const session = {
    port,
    pid: child.pid,
    pidFile,
    logFile,
    logDir,
    statsFile,
    sessionDir,
    startedAt: new Date().toISOString(),
  };

  saveProxySession(cwd, session);
  return session;
}

// ── Stop proxy ───────────────────────────────────────────────────────

export function stopProxy(cwd) {
  const session = loadProxySession(cwd);
  if (!session) return;

  // Kill process
  if (Number.isFinite(session.pid) && isProcessAlive(session.pid)) {
    try { process.kill(session.pid, "SIGTERM"); } catch { /* ignore */ }
  }

  // Cleanup files
  if (session.pidFile) {
    try { fs.unlinkSync(session.pidFile); } catch { /* ignore */ }
  }

  // Remove session dir (only if empty — log file may still be useful)
  if (session.sessionDir) {
    try { fs.rmdirSync(session.sessionDir); } catch { /* non-empty, fine */ }
  }

  clearProxySession(cwd);
}

// ── Health monitoring + auto-restart ─────────────────────────────────

/**
 * Ensure proxy is healthy. If down, attempt one restart.
 * Returns the session if healthy, null if unrecoverable.
 *
 * Note: If restart fails, ANTHROPIC_BASE_URL may still point to the dead
 * proxy. CLAUDE_ENV_FILE is append-only, so we cannot unset it. The user
 * must restart their Claude Code session to recover.
 */
export async function ensureProxyHealthy(cwd) {
  const session = loadProxySession(cwd);
  if (!session) return null;

  // Check health
  const healthy = await checkHealth(session.port);
  if (healthy) return session;

  // Process dead or unhealthy — attempt one restart
  process.stderr.write("[proxy-lifecycle] proxy unhealthy, attempting restart\n");
  stopProxy(cwd);

  const newSession = await startProxy(cwd, { port: session.port });
  if (newSession.error) {
    process.stderr.write(`[proxy-lifecycle] restart failed: ${newSession.error}\n`);
    process.stderr.write("[proxy-lifecycle] WARNING: ANTHROPIC_BASE_URL may still point to dead proxy\n");
    process.stderr.write("[proxy-lifecycle] User must restart Claude Code session to recover\n");
    return null;
  }

  return newSession;
}
