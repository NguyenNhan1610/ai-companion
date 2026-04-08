#!/usr/bin/env node

import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const MMDC = "mmdc";

function createTempFile(content) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mermaid-"));
  const tmpFile = path.join(tmpDir, "diagram.mmd");
  fs.writeFileSync(tmpFile, content, "utf8");
  // Puppeteer config for headless rendering (needed for root/CI environments)
  const puppeteerConfig = path.join(tmpDir, "puppeteer-config.json");
  fs.writeFileSync(puppeteerConfig, JSON.stringify({
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  }), "utf8");
  return { tmpDir, tmpFile, puppeteerConfig };
}

function cleanup(tmpDir) {
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
}

function checkMmdc() {
  try {
    const version = execSync(`${MMDC} --version`, { encoding: "utf8", timeout: 10000 }).trim();
    return { available: true, version };
  } catch {
    return { available: false, version: null };
  }
}

function validate(content) {
  const mmdc = checkMmdc();
  if (!mmdc.available) {
    console.log(JSON.stringify({ valid: false, errors: ["mmdc not installed. Run /ai:setup --install-mermaid"] }));
    process.exit(1);
  }

  const { tmpDir, tmpFile, puppeteerConfig } = createTempFile(content);
  const nullOutput = path.join(tmpDir, "out.svg");

  try {
    execSync(`${MMDC} -i "${tmpFile}" -o "${nullOutput}" -p "${puppeteerConfig}" --quiet`, {
      encoding: "utf8",
      timeout: 30000,
      stdio: ["pipe", "pipe", "pipe"]
    });
    console.log(JSON.stringify({ valid: true, errors: [] }));
  } catch (err) {
    const stderr = err.stderr?.toString() || err.message || "Unknown error";
    const errors = stderr.split("\n").filter(Boolean).map((line) => line.trim());
    console.log(JSON.stringify({ valid: false, errors }));
    process.exit(1);
  } finally {
    cleanup(tmpDir);
  }
}

function render(content, options = {}) {
  const mmdc = checkMmdc();
  if (!mmdc.available) {
    console.log(JSON.stringify({ success: false, error: "mmdc not installed. Run /ai:setup --install-mermaid" }));
    process.exit(1);
  }

  const format = options.format || "svg";
  const cwd = process.cwd();
  const outputPath = options.output
    ? path.resolve(cwd, options.output)
    : path.resolve(cwd, `diagram.${format}`);

  const outputDir = path.dirname(outputPath);
  fs.mkdirSync(outputDir, { recursive: true });

  const { tmpDir, tmpFile, puppeteerConfig } = createTempFile(content);

  try {
    execSync(`${MMDC} -i "${tmpFile}" -o "${outputPath}" -p "${puppeteerConfig}" --quiet`, {
      encoding: "utf8",
      timeout: 60000,
      stdio: ["pipe", "pipe", "pipe"]
    });
    console.log(JSON.stringify({
      success: true,
      output: outputPath,
      format,
      size: fs.statSync(outputPath).size
    }));
  } catch (err) {
    const stderr = err.stderr?.toString() || err.message || "Unknown error";
    console.log(JSON.stringify({ success: false, error: stderr.trim() }));
    process.exit(1);
  } finally {
    cleanup(tmpDir);
  }
}

function printUsage() {
  console.log([
    "Usage:",
    "  node mermaid-helper.mjs check",
    "  node mermaid-helper.mjs validate <mermaid content>",
    "  node mermaid-helper.mjs render [--format svg|png] [-o output] <mermaid content>",
    "",
    "Examples:",
    '  node mermaid-helper.mjs validate "graph TD; A-->B; B-->C"',
    '  node mermaid-helper.mjs render "graph TD; A-->B; B-->C"',
    '  node mermaid-helper.mjs render --format png -o docs/arch.png "graph TD; A-->B"'
  ].join("\n"));
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) { printUsage(); process.exit(0); }

  const subcommand = args[0];

  if (subcommand === "check") {
    const result = checkMmdc();
    console.log(JSON.stringify(result));
    process.exit(result.available ? 0 : 1);
  }

  if (subcommand === "validate") {
    const content = args.slice(1).join(" ");
    if (!content.trim()) { console.log(JSON.stringify({ valid: false, errors: ["No content provided"] })); process.exit(1); }
    validate(content);
    process.exit(0);
  }

  if (subcommand === "render") {
    const remaining = args.slice(1);
    let format = "svg";
    let output = null;
    const contentParts = [];

    for (let i = 0; i < remaining.length; i++) {
      if (remaining[i] === "--format" && i + 1 < remaining.length) {
        format = remaining[++i];
      } else if (remaining[i] === "-o" && i + 1 < remaining.length) {
        output = remaining[++i];
      } else {
        contentParts.push(remaining[i]);
      }
    }

    const content = contentParts.join(" ");
    if (!content.trim()) { console.log(JSON.stringify({ success: false, error: "No content provided" })); process.exit(1); }
    render(content, { format, output });
    process.exit(0);
  }

  printUsage();
  process.exit(1);
}

main();
