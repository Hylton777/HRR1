"use client";

import { useEffect, useRef } from "react";
import {
  crewDisplayName,
  formatRaceMeta,
  formatStation,
  type RaceResultDetail,
} from "@/lib/race-result";

interface RaceResultModalProps {
  detail: RaceResultDetail;
  onClose: () => void;
}

function TimingRow({
  label,
  time,
  loserLeading,
}: {
  label: string;
  time: string;
  loserLeading?: boolean;
}) {
  return (
    <tr className="border-b border-[var(--card-border)] last:border-0">
      <td className="py-2.5 pr-4 text-sm text-[var(--muted)]">{label}</td>
      <td className="py-2.5 text-sm font-medium tabular-nums">{time}</td>
      <td className="py-2.5 pl-3 text-xs text-[var(--muted)]">
        {loserLeading ? "Loser leading" : ""}
      </td>
    </tr>
  );
}

export default function RaceResultModal({
  detail,
  onClose,
}: RaceResultModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const station = formatStation(detail.station);

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

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="race-result-dialog fixed inset-0 z-50 m-0 h-full max-h-none w-full max-w-none border-0 bg-transparent p-0 backdrop:bg-[var(--hrr-navy)]/50 open:flex open:items-end sm:open:items-center open:justify-center"
    >
      <button
        type="button"
        aria-label="Close race result"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <div
        role="document"
        className="relative z-10 w-full max-w-md rounded-t-lg sm:rounded-lg border border-[var(--card-border)] bg-[var(--card)] shadow-xl mx-0 sm:mx-4 max-h-[90vh] overflow-y-auto"
      >
        <div className="bg-[var(--hrr-cream)] border-b border-[var(--card-border)] px-4 py-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-[var(--muted)]">{formatRaceMeta(detail)}</p>
            <h2 className="font-display text-lg font-semibold text-[var(--hrr-navy)]">
              {detail.roundLabel}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 w-8 h-8 rounded-sm border border-[var(--card-border)] text-[var(--muted)] hover:text-[var(--hrr-navy)] hover:border-[var(--hrr-blue)]"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="px-4 py-4 space-y-4">
          <div>
            <p className="text-base font-semibold text-[var(--winner)]">
              {crewDisplayName(detail.winner)}
              {station && (
                <span className="ml-2 text-xs font-normal text-[var(--muted)]">
                  ({station})
                </span>
              )}
            </p>
            <p className="text-sm text-[var(--muted)] mt-1">
              beat {crewDisplayName(detail.loser)}
            </p>
            {detail.withdrawn && (
              <p className="text-xs text-[var(--accent)] mt-1">Withdrawn</p>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--hrr-navy)] mb-2">
              Winning times
            </p>
            <table className="w-full">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wide text-[var(--muted)] border-b border-[var(--card-border)]">
                  <th className="pb-2 pr-4 font-medium">Checkpoint</th>
                  <th className="pb-2 font-medium">Time</th>
                  <th className="pb-2 pl-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {detail.splits.barrier && (
                  <TimingRow
                    label="Barrier"
                    time={detail.splits.barrier.time}
                    loserLeading={detail.splits.barrier.loserLeading}
                  />
                )}
                {detail.splits.fawley && (
                  <TimingRow
                    label="Fawley"
                    time={detail.splits.fawley.time}
                    loserLeading={detail.splits.fawley.loserLeading}
                  />
                )}
                {detail.splits.finish && (
                  <TimingRow label="Finish" time={detail.splits.finish.time} />
                )}
              </tbody>
            </table>
          </div>

          <div className="rounded-sm bg-[var(--hrr-cream)] border border-[var(--card-border)] px-3 py-2.5 flex items-center justify-between">
            <span className="text-xs text-[var(--muted)]">Winning margin</span>
            <span className="text-sm font-semibold text-[var(--hrr-navy)]">
              {detail.verdict}
            </span>
          </div>
        </div>
      </div>
    </dialog>
  );
}
