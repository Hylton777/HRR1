"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  crewDisplayName,
  formatRaceMeta,
  formatStation,
  type RaceResultDetail,
} from "@/lib/race-result";
import { isSeededCrew } from "@/lib/crew-seeds";

interface RaceResultModalProps {
  detail: RaceResultDetail;
  onClose: () => void;
}

function DetailItem({
  label,
  value,
  className = "",
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={`text-center ${className}`}>
      <span className="block text-sm text-[var(--muted)]">{label}</span>
      <span className="block text-[13px] font-medium text-[var(--hrr-navy)] tabular-nums mt-0.5">
        {value}
      </span>
    </div>
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

  const modal = (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="race-result-dialog fixed inset-0 z-[100] m-0 h-full max-h-none w-full max-w-none border-0 bg-transparent p-0 backdrop:bg-[var(--hrr-navy)]/50 open:flex open:items-end sm:open:items-center open:justify-center"
    >
      <button
        type="button"
        aria-label="Close race result"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <div
        role="document"
        className="relative z-10 w-full max-w-lg rounded-t-lg sm:rounded-none border border-[var(--card-border)] bg-[var(--card)] shadow-xl mx-0 sm:mx-4 max-h-[90vh] overflow-y-auto"
      >
        <div className="bg-[var(--hrr-blue)] px-3 py-2 flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium text-white">
            Princess Elizabeth Challenge Cup
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

        <div className="p-4 sm:p-5 grid grid-cols-12 gap-x-1.5 gap-y-3">
          <DetailItem
            label="Race"
            value={detail.raceNumber ?? "—"}
            className="col-span-4"
          />
          <DetailItem
            label="Round"
            value={detail.roundLabel}
            className="col-span-4"
          />
          <DetailItem
            label="Day"
            value={
              [detail.raceDay, detail.raceTime].filter(Boolean).join(" ") || "—"
            }
            className="col-span-4"
          />

          <div className="col-span-12 text-center pt-1">
            <p className={`text-xl font-display leading-tight text-[var(--hrr-blue)] ${isSeededCrew(detail.winner) ? "font-bold" : "font-semibold"}`}>
              {crewDisplayName(detail.winner)}
            </p>
            <p className="text-[13px] italic text-[var(--muted)] mt-1">beat</p>
            <p className={`text-[13px] mt-0.5 text-[var(--hrr-blue)]/80 ${isSeededCrew(detail.loser) ? "font-bold" : ""}`}>
              {crewDisplayName(detail.loser)}
            </p>
            {detail.withdrawn && (
              <p className="text-xs text-[var(--accent)] mt-1">Withdrawn</p>
            )}
          </div>

          <div className="col-span-12 border-t border-[var(--card-border)]" />

          <div className="col-span-6 text-center text-sm">
            <span className="text-[var(--muted)]">Station </span>
            <span className="font-medium text-[var(--hrr-navy)]">
              {station ?? "—"}
            </span>
          </div>
          <div className="col-span-6 text-center text-sm">
            <span className="text-[var(--muted)]">Result </span>
            <span className="font-medium text-[var(--hrr-navy)]">
              {detail.verdict}
            </span>
          </div>

          <div className="col-span-12 border-t border-[var(--card-border)] mb-1" />

          {detail.splits.barrier && (
            <DetailItem
              label="Barrier"
              value={detail.splits.barrier.time}
              className="col-span-3"
            />
          )}
          {detail.splits.fawley && (
            <DetailItem
              label="Fawley"
              value={detail.splits.fawley.time}
              className="col-span-3"
            />
          )}
          {detail.splits.finish && (
            <DetailItem
              label="Finish"
              value={detail.splits.finish.time}
              className="col-span-3"
            />
          )}
          <div className="col-span-3 flex items-center justify-center text-center">
            <div>
              <span className="block text-sm text-[var(--muted)]">Margin</span>
              <span className="block text-[13px] font-semibold text-[var(--hrr-navy)] mt-0.5">
                {detail.verdict}
              </span>
            </div>
          </div>

          {(detail.splits.barrier?.loserLeading ||
            detail.splits.fawley?.loserLeading) && (
            <div className="col-span-12 text-xs text-[var(--muted)] text-center">
              {detail.splits.barrier?.loserLeading && (
                <span className="mr-3">Loser leading at Barrier</span>
              )}
              {detail.splits.fawley?.loserLeading && (
                <span>Loser leading at Fawley</span>
              )}
            </div>
          )}

          <p className="col-span-12 text-[10px] text-center text-[var(--muted)] pt-1">
            {formatRaceMeta(detail)}
          </p>
        </div>
      </div>
    </dialog>
  );

  if (typeof document === "undefined") return null;
  return createPortal(modal, document.body);
}
