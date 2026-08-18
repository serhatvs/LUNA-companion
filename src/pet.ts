/**
 * Luna herself: where she is, what she is doing, and why.
 *
 * Behaviour is driven by her needs rather than a random picker - `think()`
 * looks at hunger, boredom, energy and how long you have ignored her, and the
 * loudest one wins. That is what makes her feel like she has opinions.
 */

import { CatRenderer, type Eyes, type Form, type Mouth, type Pose } from "./sprite";
import type { Mind } from "./mind";
import { Bubble, Laser, Panel, Timer, puff } from "./ui";
import { duration, errorHint, line, type LineKey } from "./chatter";
import * as bridge from "./bridge";

export interface World {
  /** Window size in CSS px. */
  w: number;
  h: number;
  /** Physical origin of the overlay window. */
  ox: number;
  oy: number;
  scale: number;
  /** Monitors in CSS px, relative to the window origin. */
  monitors: Array<{ x: number; y: number; w: number; h: number }>;
}

type Act =
  | "idle"
  | "walk"
  | "follow"
  | "sleep"
  | "wake"
  | "drag"
  | "air"
  | "climb"
  | "hang"
  | "chase"
  | "watch"
  | "cheer"
  | "sulk"
  | "eat"
  | "groom";

const GRAVITY = 0.0022; // px per ms^2
const WALK = 0.036; // px per ms at speed 1
const RUN = 0.085;

const now = (): number => performance.now();
const rand = (a: number, b: number): number => a + Math.random() * (b - a);
const chance = (p: number): boolean => Math.random() < p;
const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

export class Luna {
  x = 100;
  y = 100;
  private vx = 0;
  private vy = 0;
  private facing: 1 | -1 = 1;

  private act: Act = "idle";
  private actEnd = 0;
  private actT = 0;
  private target = 0;
  private squash = 0;
  private lean = 0;

  private blinkAt = 0;
  private blinkUntil = 0;

  private wall: -1 | 1 = 1;
  private hangUntil = 0;

  /** Where the mouse is, in CSS px. */
  cursor = { x: 0, y: 0, seen: 0 };

  private snack: { x: number; y: number; el: HTMLDivElement } | null = null;

  private build: { label: string; started: number; expected: number | null } | null = null;
  private lastFail = "";

  private lastPose = "";
  private lastPaint = 0;
  private lastRectPush = 0;
  private pushedRect = { x: 0, y: 0 };

  ghostForced = false;

  constructor(
    private readonly el: HTMLDivElement,
    private readonly cat: CatRenderer,
    private readonly mind: Mind,
    private readonly bubble: Bubble,
    private readonly timer: Timer,
    private readonly panel: Panel,
    private readonly laser: Laser,
    private world: World,
  ) {
    this.cat.setZoom(this.mind.settings.zoom);
    const m = this.monitorAt(this.world.w / 2);
    this.x = m.x + m.w / 2;
    this.y = this.floorOf(m);
    this.blinkAt = now() + rand(2000, 5000);
  }

  // ------------------------------------------------------------------ world

  setWorld(world: World): void {
    this.world = world;
    this.land();
  }

  private get size(): { w: number; h: number } {
    return this.cat.size;
  }

  private monitorAt(cx: number): { x: number; y: number; w: number; h: number } {
    const list = this.world.monitors;
    if (list.length === 0) return { x: 0, y: 0, w: this.world.w, h: this.world.h };
    let best = list[0]!;
    let bestDist = Infinity;
    for (const m of list) {
      if (cx >= m.x && cx <= m.x + m.w) return m;
      const d = cx < m.x ? m.x - cx : cx - (m.x + m.w);
      if (d < bestDist) {
        bestDist = d;
        best = m;
      }
    }
    return best;
  }

  private get here(): { x: number; y: number; w: number; h: number } {
    return this.monitorAt(this.x + this.size.w / 2);
  }

  private floorOf(m: { y: number; h: number }): number {
    return m.y + m.h - this.size.h;
  }

  private land(): void {
    const m = this.here;
    this.x = clamp(this.x, m.x, m.x + m.w - this.size.w);
    this.y = Math.min(this.y, this.floorOf(m));
  }

