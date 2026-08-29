"use client";

import { useId, useState } from "react";

interface Props {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  autoComplete: "current-password" | "new-password";
  invalid?: boolean;
  describedBy?: string;
  required?: boolean;
  minLength?: number;
}

/**
 * The eye.
 *
 * Two shapes rather than an eye with a line through it: an open lid and a
 * closed one. A slashed eye is genuinely ambiguous — half the world reads it as
 * "hidden", the other half as "click to hide" — whereas a lid that is open or
 * shut says which state you are *in*, which is what the button is reporting.
 */
function Eye({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true">
      {open ? (
        <>
          <path
            d="M1.8 10S5 4.8 10 4.8 18.2 10 18.2 10 15 15.2 10 15.2 1.8 10 1.8 10Z"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
          <circle cx="10" cy="10" r="2.4" stroke="currentColor" strokeWidth="1.3" />
        </>
      ) : (
        <>
          {/* A closed lid, with the lashes you'd draw on a sleeping eye. */}
          <path
            d="M2.2 8.6c2 2.6 4.6 3.9 7.8 3.9s5.8-1.3 7.8-3.9"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
          <path
            d="M4.4 11.3 3.1 13M10 12.6V14.6M15.6 11.3 16.9 13"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
        </>
      )}
    </svg>
  );
}

/**
 * A password field you can look at.
 *
 * Typing a password you cannot see, on a phone keyboard, is how people end up
 * with an account whose password they never actually knew — so the reveal is
 * a plain toggle rather than a press-and-hold, and it never touches the value.
 */
export default function PasswordInput({
  id,
  value,
  onChange,
  onBlur,
  autoComplete,
  invalid,
  describedBy,
  required,
  minLength,
}: Props) {
  const [show, setShow] = useState(false);
  const fallback = useId();
  const inputId = id ?? fallback;

  return (
    <div className="relative mt-1">
      <input
        id={inputId}
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        autoComplete={autoComplete}
        required={required}
        minLength={minLength}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className="w-full rounded border bg-transparent py-2.5 pl-3 pr-12 text-[15px] outline-none focus:border-ink-faint"
        style={{ borderColor: invalid ? "var(--accent)" : "var(--rule)" }}
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        // The label states what pressing it does; aria-pressed carries the state,
        // so a screen reader never has to infer one from the other.
        aria-label={show ? "Hide password" : "Show password"}
        aria-pressed={show}
        aria-controls={inputId}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-ink-faint hover:text-ink-soft"
      >
        <Eye open={show} />
      </button>
    </div>
  );
}
