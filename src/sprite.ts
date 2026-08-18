/**
 * Luna, drawn from scratch into a 32x36 grid of pixels.
 *
 * There is no sprite sheet and no image asset anywhere in this app. Every pose
 * is a handful of discs, eggs and rectangles snapped to the pixel grid, which
 * means poses can be *parameterised* - the tail curls, the body squashes when
 * she lands, ears droop by a fraction - instead of being frozen frames. It
 * also means a fur colour is a palette swap and costs nothing.
 */

export const W = 32;
export const H = 36;

export type FurName = "midnight" | "smoke" | "cream" | "ginger" | "mint";

interface Palette {
  line: number;
  fur: number;
  dark: number;
  light: number;
  pink: number;
  iris: number;
  glint: number;
  whisker: number;
  collar: number;
  bell: number;
  bellLit: number;
}

/** 0xAABBGGRR - the byte order an ImageData Uint32 view expects. */
const rgb = (hex: string, a = 255): number => {
  const n = parseInt(hex.slice(1), 16);
  return ((a << 24) | (((n & 0xff) << 16) | (n & 0xff00) | ((n >> 16) & 0xff))) >>> 0;
};

/** Everything a cat wears, regardless of what colour the cat is. */
const trim = {
  pink: rgb("#e8909c"),
  iris: rgb("#8fbf5a"),
  glint: rgb("#ffffff"),
  collar: rgb("#b3271f"),
  bell: rgb("#e5aa1e"),
  bellLit: rgb("#f8dc79"),
};

export const FURS: Record<FurName, Palette> = {
  midnight: {
    ...trim,
    line: rgb("#08080c"),
    fur: rgb("#26262f"),
    dark: rgb("#15151b"),
    light: rgb("#34343f"),
    whisker: rgb("#9d9da8"),
  },
  smoke: {
    ...trim,
    line: rgb("#2b2f38"),
    fur: rgb("#9aa3b2"),
    dark: rgb("#7a8492"),
    light: rgb("#c3cbd8"),
    whisker: rgb("#42474f"),
  },
  cream: {
    ...trim,
    line: rgb("#4a3a2c"),
    fur: rgb("#f0d8b4"),
    dark: rgb("#d3b085"),
    light: rgb("#fff0d9"),
    whisker: rgb("#6d5842"),
  },
  ginger: {
    ...trim,
    line: rgb("#5a2f14"),
    fur: rgb("#ef9d4f"),
    dark: rgb("#cb7530"),
    light: rgb("#ffc281"),
    whisker: rgb("#7a4520"),
  },
  mint: {
    ...trim,
    line: rgb("#2e4a42"),
    fur: rgb("#a2d8c3"),
    dark: rgb("#7cb6a0"),
    light: rgb("#d2f1e5"),
    whisker: rgb("#3f6459"),
  },
};

export const FUR_ORDER: FurName[] = ["midnight", "smoke", "cream", "ginger", "mint"];

/** The swatch colour shown in the settings panel. */
export const furSwatch = (name: FurName): string => {
  const c = FURS[name].fur;
  return `rgb(${c & 0xff},${(c >> 8) & 0xff},${(c >> 16) & 0xff})`;
};

export type Form =
  | "sit"
  | "walk"
  | "run"
  | "sleep"
  | "fall"
  | "hang"
  | "climb"
  | "stretch"
  | "cheer"
  | "sad"
  | "eat"
  | "groom"
  | "watch";

export type Eyes = "open" | "closed" | "happy" | "sad" | "wide" | "wink";
export type Mouth = "smile" | "flat" | "open" | "frown";

export interface Pose {
  form: Form;
  /** Animation clock, ms. */
  t: number;
  eyes: Eyes;
  mouth: Mouth;
  /** -1 squashed, 0 neutral, +1 stretched. */
  squash: number;
  /** Extra head lean, in pixels. */
  lean: number;
}

// ------------------------------------------------------------------- raster

const buf = new Uint32Array(W * H);

const px = (x: number, y: number, c: number): void => {
  const xi = Math.round(x);
  const yi = Math.round(y);
  if (xi < 0 || yi < 0 || xi >= W || yi >= H) return;
  buf[yi * W + xi] = c;
};

