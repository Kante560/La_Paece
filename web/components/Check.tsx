"use client";

import type { CellState } from "@/lib/types";

interface Props {
  state: CellState;
  onClick?: () => void;
  size?: number;
  label?: string;
  disabled?: boolean;
  /**
   * "primary" is a weighted non-negotiable — a hard-edged box that carries the
   * day's number. "secondary" is a bonus habit worth a single point, drawn as a
   * lighter circle so the two can never be mistaken for equal marks on a page
   * where one is worth double the other.
   */
  variant?: "primary" | "secondary";
  /** Spread long-press / right-click handlers onto the control. */
  handlers?: Record<string, unknown>;
}

/**
 * The one place worth spending craft: you'll see this ten times a day.
 * The stroke draws itself on in 220ms — enough to register as a small reward,
 * short enough never to feel like waiting.
 */
export default function Check({
  state,
  onClick,
  size,
  label,
  disabled,
  variant = "primary",
  handlers,
}: Props) {
  const done = state === "complete";
  const partial = state === "partial";
  const secondary = variant === "secondary";
  const box = size ?? (secondary ? 22 : 26);
  const tint = secondary ? "var(--ink-soft)" : "var(--good)";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={done}
      aria-label={label}
      className="grid shrink-0 select-none place-items-center border transition-colors disabled:opacity-40"
      style={{
        width: box,
        height: box,
        // A circle can't be confused with the weighted box next to it.
        borderRadius: secondary ? 999 : 5,
        borderWidth: secondary ? 1 : 1.5,
        borderColor: done ? tint : partial ? "var(--accent)" : "var(--rule)",
        background: done ? `color-mix(in srgb, ${tint} 12%, transparent)` : "transparent",
        touchAction: "manipulation",
        WebkitTouchCallout: "none",
      }}
      {...handlers}
    >
      {done && (
        <svg width={box * 0.68} height={box * 0.68} viewBox="0 0 24 24" fill="none">
          <path
            key="checked"
            className="check-path"
            d="M4.5 12.5 L9.5 18 L19.5 6"
            stroke={tint}
            strokeWidth={secondary ? 2.2 : 2.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
      {partial && (
        <span className="block h-[2.5px] w-1/2 rounded-full" style={{ background: "var(--accent)" }} />
      )}
    </button>
  );
}
