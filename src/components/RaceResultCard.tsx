"use client";

import { useState } from "react";
import {
  crewDisplayName,
  raceResultFromHrr,
  type RaceResultDetail,
} from "@/lib/race-result";
import { isSeededCrew } from "@/lib/crew-seeds";
import type { HrrResult } from "@/lib/types";
import RaceResultModal from "./RaceResultModal";

interface RaceResultCardProps {
  result: HrrResult;
}

export default function RaceResultCard({ result }: RaceResultCardProps) {
  const [detail, setDetail] = useState<RaceResultDetail | null>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => setDetail(raceResultFromHrr(result))}
        className="w-full text-left bg-[var(--card)] border border-[var(--card-border)] rounded-sm p-3 text-sm shadow-sm hover:border-[var(--hrr-blue)]/40 transition-colors"
      >
        <div className="text-xs text-[var(--muted)] mb-1">
          Race {result.number} · {result.raceDay} {result.raceTime}
        </div>
        <div className={`font-medium text-[var(--winner)] ${isSeededCrew(result.winner) ? "font-bold" : ""}`}>
          {crewDisplayName(result.winner)}
        </div>
        <div className="text-[var(--muted)] text-xs">
          beat{" "}
          <span className={isSeededCrew(result.loser) ? "font-bold" : ""}>
            {crewDisplayName(result.loser)}
          </span>
        </div>
        {result.verdict && (
          <div className="text-xs text-[var(--hrr-navy)] font-medium mt-1.5">
            {result.verdict}
            {result.finish?.split ? (
              <span className="text-[var(--muted)] font-normal">
                {" "}
                · {result.finish.split}
              </span>
            ) : null}
          </div>
        )}
        <p className="text-[10px] text-[var(--muted)] mt-2">
          Tap for barrier, Fawley &amp; finish times
        </p>
      </button>
      {detail && (
        <RaceResultModal detail={detail} onClose={() => setDetail(null)} />
      )}
    </>
  );
}
