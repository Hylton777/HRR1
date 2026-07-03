"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { BracketState } from "@/lib/types";
import {
  bracketFingerprint,
  clamp,
  clampTransform,
  computeFitTransform,
  DEFAULT_SCALE,
  formatTransform,
  getFocusBounds,
  MAX_SCALE,
  MIN_SCALE,
  type ViewportTransform,
} from "@/lib/bracket-viewport";
import {
  getRoundPresetLabels,
  groupMatchesByDay,
  type BracketViewPreset,
} from "@/lib/regatta-days";
import BracketTreeCore from "./BracketTreeCore";
import MatchCard from "./MatchCard";
import { useEvent } from "./EventContext";

interface BracketMobileZoomProps {
  bracket: BracketState;
}

type LayoutMode = "bracket" | "day-stack";

function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

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
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState<ViewportTransform>({
    scale: DEFAULT_SCALE,
    x: 8,
    y: 8,
  });
  const [preset, setPreset] = useState<BracketViewPreset>("two-day");
  const [layout, setLayout] = useState<LayoutMode>("bracket");

  const transformRef = useRef(transform);
  const contentSizeRef = useRef({ width: 0, height: 0 });
  const userInteractedRef = useRef(false);
  const pendingFrameRef = useRef<number | null>(null);

  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const panStartRef = useRef<{ x: number; y: number; tx: number; ty: number } | null>(
    null,
  );
  const pinchStartRef = useRef<{
    distance: number;
    scale: number;
    tx: number;
    ty: number;
  } | null>(null);

  const fingerprint = useMemo(() => bracketFingerprint(bracket), [bracket]);

  transformRef.current = transform;

  const applyTransformToDom = useCallback((next: ViewportTransform) => {
    if (contentRef.current) {
      contentRef.current.style.transform = formatTransform(next);
    }
    transformRef.current = next;
  }, []);

  const commitTransform = useCallback((next: ViewportTransform) => {
    const viewport = viewportRef.current?.getBoundingClientRect();
    const contentSize = contentSizeRef.current;
    const clamped =
      viewport && contentSize.width > 0
        ? clampTransform(viewport, contentSize, next)
        : next;
    applyTransformToDom(clamped);
    setTransform(clamped);
  }, [applyTransformToDom]);

  const updateGestureTransform = useCallback(
    (next: ViewportTransform) => {
      const viewport = viewportRef.current?.getBoundingClientRect();
      const contentSize = contentSizeRef.current;
      const clamped =
        viewport && contentSize.width > 0
          ? clampTransform(viewport, contentSize, next)
          : next;
      applyTransformToDom(clamped);
    },
    [applyTransformToDom],
  );

  const measureContentSize = useCallback(() => {
    const content = contentRef.current;
    if (!content) return contentSizeRef.current;

    const inner = content.querySelector("[data-bracket-root]") as HTMLElement;
    const size = {
      width: inner?.offsetWidth ?? content.offsetWidth,
      height: inner?.offsetHeight ?? content.offsetHeight,
    };
    contentSizeRef.current = size;
    return size;
  }, []);

  const applyFit = useCallback(
    (nextPreset: BracketViewPreset, deferForPreset = false) => {
      const viewport = viewportRef.current;
      const content = contentRef.current;
      if (!viewport || !content) return;

      const runFit = () => {
        requestAnimationFrame(() => {
          const viewportRect = viewport.getBoundingClientRect();
          const contentSize = measureContentSize();
          const focus = getFocusBounds(content, nextPreset);
          const next = computeFitTransform(
            viewportRect,
            contentSize,
            focus,
            nextPreset === "full" ? 8 : 16,
          );
          commitTransform(next);
        });
      };

      if (deferForPreset && nextPreset !== "full") {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            window.setTimeout(runFit, 220);
          });
        });
        return;
      }

      runFit();
    },
    [commitTransform, measureContentSize],
  );

  const prevPresetRef = useRef(preset);
  const prevLayoutRef = useRef(layout);
  const prevFingerprintRef = useRef(fingerprint);

  useEffect(() => {
    if (layout !== "bracket") return;

    const presetChanged = prevPresetRef.current !== preset;
    const layoutChanged = prevLayoutRef.current !== layout;
    const fingerprintChanged = prevFingerprintRef.current !== fingerprint;

    prevPresetRef.current = preset;
    prevLayoutRef.current = layout;
    prevFingerprintRef.current = fingerprint;

    if (presetChanged || layoutChanged) {
      userInteractedRef.current = false;
      applyFit(preset, presetChanged);
      return;
    }

    if (fingerprintChanged && !userInteractedRef.current) {
      applyFit(preset, false);
      return;
    }

    if (fingerprintChanged) {
      measureContentSize();
      commitTransform(transformRef.current);
    }
  }, [preset, layout, fingerprint, applyFit, measureContentSize, commitTransform]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || layout !== "bracket") return;

    let rafId: number | null = null;
    const observer = new ResizeObserver(() => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        rafId = null;
        if (userInteractedRef.current) {
          const viewportRect = viewport.getBoundingClientRect();
          const clamped = clampTransform(
            viewportRect,
            contentSizeRef.current,
            transformRef.current,
          );
          commitTransform(clamped);
        } else {
          applyFit(preset, false);
        }
      });
    });

    observer.observe(viewport);
    return () => {
      observer.disconnect();
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [layout, preset, applyFit, commitTransform]);

  const markUserInteracted = () => {
    userInteractedRef.current = true;
  };

  const scheduleGestureUpdate = (compute: () => ViewportTransform) => {
    if (pendingFrameRef.current !== null) return;
    pendingFrameRef.current = requestAnimationFrame(() => {
      pendingFrameRef.current = null;
      updateGestureTransform(compute());
    });
  };

  const beginPanFromRemainingPointer = () => {
    const remaining = [...pointersRef.current.entries()][0];
    if (!remaining) return;

    const [, pos] = remaining;
    const current = transformRef.current;
    panStartRef.current = {
      x: pos.x,
      y: pos.y,
      tx: current.x,
      ty: current.y,
    };
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (layout !== "bracket") return;

    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);

    const current = transformRef.current;

    if (pointersRef.current.size === 1) {
      panStartRef.current = {
        x: event.clientX,
        y: event.clientY,
        tx: current.x,
        ty: current.y,
      };
    }

    if (pointersRef.current.size === 2) {
      const pts = [...pointersRef.current.values()];
      pinchStartRef.current = {
        distance: distance(pts[0], pts[1]),
        scale: current.scale,
        tx: current.x,
        ty: current.y,
      };
      panStartRef.current = null;
    }
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (layout !== "bracket") return;
    if (!pointersRef.current.has(event.pointerId)) return;

    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    markUserInteracted();

    if (pointersRef.current.size === 2) {
      const pinchStart = pinchStartRef.current;
      if (!pinchStart) return;

      const pts = [...pointersRef.current.values()];
      const dist = distance(pts[0], pts[1]);
      const ratio = dist / pinchStart.distance;
      const nextScale = clamp(pinchStart.scale * ratio, MIN_SCALE, MAX_SCALE);
      const midX = (pts[0].x + pts[1].x) / 2;
      const midY = (pts[0].y + pts[1].y) / 2;
      const viewport = viewportRef.current?.getBoundingClientRect();
      if (!viewport) return;

      const originX = midX - viewport.left;
      const originY = midY - viewport.top;
      const scaleRatio = nextScale / pinchStart.scale;

      scheduleGestureUpdate(() => ({
        scale: nextScale,
        x: originX - (originX - pinchStart.tx) * scaleRatio,
        y: originY - (originY - pinchStart.ty) * scaleRatio,
      }));
      return;
    }

    if (pointersRef.current.size === 1) {
      const panStart = panStartRef.current;
      if (!panStart) return;

      const dx = event.clientX - panStart.x;
      const dy = event.clientY - panStart.y;
      scheduleGestureUpdate(() => ({
        ...transformRef.current,
        x: panStart.tx + dx,
        y: panStart.ty + dy,
      }));
    }
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const wasPinching = pointersRef.current.size === 2;
    pointersRef.current.delete(event.pointerId);

    if (pointersRef.current.size < 2) {
      pinchStartRef.current = null;
    }

    if (wasPinching && pointersRef.current.size === 1) {
      beginPanFromRemainingPointer();
    }

    if (pointersRef.current.size === 0) {
      panStartRef.current = null;
      if (pendingFrameRef.current !== null) {
        cancelAnimationFrame(pendingFrameRef.current);
        pendingFrameRef.current = null;
      }
      commitTransform(transformRef.current);
    }
  };

  const zoomBy = (delta: number) => {
    markUserInteracted();
    const viewport = viewportRef.current?.getBoundingClientRect();
    if (!viewport) return;

    const cx = viewport.width / 2;
    const cy = viewport.height / 2;
    const current = transformRef.current;
    const nextScale = clamp(current.scale + delta, MIN_SCALE, MAX_SCALE);
    const ratio = nextScale / current.scale;

    commitTransform({
      scale: nextScale,
      x: cx - (cx - current.x) * ratio,
      y: cy - (cy - current.y) * ratio,
    });
  };

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
        Pinch to zoom · drag to pan · click a race to see more · paired boxes show Berks (top) vs Bucks (bottom)
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
              transform: formatTransform(transform),
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