  private get grounded(): boolean {
    return Math.abs(this.y - this.floorOf(this.here)) < 0.6;
  }

  // ---------------------------------------------------------------- talking

  say(key: LineKey, kind: "" | "ok" | "bad" = "", ms = 3200): void {
    this.speak(line(key), kind, ms);
  }

  speak(text: string, kind: "" | "ok" | "bad" = "", ms = 3200): void {
    if (this.isQuietTime() && kind !== "bad") return;
    this.bubble.say(text, kind, ms);
  }

  /** Chattiness-gated small talk. Important lines call `speak` directly. */
  private maybeSay(key: LineKey, base = 0.5): void {
    const gate = { quiet: 0.15, normal: 1, chatty: 1.8 }[this.mind.settings.chatty];
    if (chance(base * gate)) this.say(key);
  }

  isQuietTime(): boolean {
    const q = this.mind.settings.quietHours;
    if (!q.on) return false;
    const hour = new Date().getHours();
    return q.from <= q.to ? hour >= q.from && hour < q.to : hour >= q.from || hour < q.to;
  }

  // -------------------------------------------------------------- behaviour

  private begin(act: Act, ms: number): void {
    this.act = act;
    this.actT = 0;
    this.actEnd = now() + ms;
  }

  /** Pick the next thing to do. Needs first, whims second. */
  think(): void {
    const s = this.mind.stats;

    if (this.build) {
      this.begin("watch", 1500);
      return;
    }

    if (this.isQuietTime() || s.energy < 0.18) {
      this.goSleep();
      return;
    }

    if (s.fullness < 0.22 && chance(0.6)) {
      this.begin("idle", rand(2200, 3600));
      this.maybeSay("hungry", 0.7);
      return;
    }

    if (s.attention > 0.78 && this.cursor.seen > 0) {
      this.begin("follow", rand(3500, 7000));
      this.maybeSay("lonely", 0.35);
      return;
    }

    if (s.bored > 0.72) {
      // Restless: zoomies, a climb, or a good long groom.
      if (chance(0.35)) {
        this.startClimb();
      } else if (chance(0.5)) {
        this.walkSomewhere(true);
      } else {
        this.begin("groom", rand(2600, 4200));
      }
      this.mind.play();
      this.maybeSay("bored", 0.3);
      return;
    }

    const roll = Math.random();
    if (roll < 0.36) this.begin("idle", rand(2500, 7000));
    else if (roll < 0.75) this.walkSomewhere(false);
    else if (roll < 0.86) this.begin("groom", rand(2400, 4000));
    else if (roll < 0.94) this.startClimb();
    else this.begin("idle", rand(1200, 2000));
  }

  private walkSomewhere(far: boolean): void {
    const m = this.here;
    const span = m.w - this.size.w;
    const from = this.x - m.x;
    const to = far ? rand(0, span) : clamp(from + rand(-span * 0.4, span * 0.4), 0, span);
    this.target = m.x + to;
    this.begin("walk", 20000);
  }

  private startClimb(): void {
    const m = this.here;
    const left = this.x - m.x;
    const right = m.x + m.w - (this.x + this.size.w);
    this.wall = left < right ? -1 : 1;
    this.target = this.wall < 0 ? m.x : m.x + m.w - this.size.w;
    this.begin("walk", 20000);
    // `walk` hands over to `climb` when it reaches the wall.
    this.climbAfterWalk = true;
  }

  private climbAfterWalk = false;

  goSleep(): void {
    this.begin("sleep", rand(50_000, 200_000));
    this.maybeSay("sleepy", 0.5);
  }

  wake(loud = true): void {
    if (this.act !== "sleep") return;
    this.begin("wake", 1500);
    if (loud) this.maybeSay("wake", 0.6);
  }

  // ----------------------------------------------------------- interactions

  grab(px: number, py: number): { dx: number; dy: number } {
    this.wake(false);
    this.begin("drag", 1e9);
    this.vx = 0;
    this.vy = 0;
    void bridge.setPointerLock(true);
    return { dx: px - this.x, dy: py - this.y };
  }

