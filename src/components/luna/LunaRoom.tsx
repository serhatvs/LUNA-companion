import { AnimatePresence, motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Luna } from "./Luna";
import { useLunaSounds } from "./useLunaSounds";

export type Mood = "idle" | "sleeping" | "eating" | "fetching";

const CAT = 96; // Luna's sprite size in px
const BALL = 40; // yarn ball size in px
const DESK_SHARE = 0.34; // how much of the room is the desk

const PAT_LINES = ["purr…", "that's nice", "meow!", "hi!", "keep it up!"];
const CATCH_LINES = ["got it!", "yarn!", "my favorite!", "one more?", "hehe!"];
const EAT_LINES = ["nom nom…", "yum!", "crunch crunch", "more please?"];
const IDLE_LINES = [
  "purr…",
  "meow!",
  "hi!",
  "waiting with you",
  "pet me!",
  "stretch…",
];
const WAKE_LINES = ["mrr?!", "what time is it?", "did I fall asleep?"];
const EMPTY_LINES = ["no kibble left…", "the bowl is empty"];

const STARS = [
  { left: "12%", top: "10%", size: 3, delay: 0 },
  { left: "28%", top: "6%", size: 2, delay: 0.8 },
  { left: "44%", top: "13%", size: 2.5, delay: 1.6 },
  { left: "64%", top: "7%", size: 2, delay: 0.4 },
  { left: "78%", top: "15%", size: 3, delay: 2.1 },
  { left: "88%", top: "30%", size: 2, delay: 1.2 },
  { left: "8%", top: "26%", size: 2, delay: 2.6 },
  { left: "55%", top: "22%", size: 2, delay: 0.2 },
];

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

interface LunaRoomProps {
  mood: Mood;
  soundOn: boolean;
  onMoodChange: (mood: Mood) => void;
  onInteract: (kind: "pat" | "feed" | "catch") => void;
}

/**
 * Luna's corner — the whole scene. A little desk under a moonlit sky where
 * Luna sits, purrs, plays fetch with a ball of yarn, eats from her bowl, and
 * dozes off when you stop paying attention.
 */
