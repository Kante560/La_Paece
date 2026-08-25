import { prisma } from "../db.js";
import { addDays, toDbDate, todayLocal } from "../lib/dates.js";

/**
 * Unfinished todos follow you into the next day rather than disappearing.
 * rollCount is the signal: anything at 3+ isn't a task you forgot, it's a task
 * you're avoiding or one that was never really a one-day job.
 *
 * Idempotent — safe to run on any schedule.
 */
export async function rollOverTodos(): Promise<number> {
  const users = await prisma.user.findMany({
    select: { id: true, timezone: true, dayStartHour: true },
  });

  let rolled = 0;
  for (const user of users) {
    const today = todayLocal(user.timezone, user.dayStartHour);
    const yesterday = addDays(today, -1);

    const result = await prisma.todo.updateMany({
      where: { userId: user.id, date: toDbDate(yesterday), done: false },
      data: { date: toDbDate(today), rollCount: { increment: 1 } },
    });
    rolled += result.count;
  }
  return rolled;
}

/** Hourly is enough — day boundaries land on the hour in every timezone. */
export function startRolloverJob(): NodeJS.Timeout {
  const run = () =>
    rollOverTodos()
      .then((n) => n > 0 && console.log(`[rollover] carried ${n} todo(s) forward`))
      .catch((err) => console.error("[rollover] failed:", err));

  run();
  return setInterval(run, 60 * 60 * 1000);
}
