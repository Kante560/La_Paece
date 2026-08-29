"use client";

import { get } from "./api";
import { remember } from "./cache";
import type { DayView, GridView, Habit, Me, WeekView } from "./types";

/**
 * Warm every page of the book once, shortly after arrival.
 *
 * A turn freezes the incoming page and animates over that frozen copy, so
 * whatever the page had on its first paint is what the whole turn shows. Warm
 * caches are what make that first paint be the real page rather than a loader:
 * without this, the first flip to each page is a frozen spinner that only
 * resolves once the turn is over.
 *
 * The keys and the shaping have to match what each page does for itself — a
 * mismatch here is silent, and shows up as a page that ignores its own cache.
 */

/** Same filter the habits page applies, or its seeded render would differ. */
const warmers: Record<string, () => Promise<unknown>> = {
  "/": async () => remember("view:today", await get<DayView>("/views/today")),
  "/week": async () => remember("view:week", await get<WeekView>("/views/week")),
  "/grid": async () => remember("view:grid:current", await get<GridView>("/views/grid")),
  "/habits": async () =>
    remember("view:habits", (await get<Habit[]>("/habits")).filter((h) => !h.archivedAt)),
  "/settings": async () => remember("view:me", await get<Me>("/auth/me")),
};

let warmed = false;

/**
 * `skip` is the page already on screen: it is fetching itself as this runs, and
 * asking for the same view twice on arrival is pure duplicate load.
 *
 * Failures are swallowed on purpose. This is an optimisation — if a warm fetch
 * fails the page will simply fetch for itself when reached, which is exactly
 * the behaviour without any of this.
 */
export async function warmBook(skip?: string): Promise<void> {
  if (warmed) return;
  warmed = true;
  await Promise.all(
    Object.entries(warmers)
      .filter(([href]) => href !== skip)
      .map(([, run]) => run().catch(() => {})),
  );
}

/** Called on logout, alongside clearing the cache, so the next account rewarms. */
export function resetWarm(): void {
  warmed = false;
}
