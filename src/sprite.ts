/**
 * Luna, drawn from scratch into a 26x24 grid of pixels.
 *
 * There is no sprite sheet and no image asset anywhere in this app. Every pose
 * is a handful of discs and rectangles snapped to the pixel grid, which means
 * poses can be *parameterised* - the tail curls, the body squashes when she
 * lands, ears droop by a fraction - instead of being frozen frames. It also
 * means a fur colour is a five-entry palette swap and costs nothing.
 */

export const W = 26;
export const H = 24;

export type FurName = "cream" | "smoke" | "void" | "ginger" | "mint";

interface Palette {
  line: number;
  fur: number;
  dark: number;
  light: number;
  white: number;
  pink: number;
  eye: number;
  glint: number;
}

/** 0xAABBGGRR - the byte order an ImageData Uint32 view expects. */
const rgb = (hex: string, a = 255): number => {
  const n = parseInt(hex.slice(1), 16);
  return ((a << 24) | (((n & 0xff) << 16) | (n & 0xff00) | ((n >> 16) & 0xff))) >>> 0;
};

const base = {
  line: rgb("#2a2233"),
  white: rgb("#fffaf2"),
  pink: rgb("#e88fa8"),
  eye: rgb("#2a2233"),
  glint: rgb("#ffffff"),
};

export const FURS: Record<FurName, Palette> = {
  cream: { ...base, fur: rgb("#f2dcbb"), dark: rgb("#d9bb8f"), light: rgb("#fff3e1") },
  smoke: { ...base, fur: rgb("#c2c8d4"), dark: rgb("#98a0b0"), light: rgb("#e6ebf3") },
  void: {
    ...base,
    line: rgb("#1b1722"),
    fur: rgb("#544b66"),
    dark: rgb("#3c3550"),
    light: rgb("#6e6486"),
  },
  ginger: { ...base, fur: rgb("#f0a15a"), dark: rgb("#cd7a3b"), light: rgb("#ffc78a") },
  mint: { ...base, fur: rgb("#a9ddc9"), dark: rgb("#7dbaa4"), light: rgb("#d5f3e7") },
};

export const FUR_ORDER: FurName[] = ["cream", "smoke", "ginger", "mint", "void"];

/** The swatch colour shown in the settings panel. */
export const furSwatch = (name: FurName): string => {
  const c = FURS[name].fur;
  const r = c & 0xff;
  const g = (c >> 8) & 0xff;
  const b = (c >> 16) & 0xff;
  return `rgb(${r},${g},${b})`;
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

// ------------------------------------------------------------------ raster

const buf = new Uint32Array(W * H);

const px = (x: number, y: number, c: number): void => {
  const xi = x | 0;
  const yi = y | 0;
  if (xi < 0 || yi < 0 || xi >= W || yi >= H) return;
  buf[yi * W + xi] = c;
};

const rect = (x: number, y: number, w: number, h: number, c: number): void => {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) px(x + i, y + j, c);
};

/** Filled circle on the pixel grid; the workhorse for every soft shape. */
const disc = (cx: number, cy: number, r: number, c: number): void => {
  const rr = r * r;
  const y0 = Math.floor(cy - r);
  const y1 = Math.ceil(cy + r);
  const x0 = Math.floor(cx - r);
  const x1 = Math.ceil(cx + r);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      if (dx * dx + dy * dy <= rr) px(x, y, c);
    }
  }
};

/** An egg: a disc stretched on each axis. Luna is mostly eggs. */
const egg = (cx: number, cy: number, rx: number, ry: number, c: number): void => {
  const y0 = Math.floor(cy - ry);
  const y1 = Math.ceil(cy + ry);
  const x0 = Math.floor(cx - rx);
  const x1 = Math.ceil(cx + rx);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) px(x, y, c);
    }
  }
};

/** Outlined egg: dark silhouette first, fur inset by a pixel. */
const eggOutlined = (cx: number, cy: number, rx: number, ry: number, p: Palette): void => {
  egg(cx, cy, rx, ry, p.line);
  egg(cx, cy, rx - 1, ry - 1, p.fur);
  egg(cx, cy + 0.6, rx - 1.6, ry - 1.8, p.light);
};

