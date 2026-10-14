import * as THREE from "three";
import { rng } from "./rng.js";

/**
 * Seeded procedural textures, painted once on canvases. Albedo variation is luminance only (the dressing
 * supplies the colour through material.color), so one texture serves every shot. Data maps (roughness,
 * bump) are linear; albedo maps are sRGB.
 */

function canvas(size) {
  const element = document.createElement("canvas");
  element.width = element.height = size;
  return { element, context: element.getContext("2d") };
}

function finish(element, { colorSpace = THREE.NoColorSpace, repeat = 1 } = {}) {
  const texture = new THREE.CanvasTexture(element);
  texture.colorSpace = colorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  texture.anisotropy = 8;
  return texture;
}

/** Value noise, tileable, summed over octaves. Returns a Float32Array of size × size in [0, 1]. */
function noiseField(size, seed, octaves = 4, base = 8) {
  const random = rng(seed);
  const field = new Float32Array(size * size);
  let amplitude = 1;
  let total = 0;
  for (let o = 0; o < octaves; o += 1) {
    const cells = base * 2 ** o;
    const lattice = Array.from({ length: cells * cells }, () => random());
    const at = (x, y) => lattice[((y + cells) % cells) * cells + ((x + cells) % cells)];
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const fx = (x / size) * cells;
        const fy = (y / size) * cells;
        const x0 = Math.floor(fx);
        const y0 = Math.floor(fy);
        const tx = fx - x0;
        const ty = fy - y0;
        const sx = tx * tx * (3 - 2 * tx);
        const sy = ty * ty * (3 - 2 * ty);
        const top = at(x0, y0) * (1 - sx) + at(x0 + 1, y0) * sx;
        const bottom = at(x0, y0 + 1) * (1 - sx) + at(x0 + 1, y0 + 1) * sx;
        field[y * size + x] += (top * (1 - sy) + bottom * sy) * amplitude;
      }
    }
    total += amplitude;
    amplitude *= 0.5;
  }
  for (let i = 0; i < field.length; i += 1) field[i] /= total;
  return field;
}

function paintField(context, size, field, map) {
  const image = context.createImageData(size, size);
  for (let i = 0; i < field.length; i += 1) {
    const v = Math.max(0, Math.min(255, Math.round(map(field[i], i) * 255)));
    image.data[i * 4] = image.data[i * 4 + 1] = image.data[i * 4 + 2] = v;
    image.data[i * 4 + 3] = 255;
  }
  context.putImageData(image, 0, 0);
}

/** Desk laminate: a quiet roughness field (no visible pattern, just life in the sheen). */
export function deskRoughness(seed = 11) {
  const size = 512;
  const { element, context } = canvas(size);
  paintField(context, size, noiseField(size, seed, 5, 6), (v) => 0.42 + v * 0.22);
  return finish(element, { repeat: 6 });
}

/**
 * Terrazzo / speckled glaze: an sRGB luminance albedo (white ground, flecks in three sizes). Fleck density
 * follows a low-frequency field, so they gather and thin out instead of sitting evenly on every face.
 */
export function speckle(seed = 21) {
  const size = 512;
  const random = rng(seed);
  const { element, context } = canvas(size);
  paintField(context, size, noiseField(size, seed, 3, 5), (v) => 0.9 + v * 0.1);
  const density = noiseField(size, seed + 7, 2, 3);
  const flecks = [
    { count: 2000, min: 0.3, spread: 0.45 },
    { count: 260, min: 0.8, spread: 1.0 },
    { count: 18, min: 1.8, spread: 1.4 },
  ];
  for (const { count, min, spread } of flecks) for (let i = 0; i < count; i += 1) {
    const x = random() * size;
    const y = random() * size;
    if (random() > 0.25 + density[(Math.floor(y) % size) * size + (Math.floor(x) % size)] * 1.1) continue;
    const r = min + random() * spread;
    // Soft flecks (terrazzo, not ink spatter): low enough contrast that they never draw as lines in the intro.
    const v = random() < 0.7 ? 0.58 + random() * 0.22 : 0.34 + random() * 0.14;
    context.fillStyle = new THREE.Color().setRGB(v, v, v, THREE.SRGBColorSpace).getStyle();
    context.beginPath();
    context.arc(x, y, r, 0, Math.PI * 2);
    context.fill();
  }
  return finish(element, { colorSpace: THREE.SRGBColorSpace, repeat: 1 });
}

