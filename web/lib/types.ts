export type HabitCategory = "NON_NEGOTIABLE" | "OTHER";
export type HabitType = "BINARY" | "QUANTITY";
export type ResolveWindow = "SAME_DAY" | "NEXT_MORNING";
export type CellState = "complete" | "partial" | "miss" | "unscheduled" | "pending";
export type PaceStatus =
  | "SECURED"
  | "AHEAD"
  | "ON_PACE"
  | "BEHIND"
  | "CRITICAL"
  | "IMPOSSIBLE";

export const MISS_REASONS = [
  { value: "TIRED", label: "Tired" },
  { value: "NO_TIME", label: "No time" },
  { value: "TRAVELING", label: "Traveling" },
  { value: "SICK", label: "Sick" },
  { value: "SOCIAL", label: "Social" },
  { value: "FORGOT", label: "Forgot" },
  { value: "CHOSE_NOT_TO", label: "Chose not to" },
] as const;

export interface Habit {
  id: string;
  name: string;
  category: HabitCategory;
  type: HabitType;
  target: number | null;
  unit: string | null;
  scheduleDays: number[];
  resolveWindow: ResolveWindow;
  sortOrder: number;
  activeFrom: string;
  activeTo: string | null;
  archivedAt: string | null;
}

export interface Cell {
  habitId: string;
  date: string;
  state: CellState;
  ratio: number;
  value: number | null;
  weight: number;
  isBackfill: boolean;
  missReason: string | null;
}

export interface DayProgress {
  date: string;
  pct: number;
  weightedDone: number;
  weightedTotal: number;
  scheduledCount: number;
  completedCount: number;
  cells: Cell[];
}

export interface Consistency {
  /** 0..100, or null until there is a completed day to rate. */
  ovr: number | null;
  daysCounted: number;
  delta: number | null;
  windowDays: number;
}

export interface Streak {
  habitId: string;
  current: number;
  best: number;
  atRisk: boolean;
}

export interface Me {
  id: string;
  email: string;
  timezone: string;
  dayStartHour: number;
  nonNegotiableWeight: number;
  today: string;
  localHour: number;
  /** No habits and setup never finished — send them to /welcome. */
  needsSetup: boolean;
}

export interface DayView {
  date: string;
  today: string;
  habits: Habit[];
  progress: DayProgress;
  consistency: Consistency;
  streaks: Record<string, Streak>;
  day: {
    intention: string | null;
    energy: number | null;
    mood: number | null;
    whatWorked: string | null;
    whatBlocked: string | null;
    tomorrowOneThing: string | null;
    notes: string | null;
  } | null;
  todos: { id: string; text: string; done: boolean; rollCount: number }[];
}

export interface TargetStatus {
  targetPct: number;
  status: PaceStatus;
  neededWeighted: number;
  neededChecks: number;
  remainingChecks: number;
  requiredRate: number;
  currentRate: number;
  rebaselineSuggestion: number | null;
}

export interface WeekView {
  weekStart: string;
  days: DayProgress[];
  totalChecks: number;
  doneChecks: number;
  remainingChecks: number;
  currentPct: number;
  floorPct: number;
  ceilingPct: number;
  target: TargetStatus | null;
  baselinePct: number;
  suggestedTarget: number;
  goalId: string | null;
}

export interface GridView {
  month: string;
  from: string;
  to: string;
  habits: Habit[];
  days: DayProgress[];
  monthPct: number;
  bestDay: { date: string; pct: number } | null;
}