const triangleEar = (cx: number, top: number, w: number, p: Palette, droop: number): void => {
  const rows = 5;
  for (let r = 0; r < rows; r++) {
    const y = top + r + droop;
    const half = (r / (rows - 1)) * (w / 2);
    for (let x = Math.round(cx - half); x <= Math.round(cx + half); x++) px(x, y, p.line);
  }
  for (let r = 2; r < rows; r++) {
    const y = top + r + droop;
    const half = (r / (rows - 1)) * (w / 2) - 1;
    for (let x = Math.round(cx - half); x <= Math.round(cx + half); x++) px(x, y, p.fur);
  }
  px(cx, top + 3 + droop, p.pink);
};

// -------------------------------------------------------------------- parts

const drawTail = (
  x: number,
  y: number,
  phase: number,
  swing: number,
  lift: number,
  p: Palette,
): void => {
  // Six tapering segments along a sine, curling up away from the hip.
  const pts: Array<[number, number, number]> = [];
  for (let i = 0; i < 6; i++) {
    const k = i / 5;
    const wag = Math.sin(phase + k * 1.9) * swing * k;
    pts.push([x - 1.5 * i - k * 1.4, y - k * k * 3 - k * lift + wag, 1.9 - k * 0.5]);
  }
  for (const [tx, ty, r] of pts) disc(tx, ty, r, p.line);
  for (const [tx, ty, r] of pts) disc(tx, ty, r - 0.85, p.fur);
  const tip = pts[5]!;
  disc(tip[0], tip[1], 1.0, p.white);
};

const drawPaw = (x: number, y: number, p: Palette): void => {
  disc(x, y, 1.9, p.line);
  disc(x, y, 1.1, p.white);
};

const drawEyes = (cx: number, cy: number, kind: Eyes, p: Palette): void => {
  const lx = cx - 3;
  const rx2 = cx + 2;

  const open = (x: number, wide: boolean) => {
    const w = wide ? 3 : 2;
    const h = wide ? 3 : 2;
    rect(x, cy, w, h, p.eye);
    px(x + w - 1, cy, p.glint);
  };
  const arcUp = (x: number) => {
    px(x, cy + 1, p.eye);
    px(x + 1, cy, p.eye);
    px(x + 2, cy + 1, p.eye);
  };
  const arcDown = (x: number) => {
    px(x, cy, p.eye);
    px(x + 1, cy + 1, p.eye);
    px(x + 2, cy, p.eye);
  };
  const shut = (x: number) => {
    px(x, cy + 1, p.eye);
    px(x + 1, cy + 1, p.eye);
    px(x + 2, cy + 1, p.eye);
  };

  switch (kind) {
    case "open":
      open(lx, false);
      open(rx2, false);
      break;
    case "wide":
      open(lx - 1, true);
      open(rx2, true);
      break;
    case "closed":
      shut(lx - 1);
      shut(rx2 - 1);
      break;
    case "happy":
      arcUp(lx - 1);
      arcUp(rx2 - 1);
      px(lx - 2, cy + 2, p.pink);
      px(rx2 + 2, cy + 2, p.pink);
      break;
    case "sad":
      arcDown(lx - 1);
      arcDown(rx2 - 1);
      px(lx - 1, cy - 2, p.line);
      px(rx2 + 1, cy - 2, p.line);
      break;
    case "wink":
      shut(lx - 1);
      open(rx2, false);
      break;
  }
};

const drawFace = (hx: number, hy: number, pose: Pose, p: Palette): void => {
  // Whiskers go down first, so the muzzle sits on top of them.
  for (const side of [-1, 1]) {
    px(hx + side * 7, hy + 1, p.line);
    px(hx + side * 8, hy + 0.4, p.line);
    px(hx + side * 7, hy + 3, p.line);
    px(hx + side * 8, hy + 3.6, p.line);
  }

  egg(hx, hy + 3.2, 3.4, 2.2, p.white);
  drawEyes(hx, hy - 1, pose.eyes, p);

  // Nose + mouth
  px(hx - 1, hy + 2, p.pink);
  px(hx, hy + 2, p.pink);
  const my = hy + 4;
  switch (pose.mouth) {
    case "smile":
      px(hx - 2, my, p.line);
      px(hx - 1, my + 1, p.line);
      px(hx, my + 1, p.line);
      px(hx + 1, my, p.line);
      break;
    case "flat":
      px(hx - 1, my, p.line);
      px(hx, my, p.line);
      break;
    case "open":
      rect(hx - 1, my, 2, 2, p.pink);
      break;
    case "frown":
      px(hx - 2, my + 1, p.line);
      px(hx - 1, my, p.line);
      px(hx, my, p.line);
      px(hx + 1, my + 1, p.line);
      break;
  }
};

