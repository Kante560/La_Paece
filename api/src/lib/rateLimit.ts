import rateLimit, { ipKeyGenerator } from "express-rate-limit";

/**
 * Limits on the two endpoints that are worth attacking.
 *
 * Three attempts, which is tight — so what counts as an attempt matters more
 * than the number does. Login only counts *failures*: signing in correctly
 * costs nothing, so the limit is invisible to anyone who knows their password
 * and only bites on guessing.
 *
 * `express-rate-limit` stores counters in memory, which means they are per
 * process and reset on deploy. That is the honest trade for having no Redis:
 * it stops password guessing and casual signup floods, and it would not stop a
 * determined distributed attack. Swapping in a shared store later is a
 * constructor argument, not a rewrite.
 */

const MINUTE = 60 * 1000;

/** Both halves of a login attempt, so one attacker can't lock out a whole office. */
function ipAndEmail(req: { ip?: string; body?: unknown }): string {
  const body = req.body as { email?: unknown } | undefined;
  const email = typeof body?.email === "string" ? body.email.toLowerCase().trim() : "";
  // ipKeyGenerator normalises IPv6 to a /56 block; a bare req.ip would let
  // anyone with a v6 allocation walk the limiter one address at a time.
  return `${ipKeyGenerator(req.ip ?? "")}:${email}`;
}

/**
 * Failed sign-ins: 3 per 15 minutes, per address per account.
 *
 * Keyed on the account as well as the caller so a shared IP — an office, a
 * phone network, a household — can't have one person's typos lock everyone
 * else out of their own accounts.
 */
export const loginLimiter = rateLimit({
  windowMs: 15 * MINUTE,
  limit: 3,
  keyGenerator: ipAndEmail,
  // The whole point: only wrong answers are counted.
  skipSuccessfulRequests: true,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    error: "Too many attempts. Wait 15 minutes and try again.",
  },
});

/**
 * New accounts: 3 per hour per address.
 *
 * Enough for a household or a shared office to sign up together on the same
 * evening, low enough that scripted signup floods stop being free. Counts
 * successes too — creating accounts is the thing being limited.
 */
export const signupLimiter = rateLimit({
  windowMs: 60 * MINUTE,
  limit: 3,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    error: "Too many accounts created from here. Try again in an hour.",
  },
});
