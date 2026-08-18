import { Ghost, Heart, Volume2, VolumeX, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Luna } from "@/components/luna/Luna";
import { LunaRoom, type Mood } from "@/components/luna/LunaRoom";
import { Button } from "@/components/ui/button";
import { closeWindow, isTauri, onGhostToggle, setGhostMode } from "@/lib/desktop";
import { cn } from "@/lib/utils";

const HEARTS_KEY = "luna-hearts-v1";
const SOUND_KEY = "luna-sound";

/**
 * Affection is stored per machine (localStorage) and gently fades while
 * Luna is away — come back and she misses you a little.
 */
function loadHearts(): number {
  try {
    const raw = localStorage.getItem(HEARTS_KEY);
    if (!raw) return 0;
    const parsed = JSON.parse(raw) as { hearts: number; lastSeen: number };
    const elapsedMinutes = (Date.now() - parsed.lastSeen) / 60_000;
    const decayed = parsed.hearts - Math.floor(elapsedMinutes / 12);
    return Math.max(0, Math.min(3, decayed));
  } catch {
    return 0;
  }
}

/**
 * The whole app — one floating pet. As a desktop app this is a small,
 * frameless, transparent, always-on-top window docked at the bottom of the
 * screen: drag it around by the title bar or footer, toggle ghost mode
 * (click-through) with the ghost button or Ctrl+Alt+L, and quit with the ×.
 * In the browser it's the same card, full-page.
 */
export default function Companion() {
  const desktop = isTauri();
  const [mood, setMood] = useState<Mood>("idle");
  const [hearts, setHearts] = useState(loadHearts);
  const [soundOn, setSoundOn] = useState(
    () => localStorage.getItem(SOUND_KEY) !== "off",
  );
  const [ghost, setGhost] = useState(false);

  useEffect(() => {
    localStorage.setItem(
      HEARTS_KEY,
      JSON.stringify({ hearts, lastSeen: Date.now() }),
    );
  }, [hearts]);

  useEffect(() => {
    localStorage.setItem(SOUND_KEY, soundOn ? "on" : "off");
  }, [soundOn]);

  // Keep the ghost-mode indicator in sync when the Ctrl+Alt+L shortcut
  // toggles it from Rust.
  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void onGhostToggle((value) => {
      if (!disposed) setGhost(value);
    }).then((fn) => {
      unlisten = fn;
    });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  const addHeart = (amount: number) =>
    setHearts((value) => Math.max(0, Math.min(3, value + amount)));

  const status = ghost
    ? "ghost mode · Ctrl+Alt+L"
    : mood === "sleeping"
      ? "dozing…"
      : mood === "eating"
        ? "snack time"
        : mood === "fetching"
          ? "fetching!"
          : "awake · always nearby";

  const lunaMood =
    mood === "sleeping" ? "sleeping" : mood === "eating" ? "eating" : "idle";

  return (
    <div
      className={cn(
        "flex h-dvh flex-col overflow-hidden",
        desktop ? "p-2" : "bg-background",
      )}
    >
      {/* The pet card — everything visible lives here; around it the desktop shows */}
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col overflow-hidden",
          desktop && "rounded-3xl border bg-background shadow-2xl",
        )}
      >
        {/* Slim header — doubles as the drag handle (no native title bar) */}
        <header className="flex shrink-0 items-center justify-between gap-3 border-b bg-background/70 px-3 py-2 backdrop-blur">
          <div
            data-tauri-drag-region
            className="flex min-w-0 flex-1 items-center gap-2.5"
            title="Drag to move Luna"
          >
            <Luna className="size-8 shrink-0" mood={lunaMood} />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold tracking-tight">
                Code Companion<span className="text-primary">-luna</span>
              </p>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    mood === "sleeping"
                      ? "bg-muted-foreground/50"
                      : "bg-emerald-500",
                  )}
                />
                {status}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <div
              className="flex items-center gap-0.5 pr-1"
              aria-label={`${hearts} of 3 affection hearts`}
              title={
                hearts === 3
                  ? "Luna loves you"
                  : "Pet, feed, or play to win her heart"
              }
            >
              {[0, 1, 2].map((index) => (
                <Heart
                  key={index}
                  className={cn(
                    "size-3.5 transition-all",
                    index < hearts
                      ? "fill-pink-400 text-pink-400"
                      : "text-muted-foreground/40",
                  )}
                />
              ))}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => setSoundOn((value) => !value)}
              aria-label={soundOn ? "Mute Luna" : "Unmute Luna"}
              title={soundOn ? "Mute Luna" : "Unmute Luna"}
              className="shrink-0 cursor-pointer text-muted-foreground hover:text-foreground"
            >
              {soundOn ? (
                <Volume2 className="size-4" />
              ) : (
                <VolumeX className="size-4" />
              )}
            </Button>
            {desktop && (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => void setGhostMode(!ghost)}
                  aria-label={
                    ghost ? "Exit ghost mode (click-through)" : "Ghost mode"
                  }
                  title={
                    ghost
                      ? "Ghost mode is on — clicks pass through. Ctrl+Alt+L to release."
                      : "Ghost mode — Luna floats without catching clicks"
                  }
                  className={cn(
                    "shrink-0 cursor-pointer text-muted-foreground hover:text-foreground",
                    ghost && "bg-accent text-accent-foreground",
                  )}
                >
                  <Ghost className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => void closeWindow()}
                  aria-label="Close Luna"
                  title="Close Luna"
                  className="shrink-0 cursor-pointer text-muted-foreground hover:text-destructive"
                >
                  <X className="size-4" />
                </Button>
              </>
            )}
          </div>
        </header>

        <LunaRoom
          mood={mood}
          soundOn={soundOn}
          onMoodChange={setMood}
          onInteract={() => addHeart(1)}
        />

        {/* Slim footer — also a drag handle */}
        <footer
          data-tauri-drag-region
          className="shrink-0 border-t bg-background/70 px-4 py-2 text-center text-[11px] text-muted-foreground backdrop-blur"
          title="Drag to move Luna"
        >
          Pet Luna · drag the yarn for fetch · tap the bowl to feed her
        </footer>
      </div>
    </div>
  );
}
