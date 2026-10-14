/**
 * Seeded randomness (mulberry32). Every build of the world uses rng(seed), never Math.random, so every
 * load is identical: captures, judges and the live site all see the same pencils, speckle and grain.
 */
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Uniform in [min, max). */
export const range = (random, min, max) => min + (max - min) * random();
