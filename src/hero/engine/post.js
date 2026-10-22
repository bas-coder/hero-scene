import * as THREE from "three";

/**
 * Hand-written post chain (Meng's rule: tone-map once, by hand; post never hides weak materials).
 *   scene → HalfFloat target (linear HDR; MSAA on the high tier)
 *   bloom: bright pass at half resolution → dual-filter (Kawase) down/up chain, light enough for an HD 4000
 *   composite: + bloom → exposure → ACES once → shot grade (lift / gamma / gain / saturation) → vignette →
 *              Drawn to Real (intro only) → grain → sRGB → dither
 * The screen writes alpha 0 into the HDR target (screen.js): there the composite skips tone mapping and grade,
 * so the product UI keeps its shipped colours and only the camera's vignette and bloom touch it.
 */

const fullscreenVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const brightFragment = /* glsl */ `
  uniform sampler2D source;
  uniform float threshold;
  uniform float knee;
  varying vec2 vUv;
  void main() {
    vec3 c = texture2D(source, vUv).rgb;
    float b = max(c.r, max(c.g, c.b));
    // Soft knee: everything above threshold, eased in over the knee.
    float soft = clamp(b - threshold + knee, 0.0, 2.0 * knee);
    soft = soft * soft / (4.0 * knee + 1e-4);
    float contribution = max(soft, b - threshold) / max(b, 1e-4);
    gl_FragColor = vec4(c * contribution, 1.0);
  }
`;

const downFragment = /* glsl */ `
  uniform sampler2D source;
  uniform vec2 texel;
  varying vec2 vUv;
  void main() {
    vec3 sum = texture2D(source, vUv).rgb * 4.0;
    sum += texture2D(source, vUv - texel).rgb;
    sum += texture2D(source, vUv + texel).rgb;
    sum += texture2D(source, vUv + vec2(texel.x, -texel.y)).rgb;
    sum += texture2D(source, vUv - vec2(texel.x, -texel.y)).rgb;
    gl_FragColor = vec4(sum / 8.0, 1.0);
  }
`;

const upFragment = /* glsl */ `
  uniform sampler2D source;
  uniform vec2 texel;
  uniform float weight;
  varying vec2 vUv;
  void main() {
    vec3 sum = texture2D(source, vUv + vec2(-texel.x * 2.0, 0.0)).rgb;
    sum += texture2D(source, vUv + vec2(-texel.x, texel.y)).rgb * 2.0;
    sum += texture2D(source, vUv + vec2(0.0, texel.y * 2.0)).rgb;
    sum += texture2D(source, vUv + vec2(texel.x, texel.y)).rgb * 2.0;
    sum += texture2D(source, vUv + vec2(texel.x * 2.0, 0.0)).rgb;
    sum += texture2D(source, vUv + vec2(texel.x, -texel.y)).rgb * 2.0;
    sum += texture2D(source, vUv + vec2(0.0, -texel.y * 2.0)).rgb;
    sum += texture2D(source, vUv + vec2(-texel.x, -texel.y)).rgb * 2.0;
    // Each coarser level adds in at a fraction: the glow hugs its source instead of hazing the objects around it.
    gl_FragColor = vec4(sum / 12.0 * weight, 1.0);
  }
`;

