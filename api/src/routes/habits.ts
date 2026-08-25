import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../auth.js";
import { prisma } from "../db.js";
import { fromDbDate, toDbDate, todayLocal } from "../lib/dates.js";
import { loadHabits } from "../services/tracker.js";

export const habitsRouter = Router();
habitsRouter.use(requireAuth);

const habitSchema = z.object({
  name: z.string().min(1).max(80),
  category: z.enum(["NON_NEGOTIABLE", "OTHER"]).default("NON_NEGOTIABLE"),
  type: z.enum(["BINARY", "QUANTITY"]).default("BINARY"),
  target: z.number().positive().nullable().optional(),
  unit: z.string().max(16).nullable().optional(),
  scheduleDays: z.array(z.number().int().min(0).max(6)).min(1).default([0, 1, 2, 3, 4, 5, 6]),
  resolveWindow: z.enum(["SAME_DAY", "NEXT_MORNING"]).default("SAME_DAY"),
  sortOrder: z.number().int().optional(),
});

habitsRouter.get("/", async (req, res) => {
  res.json(await loadHabits(req.user!.id));
});

habitsRouter.post("/", async (req, res) => {
  const parsed = habitSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const d = parsed.data;
  if (d.type === "QUANTITY" && !d.target) {
    return res.status(400).json({ error: "Quantity habits need a target" });
  }

  const count = await prisma.habit.count({ where: { userId: req.user!.id, archivedAt: null } });
  const habit = await prisma.habit.create({
    data: {
      userId: req.user!.id,
      name: d.name,
      category: d.category,
      type: d.type,
      target: d.type === "QUANTITY" ? d.target : null,
      unit: d.unit ?? null,
      scheduleDays: d.scheduleDays,
      resolveWindow: d.resolveWindow,
      sortOrder: d.sortOrder ?? count,
      // Starts today — never retroactive misses on days before it existed.
      activeFrom: toDbDate(todayLocal(req.user!.timezone, req.user!.dayStartHour)),
    },
  });
  return res.status(201).json({ ...habit, activeFrom: fromDbDate(habit.activeFrom) });
});

habitsRouter.patch("/:id", async (req, res) => {
  const parsed = habitSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });

  const existing = await prisma.habit.findFirst({
    where: { id: req.params.id, userId: req.user!.id },
  });
  if (!existing) return res.status(404).json({ error: "Habit not found" });

  const habit = await prisma.habit.update({
    where: { id: existing.id },
    data: { ...parsed.data, target: parsed.data.target ?? undefined },
  });
  return res.json({ ...habit, activeFrom: fromDbDate(habit.activeFrom) });
});

/**
 * Archive by default — deleting a habit silently rewrites months of history,
 * so archiving stops it counting from today forward and leaves the past intact.
 *
 * `?permanent=1` is the deliberate escape hatch: it drops the habit and cascades
 * its entries. That's the right call for a habit seeded by mistake (it has no
 * history worth keeping), and the wrong one for a habit you simply stopped —
 * which is why it can't happen without asking for it explicitly.
 */
habitsRouter.delete("/:id", async (req, res) => {
  const existing = await prisma.habit.findFirst({
    where: { id: req.params.id, userId: req.user!.id },
  });
  if (!existing) return res.status(404).json({ error: "Habit not found" });

  const permanent = req.query.permanent === "1" || req.query.permanent === "true";
  if (permanent) {
    // Entry.habit is onDelete: Cascade, so the entries go with it.
    await prisma.habit.delete({ where: { id: existing.id } });
    return res.json({ ok: true, permanent: true });
  }

  const today = todayLocal(req.user!.timezone, req.user!.dayStartHour);
  await prisma.habit.update({
    where: { id: existing.id },
    data: { archivedAt: new Date(), activeTo: toDbDate(today) },
  });
  return res.json({ ok: true, permanent: false });
});

/**
 * Clear a whole category at once — the "I don't want the starter list" button.
 * Same archive-vs-permanent split as the single delete.
 */
habitsRouter.post("/clear", async (req, res) => {
  const parsed = z
    .object({
      category: z.enum(["NON_NEGOTIABLE", "OTHER"]).optional(),
      permanent: z.boolean().default(false),
    })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });

  const where = {
    userId: req.user!.id,
    archivedAt: null,
    ...(parsed.data.category ? { category: parsed.data.category } : {}),
  };

  if (parsed.data.permanent) {
    const { count } = await prisma.habit.deleteMany({ where });
    return res.json({ ok: true, count, permanent: true });
  }

  const today = todayLocal(req.user!.timezone, req.user!.dayStartHour);
  const { count } = await prisma.habit.updateMany({
    where,
    data: { archivedAt: new Date(), activeTo: toDbDate(today) },
  });
  return res.json({ ok: true, count, permanent: false });
});

habitsRouter.post("/reorder", async (req, res) => {
  const parsed = z.object({ ids: z.array(z.string()) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "ids[] required" });

  await prisma.$transaction(
    parsed.data.ids.map((id, i) =>
      prisma.habit.updateMany({ where: { id, userId: req.user!.id }, data: { sortOrder: i } }),
    ),
  );
  return res.json({ ok: true });
});
