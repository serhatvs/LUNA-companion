/**
 * Wiring: boot Luna, hand her the mouse, the CLI and the tray, then get out of
 * the way. One requestAnimationFrame loop drives everything.
 */

import "./style.css";
import * as bridge from "./bridge";
import { CatRenderer, type FurName } from "./sprite";
import { Mind } from "./mind";
import { Bubble, Laser, Panel, Timer } from "./ui";
import { Luna, type World } from "./pet";
import { line } from "./chatter";

const root = document.getElementById("luna") as HTMLDivElement;
const canvas = document.getElementById("cat") as HTMLCanvasElement;

async function start(): Promise<void> {
  const boot = await bridge.bootstrap();

  const mind = new Mind();
  mind.load(boot.state);

  const worldFrom = (
    screen: bridge.ScreenBounds,
    monitors: bridge.MonitorRect[],
  ): World => {
    const scale = window.devicePixelRatio || screen.scale || 1;
    return {
      w: screen.w / scale,
      h: screen.h / scale,
      ox: screen.x,
      oy: screen.y,
      scale,
      monitors: monitors.map((m) => ({
        x: (m.x - screen.x) / scale,
        y: (m.y - screen.y) / scale,
        w: m.w / scale,
        h: m.h / scale,
      })),
    };
  };

  let world = worldFrom(boot.screen, boot.monitors);

  const bubble = new Bubble();
  const timer = new Timer();
  const panel = new Panel();
  const laser = new Laser();
  const cat = new CatRenderer(canvas);
  await cat.load();
  const luna = new Luna(
    root,
    cat,
    mind,
    bubble,
    timer,
    panel,
    laser,
    world,
  );

  // --------------------------------------------------------------- ghosting

  const applyGhost = (): void => {
    const on = mind.settings.ghost || luna.ghostForced;
    root.classList.toggle("ghost", on);
    void bridge.setGhost(mind.settings.ghost);
  };
  applyGhost();

  // ---------------------------------------------------------------- pointer

  let dragging = false;
  let grabbed = { dx: 0, dy: 0 };
  let downAt = 0;
  let downPos = { x: 0, y: 0 };
  let moved = 0;
  let lastMove = performance.now();

  // Stroking: sweeping the cursor back and forth over her, without pressing.
  let strokeDir = 0;
  let strokes = 0;
  let lastStroke = 0;
  let lastX = 0;

  root.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    root.setPointerCapture(e.pointerId);
    dragging = true;
    downAt = performance.now();
    downPos = { x: e.clientX, y: e.clientY };
    moved = 0;
    grabbed = luna.grab(e.clientX, e.clientY);
    root.classList.add("dragging");
    panel.close();
    e.preventDefault();
  });

  root.addEventListener("pointermove", (e) => {
    const t = performance.now();
    if (dragging) {
      moved = Math.max(moved, Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y));
      luna.dragTo(e.clientX - grabbed.dx, e.clientY - grabbed.dy, t - lastMove);
      lastMove = t;
      return;
    }
    // Hover strokes.
    const dir = Math.sign(e.clientX - lastX);
    lastX = e.clientX;
    if (dir !== 0 && dir !== strokeDir) {
      strokeDir = dir;
      strokes += 1;
      if (strokes >= 2 && t - lastStroke > 420) {
        strokes = 0;
        lastStroke = t;
        luna.pet();
      }
    }
  });

  const endDrag = (e: PointerEvent): void => {
    if (!dragging) return;
    dragging = false;
    root.classList.remove("dragging");
    root.releasePointerCapture?.(e.pointerId);
    const held = performance.now() - downAt;
    if (moved < 5 && held < 350) {
      // A tap is a pat, not a throw.
      luna.dragTo(luna.x, luna.y, 0);
      luna.release();
      luna.pet();
    } else {
      luna.release();
    }
  };

  root.addEventListener("pointerup", endDrag);
  root.addEventListener("pointercancel", endDrag);

  root.addEventListener("dblclick", (e) => {
    e.preventDefault();
    luna.playLaser();
  });

  const openPanel = (e: MouseEvent): void => {
    e.preventDefault();
    panel.toggle(hooks(), e.clientX, e.clientY, world);
  };
  root.addEventListener("contextmenu", openPanel);

  // ------------------------------------------------------------------ panel

  const hooks = () => ({
    settings: mind.settings,
    stats: mind.stats,
    version: boot.version,
    cliPath: boot.cliPath,
    onFur: (fur: FurName) => {
      mind.settings.fur = fur;
      mind.save(true);
    },
    onZoom: (zoom: number) => {
      mind.settings.zoom = zoom;
      luna.setZoom(zoom);
      mind.save(true);
    },
    onSpeed: (speed: number) => {
      mind.settings.speed = speed;
      mind.save(true);
    },
    onChatty: (value: "quiet" | "normal" | "chatty") => {
      mind.settings.chatty = value;
      mind.save(true);
    },
    onToggle: (key: "ghost" | "autoGhost" | "autostart" | "quiet", on: boolean) => {
      if (key === "quiet") mind.settings.quietHours.on = on;
      else if (key === "autostart") {
        mind.settings.autostart = on;
        void bridge.setAutostart(on).then((actual) => {
          mind.settings.autostart = actual;
          mind.save(true);
        });
      } else if (key === "ghost") mind.settings.ghost = on;
      else mind.settings.autoGhost = on;
      applyGhost();
      mind.save(true);
    },
    onAction: (action: "snack" | "play" | "nap" | "quit") => {
      panel.close();
      if (action === "snack") luna.offerSnack();
      else if (action === "play") luna.playLaser();
      else if (action === "nap") luna.goSleep();
      else {
        mind.save(true);
        window.setTimeout(() => void bridge.quitApp(), 120);
      }
    },
  });

  // ----------------------------------------------------------------- events

  void bridge.onCursor((e) => {
    luna.cursor.x = (e.x - world.ox) / world.scale;
    luna.cursor.y = (e.y - world.oy) / world.scale;
    luna.cursor.seen = Date.now();
    luna.onCursorMoved();
  });

  void bridge.onPresence((e) => {
    if (mind.settings.autoGhost && e.fullscreen !== luna.ghostForced) {
      luna.ghostForced = e.fullscreen;
      applyGhost();
    }
    // Five quiet minutes and she takes the hint.
    if (e.idle_ms > 300_000) luna.goSleep();
    else if (e.idle_ms < 2_000) luna.wake();
  });

  void bridge.onCli((msg) => {
    switch (msg.type) {
      case "build":
        if (msg.phase === "start") luna.buildStarted(msg.label);
        else luna.buildFinished(msg.phase === "ok", msg.ms, msg.label, msg.tail);
        break;
      case "say":
        luna.wake(false);
        luna.speak(msg.text, "", 5000);
        break;
      case "ghost":
        mind.settings.ghost = msg.on === null ? !mind.settings.ghost : msg.on;
        applyGhost();
        mind.save(true);
        break;
      case "summon":
        luna.summon();
        break;
      case "sleep":
        luna.goSleep();
        break;
    }
  });

  void bridge.onTray((action) => {
    switch (action) {
      case "summon":
        luna.summon();
        break;
      case "sleep":
        luna.goSleep();
        break;
      case "ghost":
        mind.settings.ghost = !mind.settings.ghost;
        applyGhost();
        mind.save(true);
        break;
      case "settings":
        panel.toggle(hooks(), luna.x + 40, luna.y, world);
        break;
      case "about":
        luna.speak(`i'm Luna ${boot.version} ♥ level ${mind.stats.level}`, "", 5000);
        break;
      case "quit":
        mind.save(true);
        break;
    }
  });

  // Monitors come and go; so does DPI.
  const refit = async (): Promise<void> => {
    const next = await bridge.refit();
    if (next) {
      world = worldFrom(next.screen, next.monitors);
    } else {
      world = worldFrom({ x: 0, y: 0, w: window.innerWidth, h: window.innerHeight, scale: 1 }, [
        { x: 0, y: 0, w: window.innerWidth, h: window.innerHeight },
      ]);
    }
    luna.setWorld(world);
  };
  window.addEventListener("resize", () => void refit());

  window.addEventListener("beforeunload", () => {
    mind.save(true);
    luna.cleanup();
  });

  // ------------------------------------------------------------------- loop

  let last = performance.now();
  const frame = (t: number): void => {
    const dt = t - last;
    last = t;
    luna.update(dt);
    luna.render();
    mind.save();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  // Say hello, but only once she has settled.
  window.setTimeout(() => luna.speak(line("greet")), 900);
}

void start();
