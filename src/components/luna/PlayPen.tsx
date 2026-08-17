import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Luna } from "./Luna";

const CAT_SIZE = 52;
const BALL_SIZE = 32;

const PAT_LINES = [
  "purr…",
  "that's nice",
  "meow!",
  "hi!",
  "build's almost done, hang in there",
];

const CATCH_LINES = ["got it!", "yarn!", "my favorite!", "one more?", "hehe!"];

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

interface PlayPenProps {
  /** Luna is mid-thought — show the waiting state. */
  thinking?: boolean;
  onClose?: () => void;
}

/**
 * A tiny sandbox for playing with Luna while builds run or answers arrive:
 * pat her for a reaction, or drag the ball of yarn and watch her fetch it.
 */
export function PlayPen({ thinking = false, onClose }: PlayPenProps) {
  const penRef = useRef<HTMLDivElement>(null);
  const [penSize, setPenSize] = useState({ width: 0, height: 0 });
  const [lunaPos, setLunaPos] = useState({ x: 24, y: 120 });
  const [target, setTarget] = useState<{ x: number; y: number } | null>(null);
  const [ballPos, setBallPos] = useState<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [patKey, setPatKey] = useState(0);
  const [hopKey, setHopKey] = useState(0);
  const [bubble, setBubble] = useState<{ id: number; text: string } | null>(
    null,
  );

  const measure = useCallback(() => {
    const rect = penRef.current?.getBoundingClientRect();
    if (rect) setPenSize({ width: rect.width, height: rect.height });
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  // Populate the pen once we know its size.
  useEffect(() => {
    if (penSize.width === 0) return;
    setLunaPos((pos) =>
      pos.x === 24 && pos.y === 120
        ? { x: 20, y: penSize.height - CAT_SIZE - 14 }
        : pos,
    );
    setBallPos((ball) =>
      ball ?? {
        x: penSize.width - BALL_SIZE - 24,
        y: penSize.height - BALL_SIZE - 18,
      },
    );
  }, [penSize]);

  // Speech bubbles fade on their own.
  useEffect(() => {
    if (!bubble) return;
    const timer = window.setTimeout(() => setBubble(null), 1800);
    return () => window.clearTimeout(timer);
  }, [bubble]);

  const pat = () => {
    setPatKey((key) => key + 1);
    setBubble({ id: Date.now(), text: pick(PAT_LINES) });
  };

  const onBallPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  };

  const onBallPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging || !penRef.current) return;
    const rect = penRef.current.getBoundingClientRect();
    setBallPos({
      x: clamp(
        event.clientX - rect.left - BALL_SIZE / 2,
        6,
        rect.width - BALL_SIZE - 6,
      ),
      y: clamp(
        event.clientY - rect.top - BALL_SIZE / 2,
        6,
        rect.height - BALL_SIZE - 6,
      ),
    });
  };

  const onBallPointerUp = () => {
    if (!dragging) return;
    setDragging(false);
    if (!ballPos) return;
    const next = {
      x: clamp(
        ballPos.x + BALL_SIZE / 2 - CAT_SIZE / 2,
        8,
        penSize.width - CAT_SIZE - 8,
      ),
      y: clamp(
        ballPos.y + BALL_SIZE / 2 - CAT_SIZE / 2,
        8,
        penSize.height - CAT_SIZE - 8,
      ),
    };
    setLunaPos(next);
    setTarget(next);
    setBallPos(null);
  };

  const respawnBall = () => {
    setBallPos({
      x: 10 + Math.random() * Math.max(penSize.width - BALL_SIZE - 20, 1),
      y: 44 + Math.random() * Math.max(penSize.height - BALL_SIZE - 96, 1),
    });
  };

  const bubbleLeft = clamp(lunaPos.x, 8, Math.max(penSize.width - 150, 8));

  return (
    <div
      ref={penRef}
      className="relative h-64 overflow-hidden rounded-2xl border bg-card"
    >
      {/* dot grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          backgroundImage:
            "radial-gradient(circle, oklch(0.55 0.06 185 / 0.16) 1px, transparent 1px)",
          backgroundSize: "16px 16px",
        }}
      />
      {/* floor */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-accent/40 to-transparent" />

      {/* header */}
      <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-2 border-b bg-background/70 px-3 py-2 backdrop-blur">
        <div className="flex min-w-0 items-center gap-2 text-xs font-medium text-muted-foreground">
          <Sparkles className="size-3.5 shrink-0 text-primary" />
          {thinking ? (
            <span className="flex items-center gap-1.5">
              Luna is thinking
              {[0, 1, 2].map((dot) => (
                <span
                  key={dot}
                  className="size-1 animate-bounce rounded-full bg-muted-foreground/70"
                  style={{ animationDelay: `${dot * 150}ms` }}
                />
              ))}
            </span>
          ) : (
            "Luna's playpen"
          )}
        </div>
        {onClose && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="h-6 w-6 shrink-0 cursor-pointer text-muted-foreground"
            onClick={onClose}
            aria-label="Close playpen"
          >
            <X className="size-3.5" />
          </Button>
        )}
      </div>

      {/* hint */}
      <p className="pointer-events-none absolute inset-x-0 bottom-1.5 z-20 text-center text-[11px] text-muted-foreground/80">
        Pet Luna · drag the yarn to play fetch
      </p>

      {/* speech bubble */}
      <AnimatePresence>
        {bubble && (
          <motion.div
            key={bubble.id}
            initial={{ opacity: 0, y: 6, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.95 }}
            transition={{ duration: 0.18 }}
            className="pointer-events-none absolute z-30 rounded-xl border bg-card px-3 py-1.5 text-xs font-medium text-card-foreground shadow-sm"
            style={{
              left: bubbleLeft,
              top: Math.max(lunaPos.y - 46, 8),
            }}
          >
            {bubble.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* yarn ball */}
      {ballPos && (
        <motion.div
          className="absolute z-10 select-none"
          style={{
            left: ballPos.x,
            top: ballPos.y,
            width: BALL_SIZE,
            height: BALL_SIZE,
            touchAction: "none",
            cursor: dragging ? "grabbing" : "grab",
          }}
          animate={{ y: [0, -5, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          onPointerDown={onBallPointerDown}
          onPointerMove={onBallPointerMove}
          onPointerUp={onBallPointerUp}
          onPointerCancel={onBallPointerUp}
          role="button"
          aria-label="Yarn ball — drag to play fetch"
        >
          <span className="text-[26px] leading-none">🧶</span>
        </motion.div>
      )}

      {/* Luna */}
      <motion.div
        className="absolute left-0 top-0"
        style={{ width: CAT_SIZE, height: CAT_SIZE }}
        animate={{ x: lunaPos.x, y: lunaPos.y }}
        transition={{ type: "spring", stiffness: 300, damping: 18 }}
        onAnimationComplete={() => {
          if (!target) return;
          setTarget(null);
          setHopKey((key) => key + 1);
          setBubble({ id: Date.now(), text: pick(CATCH_LINES) });
          window.setTimeout(respawnBall, 900);
        }}
      >
        <motion.div
          key={`hop-${hopKey}`}
          animate={hopKey > 0 ? { y: [0, -18, 0] } : undefined}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <motion.div
            key={`pat-${patKey}`}
            animate={patKey > 0 ? { scale: [1, 0.82, 1.08, 1] } : undefined}
            transition={{ duration: 0.35 }}
          >
            <button
              type="button"
              onClick={pat}
              className="cursor-pointer"
              aria-label="Pet Luna"
              title="Pet Luna"
            >
              <Luna idle className="h-[52px] w-[52px]" />
            </button>
          </motion.div>
        </motion.div>
      </motion.div>
    </div>
  );
}
