/**
 * Luna's artwork.
 *
 * The poses are hand-drawn. `scripts/extract-sprites.py` lifts them off the
 * source sheet, cuts the background, trims each pose and packs them into one
 * PNG where every cell is the same size and every cat stands on the floor of
 * her cell - so switching pose never makes her hop.
 *
 * Coats other than her own black are generated at runtime: her fur has no hue
 * to rotate, so a tint remaps luminance through a colour ramp while leaving
 * anything actually coloured - eyes, inner ears, nose, tongue - alone.
 */

export type FurName = "midnight" | "smoke" | "cream" | "ginger" | "mint";

export const FUR_ORDER: FurName[] = ["midnight", "smoke", "cream", "ginger", "mint"];

/** Dark end and light end of each coat's ramp. `null` means "leave her be". */
const RAMPS: Record<FurName, [string, string] | null> = {
  midnight: null,
  smoke: ["#2f353f", "#d3dae4"],
  cream: ["#5c4732", "#fff3de"],
  ginger: ["#6d3a13", "#ffcb8b"],
  mint: ["#2c5a4e", "#dcf5ea"],
};

export const furSwatch = (name: FurName): string => RAMPS[name]?.[1] ?? "#26262f";

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

/** Kept so the behaviour code can keep describing her face; the drawn poses
 *  carry their own expressions, so only a few of these still do anything. */
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
  /** Extra vertical lean, in source pixels. */
  lean: number;
}

interface Manifest {
  cell: [number, number];
  frames: string[];
  boxes: Array<[number, number, number, number]>;
  base: number;
}

/** Which drawn pose stands in for each behaviour. */
const FRAME_FOR: Record<Form, string | string[]> = {
  sit: "sit",
  walk: ["walk-a", "walk-b"],
  run: "run",
  sleep: "sleep",
  fall: "fall",
  // She grips the top edge with her paws up - the same shape as clinging to a
  // wall, so one drawing serves both.
  hang: "climb",
  climb: "climb",
  stretch: "groom",
  cheer: "happy",
  sad: "sad",
  eat: "groom",
  groom: "groom",
  watch: "alert",
};

const SHEET_URL = "luna.png";
const MANIFEST_URL = "luna-frames.json";

const hexToRgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
};

export class CatRenderer {
  private readonly view: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private sheet: HTMLImageElement | null = null;
  private manifest: Manifest | null = null;
  private index = new Map<string, number>();

  /** Cached recolour of the whole sheet for the coat in use. */
  private tinted: HTMLCanvasElement | null = null;
  private tintedFur: FurName | null = null;

  private zoom = 3;
  private scale = 1;
  private frame = 0;

  constructor(view: HTMLCanvasElement) {
    this.view = view;
    this.ctx = view.getContext("2d", { alpha: true })!;
  }

