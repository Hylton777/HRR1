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
      <div className="hidden md:block md:sticky md:top-0 md:z-20 md:h-[calc(100dvh-3.5rem)]">
        <BracketFitViewport
          bracket={bracket}
          layout="split"
          viewportClassName="h-full min-h-0"
        />
      </div>
    </>
  );
}
