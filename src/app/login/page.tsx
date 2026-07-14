"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/Logo";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("demo@stockpilot.app");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await signIn("credentials", { email, password, redirect: false });
    setBusy(false);
    if (res?.error) {
      setError("Invalid email or password.");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3">
          <Logo size={42} />
          <h1 className="font-display text-3xl font-bold tracking-tight">Welcome back</h1>
          <p className="text-sm text-ink-secondary">Sign in to your warehouse</p>
        </div>

        <form onSubmit={onSubmit} className="panel space-y-4 p-7">
          <div>
            <label htmlFor="email" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted">
              Email
            </label>
            <input id="email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
          </div>
          <div>
            <label htmlFor="password" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted">
              Password
            </label>
            <input
              id="password"
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="demo1234"
              autoComplete="current-password"
              required
            />
          </div>

          {error && <p className="text-sm text-critical">{error}</p>}

          <button type="submit" disabled={busy} className="btn-accent w-full rounded-lg px-4 py-2.5 text-sm disabled:opacity-60">
            {busy ? "Signing in…" : "Sign in"}
          </button>

          <p className="pt-1 text-center text-xs text-muted">Demo login: demo@stockpilot.app / demo1234</p>
        </form>

        <p className="mt-6 text-center text-sm text-ink-secondary">
          New here?{" "}
          <Link href="/signup" className="font-semibold text-accent hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </main>
  );
}
