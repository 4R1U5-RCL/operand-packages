# password-hygiene — Hard Constraints

> Domain CLAUDE.md. Canonical for this feature-package. Read it before touching
> `src/password.mjs`.

## What this package is

The FIXED server-side password acceptance check used at signup/reset: a
deterministic rules floor plus a HaveIBeenPwned k-anonymity breach lookup. One
module, no dependencies, Node 22 built-ins only (`node:crypto` for SHA-1).

## HARD constraints

- **K-anonymity — only the 5-char SHA-1 prefix ever leaves the box.** The password
  is SHA-1'd locally; exactly the first 5 hex chars go to the HIBP range API. The
  remaining 35-char suffix is matched LOCALLY against the returned range. The
  password and its full hash MUST NOT be transmitted, logged, or persisted. Sending
  the full hash (or the password) to any breach service is a boundary violation, not
  a build to retry.
- **Fail OPEN on breach-service failure.** If the HIBP lookup throws or is
  unreachable, treat the password as acceptable on the breach axis (`breached:false`)
  and decide on the rules alone. Never block signup on a third-party outage. A code
  path that rejects on lookup failure is a finding.
- **Rules floor is always enforced.** Length + character-class variety are
  deterministic and run with no network. Fail-open applies to the breach check only —
  never to the rules.
- **Validation only — never storage.** This package does not hash-for-storage, store,
  or log the password. Persisting/logging the plaintext or its hash here is a finding;
  storage hashing (argon2/bcrypt) belongs at the call site.
- **The breach lookup is injected.** `checkPasswordStrength(password, { fetchRange })`
  takes the range fetcher as a parameter so the seam is fully offline-testable. The
  default fetcher is the only place the live API URL appears.

## What the evaluator checks here

- Only the 5-char prefix is placed in the request URL; no full hash / password
  leaves the module.
- The breach lookup is wrapped so a throw yields `breached:false` (fail open), and
  the rules still gate `ok`.
- No persistence or logging of the password or its digest.
- `selftest.mjs` earns its pass offline: short/weak rejected, strong accepted,
  injected-breach flagged, fail-open proven.

## What stays human (back gate)

Policy thresholds. Whether `MIN_LENGTH`/`MIN_CLASSES` match a given client's stated
posture is a human call — the evaluator checks the mechanism (k-anonymity, fail-open,
no storage) is wired, not whether 8/3 is the right number for that brand.
