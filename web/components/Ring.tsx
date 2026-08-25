interface Props {
  pct: number;
  size?: number;
  stroke?: number;
  label?: string;
}

export default function Ring({ pct, size = 96, stroke = 7, label }: Props) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const filled = Math.max(0, Math.min(100, pct));

  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--rule)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={filled >= 80 ? "var(--good)" : filled >= 50 ? "var(--ink-soft)" : "var(--accent)"}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (filled / 100) * c}
          style={{ transition: "stroke-dashoffset 450ms cubic-bezier(.22,1,.36,1)" }}
        />
      </svg>
      <div className="absolute text-center leading-none">
        <div className="text-[22px] font-semibold tabular-nums text-ink">{Math.round(filled)}%</div>
        {label && <div className="mt-1 text-[10px] uppercase tracking-wide text-ink-faint">{label}</div>}
      </div>
    </div>
  );
}
