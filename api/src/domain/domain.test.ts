import assert from "node:assert/strict";
import { test } from "node:test";
import { addDays, dayOfWeek, monthEnd, todayLocal, weekStart } from "../lib/dates.js";
import { buildEntryMap, completionRatio, dailyProgress, isScheduled } from "./progress.js";
import { computeStreak } from "./streaks.js";
import { suggestTarget, targetWarning, weekStats } from "./week.js";
import type { DomainEntry, DomainHabit } from "./types.js";

const habit = (over: Partial<DomainHabit> = {}): DomainHabit => ({
  id: "h1",
  name: "Workout",
  category: "NON_NEGOTIABLE",
  type: "BINARY",
  target: null,
  unit: null,
  scheduleDays: [0, 1, 2, 3, 4, 5, 6],
  resolveWindow: "SAME_DAY",
  sortOrder: 0,
  activeFrom: "2026-01-01",
  activeTo: null,
  archivedAt: null,
  ...over,
});

const entry = (habitId: string, date: string, value: number): DomainEntry => ({
  habitId,
  date,
  value,
  isBackfill: false,
  missReason: null,
});

// --- day boundary -----------------------------------------------------------

test("4am day boundary keeps a 1:40am log on the previous day", () => {
  const tz = "America/Los_Angeles";
  // 2026-08-25 01:40 PDT == 08:40 UTC
  assert.equal(todayLocal(tz, 4, new Date("2026-08-25T08:40:00Z")), "2026-08-24");
  // 2026-08-25 05:10 PDT == 12:10 UTC
  assert.equal(todayLocal(tz, 4, new Date("2026-08-25T12:10:00Z")), "2026-08-25");
});

test("weekStart lands on Monday", () => {
  assert.equal(weekStart("2026-08-25"), "2026-08-24"); // Tue -> Mon
  assert.equal(weekStart("2026-08-24"), "2026-08-24"); // Mon -> itself
  assert.equal(weekStart("2026-08-23"), "2026-08-17"); // Sun -> previous Mon
  assert.equal(dayOfWeek("2026-08-24"), 1);
});

test("monthEnd handles leap years", () => {
  assert.equal(monthEnd("2028-02-10"), "2028-02-29");
  assert.equal(monthEnd("2026-02-10"), "2026-02-28");
});

// --- scheduling / history integrity -----------------------------------------

test("a habit is not scheduled before it existed", () => {
  const h = habit({ activeFrom: "2026-08-15" });
  assert.equal(isScheduled(h, "2026-08-14"), false); // dash, not a miss
  assert.equal(isScheduled(h, "2026-08-15"), true);
});

test("a rest day is not a failed workout", () => {
  const h = habit({ scheduleDays: [1, 3, 5] }); // Mon/Wed/Fri
  assert.equal(isScheduled(h, "2026-08-24"), true); // Monday
  assert.equal(isScheduled(h, "2026-08-25"), false); // Tuesday
});

// --- partial credit ---------------------------------------------------------

test("quantity habits earn proportional partial credit, capped at 1", () => {
  const water = habit({ type: "QUANTITY", target: 3, unit: "L" });
  assert.equal(completionRatio(water, 1.5), 0.5);
  assert.equal(completionRatio(water, 3), 1);
  assert.equal(completionRatio(water, 4.2), 1); // overachieving isn't 140%
  assert.equal(completionRatio(water, null), 0);
});

// --- weighted daily % -------------------------------------------------------

test("non-negotiables outweigh other habits in the daily number", () => {
  const habits = [
    habit({ id: "nn", category: "NON_NEGOTIABLE" }),
    habit({ id: "oth", category: "OTHER" }),
  ];
  // Do only the OTHER habit: 1 of 3 weighted units.
  const onlyOther = dailyProgress(
    habits,
    buildEntryMap([entry("oth", "2026-08-25", 1)]),
    "2026-08-25",
    2,
    "2026-08-25",
  );
  assert.equal(onlyOther.pct, 33.33);

  // Do only the NON_NEGOTIABLE: 2 of 3.
  const onlyNN = dailyProgress(
    habits,
    buildEntryMap([entry("nn", "2026-08-25", 1)]),
    "2026-08-25",
    2,
    "2026-08-25",
  );
  assert.equal(onlyNN.pct, 66.67);
});

test("unscheduled habits are excluded from the denominator", () => {
  const habits = [
    habit({ id: "daily" }),
    habit({ id: "restday", scheduleDays: [1] }), // Monday only
  ];
  const tue = dailyProgress(
    habits,
    buildEntryMap([entry("daily", "2026-08-25", 1)]),
    "2026-08-25", // Tuesday
    2,
    "2026-08-25",
  );
  assert.equal(tue.pct, 100); // not 50 — the rest day doesn't drag you down
  assert.equal(tue.scheduledCount, 1);
});

