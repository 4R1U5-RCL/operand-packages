# password-hygiene — server-side password strength + breach check

A self-contained, reusable feature-package: one server-side function that decides
whether a password is acceptable at signup or reset. It enforces a deterministic
**rules floor** (minimum length + character-class variety) and runs a
**HaveIBeenPwned k-anonymity breach check** where only the first 5 chars of the
SHA-1 hash ever leave the box. It is the deliverable; the breach corpus is what it
*checks against*.

> Pull it in at a pinned version — never copy-fork it into a client repo. Zero
> config, no secrets: the only network call is to the public HIBP range API, and
> it **fails open** if that's unreachable.

```
password-hygiene/
├── src/password.mjs              the seam: rules + sha1Prefix() + checkPasswordStrength()
├── reference/usage.reference.ts  how to wire it into a signup action (reference only)
├── selftest.mjs                  offline earned checks (no network) — `node selftest.mjs`
├── CLAUDE.md                     the hard constraints (k-anonymity + fail-open)
└── README.md
```

## The check

```js
import { checkPasswordStrength } from "./src/password.mjs";

const { ok, reasons, breached, breachCount } = await checkPasswordStrength(password);
// ok          — true only if no rule failed AND the password is not known-breached
// reasons      — user-facing strings to show when ok === false
// breached     — appeared in a known breach corpus
// breachCount  — how many times (0 when not breached / lookup failed open)
```

Two layers, in order:

1. **Rules (deterministic, always run).** At least `MIN_LENGTH` (8) characters and
   at least `MIN_CLASSES` (3) of {lowercase, uppercase, number, symbol}. Length is
   the strongest single signal; the variety floor blocks the obvious weak shapes.
2. **Breach check (k-anonymity).** SHA-1 the password locally, send only the 5-char
   prefix to `GET https://api.pwnedpasswords.com/range/{prefix}`, then match the
   35-char suffix **locally** against the returned range. The password — and its
   full hash — never leave the server.

## Fail open, by design

If the HIBP lookup throws (network down, rate-limited, DNS), the breach signal is
**dropped, not fatal**: `breached` stays false and `ok` rides on the rules alone. A
transient outage of a third-party service must never lock a real person out of
signing up. The rules floor is always enforced regardless.

## Offline-testable seam

`checkPasswordStrength(password, { fetchRange })` takes an **injected** range
fetcher, so the whole thing runs with no network in tests — pass a function that
returns a canned HIBP range body. The default `fetchRange` talks to the live API.

```bash
node selftest.mjs
```

The selftest earns its pass: short rejected, low-variety rejected, a strong
password accepted, a known-breached password flagged (via a fixture range carrying
its real SHA-1 suffix), and fail-open proven when the fetcher throws.

## Boundary

This package validates strength only. It does **not** hash-for-storage, store, or
log the password — pair it with a slow KDF (argon2/bcrypt) at the call site. See
`reference/usage.reference.ts`.