  async load(): Promise<void> {
    const [image, manifest] = await Promise.all([
      new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("luna: could not load the spritesheet"));
        img.src = SHEET_URL;
      }),
      fetch(MANIFEST_URL).then((r) => r.json() as Promise<Manifest>),
    ]);

    this.sheet = image;
    this.manifest = manifest;
    manifest.frames.forEach((name, i) => this.index.set(name, i));
    this.setZoom(this.zoom);
  }

  get ready(): boolean {
    return this.sheet !== null && this.manifest !== null;
  }

  /** `zoom` is the size step from the settings panel; she sits 32 CSS pixels
   *  tall per step, and every other pose is scaled to match. */
  setZoom(zoom: number): void {
    this.zoom = Math.max(1, zoom);
    const m = this.manifest;
    if (!m) return;

    const sitHeight = m.boxes[m.base]?.[3] ?? m.cell[1];
    this.scale = (this.zoom * 32) / sitHeight;

    const dpr = window.devicePixelRatio || 1;
    const cssW = m.cell[0] * this.scale;
    const cssH = m.cell[1] * this.scale;
    this.view.width = Math.round(cssW * dpr);
    this.view.height = Math.round(cssH * dpr);
    this.view.style.width = `${cssW}px`;
    this.view.style.height = `${cssH}px`;
  }

  /** CSS size of one cell - Luna's box for physics and layout. */
  get size(): { w: number; h: number } {
    const m = this.manifest;
    if (!m) return { w: this.zoom * 32, h: this.zoom * 32 };
    return { w: m.cell[0] * this.scale, h: m.cell[1] * this.scale };
  }

  /** Where the cat actually is inside that box, so the mouse only catches her
   *  and not the empty air her cell reserves for other poses. */
  get hitBox(): { x: number; y: number; w: number; h: number } {
    const m = this.manifest;
    const box = m?.boxes[this.frame];
    if (!m || !box) {
      const s = this.size;
      return { x: 0, y: 0, w: s.w, h: s.h };
    }
    return {
      x: box[0] * this.scale,
      y: box[1] * this.scale,
      w: box[2] * this.scale,
      h: box[3] * this.scale,
    };
  }

  private frameFor(pose: Pose): number {
    const want = FRAME_FOR[pose.form] ?? "sit";
    let name: string;
    if (Array.isArray(want)) {
      // Two-frame cycles: swap on a fixed beat so the gait reads as walking.
      const step = Math.floor(pose.t / 170) % want.length;
      name = want[step]!;
    } else {
      name = want;
    }
    return this.index.get(name) ?? this.index.get("sit") ?? 0;
  }

  /**
   * Build a recoloured copy of the sheet. Fur is grey, so it is remapped by
   * brightness through the coat's ramp; anything with real colour in it is
   * left exactly as drawn.
   */
  private tintFor(fur: FurName): CanvasImageSource {
    const sheet = this.sheet!;
    const ramp = RAMPS[fur];
    if (!ramp) return sheet;
    if (this.tinted && this.tintedFur === fur) return this.tinted;

    const canvas = document.createElement("canvas");
    canvas.width = sheet.naturalWidth;
    canvas.height = sheet.naturalHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(sheet, 0, 0);

    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = image.data;
    const [dr, dg, db] = hexToRgb(ramp[0]);
    const [lr, lg, lb] = hexToRgb(ramp[1]);

    // Her darks and lights are close together, so normalise against what is
    // actually in the drawing rather than the full 0-255 range.
    let lo = 255;
    let hi = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3]! < 8) continue;
      const r = data[i]!;
      const g = data[i + 1]!;
      const b = data[i + 2]!;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      if (max > 0 && (max - min) / max > 0.28) continue; // coloured, skip
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      if (lum < lo) lo = lum;
      if (lum > hi) hi = lum;
    }
    const span = Math.max(1, hi - lo);

    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3]! < 8) continue;
      const r = data[i]!;
      const g = data[i + 1]!;
      const b = data[i + 2]!;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      if (max > 0 && (max - min) / max > 0.28) continue;
      const k = Math.min(1, Math.max(0, (0.299 * r + 0.587 * g + 0.114 * b - lo) / span));
      data[i] = Math.round(dr + (lr - dr) * k);
      data[i + 1] = Math.round(dg + (lg - dg) * k);
      data[i + 2] = Math.round(db + (lb - db) * k);
    }

    ctx.putImageData(image, 0, 0);
    this.tinted = canvas;
    this.tintedFur = fur;
    return canvas;
  }

  draw(pose: Pose, fur: FurName, facing: 1 | -1): void {
    const m = this.manifest;
    if (!this.sheet || !m) return;

    this.frame = this.frameFor(pose);
    const [cellW, cellH] = m.cell;
    const { width, height } = this.view;

    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, width, height);
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = "high";

    // Squash and stretch conserve area and stay planted on her feet, which is
    // what makes a landing read as weight rather than as a glitch.
    const sq = Math.max(-1, Math.min(1, pose.squash));
    const sx = 1 - sq * 0.18;
    const sy = 1 + sq * 0.18;
    const dw = width * sx;
    const dh = height * sy;
    const dx = (width - dw) / 2;
    const dy = height - dh + pose.lean * this.scale;

    if (facing < 0) this.ctx.setTransform(-1, 0, 0, 1, width, 0);
    this.ctx.drawImage(
      this.tintFor(fur),
      this.frame * cellW,
      0,
      cellW,
      cellH,
      facing < 0 ? width - dx - dw : dx,
      dy,
      dw,
      dh,
    );
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
}
