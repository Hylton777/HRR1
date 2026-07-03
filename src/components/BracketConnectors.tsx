"use client";

import { useLayoutEffect, useState, type RefObject } from "react";
import type { BracketMatch } from "@/lib/types";
import { isMatchInView, type BracketViewPreset } from "@/lib/regatta-days";
import { useEvent } from "./EventContext";

interface BracketConnectorsProps {
  rootRef: RefObject<HTMLElement | null>;
  rounds: BracketMatch[][];
  allMatches: BracketMatch[];
  compact?: boolean;
  dimUnfocused?: boolean;
  viewPreset?: BracketViewPreset;
  layout?: "columns" | "rows";
}

interface MeasuredBox {
  left: number;
  right: number;
  centerY: number;
}

interface MeasuredBoxRows {
  top: number;
  bottom: number;
  left: number;
  right: number;
  centerX: number;
}

interface ConnectorPath {
  d: string;
  dimmed: boolean;
}

interface ConnectorLayout {
  width: number;
  height: number;
  paths: ConnectorPath[];
}

function measureRelative(el: HTMLElement, root: HTMLElement): MeasuredBox {
  const rootRect = root.getBoundingClientRect();
  const elRect = el.getBoundingClientRect();
  const scaleX =
    root.offsetWidth > 0 ? rootRect.width / root.offsetWidth : 1;
  const scaleY =
    root.offsetHeight > 0 ? rootRect.height / root.offsetHeight : 1;

  const left = (elRect.left - rootRect.left) / scaleX;
  const top = (elRect.top - rootRect.top) / scaleY;
  const width = elRect.width / scaleX;
  const height = elRect.height / scaleY;

  return {
    left,
    right: left + width,
    centerY: top + height / 2,
  };
}

function measureRelativeRows(el: HTMLElement, root: HTMLElement): MeasuredBoxRows {
  const rootRect = root.getBoundingClientRect();
  const elRect = el.getBoundingClientRect();
  const scaleX =
    root.offsetWidth > 0 ? rootRect.width / root.offsetWidth : 1;
  const scaleY =
    root.offsetHeight > 0 ? rootRect.height / root.offsetHeight : 1;

  const left = (elRect.left - rootRect.left) / scaleX;
  const top = (elRect.top - rootRect.top) / scaleY;
  const width = elRect.width / scaleX;
  const height = elRect.height / scaleY;

  return {
    left,
    right: left + width,
    top,
    bottom: top + height,
    centerX: left + width / 2,
  };
}

function measureCrewAnchor(
  root: HTMLElement,
  matchId: string,
  anchor: "berks" | "bucks",
): number | null {
  const el = root.querySelector(
    `[data-match-id="${matchId}"] [data-connector-anchor="${anchor}"]`,
  ) as HTMLElement | null;
  if (!el) return null;
  return measureRelative(el, root).centerY;
}

function measureCrewAnchorX(
  root: HTMLElement,
  matchId: string,
  anchor: "berks" | "bucks",
): number | null {
  const el = root.querySelector(
    `[data-match-id="${matchId}"] [data-connector-anchor="${anchor}"]`,
  ) as HTMLElement | null;
  if (!el) return null;
  return measureRelativeRows(el, root).centerX;
}

function inferFeederAnchor(match: BracketMatch): "berks" | "bucks" {
  if (match.berks && !match.bucks) return "bucks";
  if (match.bucks && !match.berks) return "berks";
  return "bucks";
}

function buildConnectorPaths(
  rounds: BracketMatch[][],
  root: HTMLElement,
  measureMatch: (id: string) => MeasuredBox | null,
  isDimmed: (match: BracketMatch, roundIndex: number) => boolean,
): ConnectorPath[] {
  const paths: ConnectorPath[] = [];

  for (let ri = 1; ri < rounds.length; ri++) {
    const round = rounds[ri];

    for (const match of round) {
      if (!match.feeders?.length) continue;

      if (match.feeders.length === 1) {
        const f0 = measureMatch(match.feeders[0]);
        const child = measureMatch(match.id);
        if (!f0 || !child) continue;

        const anchor = inferFeederAnchor(match);
        const targetY =
          measureCrewAnchor(root, match.id, anchor) ?? child.centerY;
        const dimmed = isDimmed(match, ri);

        paths.push({
          d: `M ${f0.right} ${f0.centerY} H ${(f0.right + child.left) / 2} V ${targetY} H ${child.left}`,
          dimmed,
        });
        continue;
      }

      if (match.feeders.length !== 2) continue;

      const [f0, f1] = match.feeders;
      const p0 = measureMatch(f0);
      const p1 = measureMatch(f1);
      const child = measureMatch(match.id);
      if (!p0 || !p1 || !child) continue;

      const midX = (p0.right + child.left) / 2;
      const y0 = p0.centerY;
      const y1 = p1.centerY;
      const childY = child.centerY;
      const spineTop = Math.min(y0, y1);
      const spineBottom = Math.max(y0, y1);
      const dimmed = isDimmed(match, ri);

      paths.push({ d: `M ${p0.right} ${y0} H ${midX}`, dimmed });
      paths.push({ d: `M ${p1.right} ${y1} H ${midX}`, dimmed });
      paths.push({ d: `M ${midX} ${spineTop} V ${spineBottom}`, dimmed });

      if (childY < spineTop) {
        paths.push({ d: `M ${midX} ${childY} V ${spineTop}`, dimmed });
      } else if (childY > spineBottom) {
        paths.push({ d: `M ${midX} ${spineBottom} V ${childY}`, dimmed });
      }

      paths.push({ d: `M ${midX} ${childY} H ${child.left}`, dimmed });
    }
  }

  return paths;
}

