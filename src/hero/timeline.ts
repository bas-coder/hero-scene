/**
 * Keyframe tracks in the mckp.live studio format: each key holds a time, a value and the cubic-bezier
 * easing of the segment that ends on it. Shots are plain data, so any frame can be sampled exactly
 * (capture mode, reduced motion, HUD QA) and the presets can be transcribed straight from the studio.
 */

export type Bezier = readonly [number, number, number, number];

/** mckp's two easings: the opening move, and every other segment. */
export const easeOpen: Bezier = [0.76, 0, 0.24, 1];
export const easeStudio: Bezier = [0.42, 0, 0.58, 1];
/** Lift-out with a small overshoot; used where a component leaves the screen. */
export const easeLift: Bezier = [0.34, 1.4, 0.64, 1];
export const easeHold: Bezier = [0, 0, 1, 1];

export interface Key {
  t: number;
  v: number;
  ease?: Bezier;
}

export type Tracks<K extends string> = Record<K, Key[]>;

const bezierCache = new Map<string, (x: number) => number>();

/** Cubic-bezier timing function, solved for x with Newton–Raphson and bisection as a fallback. */
export function cubicBezier([x1, y1, x2, y2]: Bezier): (x: number) => number {
  const id = `${x1},${y1},${x2},${y2}`;
  const cached = bezierCache.get(id);
  if (cached) return cached;
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const slopeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  const solve = (x: number) => {
    let t = x;
    for (let i = 0; i < 8; i += 1) {
      const error = sampleX(t) - x;
      if (Math.abs(error) < 1e-6) return t;
      const slope = slopeX(t);
      if (Math.abs(slope) < 1e-6) break;
      t -= error / slope;
    }
    let low = 0;
    let high = 1;
    t = x;
    for (let i = 0; i < 24; i += 1) {
      const value = sampleX(t);
      if (Math.abs(value - x) < 1e-6) break;
      if (value < x) low = t;
      else high = t;
      t = (low + high) / 2;
    }
    return t;
  };
  const fn = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : sampleY(solve(x)));
  bezierCache.set(id, fn);
  return fn;
}

export function sampleTrack(keys: Key[], time: number): number {
  if (keys.length === 0) return 0;
  if (time <= keys[0].t) return keys[0].v;
  const last = keys[keys.length - 1];
  if (time >= last.t) return last.v;
  for (let i = 1; i < keys.length; i += 1) {
    const to = keys[i];
    if (time <= to.t) {
      const from = keys[i - 1];
      const span = to.t - from.t;
      const progress = span <= 0 ? 1 : (time - from.t) / span;
      return from.v + (to.v - from.v) * cubicBezier(to.ease ?? easeStudio)(progress);
    }
  }
  return last.v;
}

export function sampleTracks<K extends string>(tracks: Tracks<K>, time: number, into: Record<K, number>) {
  for (const name in tracks) into[name] = sampleTrack(tracks[name], time);
  return into;
}

/** Shorthand for writing tracks: k(time, value, ease). */
export const k = (t: number, v: number, ease?: Bezier): Key => ({ t, v, ease });

export const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
export const lerp = (from: number, to: number, amount: number) => from + (to - from) * amount;
/** 0 → 1 between two times, eased. */
export function window01(time: number, start: number, end: number, ease: Bezier = easeStudio) {
  return cubicBezier(ease)(clamp01((time - start) / (end - start)));
}
