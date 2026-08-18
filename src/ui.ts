/**
 * The bits of Luna that are HTML: her speech bubble, the build timer she wears
 * on her head, floating hearts, and the little settings card.
 *
 * Particles animate through the Web Animations API rather than a JS loop, so
 * once one is spawned it costs the main thread nothing.
 */

import { FUR_ORDER, furSwatch, type FurName } from "./sprite";
import type { Settings, Stats } from "./mind";

const stage = document.getElementById("stage") as HTMLDivElement;

// ------------------------------------------------------------------- bubble

export class Bubble {
  private readonly el = document.getElementById("bubble") as HTMLDivElement;
  private until = 0;
  private timer = 0;

  say(text: string, kind: "" | "ok" | "bad" = "", ms = 3200): void {
    this.el.textContent = text;
    this.el.className = kind;
    this.until = performance.now() + ms;
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => this.hide(), ms);
  }

  hide(): void {
    this.el.classList.add("hidden");
    this.until = 0;
  }

  get visible(): boolean {
    return this.until > performance.now();
  }

  /** Anchored to the top-centre of Luna, then nudged to stay on screen. */
  place(cx: number, top: number, bounds: { w: number; h: number }): void {
    if (!this.visible) return;
    this.el.classList.remove("hidden");
    const w = this.el.offsetWidth;
    const h = this.el.offsetHeight;
    let x = cx - w / 2;
    let y = top - h - 10;
    x = Math.max(6, Math.min(bounds.w - w - 6, x));
    if (y < 6) y = top + 8;
    this.el.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
    this.el.style.setProperty("--tail", `${Math.round(Math.min(Math.max(cx - x - 4, 10), w - 14))}px`);
  }
}

// -------------------------------------------------------------------- timer

export class Timer {
  private readonly el = document.getElementById("timer") as HTMLDivElement;
  private on = false;

  show(text: string, kind: "" | "ok" | "bad" = ""): void {
    this.el.textContent = text;
    this.el.className = kind;
    this.on = true;
  }

  hide(): void {
    this.on = false;
    this.el.classList.add("hidden");
  }

  get visible(): boolean {
    return this.on;
  }

  place(cx: number, top: number): void {
    if (!this.on) return;
    this.el.classList.remove("hidden");
    const w = this.el.offsetWidth;
    this.el.style.transform = `translate3d(${Math.round(cx - w / 2)}px, ${Math.round(top - 16)}px, 0)`;
  }
}

// ---------------------------------------------------------------- particles

type Bit = "heart" | "zzz" | "spark";

const GLYPHS: Record<Bit, string[]> = {
  heart: ["♥", "♡"],
  zzz: ["z", "Z"],
  spark: ["✦", "✧"],
};

export function puff(kind: Bit, x: number, y: number, count = 1): void {
  for (let i = 0; i < count; i++) {
    const el = document.createElement("div");
    el.className = `bit ${kind}`;
    const glyphs = GLYPHS[kind];
    el.textContent = glyphs[Math.floor(Math.random() * glyphs.length)]!;
    stage.appendChild(el);

    const drift = (Math.random() - 0.5) * 26;
    const rise = kind === "zzz" ? 26 : 34;
    const delay = i * 130;
    const anim = el.animate(
      [
        { transform: `translate3d(${x}px, ${y}px, 0) scale(0.6)`, opacity: 0 },
        { transform: `translate3d(${x + drift * 0.4}px, ${y - rise * 0.45}px, 0) scale(1)`, opacity: 1, offset: 0.25 },
        { transform: `translate3d(${x + drift}px, ${y - rise}px, 0) scale(0.9)`, opacity: 0 },
      ],
      { duration: kind === "zzz" ? 2600 : 1400, delay, easing: "ease-out", fill: "forwards" },
    );
    anim.onfinish = () => el.remove();
    anim.oncancel = () => el.remove();
  }
}

