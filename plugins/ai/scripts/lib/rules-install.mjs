/**
 * rules-install.mjs — install coding rules into one or more engine-specific
 * conventions (Claude Code, Windsurf, Codex/AGENTS, GitHub Copilot).
 */

import fs from "node:fs";
import path from "node:path";

export const RULES_MAPPING = Object.freeze({
  python:     { dir: "python",     files: ["python-security", "python-performance", "python-antipatterns", "python-architecture"] },
  fastapi:    { dir: "python",     files: ["fastapi-security", "fastapi-performance", "fastapi-antipatterns", "python-security", "python-performance", "python-antipatterns", "python-architecture"] },
  django:     { dir: "python",     files: ["django-security", "django-performance", "python-security", "python-performance", "python-antipatterns", "python-architecture"] },
  typescript: { dir: "typescript", files: ["typescript-security", "typescript-performance", "typescript-antipatterns", "typescript-architecture"] },
  nextjs:     { dir: "typescript", files: ["nextjs-security", "nextjs-performance", "nextjs-architecture", "nextjs-antipatterns", "typescript-security", "typescript-performance", "typescript-antipatterns", "typescript-architecture"] },
});

export const VALID_ENGINES = Object.freeze(["claude", "windsurf", "codex", "copilot"]);

const BEGIN_MARKER = "<!-- BEGIN ai-companion-rules -->";
const END_MARKER = "<!-- END ai-companion-rules -->";

function resolveRuleFiles(specifiers) {
  const seen = new Set();
  const resolved = []; // [{ dir, name }]
  const unknown = [];
  for (const spec of specifiers) {
    const parts = String(spec).toLowerCase().split(/[:/]/);
    const key = parts.length > 1 ? parts[1] : parts[0];
    const mapping = RULES_MAPPING[key];
    if (!mapping) { unknown.push(spec); continue; }
    for (const name of mapping.files) {
      const id = `${mapping.dir}/${name}`;
      if (seen.has(id)) continue;
      seen.add(id);
      resolved.push({ dir: mapping.dir, name });
    }
  }
  return { resolved, unknown };
}

function readTemplate(templateDir, dir, name) {
  const src = path.join(templateDir, dir, `${name}.md`);
  if (!fs.existsSync(src)) return null;
  return fs.readFileSync(src, "utf8");
}

// ── Per-engine installers ───────────────────────────────────────────────

function installClaude(cwd, templateDir, files) {
  const installed = [], skipped = [];
  const targetBase = path.join(cwd, ".claude", "rules");
  for (const { dir, name } of files) {
    const targetDir = path.join(targetBase, dir);
    fs.mkdirSync(targetDir, { recursive: true });
    const dst = path.join(targetDir, `${name}.md`);
    if (fs.existsSync(dst)) { skipped.push(`claude: ${dir}/${name}.md (exists)`); continue; }
    const src = path.join(templateDir, dir, `${name}.md`);
    if (!fs.existsSync(src)) { skipped.push(`claude: ${dir}/${name}.md (template missing)`); continue; }
    fs.copyFileSync(src, dst);
    installed.push(`.claude/rules/${dir}/${name}.md`);
  }
  return { installed, skipped };
}

function installWindsurf(cwd, templateDir, files) {
  const installed = [], skipped = [];
  const targetDir = path.join(cwd, ".windsurf", "rules");
  fs.mkdirSync(targetDir, { recursive: true });
  for (const { dir, name } of files) {
    const dst = path.join(targetDir, `${name}.md`);
    if (fs.existsSync(dst)) { skipped.push(`windsurf: ${name}.md (exists)`); continue; }
    const content = readTemplate(templateDir, dir, name);
    if (content == null) { skipped.push(`windsurf: ${name}.md (template missing)`); continue; }
    fs.writeFileSync(dst, content, "utf8");
    installed.push(`.windsurf/rules/${name}.md`);
  }
  return { installed, skipped };
}

function installMonolithic({ cwd, templateDir, files, targetPath, header }) {
  const installed = [], skipped = [];
  const abs = path.join(cwd, targetPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });

  const block = [BEGIN_MARKER, header, ""];
  let any = false;
  for (const { dir, name } of files) {
    const content = readTemplate(templateDir, dir, name);
    if (content == null) { skipped.push(`${targetPath}: ${dir}/${name} (template missing)`); continue; }
    block.push(`<!-- From ai-companion: ${dir}/${name}.md -->`);
    block.push(content.trim());
    block.push("");
    any = true;
  }
  block.push(END_MARKER);
  const blockText = block.join("\n") + "\n";

  const existing = fs.existsSync(abs) ? fs.readFileSync(abs, "utf8") : "";
  let next;
  const re = new RegExp(`${BEGIN_MARKER.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}[\\s\\S]*?${END_MARKER.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}\\n?`);
  if (re.test(existing)) {
    next = existing.replace(re, blockText);
  } else if (existing.trim()) {
    next = existing.trimEnd() + "\n\n" + blockText;
  } else {
    next = blockText;
  }
  fs.writeFileSync(abs, next, "utf8");
  if (any) installed.push(targetPath);
  return { installed, skipped };
}

function installCodex(cwd, templateDir, files) {
  return installMonolithic({
    cwd, templateDir, files,
    targetPath: "AGENTS.md",
    header: "# AI Companion coding rules\n\nThese rules are appended by `/ai:setup --install-rules`. The block between the markers is overwritten on re-install; content outside the markers is preserved.",
  });
}

function installCopilot(cwd, templateDir, files) {
  return installMonolithic({
    cwd, templateDir, files,
    targetPath: path.join(".github", "copilot-instructions.md"),
    header: "# Project coding rules\n\nRules contributed by ai-companion. The marked block is overwritten on re-install.",
  });
}

// ── Public entry point ──────────────────────────────────────────────────

/**
 * @param {string} cwd
 * @param {string[]} specifiers   e.g. ["fastapi", "nextjs"]
 * @param {string[]} engines      subset of VALID_ENGINES, or ["all"]
 * @param {string} templateDir    absolute path to plugins/ai/rules-templates
 */
export function installRulesForEngines(cwd, specifiers, engines, templateDir) {
  const targets = (engines.length === 1 && engines[0] === "all") ? [...VALID_ENGINES] : engines;
  for (const e of targets) {
    if (!VALID_ENGINES.includes(e)) {
      throw new Error(`Unknown engine '${e}'. Valid: ${VALID_ENGINES.join(", ")} (or 'all').`);
    }
  }

  const { resolved, unknown } = resolveRuleFiles(specifiers);
  const installed = [];
  const skipped = unknown.map((u) => `Unknown specifier: "${u}" (available: ${Object.keys(RULES_MAPPING).join(", ")})`);

  if (!resolved.length) return { installed, skipped, engines: targets };

  const writers = { claude: installClaude, windsurf: installWindsurf, codex: installCodex, copilot: installCopilot };
  for (const engine of targets) {
    const res = writers[engine](cwd, templateDir, resolved);
    installed.push(...res.installed);
    skipped.push(...res.skipped);
  }
  return { installed, skipped, engines: targets };
}
