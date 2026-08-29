"use client";

/**
 * The signal that opens the book.
 *
 * Sign-in and sign-up need an animation that outlives them: the cover lifting
 * away *is* the screen they were just on, and that component unmounts the
 * moment the route changes. So the animation is owned by the book shell in the
 * layout, which survives the navigation, and the auth screens only say when.
 *
 * A single handler rather than a list — there is exactly one book shell, and
 * two of them animating at once would mean something is badly wrong.
 */
type Handler = () => void;

let handler: Handler | null = null;

export function onBookOpen(fn: Handler): () => void {
  handler = fn;
  return () => {
    if (handler === fn) handler = null;
  };
}

/** Call immediately before navigating in, so the cover is caught still on screen. */
export function requestBookOpen(): void {
  handler?.();
}
