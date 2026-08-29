"use client";

import { useCallback, useEffect, useState } from "react";
import Coachmarks, { type CoachStep } from "@/components/Coachmarks";
import { PageLoader } from "@/components/loader";
import { del, get, post, put } from "@/lib/api";
import { ApiError } from "@/lib/api";
import { recall, remember } from "@/lib/cache";
import type { PaceStatus, WeekView } from "@/lib/types";

const COACH: CoachStep[] = [
  {
    target: "week-target",
    title: "Small ratchets, not leaps",
    body: "The suggested number is your 4-week average plus a few points. Jumping 51% to 90% is exactly how week one fails, so anything above +10 makes you acknowledge a warning first.",
  },
  {
    target: "week-days",
    title: "Counts beat percentages",
    body: "Once a target is set you'll be told how many of the remaining checks you still need. If it becomes unreachable the app says so and offers a lower number — rebaselining down is a real move, not a failure.",
  },
];

const COPY: Record<PaceStatus, { label: string; tone: string }> = {
  SECURED: { label: "Locked in", tone: "var(--good)" },
  AHEAD: { label: "Ahead of pace", tone: "var(--good)" },
  ON_PACE: { label: "On pace", tone: "var(--ink)" },
  BEHIND: { label: "Behind pace", tone: "var(--accent)" },
  CRITICAL: { label: "Near-perfect from here", tone: "var(--accent)" },
  IMPOSSIBLE: { label: "Out of reach", tone: "var(--accent)" },
};

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function WeekPage() {
  // Seeded from the last render of this page so a turn lands on real content
  // rather than the loader. The fetch below still runs and corrects it.
  const [view, setView] = useState<WeekView | null>(() => recall<WeekView>("view:week"));
  const [draft, setDraft] = useState<number | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [today, setToday] = useState("");

  const load = useCallback(async () => {
    const [w, me] = await Promise.all([
      get<WeekView>("/views/week"),
      get<{ today: string }>("/auth/me"),
    ]);
    setView(remember("view:week", w));
    setToday(me.today);
    setDraft((d) => d ?? w.suggestedTarget);
  }, []);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  async function setTarget(pct: number, acknowledgeWarning = false) {
    if (!view) return;
    try {
      const res = await put<{ warning: string | null }>(`/week/${view.weekStart}`, {
        targetPct: pct,
        acknowledgeWarning,
      });
      setWarning(res.warning);
      await load();
    } catch (e) {
      if (e instanceof ApiError && e.body?.error === "TARGET_TOO_AGGRESSIVE") {
        setWarning(String(e.body.warning));
      }
    }
  }

  if (!view) return <PageLoader />;

  const t = view.target;
  const progressToTarget = t ? Math.min(100, (view.doneChecks / Math.max(1, view.doneChecks + t.neededChecks)) * 100) : 0;

  return (
    <div className="fade-up space-y-7">
      <header>
        <h1 className="section-title text-2xl">This week</h1>
        <p className="mt-2 text-[13px] text-ink-faint">
          Week of {new Date(`${view.weekStart}T12:00:00Z`).toLocaleDateString(undefined, { day: "numeric", month: "long" })}
          {" · "}4-week average {view.baselinePct}%
        </p>
      </header>

      {/* --- The commitment ------------------------------------------------ */}
      {!t ? (
        <section className="card space-y-4 px-4 py-4" data-coach="week-target">
          <h2 className="label-hand text-lg">Set this week&apos;s target</h2>
          <p className="text-[13px] leading-relaxed text-ink-soft">
            You&apos;re averaging <strong className="tabular-nums">{view.baselinePct}%</strong>. Small
            ratchets compound; big ones break in week one.
          </p>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={100}
              step={0.5}
              value={draft ?? view.suggestedTarget}
              onChange={(e) => setDraft(Number(e.target.value))}
              className="flex-1 accent-[var(--accent)]"
            />
            <span className="w-16 text-right text-xl font-semibold tabular-nums">
              {(draft ?? view.suggestedTarget).toFixed(1)}%
            </span>
          </div>
          {warning && <p className="text-[13px] leading-relaxed text-accent">{warning}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setTarget(draft ?? view.suggestedTarget, warning !== null)}
              className="flex-1 rounded bg-ink py-2.5 text-[15px] text-paper"
            >
              {warning ? "Set it anyway" : "Commit"}
            </button>
            {warning && (
              <button
                type="button"
                onClick={() => {
                  setDraft(view.suggestedTarget);
                  setWarning(null);
                }}
                className="rounded border border-rule px-4 text-[14px] text-ink-soft"
              >
                Use {view.suggestedTarget}%
              </button>
            )}
          </div>
        </section>
      ) : (
        <section className="card space-y-4 px-4 py-4" data-coach="week-target">
          <div className="flex items-baseline justify-between">
            <span className="text-[22px] font-semibold tabular-nums" style={{ color: COPY[t.status].tone }}>
              {COPY[t.status].label}
            </span>
            <span className="text-[13px] text-ink-faint">target {t.targetPct}%</span>
          </div>

          {/* Counts, not percentages. "9 of 11" has a finish line. */}
          <p className="text-[17px] leading-relaxed text-ink">
            {t.status === "SECURED" ? (
              <>Target banked. Everything from here is upside.</>
            ) : t.status === "IMPOSSIBLE" ? (
              <>
                {t.targetPct}% can&apos;t be reached with {t.remainingChecks} left. Best possible is{" "}
                <strong className="tabular-nums">{view.ceilingPct}%</strong>.
              </>
            ) : (
              <>
                You need <strong className="tabular-nums">{t.neededChecks}</strong> of the remaining{" "}
                <strong className="tabular-nums">{t.remainingChecks}</strong>.
              </>
            )}
          </p>

          <div className="h-2 overflow-hidden rounded-full bg-rule">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${progressToTarget}%`, background: COPY[t.status].tone }}
            />
          </div>

          <dl className="grid grid-cols-3 gap-2 text-center">
            {[
              ["Ticked", `${view.doneChecks}/${view.totalChecks}`],
              ["If you stop", `${view.floorPct}%`],
              ["Best case", `${view.ceilingPct}%`],
            ].map(([k, v]) => (
              <div key={k} className="rounded border border-rule py-2">
                <dt className="text-[10px] uppercase tracking-wide text-ink-faint">{k}</dt>
                <dd className="mt-0.5 text-[15px] font-medium tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>

          {/* A target that only ratchets up eventually guarantees failure. */}
          {t.rebaselineSuggestion !== null && (
            <button
              type="button"
              onClick={async () => {
                await post(`/week/${view.weekStart}/rebaseline`, {
                  targetPct: t.rebaselineSuggestion,
                });
                load();
              }}
              className="w-full rounded border border-rule py-2.5 text-[14px] text-ink-soft"
            >
              Rebaseline to {t.rebaselineSuggestion}% — still a good week
            </button>
          )}

          <button
            type="button"
            onClick={async () => {
              await del(`/week/${view.weekStart}`);
              setWarning(null);
              load();
            }}
            className="w-full text-[12px] text-ink-faint"
          >
            Clear target
          </button>
        </section>
      )}

      {/* --- Day strip ------------------------------------------------------ */}
      <section data-coach="week-days">
        <h2 className="section-title">Day by day</h2>
        <ul className="mt-4 flex items-end justify-between gap-1.5">
          {view.days.map((day, i) => {
            const future = day.date > today;
            const height = Math.max(4, (day.pct / 100) * 72);
            return (
              <li key={day.date} className="flex flex-1 flex-col items-center gap-1.5">
                <span className="text-[10px] tabular-nums text-ink-faint">
                  {day.weightedTotal > 0 && !future ? Math.round(day.pct) : ""}
                </span>
                <div className="flex h-[72px] w-full items-end">
                  <div
                    className="w-full rounded-t transition-all duration-500"
                    style={{
                      height,
                      background: future
                        ? "var(--rule)"
                        : day.pct >= 80
                          ? "var(--good)"
                          : day.pct >= 50
                            ? "var(--ink-soft)"
                            : "var(--accent)",
                      opacity: future ? 0.5 : 1,
                    }}
                  />
                </div>
                <span
                  className="text-[10px]"
                  style={{ color: day.date === today ? "var(--ink)" : "var(--ink-faint)" }}
                >
                  {DOW[i]}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <Coachmarks id="week" steps={COACH} ready={!!view} />
    </div>
  );
}