export function LunaRoom({ mood, soundOn, onMoodChange, onInteract }: LunaRoomProps) {
  const roomRef = useRef<HTMLDivElement>(null);
  const [room, setRoom] = useState({ w: 0, h: 0 });
  const [lunaX, setLunaX] = useState(0);
  const [ball, setBall] = useState<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [patKey, setPatKey] = useState(0);
  const [hopKey, setHopKey] = useState(0);
  const [bubble, setBubble] = useState<{ id: number; text: string } | null>(null);
  const [feedFull, setFeedFull] = useState(true);

  const lastInteract = useRef(Date.now());
  const sleepSince = useRef(0);
  const patLock = useRef(false);
  const interacted = useRef(false);
  const timers = useRef<number[]>([]);

  const sounds = useLunaSounds(soundOn);
  const { meow, purr, chirp, eat } = sounds;

  const later = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timers.current.push(id);
  }, []);

  // Clear every scheduled timer on unmount.
  useEffect(() => {
    const list = timers.current;
    return () => list.forEach((id) => window.clearTimeout(id));
  }, []);

  const measure = useCallback(() => {
    const rect = roomRef.current?.getBoundingClientRect();
    if (rect) setRoom({ w: rect.width, h: rect.height });
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  const spawnBall = useCallback(
    (r: { w: number; h: number }) => ({
      x: 12 + Math.random() * Math.max(r.w - BALL - 24, 1),
      y: r.h * DESK_SHARE + 10 + Math.random() * Math.max(r.h * 0.28 - BALL, 1),
    }),
    [],
  );

  // Once measured: seat Luna in the middle and drop a ball of yarn.
  useEffect(() => {
    if (room.w === 0 || room.h === 0) return;
    setLunaX((x) => (x === 0 ? (room.w - CAT) / 2 : x));
    setBall((b) => b ?? spawnBall(room));
  }, [room, spawnBall]);

  const sitBottom = Math.max(room.h * DESK_SHARE - 2, 0);
  const bowlLeft = Math.max(room.w - 24 - 56, 96);
  const bubbleLeft = clamp(lunaX + CAT / 2 - 74, 8, Math.max(room.w - 156, 8));
  const bubbleBottom = sitBottom + CAT + 16;

  const say = useCallback((text: string) => {
    setBubble({ id: Date.now(), text });
  }, []);

  // Speech bubbles fade on their own.
  useEffect(() => {
    if (!bubble) return;
    const id = window.setTimeout(() => setBubble(null), 2000);
    return () => window.clearTimeout(id);
  }, [bubble]);

  const interact = useCallback(
    (kind: "pat" | "feed" | "catch") => {
      lastInteract.current = Date.now();
      interacted.current = true;
      onInteract(kind);
    },
    [onInteract],
  );

  // Idle chatter — a soft line now and then while she's awake.
  useEffect(() => {
    const id = window.setInterval(() => {
      if (mood !== "idle" || room.w === 0) return;
      if (Math.random() < 0.3) {
        say(pick(IDLE_LINES));
        if (Math.random() < 0.4) purr();
      }
    }, 9000);
    return () => window.clearInterval(id);
  }, [mood, room.w, say, purr]);

  // She dozes off after a couple of minutes without attention, and wakes
  // herself up after a short nap.
  useEffect(() => {
    const id = window.setInterval(() => {
      if (mood === "idle" && Date.now() - lastInteract.current > 150_000) {
        sleepSince.current = Date.now();
        onMoodChange("sleeping");
      } else if (mood === "sleeping" && Date.now() - sleepSince.current > 45_000) {
        onMoodChange("idle");
        say(pick(WAKE_LINES));
      }
    }, 15_000);
    return () => window.clearInterval(id);
  }, [mood, onMoodChange, say]);

  // First-run hint so newcomers know she's alive.
  useEffect(() => {
    const id = window.setTimeout(() => {
      if (!interacted.current) say("pet me!");
    }, 1400);
    return () => window.clearTimeout(id);
  }, [say]);

  const wake = useCallback(() => {
    if (mood !== "sleeping") return;
    onMoodChange("idle");
    say(pick(WAKE_LINES));
    sounds.meow();
  }, [mood, onMoodChange, say, sounds]);

  const handlePat = () => {
    if (patLock.current) return;
    patLock.current = true;
    later(() => {
      patLock.current = false;
    }, 650);

    if (mood === "sleeping") {
      wake();
      return;
    }
    if (mood === "eating" || mood === "fetching") return;

    setPatKey((key) => key + 1);
    say(pick(PAT_LINES));
    sounds.meow();
    interact("pat");
  };

  // --- fetch ---

  const onBallPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (mood === "sleeping") wake();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  };

  const onBallPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragging || !ball || !roomRef.current) return;
    const rect = roomRef.current.getBoundingClientRect();
    setBall({
      x: clamp(event.clientX - rect.left - BALL / 2, 6, rect.width - BALL - 6),
      y: clamp(event.clientY - rect.top - BALL / 2, 6, rect.height - BALL - 6),
    });
  };

  const onBallPointerUp = () => {
    if (!dragging || !ball) return;
    setDragging(false);
    const targetX = clamp(ball.x + BALL / 2 - CAT / 2, 6, room.w - CAT - 6);
    setBall(null);
    setLunaX(targetX);
    onMoodChange("fetching");
    interact("catch");
    // Safety net: if the yarn landed exactly where Luna already is, no walk
    // animation runs, so onAnimationComplete never fires — resolve anyway.
    later(handleLunaArrive, 1300);
  };

  const handleLunaArrive = () => {
    if (mood !== "fetching") return;
    setHopKey((key) => key + 1);
    say(pick(CATCH_LINES));
    sounds.chirp();
    onMoodChange("idle");
    later(() => setBall(spawnBall(room)), 900);
  };

  // --- feeding ---

  const handleFeed = () => {
    if (mood === "sleeping") {
      wake();
      return;
    }
    if (mood === "eating" || mood === "fetching") return;
    if (!feedFull) {
      if (mood === "idle") say(pick(EMPTY_LINES));
      return;
    }

    const targetX = clamp(bowlLeft + 28 - CAT / 2, 6, room.w - CAT - 6);
    setLunaX(targetX);
    onMoodChange("eating");

    later(() => {
      sounds.eat();
      say(pick(EAT_LINES));
    }, 700);
    later(() => {
      sounds.eat();
      say(pick(EAT_LINES));
    }, 1500);
    later(() => {
      setFeedFull(false);
      onMoodChange("idle");
      say("yum! ♥");
      interact("feed");
    }, 2400);
    later(() => setFeedFull(true), 45_000);
  };

  return (
    <div
      ref={roomRef}
      className="relative min-h-0 flex-1 select-none overflow-hidden"
    >
      {/* sky */}
      <div className="luna-sky absolute inset-0" />

      {/* stars */}
      {STARS.map((star, index) => (
        <span
          key={index}
          className="luna-star absolute rounded-full"
          style={{
            left: star.left,
            top: star.top,
            width: star.size,
            height: star.size,
            animationDelay: `${star.delay}s`,
          }}
        />
      ))}

      {/* moon */}
      <div
        className="luna-moon absolute rounded-full"
        style={{ right: 22, top: 18, width: 46, height: 46 }}
      />

      {/* drifting clouds */}
      <div className="luna-cloud absolute h-5 w-24" style={{ top: "16%", left: 0 }} />
      <div
        className="luna-cloud absolute h-4 w-16"
        style={{ top: "27%", left: 0, animationDelay: "-14s" }}
      />

      {/* desk */}
      <div className="luna-desk absolute inset-x-0 bottom-0" style={{ height: `${DESK_SHARE * 100}%` }}>
        <div className="absolute inset-x-0 top-0 h-px bg-[var(--luna-desk-edge)]" />
      </div>

      {/* Luna's shadow */}
      <div
        className="absolute rounded-full bg-black/10 blur-[3px] dark:bg-black/40"
        style={{ bottom: sitBottom - 3, left: lunaX + 10, width: CAT - 20, height: 7 }}
      />

      {/* tiny monitor — a build is running somewhere */}
      <div
        className="absolute"
        style={{ left: Math.max(12, room.w * 0.05), bottom: sitBottom - 6 }}
        title="a build is running somewhere"
      >
        <div className="rounded-lg border-2 border-zinc-700/80 bg-zinc-900 p-1.5 shadow-md" style={{ width: 76, height: 54 }}>
          <div className="flex h-full flex-col items-center justify-center gap-1 rounded-sm bg-zinc-950/60">
            <Loader2 className="size-3 animate-spin text-teal-300" />
            <p className="font-mono text-[8px] uppercase tracking-wide text-teal-200/80">
              build…
            </p>
          </div>
        </div>
        <div className="mx-auto h-1.5 w-3/5 rounded-b-md bg-zinc-800" />
      </div>

      {/* a little plant */}
      <span
        className="absolute select-none text-xl"
        style={{ left: Math.max(12, room.w * 0.2), bottom: sitBottom - 14 }}
        aria-hidden="true"
      >
        🌱
      </span>

      {/* food bowl */}
      <button
        type="button"
        onClick={handleFeed}
        aria-label={feedFull ? "Feed Luna" : "Luna's bowl is empty"}
        className="group absolute cursor-pointer"
        style={{ left: bowlLeft, bottom: sitBottom }}
      >
        <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[11px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
          feed
        </span>
        <div className="relative h-5 w-14 rounded-b-xl rounded-t-sm border border-border/70 bg-gradient-to-b from-teal-100 to-teal-200 shadow-sm dark:from-teal-900 dark:to-teal-950">
          {feedFull ? (
            <div className="absolute inset-x-1.5 top-1 flex justify-between">
              <span className="size-1 rounded-full bg-amber-700" />
              <span className="size-1 rounded-full bg-amber-600" />
              <span className="size-1 rounded-full bg-amber-800" />
            </div>
          ) : (
            <div className="absolute inset-x-3 top-1 flex justify-between opacity-40">
              <span className="size-1 rounded-full bg-amber-900" />
              <span className="size-1 rounded-full bg-amber-900" />
            </div>
          )}
        </div>
      </button>

      {/* speech bubble */}
      <AnimatePresence>
        {bubble && (
          <motion.div
            key={bubble.id}
            initial={{ opacity: 0, y: 6, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.95 }}
            transition={{ duration: 0.18 }}
            className="absolute z-30 max-w-[150px] rounded-xl border bg-card px-3 py-1.5 text-xs font-medium text-card-foreground shadow-md"
            style={{ left: bubbleLeft, bottom: bubbleBottom }}
          >
            {bubble.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* zzz while sleeping */}
      <AnimatePresence>
        {mood === "sleeping" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute z-20 text-sm font-bold text-primary/80"
            style={{ left: lunaX + CAT + 4, bottom: sitBottom + CAT - 4 }}
          >
            <span className="luna-zzz block">z</span>
            <span className="luna-zzz block" style={{ animationDelay: "0.5s" }}>
              z
            </span>
            <span className="luna-zzz block" style={{ animationDelay: "1s" }}>
              z
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* yarn ball */}
      {ball && (
        <motion.button
          type="button"
          className="absolute z-10 select-none"
          style={{
            left: ball.x,
            top: ball.y,
            width: BALL,
            height: BALL,
            touchAction: "none",
            cursor: dragging ? "grabbing" : "grab",
          }}
          animate={dragging ? undefined : { y: [0, -5, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          onPointerDown={onBallPointerDown}
          onPointerMove={onBallPointerMove}
          onPointerUp={onBallPointerUp}
          onPointerCancel={onBallPointerUp}
          aria-label="Ball of yarn — drag it for Luna to fetch"
        >
          <span className="pointer-events-none text-[34px] leading-none">🧶</span>
        </motion.button>
      )}

      {/* Luna */}
      <motion.div
        className="absolute z-10"
        style={{ width: CAT, height: CAT, bottom: sitBottom }}
        animate={{ left: lunaX }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
        onAnimationComplete={handleLunaArrive}
      >
        <motion.div
          key={`hop-${hopKey}`}
          animate={hopKey > 0 ? { y: [0, -20, 0] } : undefined}
          transition={{ duration: 0.55, ease: "easeOut" }}
        >
          <motion.div
            key={`pat-${patKey}`}
            animate={patKey > 0 ? { scale: [1, 0.84, 1.06, 1] } : undefined}
            transition={{ duration: 0.38 }}
            style={{ transformOrigin: "bottom" }}
          >
            <button
              type="button"
              onClick={handlePat}
              className="cursor-pointer"
              aria-label="Pet Luna"
              title="Pet Luna"
            >
              <Luna
                mood={
                  mood === "sleeping"
                    ? "sleeping"
                    : mood === "eating"
                      ? "eating"
                      : "idle"
                }
                className="h-24 w-24"
              />
            </button>
          </motion.div>
        </motion.div>
      </motion.div>
    </div>
  );
}
