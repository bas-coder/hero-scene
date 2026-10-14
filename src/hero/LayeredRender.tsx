import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import type { MutableRefObject, ReactNode } from "react";
import * as THREE from "three";
import { sceneColor } from "./sceneColor";

/**
 * How a shot reaches the screen.
 *
 * Layers: the room (a photographic plate, or modelled geometry blurred like a lens wide open), crisp bokeh
 * discs over it, then the desk, the device and its props, sharp.
 *
 * Drawn to Real: the whole shot, not just the screen, starts as a drawing. During the intro every layer
 * renders into one frame, and a single full-frame pass draws it as ink on night paper (edges of the
 * finished frame) along a sweep, then fills it to the real image. Once the shot is real the pass switches
 * off and the layers draw straight to the screen.
 */

export const layer = { desk: 0, room: 1, bokeh: 2 } as const;

/** Puts a subtree on one render layer (lights should stay on every layer). */
export function OnLayer({ value, children }: { value: number; children: ReactNode }) {
  const group = useRef<THREE.Group>(null);
  useLayoutEffect(() => {
    group.current?.traverse((object) => {
      if ((object as THREE.Light).isLight) object.layers.enableAll();
      else object.layers.set(value);
    });
  });
  return <group ref={group}>{children}</group>;
}

const quadVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const blurFragment = /* glsl */ `
  uniform sampler2D map;
  uniform vec2 step;
  varying vec2 vUv;
  void main() {
    // 9-tap Gaussian, sigma about 2 texels.
    vec4 sum = texture2D(map, vUv) * 0.2270270270;
    sum += texture2D(map, vUv + step * 1.3846153846) * 0.3162162162;
    sum += texture2D(map, vUv - step * 1.3846153846) * 0.3162162162;
    sum += texture2D(map, vUv + step * 3.2307692308) * 0.0702702703;
    sum += texture2D(map, vUv - step * 3.2307692308) * 0.0702702703;
    gl_FragColor = sum;
  }
`;

const compositeFragment = /* glsl */ `
  uniform sampler2D map;
  varying vec2 vUv;
  void main() {
    gl_FragColor = texture2D(map, vUv);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/** The finished frame as a drawing: ink edges and soft graphite on night paper, drawn on and then filled. */
const drawnFragment = /* glsl */ `
  uniform sampler2D map;
  uniform vec2 texel;
  uniform float ink;
  uniform float real;
  uniform vec3 paper;
  uniform vec3 inkColor;
  uniform vec3 shade;
  varying vec2 vUv;

  vec3 finished(vec2 uv) {
    vec3 color = texture2D(map, uv).rgb;
    #ifdef TONE_MAPPING
      color = toneMapping(color);
    #endif
    return color;
  }
  float luma(vec2 uv) { return dot(finished(uv), vec3(0.299, 0.587, 0.114)); }
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

  void main() {
    vec2 o = texel * 1.5;
    float tl = luma(vUv + vec2(-o.x, o.y));
    float tc = luma(vUv + vec2(0.0, o.y));
    float tr = luma(vUv + vec2(o.x, o.y));
    float ml = luma(vUv + vec2(-o.x, 0.0));
    float mr = luma(vUv + vec2(o.x, 0.0));
    float bl = luma(vUv + vec2(-o.x, -o.y));
    float bc = luma(vUv + vec2(0.0, -o.y));
    float br = luma(vUv + vec2(o.x, -o.y));
    float gx = (tr + 2.0 * mr + br) - (tl + 2.0 * ml + bl);
    float gy = (tl + 2.0 * tc + tr) - (bl + 2.0 * bc + br);
    float line = smoothstep(0.035, 0.16, length(vec2(gx, gy)));

    vec3 real3 = finished(vUv);
    float light = dot(real3, vec3(0.299, 0.587, 0.114));
    // Diagonal sweep from the top right; a little grain so the drawn edge is a hand's, not a ruler's.
    float sweep = (1.0 - vUv.x) * 0.55 + (1.0 - vUv.y) * 0.45;
    float jitter = (hash(floor(gl_FragCoord.xy / 3.0)) - 0.5) * 0.05;
    float drawn = 1.0 - smoothstep(ink * 1.25 - 0.12, ink * 1.25 - 0.02, sweep + jitter);
    float filled = 1.0 - smoothstep(real * 1.3 - 0.16, real * 1.3 - 0.02, sweep + jitter * 0.5);

    // Lit areas take a little lilac graphite, so the drawing has form before the colour arrives.
    vec3 sketch = mix(paper, shade, light * 0.35 * drawn);
    sketch = mix(sketch, inkColor, line * drawn * 0.9);
    gl_FragColor = vec4(mix(sketch, real3, filled), 1.0);
    #include <colorspace_fragment>
  }
