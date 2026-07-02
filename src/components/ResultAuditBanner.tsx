"use client";

import type { ResultAudit } from "@/lib/types";

interface ResultAuditBannerProps {
  audit: ResultAudit | undefined;
}

export default function ResultAuditBanner({ audit }: ResultAuditBannerProps) {
  if (!audit || audit.isComplete) return null;

  const preview = audit.missingResults.slice(0, 3);
  const remaining = audit.missingResults.length - preview.length;

  return (
    <div
      className="rounded-sm border border-amber-300/80 bg-amber-50 text-amber-950 px-3 py-2 text-sm"
      role="status"
    >
      <p className="font-medium">
        Some race results may be missing for this event.
      </p>
      <p className="mt-1 text-amber-900/90">
        {audit.completeCount} of {audit.expectedRacedCount} known races have
        results · {audit.fetchedResultCount} fetched from HRR
        {audit.unmatchedResultCount > 0
          ? ` · ${audit.unmatchedResultCount} unmatched`
          : ""}
      </p>
      {audit.warnings.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs text-amber-900/90">
          {audit.warnings.map((warning) => (
            <li key={warning}>• {warning}</li>
          ))}
        </ul>
      )}
      {preview.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs text-amber-900/90">
          {preview.map((item) => (
            <li key={item.matchId}>
              • {item.roundLabel}
              {item.raceNumber ? ` · Race ${item.raceNumber}` : ""}
              {item.raceTime ? ` · ${item.raceTime}` : ""}: {item.berks} vs{" "}
              {item.bucks}
            </li>
          ))}
          {remaining > 0 && <li>• …and {remaining} more</li>}
        </ul>
      )}
    </div>
  );
}
