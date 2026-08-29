"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { TURN_MS, buildRig, fillFaces, paint, shape, type Rig } from "@/lib/flip";
import { onBookOpen } from "@/lib/bookOpen";
import { PAGES } from "@/lib/pages";
import { warmBook } from "@/lib/preload";

/** Horizontal travel before a swipe counts as a turn rather than a stray drag. */
const SWIPE_MIN = 60;
/**
 * How far into a back turn the incoming page gets frozen. The flap is showing
 * its blank reverse until roughly here, so this is the last moment the snapshot
 * can be taken — and the latest one gives the page the best chance of having
 * its data before it is frozen.
 */
const CAPTURE_AT = 0.45;
/** Must match the cover-lift animation in globals.css. */
const COVER_MS = 1000;

interface Turn {
  dir: 1 | -1;
  target: string;
  rig: Rig;
  width: number;
  /** The new route has rendered, so the live page is real. */
  committed: boolean;
  /** Back turns only: the incoming page has been frozen onto the sheet. */
  captured: boolean;
  raf: number;
}

/**
 * cloneNode copies markup, not live state — a cloned textarea comes back with
 * whatever was in the HTML, which for this app means an empty journal field on
 * every turn. Copying the state the DOM keeps off-attribute is cheap, and stops
 * the turning sheet from contradicting the page it just was.
 */
function snapshot(from: HTMLElement): HTMLElement {
  const clone = from.cloneNode(true) as HTMLElement;
  clone.removeAttribute("id");

  const live = from.querySelectorAll("input, textarea, select");
  const copies = clone.querySelectorAll("input, textarea, select");
  live.forEach((node, i) => {
    const c = copies[i];
    if (!c) return;
    if (node instanceof HTMLInputElement && c instanceof HTMLInputElement) {
      c.setAttribute("value", node.value);
      if (node.type === "checkbox" || node.type === "radio") c.checked = node.checked;
    } else if (node instanceof HTMLTextAreaElement && c instanceof HTMLTextAreaElement) {
      c.textContent = node.value;
    } else if (node instanceof HTMLSelectElement && c instanceof HTMLSelectElement) {
      c.value = node.value;
    }
  });

  // The month grid scrolls sideways; a snapshot reset to column 1 would jump.
  const sel = ".overflow-x-auto, .overflow-auto, .overflow-x-scroll";
  const scrollers = from.querySelectorAll(sel);
  const scrollerCopies = clone.querySelectorAll<HTMLElement>(sel);
  scrollers.forEach((node, i) => {
    const c = scrollerCopies[i];
    if (c) c.scrollLeft = node.scrollLeft;
  });

  return clone;
}

/** Drops a frozen page into a fixed layer, sitting where the eye last saw it. */
function place(layer: HTMLElement, page: HTMLElement, offsetY: number) {
  const sheet = document.createElement("div");
  sheet.className = "book-sheet";
  if (offsetY) sheet.style.transform = `translateY(${-offsetY}px)`;
  sheet.append(page);
  layer.replaceChildren(sheet);
}

/**
 * True if some scroller between `node` and the stage could still absorb this
 * horizontal drag — the grid's month table being the one that matters. Turning
 * the page out from under someone scrolling sideways through October is
 * maddening, so the scroller wins and the swipe is abandoned.
 */
function scrollerWantsIt(node: Element | null, dx: number, stop: Element): boolean {
  let el: Element | null = node;
  while (el && el !== stop) {
    if (el instanceof HTMLElement && el.scrollWidth > el.clientWidth + 1) {
      const overflow = getComputedStyle(el).overflowX;
      if (overflow === "auto" || overflow === "scroll") {
        const max = el.scrollWidth - el.clientWidth;
        // Swiping left pushes content right, which needs scrollLeft to grow.
        if (dx < 0 ? el.scrollLeft < max - 1 : el.scrollLeft > 1) return true;
      }
    }
    el = el.parentElement;
  }
  return false;
}

/**
 * The book shell.
 *
 * Turning is a fold (see lib/flip.ts for the geometry and why it is not a
 * spine rotation). The layers, bottom to top:
 *
 *   beneath  the outgoing page, frozen, full screen — what stays behind
 *   base     the incoming page, frozen, clipped to the side already turned
 *   stage    the live <main>, held back until the new route commits
 *   fold     the flap itself, hinged on the crease
 *
 * Forward, the live page *is* the base: it is clipped to the right of the
 * crease and revealed as the flap lifts off it. Back, the incoming page has to
 * be frozen instead, because the flap and the flat part beside it are the same
 * page and must agree — a live one would update out from under the frozen flap
 * and show a seam down the crease.
 *
 * The live page stays hidden until the route commits either way. That is what
 * stops the page you are leaving from being re-rendered, and swapped for a
 * loader, underneath the sheet still turning away from it.
 *
 * Routes outside PAGES (the login screen) get no chrome and no gestures.
 */
