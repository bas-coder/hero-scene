import { flableShot } from "./flable.js";

/** Shot registry. A new project is a new shot file here: same world, its own screens, timeline and mood. */
export const shots = { flable: flableShot };

export function getShot(id) {
  return shots[id] ?? flableShot;
}
