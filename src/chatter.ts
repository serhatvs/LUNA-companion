/** Everything Luna ever says. Short, lowercase, never in the way. */

const pick = <T>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)]!;

export const LINES = {
  greet: ["hi ♥", "you're back!", "oh good, it's you", "*stretches*"],
  firstBuildOfDay: ["first build of the day ♥", "morning! let's ship something", "day one of many"],
  buildStart: ["building...", "ooh, what's this one?", "*sits very still*", "good luck ♥"],
  buildLong: ["still going...", "this one's a marathon", "*tail twitching*", "any minute now"],
  buildOk: ["build's done! ♥", "green! ♥", "nailed it", "clean run ♥", "no red anywhere"],
  buildFast: ["that was quick ♥", "blink and it's done"],
  buildFail: ["oh no.", "it went red :C", "we'll get it", "hmm. that's not right"],
  buildFailAgain: ["again? :C", "same one twice...", "take a breath, then look"],
  pet: ["*purr*", "♥", "mrrp", "more please", "*leans in*"],
  hungry: ["i'm a bit hungry", "*stares at you meaningfully*", "snack?"],
  bored: ["i'm bored", "play with me?", "*bats at nothing*"],
  lonely: ["hey. hi. hello.", "remember me?", "*sits on your cursor*"],
  sleepy: ["*yawn*", "getting sleepy...", "just a short nap"],
  wake: ["*stretches*", "mmh. hi.", "what did i miss"],
  thrown: ["wheee", "AAA", "*lands on feet*", "rude ♥"],
  fed: ["♥♥♥", "thank you!", "*happy chirp*"],
  levelUp: ["level up ♥", "i'm growing", "look at me go"],
  laser: ["!!!", "*pupils dilate*", "MINE"],
  quiet: ["shh, sleeping", "*curled up*"],
  streak: ["that's a streak ♥", "another day together"],
} as const;

export type LineKey = keyof typeof LINES;

export const line = (key: LineKey): string => pick(LINES[key]);

/** Pull the most human-looking line out of a failed build's output. */
export function errorHint(tail: string): string | null {
  if (!tail) return null;
  const lines = tail
    .split("\n")
    .map((l) => l.replace(/\[[0-9;]*m/g, "").trim())
    .filter(Boolean);

  const interesting = lines.find((l) =>
    /(^|\s)(error|failed|panic|exception|cannot|not found|expected)/i.test(l),
  );
  const chosen = interesting ?? lines[lines.length - 1];
  if (!chosen) return null;
  return chosen.length > 110 ? `${chosen.slice(0, 107)}...` : chosen;
}

export const duration = (ms: number): string => {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${String(s % 60).padStart(2, "0")}s`;
};