/** The laser dot is a particle Luna is allowed to chase. */
export class Laser {
  private el: HTMLDivElement | null = null;
  x = 0;
  y = 0;

  get active(): boolean {
    return this.el !== null;
  }

  start(x: number, y: number): void {
    if (this.el) return;
    this.el = document.createElement("div");
    this.el.className = "bit laser";
    stage.appendChild(this.el);
    this.move(x, y);
  }

  move(x: number, y: number): void {
    this.x = x;
    this.y = y;
    if (this.el) this.el.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
  }

  stop(): void {
    this.el?.remove();
    this.el = null;
  }
}

// -------------------------------------------------------------------- panel

export interface PanelHooks {
  settings: Settings;
  stats: Stats;
  version: string;
  cliPath: string | null;
  onFur(fur: FurName): void;
  onZoom(zoom: number): void;
  onSpeed(speed: number): void;
  onChatty(value: Settings["chatty"]): void;
  onToggle(key: "ghost" | "autoGhost" | "autostart" | "quiet", on: boolean): void;
  onAction(action: "snack" | "play" | "nap" | "quit"): void;
}

export class Panel {
  private readonly el = document.getElementById("panel") as HTMLDivElement;
  private hooks: PanelHooks | null = null;
  private leaveTimer = 0;
  open = false;

  toggle(hooks: PanelHooks, x: number, y: number, bounds: { w: number; h: number }): void {
    if (this.open) {
      this.close();
      return;
    }
    this.hooks = hooks;
    this.render();
    this.el.classList.remove("hidden");
    this.open = true;
    // The overlay is click-through everywhere else, so there is no "click
    // outside to dismiss" - she tidies the panel away herself instead.
    this.el.onpointerleave = () => {
      window.clearTimeout(this.leaveTimer);
      this.leaveTimer = window.setTimeout(() => this.close(), 2500);
    };
    this.el.onpointerenter = () => window.clearTimeout(this.leaveTimer);
    // Measure after it is visible, then keep it on screen.
    const w = this.el.offsetWidth;
    const h = this.el.offsetHeight;
    const px = Math.max(6, Math.min(bounds.w - w - 6, x - w / 2));
    const py = Math.max(6, Math.min(bounds.h - h - 6, y - h - 12));
    this.el.style.transform = `translate3d(${Math.round(px)}px, ${Math.round(py)}px, 0)`;
  }

  close(): void {
    window.clearTimeout(this.leaveTimer);
    this.open = false;
    this.el.classList.add("hidden");
  }

  rect(): DOMRect | null {
    return this.open ? this.el.getBoundingClientRect() : null;
  }

  contains(target: EventTarget | null): boolean {
    return target instanceof Node && this.el.contains(target);
  }