const drawHead = (hx: number, hy: number, p: Palette, droop = 0): void => {
  triangleEar(hx - 4, hy - 8, 5, p, droop);
  triangleEar(hx + 4, hy - 8, 5, p, droop);
  disc(hx, hy, 6, p.line);
  disc(hx, hy, 5, p.fur);
  disc(hx, hy + 1.4, 3.6, p.light);
};

// --------------------------------------------------------------------- poses

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

const paint = (pose: Pose, p: Palette): void => {
  buf.fill(0);

  const t = pose.t;
  const sq = clamp(pose.squash, -1, 1);
  // Squash and stretch conserve area, which is what makes a landing read as
  // weight rather than as a glitch.
  const bodyRx = 7 - sq * 1.6;
  const bodyRy = 6 + sq * 1.6;

  switch (pose.form) {
    case "sleep": {
      const breathe = Math.sin(t / 900) * 0.4;
      drawTail(19, 21 + breathe, t / 700, 0.5, -1.5, p);
      eggOutlined(13, 19.6 + breathe, 8, 4.2, p);
      drawHead(8.5, 17.4 + breathe, p, 3);
      egg(8.5, 20 + breathe, 3, 1.8, p.white);
      // Eyes closed, content little arcs.
      px(5, 17, p.eye);
      px(6, 17, p.eye);
      px(7, 18, p.eye);
      px(10, 17, p.eye);
      px(11, 17, p.eye);
      px(12, 18, p.eye);
      px(8, 19, p.pink);
      px(9, 19, p.pink);
      break;
    }

    case "hang": {
      // Dangling off the top edge: paws up, everything else obeying gravity.
      const sway = Math.sin(t / 500) * 0.9;
      drawPaw(10 + sway, 2, p);
      drawPaw(16 + sway, 2, p);
      rect(10 + sway, 2, 1, 4, p.line);
      rect(16 + sway, 2, 1, 4, p.line);
      drawTail(8 + sway, 21, t / 420, 1.2, -2, p);
      eggOutlined(13 + sway, 18.4, 5.6, 5.2, p);
      drawHead(13 + sway, 9.6, p, 0);
      drawFace(13 + sway, 9.6, pose, p);
      break;
    }

    case "climb": {
      const step = Math.sin(t / 160);
      drawTail(8, 20, t / 300, 1.6, -2, p);
      eggOutlined(14, 15, 5.4, 7, p);
      drawPaw(10, 8 + step * 2, p);
      drawPaw(10, 17 - step * 2, p);
      drawHead(14, 7, p, 0);
      drawFace(14, 7, pose, p);
      break;
    }

    case "stretch": {
      // The long luxurious post-nap stretch.
      const k = clamp(Math.sin(t / 260), 0, 1);
      drawTail(6, 18, t / 400, 0.8, 4 + k * 3, p);
      eggOutlined(13, 19 - k, 8 + k * 1.6, 4.6 - k * 0.6, p);
      drawPaw(19 + k * 2, 21, p);
      drawPaw(17 + k * 2, 22, p);
      drawHead(15 + k * 2, 12 + k, p, 0);
      drawFace(15 + k * 2, 12 + k, { ...pose, eyes: "closed" }, p);
      break;
    }

    case "fall": {
      const spin = Math.sin(t / 120) * 1.2;
      drawTail(6, 14, t / 120, 2.4, 3, p);
      eggOutlined(13, 15, bodyRx, bodyRy, p);
      drawPaw(7, 10 + spin, p);
      drawPaw(19, 10 - spin, p);
      drawPaw(8, 21 - spin, p);
      drawPaw(18, 21 + spin, p);
      drawHead(13, 8 + pose.lean, p, 0);
      drawFace(13, 8 + pose.lean, pose, p);
      break;
    }

    case "walk":
    case "run": {
      const speed = pose.form === "run" ? 90 : 150;
      const cycle = t / speed;
      const bob = Math.abs(Math.sin(cycle)) * 1.2;
      const lean = pose.form === "run" ? 1 : 0;
      drawTail(
        8,
        20.5 - bob,
        cycle * 0.9,
        pose.form === "run" ? 0.5 : 1.5,
        pose.form === "run" ? 3 : 1.5,
        p,
      );
      eggOutlined(13, 19 - bob, bodyRx - 0.4, bodyRy - 1.6, p);
      egg(13, 20 - bob, 2.6, 2.2, p.white);
      // Two pairs of legs, half a cycle apart.
      drawPaw(10 + Math.sin(cycle) * 2.4, 22.6 - Math.max(0, Math.sin(cycle)) * 1.8, p);
      drawPaw(
        16 + Math.sin(cycle + Math.PI) * 2.4,
        22.6 - Math.max(0, Math.sin(cycle + Math.PI)) * 1.8,
        p,
      );
      drawHead(13 + lean, 9 - bob + pose.lean, p, 0);
      drawFace(13 + lean, 9 - bob + pose.lean, pose, p);
      break;
    }

    case "cheer": {
      const hop = Math.abs(Math.sin(t / 130)) * 2.2;
      drawTail(8, 21 - hop, t / 110, 2.0, 2.5, p);
      eggOutlined(13, 19.4 - hop, bodyRx - 0.8, bodyRy - 1.2, p);
      egg(13, 20.6 - hop, 2.8, 2.4, p.white);
      drawPaw(6.5, 13 - hop - Math.sin(t / 130) * 2, p);
      drawPaw(19.5, 13 - hop - Math.cos(t / 130) * 2, p);
      drawHead(13, 9 - hop, p, 0);
      drawFace(13, 9 - hop, { ...pose, eyes: "happy", mouth: "open" }, p);
      break;
    }

    case "sad": {
      drawTail(8, 22, t / 1400, 0.3, -1, p);
      eggOutlined(13, 19.8, 6.4, 4.4, p);
      drawPaw(10, 22.8, p);
      drawPaw(16, 22.8, p);
      drawHead(13, 10.6, p, 2.4);
      drawFace(13, 10.6, { ...pose, eyes: "sad", mouth: "frown" }, p);
      break;
    }

    case "eat": {
      const chew = Math.sin(t / 110) > 0 ? 1 : 0;
      drawTail(8, 21, t / 500, 0.8, 1.2, p);
      eggOutlined(13, 19.4, 6.4, 4.6, p);
      drawPaw(10, 22.6, p);
      drawPaw(16, 22.6, p);
      drawHead(13, 11 + chew, p, 0);
      drawFace(13, 11 + chew, { ...pose, eyes: "happy", mouth: chew ? "open" : "smile" }, p);
      break;
    }

    case "groom": {
      const lick = Math.sin(t / 220);
      drawTail(8, 21, t / 600, 0.7, 1.2, p);
      eggOutlined(13, 19.4, 6.4, 4.6, p);
      drawPaw(15, 13 + lick, p);
      drawHead(13, 9.6, p, 0);
      drawFace(13, 9.6, { ...pose, eyes: "closed" }, p);
      break;
    }

    case "watch": {
      // Alert: ears up, tail twitching, dead still otherwise.
      const twitch = Math.sin(t / 90) * 1.8;
      drawTail(8, 21, t / 90, twitch * 0.5, 1.6, p);
      eggOutlined(13, 19.4, 6.4, 4.6, p);
      egg(13, 20.6, 2.8, 2.4, p.white);
      drawPaw(10, 22.6, p);
      drawPaw(16, 22.6, p);
      drawHead(13, 9.2, p, -0.6);
      drawFace(13, 9.2, { ...pose, eyes: pose.eyes === "closed" ? "closed" : "wide" }, p);
      break;
    }

    case "sit":
    default: {
      const breathe = Math.sin(t / 1100) * 0.35;
      drawTail(8, 21 + breathe, t / 620, 1.0, 1.5, p);
      eggOutlined(13, 19.4 + breathe, bodyRx - 0.8, bodyRy - 1.2, p);
      egg(13, 20.8 + breathe, 2.8, 2.6, p.white);
      drawPaw(10, 22.6, p);
      drawPaw(16, 22.6, p);
      drawHead(13, 9.4 + breathe + pose.lean, p, 0);
      drawFace(13, 9.4 + breathe + pose.lean, pose, p);
      break;
    }
  }
};

// ------------------------------------------------------------------- output

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
