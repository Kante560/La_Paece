import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { clearSession, issueSession, requireAuth } from "../auth.js";
import { prisma } from "../db.js";
import { localHour, todayLocal } from "../lib/dates.js";

export const authRouter = Router();

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

authRouter.post("/login", async (req, res) => {
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

authRouter.post("/logout", (_req, res) => {
  clearSession(res);
  res.json({ ok: true });
});

authRouter.get("/me", requireAuth, (req, res) => {
  const u = req.user!;
  res.json({
    ...u,
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
