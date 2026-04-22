#!/usr/bin/env node
/**
 * task-graph.mjs — render a TODO list's DAG.
 *
 * Usage:
 *   node task-graph.mjs [TODO-NN | --path <relative-path>] [--format ascii|mermaid|json]
 *                       [--critical-path] [--ready] [--cwd <path>]
 *
 * Defaults:
 *   - picks the newest todo-list in .claude/project/todo-lists/ if no id given
 *   - format: ascii
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";

import {
  readDoc,
  computeDAG,
  renderAscii,
  renderMermaid,
  renderJSON,
  validateDoc,
  TYPE_TO_DIR,
} from "./lib/planning-docs.mjs";

function parseArgs(argv) {
  const out = { format: "ascii", flags: new Set() };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--format") out.format = argv[++i];
    else if (a === "--critical-path") out.flags.add("critical-path");
    else if (a === "--ready") out.flags.add("ready");
    else if (a === "--path") out.path = argv[++i];
    else if (a === "--cwd") out.cwd = argv[++i];
    else if (a.startsWith("TODO-")) out.id = a;
    else if (!a.startsWith("--") && !out.id) out.id = a;
  }
  return out;
}

function resolveRepoRoot(cwd) {
  const base = cwd || process.cwd();
  const res = spawnSync("git", ["-C", base, "rev-parse", "--show-toplevel"], { encoding: "utf8" });
  return (res.status === 0 ? res.stdout.trim() : base) || base;
}

function findTodoPath(repoRoot, opts) {
  if (opts.path) return path.resolve(repoRoot, opts.path);
  const dir = path.resolve(repoRoot, TYPE_TO_DIR["todo-list"]);
  if (!fs.existsSync(dir)) {
    throw new Error(`no todo-lists directory found at ${dir}`);
  }
  return pickTodo(dir, opts.id);
}

function pickTodo(dir, id) {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"));
  if (!files.length) throw new Error(`no todo files found in ${dir}`);
  if (id) {
    const match = files.find((f) => f.startsWith(`${id}-`) || f.startsWith(`${id}.`));
    if (!match) throw new Error(`no todo file matching id ${id} in ${dir}`);
    return path.join(dir, match);
  }
  // Newest by mtime
  const stats = files.map((f) => ({ f, mtime: fs.statSync(path.join(dir, f)).mtimeMs }));
  stats.sort((a, b) => b.mtime - a.mtime);
  return path.join(dir, stats[0].f);
}

function renderCriticalPath(doc) {
  const fm = doc.frontmatter;
  const dag = computeDAG(fm.tasks ?? [], fm.dependencies ?? []);
  const taskById = new Map((fm.tasks ?? []).map((t) => [t.id, t]));
  const lines = [`${fm.id}: ${fm.title}`];
  lines.push(`Critical path (${dag.critical_path_points} pts):`);
  for (const id of dag.critical_path) {
    const t = taskById.get(id);
    lines.push(`  ${id} [${t.priority} ${t.effort} ${t.status}] ${t.title}`);
  }
  return lines.join("\n");
}

function renderReady(doc) {
  const fm = doc.frontmatter;
  const dag = computeDAG(fm.tasks ?? [], fm.dependencies ?? []);
  const taskById = new Map((fm.tasks ?? []).map((t) => [t.id, t]));
  const lines = [`${fm.id}: ${fm.title}`, `Ready tasks (${dag.ready.length}):`];
  for (const id of dag.ready) {
    const t = taskById.get(id);
    lines.push(`  ${id} [${t.priority} ${t.effort}] ${t.title}`);
  }
  if (!dag.ready.length) lines.push("  (none — all pending tasks have unmet hard/data dependencies)");
  return lines.join("\n");
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const repoRoot = resolveRepoRoot(opts.cwd);
  const todoPath = findTodoPath(repoRoot, opts);
  const doc = readDoc(todoPath);

  const validation = validateDoc(doc, repoRoot);
  if (!validation.ok) {
    process.stderr.write(`task-graph: validation errors in ${path.relative(repoRoot, todoPath)}\n`);
    for (const e of validation.errors) process.stderr.write(`  - ${e}\n`);
  }
  if (validation.warnings.length) {
    for (const w of validation.warnings) process.stderr.write(`  warn: ${w}\n`);
  }

  let output;
  if (opts.flags.has("critical-path")) output = renderCriticalPath(doc);
  else if (opts.flags.has("ready")) output = renderReady(doc);
  else if (opts.format === "mermaid") output = renderMermaid(doc);
  else if (opts.format === "json") output = renderJSON(doc);
  else output = renderAscii(doc);

  process.stdout.write(output + "\n");
}

main();
