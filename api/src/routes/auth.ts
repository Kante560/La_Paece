import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { clearSession, issueSession, requireAuth } from "../auth.js";
import { prisma } from "../db.js";
import { loginLimiter, signupLimiter } from "../lib/rateLimit.js";
import { isValidTimeZone, localHour, todayLocal } from "../lib/dates.js";

export const authRouter = Router();

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

authRouter.post("/login", loginLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Email and password required" });

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
  // Constant-ish response regardless of which half was wrong.
  if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  issueSession(res, user.id);
  return res.json({ ok: true });
});

/**
 * Minimum password length.
 *
 * Eight is the floor rather than a wall of composition rules: length is what
 * actually resists guessing, and forcing a symbol mostly produces "Password1!"
 * written on a sticky note. bcrypt at cost 12 does the rest.
 */
const MIN_PASSWORD = 8;

const signupSchema = z.object({
  email: z.string().email("That doesn't look like an email address"),
  password: z.string().min(MIN_PASSWORD, `Password must be at least ${MIN_PASSWORD} characters`),
  /** Read off the browser. Falls back to the schema default when absent or unknown. */
  timezone: z.string().min(1).optional(),
});

authRouter.post("/signup", signupLimiter, async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });

  const email = parsed.data.email.toLowerCase().trim();
  const timezone =
    parsed.data.timezone && isValidTimeZone(parsed.data.timezone) ? parsed.data.timezone : undefined;

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);

  /*
   * No check-then-create. Two signups racing on the same address would both
   * see it free and one would blow up as a 500; the unique index is the only
   * thing that actually decides, so let it, and translate its violation.
   */
  let user;
  try {
    user = await prisma.user.create({
      data: { email, passwordHash, ...(timezone ? { timezone } : {}) },
    });
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") {
      return res.status(409).json({ error: "That email already has an account" });
    }
    throw err;
  }

  issueSession(res, user.id);
  // Straight into first-run setup — a new account has no habits yet.
  return res.status(201).json({ ok: true, needsSetup: true });
});

authRouter.post("/logout", (_req, res) => {
  clearSession(res);
  res.json({ ok: true });
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const u = req.user!;

  /*
   * Accounts that predate the onboarding flag have a null `onboardedAt` but a
   * full set of habits, and must not be dragged back through setup — so the
   * habit count is what settles it for them. Anyone who deliberately started
   * blank has the flag set, and is left alone too.
   */
  const needsSetup =
    u.onboardedAt === null &&
    (await prisma.habit.count({ where: { userId: u.id, archivedAt: null } })) === 0;

  const { onboardedAt: _onboardedAt, ...rest } = u;
  res.json({
    ...rest,
    needsSetup,
    today: todayLocal(u.timezone, u.dayStartHour),
    localHour: localHour(u.timezone),
  });
});

const settingsSchema = z.object({
  timezone: z.string().min(1).optional(),
  dayStartHour: z.number().int().min(0).max(12).optional(),
  nonNegotiableWeight: z.number().int().min(1).max(5).optional(),
});

authRouter.patch("/me", requireAuth, async (req, res) => {
  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid settings" });
  const user = await prisma.user.update({ where: { id: req.user!.id }, data: parsed.data });
  return res.json({
    id: user.id,
    email: user.email,
    timezone: user.timezone,
    dayStartHour: user.dayStartHour,
    nonNegotiableWeight: user.nonNegotiableWeight,
  });
});