const rect = (x: number, y: number, w: number, h: number, c: number): void => {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) px(x + i, y + j, c);
};

const inEgg = (x: number, y: number, cx: number, cy: number, rx: number, ry: number): boolean => {
  const dx = (x + 0.5 - cx) / rx;
  const dy = (y + 0.5 - cy) / ry;
  return dx * dx + dy * dy <= 1;
};

/** An egg: a disc stretched on each axis. Luna is mostly eggs. */
const egg = (cx: number, cy: number, rx: number, ry: number, c: number): void => {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      if (inEgg(x, y, cx, cy, rx, ry)) px(x, y, c);
    }
  }
};

const disc = (cx: number, cy: number, r: number, c: number): void => egg(cx, cy, r, r, c);

/** Outlined egg: dark silhouette first, fur inset by a pixel. */
const eggOutlined = (cx: number, cy: number, rx: number, ry: number, p: Palette): void => {
  egg(cx, cy, rx, ry, p.line);
  egg(cx, cy, rx - 1, ry - 1, p.fur);
};

/** A stripe of colour that only lands where it is already cat - used for the
 *  collar, which has to hug the body rather than float across it. */
const bandOnEgg = (
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  top: number,
  thickness: number,
  c: number,
): void => {
  for (let y = Math.round(top); y < Math.round(top) + thickness; y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      if (inEgg(x, y, cx, cy, rx - 1, ry - 1)) px(x, y, c);
    }
  }
};

// --------------------------------------------------------------------- parts

/** A tall triangular ear with a pink inner. `droop` bends it down when she is
 *  sad or asleep. */
const drawEar = (cx: number, tip: number, dir: -1 | 1, p: Palette, droop = 0): void => {
  const rows = 8;
  for (let r = 0; r < rows; r++) {
    const y = tip + r;
    const half = 0.42 * r + 0.6;
    const slide = dir * droop * (r / rows) * 2;
    for (let x = Math.round(cx - half + slide); x <= Math.round(cx + half + slide); x++) {
      px(x, y + droop * 0.35 * (r / rows), p.line);
    }
  }
  for (let r = 2; r < rows; r++) {
    const y = tip + r;
    const half = 0.42 * r - 0.5;
    const slide = dir * droop * (r / rows) * 2;
    for (let x = Math.round(cx - half + slide); x <= Math.round(cx + half + slide); x++) {
      px(x, y + droop * 0.35 * (r / rows), p.fur);
    }
  }
  // Pink inner, a slim wedge sitting inside the fur.
  for (let r = 3; r < rows - 1; r++) {
    const y = tip + r;
    const half = 0.3 * r - 0.8;
    const slide = dir * droop * (r / rows) * 2;
    for (let x = Math.round(cx - half + slide); x <= Math.round(cx + half + slide); x++) {
      px(x, y + droop * 0.35 * (r / rows), p.pink);
    }
  }
};

const drawEyes = (hx: number, hy: number, kind: Eyes, p: Palette): void => {
  const gap = 4.6;
  const ry = kind === "wide" ? 3.6 : 3.2;
  const rx = kind === "wide" ? 2.9 : 2.6;

  const eye = (cx: number, shut: boolean, mood: "none" | "up" | "down"): void => {
    if (shut || mood === "up") {
      // A closed eye is an arc, and a happy eye is the same arc flipped.
      const w = 4;
      for (let i = -w / 2; i <= w / 2; i++) {
        const bend = mood === "up" ? -Math.abs(i) * 0.9 : Math.abs(i) * 0.55;
        px(cx + i, hy - 0.4 + bend, p.line);
        px(cx + i, hy + 0.6 + bend, p.line);
      }
      return;
    }
    egg(cx, hy, rx, ry, p.line);
    egg(cx, hy, rx - 0.9, ry - 0.9, p.iris);
    if (mood === "down") {
      // A sad eye is a full eye with the lid pulled over the top of it.
      for (let y = Math.floor(hy - ry); y < hy - ry * 0.15; y++) {
        for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
          if (inEgg(x, y, cx, hy, rx - 0.9, ry - 0.9)) px(x, y, p.line);
        }
      }
    }
    rect(cx - 1.4, hy - ry + 1.1, 2, 2, p.glint);
    px(cx + 1.1, hy + ry - 1.9, p.glint);
  };

  switch (kind) {
    case "closed":
      eye(hx - gap, true, "none");
      eye(hx + gap, true, "none");
      break;
    case "happy":
      eye(hx - gap, true, "up");
      eye(hx + gap, true, "up");
      px(hx - gap - 4, hy + 2, p.pink);
      px(hx - gap - 3, hy + 2, p.pink);
      px(hx + gap + 3, hy + 2, p.pink);
      px(hx + gap + 4, hy + 2, p.pink);
      break;
    case "sad":
      eye(hx - gap, false, "down");
      eye(hx + gap, false, "down");
      break;
    case "wink":
      eye(hx - gap, true, "up");
      eye(hx + gap, false, "none");
      break;
    default:
      eye(hx - gap, false, "none");
      eye(hx + gap, false, "none");
      break;
  }
};

