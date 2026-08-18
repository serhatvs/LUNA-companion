import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";

import { Luna, type LunaPose } from "@/components/luna/Luna";
import { useLunaSounds } from "@/components/luna/useLunaSounds";
import {
  closeWindow,
  getWindowPos,
  isTauri,
  moveWindow,
  onGhostToggle,
  screenBox,
  setGhostMode,
} from "@/lib/desktop";

/**
 * Luna as a real screen pet (Shimeji-style): a tiny cat who lives on top of
 * everything. She wanders around the bottom of your screen, sits, sleeps,
 * and you can grab her with the mouse and throw her across the monitor.
 *
 * Desktop build: the window itself is just a bit bigger than the sprite and
 * moves around the screen (transparent, frameless, always-on-top) — that's
 * how she "walks over" your windows. Web preview: same behavior, but the pet
 * moves inside the page instead.
 */

const SPRITE = 108; // sprite render size (px)
const WIN_W = 150; // must match src-tauri/tauri.conf.json
const WIN_H = 180;
// Where the sprite sits inside the window (bottom-center).
const OFFSET_X = (WIN_W - SPRITE) / 2;
const OFFSET_Y = WIN_H - SPRITE - 6;

const GRAVITY = 950; // px/s² while flying
const WALK_SPEED = 36; // px/s
const DESK_FLOOR_MARGIN = 64; // stay above the taskbar
const WEB_FLOOR_MARGIN = 24;
const SOUND_KEY = "luna-sound";

const PAT_LINES = ["hehe ♥", "purr…", "that's nice", "meow!", "pet me ♥"];
const IDLE_LINES = ["purr…", "meow!", "hi ♥", "waiting with you", "pet me!"];
const FLY_LINES = ["wheee!", "!!", "mrrr!"];
const LAND_LINES = ["oomph!", "landed!"];
const WAKE_LINES = ["mrr?!", "what time is it?"];

interface Bounds {
  x: number;
  y: number;
  w: number;
  h: number;
  floor: number;
}

interface PetState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  pose: LunaPose;
  nextDecision: number; // performance.now() when she may pick a new behavior
  idleSince: number;
}

interface Grab {
  active: boolean;
  offsetX: number;
  offsetY: number;
  prevTargetX: number;
  prevTargetY: number;
  lastT: number;
  moved: number;
  samples: { x: number; y: number; t: number }[];
}

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function clamp(value: number, lo: number, hi: number) {
  return Math.min(Math.max(value, lo), Math.max(lo, hi));
}

const DEFAULT_BOUNDS: Bounds = { x: 0, y: 0, w: 0, h: 0, floor: 0 };

