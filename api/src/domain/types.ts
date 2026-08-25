import type { LocalDate } from "../lib/dates.js";

export type HabitCategory = "NON_NEGOTIABLE" | "OTHER";
export type HabitType = "BINARY" | "QUANTITY";
export type ResolveWindow = "SAME_DAY" | "NEXT_MORNING";

/** Plain shapes for the domain layer — Decimal is converted at the boundary. */
export interface DomainHabit {
  id: string;
  name: string;
  category: HabitCategory;
  type: HabitType;
  target: number | null;
  unit: string | null;
  scheduleDays: number[];
  resolveWindow: ResolveWindow;
  sortOrder: number;
  activeFrom: LocalDate;
  activeTo: LocalDate | null;
  archivedAt: LocalDate | null;
}

export interface DomainEntry {
  habitId: string;
  date: LocalDate;
  value: number;
  isBackfill: boolean;
  missReason: string | null;
}

export type CellState = "complete" | "partial" | "miss" | "unscheduled" | "pending";

export interface Cell {
  habitId: string;
  date: LocalDate;
  state: CellState;
  ratio: number; // 0..1 credit toward the day
  value: number | null;
  weight: number;
  isBackfill: boolean;
  /** Why it was missed, when one was given. Round-trips so the UI can show it. */
  missReason: string | null;
}

export interface DayProgress {
  date: LocalDate;
  pct: number; // weighted 0..100
  weightedDone: number;
  weightedTotal: number;
  scheduledCount: number;
  completedCount: number;
  cells: Cell[];
}
