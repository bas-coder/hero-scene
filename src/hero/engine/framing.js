import * as THREE from "three";

/**
 * HUD-aware framing, ported from the old src/hero/framing.ts. The shot is never composed against guessed
 * percentages: it reads the real HUD boxes (header, badge + headline, actions, footer meta, mobile dock),
 * treats them as no-go zones, and fits the device into what is left with a 2D lens shift (setViewOffset),
 * so perspective never changes with layout. The lab feeds measured mock stages instead of the DOM.
 */

const hudSelectors = [".hero-copy", ".hero-actions", ".hero-footer"];
const chromeSelectors = [".site-header", ".mobile-header", ".mobile-dock"];

function boxOf(element, origin) {
  const rect = element.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;
  const style = getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden") return null;
  return { left: rect.left - origin.left, top: rect.top - origin.top, right: rect.right - origin.left, bottom: rect.bottom - origin.top };
}

/** Builds a Stage from HUD boxes already measured relative to the canvas (the DOM path and the lab share this). */
export function stageFromBoxes({ width, height, hud = [], chrome = [] }, version = 0) {
  const keepOut = [...hud];
  let chromeTop = 0;
  let chromeBottom = height;
  for (const box of chrome) {
    if (box.top < height * 0.3) chromeTop = Math.max(chromeTop, box.bottom);
    else chromeBottom = Math.min(chromeBottom, box.top);
    keepOut.push(box);
  }
  const copy = hud[0];
  const compact = !copy || copy.right - copy.left > width * 0.7 || width < height;
  const margin = Math.max(16, Math.min(width, height) * 0.03);
  const hudTop = Math.min(...keepOut.filter((box) => box.top > height * 0.3).map((box) => box.top), chromeBottom);
  const bounds = {
    left: margin,
    right: width - margin,
    top: chromeTop + margin,
    bottom: compact ? hudTop - margin : chromeBottom - margin,
  };
  const footer = hud[2];
  return { width, height, bounds, keepOut, compact, chromeTop, footerTop: footer ? footer.top : chromeBottom, version };
}

/**
 * The canonical stage: the desktop hero at 1440 × 900 with its measured HUD (lab/hero/hud.json, 13 Oct).
 * The world's depth cards are laid out once from this view, so every viewport sees the same room.
 */
export function canonicalStage() {
  return stageFromBoxes({
    width: 1440,
    height: 900,
    hud: [
      { left: 40, top: 617, right: 900, bottom: 768 },
      { left: 1119, top: 720, right: 1400, bottom: 768 },
      { left: 40, top: 828, right: 1400, bottom: 860 },
    ],
    chrome: [{ left: 0, top: 0, right: 1440, bottom: 64 }],
  });
}

/** Measures the live HUD around a canvas (site only). */
export function measureStage(canvas, version) {
  const origin = canvas.getBoundingClientRect();
  const section = canvas.closest(".hero") ?? document;
  const hud = [];
  hudSelectors.forEach((selector) => {
    const element = section.querySelector(selector);
    const box = element && boxOf(element, origin);
    if (box) hud.push(box);
  });
  // Fixed chrome is measured against the viewport (where it sits over the hero); absolute chrome against the hero.
  const viewport = { left: origin.left, top: 0 };
  const chrome = [];
  chromeSelectors.forEach((selector) => {
    const element = document.querySelector(selector);
    if (!element) return;
    const box = boxOf(element, getComputedStyle(element).position === "fixed" ? viewport : origin);
    if (box) chrome.push(box);
  });
  return stageFromBoxes({ width: origin.width, height: origin.height, hud, chrome }, version);
}

/** Keeps a live Stage for a canvas: resize, HUD reflow and late fonts all re-measure. Returns { current, dispose }. */
export function watchStage(canvas, onChange) {
  const handle = { current: null, dispose: () => {} };
  let version = 0;
  let frame = 0;
  const update = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      version += 1;
      handle.current = measureStage(canvas, version);
      onChange?.();
    });
  };
  update();
  const observer = new ResizeObserver(update);
  observer.observe(canvas);
  canvas.closest(".hero")?.querySelectorAll(".hero-copy, .hero-actions, .hero-footer").forEach((element) => observer.observe(element));
  window.addEventListener("resize", update);
  void document.fonts?.ready.then(update);
  handle.dispose = () => {
    cancelAnimationFrame(frame);
    observer.disconnect();
    window.removeEventListener("resize", update);
  };
  return handle;
}

const ndc = new THREE.Vector3();

/** Projects world points to canvas pixels with the camera's un-shifted projection. */
export function projectPoints(points, camera, width, height, out = []) {
  points.forEach((point, i) => {
    ndc.copy(point).project(camera);
    const target = out[i] ?? (out[i] = new THREE.Vector2());
    target.set(((ndc.x + 1) / 2) * width, ((1 - ndc.y) / 2) * height);
  });
  out.length = points.length;
  return out;
}

