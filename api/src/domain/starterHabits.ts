/**
 * The starter catalogue.
 *
 * Offered to every new account on first run, and used by the dev seed. Both
 * read from here so the set someone is offered can never drift from the set
 * that gets created.
 *
 * A brand-new account has no habits, which means an empty Today, an empty Week
 * and no rating — nothing to react to on the one day someone is most likely to
 * decide the app isn't worth it. Handing over a plausible set they can trim is
 * what makes the first session usable; every one of these is editable or
 * archivable straight afterwards.
 *
 * `key` is the stable identifier the picker sends back. Names are free to be
 * reworded without invalidating anything a client already holds.
 */
export const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];
export const WEEKDAYS = [1, 2, 3, 4, 5];

export interface StarterHabit {
  key: string;
  name: string;
  category: "NON_NEGOTIABLE" | "OTHER";
  type: "BINARY" | "QUANTITY";
  target?: number;
  unit?: string;
  scheduleDays: number[];
  resolveWindow?: "SAME_DAY" | "NEXT_MORNING";
  /** Ticked when the picker first opens. */
  suggested: boolean;
}

export const STARTER_HABITS: StarterHabit[] = [
  { key: "wake-6", name: "Wake up before 6am", category: "NON_NEGOTIABLE", type: "BINARY", resolveWindow: "NEXT_MORNING", scheduleDays: EVERY_DAY, suggested: true },
  { key: "cold-shower", name: "Cold shower", category: "NON_NEGOTIABLE", type: "BINARY", scheduleDays: EVERY_DAY, suggested: false },
  { key: "no-phone-11", name: "No phone until 11am", category: "NON_NEGOTIABLE", type: "BINARY", scheduleDays: EVERY_DAY, suggested: false },
  { key: "workout", name: "Workout", category: "NON_NEGOTIABLE", type: "BINARY", scheduleDays: [1, 2, 3, 5, 6], suggested: true },
  { key: "read", name: "Read", category: "NON_NEGOTIABLE", type: "QUANTITY", target: 20, unit: "pages", scheduleDays: EVERY_DAY, suggested: true },
  { key: "meditate", name: "Meditate", category: "NON_NEGOTIABLE", type: "QUANTITY", target: 10, unit: "min", scheduleDays: EVERY_DAY, suggested: false },
  { key: "eat-clean", name: "Eat clean", category: "NON_NEGOTIABLE", type: "BINARY", scheduleDays: EVERY_DAY, suggested: true },
  { key: "water", name: "Water", category: "NON_NEGOTIABLE", type: "QUANTITY", target: 3, unit: "L", scheduleDays: EVERY_DAY, suggested: true },
  { key: "no-alcohol", name: "No alcohol", category: "NON_NEGOTIABLE", type: "BINARY", scheduleDays: EVERY_DAY, suggested: false },
  { key: "sleep-1030", name: "Sleep by 10:30pm", category: "NON_NEGOTIABLE", type: "BINARY", resolveWindow: "NEXT_MORNING", scheduleDays: EVERY_DAY, suggested: true },
  { key: "journaling", name: "Journaling", category: "OTHER", type: "BINARY", scheduleDays: EVERY_DAY, suggested: true },
  { key: "deep-work", name: "Deep work", category: "OTHER", type: "QUANTITY", target: 90, unit: "min", scheduleDays: WEEKDAYS, suggested: true },
  { key: "learn", name: "Learn something", category: "OTHER", type: "BINARY", scheduleDays: EVERY_DAY, suggested: false },
  { key: "steps", name: "Steps", category: "OTHER", type: "QUANTITY", target: 10000, unit: "steps", scheduleDays: EVERY_DAY, suggested: false },
  { key: "stretch", name: "Stretch", category: "OTHER", type: "BINARY", scheduleDays: EVERY_DAY, suggested: false },
];

export const STARTER_BY_KEY = new Map(STARTER_HABITS.map((h) => [h.key, h]));
