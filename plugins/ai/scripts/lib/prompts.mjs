import fs from "node:fs";
import path from "node:path";

/**
 * Load project coding rules from .claude/rules/ matching the detected tech stack.
 * Returns formatted XML block or empty string if no rules found.
 */
export function loadProjectRules(cwd) {
  const rulesDir = path.join(cwd, ".claude", "rules");
  if (!fs.existsSync(rulesDir)) return "";

  // Detect tech stack from project root
  const stacks = [];
  const exists = (f) => fs.existsSync(path.join(cwd, f));

  // Check root and one level of subdirectories for tech stack indicators
  const existsAny = (patterns) => patterns.some(p => exists(p));
  const subdirs = [];
  try {
    for (const d of fs.readdirSync(cwd, { withFileTypes: true })) {
      if (d.isDirectory() && !d.name.startsWith(".") && d.name !== "node_modules") {
        subdirs.push(d.name);
      }
    }
  } catch { /* ignore */ }
  const existsDeep = (f) => exists(f) || subdirs.some(d => exists(path.join(d, f)));

  if (existsDeep("tsconfig.json") || existsDeep("tsconfig.app.json") || exists("package.json")) stacks.push("typescript");
  if (existsAny(["next.config.js", "next.config.mjs", "next.config.ts"]) || subdirs.some(d => existsAny([`${d}/next.config.js`, `${d}/next.config.mjs`, `${d}/next.config.ts`, `${d}/app/layout.tsx`]))) stacks.push("typescript/nextjs");
  if (existsAny(["pyproject.toml", "setup.py", "requirements.txt"])) stacks.push("python");
  if (exists("manage.py")) stacks.push("python/django");

  // Check for FastAPI in pyproject.toml or requirements
  try {
    const deps = exists("pyproject.toml")
      ? fs.readFileSync(path.join(cwd, "pyproject.toml"), "utf8")
      : exists("requirements.txt")
        ? fs.readFileSync(path.join(cwd, "requirements.txt"), "utf8")
        : "";
    if (/fastapi/i.test(deps)) stacks.push("python/fastapi");
  } catch { /* ignore read errors */ }

  if (stacks.length === 0) return "";

  // Map stacks to rule file prefixes
  const prefixes = new Set();
  for (const stack of stacks) {
    const parts = stack.split("/");
    prefixes.add(parts[0]); // e.g., "typescript" or "python"
    if (parts[1]) prefixes.add(`${parts[0]}/${parts[1]}`); // e.g., "typescript/nextjs"
  }

  // Collect matching rule files (prioritize: security > architecture > antipatterns > performance)
  const ruleContents = [];
  const priority = ["security", "architecture", "antipatterns", "performance"];
  const maxRules = 6;

  for (const prio of priority) {
    if (ruleContents.length >= maxRules) break;
    for (const prefix of prefixes) {
      if (ruleContents.length >= maxRules) break;
      const dir = path.join(rulesDir, prefix.split("/")[0]);
      if (!fs.existsSync(dir)) continue;
      try {
        for (const file of fs.readdirSync(dir)) {
          if (!file.endsWith(".md")) continue;
          if (!file.includes(prio)) continue;
          // For stack-specific rules (e.g., nextjs-security), match the prefix
          const stackPart = prefix.split("/")[1];
          if (stackPart && !file.startsWith(stackPart) && !file.startsWith(prefix.split("/")[0])) continue;
          if (ruleContents.length >= maxRules) break;
          const content = fs.readFileSync(path.join(dir, file), "utf8");
          // Strip frontmatter (paths: ...) before injecting
          const stripped = content.replace(/^---[\s\S]*?---\s*/m, "").trim();
          if (stripped) ruleContents.push(stripped);
        }
      } catch { /* ignore */ }
    }
  }

  if (ruleContents.length === 0) return "";

  return `<project_coding_rules>\nThe following coding rules are defined for this project. Use them to evaluate code quality and flag violations.\n\n${ruleContents.join("\n\n---\n\n")}\n</project_coding_rules>`;
}

export function loadPromptTemplate(rootDir, name) {
  const promptPath = path.join(rootDir, "prompts", `${name}.md`);
  return fs.readFileSync(promptPath, "utf8");
}

export function interpolateTemplate(template, variables) {
  return template.replace(/\{\{([A-Z_]+)\}\}/g, (_, key) => {
    return Object.prototype.hasOwnProperty.call(variables, key) ? variables[key] : "";
  });
}

export function resolveAspectTemplate(rootDir, { aspect, language, techstack }) {
  const promptsDir = path.join(rootDir, "prompts");
  const candidates = [];

  if (language && techstack) {
    candidates.push(path.join(promptsDir, language, `${techstack}-${aspect}.md`));
  }
  if (language) {
    candidates.push(path.join(promptsDir, language, `${aspect}.md`));
  }
  candidates.push(path.join(promptsDir, `${aspect}.md`));

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return fs.readFileSync(candidate, "utf8");
    }
  }

  const availableAspects = listAvailableAspects(promptsDir);
  throw new Error(
    `No review template found for aspect "${aspect}"` +
    (language ? ` with language "${language}"` : "") +
    (techstack ? ` and techstack "${techstack}"` : "") +
    `. Available: ${availableAspects.join(", ") || "none"}`
  );
}

export function loadCouncilPromptTemplate(rootDir, roleName) {
  const councilDir = path.join(rootDir, "prompts", "council");
  const rolePath = path.join(councilDir, `${roleName}.md`);
  if (fs.existsSync(rolePath)) {
    return fs.readFileSync(rolePath, "utf8");
  }
  const genericPath = path.join(councilDir, "generic.md");
  return fs.readFileSync(genericPath, "utf8");
}

function listAvailableAspects(promptsDir) {
  const aspects = new Set();
  try {
    for (const entry of fs.readdirSync(promptsDir, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith(".md")) {
        const name = entry.name.replace(/\.md$/, "");
        if (!["adversarial-review", "stop-review-gate"].includes(name)) {
          aspects.add(name);
        }
      }
      if (entry.isDirectory()) {
        const subdir = path.join(promptsDir, entry.name);
        for (const sub of fs.readdirSync(subdir)) {
          if (sub.endsWith(".md")) {
            const subName = sub.replace(/\.md$/, "");
            aspects.add(`${entry.name}:${subName}`);
            aspects.add(`${entry.name}/${subName}`);
          }
        }
      }
    }
  } catch { /* ignore read errors */ }
  return [...aspects].sort();
}
