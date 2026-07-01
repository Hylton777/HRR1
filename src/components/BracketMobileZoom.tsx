"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { BracketState } from "@/lib/types";
import {
  PE_RACE_DAYS,
  getTodayTomorrowLabel,
  groupMatchesByDay,
  type BracketViewPreset,
} from "@/lib/regatta-days";
import BracketTreeCore from "./BracketTreeCore";
import MatchCard from "./MatchCard";

interface BracketMobileZoomProps {
  bracket: BracketState;
}

type LayoutMode = "bracket" | "day-stack";

interface Transform {
  scale: number;
  x: number;
  y: number;
}

const MIN_SCALE = 0.12;
const MAX_SCALE = 1.4;
const DEFAULT_SCALE = 0.38;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function getFocusBounds(
  contentEl: HTMLElement,
  preset: BracketViewPreset,
): DOMRect | null {
  if (preset === "full") return null;

  const focused = contentEl.querySelectorAll('[data-focused="true"]');
  if (focused.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  focused.forEach((node) => {
    const el = node as HTMLElement;
    let x = 0;
    let y = 0;
    let current: HTMLElement | null = el;
    while (current && current !== contentEl) {
      x += current.offsetLeft;
      y += current.offsetTop;
      current = current.offsetParent as HTMLElement | null;
    }
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + el.offsetWidth);
    maxY = Math.max(maxY, y + el.offsetHeight);
  });

  if (minX === Infinity || maxX <= minX || maxY <= minY) return null;

  return new DOMRect(minX, minY, maxX - minX, maxY - minY);
}

function computeFitTransform(
  viewport: DOMRect,
  content: DOMRect,
  target: DOMRect | null,
  padding = 12,
): Transform {
  const focus = target ?? new DOMRect(0, 0, content.width, content.height);
  const focusWidth = Math.max(focus.width, 1);
  const focusHeight = Math.max(focus.height, 1);
  const scale = clamp(
    Math.min(
      (viewport.width - padding * 2) / focusWidth,
      (viewport.height - padding * 2) / focusHeight,
    ),
    MIN_SCALE,
    MAX_SCALE,
  );

  const x =
    (viewport.width - focusWidth * scale) / 2 - focus.x * scale;
  const y =
    (viewport.height - focusHeight * scale) / 2 - focus.y * scale;

  return { scale, x, y };
}

