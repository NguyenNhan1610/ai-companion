#!/usr/bin/env node

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { parseArgs, splitRawArgumentString } from "./lib/args.mjs";
import { getBackend, registerBackend } from "./lib/backend.mjs";
import { loadPluginConfig, resolveProviderAndModel } from "./lib/config.mjs";
import { createCodexBackend } from "./lib/codex/index.mjs";
import { createCopilotBackend } from "./lib/copilot/index.mjs";

// Register available backends at startup
registerBackend(createCodexBackend());
registerBackend(createCopilotBackend());
import { readStdinIfPiped } from "./lib/fs.mjs";
import { collectReviewContext, collectFullCodebaseContext, ensureGitRepository, resolveReviewTarget } from "./lib/git.mjs";
import { binaryAvailable, terminateProcessTree } from "./lib/process.mjs";
import { loadPromptTemplate, interpolateTemplate, resolveAspectTemplate, loadCouncilPromptTemplate } from "./lib/prompts.mjs";
import {
  generateJobId,
  getConfig,
  listJobs,
  setConfig,
  upsertJob,
  writeJobFile
} from "./lib/state.mjs";
import {
  buildSingleJobSnapshot,
  buildStatusSnapshot,
  readStoredJob,
  resolveCancelableJob,
  resolveResultJob,
  sortJobsNewestFirst
} from "./lib/job-control.mjs";
import {
  appendLogLine,
  createJobLogFile,
  createJobProgressUpdater,
  createJobRecord,
  createProgressReporter,
  nowIso,
  runTrackedJob,
  SESSION_ID_ENV
} from "./lib/tracked-jobs.mjs";
import { resolveWorkspaceRoot } from "./lib/workspace.mjs";
import {
  renderNativeReviewResult,
  renderReviewResult,
  renderStoredJobResult,
  renderCancelReport,
  renderJobStatusReport,
  renderSetupReport,
  renderStatusReport,
  renderTaskResult,
  renderCouncilResult
} from "./lib/render.mjs";

const ROOT_DIR = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const REVIEW_SCHEMA = path.join(ROOT_DIR, "schemas", "review-output.schema.json");
const COUNCIL_SCHEMA = path.join(ROOT_DIR, "schemas", "council-output.schema.json");
const DEFAULT_STATUS_WAIT_TIMEOUT_MS = 240000;
const DEFAULT_STATUS_POLL_INTERVAL_MS = 2000;
const VALID_REASONING_EFFORTS = new Set(["none", "minimal", "low", "medium", "high", "xhigh"]);
const STOP_REVIEW_TASK_MARKER = "Run a stop-gate review of the previous Claude turn.";

function printUsage() {
  console.log(
    [
      "Usage:",
      "  node scripts/ai-companion.mjs setup [--provider <codex|copilot>] [--enable-review-gate|--disable-review-gate] [--json]",
      "  node scripts/ai-companion.mjs review [--model <provider:model>] [--wait|--background] [--base <ref>] [--scope <auto|working-tree|branch>] [language[/techstack]:aspect]",
      "  node scripts/ai-companion.mjs adversarial-review [--model <provider:model>] [--wait|--background] [--base <ref>] [--scope <auto|working-tree|branch>] [focus text]",
      "  node scripts/ai-companion.mjs council [--model <provider:model>] [--roles <role1,role2,...>] [topic text]",
      "  node scripts/ai-companion.mjs task [--model <provider:model>] [--background] [--write] [--resume-last|--resume|--fresh] [--effort <none|minimal|low|medium|high|xhigh>] [prompt]",
      "  node scripts/ai-companion.mjs status [job-id] [--all] [--json]",
      "  node scripts/ai-companion.mjs result [job-id] [--json]",
      "  node scripts/ai-companion.mjs cancel [job-id] [--json]",
      "",
      "Model format: --model <provider>:<model>  (e.g., codex:gpt-5.4, copilot:claude-opus-4.5)",
      "             --model <model>              (uses default provider from config)"
    ].join("\n")
  );
}

function outputResult(value, asJson) {
  if (asJson) {
    console.log(JSON.stringify(value, null, 2));
  } else {
    process.stdout.write(value);
  }
}

function outputCommandResult(payload, rendered, asJson) {
  outputResult(asJson ? payload : rendered, asJson);
}

function normalizeReasoningEffort(effort) {
  if (effort == null) {
    return null;
  }
  const normalized = String(effort).trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  if (!VALID_REASONING_EFFORTS.has(normalized)) {
    throw new Error(
      `Unsupported reasoning effort "${effort}". Use one of: none, minimal, low, medium, high, xhigh.`
    );
  }
  return normalized;
}

function normalizeArgv(argv) {
  if (argv.length === 1) {
    const [raw] = argv;
    if (!raw || !raw.trim()) {
      return [];
    }
    return splitRawArgumentString(raw);
  }
  return argv;
}

function parseCommandInput(argv, config = {}) {
  return parseArgs(normalizeArgv(argv), {
    ...config,
    aliasMap: {
      C: "cwd",
      ...(config.aliasMap ?? {})
    }
  });
}

function resolveCommandCwd(options = {}) {
  return options.cwd ? path.resolve(process.cwd(), options.cwd) : process.cwd();
}

