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

/**
 * The caller's own address, not the proxy's.
 *
 * The browser reaches this API through the web app's /api rewrite, so every
 * request now arrives from the same handful of platform addresses. Keyed on
 * that, three signups an hour would be three signups an hour *for everybody* —
 * the limiter would lock the product, not an abuser. The forwarded chain is
 * what still distinguishes one caller from another; its leftmost entry is the
 * original client by convention, with x-real-ip as the fallback.
 *
 * This trusts a header, which is only worth anything while the proxy is the
 * way in: someone who reaches the API host directly can put whatever they like
 * in it. Restricting the API host to the proxy is what would close that, and
 * that is infrastructure, not code.
 */
function clientIp(req: { ip?: string; headers: Record<string, unknown> }): string {
  const header = (name: string): string | undefined => {
    const v = req.headers[name];
    return typeof v === "string" && v.length > 0 ? v : undefined;
  };
  const forwarded = header("x-forwarded-for")?.split(",")[0]?.trim();
  const candidate = forwarded || header("x-real-ip") || req.ip || "";
  // Normalises IPv6 to a /56 block; a bare address would let anyone with a v6
  // allocation walk the limiter one address at a time.
  return ipKeyGenerator(candidate);
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
  // Both halves, so one attacker can't lock a whole office out of their accounts.
  keyGenerator: (req) => `${clientIp(req)}:${
    typeof (req.body as { email?: unknown } | undefined)?.email === "string"
      ? ((req.body as { email: string }).email).toLowerCase().trim()
      : ""
  }`,
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
  keyGenerator: clientIp,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    error: "Too many accounts created from here. Try again in an hour.",
  },
});
