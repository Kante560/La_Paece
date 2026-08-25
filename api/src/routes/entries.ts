import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../auth.js";
import { prisma } from "../db.js";
import { diffDays, isValidLocalDate, toDbDate, todayLocal } from "../lib/dates.js";

export const entriesRouter = Router();
entriesRouter.use(requireAuth);

const MISS_REASONS = [
  "TIRED",
  "NO_TIME",
  "TRAVELING",
  "SICK",
  "SOCIAL",
  "FORGOT",
  "CHOSE_NOT_TO",
] as const;

const entrySchema = z.object({
  habitId: z.string().min(1),
  date: z.string().refine(isValidLocalDate, "Invalid date"),
  value: z.number().min(0),
  missReason: z.enum(MISS_REASONS).nullable().optional(),
  /** Client must opt in explicitly to edit anything older than yesterday. */
  allowBackfill: z.boolean().default(false),
});

entriesRouter.put("/", async (req, res) => {
  const parsed = entrySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const { habitId, date, value, missReason, allowBackfill } = parsed.data;

  const user = req.user!;
  const today = todayLocal(user.timezone, user.dayStartHour);
  const age = diffDays(today, date);

  if (age < 0) return res.status(400).json({ error: "Can't log a future day" });

  // Today and yesterday are freely editable. Anything older is a deliberate
  // act and gets flagged, so the grid never quietly becomes fiction.
  if (age > 1 && !allowBackfill) {
    return res.status(409).json({ error: "BACKFILL_REQUIRED", daysAgo: age });
  }

  const habit = await prisma.habit.findFirst({ where: { id: habitId, userId: user.id } });
  if (!habit) return res.status(404).json({ error: "Habit not found" });

  const entry = await prisma.entry.upsert({
    where: { habitId_date: { habitId, date: toDbDate(date) } },
    create: {
      habitId,
      userId: user.id,
      date: toDbDate(date),
      value,
      isBackfill: age > 1,
      missReason: missReason ?? null,
    },
    update: { value, missReason: missReason ?? null, isBackfill: age > 1 },
  });

  // The cached day % is disposable — recompute lazily on read instead of
  // trying to keep two sources of truth in sync here.
  await prisma.day.updateMany({
    where: { userId: user.id, date: toDbDate(date) },
    data: { progressPct: null },
  });

  return res.json({ ...entry, value: Number(entry.value), date });
});

entriesRouter.delete("/:habitId/:date", async (req, res) => {
  const { habitId, date } = req.params;
  if (!isValidLocalDate(date)) return res.status(400).json({ error: "Invalid date" });

  await prisma.entry.deleteMany({
    where: { habitId, userId: req.user!.id, date: toDbDate(date) },
  });
  return res.json({ ok: true });
});
