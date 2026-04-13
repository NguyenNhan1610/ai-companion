# Proxy Metrics

Transparent reverse proxy that sits between Claude Code and api.anthropic.com for deep API telemetry. Pure passthrough -- does NOT modify requests or responses.

## What You Get

- **Cache hit rate per call** -- see exactly when cache busts happen
- **Quota burn rate** -- 5-hour and 7-day window utilization from Anthropic headers
- **Cache create vs read breakdown** -- expensive writes vs cheap reads
- **Context size per call** -- watch context grow across a long session
- **Per-session stats** -- cost, cache %, tool call breakdown
- **Full request/response inspection** -- via daily JSONL log files
- **SSE live stream** -- `/api/logs/stream` endpoint for future dashboard UI

## Quick Start

```
/ai:setup --install-proxy
```

This starts the proxy, auto-selects a port (7001-7999), and routes Claude Code API traffic through it. Metrics appear in the statusline and via `/ai:status --proxy`.

## Commands

| Command | Description |
|---------|-------------|
| `/ai:setup --install-proxy` | Start proxy and configure API routing |
| `/ai:status --proxy` | Show live KPIs (cache%, quota, cost, requests) |

## Architecture

```
Claude Code
    |
    | ANTHROPIC_BASE_URL=http://127.0.0.1:{port}
    v
proxy-server.mjs (localhost:{port})
    |
    |-- req.pipe(upstreamReq)       <-- zero-copy request forwarding
    |-- upstreamRes.pipe(clientRes) <-- zero-copy response streaming
    |-- passive data tap            <-- SSE parsing for usage extraction
    |
    v
api.anthropic.com
    |
    +-- .claude/proxy-logs/YYYY-MM-DD.jsonl  (async write after stream end)
    +-- proxy-stats.json                     (in-memory, file sync every 5s)
```

### Performance

The proxy adds **<5ms overhead** per request. The hot path is kernel-level stream piping (`req.pipe` / `upstreamRes.pipe`). All logging and stats are async and off the critical path:

| Component | On hot path? | Mechanism |
|-----------|-------------|-----------|
| Request body relay | No copy | `req.pipe(upstreamReq)` |
| Response relay | No copy | `upstreamRes.pipe(clientRes)` |
| SSE chunk parsing | Parallel tap | `data` listener on piped stream |
| JSONL log write | After stream end | `fs.appendFile()` (async) |
| Stats update | In-memory | Counters, file sync every 5s |

### Security

- Binds to `127.0.0.1` only (not `0.0.0.0`)
- API keys stripped from JSONL logs (`x-api-key`, `authorization`, `cookie`, `proxy-authorization`)
- Log file permissions `0600`, directory `0700`
- Startup self-test verifies header stripping works
- Request bodies truncated to 100KB in logs

## Lifecycle

The proxy integrates with Claude Code session hooks:

- **SessionStart**: If a proxy session exists, checks health and injects `ANTHROPIC_BASE_URL`
- **SessionEnd**: Stops proxy process and cleans up state
- **Auto-restart**: If proxy is unhealthy at session start, attempts one restart
- **Port conflicts**: Auto-scans 7001-7999 for available port

## Statusline

When the proxy is active, a third statusline row appears:

```
[Proxy] cache: 73% | quota: 45% | reqs: 42 | up: 2h 15m
```

## Log Files

Daily JSONL files at `.claude/proxy-logs/YYYY-MM-DD.jsonl`. Each entry contains:

```json
{
  "timestamp": "2026-04-13T14:32:01.123Z",
  "method": "POST",
  "path": "/v1/messages",
  "model": "claude-opus-4-6",
  "is_streaming": true,
  "request_headers": { "content-type": "..." },
  "elapsed_s": 3.456,
  "response_status": 200,
  "response_headers": { "anthropic-ratelimit-unified-5h-utilization": "0.45" },
  "response_usage": { "input_tokens": 1234, "output_tokens": 456, "cache_read_input_tokens": 890 },
  "response_text": "...",
  "response_chunk_count": 42
}
```

Old logs are automatically cleaned up after 30 days (configurable via `PROXY_LOG_MAX_DAYS`).

## API Endpoints

The proxy serves these endpoints for tooling and future dashboard integration:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | `{ status, uptime, port }` |
| `/api/stats` | GET | Live stats (cache rate, quota, requests) |
| `/api/logs?date=&limit=` | GET | Query log entries |
| `/api/logs/dates` | GET | Available log dates |
| `/api/logs/stream` | GET (SSE) | Live stream of new entries (max 5 clients) |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PROXY_PORT` | `7001` | Listen port |
| `ANTHROPIC_FORWARD_URL` | `https://api.anthropic.com` | Upstream API URL |
| `PROXY_LOG_DIR` | `.claude/proxy-logs` | Log directory |
| `PROXY_LOG_MAX_DAYS` | `30` | Days to keep old logs |
| `PROXY_STATS_FILE` | (auto) | Stats file path |

## Files

| File | Purpose |
|------|---------|
| `scripts/proxy-server.mjs` | HTTP proxy server (passthrough + logging) |
| `scripts/lib/proxy-lifecycle.mjs` | Start/stop/health/port scan |
| `scripts/lib/proxy-stats.mjs` | Stats reader + cost estimation |

## Future: Cache Fix Plugin

The cache fix from `ccproxycache/custom-cache-fix/preload.mjs` is NOT included. It operates at the fetch interceptor level (before the proxy) and is structured as a future plugin/patch point. When integrated, requests flow through: `fetch interceptor -> proxy -> upstream`.

## Future: Dashboard UI

The SSE endpoint and REST API are designed for a web dashboard (React + Recharts). The data contract is defined by the JSONL log entry schema and `/api/stats` response schema. Connect to `/api/logs/stream` for live updates.
