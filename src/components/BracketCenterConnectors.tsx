"use client";

import { useLayoutEffect, useState, type RefObject } from "react";

interface BracketCenterConnectorsProps {
  rootRef: RefObject<HTMLElement | null>;
  leftSemiId: string;
  rightSemiId: string;
  finalId: string;
}

interface MeasuredEdge {
  left: number;
  right: number;
  top: number;
  bottom: number;
  centerY: number;
}

function measureMatchBox(el: HTMLElement, root: HTMLElement): MeasuredEdge {
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
    centerY: top + height / 2,
  };
}

export default function BracketCenterConnectors({
  rootRef,
  leftSemiId,
  rightSemiId,
  finalId,
}: BracketCenterConnectorsProps) {
  const [paths, setPaths] = useState<string[]>([]);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const measure = () => {
      const leftSemi = root.querySelector(
        `[data-match-id="${leftSemiId}"]`,
      ) as HTMLElement | null;
      const rightSemi = root.querySelector(
        `[data-match-id="${rightSemiId}"]`,
      ) as HTMLElement | null;
      const finalEl = root.querySelector(
        `[data-match-id="${finalId}"]`,
      ) as HTMLElement | null;

      if (!leftSemi || !rightSemi || !finalEl) {
        setPaths([]);
        return;
      }

      const left = measureMatchBox(leftSemi, root);
      const right = measureMatchBox(rightSemi, root);
      const finalBox = measureMatchBox(finalEl, root);

      const midLeftX = (left.right + finalBox.left) / 2;
      const midRightX = (right.left + finalBox.right) / 2;

      const nextPaths = [
        `M ${left.right} ${left.centerY} H ${midLeftX} V ${finalBox.centerY} H ${finalBox.left}`,
        `M ${right.left} ${right.centerY} H ${midRightX} V ${finalBox.centerY} H ${finalBox.right}`,
      ];

      setPaths(nextPaths);
      setSize({ width: root.offsetWidth, height: root.offsetHeight });
    };

    measure();
    const raf = requestAnimationFrame(measure);

    const observer = new ResizeObserver(measure);
    observer.observe(root);
    window.addEventListener("resize", measure);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [rootRef, leftSemiId, rightSemiId, finalId]);

  if (paths.length === 0) return null;

  return (
    <svg
      className="absolute top-0 left-0 pointer-events-none z-[1]"
      width={size.width}
      height={size.height}
      aria-hidden
    >
      {paths.map((d, i) => (
        <path
          key={i}
          d={d}
          fill="none"
          stroke="var(--connector-stroke, #94a3b8)"
          strokeWidth={1}
          strokeLinecap="square"
          strokeLinejoin="miter"
          className="opacity-80"
        />
      ))}
    </svg>
  );
}
