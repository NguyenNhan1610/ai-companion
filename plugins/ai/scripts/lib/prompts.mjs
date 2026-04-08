import fs from "node:fs";
import path from "node:path";

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
