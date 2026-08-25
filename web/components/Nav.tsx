"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Today" },
  { href: "/week", label: "Week" },
  { href: "/grid", label: "Grid" },
  { href: "/habits", label: "Habits" },
  { href: "/settings", label: "You" },
];

export default function Nav() {
  const pathname = usePathname();
  if (pathname === "/login") return null;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-rule bg-paper"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex max-w-lg">
        {TABS.map((tab) => {
          const active = pathname === tab.href;
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                className="flex flex-col items-center gap-1 py-2.5 text-[11px] tracking-wide transition-colors"
                style={{ color: active ? "var(--ink)" : "var(--ink-faint)" }}
              >
                <span
                  className="h-[3px] w-6 rounded-full transition-colors"
                  style={{ background: active ? "var(--accent)" : "transparent" }}
                />
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
