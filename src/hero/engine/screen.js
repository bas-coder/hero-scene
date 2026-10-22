import * as THREE from "three";
import { screenIndex } from "./shots/flable.js";

/**
 * The display. The real product UI, never redrawn: the shot's screens crossfade by a diagonal wipe on the
 * fractional `screen` value, a spotlight dims (never blurs) everything outside one UI region, and an empty
 * socket shows where the breakout strip lifted out. Not tone mapped: the product's colours stay as shipped.
 * The UVs are normalised to the display (laptop.js), so a 3024 × 1953 image maps edge to edge.
 */

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D mapA;
  uniform sampler2D mapB;
  uniform float wipe;
  uniform float power;
  uniform float brightness;
  uniform float focus;
  uniform vec4 focusRect; // centre x, centre y, width, height (screen UV, y from the top)
  uniform float lifted;
  uniform float refill; // the share of the lift over which the slot fills again as the card lands
  uniform vec4 socketRect; // x0, y0, x1, y1
  uniform float aspect; // screen width / height
  uniform float radius; // the UI's card corner, in screen heights (the socket)
  uniform float focusRadius; // the spotlit region's own card corner, in screen heights
  uniform vec2 sidebar; // a bare point of the UI's sidebar (screen UV, y from the top)
  uniform vec3 offColor;
  uniform vec3 dimTint;
  uniform vec3 glass;
  varying vec2 vUv;

  // Mipmapped with a slight negative bias so 1x text stays crisp.
  vec3 screenAt(sampler2D map, vec2 uv) {
    return texture2D(map, uv, -0.5).rgb;
  }

  // Signed distance to a rounded rectangle (negative inside).
  float roundedBox(vec2 p, vec2 halfSize, float r) {
    vec2 q = abs(p) - halfSize + r;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  }

  // Diagonal wipe, top-left to bottom-right, with a soft edge: 1 where the outgoing screen (mapA) still shows.
  float wipeAt(vec2 s) {
    float edge = s.x * 0.62 + s.y * 0.38;
    return smoothstep(wipe * 1.12 - 0.1, wipe * 1.12, edge);
  }

  void main() {
    // Screen UV with y from the top (textures load flipped, so uv.y = 1 is the top of the image). Shapes are
    // measured in screen heights (k), so a corner is round, not stretched across the wide screen.
    vec2 s = vec2(vUv.x, 1.0 - vUv.y);
    vec2 k = vec2(aspect, 1.0);
    // The spotlight's region has its own card's corners.
    float outside = smoothstep(0.0, 0.004, roundedBox((s - focusRect.xy) * k, focusRect.zw * 0.5 * k, focusRadius));
    vec3 color = mix(screenAt(mapB, vUv), screenAt(mapA, vUv), wipeAt(s));
    // Where the strip lifted out: an empty slot, a little larger than the strip (so the card's own border goes
    // with it) and as round. It takes the sidebar's grey from whichever screen shows (the UI's own surface, never
    // a black hole), a touch deeper under its top edge and along its rim. Nothing of the UI remains in it.
    vec4 tray = socketRect + vec4(-0.006, -0.008, 0.006, 0.008);
    float trayD = roundedBox((s - (tray.xy + tray.zw) * 0.5) * k, (tray.zw - tray.xy) * 0.5 * k, radius + 0.008);
    // The slot empties as soon as the card is clear of it and fills again only as it lands (over the last 'refill' of
    // the lift, 30% for cards that fade in place; a card that travels far stays opaque and the slot refills under it
    // only once it is back in register): a linear blend left a ghost of the UI under the returning card.
    float inTray = smoothstep(0.0, refill, lifted) * (1.0 - smoothstep(-0.003, 0.0, trayD));
    vec3 grey = mix(screenAt(mapB, vec2(sidebar.x, 1.0 - sidebar.y)), screenAt(mapA, vec2(sidebar.x, 1.0 - sidebar.y)), wipeAt(sidebar));
    float rimShade = 1.0 - 0.04 * (1.0 - smoothstep(0.0, 0.014, -trayD));
    float topShade = 0.96 + 0.04 * smoothstep(tray.y, tray.y + 0.05, s.y);
    color = mix(color, grey * rimShade * topShade, inTray);
    // The spotlight lowers the backlight outside the region toward a plum dark; the UI stays exact and sharp.
    // The empty slot dims with the rest: the light belongs to the tiles that left it.
    color = mix(color, color * dimTint, focus * max(outside, inTray));
    // A panel behind glass: a faint falloff toward the edges (no glare, no sweep).
    vec2 e = abs(s - 0.5) * 2.0;
    color *= 1.0 - 0.035 * dot(e * e, vec2(0.5));
    // A backlight dims perceptually (power cubed): the exit's quarter power reads as dark glass, which shows a
    // faint reflection of the lit room, stronger toward the top.
    float lit = power * power * power;
    vec3 dark = offColor + glass * (1.0 - power) * (0.5 + 0.5 * (1.0 - s.y));
    color = mix(dark, color * brightness, lit);
    // Alpha 0 marks the screen for the post chain: no tone mapping or grade on the product UI.
    gl_FragColor = vec4(color, 0.0);
    #include <colorspace_fragment>
  }
`;

export function createScreenMaterial(palette) {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      mapA: { value: null },
      mapB: { value: null },
      wipe: { value: 0 },
      power: { value: 1 },
      brightness: { value: palette.screen.brightness },
      focus: { value: 0 },
      focusRect: { value: new THREE.Vector4(0.5, 0.5, 1, 1) },
      lifted: { value: 0 },
      refill: { value: 0.3 },
      socketRect: { value: new THREE.Vector4(0, 0, 0, 0) },
      aspect: { value: 1 },
      radius: { value: 0 },
      focusRadius: { value: 0 },
      sidebar: { value: new THREE.Vector2(0, 0) },
      offColor: { value: new THREE.Color(palette.screen.off) },
      dimTint: { value: new THREE.Color(palette.screen.dim) },
      glass: { value: new THREE.Color(palette.screen.glass) },
    },
    vertexShader,
    fragmentShader,
    toneMapped: false,
  });
  material.name = "hero-screen";
  return material;
}

/** Loads the shot's screens for a tier (1024 low, 2048 otherwise) with mipmaps and anisotropy. */
export async function loadScreens(shot, { assetBase, quality, renderer }) {
  const width = quality === "low" ? 1024 : 2048;
  const loader = new THREE.TextureLoader();
  const anisotropy = renderer.capabilities.getMaxAnisotropy();
  return Promise.all(
    shot.screens.map(async (screen) => {
      const texture = await loader.loadAsync(`${assetBase}${screen.src}-${width}.webp`);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = anisotropy;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.generateMipmaps = true;
      return texture;
    }),
  );
}

/**
 * Each breakout's detail texture (a crop of its UI at the export's native resolution), in shot.breakouts order; null
 * on the low tier (and for a breakout without one), which samples the screen texture itself.
 */
export async function loadDetails(shot, { assetBase, quality, renderer }) {
  return Promise.all((shot.breakouts ?? []).map(async ({ detail }) => {
    if (!detail || quality === "low") return null;
    const texture = await new THREE.TextureLoader().loadAsync(`${assetBase}${detail.src}.webp`);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    return texture;
  }));
}

/** Points the material at the two screens either side of the fractional `screen` value. */
export function setScreen(material, textures, value) {
  const from = screenIndex(Math.floor(value));
  const to = screenIndex(Math.floor(value) + 1);
  const u = material.uniforms;
  u.mapA.value = textures[from];
  u.mapB.value = textures[to];
  u.wipe.value = value - Math.floor(value);
}
