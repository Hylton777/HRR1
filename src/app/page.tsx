import Dashboard from "@/components/Dashboard";

export default function Home() {
  return (
    <main className="max-w-[1600px] mx-auto px-3 sm:px-4 py-4 sm:py-8">
      <header className="mb-6 sm:mb-8 border-b border-[var(--card-border)] pb-4 sm:pb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-1 h-8 sm:h-10 bg-[var(--accent)] rounded-full shrink-0" />
          <div className="min-w-0">
            <p className="text-xs sm:text-sm uppercase tracking-widest text-[var(--loser)]">
              Henley Royal Regatta 2026
            </p>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold leading-tight">
              Princess Elizabeth Challenge Cup
            </h1>
          </div>
        </div>
        <p className="text-sm text-[var(--loser)] ml-4 pl-3">
          Live knockout bracket — 32 crews · Junior men&apos;s eights
        </p>
      </header>

      <Dashboard />
    </main>
  );
}
