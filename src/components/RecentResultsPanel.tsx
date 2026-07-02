"use client";

import { useMemo, useState } from "react";
import FastestCrewsModal from "@/components/FastestCrewsModal";
import RaceResultCard from "@/components/RaceResultCard";
import { hasFastestCrewsData } from "@/lib/fastest-crews";
import type { BracketMatch, HrrResult } from "@/lib/types";

const INITIAL_COUNT = 5;

interface RecentResultsPanelProps {
  results: HrrResult[];
  rounds: BracketMatch[][];
}

export default function RecentResultsPanel({
  results,
  rounds,
}: RecentResultsPanelProps) {
  const [showAll, setShowAll] = useState(false);
  const [showFastest, setShowFastest] = useState(false);
  const visible = showAll ? results : results.slice(0, INITIAL_COUNT);
  const hasMore = results.length > INITIAL_COUNT;
  const canShowFastest = useMemo(
    () => hasFastestCrewsData(rounds, results),
    [rounds, results],
  );

  return (
    <>
      <h2 className="font-display text-lg font-semibold mb-4 text-[var(--hrr-navy)]">
        Recent Results
      </h2>
      <div className="space-y-3">
        {visible.length === 0 ? (
          <p className="text-[var(--muted)] text-sm">
            No races completed yet.
          </p>
        ) : (
          visible.map((result) => (
            <RaceResultCard key={result.id} result={result} />
          ))
        )}
      </div>
      {hasMore && (
        <button
          type="button"
          onClick={() => setShowAll((open) => !open)}
          className="mt-3 w-full rounded-sm border border-[var(--card-border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--hrr-blue)] font-medium hover:border-[var(--hrr-blue)]/40 transition-colors"
        >
          {showAll
            ? "Show less"
            : `Show more (${results.length - INITIAL_COUNT} more)`}
        </button>
      )}
      <button
        type="button"
        disabled={!canShowFastest}
        onClick={() => setShowFastest(true)}
        className="mt-3 w-full rounded-sm border border-[var(--card-border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--hrr-blue)] font-medium hover:border-[var(--hrr-blue)]/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-[var(--card-border)]"
      >
        Who is fastest so far?
      </button>
      {showFastest && (
        <FastestCrewsModal
          rounds={rounds}
          results={results}
          onClose={() => setShowFastest(false)}
        />
      )}
      <p className="text-xs text-[var(--muted)] leading-relaxed mt-4">
        Data sourced from{" "}
        <a
          href="https://www.hrr.co.uk/results/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-[var(--hrr-blue)]"
        >
          Henley Royal Regatta live results
        </a>
        .
      </p>
    </>
  );
}
