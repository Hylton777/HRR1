import Dashboard from "@/components/Dashboard";

export default function Home() {
  return (
    <>
      <div className="hrr-header-bar text-white">
        <div className="max-w-[1600px] mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <p className="text-[10px] sm:text-xs uppercase tracking-[0.25em] text-white/70">
            Henley Royal Regatta 2026
          </p>
          <h1 className="font-display text-xl sm:text-2xl md:text-3xl font-bold leading-tight mt-1">
            Princess Elizabeth Challenge Cup
          </h1>
          <p className="text-xs sm:text-sm text-white/75 mt-1">
            Live knockout bracket · 32 crews · Junior men&apos;s eights
          </p>
        </div>
      </div>

      <main className="max-w-[1600px] mx-auto px-3 sm:px-4 py-4 sm:py-8">
        <Dashboard />
      </main>
    </>
  );
}
