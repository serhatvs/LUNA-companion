import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";

/**
 * Thin bridge to the Tauri desktop shell. Every function is a safe no-op
 * when the app is running as a plain web preview (the sandbox) — nothing
 * here touches the DOM or throws in a browser.
 */

export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
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
