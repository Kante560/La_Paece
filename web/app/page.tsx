"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ActionMenu from "@/components/ActionMenu";
import Check from "@/components/Check";
import Coachmarks, { type CoachStep } from "@/components/Coachmarks";
import Disclosure from "@/components/Disclosure";
import HabitForm, { type HabitDraft } from "@/components/HabitForm";
import HabitRow from "@/components/HabitRow";
import Ovr from "@/components/Ovr";
import Ring from "@/components/Ring";
import SignOff from "@/components/SignOff";
import { PageLoader } from "@/components/loader";
import { del, get, patch, post, put } from "@/lib/api";
import { recall, remember } from "@/lib/cache";
import { useAutosave } from "@/lib/hooks";
import { applyEntry, clearEntry } from "@/lib/progress";
import { MISS_REASONS, type DayView, type Habit, type Me } from "@/lib/types";

type Mode = "morning" | "day" | "evening";

function modeFor(hour: number): Mode {
  if (hour < 12) return "morning";
  if (hour >= 20) return "evening";
  return "day";
}

const SCALE = [1, 2, 3, 4, 5];

const COACH: CoachStep[] = [
  {
    target: "ring",
    title: "Two numbers, not one",
    body: "This is today's weighted score. Non-negotiables count more than bonus habits, so it can't be padded by easy wins.",
  },
  {
    target: "add-habit",
    title: "Add a habit anywhere",
    body: "New habits start counting today — they never appear as retroactive misses on days before they existed.",
  },
  {
    target: "habit-list",
    title: "Press and hold to edit",
    body: "Long-press a checkbox on mobile, or right-click on desktop, to rename, reschedule or delete it. Unticking a box just means 'not yet' — it's never recorded as a miss.",
  },
  {
    target: "closeout",
    title: "Ten seconds at night",
    body: "Energy, mood, and why you missed anything. It's the only data a checkbox can't give you, and you can't backfill it later.",
  },
];