const drawWhiskers = (hx: number, hy: number, p: Palette): void => {
  // Three a side, fanning out well past the cheeks - the single strongest
  // "this is a cat" signal in the whole sprite.
  const rows: Array<[number, number]> = [
    [-1.2, -1],
    [0.2, 0],
    [1.6, 1],
  ];
  for (const [dy, slope] of rows) {
    for (const dir of [-1, 1] as const) {
      for (let i = 0; i < 5; i++) {
        px(hx + dir * (8 + i), hy + dy + slope * (i > 2 ? 1 : 0), p.whisker);
      }
    }
  }
};

const drawFace = (hx: number, hy: number, pose: Pose, p: Palette): void => {
  drawWhiskers(hx, hy + 2.4, p);
  drawEyes(hx, hy - 0.6, pose.eyes, p);

  // Nose: a small pink wedge.
  px(hx - 1, hy + 3.4, p.pink);
  px(hx, hy + 3.4, p.pink);
  px(hx + 1, hy + 3.4, p.pink);
  px(hx, hy + 4.4, p.pink);

  const my = hy + 5.6;
  switch (pose.mouth) {
    case "smile":
      px(hx - 2, my, p.line);
      px(hx - 1, my + 1, p.line);
      px(hx, my, p.line);
      px(hx + 1, my + 1, p.line);
      px(hx + 2, my, p.line);
      break;
    case "flat":
      px(hx - 1, my + 0.5, p.line);
      px(hx, my + 0.5, p.line);
      px(hx + 1, my + 0.5, p.line);
      break;
    case "open":
      egg(hx, my + 1, 1.8, 1.4, p.line);
      egg(hx, my + 1.3, 1.1, 0.9, p.pink);
      break;
    case "frown":
      px(hx - 2, my + 1, p.line);
      px(hx - 1, my, p.line);
      px(hx, my, p.line);
      px(hx + 1, my, p.line);
      px(hx + 2, my + 1, p.line);
      break;
  }
};

const drawHead = (hx: number, hy: number, p: Palette, droop = 0): void => {
  drawEar(hx - 6.2, hy - 11.5, -1, p, droop);
  drawEar(hx + 6.2, hy - 11.5, 1, p, droop);
  eggOutlined(hx, hy, 8.4, 7.4, p);
  egg(hx, hy + 1.6, 6.2, 4.6, p.light);
  egg(hx, hy + 2.2, 5.4, 3.8, p.fur);
};

const drawPaw = (x: number, y: number, p: Palette): void => {
  egg(x, y, 2.6, 1.9, p.line);
  egg(x, y, 1.9, 1.3, p.fur);
  px(x - 0.6, y - 1.2, p.dark);
  px(x + 0.8, y - 1.2, p.dark);
};

