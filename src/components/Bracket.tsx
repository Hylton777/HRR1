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
          viewportClassName="h-[min(68dvh,calc(100dvh-14rem))] min-h-[320px] xl:h-[min(72dvh,calc(100dvh-13rem))] xl:min-h-[360px]"
        />
      </div>
    </>
  );
}
