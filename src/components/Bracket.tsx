"use client";

import type { BracketState } from "@/lib/types";
import BracketMobileZoom from "./BracketMobileZoom";
import BracketTreeCore from "./BracketTreeCore";

interface BracketProps {
  bracket: BracketState;
}

export default function Bracket({ bracket }: BracketProps) {
  return (
    <>
      <div className="md:hidden">
        <BracketMobileZoom bracket={bracket} />
      </div>
      <div className="hidden md:block bracket-scroll overflow-x-auto pb-4 -mx-2 px-2">
        <BracketTreeCore bracket={bracket} />
      </div>
    </>
  );
}
