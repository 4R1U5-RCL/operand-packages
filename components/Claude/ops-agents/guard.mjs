// Claude/ops-agents/guard.mjs — the guarded-write SAFETY GUARD (standalone port).
//
// This is the load-bearing safety primitive the ops-agent rests on. It is a
// dependency-free port of studio's `@studio/agent-kit/guard` (guard.ts) into the
// packages repo's Node-built-ins-only .mjs convention, so nightly-sweep runs
// standalone here WITHOUT resolving any `@studio/*` workspace package.
//
// `assertNoGuardedWrites(fn, opts)` runs `fn` with a spy installed over
// `globalThis.fetch` AND over `node:child_process` execFile/exec (+ their sync
// variants), which RECORDS and BLOCKS any GUARDED WRITE attempted from inside
// `fn` — the write NEVER reaches the network or a child process. It returns the
// recorded attempts so a caller (the agent's own --selftest) can PROVE the agent
// performed zero guarded writes on its dry-run path.
//
// The guarded set (memory: feedback_main-session-executes-guarded-infra):
//   • an n8n control-plane PUT/POST/DELETE (a mutating verb to a non-webhook target),
//   • a prod DDL / Supabase Management-API /database/query write,
//   • a `vercel deploy`,
//   • a secret write (a `.env*` write via a shell redirect),
//   • a `gh … merge` / `git push`.
//
// Two honesty rules:
//   1. READS PASS THROUGH. A GET/HEAD fetch, or a read-only `gh`/`git` command, is
//      delegated to the real implementation untouched — dry-run gathers freely.
//   2. THREE WRITE CLASSES ARE SANCTIONED (not guarded): (a) a POST to an n8n
//      WEBHOOK (…/webhook/… — the notify seam, spec C1); (b) OPS BOOKKEEPING — a
//      PostgREST data write to exactly /rest/v1/(tmpl_)?ops_task_queue|
//      device_heartbeats (the queue-runner's own claim/status/heartbeat rows,
//      studio-owned service-role-only ops state); (c) an LLM INFERENCE POST to the
//      operator-configured LiteLLM proxy (LITELLM_PRIMARY_URL/FALLBACK_URL — an
//      inference read that mutates no infra). Any other mutating verb is guarded.
//
// `deferGuardedWrite(action)` is the sanctioned way for the agent to REPRESENT a
// guarded write it defers: it performs NO I/O — it returns a plan descriptor the
// agent puts in its report, to be handed to the main session behind `--apply`.

import { createRequire } from "node:module";
import util from "node:util";

/** The error the spy raises to BLOCK a guarded write. Tagged so
 *  assertNoGuardedWrites recognises its own block and does not mistake it for a
 *  genuine agent crash. */
export class GuardedWriteBlockedError extends Error {
  constructor(attempt) {
    super(`guarded write BLOCKED (${attempt.channel}): ${attempt.reason} — ${attempt.target}`);
    this.name = "GuardedWriteBlockedError";
    this.__guardedWriteBlocked = true;
    this.attempt = attempt;
  }
}

function isBlockError(err) {
  return !!err && typeof err === "object" && err.__guardedWriteBlocked === true;
}

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Ops-bookkeeping tables: the SECOND sanctioned non-guarded write channel (beside
 * the notify webhook). The queue-runner's own state — claim/status/attempts rows
 * on the ops task queue and its device_heartbeats liveness row — is STUDIO-OWNED
 * ops data behind a service-role-only RLS wall, not client/prod infra. A PostgREST
 * data write to exactly these tables is bookkeeping, not a guarded write.
 * Deliberately a fixed allow-list (never a prefix or pattern the URL author
 * controls); the Management-API /database/query path (prod DDL) does NOT match
 * /rest/v1/ and stays guarded.
 */
const OPS_BOOKKEEPING_REST_RE = /\/rest\/v1\/(?:tmpl_)?(?:ops_task_queue|device_heartbeats)(?:[?/]|$)/;

