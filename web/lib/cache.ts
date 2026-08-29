"use client";

/**
 * A one-session view cache, so a page turn never lands on a loader.
 *
 * The turn reveals the incoming page *while it is still animating*. Without
 * this, that page mounts with no data and renders the loader, so what you see
 * under the lifting sheet is a spinner rather than the page you turned to —
 * the flip visibly cracks. Seeding a page's first render from the last thing
 * it showed means the turn lands on real content, and the fetch that follows
 * corrects it a moment later.
 *
 * Stale-while-revalidate, deliberately: every page still refetches on mount.
 * This only decides what is on screen for the few hundred milliseconds before
 * that returns, which is exactly the window the animation occupies.
 *
 * In memory and per tab. A reload starts cold, which is fine — the cost of a
 * cold start is one loader, on a navigation that isn't a page turn anyway.
 */

interface Entry {
  data: unknown;
  at: number;
}

const store = new Map<string, Entry>();

/**
 * How old a cached view may be and still be worth showing for a moment.
 *
 * Long enough to cover a session of flipping back and forth, short enough that
 * nothing survives to be shown across the 4am rollover, when today's date — and
 * therefore every view keyed on it — changes underneath the cache.
 */
const MAX_AGE_MS = 5 * 60 * 1000;

export function remember<T>(key: string, data: T): T {
  store.set(key, { data, at: Date.now() });
  return data;
}

/** The last value for `key`, if it is recent enough to put on screen. */
export function recall<T>(key: string): T | null {
  const hit = store.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > MAX_AGE_MS) {
    store.delete(key);
    return null;
  }
  return hit.data as T;
}

/**
 * Empty the cache.
 *
 * Called on every change of account. These views are one person's habits,
 * journal and misses; carrying a single entry across a logout into the next
 * person's session would show them someone else's day.
 */
export function forgetAll(): void {
  store.clear();
}