/** The collar and its bell, hung on whatever body shape it is given. */
const drawCollar = (
  bx: number,
  by: number,
  rx: number,
  ry: number,
  top: number,
  p: Palette,
): void => {
  bandOnEgg(bx, by, rx, ry, top, 2, p.collar);
  bandOnEgg(bx, by, rx, ry, top + 2, 1, p.line);
  disc(bx, top + 3.6, 2.2, p.line);
  disc(bx, top + 3.6, 1.5, p.bell);
  px(bx - 0.8, top + 2.9, p.bellLit);
  px(bx, top + 4.4, p.line);
  px(bx, top + 5.1, p.line);
};

/**
 * The tail: a hook that sweeps out and curls back, wagging from the tip.
 * `side` puts it on her left or right, `lift` raises the whole arc.
 */
const drawTail = (
  bx: number,
  by: number,
  side: -1 | 1,
  phase: number,
  swing: number,
  lift: number,
  p: Palette,
): void => {
  const shape: Array<[number, number, number]> = [
    [0.5, 3.2, 2.6],
    [3.2, 2.8, 2.5],
    [5.6, 1.2, 2.3],
    [6.8, -1.4, 2.1],
    [6.2, -4.0, 1.9],
    [4.2, -5.2, 1.7],
    [2.4, -4.4, 1.5],
  ];
  const pts: Array<[number, number, number]> = shape.map(([dx, dy, r], i) => {
    const k = i / (shape.length - 1);
    const wag = Math.sin(phase + k * 1.6) * swing * k;
    return [bx + side * (dx + wag * 0.4), by + dy - lift * k + wag, r];
  });
  for (const [x, y, r] of pts) disc(x, y, r, p.line);
  for (const [x, y, r] of pts) disc(x, y, r - 0.9, p.fur);
};

// --------------------------------------------------------------------- poses

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

/** The sitting silhouette everything else is a variation on. */
const drawSitting = (
  cx: number,
  by: number,
  pose: Pose,
  p: Palette,
  opts: { headY: number; droop?: number; tailSwing?: number; tailLift?: number; phase: number },
): void => {
  const sq = clamp(pose.squash, -1, 1);
  const rx = 8.2 - sq * 1.8;
  const ry = 7.6 + sq * 1.8;

  drawTail(cx + 7, by - 1, 1, opts.phase, opts.tailSwing ?? 0.8, opts.tailLift ?? 0, p);
  eggOutlined(cx, by, rx, ry, p);
  egg(cx, by + 2, rx - 3.4, ry - 3, p.light);
  drawPaw(cx - 4.2, by + ry - 1.4, p);
  drawPaw(cx + 4.2, by + ry - 1.4, p);
  drawCollar(cx, by, rx, ry, by - ry + 1.4, p);
  drawHead(cx, opts.headY, p, opts.droop ?? 0);
  drawFace(cx, opts.headY, pose, p);
};

