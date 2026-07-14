import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { Logo } from "@/components/Logo";

export default async function LandingPage() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  return (
    <main className="flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2.5">
          <Logo />
          <span className="font-display text-lg font-bold tracking-tight">StockPilot</span>
        </div>
        <nav className="flex items-center gap-3">
          <Link href="/login" className="btn-ghost rounded-lg px-4 py-2 text-sm">
            Sign in
          </Link>
          <Link href="/signup" className="btn-accent rounded-lg px-4 py-2 text-sm">
            Create account
          </Link>
        </nav>
      </header>

      <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center px-6 pb-24 pt-10 text-center">
        <p className="mb-5 rounded-full border border-border-strong bg-surface px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-ink-secondary">
          Inventory Management
        </p>
        <h1 className="font-display max-w-3xl text-5xl font-bold leading-tight tracking-tight sm:text-6xl">
          Inventory that <span className="text-accent">warns you first</span>.
        </h1>
        <p className="mt-6 max-w-xl text-lg text-ink-secondary">
          An append-only stock ledger, purchase orders that receive into stock atomically, low-stock
          alerts tied to real sales velocity — and an AI advisor that tells you what to reorder before
          it&apos;s a problem.
        </p>
        <div className="mt-10 flex items-center gap-4">
          <Link href="/signup" className="btn-accent rounded-xl px-7 py-3.5 text-sm">
            Open the warehouse
          </Link>
          <Link href="/login" className="btn-ghost rounded-xl px-7 py-3.5 text-sm">
            Demo: demo@stockpilot.app
          </Link>
        </div>

        <div className="mt-20 grid w-full gap-4 text-left sm:grid-cols-3">
          <Feature
            title="A ledger, not a spreadsheet"
            body="Every unit in or out is an immutable movement with a running balance — on-hand quantity is derived, auditable, and can never silently drift."
          />
          <Feature
            title="Purchasing built in"
            body="Draft → ordered → received. Receiving a PO increments stock and writes the ledger in one transaction, so the books always agree."
          />
          <Feature
            title="An advisor, not just alerts"
            body="Claude reads 30-day velocity, lead times, and cover to rank what to reorder now, what can wait, and which stock is dead cash."
          />
        </div>
      </section>

      <footer className="border-t border-border py-6 text-center text-xs text-muted">
        StockPilot · a portfolio project — Next.js · MySQL · Prisma · NextAuth · Recharts · Claude API
      </footer>
    </main>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className="panel panel-hover p-6">
      <h3 className="mb-2 text-sm font-bold text-accent">{title}</h3>
      <p className="text-sm leading-relaxed text-ink-secondary">{body}</p>
    </div>
  );
}
