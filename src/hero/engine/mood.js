import * as THREE from "three";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";

/**
 * How strongly a material answers the screen's area light (its specular and its diffuse, each 0 → 1; every other
 * light is untouched). Polished aluminium right under the lit screen mirrors it so sharply that the palm rest burns
 * white; a desk only ever sees the screen at a grazing angle, where a real panel emits far less than the area
 * light's even (Lambertian) spread. Both sit beside the headline (rule 47).
 */
export function screenResponse(material, { specular = 1, diffuse = 1 } = {}) {
  const chunk = THREE.ShaderChunk.lights_physical_pars_fragment;
  const specularTerm = "reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate";
  const diffuseTerm = "reflectedLight.directDiffuse += lightColor * material.diffuseContribution * LTC_Evaluate";
  if ((specular === 1 && diffuse === 1) || !chunk.includes(specularTerm) || !chunk.includes(diffuseTerm)) return;
  const softened = chunk
    .replace(specularTerm, `reflectedLight.directSpecular += ${specular.toFixed(3)} * lightColor * fresnel * LTC_Evaluate`)
    .replace(diffuseTerm, `reflectedLight.directDiffuse += ${diffuse.toFixed(3)} * lightColor * material.diffuseContribution * LTC_Evaluate`);
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace("#include <lights_physical_pars_fragment>", softened);
  };
  material.customProgramCacheKey = () => `screen-response-${specular}-${diffuse}`;
}

/**
 * A shot's mood: lights (lamp key, window rim, the shelf's warm practical rim, low ambient, the screen's own
 * spill) and the bulb take their colour and strength from the mood; the dressing sets the materials. The room's
 * bounce reaches the scene through the environment (index.js), not a flat ambient, so shadows keep depth.
 * Values live in the palette (lab: palette.json; site: --scene-* tokens), keyed by mood name.
 *
 * The intro's `sun` (0 → 1) is staged, so the world does not simply fade up: the lamp ignites first (bulb and
 * pool together), then the screen wakes (its own `power` channel), then the room comes up behind them.
 */

/** The display's own light: a soft panel the size of the screen, hung on the display so it follows the lid. */
export function createScreenLight(display, { width, height }) {
  RectAreaLightUniformsLib.init();
  const light = new THREE.RectAreaLight(0xffffff, 0, width, height);
  light.name = "screen-light";
  // Rect lights emit along their local −z; the display's +z faces out of the glass.
  light.rotation.y = Math.PI;
  light.position.z = 0.02;
  display.add(light);
  return light;
}

export function createLights(world) {
  const ambient = new THREE.HemisphereLight(0xffffff, 0x000000, 0);
  const window = new THREE.DirectionalLight(0xffffff, 0);
  window.position.set(14, 6, -10);
  window.target.position.set(0, 0, -1);
  // The shelf's LED behind the laptop: a faint warm rim on the lid's top edge and the props' backs. Kept steep:
  // at a grazing angle the glossy desk mirrored it as an orange glint.
  const practical = new THREE.DirectionalLight(0xffffff, 0);
  practical.position.set(-5, 6, -14);
  practical.target.position.set(0, 1, 0);
  world.add(ambient, window, window.target, practical, practical.target);
  // The screen light is hung on the display once the laptop loads (createScreenLight).
  return { ambient, window, practical, screen: null };
}

const scratch = new THREE.Color();
const smooth = (edge0, edge1, x) => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

/** Splits the intro's sun into the lamp's ignition and the room's slower rise. */
export function stageLight(sun) {
  // The lamp is lit by ~0.7 s, before the screen powers on (0.9–1.3 s); the room follows from ~1.05 s.
  // The bulb glows a beat before its pool lands, so the light never appears before its source.
  return { lamp: smooth(0.0, 0.08, sun), pool: smooth(0.01, 0.14, sun), room: smooth(0.4, 1.0, sun) };
}

/** Applies a mood for a light level. Returns the staged levels (the engine scales env, plates and grade by room). */
export function applyMood({ lights, lamp }, mood, { sun = 1, power = 1, glow = 0 } = {}) {
  const level = stageLight(sun);
  lamp.light.color.set(mood.lamp.color);
  lamp.light.intensity = mood.lamp.intensity * level.pool;
  lamp.bulb.material.color.copy(scratch.set(mood.lamp.color).multiplyScalar(mood.lamp.bulb * level.lamp));
  // The hood's inner reflector is lit by the bulb: a fraction of its brightness.
  lamp.reflector.material.color.copy(scratch.set(mood.lamp.color).multiplyScalar(mood.lamp.bulb * 0.09 * level.lamp));
  lights.window.color.set(mood.window.color);
  lights.window.intensity = mood.window.intensity * level.room;
  lights.practical.color.set(mood.practicals.color);
  lights.practical.intensity = (mood.practicals.intensity ?? 0) * level.room;
  lights.ambient.color.set(mood.ambient.sky);
  lights.ambient.groundColor.set(mood.ambient.ground);
  lights.ambient.intensity = mood.ambient.intensity * level.room;
  if (lights.screen) {
    lights.screen.color.set(mood.screen.color);
    // The power-on glow lifts the spill a little, never into an exposure jump on the props beside it.
    lights.screen.intensity = mood.screen.intensity * power * (0.8 + 0.35 * glow);
  }
  return level;
}