function DayStackView({ bracket }: { bracket: BracketState }) {
  const allMatches = bracket.rounds.flat();
  const dayGroups = groupMatchesByDay(allMatches);

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
                berks={match.berks}
                bucks={match.bucks}
                winner={match.winner}
                status={match.status}
                verdict={match.verdict}
                roundLabel={match.roundLabel}
                raceTime={match.raceTime}
                raceNumber={match.raceNumber}
                showStations
                compact
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export default function BracketMobileZoom({ bracket }: BracketMobileZoomProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState<Transform>({
    scale: DEFAULT_SCALE,
    x: 8,
    y: 8,
  });
  const [preset, setPreset] = useState<BracketViewPreset>("today-tomorrow");
  const [layout, setLayout] = useState<LayoutMode>("bracket");
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const panStartRef = useRef<{ x: number; y: number; tx: number; ty: number } | null>(
    null,
  );
  const pinchStartRef = useRef<{
    distance: number;
    scale: number;
    midX: number;
    midY: number;
    tx: number;
    ty: number;
  } | null>(null);

  const applyFit = useCallback(
    (nextPreset: BracketViewPreset) => {
      const viewport = viewportRef.current;
      const content = contentRef.current;
      if (!viewport || !content) return;

      requestAnimationFrame(() => {
        const viewportRect = viewport.getBoundingClientRect();
        const inner = content.querySelector("[data-bracket-root]") as HTMLElement;
        const unscaledWidth = inner?.offsetWidth ?? content.offsetWidth;
        const unscaledHeight = inner?.offsetHeight ?? content.offsetHeight;
        const focus = getFocusBounds(content, nextPreset);

        const next = computeFitTransform(
          viewportRect,
          new DOMRect(0, 0, unscaledWidth, unscaledHeight),
          focus,
          nextPreset === "full" ? 8 : 16,
        );
        setTransform(next);
      });
    },
    [],
  );

  useEffect(() => {
    if (layout === "bracket") {
      applyFit(preset);
    }
  }, [preset, layout, bracket, applyFit]);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (layout !== "bracket") return;
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);

    if (pointersRef.current.size === 1) {
      panStartRef.current = {
        x: event.clientX,
        y: event.clientY,
        tx: transform.x,
        ty: transform.y,
      };
    }

    if (pointersRef.current.size === 2) {
      const pts = [...pointersRef.current.values()];
      const midX = (pts[0].x + pts[1].x) / 2;
      const midY = (pts[0].y + pts[1].y) / 2;
      pinchStartRef.current = {
        distance: distance(pts[0], pts[1]),
        scale: transform.scale,
        midX,
        midY,
        tx: transform.x,
        ty: transform.y,
      };
      panStartRef.current = null;
    }
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (layout !== "bracket") return;
    if (!pointersRef.current.has(event.pointerId)) return;

    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointersRef.current.size === 2) {
      const pinchStart = pinchStartRef.current;
      if (!pinchStart) return;

      const pts = [...pointersRef.current.values()];
      const dist = distance(pts[0], pts[1]);
      const ratio = dist / pinchStart.distance;
      const nextScale = clamp(
        pinchStart.scale * ratio,
        MIN_SCALE,
        MAX_SCALE,
      );
      const midX = (pts[0].x + pts[1].x) / 2;
      const midY = (pts[0].y + pts[1].y) / 2;
      const viewport = viewportRef.current?.getBoundingClientRect();
      if (!viewport) return;

      const originX = midX - viewport.left;
      const originY = midY - viewport.top;
      const scaleRatio = nextScale / pinchStart.scale;

      setTransform({
        scale: nextScale,
        x: originX - (originX - pinchStart.tx) * scaleRatio,
        y: originY - (originY - pinchStart.ty) * scaleRatio,
      });
      return;
    }

    if (pointersRef.current.size === 1) {
      const panStart = panStartRef.current;
      if (!panStart) return;

      const dx = event.clientX - panStart.x;
      const dy = event.clientY - panStart.y;
      setTransform((t) => ({
        ...t,
        x: panStart.tx + dx,
        y: panStart.ty + dy,
      }));
    }
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(event.pointerId);
    if (pointersRef.current.size < 2) pinchStartRef.current = null;
    if (pointersRef.current.size === 0) panStartRef.current = null;
  };

  const zoomBy = (delta: number) => {
    const viewport = viewportRef.current?.getBoundingClientRect();
    if (!viewport) return;
    const cx = viewport.width / 2;
    const cy = viewport.height / 2;
    setTransform((t) => {
      const nextScale = clamp(t.scale + delta, MIN_SCALE, MAX_SCALE);
      const ratio = nextScale / t.scale;
      return {
        scale: nextScale,
        x: cx - (cx - t.x) * ratio,
        y: cy - (cy - t.y) * ratio,
      };
    });
  };

  const roundPresets: { label: string; preset: BracketViewPreset }[] = [
    { label: "R1", preset: "round:0" },
    { label: "R2", preset: "round:1" },
    { label: "QF", preset: "round:2" },
    { label: "SF", preset: "round:3" },
    { label: "F", preset: "round:4" },
  ];

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
          Fit all
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
            setPreset("today-tomorrow");
          }}
          className={`px-2.5 py-1 rounded text-xs border ${
            layout === "bracket" && preset === "today-tomorrow"
              ? "border-[var(--hrr-blue)] text-[var(--hrr-blue)] bg-[var(--hrr-blue)]/5"
              : "border-[var(--card-border)] text-[var(--muted)]"
          }`}
        >
          {getTodayTomorrowLabel()}
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
          {PE_RACE_DAYS.map((day) => (
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
              onClick={() => zoomBy(-0.08)}
              className="w-7 h-7 rounded-sm border border-[var(--card-border)] text-[var(--muted)] text-sm hover:border-[var(--hrr-blue)]"
            >
              −
            </button>
            <button
              type="button"
              aria-label="Zoom in"
              onClick={() => zoomBy(0.08)}
              className="w-7 h-7 rounded-sm border border-[var(--card-border)] text-[var(--muted)] text-sm hover:border-[var(--hrr-blue)]"
            >
              +
            </button>
          </div>
        )}
      </div>

      <p className="text-[10px] text-[var(--muted)] leading-snug">
        Pinch to zoom · drag to pan · paired boxes show Berks (top) vs Bucks (bottom)
      </p>

      {layout === "day-stack" ? (
        <div className="bracket-viewport rounded-sm border border-[var(--card-border)] bg-[var(--card)] shadow-sm max-h-[65vh] overflow-y-auto">
          <DayStackView bracket={bracket} />
        </div>
      ) : (
        <div
          ref={viewportRef}
          className="bracket-viewport relative rounded-sm border border-[var(--card-border)] bg-[var(--card)] shadow-sm h-[58vh] min-h-[280px] overflow-hidden touch-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div
            ref={contentRef}
            className="absolute left-0 top-0 origin-top-left will-change-transform"
            style={{
              transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
            }}
          >
            <div className="p-2">
              <BracketTreeCore
                bracket={bracket}
                compact
                viewPreset={preset}
                dimUnfocused={preset !== "full"}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
