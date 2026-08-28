/**
 * Page-turn physics for the book shell.
 *
 * A page on a phone-sized screen cannot turn about the spine and still show you
 * its back — past 90 degrees the sheet is over where the facing page would be,
 * which is off the side of the screen. So a turn here is a *fold*: a crease
 * sweeps across the page and the flap beyond it lifts, stands up, and goes over.
 * That keeps the whole motion on screen and means the reverse of the sheet is
 * genuinely visible, which is what a real single page does when you push it.
 *
 * The flap is built from a short chain of facets, each hinged off the last and
 * carrying a share of the curl, so the sheet bends instead of staying a rigid
 * plane — and so it never vanishes as it passes edge-on. Every facet costs one
 * DOM clone of the page, which is why there are three of them and not ten.
 *
 * Geometry is deliberately kept out of the component: it was tuned against
 * rendered frames, and it is easier to trust when it reads as maths.
 */

/** A turn is meant to be watched, not got through. */
export const TURN_MS = 1100;

/** Curl facets in the flap. Each one is a DOM clone of the page — keep it low. */
const FACETS = 3;
/** Total curl spread, crease to free edge, in degrees. */
const BOW = 58;
/**
 * Sheet flex. skewY shifts y only, so the crease stays exactly vertical — which
 * is what lets the live page be clipped against it with a plain inset().
 */
const SKEW = 1.6;

/**
 * Slow pick-up, quick fall, cushioned landing. A page has almost no mass but a
 * lot of air under it, so it does not move linearly and it does not stop dead.
 */
export function shape(p: number): number {
  return p < 0.5
    ? 0.5 * Math.pow(p / 0.5, 1.7)
    : 1 - 0.5 * Math.pow((1 - p) / 0.5, 2.6);
}

/**
 * Cumulative bend at facet k. Facet 0 sits on the crease and carries none; the
 * rest take an accelerating share, so the free edge trails furthest — the way a
 * sheet you push from one edge lags in the middle.
 */
function facetAngle(k: number, bow: number): number {
  if (k <= 0) return 0;
  const i = Math.min(k, FACETS - 1);
  const share = ((i * (i + 1)) / 2) / (((FACETS - 1) * FACETS) / 2);
  return BOW * bow * share;
}

/** How dark a facet sits: full-on when flat to the room, darkest edge-on. */
function tone(A: number, k: number, bow: number): number {
  const ang = ((A - facetAngle(k, bow)) * Math.PI) / 180;
  return 0.42 * (1 - Math.abs(Math.cos(ang)));
}

const ink = (a: number) => `rgba(28,22,10,${a.toFixed(3)})`;

interface Facet {
  panel: HTMLElement;
  face: HTMLElement;
  back: HTMLElement;
  shadeF: HTMLElement;
  shadeB: HTMLElement;
}

export interface Rig {
  flap: HTMLElement;
  facets: Facet[];
  creaseL: HTMLElement;
  creaseR: HTMLElement;
}

function el(cls: string): HTMLElement {
  const node = document.createElement("div");
  node.className = cls;
  return node;
}

/** Builds the facet chain inside `fold`, replacing anything already there. */
export function buildRig(fold: HTMLElement): Rig {
  const flap = el("book-flap");
  const facets: Facet[] = [];

  let host: HTMLElement = flap;
  for (let k = 0; k < FACETS; k++) {
    const panel = el("book-facet");
    const face = el("book-face book-ruled");
    const back = el("book-back book-ruled");
    const shadeF = el("book-shade");
    const shadeB = el("book-shade");
    face.append(shadeF);
    back.append(shadeB);
    panel.append(face, back);
    host.append(panel);
    host = panel; // the next facet hinges off this one
    facets.push({ panel, face, back, shadeF, shadeB });
  }

  const creaseL = el("book-crease book-crease-l");
  const creaseR = el("book-crease book-crease-r");
  fold.replaceChildren(creaseL, creaseR, flap);
  return { flap, facets, creaseL, creaseR };
}

/**
 * Puts the page onto the front of every facet. The backs stay blank ruled
 * paper, which is what the reverse of a diary page looks like.
 *
 * `offsetY` is the scroll position the snapshot was taken at, so the frozen
 * page sits where the eye last saw it rather than jumping to the top.
 */
export function fillFaces(rig: Rig, page: HTMLElement, offsetY: number): void {
  for (const facet of rig.facets) {
    const sheet = el("book-sheet");
    if (offsetY) sheet.style.transform = `translateY(${-offsetY}px)`;
    sheet.append(page.cloneNode(true) as HTMLElement);
    facet.face.prepend(sheet);
  }
}

/**
 * Draws one frame.
 *
 * `t` is the turn parameter, not time: 0 is the sheet lying flat and untouched,
 * 1 is fully over and past the spine. Returns the crease x, which the caller
 * needs to clip the flat pages either side of it.
 */
export function paint(rig: Rig, t: number, W: number): number {
  const A = 180 * t; // flap angle about the crease
  const f = W * (1 - Math.pow(t, 1.15)); // crease x — lags the lift early on
  const bow = Math.pow(Math.sin(Math.PI * t), 0.7); // 0..1, peaks side-on
  const skew = SKEW * Math.sin(Math.PI * t);

  rig.flap.style.transform =
    `translateX(${f}px) rotateY(${-A}deg) skewY(${skew}deg) translateX(${-f}px)`;

  const L = W - f;
  rig.facets.forEach((facet, k) => {
    const x0 = f + (L * k) / FACETS;
    const x1 = f + (L * (k + 1)) / FACETS;
    const bend = facetAngle(k, bow) - facetAngle(k - 1, bow);
    facet.panel.style.transform =
      `translateX(${x0}px) rotateY(${bend}deg) translateX(${-x0}px)`;

    facet.face.style.clipPath = `inset(0 ${W - x1}px 0 ${x0}px)`;
    facet.back.style.clipPath = `inset(0 ${x0}px 0 ${W - x1}px)`; // mirrored band

    /*
     * Each facet is a flat plane, so it takes the tone its own angle earns —
     * but ramped to the next facet's value across its band, so three flat
     * planes read as one curved sheet rather than three steps.
     */
    const t0 = tone(A, k, bow);
    const t1 = tone(A, k + 1, bow);
    facet.shadeF.style.background =
      `linear-gradient(to right, ${ink(t0 + 0.06)} ${x0}px, ${ink(t1 + 0.06)} ${x1}px)`;
    // The reverse of a sheet is the darker side the whole way over.
    facet.shadeB.style.background =
      `linear-gradient(to right, ${ink(t1 + 0.17)} ${W - x1}px, ${ink(t0 + 0.17)} ${W - x0}px)`;
  });

  rig.creaseL.style.transform = `translateX(${f}px)`;
  rig.creaseL.style.opacity = String(bow * 0.95);
  rig.creaseR.style.transform = `translateX(${f}px)`;
  rig.creaseR.style.opacity = String(bow);

  return f;
}
