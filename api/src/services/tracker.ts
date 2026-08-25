import { prisma } from "../db.js";
import {
  addDays,
  eachDay,
  fromDbDate,
  monthEnd,
  monthStart,
  toDbDate,
  weekDays,
  weekStart,
  type LocalDate,
} from "../lib/dates.js";
import { averagePct, buildEntryMap, dailyProgress } from "../domain/progress.js";
import { computeStreak, type Streak } from "../domain/streaks.js";
import { suggestTarget, weekStats, type WeekStats } from "../domain/week.js";
import type { DomainEntry, DomainHabit } from "../domain/types.js";
import type { AuthedUser } from "../auth.js";

export async function loadHabits(userId: string): Promise<DomainHabit[]> {
  const rows = await prisma.habit.findMany({
    where: { userId },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return rows.map((h) => ({
    id: h.id,
    name: h.name,
    category: h.category,
    type: h.type,
    target: h.target === null ? null : Number(h.target),
    unit: h.unit,
    scheduleDays: h.scheduleDays,
    resolveWindow: h.resolveWindow,
    sortOrder: h.sortOrder,
    activeFrom: fromDbDate(h.activeFrom),
    activeTo: h.activeTo ? fromDbDate(h.activeTo) : null,
    archivedAt: h.archivedAt ? h.archivedAt.toISOString().slice(0, 10) : null,
  }));
}

export async function loadEntries(
  userId: string,
  from: LocalDate,
  to: LocalDate,
): Promise<DomainEntry[]> {
  const rows = await prisma.entry.findMany({
    where: { userId, date: { gte: toDbDate(from), lte: toDbDate(to) } },
  });
  return rows.map((e) => ({
    habitId: e.habitId,
    date: fromDbDate(e.date),
    value: Number(e.value),
    isBackfill: e.isBackfill,
    missReason: e.missReason,
  }));
}

/** Everything the Today screen needs, in one round trip. */
export async function getDayView(user: AuthedUser, date: LocalDate, today: LocalDate) {
  const habits = await loadHabits(user.id);
  const activeHabits = habits.filter((h) => !h.archivedAt);

  // Streaks need history; the day itself needs only the day.
  const entries = await loadEntries(user.id, addDays(date, -400), date);
  const map = buildEntryMap(entries);

  const progress = dailyProgress(activeHabits, map, date, user.nonNegotiableWeight, today);
  const streaks: Record<string, Streak> = {};
  for (const h of activeHabits) streaks[h.id] = computeStreak(h, map, today);

  const [day, todos] = await Promise.all([
    prisma.day.findUnique({ where: { userId_date: { userId: user.id, date: toDbDate(date) } } }),
    prisma.todo.findMany({
      where: { userId: user.id, date: toDbDate(date) },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return {
    date,
    today,
    habits: activeHabits,
    progress,
    streaks,
    day: day
      ? {
          intention: day.intention,
          energy: day.energy,
          mood: day.mood,
          whatWorked: day.whatWorked,
          whatBlocked: day.whatBlocked,
          tomorrowOneThing: day.tomorrowOneThing,
          notes: day.notes,
        }
      : null,
    todos: todos.map((t) => ({ id: t.id, text: t.text, done: t.done, rollCount: t.rollCount })),
  };
}

export async function getWeekView(
  user: AuthedUser,
  anchor: LocalDate,
  today: LocalDate,
): Promise<WeekStats & { baselinePct: number; suggestedTarget: number; goalId: string | null }> {
  const start = weekStart(anchor);
  const days = weekDays(start);
  const habits = (await loadHabits(user.id)).filter((h) => !h.archivedAt);

  // Trailing 4 weeks give the baseline the target is anchored to.
  const trailingFrom = addDays(start, -28);
  const entries = await loadEntries(user.id, trailingFrom, days[6]);
  const map = buildEntryMap(entries);

  const weekProgress = days.map((d) =>
    dailyProgress(habits, map, d, user.nonNegotiableWeight, today),
  );

  const trailing = eachDay(trailingFrom, addDays(start, -1))
    .filter((d) => d <= today)
    .map((d) => dailyProgress(habits, map, d, user.nonNegotiableWeight, today));
  const baselinePct = averagePct(trailing);

  const goal = await prisma.weekGoal.findUnique({
    where: { userId_weekStart: { userId: user.id, weekStart: toDbDate(start) } },
  });

  const stats = weekStats(weekProgress, today, goal ? Number(goal.targetPct) : null);

  return {
    ...stats,
    baselinePct,
    suggestedTarget: suggestTarget(baselinePct),
    goalId: goal?.id ?? null,
  };
}

/** The month matrix from the notebook page. */
export async function getGridView(user: AuthedUser, anchor: LocalDate, today: LocalDate) {
  const from = monthStart(anchor);
  const to = monthEnd(anchor);
  const habits = (await loadHabits(user.id)).filter((h) => !h.archivedAt);
  const entries = await loadEntries(user.id, from, to);
  const map = buildEntryMap(entries);

  const days = eachDay(from, to).map((d) =>
    dailyProgress(habits, map, d, user.nonNegotiableWeight, today),
  );
  const elapsed = days.filter((d) => d.date <= today);

  return {
    month: anchor.slice(0, 7),
    from,
    to,
    habits,
    days,
    monthPct: averagePct(elapsed),
    bestDay: elapsed.reduce<{ date: LocalDate; pct: number } | null>(
      (best, d) =>
        d.weightedTotal > 0 && (!best || d.pct > best.pct) ? { date: d.date, pct: d.pct } : best,
      null,
    ),
  };
}
