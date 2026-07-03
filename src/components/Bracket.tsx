"use client";

import type { BracketState } from "@/lib/types";
import BracketFitViewport from "./BracketFitViewport";
import BracketMobileZoom from "./BracketMobileZoom";

interface BracketProps {
  bracket: BracketState;
}

export default function Bracket({ bracket }: BracketProps) {
  return (
    <>
      <div className="md:hidden">
        <BracketMobileZoom bracket={bracket} />
      </div>
      <div className="hidden md:block">
        <BracketFitViewport
          bracket={bracket}
          viewportClassName="h-[min(80dvh,calc(100dvh-9rem))] min-h-[400px]"
        />
      </div>
    </>
  );
}
