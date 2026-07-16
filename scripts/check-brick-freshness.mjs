#!/usr/bin/env node
// check-brick-freshness.mjs — the "no drift" gate (CI entrypoint).
//
// Re-runs the assembly into a throwaway temp dir and diffs the freshly-assembled
// mirror + lock against what is committed under bricks/*/components/ +
// bricks/*/.brick-lock.json. If anything differs — a component was edited under
// components/ without re-assembling its bricks, a manifest changed, a mirror was
// hand-edited, or a lock is stale/missing — it exits NON-ZERO and prints the exact
// stale/missing brick paths. Exit 0 iff every brick is byte-identical to what its
// manifest + the current components/ tree would produce.
//
// Plain Node ESM, no deps. Uses the same ignore policy as assemble-bricks.mjs
// (imported), so audit runtime artifacts never register as drift.

import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { assembleBrick, listBricks, readManifest } from './assemble-bricks.mjs';

const REPO_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const BRICKS_ROOT = join(REPO_ROOT, 'bricks');

function fileHash(abs) {
  return createHash('sha256').update(readFileSync(abs)).digest('hex');
}

// Map of relative-path -> content-hash for every file under `dir` (honours ignore
// via the walk in assemble; here we simply skip the two ignored classes inline).
function fileMap(dir) {
  const out = new Map();
  if (!existsSync(dir)) return out;
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop();
    for (const name of readdirSync(cur).sort()) {
      const abs = join(cur, name);
      const p = abs.replaceAll('\\', '/');
      if (/\/audit\/\.runtime(\/|$)/.test(p)) continue;
      if (/\/audit\/.*\.report\.json$/.test(p)) continue;
      if (/\/node_modules(\/|$)/.test(p)) continue;
      if (/\/\.DS_Store$/.test(p)) continue;
      const st = statSync(abs);
      if (st.isDirectory()) stack.push(abs);
      else if (st.isFile()) out.set(relative(dir, abs).replaceAll('\\', '/'), fileHash(abs));
    }
  }
  return out;
}

function diffMaps(expected, actual) {
  const problems = [];
  for (const [rel, h] of expected) {
    if (!actual.has(rel)) problems.push(`  MISSING   ${rel}`);
    else if (actual.get(rel) !== h) problems.push(`  STALE     ${rel}`);
  }
  for (const rel of actual.keys()) {
    if (!expected.has(rel)) problems.push(`  UNEXPECTED ${rel}`);
  }
  return problems;
}

function main() {
  const bricks = listBricks();
  if (bricks.length === 0) {
    console.log('[check-brick-freshness] no bricks found — nothing to check.');
    return 0;
  }

  const tmp = mkdtempSync(join(tmpdir(), 'brick-freshness-'));
  let failed = false;
  try {
    for (const brick of bricks) {
      const problems = [];

      // 1. Assemble a fresh copy into the temp dir.
      let fresh;
      try {
        fresh = assembleBrick(brick, tmp);
      } catch (err) {
        console.error(`\n[${brick}] ASSEMBLY ERROR: ${err.message}`);
        failed = true;
        continue;
      }

      // 2. Compare the freshly-assembled component mirror to the committed one.
      const committedMirror = join(BRICKS_ROOT, brick, 'components');
      const expected = fileMap(fresh.mirrorDir);
      const actual = fileMap(committedMirror);
      problems.push(...diffMaps(expected, actual));

      // 3. Compare the lock (hash-per-component) to what's committed.
      const committedLockPath = join(BRICKS_ROOT, brick, '.brick-lock.json');
      const freshLock = JSON.stringify(fresh.lock.components);
      if (!existsSync(committedLockPath)) {
        problems.push('  MISSING   .brick-lock.json');
      } else {
        const committed = JSON.parse(readFileSync(committedLockPath, 'utf8'));
        if (JSON.stringify(committed.components || {}) !== freshLock) {
          problems.push('  STALE     .brick-lock.json (hashes differ from current components/)');
        }
      }

      // 4. Sanity: every non-planned component path in the manifest must exist.
      const manifest = readManifest(brick);
      for (const rel of manifest.components || []) {
        if (!existsSync(join(REPO_ROOT, 'components', rel))) {
          problems.push(`  MISSING-SOURCE components/${rel} (referenced by manifest)`);
        }
      }

      if (problems.length) {
        failed = true;
        console.error(`\n[${brick}] DRIFT (bricks/${brick}/ is stale — run: node scripts/assemble-bricks.mjs):`);
        for (const p of problems) console.error(p);
      } else {
        console.log(`[${brick}] fresh ✓`);
      }
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }

  if (failed) {
    console.error(
      '\n[check-brick-freshness] FAIL — brick folders are out of sync with components/.',
    );
    console.error('Fix: `node scripts/assemble-bricks.mjs` then commit the updated bricks/.');
    return 1;
  }
  console.log('\n[check-brick-freshness] OK — every brick folder is in sync.');
  return 0;
}

process.exit(main());
