"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Renders children at <body>, outside the page tree.
 *
 * Every screen's root carries `.fade-up`, whose keyframes end on a `transform`
 * with fill-mode `both` — so the transform sticks around after the animation.
 * A transformed ancestor becomes the containing block for `position: fixed`
 * descendants, which silently re-anchors any overlay to the centred `max-w-lg`
 * column instead of the viewport. Portalling out is the only fix that doesn't
 * depend on remembering never to transform an ancestor again.
 */
export default function Portal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}
