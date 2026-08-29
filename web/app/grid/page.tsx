"use client";

import { useCallback, useEffect, useState } from "react";
import Coachmarks, { type CoachStep } from "@/components/Coachmarks";
import { PageLoader } from "@/components/loader";
import { ApiError, get, put } from "@/lib/api";
import { recall, remember } from "@/lib/cache";
import type { GridView } from "@/lib/types";

const COACH: CoachStep[] = [
  {
    target: "grid-table",
    title: "The month at a glance",
    body: "Tap any cell to log it. A dash means the habit wasn't scheduled that day — those days are left out of the maths entirely, so rest days never drag the number down.",
  },
  {
    target: "grid-stats",
    title: "Backfill is allowed, but marked",
    body: "Editing anything older than yesterday asks first, then carries a dot — so the grid can never quietly become fiction.",
  },
];

const MARK: Record<string, string> = {
  complete: "✓",
  partial: "·",
  miss: "✗",
  unscheduled: "–",
  pending: "",
};

/** Each month is its own view, so each gets its own cache entry. */
const gridKey = (m: string | null) => `view:grid:${m ?? "current"}`;

export default function GridPage() {
  const [month, setMonth] = useState<string | null>(null);
  // Seeded from the last render of this page so a turn lands on real content
  // rather than the loader. The fetch below still runs and corrects it.
  const [view, setView] = useState<GridView | null>(() => recall<GridView>(gridKey(null)));
  const [today, setToday] = useState("");
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async (m: string | null) => {
    const [g, me] = await Promise.all([
      get<GridView>(`/views/grid${m ? `?month=${m}` : ""}`),
      get<{ today: string }>("/auth/me"),
    ]);
    setView(remember(gridKey(m), g));
    setToday(me.today);
  }, []);

  useEffect(() => {
    load(month).catch(() => {});
  }, [load, month]);

  async function toggle(habitId: string, date: string, ratio: number, target: number) {
    if (!view) return;
    const next = ratio >= 1 ? 0 : target;
    try {
      await put("/entries", { habitId, date, value: next });
      setNote(null);
    } catch (e) {
      if (e instanceof ApiError && e.body?.error === "BACKFILL_REQUIRED") {
        const days = Number(e.body.daysAgo);
        if (!confirm(`That's ${days} days ago. Log it anyway? It'll be marked as backfilled.`)) return;
        await put("/entries", { habitId, date, value: next, allowBackfill: true });
        setNote("Backfilled entries carry a dot so the grid stays honest.");
      } else throw e;
    }
    load(month);
  }

  if (!view) return <PageLoader />;

  const shift = (delta: number) => {
    const [y, m] = view.month.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 1 + delta, 1));
    setMonth(d.toISOString().slice(0, 7));
  };

  return (
    <div className="fade-up space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="section-title text-2xl">Habit tracker</h1>
          <p className="mt-2 text-[13px] text-ink-faint">
            {new Date(`${view.from}T12:00:00Z`).toLocaleDateString(undefined, {
              month: "long",
              year: "numeric",
            })}
            {" · "}
            <span className="tabular-nums">{view.monthPct}%</span> month to date
          </p>
        </div>
        <div className="flex gap-1">
          {[-1, 1].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => shift(d)}
              className="h-8 w-8 rounded border border-rule text-ink-soft"
            >
              {d < 0 ? "‹" : "›"}
            </button>
          ))}
        </div>
      </header>

      {note && <p className="text-[12px] text-ink-faint">{note}</p>}

      {/* Wide content scrolls inside its own container — the page never does. */}
      <div className="-mx-4 overflow-x-auto px-4" data-coach="grid-table">
        <table className="border-separate border-spacing-0 text-[11px]">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-paper pr-2 text-left font-normal text-ink-faint">
                <span className="sr-only">Habit</span>
              </th>
              {view.days.map((d) => (
                <th
                  key={d.date}
                  className="w-6 pb-1 text-center font-normal tabular-nums"
                  style={{ color: d.date === today ? "var(--ink)" : "var(--ink-faint)" }}
                >
                  {Number(d.date.slice(8))}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {view.habits.map((habit) => (
              <tr key={habit.id}>
                <th
                  scope="row"
                  className="sticky left-0 z-10 max-w-[7.5rem] truncate bg-paper py-1 pr-2 text-left text-[12px] font-normal text-ink-soft"
                  title={habit.name}
                >
                  {habit.name}
                </th>
                {view.days.map((d) => {
                  const cell = d.cells.find((c) => c.habitId === habit.id);
                  if (!cell) return <td key={d.date} className="w-6" />;
                  const future = d.date > today;
                  const colour =
                    cell.state === "complete"
                      ? "var(--good)"
                      : cell.state === "partial"
                        ? "var(--accent)"
                        : cell.state === "miss" && !future
                          ? "var(--accent)"
                          : "var(--ink-faint)";
                  return (
                    <td key={d.date} className="w-6 border-b border-rule p-0 text-center">
                      <button
                        type="button"
                        disabled={cell.state === "unscheduled" || future}
                        onClick={() =>
                          toggle(habit.id, d.date, cell.ratio, habit.target ?? 1)
                        }
                        className="relative h-6 w-6 leading-6 disabled:opacity-40"
                        style={{ color: colour }}
                        aria-label={`${habit.name} on ${d.date}`}
                      >
                        {future && cell.state !== "unscheduled" ? "" : MARK[cell.state]}
                        {cell.isBackfill && (
                          <span
                            className="absolute right-0.5 top-0.5 h-1 w-1 rounded-full"
                            style={{ background: "var(--ink-faint)" }}
                          />
                        )}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl className="grid grid-cols-2 gap-2" data-coach="grid-stats">
        {[
          ["Month to date", `${view.monthPct}%`],
          ["Best day", view.bestDay ? `${view.bestDay.pct}%` : "—"],
        ].map(([k, v]) => (
          <div key={k} className="card px-3 py-2.5 text-center">
            <dt className="text-[10px] uppercase tracking-wide text-ink-faint">{k}</dt>
            <dd className="mt-0.5 text-[17px] font-medium tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>

      <p className="text-[11px] leading-relaxed text-ink-faint">
        <span className="text-ink-soft">–</span> means not scheduled that day, not a miss. Habits
        show dashes before the day you created them.
      </p>

      <Coachmarks id="grid" steps={COACH} ready={!!view} />
    </div>
  );
}
