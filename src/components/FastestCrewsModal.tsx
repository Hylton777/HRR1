"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { crewDisplayName } from "@/lib/race-result";
import { enrichCrewFromEvent, isSeededCrew } from "@/lib/crew-seeds";
import {
  buildFastestCrewsLeaderboard,
  landmarkLabel,
  type Landmark,
} from "@/lib/fastest-crews";
import type { BracketMatch, HrrResult } from "@/lib/types";
import { useEvent } from "./EventContext";

const LANDMARKS: Landmark[] = ["barrier", "fawley", "finish"];
const INITIAL_COUNT = 5;

interface FastestCrewsModalProps {
  rounds: BracketMatch[][];
  results: HrrResult[];
  onClose: () => void;
}

export default function FastestCrewsModal({
  rounds,
  results,
  onClose,
}: FastestCrewsModalProps) {
  const event = useEvent();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [landmark, setLandmark] = useState<Landmark>("barrier");
  const [showAll, setShowAll] = useState(false);

  const leaderboard = useMemo(
    () => buildFastestCrewsLeaderboard(rounds, landmark, results),
    [rounds, landmark, results],
  );

  useEffect(() => {
    setShowAll(false);
  }, [landmark]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();

    const onCancel = (event: Event) => {
      event.preventDefault();
      onClose();
    };

    dialog.addEventListener("cancel", onCancel);
    return () => dialog.removeEventListener("cancel", onCancel);
  }, [onClose]);

  const entries = leaderboard?.entries ?? [];
  const visible = showAll ? entries : entries.slice(0, INITIAL_COUNT);
  const hasMore = entries.length > INITIAL_COUNT;
  const hasLoserLeading = entries.some((entry) => entry.loserLeading);

  const modal = (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="race-result-dialog fixed inset-0 z-[100] m-0 h-full max-h-none w-full max-w-none border-0 bg-transparent p-0 backdrop:bg-[var(--hrr-navy)]/50 open:flex open:items-end sm:open:items-center open:justify-center"
    >
      <button
        type="button"
        aria-label="Close fastest crews leaderboard"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <div
        role="document"
        className="relative z-10 w-full max-w-lg rounded-t-lg sm:rounded-none border border-[var(--card-border)] bg-[var(--card)] shadow-xl mx-0 sm:mx-4 max-h-[90vh] overflow-y-auto"
      >
        <div className="bg-[var(--hrr-blue)] px-3 py-2 flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium text-white leading-snug">
            {leaderboard
              ? `${leaderboard.roundLabel} — Fastest to ${landmarkLabel(landmark)}`
              : event.displayName}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 text-white/90 hover:text-white text-lg leading-none px-1"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="p-4 sm:p-5">
          <div
            className="flex rounded-sm border border-[var(--card-border)] overflow-hidden mb-4"
            role="tablist"
            aria-label="Landmark"
          >
            {LANDMARKS.map((option) => {
              const active = landmark === option;
              return (
                <button
                  key={option}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setLandmark(option)}
                  className={`flex-1 px-2 py-2 text-xs sm:text-sm font-medium transition-colors ${
                    active
                      ? "bg-[var(--hrr-blue)] text-white"
                      : "bg-[var(--card)] text-[var(--muted)] hover:text-[var(--hrr-navy)]"
                  }`}
                >
                  {landmarkLabel(option)}
                </button>
              );
            })}
          </div>

          {visible.length === 0 ? (
            <p className="text-sm text-[var(--muted)] text-center py-6">
              No split times available for this round yet.
            </p>
          ) : (
            <ol className="space-y-2">
              {visible.map((entry, index) => {
                const crew =
                  enrichCrewFromEvent(entry.crew, event) ?? entry.crew;
                const rank = index + 1;

                return (
                  <li
                    key={`${crew.name}-${entry.time}-${rank}`}
                    className="flex items-center gap-3 rounded-sm border border-[var(--card-border)] bg-[var(--card)] px-3 py-2.5"
                  >
                    <span className="w-6 shrink-0 text-sm font-semibold text-[var(--muted)] tabular-nums text-center">
                      {rank}
                    </span>
                    <span
                      className={`flex-1 min-w-0 text-sm text-[var(--hrr-navy)] truncate ${
                        isSeededCrew(crew, event) ? "font-bold" : "font-medium"
                      }`}
                    >
                      {crewDisplayName(crew)}
                    </span>
                    <span className="shrink-0 text-sm font-medium text-[var(--hrr-blue)] tabular-nums">
                      {entry.time}
                      {entry.loserLeading ? "*" : ""}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}

          {hasMore && (
            <button
              type="button"
              onClick={() => setShowAll((open) => !open)}
              className="mt-3 w-full rounded-sm border border-[var(--card-border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--hrr-blue)] font-medium hover:border-[var(--hrr-blue)]/40 transition-colors"
            >
              {showAll
                ? "Show less"
                : `Show all (${entries.length - INITIAL_COUNT} more)`}
            </button>
          )}

          {hasLoserLeading && landmark !== "finish" && (
            <p className="text-xs text-[var(--muted)] text-center mt-4">
              * Loser was leading at {landmarkLabel(landmark).toLowerCase()}
            </p>
          )}
        </div>
      </div>
    </dialog>
  );

  if (typeof document === "undefined") return null;
  return createPortal(modal, document.body);
}
