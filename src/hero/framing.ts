import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * HUD-aware framing. The shot is never composed against guessed percentages: it reads the real HUD boxes
 * (header, badge + headline, actions, footer meta, mobile dock), treats them as no-go zones, and fits the
 * device into what is left with a 2D lens shift (setViewOffset), so perspective never changes with layout.
 */

export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface Stage {
  width: number;
  height: number;
  /** Free area for the device, in canvas CSS pixels. */
  bounds: Box;
  /** HUD boxes the screen and the breakout may never cross. */
  keepOut: Box[];
  /** Stacked HUD (tablet portrait and phones): the device sits above the copy, more square-on. */
  compact: boolean;
  /** Bottom of the top chrome and top of the hero footer meta, for the centred stage. */
  chromeTop: number;
  footerTop: number;
  version: number;
}

const hudSelectors = [".hero-copy", ".hero-actions", ".hero-footer"];
const chromeSelectors = [".site-header", ".mobile-header", ".mobile-dock"];

function boxOf(element: Element, origin: DOMRect): Box | null {
  const rect = element.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;
  const style = getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden") return null;
  return { left: rect.left - origin.left, top: rect.top - origin.top, right: rect.right - origin.left, bottom: rect.bottom - origin.top };
}

export function measureStage(canvas: HTMLElement, version: number): Stage {
  const origin = canvas.getBoundingClientRect();
  const width = origin.width;
  const height = origin.height;
  const section = canvas.closest(".hero") ?? document;
  const keepOut: Box[] = [];
  hudSelectors.forEach((selector) => {
    const element = section.querySelector(selector);
    const box = element && boxOf(element, origin);
    if (box) keepOut.push(box);
  });
  // Fixed chrome is measured against the viewport (where it sits over the hero); absolute chrome against the hero.
  const viewport = { left: origin.left, top: 0 } as DOMRect;
  let chromeTop = 0;
  let chromeBottom = height;
  chromeSelectors.forEach((selector) => {
    const element = document.querySelector(selector);
    if (!element) return;
    const box = boxOf(element, getComputedStyle(element).position === "fixed" ? viewport : origin);
    if (!box) return;
    if (box.top < height * 0.3) chromeTop = Math.max(chromeTop, box.bottom);
    else chromeBottom = Math.min(chromeBottom, box.top);
    keepOut.push(box);
  });

  const copy = keepOut[0];
  const compact = !copy || copy.right - copy.left > width * 0.7 || width < height;
  const margin = Math.max(16, Math.min(width, height) * 0.03);
  const hudTop = Math.min(...keepOut.filter((box) => box.top > height * 0.3).map((box) => box.top), chromeBottom);
  const bounds: Box = {
    left: margin,
    right: width - margin,
    top: chromeTop + margin,
    bottom: compact ? hudTop - margin : chromeBottom - margin,
  };
  const footer = keepOut[2];
  return { width, height, bounds, keepOut, compact, chromeTop, footerTop: footer ? footer.top : chromeBottom, version };
}

/** Keeps a live Stage for the canvas: resize, HUD reflow and late fonts all re-measure. */
export function useHudStage(canvas: HTMLCanvasElement | null, onChange?: () => void) {
  const stage = useRef<Stage | null>(null);
  const changed = useRef(onChange);
  changed.current = onChange;
  useEffect(() => {
    if (!canvas) return;
    let version = 0;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        version += 1;
        stage.current = measureStage(canvas, version);
        changed.current?.();
      });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(canvas);
    const section = canvas.closest(".hero");
    section?.querySelectorAll(".hero-copy, .hero-actions, .hero-footer").forEach((element) => observer.observe(element));
    window.addEventListener("resize", update);
    void document.fonts?.ready.then(update);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [canvas]);
  return stage;
}

/** A 2D framing: projected pixel p lands at p * scale + offset. */
export interface Framing {
  scale: number;
  offset: THREE.Vector2;
}

const ndc = new THREE.Vector3();

/** Projects world points to canvas pixels with the camera's un-shifted projection. */
export function projectPoints(points: THREE.Vector3[], camera: THREE.PerspectiveCamera, width: number, height: number, out: THREE.Vector2[] = []) {
  points.forEach((point, i) => {
    ndc.copy(point).project(camera);
    const target = out[i] ?? (out[i] = new THREE.Vector2());
    target.set(((ndc.x + 1) / 2) * width, ((1 - ndc.y) / 2) * height);
  });
  out.length = points.length;
  return out;
}

function hull(points: THREE.Vector2[]) {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: THREE.Vector2, a: THREE.Vector2, b: THREE.Vector2) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: THREE.Vector2[] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: THREE.Vector2[] = [];
  for (let i = sorted.length - 1; i >= 0; i -= 1) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

/** Separating-axis test between a convex polygon and an axis-aligned box. */
export function polygonHitsBox(polygon: THREE.Vector2[], box: Box) {
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
  const corners = [
    [box.left, box.top],
    [box.right, box.top],
    [box.right, box.bottom],
    [box.left, box.bottom],
  ];
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

export function convexHull(points: THREE.Vector2[]) {
  return hull(points);
}

const inflate = (box: Box, by: number): Box => ({ left: box.left - by, top: box.top - by, right: box.right + by, bottom: box.bottom + by });

/**
 * Finds the largest framing that keeps the device inside the stage and clear of every HUD box,
 * preferring an anchor point (as a share of the canvas). Runs only when the stage changes.
 */
/** The lit screen's vertical band: under the header and above the headline, so white UI never sits behind white type. */
export function screenBand(stage: Stage) {
  const gap = stage.height * 0.02;
  const copy = stage.keepOut[0];
  return { top: stage.chromeTop + gap, bottom: (copy ? copy.top : stage.footerTop) - gap };
}

export function solveFraming(
  projected: THREE.Vector2[],
  stage: Stage,
  anchor: THREE.Vector2,
  maxWidth = Infinity,
  screen?: { points: THREE.Vector2[]; top: number; bottom: number },
): Framing {
  const shape = hull(projected);
  const xs = shape.map((p) => p.x);
  const ys = shape.map((p) => p.y);
  const centre = new THREE.Vector2((Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2);
  const spanX = Math.max(...xs) - Math.min(...xs);
  const gap = Math.max(12, stage.height * 0.02);
  const keepOut = stage.keepOut.map((box) => inflate(box, gap));
  const { bounds } = stage;
  const moved = shape.map((p) => p.clone());

  const fits = (scale: number, target: THREE.Vector2) => {
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
  const candidates: THREE.Vector2[] = [];
  for (let x = 0.3; x <= 0.8001; x += 0.025) {
    for (let y = 0.2; y <= 0.62; y += 0.02) candidates.push(new THREE.Vector2(x * stage.width, y * stage.height));
  }
  candidates.sort((a, b) => a.distanceToSquared(preferred) - b.distanceToSquared(preferred));

  let best: Framing | null = null;
  let low = 0.05;
  let high = 12;
  for (let i = 0; i < 18; i += 1) {
    const scale = (low + high) / 2;
    let found: THREE.Vector2 | null = null;
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
export function applyFraming(camera: THREE.PerspectiveCamera, width: number, height: number, framing: Framing, zoom = 1, pivot?: THREE.Vector2, shift?: THREE.Vector2) {
  const scale = framing.scale * zoom;
  const offset = framing.offset.clone().multiplyScalar(zoom);
  if (pivot) offset.add(pivot.clone().multiplyScalar(1 - zoom));
  if (shift) offset.add(shift);
  camera.setViewOffset(width, height, -offset.x / scale, -offset.y / scale, width / scale, height / scale);
}
