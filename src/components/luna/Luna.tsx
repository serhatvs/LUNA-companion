import { motion } from "framer-motion";

/**
 * Luna — the tiny pixel cat that lives in Code Companion. Rendered as crisp
 * SVG rects so she stays featherweight (no image assets, no blur filters).
 */
const CAT_ROWS = [
  "...##......##...",
  "..PPPP....PPPP..",
  "..#############.",
  ".##############.",
  ".##############.",
  ".##############.",
  ".####EE##EE####.",
  ".####EE##EE####.",
  ".##############.",
  ".######PP######.",
  ".##############.",
  "..#############..",
  "..###########....",
  "..###CCCC###.....",
  "..######.........",
  "................",
];

const CAT_COLORS: Record<string, string> = {
  "#": "#3f4147", // warm charcoal body
  P: "#f2a6b8", // pink ears / nose
  E: "#fdf6ee", // cream eyes
  C: "#0f766e", // teal collar
};

interface LunaProps {
  className?: string;
  /** Gentle idle bob, like Luna is perched and breathing. */
  idle?: boolean;
}

export function Luna({ className, idle = false }: LunaProps) {
  return (
    <motion.svg
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      className={className}
      aria-hidden="true"
      animate={idle ? { y: [0, -1.2, 0] } : undefined}
      transition={
        idle
          ? { duration: 3.2, repeat: Infinity, ease: "easeInOut" }
          : undefined
      }
    >
      {CAT_ROWS.map((row, y) =>
        [...row].map((cell, x) =>
          cell === "." ? null : (
            <rect
              key={`${x}-${y}`}
              x={x}
              y={y}
              width={1}
              height={1}
              fill={CAT_COLORS[cell]}
            />
          ),
        ),
      )}
    </motion.svg>
  );
}