export default function Book({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const idx = PAGES.findIndex((p) => p.href === pathname);
  const inBook = idx >= 0;

  const stageRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const beneathRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLDivElement>(null);
  const foldRef = useRef<HTMLDivElement>(null);
  const coverRef = useRef<HTMLDivElement>(null);
  const coverFaceRef = useRef<HTMLDivElement>(null);
  const openingRef = useRef(false);

  const [turning, setTurning] = useState(false);
  const [folioOpen, setFolioOpen] = useState(false);

  /*
   * The turn runs on rAF and writes styles straight to the DOM: the geometry
   * changes clip-paths and gradients, which no keyframe engine can composite
   * anyway, and driving it by hand keeps cancel and cleanup exact.
   */
  const turnRef = useRef<Turn | null>(null);

  const finish = useCallback(() => {
    const turn = turnRef.current;
    if (!turn) return;  
    cancelAnimationFrame(turn.raf);
    turnRef.current = null;

    for (const ref of [beneathRef, baseRef, foldRef]) {
      if (ref.current) {
        ref.current.hidden = true;
        ref.current.replaceChildren();
      }
    }
    if (mainRef.current) {
      mainRef.current.classList.remove("book-hold", "book-ruled");
      mainRef.current.style.clipPath = "";
    }
    setTurning(false);
  }, []);

  /*
   * Opening the book.
   *
   * Sign-in and sign-up are the cover: on success their own screen is frozen,
   * lifted on its top edge and swung up and away, and the first page is behind
   * it. The live page is held until the route commits, the same as a turn, so
   * what appears under the rising cover is the page rather than a loader.
   */
  const openBook = useCallback(() => {
    const main = mainRef.current;
    const cover = coverRef.current;
    const face = coverFaceRef.current;
    if (!main || !cover || !face) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    place(face, snapshot(main), window.scrollY);
    cover.hidden = false;
    main.classList.add("book-hold", "book-ruled");
    openingRef.current = true;

    // Restart the animation even if a previous open left the class on.
    cover.classList.remove("is-lifting");
    void cover.offsetWidth;
    cover.classList.add("is-lifting");

    window.setTimeout(() => {
      openingRef.current = false;
      cover.classList.remove("is-lifting");
      cover.hidden = true;
      face.replaceChildren();
      main.classList.remove("book-hold", "book-ruled");
    }, COVER_MS);
  }, []);

  useEffect(() => onBookOpen(openBook), [openBook]);

  // The first page has arrived: let it show through from under the cover.
  useEffect(() => {
    if (!openingRef.current) return;
    mainRef.current?.classList.remove("book-hold");
  }, [pathname]);

  const go = useCallback(
    (to: number) => {
      if (turnRef.current || !inBook) return;
      if (to === idx || to < 0 || to >= PAGES.length) return;

      const main = mainRef.current;
      const beneath = beneathRef.current;
      const base = baseRef.current;
      const fold = foldRef.current;
      const target = PAGES[to].href;
      const dir: 1 | -1 = to > idx ? 1 : -1;

      setFolioOpen(false);

      // Anything without the room for a page turn just goes to the page.
      const plain =
        !main ||
        !beneath ||
        !base ||
        !fold ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (plain) {
        router.push(target);
        return;
      }

      /*
       * Measured off the fold layer, not window.innerWidth: the frozen layers
       * are fixed boxes sized to the initial containing block, which excludes a
       * classic scrollbar while innerWidth includes it. A few pixels of
       * disagreement puts the crease off the edge the clips actually cut on,
       * and the page underneath leaks down the seam.
       */
      const width = fold.clientWidth || window.innerWidth;
      const scrolled = window.scrollY;
      const outgoing = snapshot(main);

      place(beneath, outgoing, scrolled);
      beneath.hidden = false;

      const rig = buildRig(fold);
      // Forward, the flap carries the page you are leaving and can be dressed
      // now. Back, it carries the page you are going to, which does not exist
      // yet — its blank reverse is all that shows until CAPTURE_AT.
      if (dir === 1) fillFaces(rig, outgoing, scrolled);
      fold.hidden = false;

      // Opaque for the duration, or the frozen page beneath reads through it.
      main.classList.add("book-hold", "book-ruled");
      setTurning(true);

      const started = performance.now();
      const turn: Turn = {
        dir,
        target,
        rig,
        width,
        committed: false,
        captured: false,
        raf: 0,
      };
      turnRef.current = turn;

      const step = (now: number) => {
        const p = Math.min(1, (now - started) / TURN_MS);
        const t = dir === 1 ? shape(p) : 1 - shape(p);
        const f = paint(turn.rig, t, width);

        /*
         * Freeze the incoming page and animate over the frozen copy, both
         * directions.
         *
         * The live page cannot be the one revealed: it refetches on mount, and
         * when that lands mid-turn React repaints it *behind the crease that
         * has already gone past* — content changing in a region the wave has
         * finished with, which is the tear this exists to stop. Frozen, what
         * the turn reveals is settled before the first pixel of it is shown.
         *
         * Forward captures as soon as the route commits, because the reveal
         * starts immediately. Back waits until CAPTURE_AT, when the flap is
         * still showing its blank reverse, which buys the page longer to be
         * worth photographing.
         */
        const readyToCapture = dir === 1 ? turn.committed : turn.committed && p >= CAPTURE_AT;
        if (!turn.captured && readyToCapture) {
          const incoming = snapshot(main);
          place(base, incoming, 0);
          // Back turns need it on the flap too; forward's flap is the old page.
          if (dir === -1) fillFaces(turn.rig, incoming, 0);
          base.hidden = false;
          turn.captured = true;
        }

        if (turn.captured) {
          // Forward reveals to the right of the crease, back lands to the left.
          base.style.clipPath =
            dir === 1 ? `inset(0 0 0 ${f}px)` : `inset(0 ${width - f}px 0 0)`;
        }

        if (p >= 1) {
          finish();
          return;
        }
        turn.raf = requestAnimationFrame(step);
      };
      turn.raf = requestAnimationFrame(step);

      router.push(target);
    },
    [finish, idx, inBook, router],
  );

  /* The route has landed: let the live page back in, behind the sheet. */
  useEffect(() => {
    const turn = turnRef.current;
    if (!turn || turn.target !== pathname) return;
    /*
     * Only flag it. The reveal itself happens in the next animation frame,
     * which clips the page before it is unhidden. A back turn never reveals it
     * mid-turn at all: the frozen copy is the one on screen until the sheet has
     * landed, so the two can never disagree down the crease.
     */
    turn.committed = true;
  }, [pathname]);

  useEffect(() => finish, [finish]);

  /*
   * Warm the pages either side of this one.
   *
   * A turn pushes a route the client may never have loaded, so the commit can
   * be waiting on a JS chunk while the sheet is already lifting — the page
   * arrives late and the animation lands on nothing. Prefetching the immediate
   * neighbours makes the commit a local one. Only the two adjacent pages, and
   * only once the current one is idle, so this never competes with the fetch
   * the page you are actually on is doing.
   */
  useEffect(() => {
    if (!inBook) return;
    const near = [PAGES[idx - 1], PAGES[idx + 1]].filter(Boolean);
    const idle =
      window.requestIdleCallback?.(() => near.forEach((p) => router.prefetch(p.href))) ??
      window.setTimeout(() => near.forEach((p) => router.prefetch(p.href)), 300);
    return () => {
      if (window.cancelIdleCallback) window.cancelIdleCallback(idle as number);
      else window.clearTimeout(idle as number);
    };
  }, [idx, inBook, router]);

  /*
   * Fill every page's cache once, shortly after arrival. The turn shows a
   * frozen copy of the incoming page, so this is what decides whether that
   * copy is the real page or a loader caught mid-spin.
   */
  useEffect(() => {
    if (!inBook) return;
    const id =
      window.requestIdleCallback?.(() => void warmBook(pathname)) ??
      window.setTimeout(() => void warmBook(pathname), 600);
    return () => {
      if (window.cancelIdleCallback) window.cancelIdleCallback(id as number);
      else window.clearTimeout(id as number);
    };
    // Once per mount: warmBook guards itself against running twice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inBook]);

  /* Mobile: swipe. Left turns forward, the way a book does. */
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !inBook) return;

    let x0 = 0;
    let y0 = 0;
    let live = false;
    let origin: Element | null = null;

    const start = (e: TouchEvent) => {
      if (e.touches.length !== 1 || turnRef.current) return;
      x0 = e.touches[0].clientX;
      y0 = e.touches[0].clientY;
      origin = e.target as Element;
      live = true;
    };

    const move = (e: TouchEvent) => {
      if (!live) return;
      const dx = e.touches[0].clientX - x0;
      const dy = e.touches[0].clientY - y0;
      if (Math.abs(dx) < 12) return;
      // Scrolling the page beats turning it, and so does scrolling the grid.
      if (Math.abs(dy) > Math.abs(dx) || scrollerWantsIt(origin, dx, stage)) live = false;
    };

    const end = (e: TouchEvent) => {
      if (!live) return;
      live = false;
      const dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) < SWIPE_MIN) return;
      go(dx < 0 ? idx + 1 : idx - 1);
    };

    stage.addEventListener("touchstart", start, { passive: true });
    stage.addEventListener("touchmove", move, { passive: true });
    stage.addEventListener("touchend", end, { passive: true });
    stage.addEventListener("touchcancel", end, { passive: true });
    return () => {
      stage.removeEventListener("touchstart", start);
      stage.removeEventListener("touchmove", move);
      stage.removeEventListener("touchend", end);
      stage.removeEventListener("touchcancel", end);
    };
  }, [go, idx, inBook]);

  /* Desktop: arrow keys, alongside the edge strips. */
  useEffect(() => {
    if (!inBook) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, select, [contenteditable]")) return;
      // A habit sheet or a coachmark owns the arrow keys while it is open.
      if (document.querySelector("[role='dialog']")) return;
      e.preventDefault();
      go(e.key === "ArrowRight" ? idx + 1 : idx - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, idx, inBook]);

  return (
    <>
      {/* Frozen layers. Decorative only — never in the a11y tree. */}
      <div ref={beneathRef} className="book-beneath book-ruled" aria-hidden="true" hidden />
      <div ref={baseRef} className="book-base book-ruled" aria-hidden="true" hidden />

      <div ref={stageRef} className="book-stage">
        {/*
          * The column lives on an inner div, not on <main>, so the sheet the
          * clip runs against is the full width of the screen.
          */}
        <main ref={mainRef} className="book-main min-h-dvh">
          <div className="mx-auto max-w-lg px-4 pb-20 pt-6">{children}</div>
        </main>
      </div>

      <div ref={foldRef} className="book-fold" aria-hidden="true" hidden />

      {/* The cover. Only ever used on the way in from sign-in or sign-up. */}
      <div ref={coverRef} className="book-cover-stage" aria-hidden="true" hidden>
        <div className="book-cover">
          <div ref={coverFaceRef} className="book-cover-face book-ruled" />
          <div className="book-cover-back book-ruled" />
          <div className="book-cover-shade" />
        </div>
      </div>

      {inBook && (
        <>
          <button
            type="button"
            className="book-edge book-edge-back"
            onClick={() => go(idx - 1)}
            disabled={idx === 0 || turning}
            aria-label={idx === 0 ? "No previous page" : `Turn back to ${PAGES[idx - 1].label}`}
          >
            <span className="book-edge-mark" aria-hidden="true" />
          </button>
          <button
            type="button"
            className="book-edge book-edge-fwd"
            onClick={() => go(idx + 1)}
            disabled={idx === PAGES.length - 1 || turning}
            aria-label={
              idx === PAGES.length - 1 ? "No next page" : `Turn on to ${PAGES[idx + 1].label}`
            }
          >
            <span className="book-edge-mark" aria-hidden="true" />
          </button>

          <Folio idx={idx} open={folioOpen} onToggle={() => setFolioOpen((o) => !o)} onGo={go} />
        </>
      )}
    </>
  );
}

