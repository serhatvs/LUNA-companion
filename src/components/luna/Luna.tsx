import { motion } from "framer-motion";
import { useEffect, useState } from "react";

/**
 * Luna — the tiny pixel cat that lives on your screen. Rendered as crisp SVG
 * rects so she stays featherweight (no image assets, no blur filters).
 *
 * The body is a fixed 16×16 grid with three slots: the eyes ({L}/{R}), the
 * nose ({N}), and a mouth ({M}). Poses vary the bottom rows (legs vs sitting)
 * and the eye/mouth expression; "dangle" and "fly" flip her upside down.
 */

export type LunaPose =
  | "idle"
  | "walk"
  | "sit"
  | "sleep"
  | "dangle"
  | "fly"
  | "happy";

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
];

// Bottom rows vary with the pose.
const LEGS_STAND = [
  "..###########....",
  "..###CCCC###.....",
  "..######.........",
];

const LEGS_WALK_A = [
  "..###########....",
  "..###CCCC###.....",
  "..##......##.....",
];

const LEGS_WALK_B = [
  "..###########....",
  "..###CCCC###.....",
  "..###....###.....",
];

const LEGS_SIT = [
  "..###########....",
  "..#########......",
  "..##########.....",
];

const COLORS: Record<string, string> = {
  "#": "#3f4147", // warm charcoal body
  P: "#f2a6b8", // pink ears / nose
  E: "#fdf6ee", // cream eye
  "-": "#585b62", // eyelid
  "=": "#26282e", // closed eye (sleeping)
  X: "#26282e", // worried eye (dangling)
  C: "#0f766e", // teal collar
  M: "#e58aa0", // open mouth
};

interface LunaProps {
  className?: string;
  pose?: LunaPose;
  /** Which way she faces: 1 = right, -1 = left. */
  facing?: 1 | -1;
}

export function Luna({ className, pose = "idle", facing = 1 }: LunaProps) {
  const [blinking, setBlinking] = useState(false);
  const [step, setStep] = useState<0 | 1>(0);

  // Blink every few seconds — never while asleep, dangling, or flying.
  useEffect(() => {
    if (pose !== "idle" && pose !== "walk" && pose !== "sit") return;
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
  }, [pose]);

  // Walk cycle: alternate the legs while walking.
  useEffect(() => {
    if (pose !== "walk") {
      setStep(0);
      return;
    }
    const id = window.setInterval(
      () => setStep((value) => (value === 0 ? 1 : 0)),
      170,
    );
    return () => window.clearInterval(id);
  }, [pose]);

  const upsideDown = pose === "dangle" || pose === "fly";
  const eyes =
    pose === "sleep"
      ? "=="
      : upsideDown
        ? "XX"
        : pose === "happy"
          ? "EE"
          : blinking
            ? "--"
            : "EE";
  const mouth = pose === "happy" || upsideDown ? "M" : ".";

  const bottom =
    pose === "sit" || pose === "sleep"
      ? LEGS_SIT
      : pose === "walk"
        ? step === 0
          ? LEGS_WALK_A
          : LEGS_WALK_B
        : LEGS_STAND;

  const rows = [...BODY, ...bottom].map((row) =>
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

  const bob =
    pose === "walk"
      ? { y: [0, -1.6, 0] }
      : pose === "idle" || pose === "happy"
        ? { y: [0, -1, 0] }
        : pose === "sleep"
          ? { y: [0, -0.6, 0] }
          : { y: 0 };

  const bobDuration =
    pose === "walk" ? 0.42 : pose === "idle" || pose === "happy" ? 3.2 : 4.6;

  return (
    <div
      className={className}
      style={{
        transform: `scaleX(${facing}) scaleY(${upsideDown ? -1 : 1})`,
      }}
    >
      <motion.svg
        viewBox="0 0 16 16"
        shapeRendering="crispEdges"
        className="h-full w-full"
        aria-hidden="true"
      >
        <motion.g
          style={{ transformOrigin: "50% 100%" }}
          animate={bob}
          transition={{ duration: bobDuration, repeat: Infinity, ease: "easeInOut" }}
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
    </div>
  );
}