export default function TodayPage() {
  const [me, setMe] = useState<Me | null>(null);
  // Seeded from the last render of this page so a turn lands on real content
  // rather than the loader. The fetch below still runs and corrects it.
  const [view, setView] = useState<DayView | null>(() => recall<DayView>("view:today"));
  const [mode, setMode] = useState<Mode>("day");
  const [newTodo, setNewTodo] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Habit | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ habit: Habit; x: number; y: number } | null>(null);

  /**
   * Number of writes still in flight.
   *
   * Every optimistic edit bumps this. A background reconcile only applies its
   * result when the count is back to zero — otherwise a slow response would
   * overwrite a newer local edit and the UI would visibly snap backwards,
   * which is the flicker this whole dance exists to prevent.
   */
  const router = useRouter();
  const writes = useRef(0);

  const load = useCallback(async () => {
    const [meRes, dayRes] = await Promise.all([get<Me>("/auth/me"), get<DayView>("/views/today")]);
    /*
     * Setup was abandoned part-way. Today would be an empty page with nothing
     * to tick and no rating, which reads as a broken app rather than an
     * unfinished one — so finish setting up first.
     */
    if (meRes.needsSetup) {
      router.replace("/welcome");
      return;
    }
    setMe(meRes);
    setView(remember("view:today", dayRes));
    setMode(modeFor(meRes.localHour));
  }, [router]);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  /** Pull server truth (streaks, rollups) in the background — never mid-edit. */
  const reconcile = useCallback(async () => {
    if (writes.current > 0) return;
    try {
      const fresh = await get<DayView>("/views/today");
      if (writes.current > 0) return;
      setView(fresh);
    } catch {
      /* the optimistic state still stands; next edit will retry */
    }
  }, []);

  const track = useCallback(
    async (fn: () => Promise<unknown>) => {
      writes.current++;
      try {
        await fn();
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Save failed");
      } finally {
        writes.current--;
      }
      reconcile();
    },
    [reconcile],
  );

  const saveDay = useAutosave<Record<string, unknown>>((body) => patch(`/days/${view?.date}`, body));

  const setEntry = useCallback(
    (habit: Habit, value: number, missReason?: string | null) => {
      // Paint first. The request is a formality the user shouldn't wait on.
      setView((v) =>
        v ? { ...v, progress: applyEntry(v.progress, habit, value, missReason ?? null) } : v,
      );
      track(() =>
        put("/entries", { habitId: habit.id, date: view?.date, value, missReason: missReason ?? null }),
      );
    },
    [view?.date, track],
  );

  const clearEntryFor = useCallback(
    (habit: Habit) => {
      const unresolved = !!view && view.date >= view.today;
      setView((v) => (v ? { ...v, progress: clearEntry(v.progress, habit.id, unresolved) } : v));
      track(() => del(`/entries/${habit.id}/${view?.date}`));
    },
    [view, track],
  );

  const cellFor = useMemo(
    () => (habitId: string) => view?.progress.cells.find((c) => c.habitId === habitId),
    [view],
  );

  async function submitHabit(draft: HabitDraft) {
    const body = {
      ...draft,
      target: draft.type === "QUANTITY" ? Number(draft.target) : null,
      unit: draft.type === "QUANTITY" ? draft.unit || null : null,
    };
    try {
      if (editing) await patch(`/habits/${editing.id}`, body);
      else await post("/habits", body);
      setFormOpen(false);
      setEditing(null);
      setFormError(null);
      await load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Couldn't save");
    }
  }

  async function removeHabit(habit: Habit, permanent: boolean) {
    const warning = permanent
      ? `Delete "${habit.name}" and every entry logged against it? This can't be undone.`
      : `Archive "${habit.name}"? It stops counting from today and its history is kept.`;
    if (!confirm(warning)) return;
    // Drop it locally first so the list doesn't sit there after you confirm.
    setView((v) =>
      v
        ? {
            ...v,
            habits: v.habits.filter((h) => h.id !== habit.id),
            progress: {
              ...v.progress,
              cells: v.progress.cells.filter((c) => c.habitId !== habit.id),
            },
          }
        : v,
    );
    await track(() => del(`/habits/${habit.id}${permanent ? "?permanent=1" : ""}`));
    load();
  }

  async function clearAll(category: "NON_NEGOTIABLE" | "OTHER") {
    const label = category === "NON_NEGOTIABLE" ? "non-negotiables" : "other habits";
    if (!confirm(`Clear all ${label}? They're archived, so past days keep their history.`)) return;
    await track(() => post("/habits/clear", { category, permanent: false }));
    load();
  }

  if (!view || !me) return <PageLoader />;

  const nonNegotiables = view.habits.filter((h) => h.category === "NON_NEGOTIABLE");
  const others = view.habits.filter((h) => h.category === "OTHER");
  const missed = nonNegotiables.filter((h) => {
    const c = cellFor(h.id);
    return c && c.state === "miss";
  });
  const dateLabel = new Date(`${view.date}T12:00:00Z`).toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "short",
  });

  const reflections = [
    ["whatWorked", "What worked"],
    ["whatBlocked", "What got in the way"],
    ["tomorrowOneThing", "Tomorrow's one thing"],
  ] as const;

  return (
    <div className="fade-up space-y-7">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="section-title text-2xl">My Discipline System</h1>
          <p className="mt-2 text-[13px] text-ink-faint">{dateLabel}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            data-coach="add-habit"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
            aria-label="Add habit"
            title="Add habit"
            className="grid h-9 w-9 place-items-center rounded-full border border-rule text-ink-soft transition-colors active:border-ink-faint"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
          </button>
          <span data-coach="ring">
            <Ring pct={view.progress.pct} label="today" />
          </span>
        </div>
      </header>

      {error && (
        <p className="rounded border border-accent bg-accent-soft px-3 py-2 text-[13px] text-accent">
          {error}
        </p>
      )}

      {/* --- Overall consistency rating ------------------------------------ */}
      <Ovr data={view.consistency} />

      {/* --- Morning: the three things ------------------------------------- */}
      {(mode === "morning" || mode === "day") && (
        <section className="card px-4 py-3">
          <h2 className="label-hand text-lg">The three things</h2>

          <ul className="mt-1 space-y-1">
            {view.todos.map((todo) => (
              <li key={todo.id} className="flex items-center gap-3 py-1">
                <Check
                  state={todo.done ? "complete" : "miss"}
                  size={22}
                  label={todo.text}
                  onClick={() => {
                    setView((v) =>
                      v
                        ? {
                            ...v,
                            todos: v.todos.map((t) =>
                              t.id === todo.id ? { ...t, done: !t.done } : t,
                            ),
                          }
                        : v,
                    );
                    track(() => patch(`/todos/${todo.id}`, { done: !todo.done }));
                  }}
                />
                <span
                  className="flex-1 text-[15px]"
                  style={{
                    color: todo.done ? "var(--ink-faint)" : "var(--ink)",
                    textDecoration: todo.done ? "line-through" : "none",
                  }}
                >
                  {todo.text}
                </span>
                {/* Rolled three times isn't a failure — it's a signal the task
                    was never a one-day job, or you're avoiding it. */}
                {todo.rollCount >= 3 && (
                  <span
                    className="rounded-full px-1.5 py-0.5 text-[10px]"
                    style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
                    title={`Carried ${todo.rollCount} days`}
                  >
                    {todo.rollCount}d
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setView((v) =>
                      v ? { ...v, todos: v.todos.filter((t) => t.id !== todo.id) } : v,
                    );
                    track(() => del(`/todos/${todo.id}`));
                  }}
                  className="px-1 text-ink-faint"
                  aria-label="Remove"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>

          {view.todos.length < 3 ? (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!newTodo.trim()) return;
                const text = newTodo.trim();
                setNewTodo("");
                await track(() => post("/todos", { date: view.date, text }));
              }}
            >
              <input
                value={newTodo}
                onChange={(e) => setNewTodo(e.target.value)}
                placeholder={`Add (${3 - view.todos.length} left)`}
                className="field mt-1 border-t border-dashed border-rule pt-2"
              />
            </form>
          ) : (
            <p className="mt-2 border-t border-dashed border-rule pt-2 text-[12px] text-ink-faint">
              Three is the limit. A list of twelve is a wish, not a plan.
            </p>
          )}
        </section>
      )}

      {/* --- Non-negotiables ---------------------------------------------- */}
      <section data-coach="habit-list">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="section-title">Daily non-negotiables</h2>
          {nonNegotiables.length > 0 && (
            <button
              type="button"
              onClick={() => clearAll("NON_NEGOTIABLE")}
              className="shrink-0 text-[11px] text-ink-faint underline decoration-dotted underline-offset-2"
            >
              clear all
            </button>
          )}
        </div>

        {nonNegotiables.length === 0 ? (
          <EmptyHabits
            onAdd={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          />
        ) : (
          <ul className="mt-3">
            {nonNegotiables.map((habit) => {
              const cell = cellFor(habit.id);
              if (!cell) return null;
              return (
                <HabitRow
                  key={habit.id}
                  habit={habit}
                  cell={cell}
                  streak={view.streaks[habit.id]}
                  weightMultiplier={me.nonNegotiableWeight}
                  onSet={(v) => setEntry(habit, v)}
                  onClear={() => clearEntryFor(habit)}
                  onMenu={(x, y) => setMenu({ habit, x, y })}
                  pendingResolve={habit.resolveWindow === "NEXT_MORNING" && mode !== "morning"}
                />
              );
            })}
          </ul>
        )}
      </section>

      {/* --- Other habits -------------------------------------------------- */}
      {others.length > 0 && (
        <section>
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="section-title">Other habits</h2>
            <button
              type="button"
              onClick={() => clearAll("OTHER")}
              className="shrink-0 text-[11px] text-ink-faint underline decoration-dotted underline-offset-2"
            >
              clear all
            </button>
          </div>
          <p className="mt-1.5 text-[11px] text-ink-faint">Worth a single point each.</p>
          <ul className="mt-2">
            {others.map((habit) => {
              const cell = cellFor(habit.id);
              if (!cell) return null;
              return (
                <HabitRow
                  key={habit.id}
                  habit={habit}
                  cell={cell}
                  streak={view.streaks[habit.id]}
                  onSet={(v) => setEntry(habit, v)}
                  onClear={() => clearEntryFor(habit)}
                  onMenu={(x, y) => setMenu({ habit, x, y })}
                />
              );
            })}
          </ul>
        </section>
      )}

      {/* --- Evening: the behavioural layer -------------------------------- */}
      <section className="card px-4 py-3" data-coach="closeout">
        <div className="flex items-center justify-between pb-1">
          <h2 className="label-hand text-lg">Close out the day</h2>
          {mode !== "evening" && (
            <span className="text-[11px] uppercase tracking-wide text-ink-faint">from 8pm</span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 border-b border-dashed border-rule pb-4 pt-1">
          {(["energy", "mood"] as const).map((key) => (
            <div key={key}>
              <span className="label-hand text-sm capitalize">{key}</span>
              <div className="mt-1.5 flex gap-1.5">
                {SCALE.map((n) => {
                  const active = view.day?.[key] === n;
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => {
                        const next = active ? null : n;
                        setView((v) =>
                          v
                            ? {
                                ...v,
                                day: {
                                  intention: null,
                                  energy: null,
                                  mood: null,
                                  whatWorked: null,
                                  whatBlocked: null,
                                  tomorrowOneThing: null,
                                  notes: null,
                                  ...(v.day ?? {}),
                                  [key]: next,
                                },
                              }
                            : v,
                        );
                        track(() => patch(`/days/${view.date}`, { [key]: next }));
                      }}
                      className="h-8 flex-1 rounded border text-[13px] tabular-nums transition-colors"
                      style={{
                        borderColor: active ? "var(--ink)" : "var(--rule)",
                        background: active ? "var(--ink)" : "transparent",
                        color: active ? "var(--paper)" : "var(--ink-faint)",
                      }}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Why you missed is the only data a checkbox can't give you. */}
        {missed.length > 0 && (
          <Disclosure
            title="Why you missed these"
            hint={`${missed.length} missed`}
            defaultOpen={mode === "evening"}
          >
            <ul className="space-y-2">
              {missed.map((habit) => {
                const cell = cellFor(habit.id);
                return (
                  <li key={habit.id} className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-[13px] text-ink-soft">
                      {habit.name}
                    </span>
                    <select
                      value={cell?.missReason ?? ""}
                      onChange={(e) => e.target.value && setEntry(habit, 0, e.target.value)}
                      className="shrink-0 rounded border border-rule bg-transparent px-2 py-1 text-[12px] text-ink-soft outline-none"
                    >
                      <option value="">Why…</option>
                      {MISS_REASONS.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </li>
                );
              })}
            </ul>
          </Disclosure>
        )}

        {reflections.map(([key, label]) => (
          <Disclosure
            key={key}
            title={label}
            hint={view.day?.[key] ? "written" : undefined}
            defaultOpen={mode === "evening" && !!view.day?.[key]}
          >
            <textarea
              defaultValue={view.day?.[key] ?? ""}
              onChange={(e) => saveDay({ [key]: e.target.value })}
              rows={2}
              placeholder="…"
              className="field"
            />
          </Disclosure>
        ))}
      </section>

      <SignOff />

      {menu && (
        <ActionMenu
          at={{ x: menu.x, y: menu.y }}
          title={menu.habit.name}
          onClose={() => setMenu(null)}
          actions={[
            {
              label: "Edit habit",
              onSelect: () => {
                setEditing(menu.habit);
                setFormOpen(true);
              },
            },
            { label: "Archive (keep history)", onSelect: () => removeHabit(menu.habit, false) },
            { label: "Delete permanently", danger: true, onSelect: () => removeHabit(menu.habit, true) },
          ]}
        />
      )}

      {formOpen && (
        <HabitForm
          habit={editing ?? undefined}
          onSubmit={submitHabit}
          onCancel={() => {
            setFormOpen(false);
            setEditing(null);
            setFormError(null);
          }}
          error={formError}
        />
      )}

      <Coachmarks id="today" steps={COACH} ready={!!view} />
    </div>
  );
}

function EmptyHabits({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="mt-3 rounded-lg border border-dashed border-rule px-4 py-6 text-center">
      <p className="text-[14px] text-ink-soft">No non-negotiables yet.</p>
      <p className="mt-1 text-[12px] text-ink-faint">
        Start with two or three you can actually hold every day.
      </p>
      <button
        type="button"
        onClick={onAdd}
        className="mt-3 rounded bg-ink px-4 py-2 text-[14px] text-paper"
      >
        Add your first
      </button>
    </div>
  );
}
