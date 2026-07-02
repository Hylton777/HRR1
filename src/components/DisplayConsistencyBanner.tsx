"use client";

import type { DisplayAudit } from "@/lib/types";

interface DisplayConsistencyBannerProps {
  audit: DisplayAudit | undefined;
}

export default function DisplayConsistencyBanner({
  audit,
}: DisplayConsistencyBannerProps) {
  if (!audit || audit.isConsistent) return null;

  const preview = audit.inconsistencies.slice(0, 3);
  const remaining = audit.inconsistencies.length - preview.length;

  return (
    <div
      className="rounded-sm border border-rose-300/80 bg-rose-50 text-rose-950 px-3 py-2 text-sm"
      role="status"
    >
      <p className="font-medium">
        Crew names are inconsistent across bracket panels.
      </p>
      <p className="mt-1 text-rose-900/90">
        {audit.inconsistencyCount} cross-check failure
        {audit.inconsistencyCount === 1 ? "" : "s"} between the bracket, next
        races, recent results, and fastest-crews views.
      </p>
      {audit.warnings.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs text-rose-900/90">
          {audit.warnings.map((warning) => (
            <li key={warning}>• {warning}</li>
          ))}
        </ul>
      )}
      {preview.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs text-rose-900/90">
          {preview.map((item, index) => (
            <li key={`${item.area}-${item.matchId ?? item.raceNumber ?? index}`}>
              • {item.message}
              {item.bracketLabel && item.otherLabel
                ? ` (bracket: ${item.bracketLabel}; other: ${item.otherLabel})`
                : ""}
            </li>
          ))}
          {remaining > 0 && <li>• …and {remaining} more</li>}
        </ul>
      )}
    </div>
  );
}
