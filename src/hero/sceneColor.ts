import * as THREE from "three";
import { readToken } from "../design/readToken";

const cache = new Map<string, THREE.Color>();

/** A `--scene-*` token as a three.js colour (linear working space). Colours never live in scene code. */
export function sceneColor(token: string): THREE.Color {
  let color = cache.get(token);
  if (!color) {
    color = new THREE.Color(readToken(token));
    cache.set(token, color);
  }
  return color.clone();
}
