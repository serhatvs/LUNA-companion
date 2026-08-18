import { motion } from "framer-motion";
import { useEffect, useState } from "react";

/**
 * Luna — the tiny pixel cat that lives in Code Companion. Rendered as crisp
 * SVG rects so she stays featherweight (no image assets, no blur filters).
 *
 * The body is a fixed 16×16 grid with three slots: the eyes ({L}/{R}), the
 * nose ({N}), and a mouth ({M}) that only appears while she's eating.
 */

export type LunaMood = "idle" | "sleeping" | "eating";

const BODY = [
  "...##......##...",
  "..PPPP....PPPP..",
  "..#############.",
  ".##############.",
  ".##############.",
  ".##############.",
  ".####{L}##{R}####.",
  ".####{L}##{R}####.",
  ".##############.",
  ".######{N}######.",
  ".######{M}#######.",
  "..#############..",
  "..###########....",
  "..###CCCC###.....",
  "..######.........",
  "................",
];

const COLORS: Record<string, string> = {
  "#": "#3f4147", // warm charcoal body
  P: "#f2a6b8", // pink ears / nose
  E: "#fdf6ee", // cream eye
  "-": "#585b62", // eyelid
  "=": "#26282e", // closed eye (sleeping)
  C: "#0f766e", // teal collar
  M: "#e58aa0", // mouth (eating)
};

interface LunaProps {
  className?: string;
  mood?: LunaMood;
}

export function Luna({ className, mood = "idle" }: LunaProps) {
  const [blinking, setBlinking] = useState(false);

  // Blink every few seconds — but never while asleep or mid-meal.
  useEffect(() => {
    if (mood !== "idle") return;
    let alive = true;
    let timeout: number;

    const schedule = () => {
      timeout = window.setTimeout(() => {
        if (!alive) return;
        setBlinking(true);
        window.setTimeout(() => {
          if (alive) setBlinking(false);
        }, 140);
        schedule();
      }, 2600 + Math.random() * 3200);
    };
    schedule();

    return () => {
      alive = false;
      window.clearTimeout(timeout);
    };
  }, [mood]);

  const eyes =
    mood === "sleeping" ? "==" : mood === "eating" ? "EE" : blinking ? "--" : "EE";
  const mouth = mood === "eating" ? "M" : ".";

  const rows = BODY.map((row) =>
    row
      .split("{L}")
      .join(eyes[0])
      .split("{R}")
      .join(eyes[1])
      .split("{N}")
      .join("PP")
      .split("{M}")
      .join(mouth),
  );

  return (
    <motion.svg
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      className={className}
      aria-hidden="true"
    >
      <motion.g
        style={{ transformOrigin: "50% 100%" }}
        animate={
          mood === "sleeping"
            ? { y: [0, -0.7, 0] }
            : mood === "eating"
              ? { scaleY: [1, 0.94, 1] }
              : { y: [0, -1.1, 0] }
        }
        transition={
          mood === "sleeping"
            ? { duration: 4.6, repeat: Infinity, ease: "easeInOut" }
            : mood === "eating"
              ? { duration: 0.34, repeat: Infinity, ease: "easeInOut" }
              : { duration: 3.2, repeat: Infinity, ease: "easeInOut" }
        }
      >
        {rows.map((row, y) =>
          [...row].map((cell, x) =>
            cell === "." || cell === " " ? null : (
              <rect
                key={`${x}-${y}`}
                x={x}
                y={y}
                width={1}
                height={1}
                fill={COLORS[cell]}
              />
            ),
          ),
        )}
      </motion.g>
    </motion.svg>
  );
}
