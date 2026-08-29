"use client";

import { useCallback, useEffect, useState } from "react";
import { resetAllCoachmarks } from "@/components/Coachmarks";
import TimezonePicker from "@/components/TimezonePicker";
import { PageLoader } from "@/components/loader";
import { get, patch, post } from "@/lib/api";
import { forgetAll, recall, remember } from "@/lib/cache";
import { resetWarm } from "@/lib/preload";
import type { Me } from "@/lib/types";

export default function SettingsPage() {
  // Seeded from the last render of this page so a turn lands on real content
  // rather than the loader. The fetch below still runs and corrects it.
  const [me, setMe] = useState<Me | null>(() => recall<Me>("view:me"));
  const [theme, setTheme] = useState<"system" | "day" | "night">("system");

  const load = useCallback(async () => setMe(remember("view:me", await get<Me>("/auth/me"))), []);

  useEffect(() => {
    load().catch(() => {});
    const saved = localStorage.getItem("pt-theme");
    if (saved === "day" || saved === "night") setTheme(saved);
  }, [load]);

  function applyTheme(next: "system" | "day" | "night") {
    setTheme(next);
    if (next === "system") {
      localStorage.removeItem("pt-theme");
      document.documentElement.removeAttribute("data-theme");
    } else {
      localStorage.setItem("pt-theme", next);
      document.documentElement.setAttribute("data-theme", next);
    }
  }

  async function update(body: Record<string, unknown>) {
    await patch("/auth/me", body);
    load();
  }

  if (!me) return <PageLoader />;

  return (
    <div className="fade-up space-y-7">
      <header>
        <h1 className="section-title text-2xl">Settings</h1>
        <p className="mt-2 text-[13px] text-ink-faint">{me.email}</p>
      </header>

      <section className="space-y-2">
        <h2 className="label-hand text-lg">Theme</h2>
        <div className="flex gap-2">
          {(["system", "day", "night"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => applyTheme(t)}
              className="flex-1 rounded border py-2 text-[13px] capitalize"
              style={{
                borderColor: theme === t ? "var(--ink)" : "var(--rule)",
                color: theme === t ? "var(--ink)" : "var(--ink-faint)",
              }}
            >
              {t}
            </button>
          ))}
        </div>
        <p className="text-[12px] leading-relaxed text-ink-faint">
          Night is a warm dark page, not an inverted one — you close out the day in a dark room.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="label-hand text-lg">Day starts at</h2>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={0}
            max={8}
            value={me.dayStartHour}
            onChange={(e) => update({ dayStartHour: Number(e.target.value) })}
            className="flex-1 accent-[var(--accent)]"
          />
          <span className="w-16 text-right text-[15px] tabular-nums">
            {String(me.dayStartHour).padStart(2, "0")}:00
          </span>
        </div>
        <p className="text-[12px] leading-relaxed text-ink-faint">
          At 4:00, anything you log before 4am still counts for the previous day — which is what you
          mean at 1:40am.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="label-hand text-lg">Non-negotiable weight</h2>
        <div className="flex gap-2">
          {[1, 2, 3].map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => update({ nonNegotiableWeight: w })}
              className="flex-1 rounded border py-2 text-[14px] tabular-nums"
              style={{
                borderColor: me.nonNegotiableWeight === w ? "var(--ink)" : "var(--rule)",
                color: me.nonNegotiableWeight === w ? "var(--ink)" : "var(--ink-faint)",
              }}
            >
              {w}×
            </button>
          ))}
        </div>
        <p className="text-[12px] leading-relaxed text-ink-faint">
          How much more a non-negotiable counts than another habit. At 1× the headline number lets
          &ldquo;stretch&rdquo; paper over a missed workout.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="label-hand text-lg">Timezone</h2>
        <TimezonePicker value={me.timezone} onChange={(timezone) => update({ timezone })} />
        <p className="text-[12px] leading-relaxed text-ink-faint">
          Every date in the app is resolved in this zone — get it wrong and your day rolls over at
          the wrong hour.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="label-hand text-lg">Guided tips</h2>
        <button
          type="button"
          onClick={() => {
            resetAllCoachmarks();
            window.location.href = "/";
          }}
          className="w-full rounded border border-rule py-2.5 text-[14px] text-ink-soft"
        >
          Show the walkthrough again
        </button>
      </section>

      <button
        type="button"
        onClick={async () => {
          await post("/auth/logout");
          // Never seed one account's day into the next person's session.
          forgetAll();
          resetWarm();
          window.location.href = "/login";
        }}
        className="w-full rounded border border-rule py-2.5 text-[14px] text-ink-soft"
      >
        Log out
      </button>
    </div>
  );
}
