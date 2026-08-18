import {
  currentMonitor,
  getCurrentWindow,
  LogicalPosition,
} from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";

/**
 * Thin bridge to the Tauri desktop shell. Every function is a safe no-op
 * when the app is running as a plain web preview (the sandbox) — nothing
 * here touches the DOM or throws in a browser.
 */

export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/** Logical (CSS-pixel) screen bounds of the monitor the pet window is on. */
export interface ScreenBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * The pet window's current position, in logical pixels. Returns null in the
 * browser (the pet is positioned with CSS there instead).
 */
export async function getWindowPos(): Promise<{ x: number; y: number } | null> {
  if (!isTauri()) return null;
  try {
    const pos = await getCurrentWindow().outerPosition();
    return { x: pos.x, y: pos.y };
  } catch {
    return null;
  }
}

/** The monitor the window sits on, as a logical screen rectangle. */
export async function screenBox(): Promise<ScreenBox | null> {
  if (!isTauri()) return null;
  try {
    const monitor = await currentMonitor();
    if (!monitor) return null;
    const size = monitor.size.toLogical(monitor.scaleFactor);
    const pos = monitor.position.toLogical(monitor.scaleFactor);
    return { x: pos.x, y: pos.y, w: size.width, h: size.height };
  } catch {
    return null;
  }
}

/** Move the pet window (logical pixels). Best-effort, safe to spam. */
export async function moveWindow(x: number, y: number): Promise<void> {
  if (!isTauri()) return;
  try {
    await getCurrentWindow().setPosition(new LogicalPosition(x, y));
  } catch {
    // Ignore — the OS may briefly refuse while dragging, it self-corrects.
  }
}

/**
 * Ghost mode: the window ignores cursor events, so Luna floats over your
 * editor without eating clicks. The Rust side keeps the single source of
 * truth so the Ctrl+Alt+L shortcut and the UI button can't disagree.
 */
export async function setGhostMode(ghost: boolean): Promise<void> {
  if (!isTauri()) return;
  try {
    await invoke("set_ghost", { ghost });
  } catch {
    // Not supported on this platform — stay interactive.
  }
}

/** Close the pet window (there's no native title bar to do it). */
export async function closeWindow(): Promise<void> {
  if (!isTauri()) return;
  try {
    await getCurrentWindow().close();
  } catch {
    // Ignore — closing is best-effort.
  }
}

/** Subscribe to ghost-mode changes from the Ctrl+Alt+L shortcut. */
export async function onGhostToggle(
  callback: (ghost: boolean) => void,
): Promise<() => void> {
  if (!isTauri()) return () => {};
  const unlisten = await getCurrentWindow().listen<boolean>(
    "luna-ghost-toggle",
    (event) => callback(event.payload),
  );
  return unlisten;
}
