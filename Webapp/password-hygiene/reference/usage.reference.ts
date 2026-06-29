// reference/usage.reference.ts — how to wire password-hygiene into a signup action.
//
// REFERENCE ONLY — not compiled or shipped from this package. It shows the seam:
// run checkPasswordStrength() server-side BEFORE creating the account, surface its
// `reasons` to the user, and let the fail-open behaviour handle a HIBP outage for
// you (no extra try/catch needed at the call site).
//
// The import path below assumes you've pulled this package in at a pinned version;
// adjust to your monorepo alias. `password.mjs` is plain ESM — usable as-is from
// a Next.js Server Action, a Route Handler, or any Node 22 server runtime.

import { checkPasswordStrength } from "../src/password.mjs";

// --- Example A: a Next.js Server Action ------------------------------------

type SignupResult = { ok: true } | { ok: false; errors: string[] };

export async function signupAction(formData: FormData): Promise<SignupResult> {
  "use server";

  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  // Strength + breach gate runs on the SERVER, before any account is created.
  // Only the 5-char SHA-1 prefix leaves the box; the check fails open on outage.
  const strength = await checkPasswordStrength(password);
  if (!strength.ok) {
    // `reasons` are user-facing and already phrased for display.
    return { ok: false, errors: strength.reasons };
  }

  // Strength passed — proceed with the real account creation (hash with a slow
  // KDF like argon2/bcrypt; this package never stores or logs the password).
  await createUser({ email, password });
  return { ok: true };
}

// --- Example B: a plain Route Handler (framework-agnostic) ------------------

export async function POST(req: Request): Promise<Response> {
  const { password } = (await req.json()) as { password: string };

  const { ok, reasons, breached, breachCount } = await checkPasswordStrength(password);
  if (!ok) {
    // 422 = the submission was understood but failed validation.
    return Response.json({ ok, reasons, breached, breachCount }, { status: 422 });
  }
  return Response.json({ ok: true });
}

// --- Test seam: inject a fetcher to avoid the network in unit tests ----------

export async function checkOffline(password: string) {
  return checkPasswordStrength(password, {
    // Return a canned HIBP range body; never hits the API.
    fetchRange: async (_prefix: string) => "0000000000000000000000000000000000:0\n",
  });
}

// Stub so this reference type-checks in isolation; replace with your data layer.
declare function createUser(input: { email: string; password: string }): Promise<void>;