const compositeFragment = /* glsl */ `
  uniform sampler2D scene;
  uniform sampler2D bloom;
  uniform float bloomStrength;
  uniform float exposure;
  uniform vec3 lift;
  uniform vec3 gamma;
  uniform vec3 gain;
  uniform float saturation;
  uniform float vignette;
  uniform float grain;
  uniform float seed;
  uniform vec2 resolution;
  // Drawn to Real (the intro): the finished frame as ink on night paper along a sweep, then filled to the real.
  uniform float ink;
  uniform float real;
  uniform vec3 paper;
  uniform vec3 inkColor;
  uniform vec3 shade;
  varying vec2 vUv;

  vec3 aces(vec3 x) {
    return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
  }
  float hash(vec2 p) {
    p = fract(p * vec2(443.897, 441.423));
    p += dot(p, p.yx + 19.19);
    return fract((p.x + p.y) * p.x);
  }
  // Luminance squeezed into 0–1 (Reinhard), for the ink's edge detection on the HDR frame.
  float sketchLuma(vec3 c) {
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    return l / (1.0 + l);
  }
  // Sobel edge strength at a tap offset o (UV), on the HDR frame's compressed luminance.
  float sobel(vec2 o) {
    #define L(d) sketchLuma(texture2D(scene, vUv + d).rgb * exposure)
    float tl = L(vec2(-o.x, o.y));
    float tc = L(vec2(0.0, o.y));
    float tr = L(vec2(o.x, o.y));
    float ml = L(vec2(-o.x, 0.0));
    float mr = L(vec2(o.x, 0.0));
    float bl = L(vec2(-o.x, -o.y));
    float bc = L(vec2(0.0, -o.y));
    float br = L(vec2(o.x, -o.y));
    #undef L
    float gx = (tr + 2.0 * mr + br) - (tl + 2.0 * ml + bl);
    float gy = (tl + 2.0 * tc + tr) - (bl + 2.0 * bc + br);
    return length(vec2(gx, gy));
  }
  vec3 toSRGB(vec3 c) {
    return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
  }

  void main() {
    vec4 hdr = texture2D(scene, vUv);
    vec3 glow = texture2D(bloom, vUv).rgb * bloomStrength;
    float screenMask = 1.0 - hdr.a;

    // The world: exposure, ACES once, then the shot's grade.
    // The shot's gain tints the light before the tone curve, so highlights roll off instead of clipping.
    vec3 world = aces((hdr.rgb + glow) * exposure * gain);
    world = pow(max(world + lift * (1.0 - world), 0.0), 1.0 / gamma);
    float luma = dot(world, vec3(0.2126, 0.7152, 0.0722));
    world = mix(vec3(luma), world, saturation);

    // The screen: shipped colours, plus the bloom its neighbours throw onto it.
    vec3 ui = clamp(hdr.rgb + glow * exposure * 0.35, 0.0, 1.0);
    vec3 color = mix(world, ui, screenMask);

    // Lens: vignette on everything (it is the camera).
    vec2 centred = vUv - 0.5;
    centred.x *= resolution.x / resolution.y;
    // A lens falloff to near black at the corners (the frame's edges darken; the centre stays clear).
    color *= mix(1.0, smoothstep(1.05, 0.3, length(centred)), vignette);

    // Drawn to Real: ink edges (Sobel on the frame's compressed luminance) and soft graphite on night paper,
    // drawn on along a diagonal sweep from the top right, then filled to the real frame. Off once real.
    if (real < 0.999) {
      vec2 o = 1.0 / resolution;
      // Only geometry inks (alpha 1): the screen and the room plate (alpha 0) take the graphite wash, never
      // edge scribbles. An edge must hold at 1 px and at 3 px: silhouettes do, texture flecks (speckle, leather,
      // key legends) only show at 1 px, so they never ink.
      float edge = min(sobel(o), sobel(o * 3.0));
      float line = smoothstep(0.16, 0.34, edge) * smoothstep(0.5, 1.0, hdr.a);
      float light = dot(color, vec3(0.2126, 0.7152, 0.0722));
      // A soft, low-frequency wobble on the sweep's edge, so it is drawn by a hand, not a ruler (never grain).
      float sweep = (1.0 - vUv.x) * 0.55 + (1.0 - vUv.y) * 0.45;
      float jitter = (sin(vUv.x * 23.0 + vUv.y * 7.0) * 0.5 + sin(vUv.y * 31.0 - vUv.x * 11.0) * 0.3 + sin((vUv.x + vUv.y) * 57.0) * 0.2) * 0.02;
      float drawn = 1.0 - smoothstep(ink * 1.25 - 0.12, ink * 1.25 - 0.02, sweep + jitter);
      float filled = 1.0 - smoothstep(real * 1.3 - 0.16, real * 1.3 - 0.02, sweep + jitter * 0.5);
      vec3 sketch = mix(paper, shade, clamp(light, 0.0, 1.0) * 0.35 * drawn);
      sketch = mix(sketch, inkColor, line * drawn * 0.9);
      // Only light sources glow through the drawing (the bulb lights first); lit surfaces stay ink on black.
      sketch = mix(sketch, color, smoothstep(0.82, 0.98, light) * hdr.a);
      color = mix(sketch, color, filled);
    }

    color = toSRGB(clamp(color, 0.0, 1.0));
    // Fine luminance grain in display space, on the world only, fading out in the blacks so dark stays clean.
    float shown = dot(color, vec3(0.2126, 0.7152, 0.0722));
    float n = hash(vUv * resolution + seed) + hash(vUv * resolution * 0.73 + seed + 3.1) - 1.0;
    color += n * grain * (1.0 - screenMask) * smoothstep(0.03, 0.2, shown) * (1.0 - 0.6 * shown);
    // Triangular dither against banding in dark gradients and bloom halos.
    color += (hash(vUv * resolution * 1.37 + seed + 7.0) + hash(vUv * resolution * 0.91 + seed + 11.0) - 1.0) * 1.5 / 255.0;
    gl_FragColor = vec4(color, 1.0);
  }
`;

function pass(fragmentShader, uniforms) {
  return new THREE.ShaderMaterial({ vertexShader: fullscreenVertex, fragmentShader, uniforms, depthTest: false, depthWrite: false });
}