  dragTo(x: number, y: number, dt: number): void {
    if (this.act !== "drag") return;
    const nx = clamp(x, 0, this.world.w - this.size.w);
    const ny = clamp(y, 0, this.world.h - this.size.h);
    if (dt > 0) {
      this.vx = (nx - this.x) / dt;
      this.vy = (ny - this.y) / dt;
    }
    if (Math.abs(this.vx) > 0.02) this.facing = this.vx > 0 ? 1 : -1;
    this.x = nx;
    this.y = ny;
  }

  release(): void {
    if (this.act !== "drag") return;
    void bridge.setPointerLock(false);
    // Throwing should feel like throwing, so keep most of the wrist speed.
    this.vx = clamp(this.vx * 0.9, -3.2, 3.2);
    this.vy = clamp(this.vy * 0.9, -3.2, 3.2);
    this.begin("air", 1e9);
    if (Math.abs(this.vx) + Math.abs(this.vy) > 1.1) this.maybeSay("thrown", 0.7);
  }

  pet(): void {
    this.wake(false);
    this.mind.pet();
    const s = this.size;
    puff("heart", this.x + s.w / 2 - 6, this.y - 4);
    if (chance(0.35)) this.maybeSay("pet", 0.8);
    if (this.act === "walk" || this.act === "follow") this.begin("idle", 2200);
  }

  playLaser(): void {
    this.wake(false);
    const m = this.here;
    this.laser.start(rand(m.x + 40, m.x + m.w - 40), this.floorOf(m) + this.size.h - 10);
    this.begin("chase", 9000);
    this.say("laser");
    this.mind.play();
  }

  offerSnack(): void {
    this.wake(false);
    const m = this.here;
    const x = clamp(this.x + rand(-160, 160), m.x + 20, m.x + m.w - 40);
    const y = this.floorOf(m) + this.size.h - 14;
    this.snack?.el.remove();
    const el = document.createElement("div");
    el.className = "bit";
    el.textContent = "🐟";
    el.style.font = "16px system-ui";
    el.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
    document.getElementById("stage")!.appendChild(el);
    this.snack = { x, y, el };
    this.target = x - this.size.w / 2 + 8;
    this.begin("walk", 20000);
    this.climbAfterWalk = false;
  }

  summon(): void {
    this.wake(false);
    const m = this.monitorAt(this.cursor.seen ? this.cursor.x : this.world.w / 2);
    this.x = clamp(
      (this.cursor.seen ? this.cursor.x : m.x + m.w / 2) - this.size.w / 2,
      m.x,
      m.x + m.w - this.size.w,
    );
    this.y = this.floorOf(m);
    this.vx = 0;
    this.vy = 0;
    this.squash = -0.5;
    this.begin("idle", 3000);
    this.say("greet");
  }

  // ---------------------------------------------------------------- builds

  buildStarted(label: string): void {
    this.wake(false);
    const first = this.mind.noteBuildDay();
    this.build = { label, started: Date.now(), expected: this.mind.expectedMs(label) };
    this.begin("watch", 1e9);
    this.timer.show("0s");

    if (first) {
      this.speak(line("firstBuildOfDay"), "");
    } else if (this.build.expected) {
      this.speak(`${line("buildStart")} usually ~${duration(this.build.expected)}`);
    } else {
      this.maybeSay("buildStart", 0.9);
    }
  }

