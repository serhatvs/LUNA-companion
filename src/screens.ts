/**
 * Where the screens are.
 *
 * Monitors are rarely laid out edge to edge - there is usually dead space
 * between them that belongs to no display, and anything standing in it is
 * invisible. All the geometry for "which screen is that" and "what is next
 * door" lives here, free of the DOM, so it can be tested on its own.
 */

export interface Screen {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Is this x on an actual display, rather than in the gap between two? */
export const onScreen = (screens: readonly Screen[], cx: number): boolean =>
  screens.some((m) => cx >= m.x && cx <= m.x + m.w);

/** The screen containing x, or failing that the closest one to it. */
export function nearest(screens: readonly Screen[], cx: number, fallback: Screen): Screen {
  if (screens.length === 0) return fallback;
  let best = screens[0]!;
  let bestDist = Infinity;
  for (const m of screens) {
    if (cx >= m.x && cx <= m.x + m.w) return m;
    const d = cx < m.x ? m.x - cx : cx - (m.x + m.w);
    if (d < bestDist) {
      bestDist = d;
      best = m;
    }
  }
  return best;
}

/** The next screen in a direction of travel, ignoring the one behind her. */
export function neighbour(
  screens: readonly Screen[],
  cx: number,
  dir: 1 | -1,
): Screen | null {
  let best: Screen | null = null;
  let bestGap = Infinity;
  for (const m of screens) {
    const gap = dir > 0 ? m.x - cx : cx - (m.x + m.w);
    if (gap < -1 || gap >= bestGap) continue;
    bestGap = gap;
    best = m;
  }
  return best;
}

/**
 * Is that side of a screen a wall she can climb, or the way to the monitor
 * next door? An edge with another display behind it is a doorway, and pawing
 * at it would look ridiculous.
 */
export const isWall = (screens: readonly Screen[], m: Screen, dir: 1 | -1): boolean =>
  neighbour(screens, dir > 0 ? m.x + m.w + 1 : m.x - 1, dir) === null;