function buildConnectorPathsRows(
  rounds: BracketMatch[][],
  root: HTMLElement,
  measureMatch: (id: string) => MeasuredBoxRows | null,
  isDimmed: (match: BracketMatch, roundIndex: number) => boolean,
): ConnectorPath[] {
  const paths: ConnectorPath[] = [];

  for (let ri = 1; ri < rounds.length; ri++) {
    const round = rounds[ri];

    for (const match of round) {
      if (!match.feeders?.length) continue;

      if (match.feeders.length === 1) {
        const f0 = measureMatch(match.feeders[0]);
        const child = measureMatch(match.id);
        if (!f0 || !child) continue;

        const anchor = inferFeederAnchor(match);
        const targetX =
          measureCrewAnchorX(root, match.id, anchor) ?? child.centerX;
        const midY = (f0.top + child.bottom) / 2;
        const dimmed = isDimmed(match, ri);

        paths.push({
          d: `M ${f0.centerX} ${f0.top} V ${midY} H ${targetX} V ${child.bottom}`,
          dimmed,
        });
        continue;
      }

      if (match.feeders.length !== 2) continue;

      const [f0, f1] = match.feeders;
      const p0 = measureMatch(f0);
      const p1 = measureMatch(f1);
      const child = measureMatch(match.id);
      if (!p0 || !p1 || !child) continue;

      const midY = (p0.top + child.bottom) / 2;
      const x0 = p0.centerX;
      const x1 = p1.centerX;
      const childX = child.centerX;
      const spineLeft = Math.min(x0, x1);
      const spineRight = Math.max(x0, x1);
      const dimmed = isDimmed(match, ri);

      paths.push({ d: `M ${x0} ${p0.top} V ${midY}`, dimmed });
      paths.push({ d: `M ${x1} ${p1.top} V ${midY}`, dimmed });
      paths.push({ d: `M ${spineLeft} ${midY} H ${spineRight}`, dimmed });

      if (childX < spineLeft) {
        paths.push({ d: `M ${childX} ${midY} H ${spineLeft}`, dimmed });
      } else if (childX > spineRight) {
        paths.push({ d: `M ${spineRight} ${midY} H ${childX}`, dimmed });
      }

      paths.push({ d: `M ${childX} ${midY} V ${child.bottom}`, dimmed });
    }
  }

  return paths;
}

export default function BracketConnectors({
  rootRef,
  rounds,
  allMatches,
  compact = false,
  dimUnfocused = false,
  viewPreset = "full",
  layout: bracketLayout = "columns",
}: BracketConnectorsProps) {
  const event = useEvent();
  const [layout, setLayout] = useState<ConnectorLayout | null>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const measure = () => {
      const isDimmed = (match: BracketMatch, roundIndex: number) => {
        if (!dimUnfocused) return false;
        if (isMatchInView(match, viewPreset, event.raceDays, allMatches))
          return false;
        return !match.feeders?.some((id) => {
          const feeder = rounds[roundIndex - 1]?.find((m) => m.id === id);
          return (
            feeder &&
            isMatchInView(feeder, viewPreset, event.raceDays, allMatches)
          );
        });
      };

      if (bracketLayout === "rows") {
        const measureMatch = (id: string): MeasuredBoxRows | null => {
          const el = root.querySelector(
            `[data-match-id="${id}"]`,
          ) as HTMLElement | null;
          if (!el) return null;
          return measureRelativeRows(el, root);
        };

        const paths = buildConnectorPathsRows(
          rounds,
          root,
          measureMatch,
          isDimmed,
        );
        setLayout({
          width: root.scrollWidth,
          height: root.scrollHeight,
          paths,
        });
        return;
      }

      const measureMatch = (id: string): MeasuredBox | null => {
        const el = root.querySelector(
          `[data-match-id="${id}"]`,
        ) as HTMLElement | null;
        if (!el) return null;
        return measureRelative(el, root);
      };

      const paths = buildConnectorPaths(rounds, root, measureMatch, isDimmed);
      setLayout({
        width: root.scrollWidth,
        height: root.scrollHeight,
        paths,
      });
    };

    measure();
    const raf = requestAnimationFrame(measure);

    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(root);

    const onWindowResize = () => measure();
    window.addEventListener("resize", onWindowResize);

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      window.removeEventListener("resize", onWindowResize);
    };
  }, [rootRef, rounds, allMatches, compact, dimUnfocused, viewPreset, event.raceDays, bracketLayout]);

  if (!layout || layout.paths.length === 0) return null;

  const strokeWidth = compact ? 1 : 1.5;
  const strokeColor = "var(--connector-stroke, #94a3b8)";

  return (
    <svg
      className="absolute top-0 left-0 pointer-events-none z-[1]"
      width={layout.width}
      height={layout.height}
      aria-hidden
    >
      {layout.paths.map((path, i) => (
        <path
          key={i}
          d={path.d}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeLinecap="square"
          strokeLinejoin="miter"
          className={path.dimmed ? "opacity-20" : "opacity-80"}
        />
      ))}
    </svg>
  );
}
