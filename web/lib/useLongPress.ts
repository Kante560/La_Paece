"use client";

import { useCallback, useRef } from "react";

const HOLD_MS = 480;
const SLOP_PX = 10;
/** Breathing room between the control and the menu's edge. */
const GAP_PX = 6;

/**
 * Anchor beside the control that was pressed, not at the raw pointer point.
 *
 * On touch the fingertip is the one place the menu must not open — it's covered
 * by the hand that opened it, and a 480ms hold drifts a few pixels anyway, so
 * pointer coordinates put the menu in a slightly different spot every time.
 * Measuring the control instead lands it in the same place on every press, and
 * ActionMenu's clamp pulls it back inside the viewport near an edge.
 */
function anchorOf(el: HTMLElement): { x: number; y: number } {
  const r = el.getBoundingClientRect();
  return { x: r.right + GAP_PX, y: r.top };
}

/**
 * Long-press on touch, right-click on desktop — both open the same menu.
 *
 * The habit list is the densest surface in the app and it's tapped ten times a
 * day, so it can't afford a permanent "⋯" on every row: the affordance would
 * outweigh the thing it manages. Hiding edit/delete behind a press keeps the
 * list a list, and both gestures are the platform-native "more options" idiom.
 *
 * Returns handlers to spread onto the trigger. `onTrigger` receives the viewport
 * point to anchor the menu at — just off the control's top-right corner.
 */
export function useLongPress(onTrigger: (x: number, y: number) => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  // Set when a hold fires, so the click that follows the release is swallowed
  // instead of also toggling the habit.
  const fired = useRef(false);

  const clear = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    origin.current = null;
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Mouse right-click is handled by onContextMenu; only arm on touch/pen
      // and primary mouse button.
      if (e.pointerType === "mouse" && e.button !== 0) return;
      fired.current = false;
      origin.current = { x: e.clientX, y: e.clientY };
      // Read the element now: React clears currentTarget once the handler returns,
      // and this is used a good half-second later.
      const target = e.currentTarget as HTMLElement;
      timer.current = setTimeout(() => {
        fired.current = true;
        const { x, y } = anchorOf(target);
        onTrigger(x, y);
      }, HOLD_MS);
    },
    [onTrigger],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!origin.current) return;
      const dx = Math.abs(e.clientX - origin.current.x);
      const dy = Math.abs(e.clientY - origin.current.y);
      // A scroll is not a hold.
      if (dx > SLOP_PX || dy > SLOP_PX) clear();
    },
    [clear],
  );

  const onContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      clear();
      fired.current = true;
      const { x, y } = anchorOf(e.currentTarget as HTMLElement);
      onTrigger(x, y);
    },
    [clear, onTrigger],
  );

  const onClickCapture = useCallback((e: React.MouseEvent) => {
    if (!fired.current) return;
    // Swallow the click synthesised at the end of a long press.
    e.preventDefault();
    e.stopPropagation();
    fired.current = false;
  }, []);

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: clear,
    onPointerCancel: clear,
    onPointerLeave: clear,
    onContextMenu,
    onClickCapture,
  };
}