  buildFinished(ok: boolean, ms: number, label: string, tail: string): void {
    const memory = this.mind.rememberBuild(label, ms, ok);
    this.build = null;
    this.mind.stats.builds += 1;
    this.mind.touch();

    if (ok) {
      this.mind.stats.buildsPassed += 1;
      this.mind.stats.mood = clamp(this.mind.stats.mood + 0.12, 0, 1);
      const levelled = this.mind.reward(12);
      this.timer.show(duration(ms), "ok");
      window.setTimeout(() => this.timer.hide(), 3200);
      this.begin("cheer", 3000);
      const s = this.size;
      puff("spark", this.x + s.w / 2 - 6, this.y - 6, 3);
      puff("heart", this.x + s.w / 2 - 6, this.y - 2, 2);
      const quick = ms < 4000 ? line("buildFast") : line("buildOk");
      this.speak(`${quick} ${duration(ms)}`, "ok", 4200);
      if (levelled) window.setTimeout(() => this.speak(line("levelUp"), "ok", 3000), 4300);
      if (this.mind.stats.streak > 1 && memory.runs === 1) {
        window.setTimeout(() => this.say("streak", "ok"), 4300);
      }
    } else {
      this.mind.stats.buildsFailed += 1;
      this.mind.stats.mood = clamp(this.mind.stats.mood - 0.16, 0, 1);
      this.timer.show(duration(ms), "bad");
      window.setTimeout(() => this.timer.hide(), 4200);
      this.begin("sulk", 5000);
      const repeat = this.lastFail === label;
      this.lastFail = label;
      const hint = errorHint(tail);
      this.speak(repeat ? line("buildFailAgain") : line("buildFail"), "bad", 4000);
      if (hint) window.setTimeout(() => this.speak(hint, "bad", 7000), 4100);
    }

    void bridge.diary({
      at: new Date().toISOString(),
      kind: "build",
      label,
      ok,
      ms,
    });
    this.mind.save(true);
  }

  // ------------------------------------------------------------------ frame

  update(dtRaw: number): void {
    const dt = Math.min(dtRaw, 48);
    const t = now();
    this.actT += dt;

    if (t > this.blinkAt) {
      this.blinkUntil = t + 130;
      this.blinkAt = t + rand(2600, 7000);
    }

    switch (this.act) {
      case "drag":
        break;

      case "air":
        this.stepAir(dt);
        break;

      case "walk":
        this.stepWalk(dt);
        break;

      case "follow":
        this.stepFollow(dt);
        break;

      case "chase":
        this.stepChase(dt, t);
        break;

      case "climb":
        this.stepClimb(dt);
        break;

      case "hang":
        if (t > this.hangUntil) {
          this.vy = 0;
          this.vx = rand(-0.2, 0.2);
          this.begin("air", 1e9);
        }
        break;

      case "eat":
        if (t > this.actEnd) {
          this.snack?.el.remove();
          this.snack = null;
          this.mind.feed();
          this.say("fed", "ok");
          puff("heart", this.x + this.size.w / 2 - 6, this.y - 4, 3);
          this.begin("groom", 2600);
        }
        break;

      case "sleep":
        if (this.actT % 2600 < dt) {
          puff("zzz", this.x + this.size.w * 0.7, this.y + 2);
        }
        if (t > this.actEnd && !this.isQuietTime()) this.begin("wake", 1400);
        break;

      case "watch":
        this.stepWatch();
        break;

      default:
        if (t > this.actEnd) this.think();
        break;
    }

    // Gravity applies to anyone not holding on to something.
    if (this.act !== "drag" && this.act !== "climb" && this.act !== "hang" && this.act !== "air") {
      const floor = this.floorOf(this.here);
      if (this.y < floor - 1) {
        this.vy = 0;
        this.begin("air", 1e9);
      } else {
        this.y = floor;
      }
    }

    // The squash spring always relaxes back to neutral.
    this.squash += (0 - this.squash) * Math.min(1, dt / 90);

    this.mind.tick(dt / 1000, this.act !== "sleep");
  }

  private stepAir(dt: number): void {
    this.vy += GRAVITY * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    const m = this.here;
    const left = m.x;
    const right = m.x + m.w - this.size.w;
    const floor = this.floorOf(m);
    const top = m.y;

    if (this.x < left) {
      this.x = left;
      this.vx = Math.abs(this.vx) * 0.45;
      this.squash = -0.35;
      // A cat thrown at a wall grabs it.
      if (this.vy > -0.2 && chance(0.55)) {
        this.wall = -1;
        this.begin("climb", 1e9);
        return;
      }
    } else if (this.x > right) {
      this.x = right;
      this.vx = -Math.abs(this.vx) * 0.45;
      this.squash = -0.35;
      if (this.vy > -0.2 && chance(0.55)) {
        this.wall = 1;
        this.begin("climb", 1e9);
        return;
      }
    }

    if (this.y < top) {
      this.y = top;
      this.vy = Math.abs(this.vy) * 0.3;
    }

    if (this.y >= floor) {
      this.y = floor;
      const impact = Math.abs(this.vy);
      if (impact > 0.55) {
        this.vy = -impact * 0.34;
        this.squash = -clamp(impact * 0.7, 0.2, 0.9);
      } else {
        this.vy = 0;
        this.vx *= 0.4;
        this.squash = -0.3;
        this.begin("idle", rand(700, 1600));
      }
    }
  }

