"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Autosave with a trailing debounce. Nobody presses Save in a journal — and a
 * reflection you lose because you closed the tab is a reflection you never
 * write again.
 */
export function useAutosave<T>(save: (value: T) => Promise<unknown>, delay = 700) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const saveRef = useRef(save);
  saveRef.current = save;

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  return useCallback(
    (value: T) => {
      if (timer.current) clearTimeout(timer.current);
      setStatus("saving");
      timer.current = setTimeout(() => {
        saveRef.current(value)
          .then(() => {
            setStatus("saved");
            setTimeout(() => setStatus("idle"), 1200);
          })
          .catch(() => setStatus("idle"));
      }, delay);
    },
    [delay],
  ) as ((value: T) => void) & { status?: string };
}

export function useSaveStatus() {
  return useState<"idle" | "saving" | "saved">("idle");
}
