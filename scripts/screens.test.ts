/**
 * Roaming geometry, checked against a real three-monitor desktop with gaps in
 * it. Run with: node --test scripts/screens.test.ts
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { isWall, nearest, neighbour, onScreen, type Screen } from "../src/screens.ts";

// The developer's actual layout, converted to window coordinates: a left-hand
// screen, a 1280px hole, the main screen, a 384px hole, then the right screen.
const SCREENS: Screen[] = [
  { x: 0, y: 0, w: 1280, h: 800 },
  { x: 2560, y: 279, w: 1536, h: 864 },
  { x: 4480, y: 587, w: 1366, h: 768 },
];

const LEFT = SCREENS[0]!;
const MAIN = SCREENS[1]!;
const RIGHT = SCREENS[2]!;

test("knows the gaps are not screens", () => {
  assert.equal(onScreen(SCREENS, 640), true);
  assert.equal(onScreen(SCREENS, 3000), true);
  assert.equal(onScreen(SCREENS, 5000), true);
  assert.equal(onScreen(SCREENS, 1900), false, "the 1280px hole");
  assert.equal(onScreen(SCREENS, 4200), false, "the 384px hole");
});

test("walking right off the main screen lands on the right screen", () => {
  const next = neighbour(SCREENS, 4100, 1);
  assert.equal(next, RIGHT);
});

test("walking left off the main screen lands on the left screen", () => {
  const next = neighbour(SCREENS, 2500, -1);
  assert.equal(next, LEFT);
});

test("does not pick a screen behind her", () => {
  assert.equal(neighbour(SCREENS, 4100, -1), MAIN, "left of the right-hand gap is the main screen");
  assert.equal(neighbour(SCREENS, 1900, 1), MAIN);
});

test("stops at the ends of the desktop", () => {
  assert.equal(neighbour(SCREENS, -50, -1), null);
  assert.equal(neighbour(SCREENS, 6000, 1), null);
});

test("falls back to the closest screen when stranded", () => {
  const fallback: Screen = { x: 0, y: 0, w: 1, h: 1 };
  assert.equal(nearest(SCREENS, 4200, fallback), MAIN, "just off the main screen");
  assert.equal(nearest(SCREENS, 4400, fallback), RIGHT, "nearly on the right screen");
  assert.equal(nearest(SCREENS, 3000, fallback), MAIN);
  assert.equal(nearest([], 10, fallback), fallback);
});

test("only outer edges are walls she can climb", () => {
  assert.equal(isWall(SCREENS, LEFT, -1), true, "nothing to the left of the left screen");
  assert.equal(isWall(SCREENS, LEFT, 1), false, "the main screen is that way");
  assert.equal(isWall(SCREENS, MAIN, -1), false);
  assert.equal(isWall(SCREENS, MAIN, 1), false, "a screen in the middle has no walls at all");
  assert.equal(isWall(SCREENS, RIGHT, -1), false);
  assert.equal(isWall(SCREENS, RIGHT, 1), true, "nothing to the right of the right screen");
});

test("a single screen is walls on both sides", () => {
  const alone: Screen[] = [{ x: 0, y: 0, w: 1920, h: 1080 }];
  assert.equal(isWall(alone, alone[0]!, -1), true);
  assert.equal(isWall(alone, alone[0]!, 1), true);
});

test("adjacent screens need no jump at all", () => {
  const touching: Screen[] = [
    { x: 0, y: 0, w: 1920, h: 1080 },
    { x: 1920, y: 0, w: 1920, h: 1080 },
  ];
  assert.equal(onScreen(touching, 1920), true, "the seam is still screen");
  assert.equal(neighbour(touching, 1919, 1), touching[1]);
});
