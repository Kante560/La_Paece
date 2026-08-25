import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../auth.js";
import { prisma } from "../db.js";
import { isValidLocalDate, toDbDate, todayLocal, weekStart } from "../lib/dates.js";
import { MAX_SAFE_INCREMENT, targetWarning } from "../domain/week.js";
import { getWeekView } from "../services/tracker.js";

export const weekRouter = Router();
weekRouter.use(requireAuth);

const goalSchema = z.object({
  targetPct: z.number().min(0).max(100),
  /** Set after the user has seen and accepted the "that's a big jump" warning. */
  acknowledgeWarning: z.boolean().default(false),
});

weekRouter.put("/:date", async (req, res) => {
  if (!isValidLocalDate(req.params.date)) return res.status(400).json({ error: "Invalid date" });
  const parsed = goalSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });

  const user = req.user!;
  const today = todayLocal(user.timezone, user.dayStartHour);
  const start = weekStart(req.params.date);
  const view = await getWeekView(user, start, today);

  const { targetPct, acknowledgeWarning } = parsed.data;
  const warning = targetWarning(targetPct, view.baselinePct);

  // Big jumps are how week one fails and the app gets deleted. Make the user
  // look at the number once; don't refuse outright — it's their life.
  if (warning && targetPct - view.baselinePct > MAX_SAFE_INCREMENT && !acknowledgeWarning) {
    return res.status(409).json({
      error: "TARGET_TOO_AGGRESSIVE",
      warning,
      baselinePct: view.baselinePct,
      suggested: view.suggestedTarget,
    });
  }

  const targetChecks = Math.ceil((targetPct / 100) * view.totalChecks);
  const goal = await prisma.weekGoal.upsert({
    where: { userId_weekStart: { userId: user.id, weekStart: toDbDate(start) } },
    create: {
      userId: user.id,
      weekStart: toDbDate(start),
      targetPct,
      baselinePct: view.baselinePct,
      targetChecks,
      totalChecks: view.totalChecks,
    },
    update: { targetPct, targetChecks, totalChecks: view.totalChecks },
  });

  return res.json({ goal: { ...goal, targetPct: Number(goal.targetPct) }, warning });
});

/**
 * Deliberately lowering a target mid-week. First-class and recorded, not a
 * hidden failure — a target that only ratchets upward eventually guarantees
 * failure, and systems without a deload break the people using them.
 */
weekRouter.post("/:date/rebaseline", async (req, res) => {
  if (!isValidLocalDate(req.params.date)) return res.status(400).json({ error: "Invalid date" });
  const parsed = z.object({ targetPct: z.number().min(0).max(100) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "targetPct required" });

  const user = req.user!;
  const start = weekStart(req.params.date);
  const existing = await prisma.weekGoal.findUnique({
    where: { userId_weekStart: { userId: user.id, weekStart: toDbDate(start) } },
  });
  if (!existing) return res.status(404).json({ error: "No goal set for this week" });

  const goal = await prisma.weekGoal.update({
    where: { id: existing.id },
    data: {
      targetPct: parsed.data.targetPct,
      targetChecks: Math.ceil((parsed.data.targetPct / 100) * existing.totalChecks),
      rebaselinedAt: new Date(),
      rebaselinedFrom: existing.targetPct,
    },
  });
  return res.json({ ...goal, targetPct: Number(goal.targetPct) });
});

weekRouter.delete("/:date", async (req, res) => {
  const start = weekStart(req.params.date);
  await prisma.weekGoal.deleteMany({ where: { userId: req.user!.id, weekStart: toDbDate(start) } });
  res.json({ ok: true });
});
