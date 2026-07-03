"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
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
  getTightContentBounds,
  MAX_FIT_SCALE,
  MAX_SCALE,
  MIN_SCALE,
  type ViewportTransform,
} from "@/lib/bracket-viewport";
import type { BracketViewPreset } from "@/lib/regatta-days";
import BracketTreeCore from "./BracketTreeCore";
import BracketTreeSplit from "./BracketTreeSplit";

function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export interface BracketFitViewportHandle {
  zoomBy: (delta: number) => void;
}

export interface BracketFitViewportProps {
  bracket: BracketState;
  viewPreset?: BracketViewPreset;
  dimUnfocused?: boolean;
  compact?: boolean;
  layout?: "columns" | "rows" | "split";
  viewportClassName?: string;
  showZoomControls?: boolean;
  zoomControlsClassName?: string;
  /** Padding used when auto-fitting content to the viewport */
  fitPadding?: number;
  /** Max scale when auto-fitting (split layout uses a higher cap) */
  maxFitScale?: number;
  contentPaddingClassName?: string;
}

const BracketFitViewport = forwardRef<BracketFitViewportHandle, BracketFitViewportProps>(
function BracketFitViewport({
  bracket,
  viewPreset = "full",
  dimUnfocused = false,
  compact = true,
  layout = "columns",
  viewportClassName = "h-[min(72dvh,calc(100dvh-13rem))] min-h-[360px]",
  showZoomControls = true,
  zoomControlsClassName = "flex justify-end gap-1 mb-2",
  fitPadding,
  maxFitScale,
  contentPaddingClassName = "p-2",
}: BracketFitViewportProps, ref) {
  const resolvedFitPadding = fitPadding ?? (layout === "split" ? 0 : viewPreset === "full" ? 8 : 16);
  const resolvedMaxFitScale = maxFitScale ?? (layout === "split" ? MAX_FIT_SCALE : MAX_SCALE);
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState<ViewportTransform>({
    scale: DEFAULT_SCALE,
    x: 8,
    y: 8,
  });

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
    const size = inner
      ? {
          width: Math.max(inner.scrollWidth, inner.offsetWidth),
          height: Math.max(inner.scrollHeight, inner.offsetHeight),
        }
      : {
          width: content.scrollWidth,
          height: content.scrollHeight,
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
          requestAnimationFrame(() => {
            const viewportRect = viewport.getBoundingClientRect();
            const contentSize = measureContentSize();
            const tight =
              layout === "split" ? getTightContentBounds(content) : null;
            const focus =
              tight ?? getFocusBounds(content, nextPreset);
            const next = computeFitTransform(
              viewportRect,
              contentSize,
              focus,
              resolvedFitPadding,
              resolvedMaxFitScale,
            );
            applyTransformToDom(next);
            setTransform(next);
          });
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
    [applyTransformToDom, layout, measureContentSize, resolvedFitPadding, resolvedMaxFitScale],
  );

  const prevPresetRef = useRef(viewPreset);
  const prevFingerprintRef = useRef(fingerprint);

  useEffect(() => {
    const presetChanged = prevPresetRef.current !== viewPreset;
    const fingerprintChanged = prevFingerprintRef.current !== fingerprint;

    prevPresetRef.current = viewPreset;
    prevFingerprintRef.current = fingerprint;

    if (presetChanged) {
      userInteractedRef.current = false;
      applyFit(viewPreset, presetChanged);
      return;
    }

    if (fingerprintChanged && !userInteractedRef.current) {
      applyFit(viewPreset, false);
      return;
    }

    if (fingerprintChanged) {
      measureContentSize();
      commitTransform(transformRef.current);
    }
  }, [viewPreset, fingerprint, applyFit, measureContentSize, commitTransform]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

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
          applyFit(viewPreset, false);
        }
      });
    });

    observer.observe(viewport);

    const bracketRoot = contentRef.current?.querySelector(
      "[data-bracket-root]",
    ) as HTMLElement | null;
    if (bracketRoot) observer.observe(bracketRoot);

    return () => {
      observer.disconnect();
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [viewPreset, applyFit, commitTransform, fingerprint, layout]);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      applyFit(viewPreset, false);
    });
    return () => cancelAnimationFrame(id);
    // Initial fit on mount; preset/fingerprint changes handled above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const zoomBy = useCallback((delta: number) => {
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
  }, [commitTransform]);

  useImperativeHandle(ref, () => ({ zoomBy }), [zoomBy]);

  return (
    <div className="h-full flex flex-col min-h-0">
      {showZoomControls && (
        <div className={zoomControlsClassName}>
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
      <div
        ref={viewportRef}
        className={`bracket-viewport relative flex-1 min-h-0 rounded-sm border border-[var(--card-border)] bg-[var(--card)] shadow-sm overflow-hidden touch-none ${viewportClassName}`}
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
          <div className={contentPaddingClassName}>
            {layout === "split" ? (
              <BracketTreeSplit
                bracket={bracket}
                viewPreset={viewPreset}
                dimUnfocused={dimUnfocused}
              />
            ) : (
              <BracketTreeCore
                bracket={bracket}
                compact={compact}
                viewPreset={viewPreset}
                dimUnfocused={dimUnfocused}
                layout={layout}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

export default BracketFitViewport;