export function convexHull(points) {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (let i = sorted.length - 1; i >= 0; i -= 1) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

/** Separating-axis test between a convex polygon and an axis-aligned box. */
export function polygonHitsBox(polygon, box) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of polygon) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  if (maxX < box.left || minX > box.right || maxY < box.top || minY > box.bottom) return false;
  const corners = [[box.left, box.top], [box.right, box.top], [box.right, box.bottom], [box.left, box.bottom]];
  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    const nx = b.y - a.y;
    const ny = a.x - b.x;
    let polyMax = -Infinity;
    let polyMin = Infinity;
    for (const p of polygon) {
      const d = p.x * nx + p.y * ny;
      polyMax = Math.max(polyMax, d);
      polyMin = Math.min(polyMin, d);
    }
    let boxMin = Infinity;
    let boxMax = -Infinity;
    for (const [x, y] of corners) {
      const d = x * nx + y * ny;
      boxMin = Math.min(boxMin, d);
      boxMax = Math.max(boxMax, d);
    }
    if (boxMax < polyMin || boxMin > polyMax) return false;
  }
  return true;
}

const inflate = (box, by) => ({ left: box.left - by, top: box.top - by, right: box.right + by, bottom: box.bottom + by });

/** The lit screen's vertical band: under the header and above the headline, so white UI never sits behind white type. */
export function screenBand(stage) {
  const gap = stage.height * 0.02;
  const copy = stage.keepOut[0];
  return { top: stage.chromeTop + gap, bottom: (copy ? copy.top : stage.footerTop) - gap };
}

/**
 * Finds the largest framing that keeps the device inside the stage and clear of every HUD box,
 * preferring an anchor point (as a share of the canvas). Runs only when the stage changes.
 */
export function solveFraming(projected, stage, anchor, maxWidth = Infinity, screen) {
  const shape = convexHull(projected);
  const xs = shape.map((p) => p.x);
  const ys = shape.map((p) => p.y);
  const centre = new THREE.Vector2((Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2);
  const spanX = Math.max(...xs) - Math.min(...xs);
  const gap = Math.max(12, stage.height * 0.02);
  const keepOut = stage.keepOut.map((box) => inflate(box, gap));
  const { bounds } = stage;
  const moved = shape.map((p) => p.clone());

  const fits = (scale, target) => {
    if (spanX * scale > maxWidth) return null;
    const offset = target.clone().sub(centre.clone().multiplyScalar(scale));
    if (screen) {
      for (const p of screen.points) {
        const y = p.y * scale + offset.y;
        if (y < screen.top || y > screen.bottom) return null;
      }
    }
    for (let i = 0; i < shape.length; i += 1) {
      const p = moved[i].copy(shape[i]).multiplyScalar(scale).add(offset);
      if (p.x < bounds.left || p.x > bounds.right || p.y < bounds.top || p.y > bounds.bottom) return null;
    }
    for (const box of keepOut) if (polygonHitsBox(moved, box)) return null;
    return offset;
  };

  // Candidate anchors, nearest to the preferred one first.
  const preferred = new THREE.Vector2(anchor.x * stage.width, anchor.y * stage.height);
  const candidates = [];
  for (let x = 0.3; x <= 0.8001; x += 0.025) {
    for (let y = 0.2; y <= 0.62; y += 0.02) candidates.push(new THREE.Vector2(x * stage.width, y * stage.height));
  }
  candidates.sort((a, b) => a.distanceToSquared(preferred) - b.distanceToSquared(preferred));

  let best = null;
  let low = 0.05;
  let high = 12;
  for (let i = 0; i < 18; i += 1) {
    const scale = (low + high) / 2;
    let found = null;
    // Allow the anchor to wander a little more as the device grows; the best size wins, then nearness.
    for (const target of candidates) {
      if (target.distanceTo(preferred) > stage.width * 0.22) break;
      found = fits(scale, target);
      if (found) break;
    }
    if (found) {
      best = { scale, offset: found };
      low = scale;
    } else {
      high = scale;
    }
  }
  return best ?? { scale: 1, offset: preferred.clone().sub(centre) };
}

/** Applies a framing (and a per-frame zoom about a pixel pivot) to the camera as a lens shift. */
export function applyFraming(camera, width, height, framing, zoom = 1, pivot, shift) {
  const scale = framing.scale * zoom;
  const offset = framing.offset.clone().multiplyScalar(zoom);
  if (pivot) offset.add(pivot.clone().multiplyScalar(1 - zoom));
  if (shift) offset.add(shift);
  camera.setViewOffset(width, height, -offset.x / scale, -offset.y / scale, width / scale, height / scale);
}
