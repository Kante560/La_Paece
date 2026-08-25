import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../auth.js";
import { prisma } from "../db.js";
import { isValidLocalDate, toDbDate } from "../lib/dates.js";

export const todosRouter = Router();
todosRouter.use(requireAuth);

/** Three. The constraint is the feature — a list of twelve is a wish, not a plan. */
export const MAX_TODOS_PER_DAY = 3;

todosRouter.post("/", async (req, res) => {
  const parsed = z
    .object({
      date: z.string().refine(isValidLocalDate, "Invalid date"),
      text: z.string().min(1).max(200),
    })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });

  const count = await prisma.todo.count({
    where: { userId: req.user!.id, date: toDbDate(parsed.data.date) },
  });
  if (count >= MAX_TODOS_PER_DAY) {
    return res.status(409).json({ error: `Three a day. Finish or drop one first.` });
  }

  const todo = await prisma.todo.create({
    data: { userId: req.user!.id, date: toDbDate(parsed.data.date), text: parsed.data.text },
  });
  return res.status(201).json({ ...todo, date: parsed.data.date });
});

todosRouter.patch("/:id", async (req, res) => {
  const parsed = z
    .object({ text: z.string().min(1).max(200).optional(), done: z.boolean().optional() })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });

  const existing = await prisma.todo.findFirst({
    where: { id: req.params.id, userId: req.user!.id },
  });
  if (!existing) return res.status(404).json({ error: "Todo not found" });

  const todo = await prisma.todo.update({ where: { id: existing.id }, data: parsed.data });
  return res.json({ ...todo, date: todo.date.toISOString().slice(0, 10) });
});

todosRouter.delete("/:id", async (req, res) => {
  await prisma.todo.deleteMany({ where: { id: req.params.id, userId: req.user!.id } });
  res.json({ ok: true });
});