// --- streaks ----------------------------------------------------------------

test("never miss twice: one miss survives, two breaks", () => {
  const h = habit({ activeFrom: "2026-08-01" });
  const today = "2026-08-10";

  const oneMiss = ["08-01", "08-02", "08-03", "08-05", "08-06", "08-07", "08-08", "08-09", "08-10"]
    .map((d) => entry("h1", `2026-${d}`, 1));
  // 08-04 missing -> forgiven. The streak survives INTACT and keeps climbing;
  // it does not silently restart at 6, because a silent restart is a break.
  assert.equal(computeStreak(h, buildEntryMap(oneMiss), today).current, 9);

  const twoMisses = ["08-01", "08-02", "08-03", "08-06", "08-07", "08-08", "08-09", "08-10"]
    .map((d) => entry("h1", `2026-${d}`, 1));
  // 08-04 and 08-05 missing -> reset, streak = the 5 days since
  assert.equal(computeStreak(h, buildEntryMap(twoMisses), today).current, 5);
});

test("an unresolved today is never counted as a miss", () => {
  const h = habit({ activeFrom: "2026-08-08" });
  const done = ["08-08", "08-09"].map((d) => entry("h1", `2026-${d}`, 1));
  const s = computeStreak(h, buildEntryMap(done), "2026-08-10");
  assert.equal(s.current, 2); // today is blank but the streak stands
  assert.equal(s.atRisk, false);
});

test("atRisk flags a single outstanding miss", () => {
  const h = habit({ activeFrom: "2026-08-08" });
  const done = ["08-08", "08-09"].map((d) => entry("h1", `2026-${d}`, 1));
  // 08-10 explicitly missed
  done.push(entry("h1", "2026-08-10", 0));
  const s = computeStreak(h, buildEntryMap(done), "2026-08-10");
  assert.equal(s.current, 2);
  assert.equal(s.atRisk, true);
});

// --- weekly pace ------------------------------------------------------------

function buildWeek(doneDays: number, habitsPerDay = 2, today = "2026-08-30") {
  const habits = [habit({ id: "a" }), habit({ id: "b", category: "OTHER" })].slice(0, habitsPerDay);
  const entries: DomainEntry[] = [];
  for (let i = 0; i < doneDays; i++) {
    const d = addDays("2026-08-24", i);
    for (const h of habits) entries.push(entry(h.id, d, 1));
  }
  const map = buildEntryMap(entries);
  return Array.from({ length: 7 }, (_, i) =>
    dailyProgress(habits, map, addDays("2026-08-24", i), 2, today),
  );
}

test("a target already banked reads SECURED", () => {
  const days = buildWeek(7, 2, "2026-08-30");
  const s = weekStats(days, "2026-08-30", 55);
  assert.equal(s.target?.status, "SECURED");
});

test("an unreachable target says IMPOSSIBLE and offers a rebaseline", () => {
  // Nothing done, and only the final day left.
  const days = buildWeek(0, 2, "2026-08-30");
  const s = weekStats(days, "2026-08-30", 90);
  assert.equal(s.target?.status, "IMPOSSIBLE");
  assert.ok(s.target!.rebaselineSuggestion !== null);
  assert.ok(s.target!.rebaselineSuggestion! < 90);
});

test("ceiling and floor bracket what's still possible", () => {
  const days = buildWeek(3, 2, "2026-08-27");
  const s = weekStats(days, "2026-08-27", 60);
  assert.ok(s.floorPct < s.ceilingPct);
  assert.ok(s.ceilingPct <= 100);
  assert.equal(s.doneChecks, 6);
});

test("neededChecks answers 'N of the remaining M'", () => {
  const days = buildWeek(2, 2, "2026-08-26");
  const s = weekStats(days, "2026-08-26", 60);
  assert.ok(s.target!.neededChecks > 0);
  assert.ok(s.target!.neededChecks <= s.target!.remainingChecks);
});

// --- target anchoring -------------------------------------------------------

test("suggested target is a small ratchet, never a leap", () => {
  assert.equal(suggestTarget(51.2), 54.7);
  assert.equal(suggestTarget(99), 100); // clamped
});

test("big jumps warn, deloads are legitimised", () => {
  assert.match(targetWarning(90, 51.2)!, /how week one fails/);
  assert.equal(targetWarning(55, 51.2), null);
  assert.match(targetWarning(45, 51.2)!, /not a failure/);
});
