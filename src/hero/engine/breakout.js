import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { screenToDisplay } from "./device.js";
import { returnKey } from "./laptop.js";

/**
 * The breakout beat (ported from the old Breakout.tsx): one dense row of the dashboard leaves the screen and
 * becomes the clear answer. The tiles copy their pixels from the screen texture itself, so they always match
 * the shipped UI. Assembled they are the KPI card; fanned, each metric stands alone and the lead one comes
 * forward. They hang on the display anchor (scene units on the glass: x right, y up, z out of the glass).
 *
 * Tiles keep the UI's exact colours: they write into the screen's untone-mapped path (alpha 0 in the HDR target,
 * as the screen does) through a blend that clears alpha where they are opaque. Their halos and shadow are lit
 * world, colours from the dressing.
 */

const tileVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const tileFragment = /* glsl */ `
  uniform sampler2D map;
  uniform vec4 rect;
  uniform vec2 size;
  uniform vec4 radii;
  uniform float opacity;
  uniform float rim;
  uniform vec3 rimColor;
  varying vec2 vUv;

  float corner(vec2 p, vec2 halfSize, vec4 r) {
    // r: top-left, top-right, bottom-right, bottom-left
    float radius = p.x < 0.0 ? (p.y > 0.0 ? r.x : r.w) : (p.y > 0.0 ? r.y : r.z);
    vec2 q = abs(p) - halfSize + radius;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
  }

  void main() {
    // Screen UV with y from the top; textures load flipped, so v = 1 - y.
    vec2 sv = vec2(mix(rect.x, rect.z, vUv.x), mix(rect.y, rect.w, 1.0 - vUv.y));
    vec3 color = texture2D(map, vec2(sv.x, 1.0 - sv.y), -0.5).rgb;
    vec2 p = (vUv - 0.5) * size;
    float d = corner(p, size * 0.5, radii);
    float alpha = 1.0 - smoothstep(-0.004, 0.0, d);
    float edge = smoothstep(-0.03, -0.004, d) * rim;
    color = mix(color, rimColor, edge * 0.55);
    // Lifted, a tile is lit from above: its lower half falls off a little (the UI's pixels stay exact flat).
    color *= mix(1.0, mix(0.86, 1.0, vUv.y), rim);
    gl_FragColor = vec4(color, alpha * opacity);
    #include <colorspace_fragment>
  }
`;

const shadowFragment = /* glsl */ `
  uniform vec2 size;
  uniform vec2 plane;
  uniform float softness;
  uniform float opacity;
  uniform vec3 shade;
  varying vec2 vUv;
  void main() {
    vec2 p = (vUv - 0.5) * plane;
    vec2 q = abs(p) - size * 0.5;
    float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
    float a = 1.0 - smoothstep(-softness * 0.4, softness, d);
    gl_FragColor = vec4(shade, a * opacity);
  }
`;

/** Rect (screen UV, y from the top) → centre and size on the display, in scene units. */
function onDisplay({ x0, y0, x1, y1 }) {
  const a = screenToDisplay(x0, y0);
  const b = screenToDisplay(x1, y1);
  return { centre: new THREE.Vector2((a.x + b.x) / 2, (a.y + b.y) / 2), size: new THREE.Vector2(Math.abs(b.x - a.x), Math.abs(b.y - a.y)) };
}

/**
 * Builds the tiles for a shot's breakout on the display anchor. `look` is the dressing (tile, tileHalo,
 * tileShadow colours). Returns { group, update(lift, fan) }.
 */
function shadowMaterial(size, look) {
  return new THREE.ShaderMaterial({
    uniforms: {
      size: { value: size.clone() },
      plane: { value: new THREE.Vector2(size.x + 0.3, size.y + 0.3) },
      softness: { value: 0.05 },
      opacity: { value: 0 },
      shade: { value: new THREE.Color(look.tileShadow) },
    },
    vertexShader: tileVertex,
    fragmentShader: shadowFragment,
    transparent: true,
    depthWrite: false,
  });
}