export default function Companion() {
  const desktop = isTauri();
  const [soundOn, setSoundOn] = useState(
    () => localStorage.getItem(SOUND_KEY) !== "off",
  );
  const sounds = useLunaSounds(soundOn);
  const soundsRef = useRef(sounds);
  soundsRef.current = sounds;

  // ---- render state (mirrored from the refs the animation loop mutates) ----
  const [petPos, setPetPos] = useState(() => ({
    x: 24,
    y: (typeof window === "undefined" ? 400 : window.innerHeight) - SPRITE - 24,
  }));
  const [pose, setPose] = useState<LunaPose>("idle");
  const [facing, setFacing] = useState<1 | -1>(1);
  const [bubble, setBubble] = useState<{ id: number; text: string } | null>(
    null,
  );
  const [dust, setDust] = useState(0);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [ghost, setGhost] = useState(false);

  // ---- mutable state (the animation loop owns these) ----
  const petRef = useRef<PetState>({
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    facing: 1,
    pose: "idle",
    nextDecision: 0,
    idleSince: 0,
  });
  const grabRef = useRef<Grab | null>(null);
  const boundsRef = useRef<Bounds>(DEFAULT_BOUNDS);
  const winPosRef = useRef({ x: 0, y: 0 });
  const lastMoveMs = useRef(0);
  const renderPos = useRef({ x: -1, y: -1 });

  const say = useCallback((text: string) => {
    setBubble({ id: Date.now() + Math.random(), text });
  }, []);

  useEffect(() => {
    localStorage.setItem(SOUND_KEY, soundOn ? "on" : "off");
  }, [soundOn]);

  // Bubbles fade on their own.
  useEffect(() => {
    if (!bubble) return;
    const id = window.setTimeout(() => setBubble(null), 2000);
    return () => window.clearTimeout(id);
  }, [bubble]);

  // ---- positioning + behaviors ----

  const decide = useCallback(
    (p: PetState, now: number) => {
      const r = Math.random();
      if (p.pose === "walk") {
        if (r < 0.4) {
          p.pose = "idle";
          p.nextDecision = now + 2000 + Math.random() * 3000;
          if (Math.random() < 0.3) {
            say(pick(IDLE_LINES));
            soundsRef.current.purr();
          }
        } else if (r < 0.55) {
          p.pose = "sit";
          p.nextDecision = now + 4000 + Math.random() * 5000;
        } else {
          p.nextDecision = now + 2500 + Math.random() * 3500;
          if (Math.random() < 0.35) p.facing = (p.facing * -1) as 1 | -1;
        }
      } else {
        p.pose = "walk";
        p.nextDecision = now + 2500 + Math.random() * 3500;
        if (Math.random() < 0.25) p.facing = (p.facing * -1) as 1 | -1;
      }
    },
    [say],
  );

  const applyMove = useCallback((now: number) => {
    const p = petRef.current;
    if (desktop) {
      // The window carries her; move it at ~30fps.
      if (now - lastMoveMs.current > 33) {
        lastMoveMs.current = now;
        const wx = Math.round(p.x - OFFSET_X);
        const wy = Math.round(p.y - OFFSET_Y);
        winPosRef.current = { x: wx, y: wy };
        void moveWindow(wx, wy);
      }
    }
    if (
      Math.abs(p.x - renderPos.current.x) > 0.4 ||
      Math.abs(p.y - renderPos.current.y) > 0.4
    ) {
      renderPos.current = { x: p.x, y: p.y };
      setPetPos({ x: p.x, y: p.y });
    }
    setPose((prev) => (prev === p.pose ? prev : p.pose));
    setFacing((prev) => (prev === p.facing ? prev : p.facing));
  }, [desktop]);

  const wake = useCallback(() => {
    const p = petRef.current;
    if (p.pose !== "sleep") return;
    const now = performance.now();
    p.pose = "idle";
    p.idleSince = now;
    p.nextDecision = now + 2000 + Math.random() * 2500;
    say(pick(WAKE_LINES));
    soundsRef.current.meow();
  }, [say]);

  const pat = useCallback(() => {
    const p = petRef.current;
    const now = performance.now();
    p.idleSince = now;
    p.pose = "happy";
    p.nextDecision = now + 900 + Math.random() * 700;
    say(pick(PAT_LINES));
    soundsRef.current.meow();
  }, [say]);

  // Releasing a grab: a click without movement is a pat; a drag throws her.
  const release = useCallback(
    (now: number) => {
      const grab = grabRef.current;
      if (!grab?.active) return;
      grab.active = false;
      const p = petRef.current;

      let vx = 0;
      let vy = 0;
      if (grab.samples.length >= 2) {
        const a = grab.samples[grab.samples.length - 2];
        const b = grab.samples[grab.samples.length - 1];
        const dt = Math.max((b.t - a.t) / 1000, 0.001);
        vx = (b.x - a.x) / dt;
        vy = (b.y - a.y) / dt;
      }

      // A click without movement is a pat, not a grab.
      if (grab.moved < 6) {
        pat();
        return;
      }

      p.pose = "fly";
      p.vx = clamp(vx, -1500, 1500);
      p.vy = clamp(vy, -1700, 500);
      if (Math.abs(p.vx) + Math.abs(p.vy) < 120) p.vy = 80; // dropped in place
      p.facing = p.vx < 0 ? -1 : 1;
      say(pick(FLY_LINES));
      soundsRef.current.whee();
    },
    [pat, say],
  );

  const step = useCallback(
    (now: number, dt: number) => {
      const p = petRef.current;
      const grab = grabRef.current;
      const b = boundsRef.current;

      // Safety net: if the pointer escaped mid-grab (dragged to the edge of
      // the screen), drop her instead of leaving her stuck dangling. The
      // dangle pose is synced to React here too.
      if (grab?.active) {
        if (now - grab.lastT > 400) release(now);
        else applyMove(now);
        return;
      }

      // She dozes off after a couple of minutes without attention.
      if (
        p.pose !== "sleep" &&
        p.pose !== "fly" &&
        now - p.idleSince > 120_000
      ) {
        p.pose = "sleep";
        say("zzz…");
        return;
      }
      if (p.pose === "sleep") return;

      if (p.pose === "fly") {
        p.vy += GRAVITY * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.x < b.x) {
          p.x = b.x;
          p.vx = Math.abs(p.vx) * 0.6;
        }
        const right = b.x + b.w - SPRITE;
        if (p.x > right) {
          p.x = right;
          p.vx = -Math.abs(p.vx) * 0.6;
        }
        if (Math.abs(p.vx) > 5) p.facing = p.vx > 0 ? 1 : -1;
        const floor = b.floor;
        if (p.y + SPRITE >= floor) {
          p.y = floor - SPRITE;
          if (Math.abs(p.vy) > 240) {
            p.vy = -p.vy * 0.42;
            p.vx *= 0.72;
          } else {
            p.vy = 0;
            p.vx = 0;
            p.pose = "walk";
            p.nextDecision = now + 1500 + Math.random() * 1500;
            p.idleSince = now;
            setDust((k) => k + 1);
            soundsRef.current.thud();
            say(pick(LAND_LINES));
          }
        }
      } else if (p.pose === "walk") {
        p.x += p.facing * WALK_SPEED * dt;
        if (p.x <= b.x) {
          p.x = b.x;
          p.facing = 1;
        } else if (p.x + SPRITE >= b.x + b.w) {
          p.x = b.x + b.w - SPRITE;
          p.facing = -1;
        }
        if (now >= p.nextDecision) decide(p, now);
      } else if (now >= p.nextDecision) {
        decide(p, now);
      }

      applyMove(now);
    },
    [applyMove, decide, release, say],
  );

  // The one animation loop that drives everything.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      step(now, dt);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [step]);

  // ---- boot: adopt the screen + her starting spot ----
  useEffect(() => {
    let disposed = false;
    const timers: number[] = [];
    const later = (fn: () => void, ms: number) => {
      timers.push(window.setTimeout(fn, ms));
    };

    const init = async () => {
      const p = petRef.current;
      if (desktop) {
        let bx = 0;
        let by = 0;
        let bw = 1920;
        let bh = 1080;
        const box = await screenBox();
        if (disposed) return;
        if (box) {
          bx = box.x;
          by = box.y;
          bw = box.w;
          bh = box.h;
        }
        const pos = await getWindowPos();
        if (disposed) return;
        if (pos) {
          p.x = pos.x + OFFSET_X;
          p.y = pos.y + OFFSET_Y;
        } else {
          p.x = bx + (bw - SPRITE) / 2;
          p.y = by + bh - SPRITE - DESK_FLOOR_MARGIN;
        }
        boundsRef.current = {
          x: bx,
          y: by,
          w: bw,
          h: bh,
          floor: by + bh - SPRITE - DESK_FLOOR_MARGIN,
        };
      } else {
        const bw = window.innerWidth;
        const bh = window.innerHeight;
        boundsRef.current = {
          x: 0,
          y: 0,
          w: bw,
          h: bh,
          floor: bh - SPRITE - WEB_FLOOR_MARGIN,
        };
        p.x = 24;
        p.y = boundsRef.current.floor;
      }
      p.y = Math.min(p.y, boundsRef.current.floor);
      p.idleSince = performance.now();
      p.nextDecision = performance.now() + 2600;
      setPetPos({ x: p.x, y: p.y });
      later(() => say("meow! i'm luna ♥"), 900);
      later(() => say("pet me ♥"), 4200);
      later(() => soundsRef.current.meow(), 900);
    };
    void init();

    return () => {
      disposed = true;
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [desktop, say]);

  // Re-clamp the walkable area if the browser viewport resizes (web preview).
  useEffect(() => {
    if (desktop) return;
    const onResize = () => {
      boundsRef.current = {
        x: 0,
        y: 0,
        w: window.innerWidth,
        h: window.innerHeight,
        floor: window.innerHeight - SPRITE - WEB_FLOOR_MARGIN,
      };
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [desktop]);

  // Keep the ghost indicator in sync with the Ctrl+Alt+L shortcut.
  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void onGhostToggle((value) => {
      if (disposed) return;
      setGhost(value);
      say(value ? "see you later ♥" : "back! ♥");
      if (!value) soundsRef.current.meow();
    }).then((fn) => {
      unlisten = fn;
    });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [say]);

  // ---- pointer interactions ----

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      const target = e.currentTarget as HTMLElement;
      try {
        target.setPointerCapture(e.pointerId);
      } catch {
        // Capture can fail on some platforms — grabbing still works via the
        // safety-net release in the loop.
      }
      e.preventDefault();
      setMenu(null);
      const now = performance.now();
      const p = petRef.current;
      if (p.pose === "sleep") wake();
      const winX = desktop ? winPosRef.current.x : 0;
      const winY = desktop ? winPosRef.current.y : 0;
      grabRef.current = {
        active: true,
        offsetX: e.clientX,
        offsetY: e.clientY,
        prevTargetX: winX,
        prevTargetY: winY,
        lastT: now,
        moved: 0,
        samples: [],
      };
      p.pose = "dangle";
      p.vx = 0;
      p.vy = 0;
      p.idleSince = now;
      soundsRef.current.squeak();
    },
    [desktop, wake],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const grab = grabRef.current;
      const p = petRef.current;
      const now = performance.now();

      if (grab?.active) {
        const winX = desktop ? winPosRef.current.x : 0;
        const winY = desktop ? winPosRef.current.y : 0;
        const targetX = winX + e.clientX - grab.offsetX;
        const targetY = winY + e.clientY - grab.offsetY;
        const dx = targetX - grab.prevTargetX;
        const dy = targetY - grab.prevTargetY;
        grab.prevTargetX = targetX;
        grab.prevTargetY = targetY;
        grab.lastT = now;
        grab.moved += Math.abs(dx) + Math.abs(dy);
        if (desktop) {
          winPosRef.current = { x: targetX, y: targetY };
          void moveWindow(targetX, targetY);
          p.x = targetX + OFFSET_X;
          p.y = targetY + OFFSET_Y;
        } else {
          const b = boundsRef.current;
          p.x = clamp(targetX, b.x, b.x + b.w - SPRITE);
          p.y = clamp(targetY, b.y, b.floor - SPRITE);
        }
        grab.samples.push({ x: p.x, y: p.y, t: now });
        if (grab.samples.length > 4) grab.samples.shift();
        setPetPos({ x: p.x, y: p.y });
        return;
      }

      // Hover: look toward the cursor.
      if (p.pose === "idle" || p.pose === "sit" || p.pose === "walk") {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const cx = e.clientX - rect.left;
        const targetFacing: 1 | -1 = cx < rect.width / 2 ? -1 : 1;
        if (targetFacing !== p.facing) p.facing = targetFacing;
      }
    },
    [desktop],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      release(performance.now());
    },
    [release],
  );

  const onContextMenu = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY });
  }, []);

  // ---- render ----

  const altitude = Math.max(0, boundsRef.current.floor - (petPos.y + SPRITE));
  const shadowScale = 1 - Math.min(altitude / 400, 0.5);
  const shadowOpacity = 1 - Math.min(altitude / 350, 0.55);

  const spriteWrap = (
    <div
      className={ghost ? "opacity-70" : undefined}
      style={{ width: SPRITE, height: SPRITE }}
    >
      <div
        className={pose === "fly" ? "luna-spin" : pose === "dangle" ? "luna-sway" : undefined}
        style={{ width: SPRITE, height: SPRITE }}
      >
        <Luna pose={pose} facing={facing} className="h-full w-full" />
      </div>
    </div>
  );

  const bubbleEl = (
    <div
      className="pointer-events-none absolute z-20 flex justify-center"
      style={{ left: 0, right: 0, bottom: SPRITE + 10 }}
    >
      <AnimatePresence>
        {bubble && (
          <motion.div
            key={bubble.id}
            initial={{ opacity: 0, y: 4, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="max-w-[132px] rounded-xl border bg-card/95 px-2.5 py-1 text-center text-[11px] font-semibold text-card-foreground shadow-md"
          >
            {bubble.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  const zzzEl = (
    <div
      className="pointer-events-none absolute z-10"
      style={{ right: 8, top: 2 }}
    >
      <span className="luna-zzz block text-[13px] font-black text-primary/80">z</span>
      <span
        className="luna-zzz block text-[13px] font-black text-primary/80"
        style={{ animationDelay: "0.55s" }}
      >
        z
      </span>
      <span
        className="luna-zzz block text-[13px] font-black text-primary/80"
        style={{ animationDelay: "1.1s" }}
      >
        z
      </span>
    </div>
  );

  const menuEl = menu && (
    <div
      className="absolute z-50"
      style={{ left: menu.x, top: menu.y }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="w-44 rounded-xl border bg-popover p-1 shadow-xl">
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-popover-foreground hover:bg-accent"
          onClick={() => {
            void setGhostMode(!ghost);
            setMenu(null);
          }}
        >
          <span>{ghost ? "Release from ghost mode" : "Ghost mode (click-through)"}</span>
        </button>
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-popover-foreground hover:bg-accent"
          onClick={() => {
            setSoundOn((v) => !v);
            setMenu(null);
          }}
        >
          <span>{soundOn ? "Mute Luna" : "Unmute Luna"}</span>
        </button>
        <div className="my-1 h-px bg-border/60" />
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-destructive hover:bg-destructive/10"
          onClick={() => void closeWindow()}
        >
          <span>Close Luna</span>
        </button>
      </div>
    </div>
  );

  const shadowEl = (
    <div
      className="pointer-events-none absolute rounded-[50%]"
      style={{
        left: (SPRITE - 76) / 2,
        bottom: -7,
        width: 76,
        height: 12,
        background:
          "radial-gradient(ellipse, rgba(0,0,0,0.30), rgba(0,0,0,0.12) 55%, transparent 75%)",
        transform: `scaleX(${shadowScale})`,
        opacity: shadowOpacity,
      }}
    />
  );

  const dustEl =
    dust > 0 ? (
      <span
        key={dust}
        className="luna-dust pointer-events-none absolute z-10 rounded-full"
        style={{ left: SPRITE / 2 - 16, bottom: -4, width: 32, height: 14 }}
      />
    ) : null;

  if (desktop) {
    // The pet window: sprite pinned bottom-center, window moves around the
    // screen. The whole window is "her" for grabbing (it's barely bigger).
    return (
      <div
        className="absolute inset-0 select-none overflow-visible"
        style={{ touchAction: "none" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => release(performance.now())}
        onContextMenu={onContextMenu}
        onClick={() => setMenu(null)}
      >
        <div className="absolute" style={{ left: OFFSET_X, bottom: 6 }}>
          {shadowEl}
          {dustEl}
          {bubbleEl}
          {pose === "sleep" && zzzEl}
          {spriteWrap}
        </div>
        {menuEl}
      </div>
    );
  }

  // Web preview: a little desktop stand-in so the sandbox shows the pet
  // wandering around. On the real desktop, this page is the pet window.
  return (
    <div className="luna-web fixed inset-0 select-none overflow-hidden">
      <div className="luna-web-bg absolute inset-0" />
      <div
        className="absolute z-10 rounded-full border bg-card/80 px-3 py-1.5 text-[11px] font-medium text-muted-foreground shadow-sm backdrop-blur"
        style={{ right: 14, bottom: 12 }}
      >
        Luna — desktop pet · grab her and throw her
      </div>
      <div
        className="absolute"
        style={{
          left: 0,
          top: 0,
          transform: `translate3d(${petPos.x}px, ${petPos.y}px, 0)`,
          touchAction: "none",
          cursor: pose === "dangle" || pose === "fly" ? "grabbing" : "grab",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => release(performance.now())}
        onContextMenu={onContextMenu}
        onClick={() => setMenu(null)}
      >
        {shadowEl}
        {dustEl}
        {bubbleEl}
        {pose === "sleep" && zzzEl}
        {spriteWrap}
      </div>
      {menuEl}
    </div>
  );
}
