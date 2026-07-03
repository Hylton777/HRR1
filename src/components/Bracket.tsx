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
      <div className="hidden md:block md:sticky md:top-0 md:z-20 md:h-[100dvh] md:w-screen md:relative md:left-1/2 md:-translate-x-1/2">
        <BracketFitViewport
          bracket={bracket}
          layout="split"
          viewportClassName="h-full min-h-0 border-0 shadow-none rounded-none"
          showZoomControls={false}
          contentPaddingClassName="p-0"
          fitPadding={0}
        />
      </div>
    </>
  );
}
