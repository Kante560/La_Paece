"use client";

import { useEffect, useState } from "react";
import type { Consistency } from "@/lib/types";

/**
 * Named tiers, because "68" on its own is just a number.
 *
 * The bands are deliberately generous below 60 and tight above 85: the
 * difference between 40% and 55% is noise you shouldn't be graded on, while
 * the difference between 88% and 94% is the part that's actually hard.
 */
const TIERS = [
  { min: 93, name: "Relentless", tone: "good" },
  { min: 85, name: "Elite", tone: "good" },
  { min: 75, name: "Strong", tone: "good" },
  { min: 65, name: "Solid", tone: "ink" },
  { min: 50, name: "Steady", tone: "ink" },
  { min: 30, name: "Shaky", tone: "accent" },
  { min: 0, name: "Rebuilding", tone: "accent" },
] as const;

function tierFor(ovr: number) {
  return TIERS.find((t) => ovr >= t.min) ?? TIERS[TIERS.length - 1];
}

const TONE: Record<string, string> = {
  good: "var(--good)",
  ink: "var(--ink)",
  accent: "var(--accent)",
};

/*
 * Dev-only preview hook.
 *
 * The real rating deliberately stays blank until a day has finished, which
 * makes the card impossible to judge on the day you build it. `?ovr=78` fakes
 * a value so the design can be reviewed immediately; `&delta=-4&days=21` fill
 * in the trend chip and the caption, and `?ovr=none` forces the empty state.
 *
 * The NODE_ENV check is a build-time literal, so none of this survives a
 * production build — there is no route by which a real rating can be faked.
 */
function usePreviewOverride(): Consistency | null {
  const [preview, setPreview] = useState<Consistency | null>(null);

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const q = new URLSearchParams(window.location.search);
    const raw = q.get("ovr");
    if (raw === null) return;
    setPreview({
      ovr: raw === "" || raw === "none" ? null : Number(raw),
      delta: q.has("delta") ? Number(q.get("delta")) : null,
      daysCounted: Number(q.get("days") ?? 30),
      windowDays: 30,
    });
  }, []);

  return preview;
}

/**
 * The box drawn round the rating.
 *
 * A CSS dashed border is metronomic — every dash and every gap identical, which
 * reads as printed. A long, uneven dash pattern with round caps reads as a box
 * someone ringed round the number by hand instead.
 *
 * Deliberately no viewBox: one user unit is then one CSS pixel, so the edges
 * stay level and the corners stay circular whatever shape the card takes. An
 * earlier version stretched a square viewBox to fit, which sheared the corners
 * into ellipses and tilted every edge.
 */
function HandBox({ color }: { color: string }) {
  return (
    <svg className="hand-box" style={{ color }} aria-hidden="true">
      <rect x="0" y="0" width="100%" height="100%" rx="12" />
    </svg>
  );
}

export default function Ovr({ data: real }: { data: Consistency }) {
  const preview = usePreviewOverride();
  const data = preview ?? real;

  /*
   * No rating until there's a finished day behind it. Showing "0" to someone on
   * their first morning is both wrong and the single most discouraging thing
   * this screen could say — they haven't failed at anything yet.
   */
  if (data.ovr === null) {
    return (
      <section className="relative px-4 py-5">
        <HandBox color="var(--ink-faint)" />
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[11px] uppercase tracking-[0.18em] text-ink-faint">
            Consistency
          </span>
        </div>
        <div className="mt-2 flex items-end gap-3">
          <span className="text-[64px] font-semibold leading-none text-ink-faint">—</span>
          <span className="label-hand pb-2 text-lg">No rating yet</span>
        </div>
        <p className="mt-3 border-t border-dashed border-rule pt-2 text-[12px] text-ink-faint">
          Your rating appears after your first full day. Today doesn&apos;t count until it&apos;s over.
        </p>
      </section>
    );
  }

  const tier = tierFor(data.ovr);
  const color = TONE[tier.tone];
  const up = data.delta !== null && data.delta > 0;
  const flat = data.delta === 0;

  return (
    /*
     * No fill, no shadow — a dashed rule in the tier's own colour, so the card
     * reads as something ruled onto the page rather than laid on top of it.
     */
    <section className="relative px-4 py-5">
      <HandBox color={color} />
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[11px] uppercase tracking-[0.18em] text-ink-faint">Consistency</span>
        {data.delta !== null && (
          <span
            className="text-[12px] font-medium tabular-nums"
            style={{ color: flat ? "var(--ink-faint)" : up ? "var(--good)" : "var(--accent)" }}
            title={`Against the previous ${data.windowDays} days`}
          >
            {flat ? "—" : `${up ? "▲" : "▼"} ${Math.abs(data.delta)}`}
          </span>
        )}
      </div>

      <div className="mt-2 flex items-end gap-3">
        <span
          className="text-[64px] font-semibold leading-[0.85] tabular-nums"
          style={{ color }}
          aria-label={`Overall consistency ${data.ovr} out of 100`}
        >
          {data.ovr}
        </span>
        <div className="pb-1.5">
          <div className="text-[10px] uppercase tracking-[0.2em] text-ink-faint">OVR</div>
          <div className="label-hand text-xl" style={{ color }}>
            {tier.name}
          </div>
        </div>
      </div>

      {/* A bar rather than a ring — the ring in the header is today, this is the trend. */}
      <div className="mt-4 h-1.5 overflow-hidden rounded-full" style={{ background: "var(--rule)" }}>
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.max(0, Math.min(100, data.ovr))}%`,
            background: color,
            transition: "width 450ms cubic-bezier(.22,1,.36,1)",
          }}
        />
      </div>

      <p className="mt-2 text-[12px] text-ink-faint">
        Last {data.windowDays} days · {data.daysCounted}{" "}
        {data.daysCounted === 1 ? "day" : "days"} rated
      </p>
    </section>
  );
}
