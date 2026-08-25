"use client";

import { useId, useState, type ReactNode } from "react";

interface Props {
  title: string;
  /** Right-aligned hint — a count, a status, "3 missed". */
  hint?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}

/**
 * A collapsed section.
 *
 * The evening review has four separate prompts and a reason picker per missed
 * habit. Laid out flat that's a wall you scroll past instead of filling in;
 * collapsed, each one is a decision you opt into.
 */
export default function Disclosure({ title, hint, defaultOpen = false, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();

  return (
    <div className="border-b border-dashed border-rule last:border-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={id}
        className="flex w-full items-center gap-2 py-2.5 text-left"
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          aria-hidden="true"
          className="shrink-0 transition-transform duration-200"
          style={{ transform: open ? "rotate(90deg)" : "none" }}
        >
          <path
            d="M3 1.5 7 5 3 8.5"
            stroke="var(--ink-faint)"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="label-hand flex-1 text-[15px]">{title}</span>
        {hint && <span className="shrink-0 text-[11px] text-ink-faint">{hint}</span>}
      </button>

      {open && (
        <div id={id} className="fade-up pb-3 pl-[18px]">
          {children}
        </div>
      )}
    </div>
  );
}
