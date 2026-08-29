"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import Check from "@/components/Check";
import { PageLoader } from "@/components/loader";
import { get, post } from "@/lib/api";
import type { Me } from "@/lib/types";

interface StarterHabit {
  key: string;
  name: string;
  category: "NON_NEGOTIABLE" | "OTHER";
  type: "BINARY" | "QUANTITY";
  target?: number;
  unit?: string;
  scheduleDays: number[];
  resolveWindow?: "SAME_DAY" | "NEXT_MORNING";
  suggested: boolean;
}

const DOW = ["S", "M", "T", "W", "T", "F", "S"];

/** "20 pages · Mon–Fri" — the part of a habit that isn't its name. */
function detail(h: StarterHabit): string {
  const bits: string[] = [];
  if (h.type === "QUANTITY" && h.target) bits.push(`${h.target} ${h.unit ?? ""}`.trim());
  if (h.scheduleDays.length < 7) bits.push(h.scheduleDays.map((d) => DOW[d]).join(""));
  if (h.resolveWindow === "NEXT_MORNING") bits.push("next morning");
  return bits.join(" · ");
}

/**
 * First run.
 *
 * A fresh account has no habits, which means an empty Today, an empty Week and
 * no rating — on the one day someone is most likely to decide this isn't worth
 * the effort. So the starter set is offered pre-ticked and trimmable rather
 * than left as an empty screen and an invitation to think of fifteen things.
 *
 * Starting blank is a real choice and stays one button away; it still finishes
 * setup, so nobody is dragged back here on their next visit.
 */
export default function WelcomePage() {
  const router = useRouter();
  const [starters, setStarters] = useState<StarterHabit[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [me, list] = await Promise.all([
          get<Me>("/auth/me"),
          get<StarterHabit[]>("/habits/starter"),
        ]);
        if (cancelled) return;
        // Already set up — this page has nothing to say to them.
        if (!me.needsSetup) {
          router.replace("/");
          return;
        }
        setStarters(list);
        setPicked(new Set(list.filter((h) => h.suggested).map((h) => h.key)));
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const finish = useCallback(
    async (keys: string[]) => {
      setBusy(true);
      setError(null);
      try {
        await post("/habits/starter", { keys });
        router.push("/");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save");
        setBusy(false);
      }
    },
    [router],
  );

  if (error && !starters) return <p className="py-10 text-sm text-accent">{error}</p>;
  if (!starters) return <PageLoader />;

  const toggle = (key: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const groups = [
    { label: "Non-negotiables", items: starters.filter((h) => h.category === "NON_NEGOTIABLE") },
    { label: "The rest", items: starters.filter((h) => h.category === "OTHER") },
  ];

  return (
    <div className="fade-up space-y-7 pb-4">
      <header>
        <h1 className="section-title text-2xl">Start with these?</h1>
        <p className="mt-3 text-[13px] leading-relaxed text-ink-faint">
          A first guess, not a prescription. Untick anything that isn&apos;t yours — you can add,
          edit and archive habits any time on the Habits page.
        </p>
      </header>

      {groups.map((group) =>
        group.items.length === 0 ? null : (
          <section key={group.label}>
            <h2 className="section-title text-lg">{group.label}</h2>
            <ul className="mt-3 space-y-0.5">
              {group.items.map((h) => {
                const on = picked.has(h.key);
                const meta = detail(h);
                return (
                  <li key={h.key}>
                    <button
                      type="button"
                      onClick={() => toggle(h.key)}
                      aria-pressed={on}
                      className="flex w-full items-center gap-3 rounded py-2 text-left"
                    >
                      <Check state={on ? "complete" : "pending"} />
                      <span className="min-w-0 flex-1">
                        <span
                          className="block text-[15px] leading-snug"
                          style={{ color: on ? "var(--ink)" : "var(--ink-faint)" }}
                        >
                          {h.name}
                        </span>
                        {meta && <span className="block text-[11px] text-ink-faint">{meta}</span>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ),
      )}

      {error && <p className="text-sm text-accent">{error}</p>}

      <div className="space-y-3 border-t border-dashed border-rule pt-5">
        <button
          type="button"
          disabled={busy || picked.size === 0}
          onClick={() => finish([...picked])}
          className="w-full rounded bg-ink py-2.5 text-[15px] text-paper disabled:opacity-40"
        >
          {busy
            ? "…"
            : `Use ${picked.size} habit${picked.size === 1 ? "" : "s"}`}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => finish([])}
          className="w-full py-1 text-[13px] text-ink-faint underline underline-offset-2 disabled:opacity-40"
        >
          Start blank instead
        </button>
      </div>
    </div>
  );
}
