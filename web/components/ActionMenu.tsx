"use client";

import { useEffect, useLayoutEffect, useState } from "react";
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
  /*
   * A state-backed callback ref, not useRef.
   *
   * Portal gates its children behind a mounted flag so it never touches
   * `document` during SSR, which means the menu's own node does not exist on
   * the render where `at` first becomes non-null. A useRef + `[at]` effect
   * therefore measured `null`, bailed out, and never ran again once the node
   * did appear — leaving the menu pinned at its initial 0,0 in the top-left
   * corner. Keying the measurement on the node itself makes it run the moment
   * the element attaches, whenever that turns out to be.
   */
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  /*
   * Depend on the coordinates, not the `at` object. Callers build it inline, so
   * its identity changes on every parent render and an `[at]` dependency would
   * re-measure on renders where nothing actually moved.
   */
  const ax = at?.x ?? null;
  const ay = at?.y ?? null;

  useLayoutEffect(() => {
    if (ax === null || ay === null || !el) return;
    const { width, height } = el.getBoundingClientRect();
    setPos({
      x: Math.min(Math.max(MARGIN, ax), window.innerWidth - width - MARGIN),
      y: Math.min(Math.max(MARGIN, ay), window.innerHeight - height - MARGIN),
    });
  }, [ax, ay, el]);

  useEffect(() => {
    if (!at) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    // `true` so it fires before the row's own handlers.
    const onDown = (e: PointerEvent) => {
      if (el && !el.contains(e.target as Node)) onClose();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown, true);
    };
  }, [at, el, onClose]);

  if (!at) return null;

  return (
    <Portal>
      <div className="fixed inset-0 z-40" aria-hidden="true" />
      <div
        ref={setEl}
        role="menu"
        aria-label={title}
        className="card fade-up fixed z-50 min-w-[168px] overflow-hidden py-1"
        style={{
          left: pos?.x ?? at.x,
          top: pos?.y ?? at.y,
          // Laid out but not painted until measured, so the clamp never shows its work.
          visibility: pos ? "visible" : "hidden",
          boxShadow: "0 8px 24px var(--shadow)",
        }}
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
