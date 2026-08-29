"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import PasswordInput from "@/components/PasswordInput";
import { post } from "@/lib/api";
import { requestBookOpen } from "@/lib/bookOpen";
import { forgetAll } from "@/lib/cache";
import { resetWarm } from "@/lib/preload";
import { MIN_PASSWORD, emailError, newPasswordError } from "@/lib/validate";

/**
 * The timezone is read here rather than asked for.
 *
 * The 4am day boundary is the core of this app, and it is wrong for everyone
 * whose zone is wrong — but making that someone's second-ever decision, before
 * they have seen a single screen, costs more signups than it saves. The browser
 * knows the answer, the API validates it, and Settings can correct it.
 */
function detectTimezone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  /*
   * Nothing is marked wrong until it has been left, or until submit. Validating
   * on the first keystroke tells someone their address is invalid while they
   * are still on the "j" of their own name — technically true, and unpleasant.
   */
  const [touched, setTouched] = useState({ email: false, password: false });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  const emailProblem = emailError(email);
  const passwordProblem = newPasswordError(password);
  const showEmail = touched.email && emailProblem;
  const showPassword = touched.password && passwordProblem;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched({ email: true, password: true });
    if (emailProblem || passwordProblem) {
      if (emailProblem) emailRef.current?.focus();
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await post("/auth/signup", { email, password, timezone: detectTimezone() });
      // A different account starts from nothing, never the last one's views.
      forgetAll();
      resetWarm();
      // Signup always lands in setup — a new account has no habits yet.
      requestBookOpen();
      router.push("/welcome");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create your account");
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-[70dvh] flex-col justify-center">
      <div className="mb-8 flex flex-col items-center text-center">
        <Image
          src="/La_Paece_logo.webp"
          alt=""
          width={112}
          height={112}
          priority
          className="rounded-xl border border-rule"
        />
        <h1 className="section-title mt-4 text-2xl">Start your book</h1>
        <p className="mt-2 text-[13px] text-ink-faint">
          One page a day. It only works if it&apos;s yours.
        </p>
      </div>

      <form onSubmit={submit} noValidate className="space-y-4">
        <div>
          <label htmlFor="email" className="label-hand text-sm">
            Email
          </label>
          <input
            id="email"
            ref={emailRef}
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, email: true }))}
            aria-invalid={showEmail ? true : undefined}
            aria-describedby={showEmail ? "email-error" : undefined}
            className="mt-1 w-full rounded border bg-transparent px-3 py-2.5 text-[15px] outline-none focus:border-ink-faint"
            style={{ borderColor: showEmail ? "var(--accent)" : "var(--rule)" }}
          />
          {showEmail && (
            <p id="email-error" role="alert" className="mt-1 text-[12px] text-accent">
              {emailProblem}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="password" className="label-hand text-sm">
            Password
          </label>
          <PasswordInput
            id="password"
            value={password}
            onChange={setPassword}
            onBlur={() => setTouched((t) => ({ ...t, password: true }))}
            autoComplete="new-password"
            invalid={Boolean(showPassword)}
            describedBy="pw-hint"
          />
          {/*
            One line that does both jobs. A separate error message would make
            the hint and the complaint say the same thing twice, and the count
            is more use than "too short" while you're still typing.
          */}
          <p
            id="pw-hint"
            role={showPassword ? "alert" : undefined}
            className="mt-1 text-[12px]"
            style={{ color: showPassword ? "var(--accent)" : "var(--ink-faint)" }}
          >
            {showPassword ? passwordProblem : `At least ${MIN_PASSWORD} characters.`}
          </p>
        </div>

        {error && (
          <p role="alert" className="text-sm text-accent">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded bg-ink py-2.5 text-[15px] text-paper disabled:opacity-50"
        >
          {busy ? "…" : "Create account"}
        </button>
      </form>

      <p className="mt-6 text-center text-[13px] text-ink-faint">
        Already have one?{" "}
        <Link href="/login" className="underline underline-offset-2 hover:text-ink-soft">
          Sign in
        </Link>
      </p>
    </div>
  );
}