const paint = (pose: Pose, p: Palette): void => {
  buf.fill(0);

  const t = pose.t;
  const sq = clamp(pose.squash, -1, 1);
  const cx = 16;

  switch (pose.form) {
    case "sleep": {
      const breathe = Math.sin(t / 900) * 0.5;
      drawTail(cx + 8, 30 + breathe, 1, t / 900, 0.4, -2, p);
      eggOutlined(cx + 1, 28 + breathe, 11, 5.4, p);
      egg(cx + 1, 29 + breathe, 8, 3, p.light);
      drawCollar(cx - 5, 28 + breathe, 8, 5, 25 + breathe, p);
      drawHead(cx - 6, 23.5 + breathe, p, 2.6);
      drawWhiskers(cx - 6, 26 + breathe, p);
      drawEyes(cx - 6, 23 + breathe, "closed", p);
      px(cx - 7, 26.8 + breathe, p.pink);
      px(cx - 6, 26.8 + breathe, p.pink);
      px(cx - 5, 26.8 + breathe, p.pink);
      break;
    }

    case "hang": {
      // Dangling off the top edge: paws up, everything else obeying gravity.
      const sway = Math.sin(t / 520) * 1.1;
      const x = cx + sway;
      drawPaw(x - 4.5, 3, p);
      drawPaw(x + 4.5, 3, p);
      rect(x - 5, 3, 1.2, 4, p.line);
      rect(x + 4.4, 3, 1.2, 4, p.line);
      drawTail(x + 7, 27, 1, t / 420, 1.4, -3, p);
      eggOutlined(x, 26, 7.4, 7.8, p);
      egg(x, 27, 4.6, 4.6, p.light);
      drawCollar(x, 26, 7.4, 7.8, 19.4, p);
      drawHead(x, 14.5, p, 0);
      drawFace(x, 14.5, pose, p);
      break;
    }

    case "climb": {
      const step = Math.sin(t / 170);
      drawTail(cx + 4, 30, 1, t / 300, 1.6, -3, p);
      eggOutlined(cx + 3, 25, 6.6, 8.6, p);
      egg(cx + 3, 26, 3.6, 5.4, p.light);
      drawPaw(cx - 4, 15 + step * 2.4, p);
      drawPaw(cx - 4, 24 - step * 2.4, p);
      drawCollar(cx + 3, 25, 6.6, 8.6, 17.4, p);
      drawHead(cx + 2, 11.5, p, 0);
      drawFace(cx + 2, 11.5, pose, p);
      break;
    }

    case "stretch": {
      // The long luxurious post-nap stretch.
      const k = clamp(Math.sin(t / 280), 0, 1);
      drawTail(cx + 8, 27, 1, t / 400, 0.7, 4 + k * 4, p);
      eggOutlined(cx + 1, 29 - k, 10.5 + k * 1.5, 5.2 - k * 0.6, p);
      egg(cx + 1, 30 - k, 7, 2.8, p.light);
      drawPaw(cx + 8 + k * 2, 32.5, p);
      drawPaw(cx + 5 + k * 2, 33.5, p);
      drawCollar(cx + 4, 29 - k, 9, 5, 25.6 - k, p);
      drawHead(cx + 4 + k * 2, 21 + k, p, 0);
      drawFace(cx + 4 + k * 2, 21 + k, { ...pose, eyes: "closed" }, p);
      break;
    }

    case "fall": {
      const spin = Math.sin(t / 130) * 1.4;
      drawTail(cx + 7, 22, 1, t / 130, 2.4, 3, p);
      eggOutlined(cx, 24, 8 - sq * 1.6, 7.4 + sq * 1.6, p);
      egg(cx, 25.5, 4.6, 4, p.light);
      drawPaw(cx - 8, 18 + spin, p);
      drawPaw(cx + 8, 18 - spin, p);
      drawPaw(cx - 6, 31 - spin, p);
      drawPaw(cx + 6, 31 + spin, p);
      drawCollar(cx, 24, 8, 7.4, 17.6, p);
      drawHead(cx, 13 + pose.lean, p, 0);
      drawFace(cx, 13 + pose.lean, pose, p);
      break;
    }

    case "walk":
    case "run": {
      const running = pose.form === "run";
      const cycle = t / (running ? 95 : 155);
      const bob = Math.abs(Math.sin(cycle)) * 1.3;
      const lean = running ? 1.4 : 0;
      const by = 27.4 - bob;

      drawTail(cx + 7, by - 1, 1, cycle * 0.9, running ? 0.5 : 1.4, running ? 4 : 1.5, p);
      eggOutlined(cx, by, 8, 6.6, p);
      egg(cx, by + 1.6, 4.8, 3.4, p.light);
      // Two pairs of legs, half a cycle apart.
      drawPaw(cx - 4.4 + Math.sin(cycle) * 2.6, 33.2 - Math.max(0, Math.sin(cycle)) * 2, p);
      drawPaw(
        cx + 4.4 + Math.sin(cycle + Math.PI) * 2.6,
        33.2 - Math.max(0, Math.sin(cycle + Math.PI)) * 2,
        p,
      );
      drawCollar(cx, by, 8, 6.6, by - 5.2, p);
      drawHead(cx + lean, 14.4 - bob + pose.lean, p, 0);
      drawFace(cx + lean, 14.4 - bob + pose.lean, pose, p);
      break;
    }

    case "cheer": {
      const hop = Math.abs(Math.sin(t / 135)) * 2.6;
      drawSitting(cx, 27.4 - hop, { ...pose, eyes: "happy", mouth: "open" }, p, {
        headY: 14 - hop,
        phase: t / 110,
        tailSwing: 2.2,
        tailLift: 3,
      });
      drawPaw(cx - 9.5, 19 - hop - Math.sin(t / 135) * 2.4, p);
      drawPaw(cx + 9.5, 19 - hop - Math.cos(t / 135) * 2.4, p);
      break;
    }

    case "sad":
      drawSitting(cx, 28.4, { ...pose, eyes: "sad", mouth: "frown" }, p, {
        headY: 16,
        droop: 2.6,
        phase: t / 1400,
        tailSwing: 0.25,
        tailLift: -2,
      });
      break;

    case "eat": {
      const chew = Math.sin(t / 115) > 0 ? 1 : 0;
      drawSitting(cx, 28, { ...pose, eyes: "happy", mouth: chew ? "open" : "smile" }, p, {
        headY: 16.5 + chew,
        phase: t / 500,
        tailSwing: 0.8,
      });
      break;
    }

    case "groom": {
      const lick = Math.sin(t / 230);
      drawSitting(cx, 28, { ...pose, eyes: "closed" }, p, {
        headY: 15,
        phase: t / 600,
        tailSwing: 0.6,
      });
      drawPaw(cx + 5.5, 18.5 + lick, p);
      break;
    }

    case "watch": {
      // Alert: tail twitching, dead still otherwise.
      const twitch = Math.sin(t / 95) * 1.8;
      drawSitting(cx, 27.8, { ...pose, eyes: pose.eyes === "closed" ? "closed" : "wide" }, p, {
        headY: 14.4,
        phase: t / 95,
        tailSwing: twitch * 0.5,
        tailLift: 2,
      });
      break;
    }

    case "sit":
    default: {
      const breathe = Math.sin(t / 1100) * 0.4;
      drawSitting(cx, 28 + breathe, pose, p, {
        headY: 15 + breathe + pose.lean,
        phase: t / 620,
        tailSwing: 0.8,
      });
      break;
    }
  }
};

