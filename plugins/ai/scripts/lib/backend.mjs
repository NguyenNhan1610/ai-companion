/**
 * Backend abstraction layer for AI companion.
 *
 * Each backend must implement the interface described
 * by the `createBackendInterface` documentation below.  The registry provides
 * a central place to look up a backend by name.
 */

/**
 * @typedef {{
 *   name: string,
 *   displayName: string,
 *   commandPrefix: string,
 *   getAvailability: (cwd: string) => { available: boolean, detail: string },
 *   getLoginStatus: (cwd: string) => { available: boolean, loggedIn: boolean, detail: string },
 *   getSessionRuntimeStatus: (env?: Record<string, string>, cwd?: string) => { mode: string, label: string, detail: string, endpoint: string | null },
 *   runReview: (cwd: string, options: object) => Promise<object>,
 *   runTurn: (cwd: string, options: object) => Promise<object>,
 *   interruptTurn: (cwd: string, options: { threadId: string | null, turnId: string | null }) => Promise<object>,
 *   findLatestTaskThread: (cwd: string) => Promise<{ id: string } | null>,
 *   ensureReady: (cwd: string) => void,
 *   parseStructuredOutput: (rawOutput: string, fallback: object) => object,
 *   readOutputSchema: (schemaPath: string) => object | null,
 *   buildPersistentTaskThreadName: (prompt: string) => string | null,
 *   DEFAULT_CONTINUE_PROMPT: string
 * }} Backend
 */

/** @type {Map<string, Backend>} */
const BACKENDS = new Map();

/**
 * Register a backend implementation.
 * @param {Backend} backend
 */
export function registerBackend(backend) {
  BACKENDS.set(backend.name, backend);
}

/**
 * Look up a backend by name.
 * @param {string} name
 * @returns {Backend}
 */
export function getBackend(name) {
  const backend = BACKENDS.get(name);
  if (!backend) {
    const available = [...BACKENDS.keys()].join(", ") || "none";
    throw new Error(`Unknown backend: "${name}". Available backends: ${available}.`);
  }
  return backend;
}

/**
 * List all registered backend names.
 * @returns {string[]}
 */
export function listBackends() {
  return [...BACKENDS.keys()];
}