export function createPost(renderer, { quality }) {
  const half = THREE.HalfFloatType;
  const scene = new THREE.WebGLRenderTarget(1, 1, { type: half, samples: quality === "low" ? 0 : 4 });
  const levels = quality === "low" ? 3 : 4;
  const bright = new THREE.WebGLRenderTarget(1, 1, { type: half });
  const chain = Array.from({ length: levels }, () => new THREE.WebGLRenderTarget(1, 1, { type: half }));
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
  const stage = new THREE.Scene();
  stage.add(quad);

  const brightPass = pass(brightFragment, { source: { value: null }, threshold: { value: 1 }, knee: { value: 0.5 } });
  const downPass = pass(downFragment, { source: { value: null }, texel: { value: new THREE.Vector2() } });
  const upPass = pass(upFragment, { source: { value: null }, texel: { value: new THREE.Vector2() }, weight: { value: 0.42 } });
  upPass.blending = THREE.AdditiveBlending;
  const composite = pass(compositeFragment, {
    scene: { value: scene.texture },
    bloom: { value: null },
    bloomStrength: { value: 0.4 },
    exposure: { value: 1 },
    lift: { value: new THREE.Vector3() },
    gamma: { value: new THREE.Vector3(1, 1, 1) },
    gain: { value: new THREE.Vector3(1, 1, 1) },
    saturation: { value: 1 },
    vignette: { value: 0.3 },
    grain: { value: 0.02 },
    seed: { value: 0 },
    resolution: { value: new THREE.Vector2(1, 1) },
    ink: { value: 1 },
    real: { value: 1 },
    paper: { value: new THREE.Color() },
    inkColor: { value: new THREE.Color() },
    shade: { value: new THREE.Color() },
  });

  // `add` keeps the target's contents (the up pass sums each level onto the next finer one, so the bloom keeps a
  // tight core around emitters plus a faint wide skirt, instead of only the widest blur).
  const draw = (material, target, add = false) => {
    quad.material = material;
    renderer.setRenderTarget(target);
    const autoClear = renderer.autoClear;
    renderer.autoClear = !add;
    renderer.render(stage, camera);
    renderer.autoClear = autoClear;
  };

  return {
    target: scene,
    setSize(width, height) {
      scene.setSize(width, height);
      let w = Math.max(1, Math.round(width / 2));
      let h = Math.max(1, Math.round(height / 2));
      bright.setSize(w, h);
      for (const level of chain) {
        w = Math.max(1, Math.round(w / 2));
        h = Math.max(1, Math.round(h / 2));
        level.setSize(w, h);
      }
      composite.uniforms.resolution.value.set(width, height);
    },
    /**
     * grade: { exposure, lift[3], gamma[3], gain[3], saturation, vignette, grain, bloom: { threshold, knee, strength } }
     * drawn: { ink, real, sketch: { paper, ink, shade } } (the intro's Drawn to Real; real = 1 switches it off)
     */
    render(world, view, grade, seed = 0, light = 1, drawn = null) {
      renderer.setRenderTarget(scene);
      renderer.clear();
      renderer.render(world, view);

      brightPass.uniforms.source.value = scene.texture;
      brightPass.uniforms.threshold.value = grade.bloom.threshold;
      brightPass.uniforms.knee.value = grade.bloom.knee;
      draw(brightPass, bright);
      let source = bright;
      for (const level of chain) {
        downPass.uniforms.source.value = source.texture;
        downPass.uniforms.texel.value.set(0.5 / source.width, 0.5 / source.height);
        draw(downPass, level);
        source = level;
      }
      for (let i = chain.length - 1; i > 0; i -= 1) {
        upPass.uniforms.source.value = chain[i].texture;
        upPass.uniforms.texel.value.set(0.5 / chain[i].width, 0.5 / chain[i].height);
        draw(upPass, chain[i - 1], true);
      }

      const u = composite.uniforms;
      u.bloom.value = chain[0].texture;
      u.bloomStrength.value = grade.bloom.strength;
      u.exposure.value = grade.exposure;
      // The shot's lift arrives with its light, so the unlit world stays true black.
      u.lift.value.fromArray(grade.lift).multiplyScalar(light);
      u.gamma.value.fromArray(grade.gamma);
      u.gain.value.fromArray(grade.gain);
      u.saturation.value = grade.saturation;
      u.vignette.value = grade.vignette;
      u.grain.value = grade.grain;
      u.seed.value = seed;
      u.ink.value = drawn?.ink ?? 1;
      u.real.value = drawn?.real ?? 1;
      if (drawn?.sketch) {
        u.paper.value.set(drawn.sketch.paper);
        u.inkColor.value.set(drawn.sketch.ink);
        u.shade.value.set(drawn.sketch.shade);
      }
      draw(composite, null);
    },
    dispose() {
      [scene, bright, ...chain].forEach((target) => target.dispose());
      [brightPass, downPass, upPass, composite].forEach((material) => material.dispose());
      quad.geometry.dispose();
    },
  };
}
