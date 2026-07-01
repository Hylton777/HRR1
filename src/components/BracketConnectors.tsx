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
}

interface MeasuredBox {
  left: number;
  right: number;
  centerY: number;
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

function buildConnectorPaths(
  rounds: BracketMatch[][],
  measureMatch: (id: string) => MeasuredBox | null,
  isDimmed: (match: BracketMatch, roundIndex: number) => boolean,
): ConnectorPath[] {
  const paths: ConnectorPath[] = [];

  for (let ri = 1; ri < rounds.length; ri++) {
    const round = rounds[ri];

    for (const match of round) {
      if (!match.feeders || match.feeders.length !== 2) continue;

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

export default function BracketConnectors({
  rootRef,
  rounds,
  allMatches,
  compact = false,
  dimUnfocused = false,
  viewPreset = "full",
}: BracketConnectorsProps) {
  const event = useEvent();
  const [layout, setLayout] = useState<ConnectorLayout | null>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const measure = () => {
      const measureMatch = (id: string): MeasuredBox | null => {
        const el = root.querySelector(
          `[data-match-id="${id}"]`,
        ) as HTMLElement | null;
        if (!el) return null;
        return measureRelative(el, root);
      };

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

      const paths = buildConnectorPaths(rounds, measureMatch, isDimmed);
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
  }, [rootRef, rounds, allMatches, compact, dimUnfocused, viewPreset, event.raceDays]);

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
