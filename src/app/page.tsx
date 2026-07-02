import { Suspense } from "react";
import HomeView from "@/components/HomeView";

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[50vh] flex items-center justify-center text-[var(--muted)] animate-pulse">
          Loading…
        </div>
      }
    >
      <HomeView />
    </Suspense>
  );
}
