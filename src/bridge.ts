/**
 * Everything that crosses into Rust. Kept in one file so the rest of the app
 * is plain DOM code that also runs in a browser tab during development.
 */

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export interface ScreenBounds {
  x: number;
  y: number;
  w: number;
  h: number;
  scale: number;
}

export interface MonitorRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Boot {
  state: unknown;
  screen: ScreenBounds;
  monitors: MonitorRect[];
  version: string;
  platform: string;
  dataDir: string;
  cliPath: string | null;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const IN_TAURI = "__TAURI_INTERNALS__" in window;

const noop = async (): Promise<void> => {};

async function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T | null> {
  if (!IN_TAURI) return null;
  try {
    return await invoke<T>(cmd, args);
  } catch (err) {
    console.warn(`luna: ${cmd} failed`, err);
    return null;
  }
}

export async function bootstrap(): Promise<Boot> {
  const boot = await call<Boot>("bootstrap");
  if (boot) return boot;
  // Browser fallback so `vite dev` shows a cat on a blank page.
  const w = window.innerWidth;
  const h = window.innerHeight;
  return {
    state: null,
    screen: { x: 0, y: 0, w, h, scale: 1 },
    monitors: [{ x: 0, y: 0, w, h }],
    version: "dev",
    platform: "browser",
    dataDir: "",
    cliPath: null,
  };
}

export const persist = (value: unknown): Promise<void> =>
  call("persist", { value }).then(noop, noop);

export const diary = (entry: unknown): Promise<void> => call("diary", { entry }).then(noop, noop);

export const setHitRects = (rects: Rect[]): Promise<void> =>
  call("set_hit_rects", { rects }).then(noop, noop);

export const setPointerLock = (locked: boolean): Promise<void> =>
  call("set_pointer_lock", { locked }).then(noop, noop);

export const setGhost = (on: boolean): Promise<void> => call("set_ghost", { on }).then(noop, noop);

export const setAutostart = (on: boolean): Promise<boolean> =>
  call<boolean>("set_autostart", { on }).then((v) => v ?? false);

export const refit = (): Promise<{ screen: ScreenBounds; monitors: MonitorRect[] } | null> =>
  call<{ screen: ScreenBounds; monitors: MonitorRect[] }>("refit");

export const quitApp = (): Promise<void> => call("quit").then(noop, noop);

// ------------------------------------------------------------------- events

type Unlisten = () => void;

async function on<T>(event: string, handler: (payload: T) => void): Promise<Unlisten> {
  if (!IN_TAURI) return () => {};
  return listen<T>(event, (e) => handler(e.payload));
}

export interface CursorEvent {
  x: number;
  y: number;
}

export interface PresenceEvent {
  fullscreen: boolean;
  idle_ms: number;
}

/** Anything the `luna` CLI sends. */
export type CliMessage =
  | { type: "build"; phase: "start"; label: string }
  | { type: "build"; phase: "ok" | "fail"; label: string; ms: number; code: number; tail: string }
  | { type: "say"; text: string }
  | { type: "ghost"; on: boolean | null }
  | { type: "summon" }
  | { type: "sleep" };

export const onCursor = (fn: (e: CursorEvent) => void): Promise<Unlisten> =>
  on<CursorEvent>("luna://cursor", fn);

export const onPresence = (fn: (e: PresenceEvent) => void): Promise<Unlisten> =>
  on<PresenceEvent>("luna://presence", fn);

export const onCli = (fn: (m: CliMessage) => void): Promise<Unlisten> =>
  on<CliMessage>("luna://msg", fn);

export const onTray = (fn: (action: string) => void): Promise<Unlisten> =>
  on<string>("luna://tray", fn);
