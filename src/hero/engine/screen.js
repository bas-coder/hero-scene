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
  uniform vec4 socketRect; // x0, y0, x1, y1
  uniform vec3 offColor;
  uniform vec3 socketColor;
  uniform vec3 dimTint;
  varying vec2 vUv;

  // Mipmapped with a slight negative bias so 1x text stays crisp.
  vec3 screenAt(sampler2D map, vec2 uv) {
    return texture2D(map, uv, -0.5).rgb;
  }

  void main() {
    // Screen UV with y from the top (textures load flipped, so uv.y = 1 is the top of the image).
    vec2 s = vec2(vUv.x, 1.0 - vUv.y);
    vec2 d = abs(s - focusRect.xy) - focusRect.zw * 0.5;
    float outside = smoothstep(0.0, 0.004, max(d.x, d.y));
    // Diagonal wipe, top-left to bottom-right, with a soft edge.
    float edge = (s.x * 0.62 + s.y * 0.38);
    float m = smoothstep(wipe * 1.12 - 0.1, wipe * 1.12, edge);
    vec3 a = screenAt(mapA, vUv);
    vec3 b = screenAt(mapB, vUv);
    vec3 color = mix(b, a, m);
    // The spotlight lowers the backlight outside the region toward a plum dark; the UI stays exact and sharp.
    color = mix(color, color * dimTint, focus * outside);
    // Where the strip lifted out: a soft-edged cavity, a little of the UI still glowing up from inside it.
    vec2 inner = smoothstep(socketRect.xy, socketRect.xy + 0.003, s) * (1.0 - smoothstep(socketRect.zw - 0.003, socketRect.zw, s));
    float cavityShade = 0.65 + 0.35 * smoothstep(socketRect.y, socketRect.y + 0.05, s.y);
    vec3 cavity = mix(socketColor, color * 0.22, 0.35) * cavityShade;
    color = mix(color, cavity, lifted * inner.x * inner.y);
    // A panel behind glass: a faint falloff toward the edges (no glare, no sweep).
    vec2 e = abs(s - 0.5) * 2.0;
    color *= 1.0 - 0.035 * dot(e * e, vec2(0.5));
    // A backlight dims perceptually: power squared, so the exit's quarter power reads as a dark glass.
    color = mix(offColor, color * brightness, power * power);
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
      socketRect: { value: new THREE.Vector4(0, 0, 0, 0) },
      offColor: { value: new THREE.Color(palette.screen.off) },
      socketColor: { value: new THREE.Color(palette.screen.socket) },
      dimTint: { value: new THREE.Color(palette.screen.dim) },
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

/** Points the material at the two screens either side of the fractional `screen` value. */
export function setScreen(material, textures, value) {
  const from = screenIndex(Math.floor(value));
  const to = screenIndex(Math.floor(value) + 1);
  const u = material.uniforms;
  u.mapA.value = textures[from];
  u.mapB.value = textures[to];
  u.wipe.value = value - Math.floor(value);
}
