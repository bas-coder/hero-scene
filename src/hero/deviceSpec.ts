import * as THREE from "three";

/**
 * MacBook Pro 14" in scene units (1 unit = 10 cm), measured from the scanned model
 * ("2021 Macbook Pro 14" by akshatmittal, CC BY 4.0). Framing, the screen mapping and the breakout
 * read these numbers, never the model's own authoring.
 */
export const macbook14 = {
  width: 3.146,
  depth: 2.203,
  baseHeight: 0.13,
  /** Hinge axis in device space (base centred on the origin, sitting on y = 0). */
  hinge: { y: 0.132, z: -1.118 },
  lidHeight: 2.136,
  lidThickness: 0.07,
  /** Display size, and its centre measured along the lid from the hinge. */
  display: { width: 3.035, height: 1.96, centreY: 1.091 },
  /** The notch is cut into the model's display, so the shader doesn't draw one. */
  notch: new THREE.Vector2(0, 0),
  /** Menu bar band under the notch, as a share of display height (the notch is 3.2%). */
  menubar: 0.034,
} as const;

export type DeviceSpec = typeof macbook14;

/** Screenshot UV (y from the top) → local position on the display plane, centred on the display. */
export function screenshotToDisplay(spec: DeviceSpec, shotAspect: number, su: number, sv: number) {
  const displayAspect = spec.display.width / spec.display.height;
  const contentAspect = displayAspect / (1 - spec.menubar);
  const u = (su - 0.5) * (shotAspect / contentAspect) + 0.5;
  const vt = spec.menubar + sv * (1 - spec.menubar);
  return new THREE.Vector2((u - 0.5) * spec.display.width, (0.5 - vt) * spec.display.height);
}

/** Lid pivot rotation for an opening angle in degrees (0 shut, 90 upright), for a lid built upright. */
export const lidRotation = (angle: number) => THREE.MathUtils.degToRad(90 - angle);
