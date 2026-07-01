import Dashboard from "@/components/Dashboard";

export default function Home() {
  return (
    <main className="max-w-[1600px] mx-auto px-4 py-8">
      <header className="mb-8 border-b border-[var(--card-border)] pb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-1 h-10 bg-[var(--accent)] rounded-full" />
          <div>
            <p className="text-sm uppercase tracking-widest text-[var(--loser)]">
              Henley Royal Regatta 2026
            </p>
            <h1 className="text-2xl md:text-3xl font-bold">
              Princess Elizabeth Challenge Cup
            </h1>
          </div>
        </div>
        <p className="text-[var(--loser)] ml-4 pl-3">
          Live knockout bracket — 32 crews · Junior men&apos;s eights
        </p>
      </header>

      <Dashboard />
    </main>
  );
}
