/**
 * planning-docs.mjs — frontmatter parser, DAG computer, bidirectional sync,
 * and renderers for the AI Companion planning document family.
 *
 * Doc IDs: short-form `<SHORT>-<NN>` (e.g., FDR-03). Filenames: `<SHORT>-<NN>-<slug>.md|.yaml`.
 * Type field: full form (e.g., `feature-development-record`). Directory names: full form.
 * upstream / downstream: lists of relative paths from repo root.
 *
 * Depends on python3 + PyYAML for YAML parse/dump. Fails with a clear error if unavailable.
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

// ── Canonical type mapping ─────────────────────────────────────────────

export const SHORT_TO_TYPE = Object.freeze({
  ADR: "architecture-decision-record",
  FDR: "feature-development-record",
  TP: "test-plan",
  IMPL: "implementation-plan",
  TODO: "todo-list",
  HANDOFF: "handoff-record",
  TRACE: "traceability-report",
  VAL: "validation-report",
});

export const TYPE_TO_SHORT = Object.freeze(
  Object.fromEntries(Object.entries(SHORT_TO_TYPE).map(([s, t]) => [t, s]))
);

export const TYPE_TO_DIR = Object.freeze({
  "architecture-decision-record": ".claude/project/architecture-decision-records",
  "feature-development-record": ".claude/project/feature-development-records",
  "test-plan": ".claude/project/test-plans",
  "implementation-plan": ".claude/project/implementation-plans",
  "todo-list": ".claude/project/todo-lists",
  "handoff-record": ".claude/project/handoff-records",
  "traceability-report": ".claude/project/traceability-reports",
  "validation-report": ".claude/project/validation-reports",
});

const DOC_TYPES = new Set(Object.keys(TYPE_TO_DIR));
const STATUS_VALUES = new Set(["draft", "active", "superseded", "deprecated"]);
const TASK_STATUSES = new Set(["pending", "ready", "in-progress", "blocked", "in-review", "complete", "cancelled"]);
const TASK_PRIORITIES = new Set(["P0", "P1", "P2", "P3"]);
const TASK_EFFORTS = new Set(["XS", "S", "M", "L", "XL"]);
const EFFORT_POINTS = { XS: 1, S: 2, M: 3, L: 5, XL: 8 };
const DEPENDENCY_KINDS = new Set(["hard", "soft", "data"]);
const EVIDENCE_KINDS = new Set(["implementation", "test", "doc"]);

// ── YAML bridge (python3 + PyYAML) ─────────────────────────────────────

function runPython(script, input) {
  const res = spawnSync("python3", ["-c", script], { input, encoding: "utf8" });
  if (res.error && res.error.code === "ENOENT") {
    throw new Error("planning-docs: python3 not found; required for YAML parsing");
  }
  if (res.status !== 0) {
    throw new Error(`planning-docs: YAML bridge failed — ${res.stderr || res.stdout || "unknown error"}`);
  }
  return res.stdout;
}

export function parseYAML(text) {
  if (!text || !text.trim()) return null;
  const out = runPython(
    "import sys, json, yaml; print(json.dumps(yaml.safe_load(sys.stdin.read()), default=str))",
    text
  );
  return JSON.parse(out || "null");
}

export function dumpYAML(obj) {
  return runPython(
    "import sys, json, yaml; print(yaml.dump(json.loads(sys.stdin.read()), sort_keys=False, default_flow_style=False, allow_unicode=True), end='')",
    JSON.stringify(obj)
  );
}

// ── Document IO ────────────────────────────────────────────────────────

/**
 * Read a planning doc from disk.
 * .yaml files: whole file is YAML, returns { frontmatter, body: "", tasks? }
 * .md files: frontmatter between --- markers, rest is body.
 */
export function readDoc(absPath) {
  if (!fs.existsSync(absPath)) {
    throw new Error(`planning-docs: file not found: ${absPath}`);
  }
  const raw = fs.readFileSync(absPath, "utf8");
  if (absPath.endsWith(".yaml") || absPath.endsWith(".yml")) {
    const obj = parseYAML(raw) || {};
    return { frontmatter: obj, body: "", path: absPath };
  }
  // Markdown with YAML frontmatter
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) {
    throw new Error(`planning-docs: ${absPath} has no YAML frontmatter block`);
  }
  const frontmatter = parseYAML(match[1]) || {};
  const body = match[2] || "";
  return { frontmatter, body, path: absPath };
}