  private stepWalk(dt: number): void {
    const speed = WALK * this.mind.settings.speed * (0.7 + this.mind.stats.energy * 0.5);
    const dx = this.target - this.x;
    if (Math.abs(dx) < 2 || now() > this.actEnd) {
      this.x = Math.abs(dx) < 6 ? this.target : this.x;
      if (this.climbAfterWalk) {
        this.climbAfterWalk = false;
        this.begin("climb", 1e9);
        return;
      }
      if (this.snack && Math.abs(this.snack.x - (this.x + this.size.w / 2)) < 26) {
        this.begin("eat", 2600);
        return;
      }
      this.begin("idle", rand(1200, 4000));
      return;
    }
    this.facing = dx > 0 ? 1 : -1;
    this.x += Math.sign(dx) * Math.min(speed * dt, Math.abs(dx));

    // Walking off one monitor and onto the next is just walking.
    this.y = this.floorOf(this.here);
  }

  private stepFollow(dt: number): void {
    const want = this.cursor.x - this.size.w / 2;
    const dx = want - this.x;
    this.lean = clamp((this.cursor.y - this.y) * -0.01, -1.5, 0.5);
    if (Math.abs(dx) > 14) {
      const speed = WALK * this.mind.settings.speed * 1.25;
      this.facing = dx > 0 ? 1 : -1;
      this.x += Math.sign(dx) * Math.min(speed * dt, Math.abs(dx));
    }
    if (now() > this.actEnd) {
      this.lean = 0;
      this.think();
    }
  }

  private stepChase(dt: number, t: number): void {
    if (!this.laser.active) {
      this.think();
      return;
    }
    // The dot wanders on its own; she is always a beat behind it.
    const m = this.here;
    const wobble = Math.sin(t / 420) * 3 + Math.sin(t / 130) * 1.4;
    const lx = clamp(this.laser.x + wobble, m.x + 20, m.x + m.w - 28);
    const ly = this.floorOf(m) + this.size.h - 12 - Math.abs(Math.sin(t / 900)) * 40;
    this.laser.move(lx, ly);

    const dx = lx - (this.x + this.size.w / 2);
    if (Math.abs(dx) > 8) {
      this.facing = dx > 0 ? 1 : -1;
      this.x += Math.sign(dx) * Math.min(RUN * this.mind.settings.speed * dt, Math.abs(dx));
    } else if (this.grounded && chance(0.04)) {
      this.vy = -0.85;
      this.begin("air", 1e9);
    }

    if (t > this.actEnd) {
      this.laser.stop();
      this.begin("idle", 1800);
      this.mind.play();
    }
  }

  private stepClimb(dt: number): void {
    const m = this.here;
    this.x = this.wall < 0 ? m.x : m.x + m.w - this.size.w;
    this.facing = this.wall < 0 ? -1 : 1;
    this.y -= 0.05 * this.mind.settings.speed * dt;
    if (this.y <= m.y + 2) {
      this.y = m.y + 2;
      this.hangUntil = now() + rand(3500, 11000);
      this.begin("hang", 1e9);
    }
  }

  private stepWatch(): void {
    if (!this.build) {
      this.timer.hide();
      this.think();
      return;
    }
    const elapsed = Date.now() - this.build.started;
    const expected = this.build.expected;
    let text = duration(elapsed);
    if (expected && elapsed < expected * 1.1) {
      text = `${duration(elapsed)} / ~${duration(expected)}`;
    }
    this.timer.show(text);
    if (elapsed > 45_000 && this.actT > 20_000) {
      this.actT = 0;
      this.maybeSay("buildLong", 0.35);
    }
  }

  // ----------------------------------------------------------------- render

