import { easeHold, easeLift, easeOpen, easeStudio, k } from "../timeline.js";

/**
 * Shot 01 · Flable. Same world as every shot (black desk, black room); Flable brings its own light (the
 * violet mood lives in the palette, never here). Motion is the old flable.ts, verbatim: ported from
 * mckp.live's MacBook presets and scaled to about 0.3× so it reads as a calm stage behind the headline.
 *
 * Screens (13 Oct exports, fitted to the GLB display 3024 × 1953): SignIn shows while the laptop powers on,
 * then the loop tours Chats → Insights (KPI breakout) → Mission Control (strategy spotlight) → Chats.
 */

/** Normalised regions on the fitted 3024 × 1953 screens (y from the top). Re-measure if an export changes. */
// Measured from the built 2048 px textures (pixel scan of the borders), 13 Oct.
const kpiStrip = { x0: 0.1853, y0: 0.3473, x1: 0.9717, y1: 0.4856 };
const strategyStepper = { x0: 0.207, y0: 0.242, x1: 0.697, y1: 0.31 };
const centre = (rect) => ({ x: (rect.x0 + rect.x1) / 2, y: (rect.y0 + rect.y1) / 2, w: rect.x1 - rect.x0, h: rect.y1 - rect.y0 });
const kpi = centre(kpiStrip);
const step = centre(strategyStepper);

/** Screen index for a fractional `screen` value: 0 is SignIn (intro only); 1..3 loop Chats, Insights, Mission. */
export function screenIndex(n) {
  return n < 1 ? 0 : 1 + ((Math.floor(n) - 1) % 3);
}

export const flableShot = {
  id: "flable",
  mood: "flable",
  screens: [
    { id: "signin", src: "media/hero/flable/signin", width: 3024, height: 1953 },
    { id: "chats", src: "media/hero/flable/chats", width: 3024, height: 1953 },
    { id: "insights", src: "media/hero/flable/insights", width: 3024, height: 1953 },
    { id: "mission", src: "media/hero/flable/mission", width: 3024, height: 1953 },
  ],
  /** The breakout copies the Insights KPI strip; dividers (absolute screen u) split it into tiles. ROAS leads. */
  breakout: {
    screen: 2,
    rect: kpiStrip,
    dividers: [0.3423, 0.4998, 0.6572, 0.8145],
    lead: 2,
  },
  caseKey: { href: "flable", label: "Open the case study" },
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
    // Signed in as the screen wakes, then into Chats as the frame turns real.
    screen: [k(0, 0), k(2.6, 0), k(3.4, 1, easeStudio)],
    focus: [k(0, 0)],
    focusX: [k(0, kpi.x)],
    focusY: [k(0, kpi.y)],
    focusW: [k(0, kpi.w)],
    focusH: [k(0, kpi.h)],
    lift: [k(0, 0)],
    fan: [k(0, 0)],
    sun: [k(0.2, 0), k(2, 1, easeOpen)],
    dust: [k(1.6, 0), k(3.4, 1)],
  },

  // Seamless: every channel ends where it starts (screen 4 is Chats again).
  loop: {
    rotY: [k(0, 14), k(4.6, 10), k(9.8, 20), k(13.4, 17), k(15, 14)],
    rotX: [k(0, 0), k(7.5, 1.6), k(13, -0.8), k(15, 0)],
    zoom: [k(0, 1), k(5.3, 1), k(8, 1.16), k(10.4, 1.16), k(13.4, 1.24), k(15, 1)],
    lid: [k(0, 108), k(7.5, 110), k(15, 108)],
    power: [k(0, 1)],
    ink: [k(0, 1)],
    real: [k(0, 1)],
    glow: [k(0, 0.35), k(4.7, 0.35), k(5.05, 0.6), k(5.8, 0.35), k(10.1, 0.35), k(10.4, 0.55), k(11, 0.35), k(15, 0.35)],
    screen: [k(0, 1), k(4.5, 1), k(5.3, 2), k(10, 2), k(10.6, 3), k(14.2, 3), k(15, 4)],
    focus: [k(0, 0), k(5.6, 0), k(6.4, 1), k(9.4, 1), k(10, 0), k(11, 0), k(11.8, 1), k(13.5, 1), k(14.3, 0), k(15, 0)],
    focusX: [k(0, kpi.x), k(10.45, kpi.x), k(10.5, step.x, easeHold), k(14.6, step.x), k(14.65, kpi.x, easeHold)],
    focusY: [k(0, kpi.y), k(10.45, kpi.y), k(10.5, step.y, easeHold), k(14.6, step.y), k(14.65, kpi.y, easeHold)],
    focusW: [k(0, kpi.w), k(10.45, kpi.w), k(10.5, step.w, easeHold), k(14.6, step.w), k(14.65, kpi.w, easeHold)],
    focusH: [k(0, kpi.h), k(10.45, kpi.h), k(10.5, step.h, easeHold), k(14.6, step.h), k(14.65, kpi.h, easeHold)],
    lift: [k(0, 0), k(6, 0), k(6.9, 1, easeLift), k(9.2, 1), k(9.9, 0, easeOpen), k(15, 0)],
    fan: [k(0, 0), k(6.7, 0), k(7.6, 1, easeLift), k(8.9, 1), k(9.5, 0, easeStudio), k(15, 0)],
    sun: [k(0, 1)],
    dust: [k(0, 1)],
  },

  /** Scrubbed by scroll as the hero leaves: the lid closes. The laptop stays on the desk; only lid and camera move. */
  exit: { lid: 24, power: 0.25, rotX: 7, zoom: 0.94 },

  /** Narrow layouts sit the laptop more square-on, so the screen stays readable at small sizes. */
  compactYawScale: 0.45,

  /**
   * Rest framing, from the reference: the laptop about a third of the frame wide, a little right of centre,
   * the room visible around it. The lit screen still stays under the header and above the headline.
   */
  framing: {
    // Gate A (13 Oct): Abbas asked for a bigger laptop than the reference's third.
    desktop: { anchor: [0.54, 0.46], maxWidth: 0.42 },
    compact: { anchor: [0.36, 0.27], maxWidth: 0.6 },
  },

  /** Rest camera (the timeline's rotX / rotY are offsets from this). Low over the desk, like the reference. */
  camera: { fov: 14, distance: 24, elevation: 5, target: [0, 1.0, -0.25] },
};

export function emptyState() {
  return {
    rotY: 0, rotX: 0, zoom: 1, lid: 108, power: 1, ink: 1, real: 1, glow: 0, screen: 1,
    focus: 0, focusX: 0.5, focusY: 0.5, focusW: 1, focusH: 1, lift: 0, fan: 0, sun: 1, dust: 1,
  };
}
