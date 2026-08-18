/**
 * Luna's mind: what she wants, what she remembers, and what she has settled
 * into liking. Everything here is persisted to one small JSON file, so the cat
 * you come back to on Monday is the cat you left on Friday.
 */

import type { FurName } from "./sprite";
import { persist } from "./bridge";

export interface Settings {
  fur: FurName;
  /** Device pixels per one of Luna's pixels. */
  zoom: number;
  /** Walk speed multiplier. */
  speed: number;
  chatty: "quiet" | "normal" | "chatty";
  ghost: boolean;
  autoGhost: boolean;
  quietHours: { on: boolean; from: number; to: number };
  autostart: boolean;
}

export interface Stats {
  mood: number;
  energy: number;
  fullness: number;
  /** How badly she needs something to do. */
  bored: number;
  /** How long since you last acknowledged her, as a 0..1 craving. */
  attention: number;
  /** Slow-moving relationship score. Only ever earned. */
  bond: number;
  pets: number;
  feeds: number;
  builds: number;
  buildsPassed: number;
  buildsFailed: number;
  xp: number;
  level: number;
  bornAt: number;
  lastSeen: number;
  /** ISO date of the last day she saw a build, for the streak. */
  streakDay: string;
  streak: number;
}

export interface BuildMemory {
  runs: number;
  fails: number;
  lastMs: number;
  avgMs: number;
}

export interface Saved {
  v: 1;
  settings: Settings;
  stats: Stats;
  builds: Record<string, BuildMemory>;
}

const DEFAULT_SETTINGS: Settings = {
  fur: "cream",
  zoom: 3,
  speed: 1,
  chatty: "normal",
  ghost: false,
  autoGhost: true,
  quietHours: { on: false, from: 23, to: 7 },
  autostart: false,
};

const DEFAULT_STATS: Stats = {
  mood: 0.7,
  energy: 0.85,
  fullness: 0.7,
  bored: 0.2,
  attention: 0.2,
  bond: 0,
  pets: 0,
  feeds: 0,
  builds: 0,
  buildsPassed: 0,
  buildsFailed: 0,
  xp: 0,
  level: 1,
  bornAt: Date.now(),
  lastSeen: Date.now(),
  streakDay: "",
  streak: 0,
};

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Merge a saved blob over the defaults, one key at a time, so an old file or a
 *  hand-edited one can never crash her. */
function adopt<T extends Record<string, unknown>>(defaults: T, saved: unknown): T {
  const out: Record<string, unknown> = { ...defaults };
  if (!isObject(saved)) return out as T;
  for (const key of Object.keys(defaults)) {
    const value = saved[key];
    const fallback = defaults[key];
    if (value === undefined || value === null) continue;
    if (isObject(fallback) && isObject(value)) {
      out[key] = adopt(fallback, value);
    } else if (typeof value === typeof fallback) {
      out[key] = value;
    }
  }
  return out as T;
}

export const xpForLevel = (level: number): number => 60 * level * level;

export class Mind {
  settings: Settings = { ...DEFAULT_SETTINGS };
  stats: Stats = { ...DEFAULT_STATS };
  builds: Record<string, BuildMemory> = {};

  private dirty = false;
  private lastSave = 0;

  load(raw: unknown): void {
    const saved = isObject(raw) ? raw : {};
    this.settings = adopt(
      DEFAULT_SETTINGS as unknown as Record<string, unknown>,
      saved.settings,
    ) as unknown as Settings;
    this.stats = adopt(
      DEFAULT_STATS as unknown as Record<string, unknown>,
      saved.stats,
    ) as unknown as Stats;
    this.builds = isObject(saved.builds) ? (saved.builds as Record<string, BuildMemory>) : {};
    this.catchUp();
  }

  /** Time passed while Luna was closed. Ignore her for a week and she will let
   *  you know about it. */
  private catchUp(): void {
    const away = Math.min(Date.now() - this.stats.lastSeen, 12 * 3600_000);
    if (away < 60_000) return;
    const hours = away / 3600_000;
    this.stats.energy = clamp01(this.stats.energy + hours * 0.09);
    this.stats.fullness = clamp01(this.stats.fullness - hours * 0.05);
    this.stats.attention = clamp01(this.stats.attention + hours * 0.08);
    this.stats.bored = clamp01(this.stats.bored + hours * 0.05);
    this.stats.mood = clamp01(this.stats.mood - hours * 0.015);
  }

