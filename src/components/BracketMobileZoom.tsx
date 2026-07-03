"use client";

import { useRef, useState } from "react";
import type { BracketState } from "@/lib/types";
import {
  getRoundPresetLabels,
  groupMatchesByDay,
  type BracketViewPreset,
} from "@/lib/regatta-days";
import BracketFitViewport, {
  type BracketFitViewportHandle,
} from "./BracketFitViewport";
import MatchCard from "./MatchCard";
import { useEvent } from "./EventContext";

interface BracketMobileZoomProps {
  bracket: BracketState;
}

type LayoutMode = "bracket" | "day-stack";

function DayStackView({ bracket }: { bracket: BracketState }) {
  const event = useEvent();
  const allMatches = bracket.rounds.flat();
  const dayGroups = groupMatchesByDay(allMatches, event.raceDays);

  if (dayGroups.length === 0) {
    return (
      <p className="text-sm text-[var(--muted)] p-4 text-center">
        No races scheduled yet.
      </p>
    );
  }

  return (
    <div className="space-y-5 p-2">
      {dayGroups.map(({ day, matches }) => (
        <section
          key={day.id}
          data-bracket-region="day-stack"
          data-day-id={day.id}
        >
          <h3 className="text-xs font-semibold text-[var(--hrr-navy)] mb-2 sticky top-0 bg-[var(--background)] py-1 z-10">
            {day.label}
            <span className="text-[var(--muted)] font-normal ml-2">
              {matches.length} race{matches.length !== 1 ? "s" : ""}
            </span>
          </h3>
          <div className="space-y-2">
            {matches.map((match) => (
              <MatchCard
                key={match.id}
                matchId={match.id}
                berks={match.berks}
                bucks={match.bucks}
                winner={match.winner}
                loser={match.loser}
                status={match.status}
                verdict={match.verdict}
                roundLabel={match.roundLabel}
                raceTime={match.raceTime}
                raceNumber={match.raceNumber}
                raceDay={match.raceDay}
                splits={match.splits}
                station={match.station}
                showStations
                compact={false}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export default function BracketMobileZoom({ bracket }: BracketMobileZoomProps) {
  const event = useEvent();
  const fitViewportRef = useRef<BracketFitViewportHandle>(null);
  const [preset, setPreset] = useState<BracketViewPreset>("two-day");
  const [layout, setLayout] = useState<LayoutMode>("bracket");

  const roundPresets = getRoundPresetLabels(event.roundLabels);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => {
            setLayout("bracket");
            setPreset("full");
          }}
          className={`px-2.5 py-1 rounded text-xs border ${
            layout === "bracket" && preset === "full"
              ? "border-[var(--hrr-blue)] text-[var(--hrr-blue)] bg-[var(--hrr-blue)]/5"
              : "border-[var(--card-border)] text-[var(--muted)]"
          }`}
        >
          Show all
        </button>
        <button
          type="button"
          onClick={() => {
            setLayout("bracket");
            setPreset("today");
          }}
          className={`px-2.5 py-1 rounded text-xs border ${
            layout === "bracket" && preset === "today"
              ? "border-[var(--hrr-blue)] text-[var(--hrr-blue)] bg-[var(--hrr-blue)]/5"
              : "border-[var(--card-border)] text-[var(--muted)]"
          }`}
        >
          Today
        </button>
        <button
          type="button"
          onClick={() => {
            setLayout("bracket");
            setPreset("two-day");
          }}
          className={`px-2.5 py-1 rounded text-xs border ${
            layout === "bracket" && preset === "two-day"
              ? "border-[var(--hrr-blue)] text-[var(--hrr-blue)] bg-[var(--hrr-blue)]/5"
              : "border-[var(--card-border)] text-[var(--muted)]"
          }`}
        >
          2 day
        </button>
        <button
          type="button"
          onClick={() => setLayout("day-stack")}
          className={`px-2.5 py-1 rounded text-xs border ${
            layout === "day-stack"
              ? "border-[var(--hrr-blue)] text-[var(--hrr-blue)] bg-[var(--hrr-blue)]/5"
              : "border-[var(--card-border)] text-[var(--muted)]"
          }`}
        >
          By day
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5 items-center">
        {roundPresets.map(({ label, preset: roundPreset }) => (
          <button
            key={roundPreset}
            type="button"
            onClick={() => {
              setLayout("bracket");
              setPreset(roundPreset);
            }}
            className={`px-2 py-0.5 rounded text-[10px] border ${
              layout === "bracket" && preset === roundPreset
              ? "border-[var(--berks)] text-[var(--berks)] bg-[var(--berks)]/5"
              : "border-[var(--card-border)] text-[var(--muted)]"
            }`}
          >
            {label}
          </button>
        ))}
        <select
          value={preset.startsWith("day:") ? preset : ""}
          onChange={(e) => {
            if (e.target.value) {
              setLayout("bracket");
              setPreset(e.target.value as BracketViewPreset);
            }
          }}
          className="ml-auto text-[10px] bg-[var(--card)] border border-[var(--card-border)] rounded-sm px-1.5 py-0.5 text-[var(--muted)]"
        >
          <option value="">Day…</option>
          {event.raceDays.map((day) => (
            <option key={day.id} value={`day:${day.id}`}>
              {day.shortLabel}
            </option>
          ))}
        </select>
        {layout === "bracket" && (
          <div className="flex gap-1 ml-1">
            <button
              type="button"
              aria-label="Zoom out"
              onClick={() => fitViewportRef.current?.zoomBy(-0.08)}
              className="w-7 h-7 rounded-sm border border-[var(--card-border)] text-[var(--muted)] text-sm hover:border-[var(--hrr-blue)]"
            >
              −
            </button>
            <button
              type="button"
              aria-label="Zoom in"
              onClick={() => fitViewportRef.current?.zoomBy(0.08)}
              className="w-7 h-7 rounded-sm border border-[var(--card-border)] text-[var(--muted)] text-sm hover:border-[var(--hrr-blue)]"
            >
              +
            </button>
          </div>
        )}
      </div>

      <p className="text-[10px] text-[var(--muted)] leading-snug">
        Pinch to zoom · drag to pan · click a race to see more · paired boxes show Berks (top) vs Bucks (bottom)
      </p>

      {layout === "day-stack" ? (
        <div className="bracket-viewport rounded-sm border border-[var(--card-border)] bg-[var(--card)] shadow-sm max-h-[65vh] overflow-y-auto">
          <DayStackView bracket={bracket} />
        </div>
      ) : (
        <BracketFitViewport
          ref={fitViewportRef}
          bracket={bracket}
          viewPreset={preset}
          dimUnfocused={preset !== "full"}
          compact
          viewportClassName="h-[58vh] min-h-[280px]"
          showZoomControls={false}
        />
      )}
    </div>
  );
}
