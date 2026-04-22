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
  const scratchOutput = path.join(tmpDir, "out.svg");

  try {
    execSync(`${MMDC} -i "${tmpFile}" -o "${scratchOutput}" -p "${puppeteerConfig}" --quiet`, {
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

function printUsage() {
  console.log([
    "Usage:",
    "  node mermaid-helper.mjs check",
    "  node mermaid-helper.mjs validate <mermaid content>",
    "",
    "Validation parses the diagram via mmdc. The rendered SVG is discarded.",
    "",
    "Example:",
    '  node mermaid-helper.mjs validate "graph TD; A-->B; B-->C"'
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

  printUsage();
  process.exit(1);
}

main();
