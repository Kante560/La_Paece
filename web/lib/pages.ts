/**
 * The book's running order.
 *
 * This is the single source of truth for what page 3 *is* — the folio numbers,
 * the swipe/edge turn direction, and the arrow keys all index into it. Adding a
 * screen here puts it in the book; there is no separate nav list to keep in sync.
 */
export const PAGES = [
  { href: "/", label: "Today" },
  { href: "/week", label: "Week" },
  { href: "/grid", label: "Grid" },
  { href: "/habits", label: "Habits" },
  { href: "/settings", label: "You" },
] as const;

export type Page = (typeof PAGES)[number];
