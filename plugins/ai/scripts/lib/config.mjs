import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CONFIG_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../config");
const DEFAULTS_FILE = path.join(CONFIG_DIR, "defaults.json");

let cachedConfig = null;

export function loadPluginConfig() {
  if (cachedConfig) {
    return cachedConfig;
  }

  const raw = fs.readFileSync(DEFAULTS_FILE, "utf8");
  cachedConfig = JSON.parse(raw);
  return cachedConfig;
}

/**
 * Parse a `--model` value with optional `provider:model` format.
 *
 * Examples:
 *   "codex:gpt-5.4"     → { provider: "codex",  model: "gpt-5.4" }
 *   "gpt-5.4"            → { provider: <default>, model: "gpt-5.4" }
 *   "spark"              → { provider: <default>, model: <resolved alias> }
 *   null/undefined        → { provider: <default>, model: null }
 */
export function resolveProviderAndModel(rawModel, config) {
  if (!rawModel || !String(rawModel).trim()) {
    const dp = config.defaultProvider;
    return {
      provider: dp,
      model: config.providers?.[dp]?.defaultModel ?? null,
      defaultEffort: config.providers?.[dp]?.defaultEffort ?? null
    };
  }

  const normalized = String(rawModel).trim();
  const colonIndex = normalized.indexOf(":");
  let provider;
  let model;

  if (colonIndex > 0) {
    provider = normalized.slice(0, colonIndex);
    model = normalized.slice(colonIndex + 1);
  } else if (config.providers?.[normalized]) {
    // Bare provider name (e.g., "--model codex") selects the provider with its default model
    provider = normalized;
    model = config.providers[normalized]?.defaultModel ?? null;
  } else {
    provider = config.defaultProvider;
    model = normalized;
  }

  // Resolve aliases for the selected provider
  const providerConfig = config.providers?.[provider];
  if (providerConfig?.aliases?.[model]) {
    model = providerConfig.aliases[model];
  }

  return {
    provider,
    model: model || null,
    defaultEffort: providerConfig?.defaultEffort ?? null
  };
}
