"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Portal from "./Portal";

export interface CoachStep {
  /** `[data-coach="..."]` target. A step whose target is absent is skipped. */
  target: string;
  title: string;
  body: string;
}

interface Props {
  /** Stable id — one tour per screen, remembered separately. */
  id: string;
  steps: CoachStep[];
  /** Hold off until the screen's data has actually rendered. */
  ready?: boolean;
}

const KEY = (id: string) => `pt-coach-${id}`;
const PAD = 6;

export function resetAllCoachmarks() {
  Object.keys(localStorage)
    .filter((k) => k.startsWith("pt-coach-"))
    .forEach((k) => localStorage.removeItem(k));
}

/**
 * First-run coachmarks.
 *
 * Almost nothing here behaves the way a checkbox app usually does — a day ends
 * at 4am, unticked isn't missed, a target you can't hit gets called out on
 * Thursday. Those rules are the product, and none of them are guessable from
 * looking at the screen, so each screen explains itself once and then never
 * again.
 */
export default function Coachmarks({ id, steps, ready = true }: Props) {
  const [i, setI] = useState(0);
  const [live, setLive] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [card, setCard] = useState<{ left: number; top: number } | null>(null);

  useEffect(() => {
    if (!ready) return;
    try {
      if (localStorage.getItem(KEY(id))) return;
    } catch {
      return; // private mode — skip the tour rather than break the page
    }
    // Let layout settle before measuring the first target.
    const t = setTimeout(() => setLive(true), 350);
    return () => clearTimeout(t);
  }, [id, ready]);

  const finish = useCallback(() => {
    setLive(false);
    try {
      localStorage.setItem(KEY(id), "1");
    } catch {
      /* nothing to do — the tour just runs again next time */
    }
  }, [id]);

  // Resolve the current step's target, skipping any that aren't on screen.
  useEffect(() => {
    if (!live) return;
    let step = i;
    let el: Element | null = null;
    while (step < steps.length) {
      el = document.querySelector(`[data-coach="${steps[step].target}"]`);
      if (el) break;
      step++;
    }
    if (!el || step >= steps.length) {
      finish();
      return;
    }
    if (step !== i) {
      setI(step);
      return;
    }
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    const measure = () => setRect(el!.getBoundingClientRect());
    measure();
    const t = setTimeout(measure, 260); // after the smooth scroll lands
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [live, i, steps, finish]);

  useEffect(() => {
    if (!live) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
      if (e.key === "ArrowRight" || e.key === "Enter") setI((n) => n + 1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [live, finish]);

  /*
   * Place the card only once it has been measured. Guessing its height puts
   * the buttons off-screen on short viewports — which is exactly what happened
   * on the habits screen, where the last target sits at the bottom of the page.
   */
  useLayoutEffect(() => {
    if (!live || !rect || !cardRef.current) return;
    const { width, height } = cardRef.current.getBoundingClientRect();
    const M = 12;
    const fitsBelow = rect.bottom + M + height + M <= window.innerHeight;
    const top = fitsBelow
      ? rect.bottom + M
      : Math.max(M, Math.min(rect.top - M - height, window.innerHeight - M - height));
    const left = Math.min(
      Math.max(M, rect.left + rect.width / 2 - width / 2),
      window.innerWidth - M - width,
    );
    setCard({ left, top });
  }, [live, rect, i]);

  if (!live || !rect) return null;

  const step = steps[i];

  return (
    <Portal>
      <div className="fixed inset-0 z-[60]" role="dialog" aria-label={step.title}>
        {/* Spotlight: one box, everything outside it dimmed by a huge shadow. */}
        <div
          className="pointer-events-none absolute rounded-lg"
          style={{
            left: rect.left - PAD,
            top: rect.top - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
            boxShadow: "0 0 0 9999px rgba(12,10,6,0.62)",
            outline: "2px solid var(--accent)",
            outlineOffset: 2,
          }}
        />
        {/* Tapping the dimmed area moves on, like any tour. */}
        <button
          type="button"
          aria-label="Next"
          onClick={() => setI((n) => n + 1)}
          className="absolute inset-0 cursor-default"
        />

        {/*
         * No `.fade-up` here: its keyframes animate `transform`, and a running
         * animation outranks inline styles — it would wipe out the centring
         * translate below and drop the card half a width off-target.
         */}
        <div
          ref={cardRef}
          className="card absolute w-[min(21rem,calc(100vw-2rem))] px-4 py-3.5"
          style={{
            left: card?.left ?? 0,
            top: card?.top ?? 0,
            visibility: card ? "visible" : "hidden",
          }}
        >
          <h3 className="label-hand text-[17px] text-ink">{step.title}</h3>
          <p className="mt-1.5 text-[13px] leading-relaxed text-ink-soft">{step.body}</p>

          <div className="mt-3 flex items-center justify-between">
            <div className="flex gap-1.5" aria-hidden="true">
              {steps.map((s, n) => (
                <span
                  key={s.target}
                  className="h-1.5 w-1.5 rounded-full transition-colors"
                  style={{ background: n === i ? "var(--accent)" : "var(--rule)" }}
                />
              ))}
            </div>
            <div className="flex items-center gap-3">
              <button type="button" onClick={finish} className="text-[12px] text-ink-faint">
                Skip
              </button>
              <button
                type="button"
                onClick={() => (i === steps.length - 1 ? finish() : setI(i + 1))}
                className="rounded bg-ink px-3.5 py-1.5 text-[13px] text-paper"
              >
                {i === steps.length - 1 ? "Got it" : "Next"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
}
