import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../auth.js";
import { prisma } from "../db.js";
import { isValidLocalDate, toDbDate } from "../lib/dates.js";

export const daysRouter = Router();
daysRouter.use(requireAuth);

const daySchema = z.object({
  intention: z.string().max(280).nullable().optional(),
  energy: z.number().int().min(1).max(5).nullable().optional(),
  mood: z.number().int().min(1).max(5).nullable().optional(),
  whatWorked: z.string().max(1000).nullable().optional(),
  whatBlocked: z.string().max(1000).nullable().optional(),
  tomorrowOneThing: z.string().max(280).nullable().optional(),
  notes: z.string().max(4000).nullable().optional(),
});

daysRouter.patch("/:date", async (req, res) => {
  const { date } = req.params;
  if (!isValidLocalDate(date)) return res.status(400).json({ error: "Invalid date" });

  const parsed = daySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });

  const day = await prisma.day.upsert({
    where: { userId_date: { userId: req.user!.id, date: toDbDate(date) } },
    create: { userId: req.user!.id, date: toDbDate(date), ...parsed.data },
    update: parsed.data,
  });
  return res.json({ ...day, date });
});
