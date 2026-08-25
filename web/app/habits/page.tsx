"use client";

import { useCallback, useEffect, useState } from "react";
import ActionMenu from "@/components/ActionMenu";
import Coachmarks, { type CoachStep } from "@/components/Coachmarks";
import HabitForm, { DOW, type HabitDraft } from "@/components/HabitForm";
import { PageLoader } from "@/components/loader";
import { del, get, patch, post } from "@/lib/api";
import { useLongPress } from "@/lib/useLongPress";
import type { Habit, HabitCategory } from "@/lib/types";

const COACH: CoachStep[] = [
  {
    target: "habit-manage",
    title: "Schedule, don't just list",
    body: "Tap the weekday letters to pick which days a habit is due. Days it isn't scheduled show a dash and are left out of the maths — a rest day is not a failed workout.",
  },
  {
    target: "habit-new",
    title: "Archive beats delete",
    body: "Archiving stops a habit counting from today and keeps its history intact. Permanent delete throws the entries away too — right-click or long-press a habit for both.",
  },
];

export default function HabitsPage() {
  const [habits, setHabits] = useState<Habit[] | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Habit | null>(null);
  const [addCategory, setAddCategory] = useState<HabitCategory>("NON_NEGOTIABLE");
  const [menu, setMenu] = useState<{ habit: Habit; x: number; y: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setHabits((await get<Habit[]>("/habits")).filter((h) => !h.archivedAt));
  }, []);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

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
      setError(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save");
    }
  }

  async function removeHabit(habit: Habit, permanent: boolean) {
    const warning = permanent
      ? `Delete "${habit.name}" and every entry logged against it? This can't be undone.`
      : `Archive "${habit.name}"? It stops counting from today and its history is kept.`;
    if (!confirm(warning)) return;
    setHabits((hs) => hs?.filter((h) => h.id !== habit.id) ?? hs);
    await del(`/habits/${habit.id}${permanent ? "?permanent=1" : ""}`);
    load();
  }

  async function clearAll(category: HabitCategory) {
    const label = category === "NON_NEGOTIABLE" ? "non-negotiables" : "other habits";
    if (!confirm(`Clear all ${label}? They're archived, so past days keep their history.`)) return;
    setHabits((hs) => hs?.filter((h) => h.category !== category) ?? hs);
    await post("/habits/clear", { category, permanent: false });
    load();
  }

  async function toggleDay(habit: Habit, n: number) {
    const next = habit.scheduleDays.includes(n)
      ? habit.scheduleDays.filter((d) => d !== n)
      : [...habit.scheduleDays, n].sort();
    if (next.length === 0) return;
    // Repaint immediately; the request is just persistence.
    setHabits((hs) =>
      hs?.map((h) => (h.id === habit.id ? { ...h, scheduleDays: next } : h)) ?? hs,
    );
    await patch(`/habits/${habit.id}`, { scheduleDays: next });
  }

  if (!habits) return <PageLoader />;

  return (
    <div className="fade-up space-y-7">
      <header>
        <h1 className="section-title text-2xl">Habits</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-faint">
          New habits start counting today — never as retroactive misses on days before they existed.
        </p>
      </header>

      {error && (
        <p className="rounded border border-accent bg-accent-soft px-3 py-2 text-[13px] text-accent">
          {error}
        </p>
      )}

      {(["NON_NEGOTIABLE", "OTHER"] as const).map((cat) => {
        const inCat = habits.filter((h) => h.category === cat);
        return (
          <section key={cat} data-coach={cat === "NON_NEGOTIABLE" ? "habit-manage" : undefined}>
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="section-title text-lg">
                {cat === "NON_NEGOTIABLE" ? "Non-negotiables" : "Other habits"}
              </h2>
              <div className="flex shrink-0 items-center gap-3">
                {inCat.length > 0 && (
                  <button
                    type="button"
                    onClick={() => clearAll(cat)}
                    className="text-[11px] text-ink-faint underline decoration-dotted underline-offset-2"
                  >
                    clear all
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setEditing(null);
                    setAddCategory(cat);
                    setFormOpen(true);
                  }}
                  aria-label={`Add ${cat === "NON_NEGOTIABLE" ? "non-negotiable" : "other habit"}`}
                  className="grid h-7 w-7 place-items-center rounded-full border border-rule text-ink-soft"
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path
                      d="M8 3v10M3 8h10"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </div>
            </div>

            {inCat.length === 0 ? (
              <p className="mt-3 rounded-lg border border-dashed border-rule px-4 py-5 text-center text-[13px] text-ink-faint">
                Nothing here yet.
              </p>
            ) : (
              <ul className="mt-3 space-y-3">
                {inCat.map((habit) => (
                  <HabitCard
                    key={habit.id}
                    habit={habit}
                    onToggleDay={(n) => toggleDay(habit, n)}
                    onRename={(name) => {
                      setHabits((hs) =>
                        hs?.map((h) => (h.id === habit.id ? { ...h, name } : h)) ?? hs,
                      );
                      patch(`/habits/${habit.id}`, { name });
                    }}
                    onMenu={(x, y) => setMenu({ habit, x, y })}
                  />
                ))}
              </ul>
            )}
          </section>
        );
      })}

      <button
        type="button"
        data-coach="habit-new"
        onClick={() => {
          setEditing(null);
          setAddCategory("NON_NEGOTIABLE");
          setFormOpen(true);
        }}
        className="w-full rounded border border-dashed border-rule py-3 text-[14px] text-ink-faint"
      >
        + New habit
      </button>

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
            {
              label: "Delete permanently",
              danger: true,
              onSelect: () => removeHabit(menu.habit, true),
            },
          ]}
        />
      )}

      {formOpen && (
        <HabitForm
          habit={editing ?? undefined}
          initialCategory={addCategory}
          onSubmit={submitHabit}
          onCancel={() => {
            setFormOpen(false);
            setEditing(null);
            setError(null);
          }}
          error={error}
        />
      )}

      <Coachmarks id="habits" steps={COACH} ready={!!habits} />
    </div>
  );
}

