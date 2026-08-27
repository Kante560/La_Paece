"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Chrome/Edge fire this instead of showing their own install bar, but only once
 * the manifest and service worker both check out. It isn't in lib.dom yet.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const SNOOZE_KEY = "pt-install-snoozed";
const SNOOZE_DAYS = 14;

/** localStorage throws outright in some privacy modes, so every touch is guarded. */
function snoozedRecently(): boolean {
  try {
    const at = Number(localStorage.getItem(SNOOZE_KEY));
    if (!at) return false;
    return Date.now() - at < SNOOZE_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

function snooze() {
  try {
    localStorage.setItem(SNOOZE_KEY, String(Date.now()));
  } catch {
    /* nothing to do — the banner just reappears next visit */
  }
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone;
  return window.matchMedia("(display-mode: standalone)").matches || iosStandalone === true;
}

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export default function InstallPrompt() {
  const pathname = usePathname();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    // Already installed: never ask again, and never in the installed window itself.
    if (isStandalone() || snoozedRecently()) return;

    /*
     * Safari never fires beforeinstallprompt and gives no programmatic install
     * at all — on iOS the only route is Share → Add to Home Screen, so the
     * honest thing is to show the instruction rather than a button that can't
     * work.
     */
    if (isIos()) {
      setIosHint(true);
      return;
    }

    const onPrompt = (e: Event) => {
      // Suppress the browser's own mini-infobar so ours is the only ask.
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setDeferred(null);
      snooze();
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  // The login screen is the one place a "keep this on your phone" pitch is premature.
  if (pathname === "/login") return null;
  if (!deferred && !iosHint) return null;

  const dismiss = () => {
    snooze();
    setDeferred(null);
    setIosHint(false);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    // Either way the event is spent — it cannot be prompted with twice.
    setDeferred(null);
    snooze();
  };

  return (
    <div
      className="fade-up fixed inset-x-0 z-40 px-4"
      /* Clears the tab bar, which sits on the safe-area inset itself. */
      style={{ bottom: "calc(env(safe-area-inset-bottom) + 4.25rem)" }}
      role="dialog"
      aria-label="Install La Paece"
    >
      <div className="card mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- a fixed 36px local
            icon needs no optimisation pipeline, and next/image would ship a wrapper
            for it. */}
        <img src="/icon-192.png" alt="" width={36} height={36} className="rounded-lg" />

        <div className="min-w-0 flex-1">
          <p className="label-hand text-[15px] leading-tight">Keep it on your home screen</p>
          <p className="mt-0.5 text-[12px] leading-snug text-ink-faint">
            {iosHint ? (
              <>
                Tap
                <svg
                  viewBox="0 0 16 16"
                  width="11"
                  height="11"
                  fill="none"
                  aria-hidden="true"
                  className="mx-1 inline-block align-[-1px]"
                >
                  <path
                    d="M8 10.5V2m0 0L5.25 4.75M8 2l2.75 2.75"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M3.5 7.5v5a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1v-5"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                  />
                </svg>
                Share, then{" "}
                <strong className="font-medium text-ink-soft">Add to Home Screen</strong>.
              </>
            ) : (
              "Opens full screen and works offline at 6am."
            )}
          </p>
        </div>

        {!iosHint && (
          <button
            type="button"
            onClick={install}
            className="shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-medium"
            style={{ background: "var(--accent)", color: "var(--paper)" }}
          >
            Install
          </button>
        )}

        <button
          type="button"
          onClick={dismiss}
          aria-label="Not now"
          className="shrink-0 px-1 text-lg leading-none text-ink-faint"
        >
          ×
        </button>
      </div>
    </div>
  );
}
