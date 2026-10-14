import * as THREE from "three";

/**
 * MacBook Pro 14" in scene units (1 unit = 10 cm), measured from the GLB ("2021 Macbook Pro 14" by
 * akshatmittal, CC BY 4.0). Framing, the screen mapping and the breakout read these numbers.
 * Display measured from the raw glTF display mesh: 30.346 × 19.600 cm (aspect 1.5482), notch 4.109 × 0.64 cm.
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
  display: { width: 3.0346, height: 1.96, centreY: 1.091 },
  /** Screen image size the display maps edge to edge (3024 px native width). */
  screenPixels: { width: 3024, height: 1953 },
};

/** Lid pivot rotation for an opening angle in degrees (0 shut, 90 upright), for a lid built upright. */
export const lidRotation = (angle) => THREE.MathUtils.degToRad(90 - angle);

/** Screen UV (y from the top) → local position on the display plane (scene units), centred on the display. */
export function screenToDisplay(su, sv, spec = macbook14) {
  return new THREE.Vector2((su - 0.5) * spec.display.width, (0.5 - sv) * spec.display.height);
}

/**
 * Device points that bound its silhouette for a pose. The laptop never moves (it sits on the desk); the camera
 * orbits instead, so framing is solved in device space with the camera at rest.
 */
export function devicePoints(rotY, lid, spec = macbook14) {
  const points = [];
  const w = spec.width / 2;
  const d = spec.depth / 2;
  for (const x of [-w, w]) for (const y of [0, spec.baseHeight]) for (const z of [-d, d]) points.push(new THREE.Vector3(x, y, z));
  const hinge = new THREE.Vector3(0, spec.hinge.y, spec.hinge.z);
  const tilt = new THREE.Euler(lidRotation(lid), 0, 0);
  for (const x of [-w, w]) {
    for (const y of [0, spec.lidHeight]) {
      for (const z of [0, -spec.lidThickness]) points.push(new THREE.Vector3(x, y, z).applyEuler(tilt).add(hinge));
    }
  }
  const yaw = new THREE.Euler(0, THREE.MathUtils.degToRad(rotY), 0);
  return points.map((point) => point.applyEuler(yaw));
}

/** The four display corners in device space, for a pose. */
export function displayPoints(rotY, lid, spec = macbook14) {
  const hinge = new THREE.Vector3(0, spec.hinge.y, spec.hinge.z);
  const tilt = new THREE.Euler(lidRotation(lid), 0, 0);
  const yaw = new THREE.Euler(0, THREE.MathUtils.degToRad(rotY), 0);
  const { width, height, centreY } = spec.display;
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) =>
    new THREE.Vector3((a * width) / 2, centreY + (b * height) / 2, 0.01).applyEuler(tilt).add(hinge).applyEuler(yaw),
  );
}
