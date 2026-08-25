"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Every IANA zone the browser knows, no dependency.
 *
 * `Intl.supportedValuesOf` ships in every browser that can run this app, and
 * the list it returns is the one the runtime will actually accept — which a
 * bundled zone table can't promise, and which is what matters here because the
 * server hands the same string straight to `Intl.DateTimeFormat`.
 */
function allZones(): string[] {
  try {
    const withSupported = Intl as typeof Intl & {
      supportedValuesOf?: (k: string) => string[];
    };
    const zones = withSupported.supportedValuesOf?.("timeZone");
    if (zones?.length) return zones;
  } catch {
    /* fall through */
  }
  return [];
}

/** Current UTC offset, for the "GMT+1" hint next to each zone. */
function offsetLabel(zone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      timeZoneName: "shortOffset",
    }).formatToParts(new Date());
    return parts.find((p) => p.type === "timeZoneName")?.value ?? "";
  } catch {
    return "";
  }
}

interface Props {
  value: string;
  onChange: (zone: string) => void;
}

export default function TimezonePicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);

  const zones = useMemo(allZones, []);
  const detected = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return "";
    }
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/\s+/g, "_");
    const list = q ? zones.filter((z) => z.toLowerCase().includes(q)) : zones;
    return list.slice(0, 120);
  }, [zones, query]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  function pick(zone: string) {
    onChange(zone);
    setOpen(false);
    setQuery("");
  }

  // No Intl.supportedValuesOf (very old browser) — don't strand the user
  // without a way to set the field at all.
  if (zones.length === 0) {
    return (
      <input
        defaultValue={value}
        onBlur={(e) => e.target.value !== value && onChange(e.target.value)}
        className="w-full rounded border border-rule bg-transparent px-3 py-2 text-[14px] outline-none"
      />
    );
  }

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 rounded border border-rule px-3 py-2 text-left text-[14px] text-ink"
      >
        <span className="truncate">{value.replace(/_/g, " ")}</span>
        <span className="shrink-0 text-[12px] tabular-nums text-ink-faint">{offsetLabel(value)}</span>
      </button>

      {open && (
        <div className="card fade-up absolute inset-x-0 top-full z-30 mt-1 overflow-hidden">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search city or region…"
            className="w-full border-b border-rule bg-transparent px-3 py-2 text-[14px] outline-none"
          />

          {detected && detected !== value && (
            <button
              type="button"
              onClick={() => pick(detected)}
              className="flex w-full items-center justify-between gap-2 border-b border-rule px-3 py-2 text-left text-[13px]"
            >
              <span className="truncate text-ink">Use this device — {detected.replace(/_/g, " ")}</span>
              <span className="shrink-0 text-[11px] text-ink-faint">{offsetLabel(detected)}</span>
            </button>
          )}

          <ul className="max-h-64 overflow-y-auto">
            {results.map((zone) => (
              <li key={zone}>
                <button
                  type="button"
                  onClick={() => pick(zone)}
                  className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-[13px] transition-colors hover:bg-paper"
                  style={{ color: zone === value ? "var(--accent)" : "var(--ink-soft)" }}
                >
                  <span className="truncate">{zone.replace(/_/g, " ")}</span>
                  <span className="shrink-0 text-[11px] tabular-nums text-ink-faint">
                    {offsetLabel(zone)}
                  </span>
                </button>
              </li>
            ))}
            {results.length === 0 && (
              <li className="px-3 py-3 text-[13px] text-ink-faint">No zone matches that.</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
