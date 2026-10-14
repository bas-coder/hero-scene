/**
 * Keyframe tracks in the mckp.live studio format: each key holds a time, a value and the cubic-bezier
 * easing of the segment that ends on it. Shots are plain data, so any frame can be sampled exactly
 * (capture mode, reduced motion, HUD QA, the lab). Ported verbatim from the old src/hero/timeline.ts.
 */

/** mckp's two easings: the opening move, and every other segment. */
export const easeOpen = [0.76, 0, 0.24, 1];
export const easeStudio = [0.42, 0, 0.58, 1];
/** Lift-out with a small overshoot; used where a component leaves the screen. */
export const easeLift = [0.34, 1.4, 0.64, 1];
export const easeHold = [0, 0, 1, 1];

const bezierCache = new Map();

/** Cubic-bezier timing function, solved for x with Newton–Raphson and bisection as a fallback. */
export function cubicBezier([x1, y1, x2, y2]) {
  const id = `${x1},${y1},${x2},${y2}`;
  const cached = bezierCache.get(id);
  if (cached) return cached;
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sampleX = (t) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t) => ((ay * t + by) * t + cy) * t;
  const slopeX = (t) => (3 * ax * t + 2 * bx) * t + cx;
  const solve = (x) => {
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
  const fn = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : sampleY(solve(x)));
  bezierCache.set(id, fn);
  return fn;
}

export function sampleTrack(keys, time) {
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

export function sampleTracks(tracks, time, into) {
  for (const name in tracks) into[name] = sampleTrack(tracks[name], time);
  return into;
}

/** Shorthand for writing tracks: k(time, value, ease). */
export const k = (t, v, ease) => ({ t, v, ease });

export const clamp01 = (value) => Math.min(1, Math.max(0, value));
export const lerp = (from, to, amount) => from + (to - from) * amount;
/** 0 → 1 between two times, eased. */
export function window01(time, start, end, ease = easeStudio) {
  return cubicBezier(ease)(clamp01((time - start) / (end - start)));
}
