/**
 * Claude backend implementation.
 *
 * Wraps the `claude` CLI (Claude Code). Stateless per-invocation. Uses
 * `claude -p --output-format json` internally.
 */

import fs from "node:fs";
import path from "node:path";

import { binaryAvailable } from "../process.mjs";
import { readJsonFile } from "../fs.mjs";
import { runClaudePrompt } from "./claude-cli.mjs";

const DEFAULT_CONTINUE_PROMPT =
  "Continue from where you left off. Pick the next highest-value step and follow through until the task is resolved.";

function claudeConfigDir() {
  return path.join(process.env.CLAUDE_CONFIG_DIR || process.env.HOME || process.env.USERPROFILE || "~", ".claude");
}

/**
 * Create and return the Claude backend object.
 * @returns {import("../backend.mjs").Backend}
 */
export function createClaudeBackend() {
  return {
    name: "claude",
    displayName: "Claude",
    commandPrefix: "claude",
    supportsNativeReview: false,

    getAvailability(cwd) {
      return binaryAvailable("claude", ["--version"], { cwd });
    },

    getLoginStatus(cwd) {
      const availability = binaryAvailable("claude", ["--version"], { cwd });
      if (!availability.available) {
        return {
          available: false,
          loggedIn: false,
          detail: availability.detail
        };
      }

      const configDir = claudeConfigDir();
      if (!fs.existsSync(configDir)) {
        return {
          available: true,
          loggedIn: false,
          detail: `No Claude Code configuration found at ${configDir}. Launch \`claude\` interactively once to sign in.`
        };
      }

      return {
        available: true,
        loggedIn: true,
        detail: `${availability.detail}; authenticated`
      };
    },

    getSessionRuntimeStatus() {
      return {
        mode: "direct",
        label: "direct invocation",
        detail: "Claude CLI runs on demand. Each command spawns a new process.",
        endpoint: null
      };
    },

    async runReview(cwd, options) {
      const onProgress = options.onProgress;
      if (onProgress) {
        onProgress({ message: "Starting Claude review.", phase: "starting" });
      }

      const result = await runClaudePrompt(cwd, {
        prompt: options.prompt || "",
        model: options.model,
        allowAllTools: false
      });

      return {
        status: result.status,
        threadId: result.sessionId,
        sourceThreadId: null,
        turnId: null,
        reviewText: result.stdout,
        stderr: result.stderr,
        reasoningSummary: [],
        finalMessage: result.stdout,
        error: result.status !== 0 ? { message: result.stderr || "Claude review failed." } : null
      };
    },

    async runTurn(cwd, options) {
      const onProgress = options.onProgress;
      if (onProgress) {
        onProgress({ message: "Starting Claude task.", phase: "starting" });
      }

      const result = await runClaudePrompt(cwd, {
        prompt: options.prompt || options.defaultPrompt || "",
        model: options.model,
        allowAllTools: true,
        resumeSessionId: options.resumeThreadId || null
      });

      return {
        status: result.status,
        threadId: result.sessionId,
        turnId: null,
        finalMessage: result.stdout,
        stderr: result.stderr,
        reasoningSummary: [],
        touchedFiles: [],
        error: result.status !== 0 ? { message: result.stderr || "Claude task failed." } : null
      };
    },

    async interruptTurn() {
      return {
        attempted: false,
        interrupted: false,
        transport: null,
        detail: "Claude CLI does not support turn interruption. Kill the process instead."
      };
    },

    async findLatestTaskThread() {
      return null;
    },

    ensureReady(cwd) {
      const availability = binaryAvailable("claude", ["--version"], { cwd });
      if (!availability.available) {
        throw new Error(
          "Claude CLI is not installed. Install Claude Code from https://claude.com/claude-code, then rerun `/ai:setup`."
        );
      }
      const configDir = claudeConfigDir();
      if (!fs.existsSync(configDir)) {
        throw new Error(
          `Claude CLI is not authenticated. Launch \`claude\` interactively once (it will store credentials in ${configDir}) and retry.`
        );
      }
    },

    parseStructuredOutput(rawOutput, fallback) {
      if (!rawOutput || typeof rawOutput !== "string") {
        return {
          parsed: null,
          rawOutput: rawOutput ?? "",
          parseError: fallback?.failureMessage || "No output received."
        };
      }

      const trimmed = rawOutput.trim();

      try {
        const parsed = JSON.parse(trimmed);
        return { parsed, rawOutput, parseError: null };
      } catch {
        // fall through
      }

      const fenceMatch = trimmed.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
      if (fenceMatch) {
        try {
          const parsed = JSON.parse(fenceMatch[1]);
          return { parsed, rawOutput, parseError: null };
        } catch {
          // fall through
        }
      }

      const first = trimmed.indexOf("{");
      const last = trimmed.lastIndexOf("}");
      if (first !== -1 && last > first) {
        try {
          const parsed = JSON.parse(trimmed.slice(first, last + 1));
          return { parsed, rawOutput, parseError: null };
        } catch {
          // fall through
        }
      }

      return { parsed: null, rawOutput, parseError: null };
    },

    readOutputSchema(schemaPath) {
      return readJsonFile(schemaPath);
    },

    buildPersistentTaskThreadName(prompt) {
      if (!prompt) return null;
      const short = prompt.length > 60 ? `${prompt.slice(0, 57)}...` : prompt;
      return `Claude Companion Task: ${short}`;
    },

    DEFAULT_CONTINUE_PROMPT
  };
}
