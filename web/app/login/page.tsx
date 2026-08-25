"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { post } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await post("/auth/login", { email, password });
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
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
        <h1 className="section-title mt-4 text-2xl">La Paece</h1>
        <p className="mt-2 text-[13px] text-ink-faint">Keep pushing the stone.</p>
      </div>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label-hand text-sm">Email</label>
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded border border-rule bg-transparent px-3 py-2.5 text-[15px] outline-none focus:border-ink-faint"
          />
        </div>
        <div>
          <label className="label-hand text-sm">Password</label>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded border border-rule bg-transparent px-3 py-2.5 text-[15px] outline-none focus:border-ink-faint"
          />
        </div>
        {error && <p className="text-sm text-accent">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded bg-ink py-2.5 text-[15px] text-paper disabled:opacity-50"
        >
          {busy ? "…" : "Enter"}
        </button>
      </form>
    </div>
  );
}