/**
 * The folio — the page number printed at the foot of the page.
 *
 * Closed, it is only the number you are on. Tapping it slides the rest of the
 * book's numbers out either side; there is no overlay and no dimming, so the
 * page stays readable behind them, and any number goes straight to its page.
 * The labels ride along because a bare "4" tells you nothing about where it is.
 */
function Folio({
  idx,
  open,
  onToggle,
  onGo,
}: {
  idx: number;
  open: boolean;
  onToggle: () => void;
  onGo: (to: number) => void;
}) {
  // Anywhere else on the page closes it again.
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (!(e.target as Element | null)?.closest(".folio")) onToggle();
    };
    // Deferred, or the pointerdown that opened it closes it in the same tick.
    const t = window.setTimeout(() => document.addEventListener("pointerdown", close), 0);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("pointerdown", close);
    };
  }, [open, onToggle]);

  return (
    <div className="folio" data-open={open || undefined}>
      <div className="folio-row" role="group" aria-label="Pages">
        {PAGES.map((page, i) => {
          const current = i === idx;
          const hidden = !open && !current;
          return (
            <button
              key={page.href}
              type="button"
              className="folio-slot"
              data-current={current || undefined}
              aria-current={current ? "page" : undefined}
              aria-hidden={hidden}
              tabIndex={hidden ? -1 : 0}
              onClick={() => (current ? onToggle() : onGo(i))}
              aria-label={
                current
                  ? `Page ${i + 1}, ${page.label}. ${open ? "Hide" : "Show"} all pages`
                  : `Page ${i + 1}, ${page.label}`
              }
            >
              <span className="folio-num">{i + 1}</span>
              <span className="folio-label">{page.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
