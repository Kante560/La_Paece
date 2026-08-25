"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Portal from "./Portal";

export interface MenuAction {
  label: string;
  onSelect: () => void;
  /** Renders in the accent colour and confirms before firing. */
  danger?: boolean;
}

interface Props {
  /** Viewport coordinates to anchor at, or null when closed. */
  at: { x: number; y: number } | null;
  title?: string;
  actions: MenuAction[];
  onClose: () => void;
}

const MARGIN = 8;

/**
 * The menu behind a long-press / right-click. Anchored to the press point and
 * clamped into the viewport, so a press near the bottom edge doesn't open a
 * menu you have to scroll to reach.
 */
export default function ActionMenu({ at, title, actions, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  useLayoutEffect(() => {
    if (!at || !ref.current) return;
    const { width, height } = ref.current.getBoundingClientRect();
    setPos({
      x: Math.min(Math.max(MARGIN, at.x), window.innerWidth - width - MARGIN),
      y: Math.min(Math.max(MARGIN, at.y), window.innerHeight - height - MARGIN),
    });
  }, [at]);

  useEffect(() => {
    if (!at) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    // `true` so it fires before the row's own handlers.
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown, true);
    };
  }, [at, onClose]);

  if (!at) return null;

  return (
    <Portal>
      <div className="fixed inset-0 z-40" aria-hidden="true" />
      <div
        ref={ref}
        role="menu"
        aria-label={title}
        className="card fade-up fixed z-50 min-w-[168px] overflow-hidden py-1"
        style={{ left: pos.x, top: pos.y, boxShadow: "0 8px 24px var(--shadow)" }}
      >
        {title && (
          <p className="truncate border-b border-rule px-3 pb-1.5 pt-1 text-[11px] uppercase tracking-wide text-ink-faint">
            {title}
          </p>
        )}
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            role="menuitem"
            onClick={() => {
              onClose();
              action.onSelect();
            }}
            className="block w-full px-3 py-2 text-left text-[14px] transition-colors hover:bg-paper"
            style={{ color: action.danger ? "var(--accent)" : "var(--ink)" }}
          >
            {action.label}
          </button>
        ))}
      </div>
    </Portal>
  );
}
