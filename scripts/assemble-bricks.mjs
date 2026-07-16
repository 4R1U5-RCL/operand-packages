#!/usr/bin/env node
// assemble-bricks.mjs — materialise each brick's self-contained component mirror.
//
// The manifest (bricks/<brick>/brick.json) is the SOURCE OF TRUTH for what belongs
// in a brick. This script reads every manifest and, for each listed component path,
// copies it from the top-level components/ tree into bricks/<brick>/components/<path>
// (recursive for directories). It then writes bricks/<brick>/.brick-lock.json — a
// content hash per copied path — so drift can be detected without re-copying.
//
// Idempotent: re-running produces byte-identical output. Plain Node ESM, no deps.
//
// Ignore policy (mirrors .gitignore, B-7 in the plan): audit runtime artifacts are
// generated, never versioned — .runtime/ dirs and *.report.json files are skipped so
// they never get vendored into a brick mirror.
//
// `planned[]` entries are NOT materialised — they name components that don't exist in
// the repo yet (e.g. the seo_improver brick's unbuilt workflow/schema artifacts).

import { createHash } from 'node:crypto';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const COMPONENTS_ROOT = join(REPO_ROOT, 'components');
const BRICKS_ROOT = join(REPO_ROOT, 'bricks');

// --- ignore policy ---------------------------------------------------------
function isIgnored(absPath) {
  const p = absPath.replaceAll('\\', '/');
  if (/\/audit\/\.runtime(\/|$)/.test(p)) return true;
  if (/\/audit\/.*\.report\.json$/.test(p)) return true;
  if (/\/node_modules(\/|$)/.test(p)) return true;
  if (/\/\.DS_Store$/.test(p)) return true;
  return false;
}

// --- recursive content hash ------------------------------------------------
// Directory hash = hash of (relative-path, file-hash) pairs, sorted, so it is
// stable regardless of readdir order and sensitive to renames/deletions.
function hashPath(absPath) {
  const st = statSync(absPath);
  if (st.isFile()) {
    return createHash('sha256').update(readFileSync(absPath)).digest('hex');
  }
  const entries = [];
  walk(absPath, absPath, entries);
  entries.sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0));
  const h = createHash('sha256');
  for (const e of entries) h.update(`${e.rel}\0${e.hash}\0`);
  return h.digest('hex');
}

function walk(baseDir, dir, out) {
  for (const name of readdirSync(dir).sort()) {
    const abs = join(dir, name);
    if (isIgnored(abs)) continue;
    const st = statSync(abs);
    if (st.isDirectory()) {
      walk(baseDir, abs, out);
    } else if (st.isFile()) {
      out.push({
        rel: relative(baseDir, abs).replaceAll('\\', '/'),
        hash: createHash('sha256').update(readFileSync(abs)).digest('hex'),
      });
    }
  }
}

// --- copy honouring the ignore policy --------------------------------------
function copyComponent(srcAbs, destAbs) {
  mkdirSync(dirname(destAbs), { recursive: true });
  cpSync(srcAbs, destAbs, {
    recursive: true,
    filter: (src) => !isIgnored(src),
  });
}

// --- main ------------------------------------------------------------------
export function listBricks() {
  if (!existsSync(BRICKS_ROOT)) return [];
  return readdirSync(BRICKS_ROOT)
    .filter((n) => existsSync(join(BRICKS_ROOT, n, 'brick.json')))
    .sort();
}

export function readManifest(brick) {
  const raw = readFileSync(join(BRICKS_ROOT, brick, 'brick.json'), 'utf8');
  return JSON.parse(raw);
}

// Assemble one brick into `destBricksRoot` (defaults to the real bricks/ tree).
// Returns { lock } — the lock object that was (or would be) written.
export function assembleBrick(brick, destBricksRoot = BRICKS_ROOT) {
  const manifest = readManifest(brick);
  const components = Array.isArray(manifest.components) ? manifest.components : [];
  const brickDir = join(destBricksRoot, brick);
  const mirrorDir = join(brickDir, 'components');

  // Rebuild the mirror from scratch so deletions in a manifest propagate.
  rmSync(mirrorDir, { recursive: true, force: true });

  const lock = { brick, generatedBy: 'scripts/assemble-bricks.mjs', components: {} };
  for (const rel of components) {
    const srcAbs = join(COMPONENTS_ROOT, rel);
    if (!existsSync(srcAbs)) {
      throw new Error(
        `[assemble-bricks] ${brick}: component path does not exist under components/: ${rel}`,
      );
    }
    const destAbs = join(mirrorDir, rel);
    copyComponent(srcAbs, destAbs);
    lock.components[rel] = hashPath(srcAbs);
  }

  return { lock, mirrorDir, brickDir };
}

function main() {
  const bricks = listBricks();
  if (bricks.length === 0) {
    console.log('[assemble-bricks] no bricks found under bricks/');
    return;
  }
  for (const brick of bricks) {
    const { lock, brickDir } = assembleBrick(brick);
    const lockPath = join(brickDir, '.brick-lock.json');
    writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n');
    const n = Object.keys(lock.components).length;
    const manifest = readManifest(brick);
    const planned = Array.isArray(manifest.planned) ? manifest.planned.length : 0;
    console.log(
      `[assemble-bricks] ${brick}: ${n} component(s) materialised` +
        (planned ? `, ${planned} planned (not materialised)` : ''),
    );
  }
  console.log(`[assemble-bricks] done — ${bricks.length} brick(s).`);
}

// Run only when invoked directly (not when imported by the freshness checker).
if (resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