/**
 * LLM inference: the THIRD sanctioned non-guarded channel. A chat-completion POST
 * to the studio's LiteLLM proxy is an inference READ (align's cross-model gate,
 * the /validate chain) — it mutates no infrastructure. Resolved from
 * LITELLM_PRIMARY_URL/FALLBACK_URL by ENV REFERENCE at classification time — never
 * a caller-supplied pattern — so only the proxy the operator configured is exempt;
 * any other host's mutating verb stays guarded. Discovered the hard way: the
 * runtime guard wrap blocked align's 8 gate POSTs on the first automatic run
 * (2026-07-03 00:07) and correctly failed the row.
 */
function isLlmInferenceUrl(u) {
  for (const name of ["LITELLM_PRIMARY_URL", "LITELLM_FALLBACK_URL"]) {
    const base = process.env[name];
    if (base && u.startsWith(base.toLowerCase().replace(/\/$/, "") + "/")) return true;
  }
  return false;
}

/**
 * Default fetch classifier: a MUTATING HTTP verb (POST/PUT/PATCH/DELETE) is a
 * guarded write UNLESS it targets an n8n WEBHOOK (…/webhook/… — the sanctioned
 * notify channel), an OPS-BOOKKEEPING table (…/rest/v1/ops_task_queue|
 * device_heartbeats — the queue-runner's studio-owned state rows), or the
 * operator-configured LLM INFERENCE proxy (LITELLM_* env — inference is a read).
 * A GET/HEAD/OPTIONS read is never guarded.
 */
export function defaultIsGuardedFetch(info) {
  if (!WRITE_METHODS.has(String(info.method).toUpperCase())) return false;
  const u = String(info.url).toLowerCase();
  if (u.includes("/webhook/") || u.includes("/webhook-test/")) return false;
  if (OPS_BOOKKEEPING_REST_RE.test(u)) return false;
  if (isLlmInferenceUrl(u)) return false;
  return true;
}

/** Guarded-command fingerprints — the exec side of the guarded set. */
const GUARDED_EXEC_PATTERNS = [
  /\bgit\b[^\n]*\bpush\b/,                          // git push (foreign-repo write)
  /\bgh\b[^\n]*\bmerge\b/,                          // gh pr merge / gh … merge
  /\bvercel\b[^\n]*\bdeploy\b/,                     // vercel deploy (prod ship)
  /\bvercel\b[^\n]*--prod\b/,                       // vercel --prod
  /\bsupabase\b[^\n]*\b(db\s+push|migration|link)\b/, // supabase db push / migration
  /(^|\s)>{1,2}\s*[^\n]*\.env/,                     // shell redirect writing a .env* file
];

/** Default exec classifier: true iff the command matches a guarded fingerprint. */
export function defaultIsGuardedExec(command) {
  const c = String(command).toLowerCase();
  return GUARDED_EXEC_PATTERNS.some((re) => re.test(c));
}

/** Extract { method, url } from the arguments passed to global fetch. */
function readFetchInfo(input, init) {
  let url = "";
  let method = "GET";
  if (typeof input === "string") url = input;
  else if (input instanceof URL) url = input.href;
  else if (input && typeof input === "object") {
    if (typeof input.url === "string") url = input.url;
    if (typeof input.method === "string") method = input.method;
  }
  const initMethod = init && init.method;
  if (typeof initMethod === "string") method = initMethod;
  return { method, url };
}

/** Build a single command-line string from an execFile/exec call. */
function commandLine(file, maybeArgs) {
  const cmd = typeof file === "string" ? file : String(file);
  const args = Array.isArray(maybeArgs) ? maybeArgs.map((a) => String(a)) : [];
  return [cmd, ...args].join(" ").trim();
}

/**
 * Run `fn` with the guarded-write spies installed. RECORDS and BLOCKS every
 * guarded write it attempts (the real fetch/child-process is never reached for a
 * guarded write); reads pass through untouched. Always restores the originals.
 * NEVER performs the guarded action.
 *
 * @returns {Promise<{result?:any, violations:Array, crashed?:Error}>}
 */