function resolveCommandWorkspace(options = {}) {
  return resolveWorkspaceRoot(resolveCommandCwd(options));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shorten(text, limit = 96) {
  const normalized = String(text ?? "").trim().replace(/\s+/g, " ");
  if (!normalized) {
    return "";
  }
  if (normalized.length <= limit) {
    return normalized;
  }
  return `${normalized.slice(0, limit - 3)}...`;
}

function firstMeaningfulLine(text, fallback) {
  const line = String(text ?? "")
    .split(/\r?\n/)
    .map((value) => value.trim())
    .find(Boolean);
  return line ?? fallback;
}

function buildSetupReport(cwd, backend, actionsTaken = []) {
  const workspaceRoot = resolveWorkspaceRoot(cwd);
  const nodeStatus = binaryAvailable("node", ["--version"], { cwd });
  const npmStatus = binaryAvailable("npm", ["--version"], { cwd });
  const codexStatus = backend.getAvailability(cwd);
  const authStatus = backend.getLoginStatus(cwd);
  const config = getConfig(workspaceRoot);

  const nextSteps = [];
  if (!codexStatus.available) {
    nextSteps.push("Install Codex with `npm install -g @openai/codex`.");
  }
  if (codexStatus.available && !authStatus.loggedIn) {
    nextSteps.push("Run `!codex login`.");
    nextSteps.push("If browser login is blocked, retry with `!codex login --device-auth` or `!codex login --with-api-key`.");
  }
  if (!config.stopReviewGate) {
    nextSteps.push("Optional: run `/ai:setup --enable-review-gate` to require a fresh review before stop.");
  }

  return {
    ready: nodeStatus.available && codexStatus.available && authStatus.loggedIn,
    node: nodeStatus,
    npm: npmStatus,
    codex: codexStatus,
    auth: authStatus,
    sessionRuntime: backend.getSessionRuntimeStatus(),
    reviewGateEnabled: Boolean(config.stopReviewGate),
    actionsTaken,
    nextSteps
  };
}

function handleSetup(argv, backend) {
  const { options } = parseCommandInput(argv, {
    valueOptions: ["cwd", "provider"],
    booleanOptions: ["json", "enable-review-gate", "disable-review-gate"]
  });

  // Allow --provider to override the backend for setup checks
  if (options.provider) {
    backend = getBackend(options.provider);
  }

  if (options["enable-review-gate"] && options["disable-review-gate"]) {
    throw new Error("Choose either --enable-review-gate or --disable-review-gate.");
  }

  const cwd = resolveCommandCwd(options);
  const workspaceRoot = resolveCommandWorkspace(options);
  const actionsTaken = [];

  if (options["enable-review-gate"]) {
    setConfig(workspaceRoot, "stopReviewGate", true);
    actionsTaken.push(`Enabled the stop-time review gate for ${workspaceRoot}.`);
  } else if (options["disable-review-gate"]) {
    setConfig(workspaceRoot, "stopReviewGate", false);
    actionsTaken.push(`Disabled the stop-time review gate for ${workspaceRoot}.`);
  }

  const finalReport = buildSetupReport(cwd, backend, actionsTaken);
  outputResult(options.json ? finalReport : renderSetupReport(finalReport), options.json);
}

function buildAdversarialReviewPrompt(context, focusText) {
  const template = loadPromptTemplate(ROOT_DIR, "adversarial-review");
  return interpolateTemplate(template, {
    REVIEW_KIND: "Adversarial Review",
    TARGET_LABEL: context.target.label,
    USER_FOCUS: focusText || "No extra focus provided.",
    REVIEW_INPUT: context.content
  });
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
}

const VALID_ASPECTS = new Set(["security", "performance", "architecture", "antipatterns"]);

function parseAspectArg(arg) {
  if (!arg) return null;
  const match = arg.match(/^(?:([a-z]+)(?:\/([a-z][\w-]*))?:)?([a-z]+)$/i);
  if (!match) return null;
  const [, language, techstack, aspect] = match;
  if (!VALID_ASPECTS.has(aspect)) return null;
  return {
    language: language?.toLowerCase() || null,
    techstack: techstack?.toLowerCase() || null,
    aspect
  };
}

function buildAspectReviewPrompt(context, { aspect, language, techstack }) {
  const template = resolveAspectTemplate(ROOT_DIR, { aspect, language, techstack });
  return interpolateTemplate(template, {
    TARGET_LABEL: context.target.label,
    LANGUAGE: language || "any",
    TECHSTACK: techstack || "any",
    REVIEW_INPUT: context.content
  });
}

const PREDEFINED_COUNCIL_ROLES = new Set([
  "security", "performance", "architecture", "antipatterns",
  "attacker", "defender", "judge"
]);

const MAX_AGENT_SUMMARY_CHARS = 2000;
const MAX_FINDINGS_PER_AGENT = 5;

function buildCouncilRolePrompt(role, topic, round1Summary) {
  if (round1Summary) {
    const debateTemplate = loadCouncilPromptTemplate(ROOT_DIR, "debate");
    return interpolateTemplate(debateTemplate, {
      ROLE_LABEL: capitalize(role),
      COUNCIL_TOPIC: topic,
      ROUND_1_FINDINGS: round1Summary
    });
  }
  const template = loadCouncilPromptTemplate(ROOT_DIR, role);
  return interpolateTemplate(template, {
    ROLE_LABEL: capitalize(role),
    ROLE_NAME: role,
    ROLE_DESCRIPTION: PREDEFINED_COUNCIL_ROLES.has(role) ? `${capitalize(role)} specialist` : role,
    COUNCIL_TOPIC: topic
  });
}

function buildSynthesisPrompt(topic, allFindings) {
  const template = loadCouncilPromptTemplate(ROOT_DIR, "synthesis");
  return interpolateTemplate(template, {
    COUNCIL_TOPIC: topic,
    ALL_FINDINGS: allFindings
  });
}

function formatAgentOutput(agentOutput) {
  const { role, parsed } = agentOutput.result ?? {};
  if (!parsed) return `## ${capitalize(agentOutput.role)} Agent\n\n(No structured output)\n`;

  const lines = [
    `## ${capitalize(agentOutput.role)} Agent`,
    "",
    `Verdict: ${parsed.verdict ?? "unknown"}`,
    `Summary: ${(parsed.summary ?? "").substring(0, MAX_AGENT_SUMMARY_CHARS)}`,
    ""
  ];

  const findings = (parsed.findings ?? []).slice(0, MAX_FINDINGS_PER_AGENT);
  if (findings.length > 0) {
    lines.push("Findings:");
    for (const f of findings) {
      const loc = f.file ? ` (${f.file}${f.line_start ? `:${f.line_start}` : ""})` : "";
      lines.push(`- [${f.severity}] ${f.title}${loc}`);
      if (f.body) lines.push(`  ${f.body.substring(0, 500)}`);
      if (f.recommendation) lines.push(`  Recommendation: ${f.recommendation.substring(0, 300)}`);
    }
  }

  return lines.join("\n");
}

function formatRound1Summary(outputs) {
  return outputs.map(formatAgentOutput).join("\n\n");
}

function formatAllFindings(round1Outputs, round2Outputs) {
  const parts = ["# Round 1: Independent Analysis\n"];
  parts.push(round1Outputs.map(formatAgentOutput).join("\n\n"));
  parts.push("\n\n# Round 2: Debate\n");
  parts.push(round2Outputs.map(formatAgentOutput).join("\n\n"));
  return parts.join("");
}

async function executeCouncilRun(request, backend) {
  ensureBackendReady(request.cwd, backend);
  ensureGitRepository(request.cwd);

  const { roles, topic, model, onProgress } = request;
  const workspaceRoot = ensureGitRepository(request.cwd);
  const reviewSchema = backend.readOutputSchema(REVIEW_SCHEMA);
  const councilSchema = backend.readOutputSchema(COUNCIL_SCHEMA);

  // Round 1: parallel independent exploration
  onProgress?.({ message: `Round 1: ${roles.length} agents exploring independently`, phase: "round-1" });

  const round1Results = await Promise.allSettled(
    roles.map((role) => {
      const prompt = buildCouncilRolePrompt(role, topic, null);
      return backend.runTurn(workspaceRoot, {
        prompt,
        model,
        sandbox: "read-only",
        outputSchema: reviewSchema,
        onProgress: (event) => {
          onProgress?.({ message: `[${role}] ${event?.message || "working"}`, phase: "round-1" });
        }
      }).then((result) => ({
        role,
        result,
        parsed: backend.parseStructuredOutput(result.finalMessage, {
          status: result.status,
          failureMessage: result.error?.message ?? result.stderr
        })
      }));
    })
  );

  const round1Outputs = round1Results.map((settled, i) => {
    if (settled.status === "fulfilled") return settled.value;
    return { role: roles[i], result: null, parsed: { parsed: null, rawOutput: "" }, failed: true };
  });

  const round1Summary = formatRound1Summary(round1Outputs);

  // Round 2: parallel debate
  onProgress?.({ message: `Round 2: ${roles.length} agents debating findings`, phase: "round-2" });

  const round2Results = await Promise.allSettled(
    roles.map((role) => {
      const prompt = buildCouncilRolePrompt(role, topic, round1Summary);
      return backend.runTurn(workspaceRoot, {
        prompt,
        model,
        sandbox: "read-only",
        outputSchema: reviewSchema,
        onProgress: (event) => {
          onProgress?.({ message: `[${role} debate] ${event?.message || "working"}`, phase: "round-2" });
        }
      }).then((result) => ({
        role,
        result,
        parsed: backend.parseStructuredOutput(result.finalMessage, {
          status: result.status,
          failureMessage: result.error?.message ?? result.stderr
        })
      }));
    })
  );

  const round2Outputs = round2Results.map((settled, i) => {
    if (settled.status === "fulfilled") return settled.value;
    return { role: roles[i], result: null, parsed: { parsed: null, rawOutput: "" }, failed: true };
  });

  // Synthesis
  onProgress?.({ message: "Synthesis: producing final verdict", phase: "synthesis" });

  const allFindings = formatAllFindings(round1Outputs, round2Outputs);
  const synthesisPrompt = buildSynthesisPrompt(topic, allFindings);

  const synthesisResult = await backend.runTurn(workspaceRoot, {
    prompt: synthesisPrompt,
    model,
    sandbox: "read-only",
    outputSchema: councilSchema,
    onProgress: (event) => {
      onProgress?.({ message: `[synthesis] ${event?.message || "working"}`, phase: "synthesis" });
    }
  });

  const synthesisParsed = backend.parseStructuredOutput(synthesisResult.finalMessage, {
    status: synthesisResult.status,
    failureMessage: synthesisResult.error?.message ?? synthesisResult.stderr
  });

  const payload = {
    council: true,
    roles,
    topic,
    round1: round1Outputs.map((o) => ({ role: o.role, result: o.parsed ?? o.result, failed: Boolean(o.failed) })),
    round2: round2Outputs.map((o) => ({ role: o.role, result: o.parsed ?? o.result, failed: Boolean(o.failed) })),
    synthesis: synthesisParsed,
    threadId: synthesisResult.threadId
  };

  const rendered = renderCouncilResult(payload);

  return {
    exitStatus: synthesisResult.status,
    threadId: synthesisResult.threadId,
    turnId: synthesisResult.turnId,
    payload,
    rendered,
    summary: synthesisParsed.parsed?.summary ?? "Council completed.",
    jobTitle: `${backend.displayName} Council`,
    jobClass: "review",
    targetLabel: "full codebase"
  };
}

function ensureBackendReady(cwd, backend) {
  backend.ensureReady(cwd);
}

function buildNativeReviewTarget(target) {
  if (target.mode === "working-tree") {
    return { type: "uncommittedChanges" };
  }

  if (target.mode === "branch") {
    return { type: "baseBranch", branch: target.baseRef };
  }

  return null;
}

function validateNativeReviewRequest(target, focusText) {
  if (focusText.trim()) {
    throw new Error(
      `\`/ai:review\` now maps directly to the built-in reviewer and does not support custom focus text. Retry with \`/ai:adversarial-review ${focusText.trim()}\` for focused review instructions.`
    );
  }

  const nativeTarget = buildNativeReviewTarget(target);
  if (!nativeTarget) {
    throw new Error("This `/ai:review` target is not supported by the built-in reviewer. Retry with `/ai:adversarial-review` for custom targeting.");
  }

  return nativeTarget;
}

function renderStatusPayload(report, asJson) {
  return asJson ? report : renderStatusReport(report);
}

function isActiveJobStatus(status) {
  return status === "queued" || status === "running";
}

async function waitForSingleJobSnapshot(cwd, reference, options = {}) {
  const timeoutMs = Math.max(0, Number(options.timeoutMs) || DEFAULT_STATUS_WAIT_TIMEOUT_MS);
  const pollIntervalMs = Math.max(100, Number(options.pollIntervalMs) || DEFAULT_STATUS_POLL_INTERVAL_MS);
  const deadline = Date.now() + timeoutMs;
  let snapshot = buildSingleJobSnapshot(cwd, reference);

  while (isActiveJobStatus(snapshot.job.status) && Date.now() < deadline) {
    await sleep(Math.min(pollIntervalMs, Math.max(0, deadline - Date.now())));
    snapshot = buildSingleJobSnapshot(cwd, reference);
  }

  return {
    ...snapshot,
    waitTimedOut: isActiveJobStatus(snapshot.job.status),
    timeoutMs
  };
}

async function resolveLatestTrackedTaskThread(cwd, backend, options = {}) {
  const workspaceRoot = resolveWorkspaceRoot(cwd);
  const jobs = sortJobsNewestFirst(listJobs(workspaceRoot)).filter((job) => job.id !== options.excludeJobId);
  const activeTask = jobs.find((job) => job.jobClass === "task" && (job.status === "queued" || job.status === "running"));
  if (activeTask) {
    throw new Error(`Task ${activeTask.id} is still running. Use /ai:status before continuing it.`);
  }

  const trackedTask = jobs.find((job) => job.jobClass === "task" && job.status === "completed" && job.threadId);
  if (trackedTask) {
    return { id: trackedTask.threadId };
  }

  return backend.findLatestTaskThread(workspaceRoot);
}

async function executeReviewRun(request, backend) {
  ensureBackendReady(request.cwd, backend);
  ensureGitRepository(request.cwd);

  const target = request.aspectOverride
    ? { mode: "full", label: "full codebase", explicit: true }
    : resolveReviewTarget(request.cwd, { base: request.base, scope: request.scope });
  const focusText = request.focusText?.trim() ?? "";
  const reviewName = request.reviewName ?? "Review";
  if (!request.aspectOverride && reviewName === "Review" && backend.supportsNativeReview) {
    const reviewTarget = validateNativeReviewRequest(target, focusText);
    const result = await backend.runReview(request.cwd, {
      target: reviewTarget,
      model: request.model,
      onProgress: request.onProgress
    });
    const payload = {
      review: reviewName,
      target,
      threadId: result.threadId,
      sourceThreadId: result.sourceThreadId,
      codex: {
        status: result.status,
        stderr: result.stderr,
        stdout: result.reviewText,
        reasoning: result.reasoningSummary
      }
    };
    const rendered = renderNativeReviewResult(
      {
        status: result.status,
        stdout: result.reviewText,
        stderr: result.stderr
      },
      { reviewLabel: reviewName, targetLabel: target.label, reasoningSummary: result.reasoningSummary }
    );

    return {
      exitStatus: result.status,
      threadId: result.threadId,
      turnId: result.turnId,
      payload,
      rendered,
      summary: firstMeaningfulLine(result.reviewText, `${reviewName} completed.`),
      jobTitle: `${backend.displayName} ${reviewName}`,
      jobClass: "review",
      targetLabel: target.label
    };
  }

  const context = request.aspectOverride
    ? collectFullCodebaseContext(request.cwd)
    : collectReviewContext(request.cwd, target);
  let prompt;
  if (request.aspectOverride) {
    prompt = buildAspectReviewPrompt(context, request.aspectOverride);
  } else if (reviewName === "Adversarial Review") {
    prompt = buildAdversarialReviewPrompt(context, focusText);
  } else {
    prompt = buildAdversarialReviewPrompt(context, focusText || "Standard code review: look for bugs, security issues, and quality improvements.");
  }
  const result = await backend.runTurn(context.repoRoot, {
    prompt,
    model: request.model,
    sandbox: "read-only",
    outputSchema: backend.readOutputSchema(REVIEW_SCHEMA),
    onProgress: request.onProgress
  });
  const parsed = backend.parseStructuredOutput(result.finalMessage, {
    status: result.status,
    failureMessage: result.error?.message ?? result.stderr
  });
  const payload = {
    review: reviewName,
    target,
    threadId: result.threadId,
    context: {
      repoRoot: context.repoRoot,
      branch: context.branch,
      summary: context.summary
    },
    codex: {
      status: result.status,
      stderr: result.stderr,
      stdout: result.finalMessage,
      reasoning: result.reasoningSummary
    },
    result: parsed.parsed,
    rawOutput: parsed.rawOutput,
    parseError: parsed.parseError,
    reasoningSummary: result.reasoningSummary
  };

  return {
    exitStatus: result.status,
    threadId: result.threadId,
    turnId: result.turnId,
    payload,
    rendered: renderReviewResult(parsed, {
      reviewLabel: reviewName,
      targetLabel: context.target.label,
      reasoningSummary: result.reasoningSummary
    }),
    summary: parsed.parsed?.summary ?? parsed.parseError ?? firstMeaningfulLine(result.finalMessage, `${reviewName} finished.`),
    jobTitle: `${backend.displayName} ${reviewName}`,
    jobClass: "review",
    targetLabel: context.target.label
  };
}


async function executeTaskRun(request, backend) {
  const workspaceRoot = resolveWorkspaceRoot(request.cwd);
  ensureBackendReady(request.cwd, backend);

  const taskMetadata = buildTaskRunMetadata({
    prompt: request.prompt,
    resumeLast: request.resumeLast,
    backend
  });

  let resumeThreadId = null;
  if (request.resumeLast) {
    const latestThread = await resolveLatestTrackedTaskThread(workspaceRoot, backend, {
      excludeJobId: request.jobId
    });
    if (!latestThread) {
      throw new Error("No previous task thread was found for this repository.");
    }
    resumeThreadId = latestThread.id;
  }

  if (!request.prompt && !resumeThreadId) {
    throw new Error("Provide a prompt, a prompt file, piped stdin, or use --resume-last.");
  }

  const result = await backend.runTurn(workspaceRoot, {
    resumeThreadId,
    prompt: request.prompt,
    defaultPrompt: resumeThreadId ? backend.DEFAULT_CONTINUE_PROMPT : "",
    model: request.model,
    effort: request.effort,
    sandbox: request.write ? "workspace-write" : "read-only",
    onProgress: request.onProgress,
    persistThread: true,
    threadName: resumeThreadId ? null : backend.buildPersistentTaskThreadName(request.prompt || backend.DEFAULT_CONTINUE_PROMPT)
  });

  const rawOutput = typeof result.finalMessage === "string" ? result.finalMessage : "";
  const failureMessage = result.error?.message ?? result.stderr ?? "";
  const rendered = renderTaskResult(
    {
      rawOutput,
      failureMessage,
      reasoningSummary: result.reasoningSummary
    },
    {
      title: taskMetadata.title,
      jobId: request.jobId ?? null,
      write: Boolean(request.write)
    }
  );
  const payload = {
    status: result.status,
    threadId: result.threadId,
    rawOutput,
    touchedFiles: result.touchedFiles,
    reasoningSummary: result.reasoningSummary
  };

  return {
    exitStatus: result.status,
    threadId: result.threadId,
    turnId: result.turnId,
    payload,
    rendered,
    summary: firstMeaningfulLine(rawOutput, firstMeaningfulLine(failureMessage, `${taskMetadata.title} finished.`)),
    jobTitle: taskMetadata.title,
    jobClass: "task",
    write: Boolean(request.write)
  };
}

function buildReviewJobMetadata(reviewName, target, backend = null) {
  const displayName = backend?.displayName ?? "AI";
  const isAdversarial = reviewName === "Adversarial Review";
  const isStandardReview = reviewName === "Review";
  return {
    kind: isAdversarial ? "adversarial-review" : isStandardReview ? "review" : "aspect-review",
    title: isStandardReview ? `${displayName} Review` : `${displayName} ${reviewName}`,
    summary: `${reviewName} ${target.label}`
  };
}

function buildTaskRunMetadata({ prompt, resumeLast = false, backend = null }) {
  if (!resumeLast && String(prompt ?? "").includes(STOP_REVIEW_TASK_MARKER)) {
    const displayName = backend?.displayName ?? "Codex";
    return {
      title: `${displayName} Stop Gate Review`,
      summary: "Stop-gate review of previous Claude turn"
    };
  }

  const displayName = backend?.displayName ?? "Codex";
  const defaultContinuePrompt = backend?.DEFAULT_CONTINUE_PROMPT ?? "Continue from the current thread state.";
  const title = resumeLast ? `${displayName} Resume` : `${displayName} Task`;
  const fallbackSummary = resumeLast ? defaultContinuePrompt : "Task";
  return {
    title,
    summary: shorten(prompt || fallbackSummary)
  };
}

function renderQueuedTaskLaunch(payload) {
  return `${payload.title} started in the background as ${payload.jobId}. Check /ai:status ${payload.jobId} for progress.\n`;
}

function getJobKindLabel(kind, jobClass) {
  if (kind === "adversarial-review") {
    return "adversarial-review";
  }
  return jobClass === "review" ? "review" : "rescue";
}

function createCompanionJob({ prefix, kind, title, workspaceRoot, jobClass, summary, write = false }) {
  return createJobRecord({
    id: generateJobId(prefix),
    kind,
    kindLabel: getJobKindLabel(kind, jobClass),
    title,
    workspaceRoot,
    jobClass,
    summary,
    write
  });
}

function createTrackedProgress(job, options = {}) {
  const logFile = options.logFile ?? createJobLogFile(job.workspaceRoot, job.id, job.title);
  return {
    logFile,
    progress: createProgressReporter({
      stderr: Boolean(options.stderr),
      logFile,
      onEvent: createJobProgressUpdater(job.workspaceRoot, job.id)
    })
  };
}

function buildTaskJob(workspaceRoot, taskMetadata, write) {
  return createCompanionJob({
    prefix: "task",
    kind: "task",
    title: taskMetadata.title,
    workspaceRoot,
    jobClass: "task",
    summary: taskMetadata.summary,
    write
  });
}

function buildTaskRequest({ cwd, model, effort, prompt, write, resumeLast, jobId }) {
  return {
    cwd,
    model,
    effort,
    prompt,
    write,
    resumeLast,
    jobId
  };
}

function readTaskPrompt(cwd, options, positionals) {
  if (options["prompt-file"]) {
    return fs.readFileSync(path.resolve(cwd, options["prompt-file"]), "utf8");
  }

  const positionalPrompt = positionals.join(" ");
  return positionalPrompt || readStdinIfPiped();
}

function requireTaskRequest(prompt, resumeLast) {
  if (!prompt && !resumeLast) {
    throw new Error("Provide a prompt, a prompt file, piped stdin, or use --resume-last.");
  }
}

async function runForegroundCommand(job, runner, options = {}) {
  const { logFile, progress } = createTrackedProgress(job, {
    logFile: options.logFile,
    stderr: !options.json
  });
  const execution = await runTrackedJob(job, () => runner(progress), { logFile });
  outputResult(options.json ? execution.payload : execution.rendered, options.json);
  if (execution.exitStatus !== 0) {
    process.exitCode = execution.exitStatus;
  }
  return execution;
}

function spawnDetachedTaskWorker(cwd, jobId) {
  const scriptPath = path.join(ROOT_DIR, "scripts", "ai-companion.mjs");
  const child = spawn(process.execPath, [scriptPath, "task-worker", "--cwd", cwd, "--job-id", jobId], {
    cwd,
    env: process.env,
    detached: true,
    stdio: "ignore",
    windowsHide: true
  });
  child.unref();
  return child;
}

function enqueueBackgroundTask(cwd, job, request) {
  const { logFile } = createTrackedProgress(job);
  appendLogLine(logFile, "Queued for background execution.");

  const child = spawnDetachedTaskWorker(cwd, job.id);
  const queuedRecord = {
    ...job,
    status: "queued",
    phase: "queued",
    pid: child.pid ?? null,
    logFile,
    request
  };
  writeJobFile(job.workspaceRoot, job.id, queuedRecord);
  upsertJob(job.workspaceRoot, queuedRecord);

  return {
    payload: {
      jobId: job.id,
      status: "queued",
      title: job.title,
      summary: job.summary,
      logFile
    },
    logFile
  };
}

async function handleReviewCommand(argv, config, backend, resolvedModel = null) {
  const { options, positionals } = parseCommandInput(argv, {
    valueOptions: ["base", "scope", "cwd"],
    booleanOptions: ["json", "background", "wait"]
  });

  const cwd = resolveCommandCwd(options);
  const workspaceRoot = resolveCommandWorkspace(options);
  const effectivePositionals = config.aspectOverride
    ? positionals.slice(1)
    : positionals;
  const focusText = effectivePositionals.join(" ").trim();
  const target = config.aspectOverride
    ? { mode: "full", label: "full codebase", explicit: true }
    : resolveReviewTarget(cwd, { base: options.base, scope: options.scope });

  if (!config.aspectOverride) config.validateRequest?.(target, focusText);
  const metadata = buildReviewJobMetadata(config.reviewName, target, backend);
  const job = createCompanionJob({
    prefix: "review",
    kind: metadata.kind,
    title: metadata.title,
    workspaceRoot,
    jobClass: "review",
    summary: metadata.summary
  });
  await runForegroundCommand(
    job,
    (progress) =>
      executeReviewRun({
        cwd,
        base: options.base,
        scope: options.scope,
        model: resolvedModel,
        focusText,
        reviewName: config.reviewName,
        aspectOverride: config.aspectOverride ?? null,
        onProgress: progress
      }, backend),
    { json: options.json }
  );
}

async function handleReview(argv, backend, resolvedModel = null) {
  const { positionals: prePositionals } = parseCommandInput(argv, {
    valueOptions: ["base", "scope", "cwd", "model"],
    booleanOptions: ["json", "background", "wait"]
  });

  const aspectArg = prePositionals[0] ? parseAspectArg(prePositionals[0]) : null;

  if (!aspectArg) {
    return handleReviewCommand(argv, {
      reviewName: "Review",
      validateRequest: backend.supportsNativeReview ? validateNativeReviewRequest : null
    }, backend, resolvedModel);
  }

  const aspectLabel = [
    aspectArg.language ? capitalize(aspectArg.language) : null,
    aspectArg.techstack ? capitalize(aspectArg.techstack) : null,
    capitalize(aspectArg.aspect)
  ].filter(Boolean).join(" ");

  return handleReviewCommand(argv, {
    reviewName: `${aspectLabel} Review`,
    aspectOverride: aspectArg
  }, backend, resolvedModel);
}

async function handleCouncil(argv, backend, resolvedModel = null) {
  const { options, positionals } = parseCommandInput(argv, {
    valueOptions: ["roles", "cwd"],
    booleanOptions: ["json", "background", "wait"]
  });

  const cwd = resolveCommandCwd(options);
  const workspaceRoot = resolveCommandWorkspace(options);

  const rolesRaw = options.roles || "security,performance,architecture";
  const roles = rolesRaw.split(",").map((r) => r.trim()).filter(Boolean);
  if (roles.length === 0) throw new Error("At least one role is required for council.");
  if (roles.length > 7) throw new Error("Maximum 7 council roles allowed.");

  const topic = positionals.join(" ").trim() || "General code review and analysis";

  const job = createCompanionJob({
    prefix: "council",
    kind: "council",
    title: `${backend.displayName} Council`,
    workspaceRoot,
    jobClass: "review",
    summary: `Council: ${roles.join(", ")} — ${shorten(topic)}`
  });

  await runForegroundCommand(
    job,
    (progress) =>
      executeCouncilRun({
        cwd,
        model: resolvedModel,
        roles,
        topic,
        onProgress: progress
      }, backend),
    { json: options.json }
  );
}

async function handleTask(argv, backend, resolvedModel = null) {
  const { options, positionals } = parseCommandInput(argv, {
    valueOptions: ["effort", "cwd", "prompt-file"],
    booleanOptions: ["json", "write", "resume-last", "resume", "fresh", "background"]
  });

  const cwd = resolveCommandCwd(options);
  const workspaceRoot = resolveCommandWorkspace(options);
  const model = resolvedModel;
  const effort = normalizeReasoningEffort(options.effort);
  const prompt = readTaskPrompt(cwd, options, positionals);

  const resumeLast = Boolean(options["resume-last"] || options.resume);
  const fresh = Boolean(options.fresh);
  if (resumeLast && fresh) {
    throw new Error("Choose either --resume/--resume-last or --fresh.");
  }
  const write = Boolean(options.write);
  const taskMetadata = buildTaskRunMetadata({
    prompt,
    resumeLast,
    backend
  });

  if (options.background) {
    ensureBackendReady(cwd, backend);
    requireTaskRequest(prompt, resumeLast);

    const job = buildTaskJob(workspaceRoot, taskMetadata, write);
    const request = buildTaskRequest({
      cwd,
      model,
      effort,
      prompt,
      write,
      resumeLast,
      jobId: job.id
    });
    const { payload } = enqueueBackgroundTask(cwd, job, request);
    outputCommandResult(payload, renderQueuedTaskLaunch(payload), options.json);
    return;
  }

  const job = buildTaskJob(workspaceRoot, taskMetadata, write);
  await runForegroundCommand(
    job,
    (progress) =>
      executeTaskRun({
        cwd,
        model,
        effort,
        prompt,
        write,
        resumeLast,
        jobId: job.id,
        onProgress: progress
      }, backend),
    { json: options.json }
  );
}

async function handleTaskWorker(argv, backend) {
  const { options } = parseCommandInput(argv, {
    valueOptions: ["cwd", "job-id"]
  });

  if (!options["job-id"]) {
    throw new Error("Missing required --job-id for task-worker.");
  }

  const cwd = resolveCommandCwd(options);
  const workspaceRoot = resolveCommandWorkspace(options);
  const storedJob = readStoredJob(workspaceRoot, options["job-id"]);
  if (!storedJob) {
    throw new Error(`No stored job found for ${options["job-id"]}.`);
  }

  const request = storedJob.request;
  if (!request || typeof request !== "object") {
    throw new Error(`Stored job ${options["job-id"]} is missing its task request payload.`);
  }

  const { logFile, progress } = createTrackedProgress(
    {
      ...storedJob,
      workspaceRoot
    },
    {
      logFile: storedJob.logFile ?? null
    }
  );
  await runTrackedJob(
    {
      ...storedJob,
      workspaceRoot,
      logFile
    },
    () =>
      executeTaskRun({
        ...request,
        onProgress: progress
      }, backend),
    { logFile }
  );
}

async function handleStatus(argv) {
  const { options, positionals } = parseCommandInput(argv, {
    valueOptions: ["cwd", "timeout-ms", "poll-interval-ms"],
    booleanOptions: ["json", "all", "wait"]
  });

  const cwd = resolveCommandCwd(options);
  const reference = positionals[0] ?? "";
  if (reference) {
    const snapshot = options.wait
      ? await waitForSingleJobSnapshot(cwd, reference, {
          timeoutMs: options["timeout-ms"],
          pollIntervalMs: options["poll-interval-ms"]
        })
      : buildSingleJobSnapshot(cwd, reference);
    outputCommandResult(snapshot, renderJobStatusReport(snapshot.job), options.json);
    return;
  }

  if (options.wait) {
    throw new Error("`status --wait` requires a job id.");
  }

  const report = buildStatusSnapshot(cwd, { all: options.all });
  outputResult(renderStatusPayload(report, options.json), options.json);
}

function handleResult(argv) {
  const { options, positionals } = parseCommandInput(argv, {
    valueOptions: ["cwd"],
    booleanOptions: ["json"]
  });

  const cwd = resolveCommandCwd(options);
  const reference = positionals[0] ?? "";
  const { workspaceRoot, job } = resolveResultJob(cwd, reference);
  const storedJob = readStoredJob(workspaceRoot, job.id);
  const payload = {
    job,
    storedJob
  };

  outputCommandResult(payload, renderStoredJobResult(job, storedJob), options.json);
}

function handleTaskResumeCandidate(argv) {
  const { options } = parseCommandInput(argv, {
    valueOptions: ["cwd"],
    booleanOptions: ["json"]
  });

  const cwd = resolveCommandCwd(options);
  const workspaceRoot = resolveCommandWorkspace(options);
  const sessionId = process.env[SESSION_ID_ENV] ?? null;
  const jobs = sortJobsNewestFirst(listJobs(workspaceRoot));
  const candidate =
    jobs.find(
      (job) =>
        job.jobClass === "task" &&
        job.threadId &&
        job.status !== "queued" &&
        job.status !== "running" &&
        (!sessionId || job.sessionId === sessionId)
    ) ?? null;

  const payload = {
    available: Boolean(candidate),
    sessionId,
    candidate:
      candidate == null
        ? null
        : {
            id: candidate.id,
            status: candidate.status,
            title: candidate.title ?? null,
            summary: candidate.summary ?? null,
            threadId: candidate.threadId,
            completedAt: candidate.completedAt ?? null,
            updatedAt: candidate.updatedAt ?? null
          }
  };

  const rendered = candidate
    ? `Resumable task found: ${candidate.id} (${candidate.status}).\n`
    : "No resumable task found for this session.\n";
  outputCommandResult(payload, rendered, options.json);
}

async function handleCancel(argv, backend) {
  const { options, positionals } = parseCommandInput(argv, {
    valueOptions: ["cwd"],
    booleanOptions: ["json"]
  });

  const cwd = resolveCommandCwd(options);
  const reference = positionals[0] ?? "";
  const { workspaceRoot, job } = resolveCancelableJob(cwd, reference);
  const existing = readStoredJob(workspaceRoot, job.id) ?? {};
  const threadId = existing.threadId ?? job.threadId ?? null;
  const turnId = existing.turnId ?? job.turnId ?? null;

  const interrupt = await backend.interruptTurn(cwd, { threadId, turnId });
  if (interrupt.attempted) {
    appendLogLine(
      job.logFile,
      interrupt.interrupted
        ? `Requested turn interrupt for ${turnId} on ${threadId}.`
        : `Turn interrupt failed${interrupt.detail ? `: ${interrupt.detail}` : "."}`
    );
  }

  terminateProcessTree(job.pid ?? Number.NaN);
  appendLogLine(job.logFile, "Cancelled by user.");

  const completedAt = nowIso();
  const nextJob = {
    ...job,
    status: "cancelled",
    phase: "cancelled",
    pid: null,
    completedAt,
    errorMessage: "Cancelled by user."
  };

  writeJobFile(workspaceRoot, job.id, {
    ...existing,
    ...nextJob,
    cancelledAt: completedAt
  });
  upsertJob(workspaceRoot, {
    id: job.id,
    status: "cancelled",
    phase: "cancelled",
    pid: null,
    errorMessage: "Cancelled by user.",
    completedAt
  });

  const payload = {
    jobId: job.id,
    status: "cancelled",
    title: job.title,
    turnInterruptAttempted: interrupt.attempted,
    turnInterrupted: interrupt.interrupted
  };

  outputCommandResult(payload, renderCancelReport(nextJob), options.json);
}

function extractFlag(argv, flag) {
  const idx = argv.indexOf(flag);
  if (idx === -1) {
    return { value: null, remainingArgv: argv };
  }
  const value = argv[idx + 1] ?? null;
  if (!value) {
    throw new Error(`${flag} requires a value.`);
  }
  const remainingArgv = [...argv.slice(0, idx), ...argv.slice(idx + 2)];
  return { value, remainingArgv };
}

function resolveBackendFromArgs(rawArgv) {
  // Support legacy --backend flag for backward compat (e.g., from hooks)
  const { value: legacyBackend, remainingArgv: afterBackend } = extractFlag(rawArgv, "--backend");
  if (legacyBackend) {
    // Legacy mode: --backend determines provider, --model stays as-is
    const { value: rawModel, remainingArgv: afterModel } = extractFlag(afterBackend, "--model");
    // Also check -m alias
    const { value: rawModelShort, remainingArgv: finalArgv } = extractFlag(afterModel, "-m");
    const model = rawModel || rawModelShort || null;
    return { provider: legacyBackend, model, argv: finalArgv };
  }

  // New mode: --model provider:model determines both provider and model
  const { value: rawModel, remainingArgv: afterModel } = extractFlag(afterBackend, "--model");
  const { value: rawModelShort, remainingArgv: finalArgv } = extractFlag(afterModel, "-m");
  const modelArg = rawModel || rawModelShort || null;

  const config = loadPluginConfig();
  const { provider, model } = resolveProviderAndModel(modelArg, config);
  return { provider, model, argv: finalArgv };
}

async function main() {
  const [subcommand, ...rawArgv] = process.argv.slice(2);
  if (!subcommand || subcommand === "help" || subcommand === "--help") {
    printUsage();
    return;
  }

  const { provider, model: resolvedModel, argv } = resolveBackendFromArgs(rawArgv);
  const backend = getBackend(provider);

  switch (subcommand) {
    case "setup":
      handleSetup(argv, backend);
      break;
    case "review":
      await handleReview(argv, backend, resolvedModel);
      break;
    case "adversarial-review":
      await handleReviewCommand(argv, {
        reviewName: "Adversarial Review"
      }, backend, resolvedModel);
      break;
    case "council":
      await handleCouncil(argv, backend, resolvedModel);
      break;
    case "task":
      await handleTask(argv, backend, resolvedModel);
      break;
    case "task-worker":
      await handleTaskWorker(argv, backend);
      break;
    case "status":
      await handleStatus(argv);
      break;
    case "result":
      handleResult(argv);
      break;
    case "task-resume-candidate":
      handleTaskResumeCandidate(argv);
      break;
    case "cancel":
      await handleCancel(argv, backend);
      break;
    default:
      throw new Error(`Unknown subcommand: ${subcommand}`);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
