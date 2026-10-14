import * as THREE from "three";
import { sceneColor } from "./sceneColor";

/**
 * The display. One shader does everything mckp does on its screen and the two things it can't:
 * - Drawn → Real: the real screenshot is first drawn as navy ink (Sobel edges on paper), then filled in.
 * - Screen wipes along the sun's direction, a spotlight that dims and softens everything outside one UI region,
 *   and an empty "socket" where a component has lifted out.
 * The top band is a menu bar under the notch, so the notch never covers product UI.
 * Not tone mapped: the product's colours stay exactly as shipped.
 */

export interface ScreenUniforms {
  [uniform: string]: THREE.IUniform;
  map0: THREE.IUniform<THREE.Texture | null>;
  map1: THREE.IUniform<THREE.Texture | null>;
  map2: THREE.IUniform<THREE.Texture | null>;
  texel: THREE.IUniform<THREE.Vector2>;
  displayAspect: THREE.IUniform<number>;
  shotAspect: THREE.IUniform<number>;
  menubar: THREE.IUniform<number>;
  notch: THREE.IUniform<THREE.Vector2>;
  screen: THREE.IUniform<number>;
  power: THREE.IUniform<number>;
  brightness: THREE.IUniform<number>;
  ink: THREE.IUniform<number>;
  real: THREE.IUniform<number>;
  focus: THREE.IUniform<number>;
  focusRect: THREE.IUniform<THREE.Vector4>;
  lifted: THREE.IUniform<number>;
  inkColor: THREE.IUniform<THREE.Color>;
  paperColor: THREE.IUniform<THREE.Color>;
  menubarColor: THREE.IUniform<THREE.Color>;
  offColor: THREE.IUniform<THREE.Color>;
  socketColor: THREE.IUniform<THREE.Color>;
  bezelColor: THREE.IUniform<THREE.Color>;
}

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D map0;
  uniform sampler2D map1;
  uniform sampler2D map2;
  uniform vec2 texel;
  uniform float displayAspect;
  uniform float shotAspect;
  uniform float menubar;
  uniform vec2 notch;
  uniform float screen;
  uniform float power;
  uniform float brightness;
  uniform float ink;
  uniform float real;
  uniform float focus;
  uniform vec4 focusRect;
  uniform float lifted;
  uniform vec3 inkColor;
  uniform vec3 paperColor;
  uniform vec3 menubarColor;
  uniform vec3 offColor;
  uniform vec3 socketColor;
  uniform vec3 bezelColor;
  varying vec2 vUv;

  float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

  // Screenshot UV has y from the top; textures are flipped on upload, so sample at 1 - y.
  vec3 shot(float index, vec2 uv, float lod) {
    vec2 t = vec2(uv.x, 1.0 - uv.y);
    if (index < 0.5) return textureLod(map0, t, lod).rgb;
    if (index < 1.5) return textureLod(map1, t, lod).rgb;
    return textureLod(map2, t, lod).rgb;
  }

  float inkLuma(vec2 uv) { return luma(texture(map0, vec2(uv.x, 1.0 - uv.y)).rgb); }

  float roundRect(vec2 p, vec2 halfSize, float radius) {
    vec2 q = abs(p) - halfSize + radius;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
  }

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

  void main() {
    vec2 uv = vec2(vUv.x, 1.0 - vUv.y);
    // Diagonal from the top right (where the sun comes from) to the bottom left.
    float sweep = (1.0 - uv.x) * 0.55 + uv.y * 0.45;

    // Fit the screenshot to the content height; its flat edge columns extend to the sides.
    float contentAspect = displayAspect / (1.0 - menubar);
    vec2 suv = vec2((uv.x - 0.5) * contentAspect / shotAspect + 0.5, (uv.y - menubar) / (1.0 - menubar));
    suv.x = clamp(suv.x, texel.x, 1.0 - texel.x);
    bool inBar = uv.y < menubar;

    // Spotlight on one UI region, in screenshot space with square corners in pixels.
    vec2 aspect = vec2(shotAspect, 1.0);
    vec2 centre = focusRect.xy;
    vec2 halfSize = focusRect.zw * 0.5;
    float d = roundRect((suv - centre) * aspect, halfSize * aspect + 0.012, 0.018);
    float inside = 1.0 - smoothstep(0.0, 0.02, d);
    float outside = focus * (1.0 - inside);

    float index = mod(floor(screen), 3.0);
    float next = mod(index + 1.0, 3.0);
    float wipe = fract(screen);
    float edge = smoothstep(wipe * 1.2 - 0.1, wipe * 1.2 - 0.02, sweep);
    float lod = outside * 3.0;
    vec3 realColor = mix(shot(next, suv, lod), shot(index, suv, lod), wipe > 0.0 ? edge : 1.0);
    realColor *= 1.0 - outside * 0.24;
    realColor = mix(realColor, socketColor, inside * lifted * 0.82);

    // Ink: Sobel edges of the first screen, drawn on along the sweep.
    vec2 o = texel * 1.4;
    float tl = inkLuma(suv + vec2(-o.x, -o.y));
    float tc = inkLuma(suv + vec2(0.0, -o.y));
    float tr = inkLuma(suv + vec2(o.x, -o.y));
    float ml = inkLuma(suv + vec2(-o.x, 0.0));
    float mr = inkLuma(suv + vec2(o.x, 0.0));
    float bl = inkLuma(suv + vec2(-o.x, o.y));
    float bc = inkLuma(suv + vec2(0.0, o.y));
    float br = inkLuma(suv + vec2(o.x, o.y));
    float gx = (tr + 2.0 * mr + br) - (tl + 2.0 * ml + bl);
    float gy = (bl + 2.0 * bc + br) - (tl + 2.0 * tc + tr);
    float line = smoothstep(0.05, 0.2, length(vec2(gx, gy)));
    float jitter = (hash(floor(uv * vec2(180.0, 120.0))) - 0.5) * 0.06;
    float drawn = 1.0 - smoothstep(ink * 1.25 - 0.12, ink * 1.25 - 0.02, sweep + jitter);
    vec3 sketch = mix(paperColor, inkColor, line * drawn * 0.92);
    float filled = 1.0 - smoothstep(real * 1.3 - 0.16, real * 1.3 - 0.02, sweep);

    vec3 bar = mix(paperColor, menubarColor, filled);
    vec3 content = inBar ? bar : mix(sketch, realColor, filled);

    // The notch is part of the bezel.
    vec2 n = vec2((uv.x - 0.5) * displayAspect, uv.y);
    float notchShape = 1.0 - smoothstep(0.0, 0.002, roundRect(n - vec2(0.0, notch.y * 0.5 - 0.01), vec2(notch.x * 0.5, notch.y * 0.5 + 0.01), 0.008));
    vec3 color = mix(offColor, content * brightness, power);
    color = mix(color, bezelColor, notchShape * step(0.0001, notch.x));

    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`;

export function createScreenMaterial(displayAspect: number, notch: THREE.Vector2) {
  const uniforms: ScreenUniforms = {
    map0: { value: null },
    map1: { value: null },
    map2: { value: null },
    texel: { value: new THREE.Vector2(1 / 2048, 1 / 1456) },
    displayAspect: { value: displayAspect },
    shotAspect: { value: 2880 / 2048 },
    menubar: { value: 0.038 },
    notch: { value: notch },
    screen: { value: 0 },
    power: { value: 1 },
    // A touch under full white, so the scene's primary CTA stays the brightest call to action.
    brightness: { value: 0.9 },
    ink: { value: 1 },
    real: { value: 1 },
    focus: { value: 0 },
    focusRect: { value: new THREE.Vector4(0.5, 0.5, 1, 1) },
    lifted: { value: 0 },
    inkColor: { value: sceneColor("--scene-flable-ink") },
    paperColor: { value: sceneColor("--scene-flable-paper") },
    menubarColor: { value: sceneColor("--scene-screen-menubar") },
    offColor: { value: sceneColor("--scene-device-glass-off") },
    socketColor: { value: sceneColor("--scene-flable-socket") },
    bezelColor: { value: sceneColor("--scene-device-bezel") },
  };
  const material = new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader, toneMapped: false });
  return { material, uniforms };
}