export function createBreakout({ display, breakout, texture, look, spec }) {
  const { rect, dividers, lead } = breakout;
  const group = new THREE.Group();
  display.add(group);

  const strip = onDisplay(rect);
  // Toward the right bezel (the left of the frame is the headline's side), its end just reaching the bezel so
  // the last tile never hangs in the air past the laptop.
  const overhang = spec.display.width / 2 + strip.size.x * 0.02 - (strip.centre.x + strip.size.x / 2);
  const rise = 0.05;
  const depth = 0.42;
  const spread = 0.22;
  const cornerRadius = strip.size.y * 0.09;

  const edges = [rect.x0, ...dividers, rect.x1];
  const tiles = edges.slice(0, -1).map((x0, index) => {
    const tileRect = { x0, y0: rect.y0, x1: edges[index + 1], y1: rect.y1 };
    const { centre, size } = onDisplay(tileRect);
    const material = new THREE.ShaderMaterial({
      uniforms: {
        map: { value: texture },
        rect: { value: new THREE.Vector4(tileRect.x0, tileRect.y0, tileRect.x1, tileRect.y1) },
        size: { value: size.clone() },
        radii: { value: new THREE.Vector4() },
        opacity: { value: 0 },
        rim: { value: 0 },
        rimColor: { value: new THREE.Color(look.tile) },
      },
      vertexShader: tileVertex,
      fragmentShader: tileFragment,
      transparent: true,
      depthWrite: false,
      // Colour blends over the scene; alpha (the screen mask) clears where the tile is opaque.
      blending: THREE.CustomBlending,
      blendSrc: THREE.SrcAlphaFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.ZeroFactor,
      blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    });
    const halo = new THREE.MeshBasicMaterial({ color: new THREE.Color(look.tileHalo), transparent: true, opacity: 0, depthWrite: false });
    const holder = new THREE.Group();
    const back = new THREE.Mesh(new THREE.PlaneGeometry(size.x, size.y), halo);
    back.position.set(0.008, -0.012, -0.006);
    back.renderOrder = 4;
    const face = new THREE.Mesh(new THREE.PlaneGeometry(size.x, size.y), material);
    face.renderOrder = 5;
    holder.add(back, face);
    holder.visible = false;
    group.add(holder);
    // Each tile's own soft shadow on the screen it left.
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(size.x + 0.3, size.y + 0.3), shadowMaterial(size, look));
    shadow.renderOrder = 3;
    shadow.visible = false;
    group.add(shadow);
    return { centre, size, index, holder, material, halo, shadow };
  });


  const last = tiles.length - 1;
  return {
    group,
    /** lift: out of the screen (0 → 1); fan: apart, the lead forward (0 → 1). */
    update(lift, fan) {
      const visible = lift > 0.002;
      for (const tile of tiles) {
        tile.holder.visible = visible;
        tile.shadow.visible = visible;
        if (!visible) continue;
        const i = tile.index;
        const distance = Math.abs(i - lead);
        const across = ((i - last / 2) / (last / 2)) * spread * fan;
        tile.holder.position.set(
          tile.centre.x + overhang * lift + across,
          tile.centre.y + lift * rise + fan * (0.04 - distance * 0.014),
          0.006 + lift * depth + fan * (0.26 - distance * 0.08),
        );
        tile.holder.rotation.set(lift * 0.16, lift * 0.22, 0);
        tile.holder.scale.setScalar(1 + lift * 0.04 + (i === lead ? fan * 0.2 : -fan * distance * 0.025));
        // The shadow lies on the glass under the tile, drifting down-right and softening as it rises.
        const height = tile.holder.position.z;
        tile.shadow.position.set(tile.holder.position.x + height * 0.18, tile.holder.position.y - height * 0.28, 0.004);
        tile.shadow.material.uniforms.opacity.value = 0.42 * lift;
        tile.shadow.material.uniforms.softness.value = 0.03 + height * 0.2;
        const r = cornerRadius;
        const outerLeft = i === 0 ? r : r * fan;
        const outerRight = i === last ? r : r * fan;
        tile.material.uniforms.radii.value.set(outerLeft, outerRight, outerRight, outerLeft);
        tile.material.uniforms.opacity.value = Math.min(1, lift * 3);
        tile.material.uniforms.rim.value = lift;
        tile.halo.opacity = Math.min(1, lift * 2) * 0.9;
      }
    },
  };
}

/**
 * The case study lives under one key (ported from CaseKey.tsx): the Return key turns into a light keycap that
 * breathes softly so it is found, rises on hover (the DOM tooltip is the page's), and opens the case study on
 * click. Colours from the dressing (key, keyGlow). Returns { group, update(delta, time, hovered) }.
 */
/** The Return legend (a physical key's print): a ↵ glyph, grey on transparent. */
function legendTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 64;
  const context = canvas.getContext("2d");
  const ink = new THREE.Color().setRGB(0.42, 0.42, 0.45, THREE.SRGBColorSpace).getStyle();
  context.strokeStyle = ink;
  context.fillStyle = ink;
  context.lineWidth = 5;
  context.lineCap = "round";
  context.lineJoin = "round";
  // The return arrow: down from the top right, then left, with an arrowhead.
  context.beginPath();
  context.moveTo(94, 16);
  context.lineTo(94, 40);
  context.lineTo(40, 40);
  context.stroke();
  context.beginPath();
  context.moveTo(30, 40);
  context.lineTo(44, 30);
  context.lineTo(44, 50);
  context.closePath();
  context.fill();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

export function createCaseKey({ base, look }) {
  const press = 0.006;
  const material = new THREE.MeshStandardMaterial({ color: new THREE.Color(look.key), emissive: new THREE.Color(look.keyGlow), emissiveIntensity: 0.15, roughness: 0.4 });
  // A real keycap: rounded edges that catch a highlight, with its legend printed on top.
  const cap = new THREE.Mesh(new RoundedBoxGeometry(returnKey.width, 0.02, returnKey.depth, 4, 0.0095), material);
  cap.position.set(returnKey.x, returnKey.y + press, returnKey.z);
  cap.castShadow = cap.receiveShadow = true;
  const legend = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.05), new THREE.MeshStandardMaterial({ map: legendTexture(), transparent: true, roughness: 0.5, depthWrite: false }));
  legend.rotation.x = -Math.PI / 2;
  legend.position.set(returnKey.width * 0.22, 0.0102, returnKey.depth * 0.12);
  cap.add(legend);
  base.add(cap);
  return {
    cap,
    update(delta, time, hovered) {
      // A slow breath every few seconds, held steady while hovered.
      const breath = Math.max(0, Math.sin(time * 1.4)) ** 6;
      material.emissiveIntensity = THREE.MathUtils.damp(material.emissiveIntensity, hovered ? 0.8 : 0.08 + breath * 0.4, 8, delta);
      cap.position.y = THREE.MathUtils.damp(cap.position.y, returnKey.y + (hovered ? 0.002 : 0.002 + press), 18, delta);
    },
  };
}