export function writeDoc(absPath, { frontmatter, body = "" }) {
  const yamlText = dumpYAML(frontmatter).trimEnd();
  if (absPath.endsWith(".yaml") || absPath.endsWith(".yml")) {
    fs.writeFileSync(absPath, yamlText + "\n", "utf8");
  } else {
    fs.writeFileSync(absPath, `---\n${yamlText}\n---\n${body.startsWith("\n") ? body : "\n" + body}`, "utf8");
  }
}

// ── Schema validation ──────────────────────────────────────────────────

/**
 * Validate a doc's frontmatter + (for TODO) task list & DAG.
 * Returns { ok: boolean, errors: string[], warnings: string[] }.
 */
export function validateDoc(doc, repoRoot) {
  const errors = [];
  const warnings = [];
  const fm = doc.frontmatter || {};

  // Required top-level fields
  for (const key of ["id", "type", "slug", "title", "status", "upstream", "downstream", "created", "updated"]) {
    if (fm[key] === undefined) errors.push(`missing required field '${key}'`);
  }

  if (fm.type && !DOC_TYPES.has(fm.type)) {
    errors.push(`invalid type '${fm.type}' (expected one of ${[...DOC_TYPES].join(", ")})`);
  }
  if (fm.status && !STATUS_VALUES.has(fm.status)) {
    errors.push(`invalid status '${fm.status}' (expected one of ${[...STATUS_VALUES].join(", ")})`);
  }

  // id must match filename stem
  if (fm.id && doc.path) {
    const stem = path.basename(doc.path).replace(/\.(md|yaml|yml)$/, "");
    const expectedIdPrefix = stem.match(/^([A-Z]+-\d+)/)?.[1];
    if (expectedIdPrefix && expectedIdPrefix !== fm.id) {
      errors.push(`id '${fm.id}' does not match filename stem '${stem}' (expected '${expectedIdPrefix}')`);
    }
  }

  // id prefix must correspond to type
  if (fm.id && fm.type) {
    const idPrefix = fm.id.split("-")[0];
    const expectedType = SHORT_TO_TYPE[idPrefix];
    if (!expectedType) {
      errors.push(`id prefix '${idPrefix}' is unknown (expected one of ${Object.keys(SHORT_TO_TYPE).join(", ")})`);
    } else if (expectedType !== fm.type) {
      errors.push(`id '${fm.id}' implies type '${expectedType}' but frontmatter says '${fm.type}'`);
    }
  }

  // upstream / downstream: must be list of relative paths
  for (const field of ["upstream", "downstream"]) {
    const list = fm[field];
    if (list === undefined) continue;
    if (!Array.isArray(list)) { errors.push(`${field} must be a list`); continue; }
    for (const entry of list) {
      if (typeof entry !== "string") { errors.push(`${field} entry ${JSON.stringify(entry)} must be a string path`); continue; }
      if (path.isAbsolute(entry)) errors.push(`${field} entry '${entry}' must be a relative path (from repo root), not absolute`);
      if (!entry.startsWith(".claude/project/")) errors.push(`${field} entry '${entry}' must start with '.claude/project/'`);
      if (repoRoot) {
        const abs = path.resolve(repoRoot, entry);
        if (!fs.existsSync(abs)) warnings.push(`${field} entry '${entry}' does not exist at ${abs}`);
      }
    }
  }

  // ADR may have empty upstream; all others must have at least one upstream path
  if (fm.type && fm.type !== "architecture-decision-record" && Array.isArray(fm.upstream) && fm.upstream.length === 0) {
    errors.push(`${fm.type} must declare at least one upstream path (only architecture-decision-record may have empty upstream)`);
  }

  // TODO-specific checks
  if (fm.type === "todo-list") {
    const taskErrors = validateTaskList(fm.tasks);
    errors.push(...taskErrors);
    if (!taskErrors.length && Array.isArray(fm.tasks)) {
      const dagErrors = validateDependencies(fm.tasks, fm.dependencies ?? []);
      errors.push(...dagErrors);
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

function validateTaskList(tasks) {
  const errors = [];
  if (!Array.isArray(tasks)) { errors.push("tasks must be a list"); return errors; }
  const seen = new Set();
  for (const t of tasks) {
    if (!t || typeof t !== "object") { errors.push("task entry must be a mapping"); continue; }
    if (!t.id || typeof t.id !== "string") { errors.push("task missing id"); continue; }
    if (seen.has(t.id)) errors.push(`duplicate task id '${t.id}'`);
    seen.add(t.id);
    if (!t.title) errors.push(`task ${t.id} missing title`);
    if (!TASK_STATUSES.has(t.status)) errors.push(`task ${t.id} invalid status '${t.status}' (expected one of ${[...TASK_STATUSES].join(", ")})`);
    if (!TASK_PRIORITIES.has(t.priority)) errors.push(`task ${t.id} invalid priority '${t.priority}' (expected P0|P1|P2|P3)`);
    if (!TASK_EFFORTS.has(t.effort)) errors.push(`task ${t.id} invalid effort '${t.effort}' (expected XS|S|M|L|XL)`);
    if (typeof t.confidence !== "number" || t.confidence < 0 || t.confidence > 1) {
      errors.push(`task ${t.id} invalid confidence '${t.confidence}' (expected 0..1 float)`);
    }
    if (t.evidence !== undefined) {
      if (!Array.isArray(t.evidence)) errors.push(`task ${t.id}.evidence must be a list`);
      else for (const e of t.evidence) {
        if (!e || typeof e !== "object") { errors.push(`task ${t.id} evidence entry must be a mapping`); continue; }
        if (!e.file) errors.push(`task ${t.id} evidence missing 'file'`);
        if (e.kind && !EVIDENCE_KINDS.has(e.kind)) errors.push(`task ${t.id} evidence invalid kind '${e.kind}'`);
      }
    }
  }
  return errors;
}

function validateDependencies(tasks, deps) {
  const errors = [];
  if (!Array.isArray(deps)) { errors.push("dependencies must be a list"); return errors; }
  const taskIds = new Set(tasks.map((t) => t.id));
  for (const d of deps) {
    if (!d || typeof d !== "object") { errors.push("dependency entry must be a mapping"); continue; }
    if (!d.from || !taskIds.has(d.from)) errors.push(`dependency 'from' ${JSON.stringify(d.from)} not in tasks`);
    if (!d.to || !taskIds.has(d.to)) errors.push(`dependency 'to' ${JSON.stringify(d.to)} not in tasks`);
    if (d.from === d.to) errors.push(`dependency self-loop on ${d.from}`);
    if (!DEPENDENCY_KINDS.has(d.kind)) errors.push(`dependency ${d.from}→${d.to} invalid kind '${d.kind}'`);
    if (!d.reason || typeof d.reason !== "string") errors.push(`dependency ${d.from}→${d.to} missing reason`);
  }
  if (errors.length) return errors;

  // Cycle detection (across all edge kinds)
  const adj = new Map();
  for (const id of taskIds) adj.set(id, []);
  for (const d of deps) adj.get(d.from).push(d.to);
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map([...taskIds].map((id) => [id, WHITE]));
  const path_stack = [];
  const cycles = [];
  function dfs(u) {
    color.set(u, GRAY); path_stack.push(u);
    for (const v of adj.get(u)) {
      if (color.get(v) === GRAY) {
        const start = path_stack.indexOf(v);
        cycles.push([...path_stack.slice(start), v]);
      } else if (color.get(v) === WHITE) dfs(v);
    }
    path_stack.pop(); color.set(u, BLACK);
  }
  for (const id of taskIds) if (color.get(id) === WHITE) dfs(id);
  for (const c of cycles) errors.push(`dependency cycle: ${c.join(" → ")}`);
  return errors;
}

// ── DAG computation ────────────────────────────────────────────────────

export function computeDAG(tasks, dependencies) {
  if (!Array.isArray(tasks) || tasks.length === 0) {
    return { roots: [], ready: [], critical_path: [], parallel_tracks: [] };
  }
  const taskById = new Map(tasks.map((t) => [t.id, t]));
  const deps = Array.isArray(dependencies) ? dependencies : [];

  // Incoming edges per task (hard + data count as blocking; soft does not)
  const incoming = new Map([...taskById.keys()].map((id) => [id, []]));
  const outgoing = new Map([...taskById.keys()].map((id) => [id, []]));
  for (const d of deps) {
    incoming.get(d.to)?.push(d);
    outgoing.get(d.from)?.push(d);
  }

  // Roots: no incoming of any kind
  const roots = [...taskById.keys()].filter((id) => incoming.get(id).length === 0);

  // Ready: status is pending or ready AND all hard/data predecessors are complete
  const ready = [];
  for (const [id, task] of taskById) {
    if (!(task.status === "pending" || task.status === "ready")) continue;
    const blockers = incoming.get(id).filter((d) => d.kind === "hard" || d.kind === "data");
    const allClear = blockers.every((d) => taskById.get(d.from)?.status === "complete");
    if (allClear) ready.push(id);
  }

  // Critical path: longest effort-weighted path from any root to any leaf
  const memo = new Map();
  function longest(id) {
    if (memo.has(id)) return memo.get(id);
    const task = taskById.get(id);
    const w = EFFORT_POINTS[task?.effort] ?? 0;
    const outs = outgoing.get(id).filter((d) => d.kind !== "soft");
    let best = { length: w, path: [id] };
    for (const d of outs) {
      const child = longest(d.to);
      if (w + child.length > best.length) {
        best = { length: w + child.length, path: [id, ...child.path] };
      }
    }
    memo.set(id, best);
    return best;
  }
  let critical = { length: 0, path: [] };
  for (const id of roots) {
    const r = longest(id);
    if (r.length > critical.length) critical = r;
  }

  // Parallel tracks: each independent subgraph starting at a root
  const visited = new Set();
  const parallel_tracks = [];
  function collect(id, track) {
    if (visited.has(id)) return;
    visited.add(id);
    track.push(id);
    for (const d of outgoing.get(id)) collect(d.to, track);
  }
  for (const r of roots) {
    if (visited.has(r)) continue;
    const track = [];
    collect(r, track);
    parallel_tracks.push(track);
  }

  return {
    roots,
    ready,
    critical_path: critical.path,
    critical_path_points: critical.length,
    parallel_tracks,
  };
}

// ── Renderers ──────────────────────────────────────────────────────────

export function renderAscii(doc) {
  const fm = doc.frontmatter;
  const tasks = fm.tasks ?? [];
  const deps = fm.dependencies ?? [];
  const dag = computeDAG(tasks, deps);
  const taskById = new Map(tasks.map((t) => [t.id, t]));
  const outgoing = new Map(tasks.map((t) => [t.id, []]));
  for (const d of deps) outgoing.get(d.from)?.push(d);

  const lines = [];
  lines.push(`${fm.id}: ${fm.title}`);
  lines.push(`Ready: ${dag.ready.join(", ") || "(none)"}`);
  lines.push(`Critical: ${dag.critical_path.join(" → ") || "(none)"} (${dag.critical_path_points} pts)`);
  lines.push(`Parallel tracks: ${dag.parallel_tracks.length}`);
  lines.push("");

  const printed = new Set();
  function labelOf(id) {
    const t = taskById.get(id);
    if (!t) return id;
    return `${id} [${t.priority} ${t.effort} ${t.status}] ${t.title}`;
  }
  function arrow(kind) {
    return kind === "hard" ? "═══" : kind === "data" ? "═D═" : "───";
  }
  function bracket(kind) {
    return kind === "hard" ? "[hard]" : kind === "data" ? "[data]" : "(soft)";
  }
  // Recursive walker; marks nodes as printed so shared descendants only draw once
  // per tree root. Hard/data children recurse; soft children are noted as cross-refs.
  function walk(id, prefix) {
    const children = [...(outgoing.get(id) || [])].sort((a, b) => a.to.localeCompare(b.to));
    children.forEach((d, i) => {
      const last = i === children.length - 1;
      const connector = last ? "└─" : "├─";
      const childPrefix = prefix + (last ? "   " : "│  ");
      if (d.kind === "soft") {
        lines.push(`${prefix}${connector}${arrow(d.kind)} ${bracket(d.kind)} ${d.to} (cross-ref)`);
        printed.add(d.to);
      } else if (printed.has(d.to)) {
        lines.push(`${prefix}${connector}${arrow(d.kind)} ${bracket(d.kind)} ${d.to} (shown above)`);
      } else {
        printed.add(d.to);
        lines.push(`${prefix}${connector}${arrow(d.kind)} ${bracket(d.kind)} ${labelOf(d.to)}`);
        walk(d.to, childPrefix);
      }
    });
  }
  for (const r of dag.roots) {
    if (!printed.has(r)) {
      printed.add(r);
      lines.push(labelOf(r));
      walk(r, "");
    }
    lines.push("");
  }
  // Orphan tasks (not reachable from roots)
  const orphans = tasks.map((t) => t.id).filter((id) => !printed.has(id));
  if (orphans.length) {
    lines.push("Unreachable tasks:");
    for (const id of orphans) lines.push(`  ${labelOf(id)}`);
    lines.push("");
  }
  lines.push("Legend: [priority effort status]  ═══ hard  ─── soft  ═D═ data");
  return lines.join("\n");
}

export function renderMermaid(doc) {
  const fm = doc.frontmatter;
  const tasks = fm.tasks ?? [];
  const deps = fm.dependencies ?? [];
  const lines = ["```mermaid", "graph TD"];
  for (const t of tasks) {
    const label = `${t.id}: ${t.title}\\n${t.priority} · ${t.effort} · ${t.status}`;
    const cls = t.status.replace("-", "");
    lines.push(`    ${t.id}["${label}"]:::${cls}`);
  }
  for (const d of deps) {
    const arrow = d.kind === "hard" ? "==>" : d.kind === "data" ? "==>" : "-.->";
    lines.push(`    ${d.from} ${arrow}|${d.kind}| ${d.to}`);
  }
  lines.push("    classDef pending fill:#eee,stroke:#999");
  lines.push("    classDef ready fill:#cfe,stroke:#090");
  lines.push("    classDef inprogress fill:#cdf,stroke:#06c");
  lines.push("    classDef blocked fill:#fcc,stroke:#c00");
  lines.push("    classDef inreview fill:#ffc,stroke:#a80");
  lines.push("    classDef complete fill:#ccc,stroke:#666,color:#666");
  lines.push("    classDef cancelled fill:#eee,stroke:#ccc,color:#999");
  lines.push("```");
  return lines.join("\n");
}

export function renderJSON(doc) {
  const fm = doc.frontmatter;
  const dag = computeDAG(fm.tasks ?? [], fm.dependencies ?? []);
  return JSON.stringify({
    id: fm.id,
    title: fm.title,
    tasks: fm.tasks ?? [],
    dependencies: fm.dependencies ?? [],
    computed: dag,
  }, null, 2);
}

// ── Bidirectional sync ─────────────────────────────────────────────────

/**
 * After writing `newDocPath` with its `upstream:` list, patch each upstream
 * doc's `downstream:` field to include `newDocPath`. Returns the list of
 * parent paths that were updated.
 */
export function syncBidirectional(repoRoot, newDocPath) {
  const absNew = path.resolve(repoRoot, newDocPath);
  const newDoc = readDoc(absNew);
  const upstreams = Array.isArray(newDoc.frontmatter.upstream) ? newDoc.frontmatter.upstream : [];
  const relNew = path.relative(repoRoot, absNew).split(path.sep).join("/");
  const patched = [];
  for (const upstream of upstreams) {
    const absUp = path.resolve(repoRoot, upstream);
    if (!fs.existsSync(absUp)) continue;
    const upDoc = readDoc(absUp);
    upDoc.frontmatter.downstream = Array.isArray(upDoc.frontmatter.downstream) ? upDoc.frontmatter.downstream : [];
    if (!upDoc.frontmatter.downstream.includes(relNew)) {
      upDoc.frontmatter.downstream = [...upDoc.frontmatter.downstream, relNew];
      upDoc.frontmatter.updated = new Date().toISOString().slice(0, 10);
      writeDoc(absUp, upDoc);
      patched.push(upstream);
    }
  }
  return patched;
}