  /** One second of cat life. `active` is false while she is asleep. */
  tick(seconds: number, active: boolean): void {
    const s = this.stats;
    const rate = seconds / 60; // per-minute rates read better than per-second
    s.energy = clamp01(s.energy + (active ? -0.004 : 0.02) * rate);
    s.fullness = clamp01(s.fullness - 0.0055 * rate);
    s.bored = clamp01(s.bored + (active ? 0.007 : 0.001) * rate);
    s.attention = clamp01(s.attention + 0.006 * rate);

    // Mood is downstream of everything else, and drifts rather than jumps.
    const want = clamp01(
      0.25 + s.fullness * 0.3 + s.energy * 0.2 + (1 - s.bored) * 0.15 + (1 - s.attention) * 0.1,
    );
    s.mood += (want - s.mood) * Math.min(1, 0.02 * rate);
    s.lastSeen = Date.now();
    this.dirty = true;
  }

  reward(xp: number): boolean {
    this.stats.xp += xp;
    let levelled = false;
    while (this.stats.xp >= xpForLevel(this.stats.level)) {
      this.stats.level += 1;
      levelled = true;
    }
    this.dirty = true;
    return levelled;
  }

  pet(): void {
    const s = this.stats;
    s.pets += 1;
    s.attention = clamp01(s.attention - 0.35);
    s.bored = clamp01(s.bored - 0.15);
    s.mood = clamp01(s.mood + 0.06);
    s.bond = clamp01(s.bond + 0.004);
    this.reward(1);
  }

  feed(): void {
    const s = this.stats;
    s.feeds += 1;
    s.fullness = clamp01(s.fullness + 0.45);
    s.mood = clamp01(s.mood + 0.12);
    s.bond = clamp01(s.bond + 0.01);
    this.reward(4);
  }

  play(): void {
    const s = this.stats;
    s.bored = clamp01(s.bored - 0.5);
    s.energy = clamp01(s.energy - 0.05);
    s.mood = clamp01(s.mood + 0.08);
    s.bond = clamp01(s.bond + 0.005);
    this.reward(2);
  }

  /** Remember how long a given command usually takes. */
  rememberBuild(label: string, ms: number, ok: boolean): BuildMemory {
    const key = label.slice(0, 120);
    const prev = this.builds[key] ?? { runs: 0, fails: 0, lastMs: 0, avgMs: 0 };
    const runs = prev.runs + 1;
    const memory: BuildMemory = {
      runs,
      fails: prev.fails + (ok ? 0 : 1),
      lastMs: ms,
      avgMs: prev.runs === 0 ? ms : Math.round(prev.avgMs + (ms - prev.avgMs) / runs),
    };
    this.builds[key] = memory;

    // Keep the memory small; she is not a database.
    const keys = Object.keys(this.builds);
    if (keys.length > 40) delete this.builds[keys[0]!];

    this.dirty = true;
    return memory;
  }

  expectedMs(label: string): number | null {
    const memory = this.builds[label.slice(0, 120)];
    return memory && memory.runs > 1 ? memory.avgMs : null;
  }

  /** Returns true if this is the first build of a new day. */
  noteBuildDay(): boolean {
    const today = new Date().toISOString().slice(0, 10);
    if (this.stats.streakDay === today) return false;
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    this.stats.streak = this.stats.streakDay === yesterday ? this.stats.streak + 1 : 1;
    this.stats.streakDay = today;
    this.dirty = true;
    return true;
  }

  touch(): void {
    this.dirty = true;
  }

  /** Debounced write; also called directly before quitting. */
  save(force = false): void {
    const now = Date.now();
    if (!force && (!this.dirty || now - this.lastSave < 15_000)) return;
    this.dirty = false;
    this.lastSave = now;
    this.stats.lastSeen = now;
    const blob: Saved = {
      v: 1,
      settings: this.settings,
      stats: this.stats,
      builds: this.builds,
    };
    void persist(blob);
  }
}