  private render(): void {
    const h = this.hooks;
    if (!h) return;
    const s = h.settings;
    this.el.replaceChildren();

    const add = (node: Node): void => {
      this.el.appendChild(node);
    };
    const heading = (text: string): HTMLElement => {
      const el = document.createElement("h4");
      el.textContent = text;
      return el;
    };
    const row = (label: string, control: HTMLElement): HTMLElement => {
      const el = document.createElement("div");
      el.className = "row";
      const span = document.createElement("span");
      span.textContent = label;
      el.append(span, control);
      return el;
    };
    const toggle = (on: boolean, onChange: (next: boolean) => void): HTMLButtonElement => {
      const btn = document.createElement("button");
      btn.className = `toggle${on ? " on" : ""}`;
      btn.onclick = () => {
        const next = !btn.classList.contains("on");
        btn.classList.toggle("on", next);
        onChange(next);
      };
      return btn;
    };
    const segmented = <T extends string | number>(
      options: Array<{ label: string; value: T }>,
      current: T,
      onPick: (value: T) => void,
    ): HTMLElement => {
      const wrap = document.createElement("div");
      wrap.className = "seg";
      for (const option of options) {
        const btn = document.createElement("button");
        btn.textContent = option.label;
        btn.className = option.value === current ? "on" : "";
        btn.onclick = () => {
          for (const sibling of wrap.children) sibling.className = "";
          btn.className = "on";
          onPick(option.value);
        };
        wrap.appendChild(btn);
      }
      return wrap;
    };

    // --- how she's doing
    add(heading(`Luna · level ${h.stats.level}`));
    const bars: Array<[string, number]> = [
      ["mood", h.stats.mood],
      ["energy", h.stats.energy],
      ["food", h.stats.fullness],
      ["bond", h.stats.bond],
    ];
    for (const [label, value] of bars) {
      const line = document.createElement("div");
      line.className = "stat";
      const name = document.createElement("b");
      name.textContent = label;
      const bar = document.createElement("div");
      bar.className = "bar";
      const fill = document.createElement("i");
      fill.style.width = `${Math.round(value * 100)}%`;
      bar.appendChild(fill);
      line.append(name, bar);
      add(line);
    }

    // --- looks
    add(heading("Coat"));
    const swatches = document.createElement("div");
    swatches.className = "swatches";
    for (const fur of FUR_ORDER) {
      const dot = document.createElement("div");
      dot.className = `swatch${fur === s.fur ? " on" : ""}`;
      dot.style.background = furSwatch(fur);
      dot.title = fur;
      dot.onclick = () => {
        for (const sibling of swatches.children) sibling.classList.remove("on");
        dot.classList.add("on");
        h.onFur(fur);
      };
      swatches.appendChild(dot);
    }
    add(swatches);

    add(
      row(
        "Size",
        segmented(
          [
            { label: "S", value: 2 },
            { label: "M", value: 3 },
            { label: "L", value: 4 },
            { label: "XL", value: 6 },
          ],
          s.zoom,
          h.onZoom,
        ),
      ),
    );

    add(
      row(
        "Pace",
        segmented(
          [
            { label: "calm", value: 0.6 },
            { label: "normal", value: 1 },
            { label: "zoomy", value: 1.7 },
          ],
          s.speed,
          h.onSpeed,
        ),
      ),
    );

    add(
      row(
        "Talks",
        segmented(
          [
            { label: "rarely", value: "quiet" as const },
            { label: "normal", value: "normal" as const },
            { label: "lots", value: "chatty" as const },
          ],
          s.chatty,
          h.onChatty,
        ),
      ),
    );

    // --- behaviour
    add(heading("Presence"));
    add(row("Ghost mode", toggle(s.ghost, (v) => h.onToggle("ghost", v))));
    add(row("Hide for fullscreen apps", toggle(s.autoGhost, (v) => h.onToggle("autoGhost", v))));
    add(
      row(
        `Quiet hours (${String(s.quietHours.from).padStart(2, "0")}–${String(s.quietHours.to).padStart(2, "0")})`,
        toggle(s.quietHours.on, (v) => h.onToggle("quiet", v)),
      ),
    );
    add(row("Start with the computer", toggle(s.autostart, (v) => h.onToggle("autostart", v))));

    // --- things to do
    add(heading("Together"));
    const acts = document.createElement("div");
    acts.className = "acts";
    type Action = Parameters<PanelHooks["onAction"]>[0];
    const button = (label: string, action: Action, danger = false): void => {
      const btn = document.createElement("button");
      btn.textContent = label;
      if (danger) btn.className = "danger";
      btn.onclick = () => h.onAction(action);
      acts.appendChild(btn);
    };
    button("Snack", "snack");
    button("Laser", "play");
    button("Nap", "nap");
    button("Quit", "quit", true);
    add(acts);

    const foot = document.createElement("div");
    foot.className = "foot";
    foot.textContent = h.cliPath
      ? `luna ${h.version} · CLI next to the app`
      : `luna ${h.version}`;
    add(foot);
  }
}