// -------------------------------------------------------------------- output

export class CatRenderer {
  private readonly view: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly small: HTMLCanvasElement;
  private readonly smallCtx: CanvasRenderingContext2D;
  private readonly image: ImageData;
  private readonly pixels: Uint32Array;
  private zoom = 3;

  constructor(view: HTMLCanvasElement) {
    this.view = view;
    this.ctx = view.getContext("2d", { alpha: true })!;
    this.small = document.createElement("canvas");
    this.small.width = W;
    this.small.height = H;
    this.smallCtx = this.small.getContext("2d", { alpha: true })!;
    this.image = this.smallCtx.createImageData(W, H);
    this.pixels = new Uint32Array(this.image.data.buffer);
    this.setZoom(3);
  }

  /** `zoom` is how many device pixels one of Luna's pixels takes up. */
  setZoom(zoom: number): void {
    this.zoom = Math.max(1, Math.round(zoom));
    this.view.width = W * this.zoom;
    this.view.height = H * this.zoom;
    const dpr = window.devicePixelRatio || 1;
    this.view.style.width = `${(W * this.zoom) / dpr}px`;
    this.view.style.height = `${(H * this.zoom) / dpr}px`;
    this.ctx.imageSmoothingEnabled = false;
  }

  /** CSS size of the sprite, for layout and hit testing. */
  get size(): { w: number; h: number } {
    const dpr = window.devicePixelRatio || 1;
    return { w: (W * this.zoom) / dpr, h: (H * this.zoom) / dpr };
  }

  draw(pose: Pose, fur: FurName, facing: 1 | -1): void {
    paint(pose, FURS[fur]);
    this.pixels.set(buf);
    this.smallCtx.putImageData(this.image, 0, 0);

    const { width, height } = this.view;
    this.ctx.clearRect(0, 0, width, height);
    this.ctx.imageSmoothingEnabled = false;
    if (facing < 0) {
      this.ctx.setTransform(-1, 0, 0, 1, width, 0);
    } else {
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    this.ctx.drawImage(this.small, 0, 0, width, height);
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
}