/** Leather grain: a bump field of fine pebbling with soft creases. */
export function leatherBump(seed = 31) {
  const size = 512;
  const { element, context } = canvas(size);
  const fine = noiseField(size, seed, 3, 48);
  const creases = noiseField(size, seed + 1, 2, 4);
  paintField(context, size, fine, (v, i) => 0.5 + (v - 0.5) * 0.9 - Math.abs(creases[i] - 0.5) * 0.25);
  return finish(element, { repeat: 2 });
}

/** Cork: a mottled sRGB luminance albedo. */
export function cork(seed = 41) {
  const size = 256;
  const { element, context } = canvas(size);
  const field = noiseField(size, seed, 4, 24);
  paintField(context, size, field, (v) => 0.62 + (v - 0.5) * 0.6);
  return finish(element, { colorSpace: THREE.SRGBColorSpace, repeat: 1 });
}

/**
 * Floor light falloff (sRGB albedo, luminance only) for a floor plane of `span` scene units centred on the origin.
 * The camera sees the floor behind the desk (z ≈ −5 to the room's wall at ≈ −38): it stays dark in the desk's
 * shade and rises toward the wall and the bed's glow (left of centre), broken up by soft low-frequency
 * variation so the under-desk area never reads as one flat sheet.
 */
export function floorFalloff(span = 200, seed = 51) {
  const size = 256;
  const { element, context } = canvas(size);
  const image = context.createImageData(size, size);
  const field = noiseField(size, seed, 3, 4);
  const toUnits = span / size;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      // Canvas rows run top to bottom (v from 1 to 0); plane y maps to world −z once the floor is laid flat.
      const wx = (x + 0.5) * toUnits - span / 2;
      const wz = (y + 0.5) * toUnits - span / 2;
      const t = Math.min(1, Math.max(0, (wz + 6) / -28));
      const back = t * t * (3 - 2 * t);
      const glow = Math.exp(-((wx + 6) ** 2) / 400 - ((wz + 34) ** 2) / 200);
      const value = (0.07 + 0.26 * back + 0.14 * glow) * (0.8 + 0.4 * field[y * size + x]);
      const v = Math.round(255 * Math.min(1, value));
      image.data.set([v, v, v, 255], (y * size + x) * 4);
    }
  }
  context.putImageData(image, 0, 0);
  const texture = finish(element, { colorSpace: THREE.SRGBColorSpace });
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

/**
 * Contact shadow: a soft rounded-rectangle falloff in alpha (black, linear), for the thin dark line where an
 * object meets the surface under it. `soft` is the falloff width as a fraction of the texture.
 */
export function contactShadow(soft = 0.22, radius = 0.12) {
  const size = 128;
  const { element, context } = canvas(size);
  const image = context.createImageData(size, size);
  const half = 0.5 - soft;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const px = Math.abs((x + 0.5) / size - 0.5) - half + radius;
      const py = Math.abs((y + 0.5) / size - 0.5) - half + radius;
      const outside = Math.hypot(Math.max(px, 0), Math.max(py, 0)) + Math.min(Math.max(px, py), 0) - radius;
      const t = Math.min(1, Math.max(0, 1 - outside / soft));
      image.data[(y * size + x) * 4 + 3] = Math.round(255 * t * t * (3 - 2 * t));
    }
  }
  context.putImageData(image, 0, 0);
  const texture = finish(element);
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}
