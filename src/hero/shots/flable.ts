import { easeHold, easeLift, easeOpen, easeStudio, k } from "../timeline";
import type { Tracks } from "../timeline";

/**
 * Shot 01 · Flable "Morning Brief".
 * Flable's AI CMO opens with "Good morning", so its world is its own lilac UI turned into a cove at sunrise.
 * Motion is ported from mckp.live's MacBook presets (opening of "Laptop 135e0caf", the pan-and-pull of
 * "Laptop de6e287a") and scaled to about 0.3× so it reads as a calm stage behind the hero headline.
 */

export type Channel =
  | "rotY" // the laptop's apparent turn in degrees, made by orbiting the camera (positive faces the CTA)
  | "rotX" // camera pitch over the rest elevation, degrees
  | "zoom" // framing scale over the HUD-fitted rest framing
  | "lid" // lid angle, degrees from shut
  | "power" // screen on
  | "ink" // ink lines drawn on (Drawn)
  | "real" // ink filled to the real UI (Real)
  | "glow" // screen bloom on the cove
  | "screen" // fractional screen index: 0 chats → 1 cards → 2 table → 3 chats
  | "focus" // spotlight amount
  | "focusX" // spotlight centre and size, in screenshot UV (y from the top)
  | "focusY"
  | "focusW"
  | "focusH"
  | "lift" // KPI strip out of the screen
  | "fan" // KPI strip into tiles
  | "sun" // morning light
  | "dust";

export interface ScreenSource {
  id: string;
  /** Path stem in public/media/flable; the runner picks -1024 or -2048 by tier. */
  src: string;
  width: number;
  height: number;
}

export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

// Normalised regions measured on the 2880×2048 exports (y from the top).
const kpiStrip: Rect = { x0: 0.1944, y0: 0.3311, x1: 0.9715, y1: 0.4634 };
const topRevenueRow: Rect = { x0: 0.1944, y0: 0.5715, x1: 0.9715, y1: 0.6385 };
const centre = (rect: Rect) => ({ x: (rect.x0 + rect.x1) / 2, y: (rect.y0 + rect.y1) / 2, w: rect.x1 - rect.x0, h: rect.y1 - rect.y0 });
const kpi = centre(kpiStrip);
const row = centre(topRevenueRow);

export const flableShot = {
  id: "flable",
  screens: [
    { id: "chats", src: "/media/flable/chats", width: 2880, height: 2048 },
    { id: "cards", src: "/media/flable/insights-cards", width: 2880, height: 2048 },
    { id: "table", src: "/media/flable/insights-table", width: 2880, height: 2048 },
  ] satisfies ScreenSource[],
  /** The breakout copies this strip of the cards screen; dividers split it into tiles. ROAS leads. */
  breakout: {
    screen: 1,
    rect: kpiStrip,
    dividers: [0.3497, 0.5052, 0.6608, 0.8163],
    lead: 2,
  },
  introDuration: 3.6,
  loopDuration: 15,
  /** Reduced motion and posters hold this loop time: the strip out and fanned, the most telling still. */
  stillTime: 7.8,

  intro: {
    // The camera swings in from the headline side as the lid opens, and settles with the laptop facing the CTA.
    rotY: [k(0, -22), k(3.6, 14, easeOpen)],
    rotX: [k(0, 5), k(3.6, 0, easeOpen)],
    zoom: [k(0, 1.18), k(3.6, 1, easeOpen)],
    lid: [k(0, 14), k(1.6, 112, easeOpen), k(3.6, 108)],
    power: [k(0.9, 0), k(1.3, 1)],
    // The whole frame draws itself while the lid opens, then fills to the real shot.
    ink: [k(0.25, 0), k(1.7, 1)],
    real: [k(1.9, 0), k(3.4, 1)],
    glow: [k(1, 0), k(1.45, 1), k(2.6, 0.35)],
    screen: [k(0, 0)],
    focus: [k(0, 0)],
    focusX: [k(0, kpi.x)],
    focusY: [k(0, kpi.y)],
    focusW: [k(0, kpi.w)],
    focusH: [k(0, kpi.h)],
    lift: [k(0, 0)],
    fan: [k(0, 0)],
    sun: [k(0.2, 0), k(2, 1, easeOpen)],
    dust: [k(1.6, 0), k(3.4, 1)],
  } satisfies Tracks<Channel>,

  // Seamless: every channel ends where it starts.
  loop: {
    // A · Brief (0–4.6) drift · B · Breakout (5.3–10) the camera eases round toward the CTA side · C · Detail · return.
    rotY: [k(0, 14), k(4.6, 10), k(9.8, 20), k(13.4, 17), k(15, 14)],
    rotX: [k(0, 0), k(7.5, 1.6), k(13, -0.8), k(15, 0)],
    zoom: [k(0, 1), k(5.3, 1), k(8, 1.16), k(10.4, 1.16), k(13.4, 1.24), k(15, 1)],
    lid: [k(0, 108), k(7.5, 110), k(15, 108)],
    power: [k(0, 1)],
    ink: [k(0, 1)],
    real: [k(0, 1)],
    glow: [k(0, 0.35), k(4.7, 0.35), k(5.05, 0.6), k(5.8, 0.35), k(10.1, 0.35), k(10.4, 0.55), k(11, 0.35), k(15, 0.35)],
    screen: [k(0, 0), k(4.5, 0), k(5.3, 1), k(10, 1), k(10.6, 2), k(14.2, 2), k(15, 3)],
    focus: [k(0, 0), k(5.6, 0), k(6.4, 1), k(9.4, 1), k(10, 0), k(11, 0), k(11.8, 1), k(13.5, 1), k(14.3, 0), k(15, 0)],
    focusX: [k(0, kpi.x)],
    focusY: [k(0, kpi.y), k(10.45, kpi.y), k(10.5, row.y, easeHold), k(14.6, row.y), k(14.65, kpi.y, easeHold)],
    focusW: [k(0, kpi.w)],
    focusH: [k(0, kpi.h), k(10.45, kpi.h), k(10.5, row.h, easeHold), k(14.6, row.h), k(14.65, kpi.h, easeHold)],
    lift: [k(0, 0), k(6, 0), k(6.9, 1, easeLift), k(9.2, 1), k(9.9, 0, easeOpen), k(15, 0)],
    fan: [k(0, 0), k(6.7, 0), k(7.6, 1, easeLift), k(8.9, 1), k(9.5, 0, easeStudio), k(15, 0)],
    sun: [k(0, 1)],
    dust: [k(0, 1)],
  } satisfies Tracks<Channel>,

  /** Scrubbed by scroll as the hero leaves: the lid closes on the way to "01 Flable" in Selected Work. */
  // The laptop stays on the desk: only the lid and the camera move.
  exit: { lid: 24, power: 0.25, rotX: 7, zoom: 0.94 },

  /** Narrow layouts sit the laptop more square-on, so the screen stays readable at small sizes. */
  compactYawScale: 0.45,

  scrimTint: "--scene-flable-shadow",
} as const;

export type Shot = typeof flableShot;
export type ShotState = Record<Channel, number>;

export function emptyState(): ShotState {
  return {
    rotY: 0, rotX: 0, zoom: 1, lid: 108, power: 1, ink: 1, real: 1, glow: 0, screen: 0,
    focus: 0, focusX: 0.5, focusY: 0.5, focusW: 1, focusH: 1, lift: 0, fan: 0, sun: 1, dust: 1,
  };
}
