/*
 * The loading state, as a lifter doing curls.
 *
 * Waiting is dead time, so it may as well be on-brand: the app is about
 * showing up and doing the reps, and that's literally what the spinner does.
 * Colours come from the theme tokens, so it reads correctly on night paper
 * without a second asset.
 */

interface Props {
  /** Pixel size of the figure. */
  size?: number;
  /** Optional caption underneath. Omit for inline/button use. */
  label?: string;
  className?: string;
}

export default function Loader({ size = 96, label, className = "" }: Props) {
  return (
    <div className={`grid place-items-center gap-3.5 ${className}`} role="status" aria-live="polite">
      <svg
        width={size}
        height={size}
        viewBox="0 0 80 80"
        fill="none"
        aria-hidden="true"
        className="overflow-visible"
      >
        <ellipse className="lift-shadow" cx="40" cy="77" rx="16" ry="2.4" fill="var(--ink-faint)" />
        <g className="lift-body">
          <circle cx="40" cy="13" r="6.2" fill="var(--ink)" />
          <path d="M36.8 17.5h6.4v6h-6.4z" fill="var(--ink)" />
          {/* torso: V-taper, ends at the waist so the legs can read */}
          <path
            d="M26.5 25.5c4-3.2 22.9-3.2 27 0 2.3 1.8 1.1 6.2-1.2 10.2-1.5 2.6-2.5 7-2.9 12.3H30.6c-.4-5.3-1.4-9.7-2.9-12.3-2.3-4-3.5-8.4-1.2-10.2Z"
            fill="var(--ink)"
          />
          {/* legs */}
          <path d="M35.6 47.5 33.4 72.5" stroke="var(--ink)" strokeWidth="7.2" strokeLinecap="round" />
          <path d="M44.4 47.5 46.6 72.5" stroke="var(--ink)" strokeWidth="7.2" strokeLinecap="round" />
          {/* upper arms, fixed at the sides */}
          <path d="M27.8 28 22 45" stroke="var(--ink)" strokeWidth="6.4" strokeLinecap="round" />
          <path d="M52.2 28 58 45" stroke="var(--ink)" strokeWidth="6.4" strokeLinecap="round" />

          {/* forearm + dumbbell rotate together at the elbow */}
          <g className="lift-fore lift-fore-l">
            <path d="M22 45 20 60" stroke="var(--ink)" strokeWidth="5.8" strokeLinecap="round" />
            <path d="M14 60h12" stroke="var(--accent)" strokeWidth="2.8" strokeLinecap="round" />
            <rect x="11.6" y="55.9" width="3.9" height="8.2" rx="1.5" fill="var(--accent)" />
            <rect x="24.5" y="55.9" width="3.9" height="8.2" rx="1.5" fill="var(--accent)" />
          </g>
          <g className="lift-fore lift-fore-r">
            <path d="M58 45 60 60" stroke="var(--ink)" strokeWidth="5.8" strokeLinecap="round" />
            <path d="M54 60h12" stroke="var(--accent)" strokeWidth="2.8" strokeLinecap="round" />
            <rect x="51.6" y="55.9" width="3.9" height="8.2" rx="1.5" fill="var(--accent)" />
            <rect x="64.5" y="55.9" width="3.9" height="8.2" rx="1.5" fill="var(--accent)" />
          </g>
        </g>
      </svg>
      {label && <span className="lift-label text-[13px] tracking-[0.02em] text-ink-faint">{label}</span>}
      <span className="sr-only">Loading</span>
    </div>
  );
}

/** Full-page loading state — the one that replaces "Loading…". */
export function PageLoader({ label = "Warming up…" }: { label?: string }) {
  return (
    <div className="grid place-items-center pt-24">
      <Loader size={112} label={label} />
    </div>
  );
}
