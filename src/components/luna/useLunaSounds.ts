import { useCallback, useEffect, useRef } from "react";

/**
 * Luna's voice — a featherweight Web Audio synthesizer. No audio files, no
 * fonts, no external requests: every sound is a couple of oscillator blips,
 * generated on demand and gone the instant it finishes.
 */

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return null;
    audioCtx = new AC();
  }
  if (audioCtx.state === "suspended") void audioCtx.resume();
  return audioCtx;
}

interface ToneOpts {
  type?: OscillatorType;
  from: number;
  to?: number;
  dur?: number;
  gain?: number;
  delay?: number;
}

function tone(
  ctx: AudioContext,
  { type = "sine", from, to, dur = 0.18, gain = 0.1, delay = 0 }: ToneOpts,
) {
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(Math.max(from, 1), t0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(to ?? from, 1), t0 + dur);
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(env);
  env.connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

export function useLunaSounds(enabled: boolean) {
  const enabledRef = useRef(enabled);
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  const play = useCallback((fn: (ctx: AudioContext) => void) => {
    if (!enabledRef.current) return;
    const ctx = getCtx();
    if (!ctx) return;
    try {
      fn(ctx);
    } catch {
      // Audio unavailable (e.g. webview restrictions) — stay quiet.
    }
  }, []);

  /** A soft two-note meow. */
  const meow = useCallback(
    () =>
      play((ctx) => {
        tone(ctx, { type: "triangle", from: 640, to: 980, dur: 0.14, gain: 0.13 });
        tone(ctx, { type: "triangle", from: 480, to: 300, dur: 0.24, gain: 0.09, delay: 0.15 });
      }),
    [play],
  );

  /** A low, rumbling purr. */
  const purr = useCallback(
    () =>
      play((ctx) => {
        for (let i = 0; i < 4; i++) {
          tone(ctx, { type: "sawtooth", from: 110, to: 82, dur: 0.12, gain: 0.045, delay: i * 0.16 });
        }
      }),
    [play],
  );

  /** A happy two-note chirp for fetch catches. */
  const chirp = useCallback(
    () =>
      play((ctx) => {
        tone(ctx, { type: "sine", from: 880, to: 880, dur: 0.09, gain: 0.1 });
        tone(ctx, { type: "sine", from: 1318, to: 1318, dur: 0.14, gain: 0.1, delay: 0.1 });
      }),
    [play],
  );

  /** Quick crunchy nom-noms. */
  const eat = useCallback(
    () =>
      play((ctx) => {
        tone(ctx, { type: "square", from: 220, to: 180, dur: 0.07, gain: 0.045 });
        tone(ctx, { type: "square", from: 240, to: 190, dur: 0.07, gain: 0.045, delay: 0.12 });
      }),
    [play],
  );

  return { meow, purr, chirp, eat };
}