`;

function target(width: number, height: number) {
  return new THREE.WebGLRenderTarget(Math.max(1, width), Math.max(1, height), {
    type: THREE.HalfFloatType,
    depthBuffer: true,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
  });
}

export interface DrawnState {
  /** Ink drawn on, 0 → 1. */
  ink: number;
  /** Ink filled to the real image, 0 → 1. */
  real: number;
}

export function LayeredRender({ blur, drawn }: { blur: boolean; drawn: MutableRefObject<DrawnState> }) {
  const { gl, scene, camera, size, viewport } = useThree();
  const quad = useMemo(() => {
    const geometry = new THREE.PlaneGeometry(2, 2);
    const blurMaterial = new THREE.ShaderMaterial({ uniforms: { map: { value: null }, step: { value: new THREE.Vector2() } }, vertexShader: quadVertex, fragmentShader: blurFragment, depthTest: false, depthWrite: false });
    const compositeMaterial = new THREE.ShaderMaterial({ uniforms: { map: { value: null } }, vertexShader: quadVertex, fragmentShader: compositeFragment, depthTest: false, depthWrite: false, toneMapped: true });
    const drawnMaterial = new THREE.ShaderMaterial({
      uniforms: {
        map: { value: null },
        texel: { value: new THREE.Vector2() },
        ink: { value: 0 },
        real: { value: 0 },
        paper: { value: sceneColor("--scene-sketch-paper") },
        inkColor: { value: sceneColor("--scene-sketch-ink") },
        shade: { value: sceneColor("--scene-sketch-shade") },
      },
      vertexShader: quadVertex,
      fragmentShader: drawnFragment,
      depthTest: false,
      depthWrite: false,
      toneMapped: true,
    });
    const mesh = new THREE.Mesh(geometry, blurMaterial);
    mesh.frustumCulled = false;
    const quadScene = new THREE.Scene();
    quadScene.add(mesh);
    return { mesh, quadScene, quadCamera: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), blurMaterial, compositeMaterial, drawnMaterial };
  }, []);

  const targets = useMemo(() => {
    const full = { w: Math.round(size.width * viewport.dpr), h: Math.round(size.height * viewport.dpr) };
    const quarter = { w: Math.round(full.w / 4), h: Math.round(full.h / 4) };
    return { room: target(quarter.w, quarter.h), a: target(quarter.w, quarter.h), b: target(quarter.w, quarter.h), frame: target(full.w, full.h), quarter, full };
  }, [size.width, size.height, viewport.dpr]);

  useEffect(
    () => () => {
      targets.room.dispose();
      targets.a.dispose();
      targets.b.dispose();
      targets.frame.dispose();
    },
    [targets],
  );

  const pass = (input: THREE.Texture, output: THREE.WebGLRenderTarget, x: number, y: number) => {
    quad.mesh.material = quad.blurMaterial;
    quad.blurMaterial.uniforms.map.value = input;
    quad.blurMaterial.uniforms.step.value.set(x / targets.quarter.w, y / targets.quarter.h);
    gl.setRenderTarget(output);
    gl.render(quad.quadScene, quad.quadCamera);
  };

  useFrame(() => {
    const autoClear = gl.autoClear;
    gl.autoClear = false;
    const { ink, real } = drawn.current;
    // While the shot is still a drawing, every layer goes into one frame for the drawing pass.
    const drawing = real < 0.999;
    const out = drawing ? targets.frame : null;

    // 1. The room: a plate as it is, or modelled geometry softened like an out-of-focus background.
    camera.layers.set(layer.room);
    if (blur) {
      gl.setRenderTarget(targets.room);
      gl.clear();
      gl.render(scene, camera);
      pass(targets.room.texture, targets.a, 1, 0);
      pass(targets.a.texture, targets.b, 0, 1);
      pass(targets.b.texture, targets.a, 2.2, 0);
      pass(targets.a.texture, targets.b, 0, 2.2);
      pass(targets.b.texture, targets.a, 3.6, 0);
      pass(targets.a.texture, targets.b, 0, 3.6);
      gl.setRenderTarget(out);
      gl.clear();
      quad.mesh.material = quad.compositeMaterial;
      quad.compositeMaterial.uniforms.map.value = targets.b.texture;
      gl.render(quad.quadScene, quad.quadCamera);
    } else {
      gl.setRenderTarget(out);
      gl.clear();
      gl.render(scene, camera);
    }

    // 2. Bokeh discs, crisp like a lens draws them.
    camera.layers.set(layer.bokeh);
    gl.render(scene, camera);

    // 3. The desk, the device and the props, sharp.
    gl.clearDepth();
    camera.layers.set(layer.desk);
    gl.render(scene, camera);

    // 4. Drawn to Real, over the whole frame.
    if (drawing) {
      gl.setRenderTarget(null);
      gl.clear();
      quad.mesh.material = quad.drawnMaterial;
      const u = quad.drawnMaterial.uniforms;
      u.map.value = targets.frame.texture;
      u.texel.value.set(1 / targets.full.w, 1 / targets.full.h);
      u.ink.value = ink;
      u.real.value = real;
      gl.render(quad.quadScene, quad.quadCamera);
    }

    gl.autoClear = autoClear;
  }, 1);

  return null;
}