  render(): void {
    const t = now();
    const size = this.size;

    this.el.style.transform = `translate3d(${Math.round(this.x)}px, ${Math.round(this.y)}px, 0)`;

    const form = this.formFor();
    const eyes = this.eyesFor(t);
    const mouth = this.mouthFor();
    const pose: Pose = {
      form,
      t,
      eyes,
      mouth,
      squash: this.squash,
      lean: this.lean,
    };

    // Repaint only when the picture would actually change: ~14fps of sprite
    // work, and nothing at all while she sits still with her eyes open.
    const still = form === "sit" || form === "sleep" || form === "watch";
    const signature = `${form}|${eyes}|${mouth}|${this.facing}|${Math.round(this.squash * 8)}`;
    const due = t - this.lastPaint > (still ? 90 : 62);
    if (due || signature !== this.lastPose) {
      this.lastPose = signature;
      this.lastPaint = t;
      this.cat.draw(pose, this.mind.settings.fur, this.facing);
    }

    if (this.bubble.visible) this.bubble.place(this.x + size.w / 2, this.y, this.world);
    else this.bubble.hide();
    if (this.timer.visible) this.timer.place(this.x + size.w / 2, this.y);

    this.pushRects(t);
  }

  /** Tell Rust which pixels should catch the mouse. */
  private pushRects(t: number): void {
    const moved =
      Math.abs(this.x - this.pushedRect.x) > 2 || Math.abs(this.y - this.pushedRect.y) > 2;
    if (!moved && t - this.lastRectPush < 400) return;
    this.lastRectPush = t;
    this.pushedRect = { x: this.x, y: this.y };

    const { ox, oy, scale } = this.world;
    const size = this.size;
    const rects: bridge.Rect[] = [];
    if (!this.ghostForced && !this.mind.settings.ghost) {
      rects.push({
        x: ox + this.x * scale,
        y: oy + this.y * scale,
        w: size.w * scale,
        h: size.h * scale,
      });
    }
    const panelRect = this.panel.rect();
    if (panelRect) {
      rects.push({
        x: ox + panelRect.left * scale,
        y: oy + panelRect.top * scale,
        w: panelRect.width * scale,
        h: panelRect.height * scale,
      });
    }
    void bridge.setHitRects(rects);
  }

  private formFor(): Form {
    switch (this.act) {
      case "walk":
      case "follow":
        return "walk";
      case "chase":
        return "run";
      case "air":
      case "drag":
        return "fall";
      case "climb":
        return "climb";
      case "hang":
        return "hang";
      case "sleep":
        return "sleep";
      case "wake":
        return "stretch";
      case "cheer":
        return "cheer";
      case "sulk":
        return "sad";
      case "eat":
        return "eat";
      case "groom":
        return "groom";
      case "watch":
        return "watch";
      default:
        return "sit";
    }
  }

  private eyesFor(t: number): Eyes {
    if (this.act === "sleep") return "closed";
    if (this.act === "cheer") return "happy";
    if (this.act === "sulk") return "sad";
    if (this.act === "air" || this.act === "drag") return "wide";
    if (t < this.blinkUntil) return "closed";
    if (this.mind.stats.mood > 0.8 && chance(0.002)) return "wink";
    return this.act === "watch" || this.act === "chase" ? "wide" : "open";
  }

  private mouthFor(): Mouth {
    if (this.act === "cheer" || this.act === "eat") return "open";
    if (this.act === "sulk") return "frown";
    if (this.mind.stats.mood > 0.62) return "smile";
    return this.mind.stats.mood < 0.3 ? "frown" : "flat";
  }

  // ------------------------------------------------------------- reactions

  onCursorMoved(): void {
    // Being near her counts as attention.
    const size = this.size;
    const cx = this.x + size.w / 2;
    const cy = this.y + size.h / 2;
    const near = Math.hypot(this.cursor.x - cx, this.cursor.y - cy) < 90;
    if (!near) return;
    this.mind.stats.attention = Math.max(0, this.mind.stats.attention - 0.0015);
    if (this.act === "sleep" && chance(0.02)) this.wake();
  }

  setZoom(zoom: number): void {
    const before = this.size;
    this.cat.setZoom(zoom);
    const after = this.size;
    this.x -= (after.w - before.w) / 2;
    this.land();
  }

  cleanup(): void {
    this.snack?.el.remove();
    this.laser.stop();
  }
}