export async function assertNoGuardedWrites(fn, opts = {}) {
  const isGuardedFetch = opts.isGuardedFetch ?? defaultIsGuardedFetch;
  const isGuardedExec = opts.isGuardedExec ?? defaultIsGuardedExec;
  const violations = [];

  const record = (attempt) => {
    violations.push(attempt);
    return new GuardedWriteBlockedError(attempt);
  };

  // --- install the fetch spy -------------------------------------------------
  const realFetch = globalThis.fetch;
  const fetchSpy = (input, init) => {
    const info = readFetchInfo(input, init);
    if (isGuardedFetch(info)) {
      // BLOCK: reject WITHOUT ever calling the real fetch — the write never leaves.
      return Promise.reject(
        record({ channel: "fetch", method: info.method.toUpperCase(), target: info.url, reason: "mutating HTTP verb to guarded target" }),
      );
    }
    return realFetch(input, init);
  };

  // --- install the child_process spies ---------------------------------------
  const require = createRequire(import.meta.url);
  const cp = require("node:child_process");
  const realExecFile = cp.execFile;
  const realExec = cp.exec;
  const realExecFileSync = cp.execFileSync;
  const realExecSync = cp.execSync;

  const cmdFor = (argsAreList, callArgs) =>
    argsAreList ? commandLine(callArgs[0], callArgs[1]) : commandLine(callArgs[0], undefined);

  // Async (callback / promisify) spy: record + reject; never spawn. The PROMISIFY
  // form is attached as util.promisify.custom so a delegated (non-guarded) read
  // still resolves with the real { stdout, stderr } shape.
  const asyncSpy = (real, argsAreList) => {
    const spyFn = (...callArgs) => {
      const command = cmdFor(argsAreList, callArgs);
      if (isGuardedExec(command)) {
        const err = record({ channel: "exec", target: command, reason: "guarded command" });
        const cb = callArgs[callArgs.length - 1];
        if (typeof cb === "function") {
          queueMicrotask(() => cb(err));
          return { on() {}, kill() {} }; // minimal inert ChildProcess-ish handle
        }
        throw err;
      }
      return real(...callArgs);
    };
    spyFn[util.promisify.custom] = (...callArgs) => {
      const command = cmdFor(argsAreList, callArgs);
      if (isGuardedExec(command)) {
        return Promise.reject(record({ channel: "exec", target: command, reason: "guarded command" }));
      }
      return util.promisify(real)(...callArgs);
    };
    return spyFn;
  };

  // Sync spy: record + throw; never spawn.
  const syncSpy = (real, argsAreList) => (...callArgs) => {
    const command = argsAreList ? commandLine(callArgs[0], callArgs[1]) : commandLine(callArgs[0], undefined);
    if (isGuardedExec(command)) throw record({ channel: "exec", target: command, reason: "guarded command" });
    return real(...callArgs);
  };

  globalThis.fetch = fetchSpy;
  cp.execFile = asyncSpy(realExecFile, true);
  cp.exec = asyncSpy(realExec, false);
  cp.execFileSync = syncSpy(realExecFileSync, true);
  cp.execSync = syncSpy(realExecSync, false);

  try {
    const result = await fn();
    return { result, violations };
  } catch (err) {
    // Our own block error means a guarded write was already RECORDED — swallow it
    // (the violation is the signal). Anything else is a genuine agent crash.
    if (isBlockError(err)) return { violations };
    return { violations, crashed: err instanceof Error ? err : new Error(String(err)) };
  } finally {
    globalThis.fetch = realFetch;
    cp.execFile = realExecFile;
    cp.exec = realExec;
    cp.execFileSync = realExecFileSync;
    cp.execSync = realExecSync;
  }
}

/**
 * The sanctioned way to REPRESENT a guarded write deferred to the main session.
 * Performs NO I/O — returns a descriptor the agent puts in its report, handed to
 * the main session behind `--apply`. Using this (instead of calling
 * fetch/execFile directly) is exactly what keeps the agent on the right side of
 * the guarded boundary on its dry-run path.
 */
export function deferGuardedWrite(action) {
  return { deferred: true, kind: action.kind, target: action.target, summary: action.summary };
}