function HabitCard({
  habit,
  onToggleDay,
  onRename,
  onMenu,
}: {
  habit: Habit;
  onToggleDay: (n: number) => void;
  onRename: (name: string) => void;
  onMenu: (x: number, y: number) => void;
}) {
  const longPress = useLongPress(onMenu);

  return (
    <li className="card px-3 py-2.5" {...longPress}>
      <div className="flex items-center gap-2">
        <input
          defaultValue={habit.name}
          onBlur={(e) => {
            const next = e.target.value.trim();
            if (next && next !== habit.name) onRename(next);
            else e.target.value = habit.name;
          }}
          className="min-w-0 flex-1 bg-transparent text-[15px] outline-none"
        />
        {habit.type === "QUANTITY" && (
          <span className="shrink-0 text-[12px] tabular-nums text-ink-faint">
            {habit.target} {habit.unit}
          </span>
        )}
        <button
          type="button"
          onClick={(e) => onMenu(e.clientX, e.clientY)}
          aria-label={`Options for ${habit.name}`}
          className="shrink-0 px-1 text-[16px] leading-none text-ink-faint"
        >
          ⋯
        </button>
      </div>

      <div className="mt-2 flex items-center gap-1">
        {DOW.map((d) => {
          const on = habit.scheduleDays.includes(d.n);
          return (
            <button
              key={d.n}
              type="button"
              onClick={() => onToggleDay(d.n)}
              className="h-6 w-6 rounded text-[11px] transition-colors"
              style={{
                background: on ? "var(--ink)" : "transparent",
                color: on ? "var(--paper)" : "var(--ink-faint)",
                border: `1px solid ${on ? "var(--ink)" : "var(--rule)"}`,
              }}
            >
              {d.l}
            </button>
          );
        })}
        <span className="ml-1 text-[11px] text-ink-faint">
          {habit.scheduleDays.length === 7 ? "every day" : `${habit.scheduleDays.length}×/wk`}
        </span>
      </div>
    </li>
  );
}
