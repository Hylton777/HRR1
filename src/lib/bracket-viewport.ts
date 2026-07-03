import type { BracketState } from "@/lib/types";
import type { BracketViewPreset } from "@/lib/regatta-days";

export interface ViewportTransform {
  scale: number;
  x: number;
  y: number;
}

export interface ViewportSize {
  width: number;
  height: number;
}

export const MIN_SCALE = 0.12;
export const MAX_SCALE = 1.4;
/** No cap — auto-fit scales until the bracket fills the viewport */
export const MAX_FIT_SCALE = Number.POSITIVE_INFINITY;
export const DEFAULT_SCALE = 0.38;
export const MIN_VISIBLE_PX = 48;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function crewLabel(crew: { name: string } | null | undefined): string {
  return crew?.name ?? "";
}

export function bracketFingerprint(bracket: BracketState): string {
  const parts: string[] = [];
  for (const round of bracket.rounds) {
    for (const match of round) {
      parts.push(
        [
          match.id,
          match.status,
          crewLabel(match.winner),
          crewLabel(match.loser),
          crewLabel(match.berks),
          crewLabel(match.bucks),
          match.raceTime ?? "",
        ].join("|"),
      );
    }
  }
  if (bracket.champion) {
    parts.push(`champion:${bracket.champion.name}`);
  }
  return parts.join(";");
}

export function getFocusBounds(
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

export function computeFitTransform(
  viewport: ViewportSize,
  content: ViewportSize,
  target: DOMRect | null,
  padding = 12,
  maxScale = MAX_SCALE,
): ViewportTransform {
  const focus = target ?? new DOMRect(0, 0, content.width, content.height);
  const focusWidth = Math.max(focus.width, 1);
  const focusHeight = Math.max(focus.height, 1);
  const rawScale = Math.min(
    (viewport.width - padding * 2) / focusWidth,
    (viewport.height - padding * 2) / focusHeight,
  );
  const scale =
    Number.isFinite(maxScale)
      ? clamp(rawScale, MIN_SCALE, maxScale)
      : Math.max(MIN_SCALE, rawScale);

  const x = (viewport.width - focusWidth * scale) / 2 - focus.x * scale;
  const y = (viewport.height - focusHeight * scale) / 2 - focus.y * scale;

  return { scale, x, y };
}

export function clampTransform(
  viewport: ViewportSize,
  content: ViewportSize,
  transform: ViewportTransform,
  minVisible = MIN_VISIBLE_PX,
): ViewportTransform {
  const scaledW = content.width * transform.scale;
  const scaledH = content.height * transform.scale;

  return {
    scale: transform.scale,
    x: clamp(transform.x, minVisible - scaledW, viewport.width - minVisible),
    y: clamp(transform.y, minVisible - scaledH, viewport.height - minVisible),
  };
}

export function formatTransform(transform: ViewportTransform): string {
  return `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`;
}
