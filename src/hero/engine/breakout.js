import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { screenToDisplay } from "./device.js";
import { returnKey } from "./laptop.js";
import { keepMask } from "./world.js";

/**
 * The breakout beat (ported from the old Breakout.tsx): one dense row of the dashboard leaves the screen and
 * becomes the clear answer. The tiles copy their pixels from the screen texture itself, so they always match
 * the shipped UI. Assembled they are the KPI card; fanned, each metric stands alone and the lead one comes
 * forward. They hang on the display anchor (scene units on the glass: x right, y up, z out of the glass).
 *
 * Tiles keep the UI's exact colours: they write into the screen's untone-mapped path (alpha 0 in the HDR target,
 * as the screen does) through a blend that clears alpha where they are opaque. Their shadows on the glass are
 * lit world, colours from the dressing.
 */

/** Signed distance to a rectangle with its own radius per corner (negative inside). */
const cornerChunk = /* glsl */ `
  float corner(vec2 p, vec2 halfSize, vec4 r) {
    // r: top-left, top-right, bottom-right, bottom-left
    float radius = p.x < 0.0 ? (p.y > 0.0 ? r.x : r.w) : (p.y > 0.0 ? r.y : r.z);
    vec2 q = abs(p) - halfSize + radius;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
  }
`;

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
  uniform vec4 crop; // the texture's own rect on the screen (screen UV, y from the top)
  uniform vec2 size;
  uniform vec4 radii;
  uniform float opacity;
  uniform float rim;
  uniform float glow;
  uniform vec3 rimColor;
  uniform vec3 tileLight;
  varying vec2 vUv;
  ${cornerChunk}

  void main() {
    // Screen UV with y from the top; textures load flipped, so v = 1 - y.
    vec2 sv = vec2(mix(rect.x, rect.z, vUv.x), mix(rect.y, rect.w, 1.0 - vUv.y));
    vec2 cv = (sv - crop.xy) / (crop.zw - crop.xy);
    vec3 color = texture2D(map, vec2(cv.x, 1.0 - cv.y), -0.5).rgb;
    vec2 p = (vUv - 0.5) * size;
    float d = corner(p, size * 0.5, radii);
    float alpha = 1.0 - smoothstep(-0.004, 0.0, d);
    // The rim catches more light while the tile is hovered.
    float edge = smoothstep(-0.03, -0.004, d) * rim;
    color = mix(color, rimColor, edge * (0.55 + 0.35 * glow));
    // Lifted, a tile takes the room's light, near neutral (it is the hero of the beat, so it stays the crispest,
    // whitest thing in frame), falling off a touch toward its lower edge.
    color *= mix(vec3(1.0), tileLight * mix(0.95, 1.0, vUv.y), rim);
    gl_FragColor = vec4(color, alpha * opacity);
    #include <colorspace_fragment>
  }
`;

const shadowVertex = /* glsl */ `
  uniform mat4 toDisplay;
  varying vec2 vUv;
  varying vec3 vLocal;
  void main() {
    vUv = uv;
    vLocal = (toDisplay * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const shadowFragment = /* glsl */ `
  uniform vec2 size;
  uniform vec2 plane;
  uniform vec4 radii;
  uniform float softness;
  uniform float opacity;
  uniform vec3 shade;
  uniform vec4 lid; // the lid's face on the display plane (x0, y0, x1, y1); empty = no clip
  uniform vec3 eyeLocal;
  varying vec2 vUv;
  varying vec3 vLocal;
  ${cornerChunk}
  void main() {
    vec2 p = (vUv - 0.5) * plane;
    float d = corner(p, size * 0.5, radii);
    float a = 1.0 - smoothstep(-softness * 0.4, softness, d);
    if (lid.z > lid.x) {
      // The point of the lid seen behind this fragment: past the lid there is only the far room, which a card a
      // hand's width off the screen can't shade, so the shadow ends at the lid's edge.
      vec2 q = eyeLocal.xy + (vLocal.xy - eyeLocal.xy) * eyeLocal.z / max(1e-4, eyeLocal.z - vLocal.z);
      vec2 inside = min(q - lid.xy, lid.zw - q);
      a *= smoothstep(0.0, 0.03, min(inside.x, inside.y));
    }
    gl_FragColor = vec4(shade, a * opacity);
  }
`;

/**
 * A small spring (stiffness k, damping ratio zeta): quick, with a slight overshoot, so a hovered tile settles
 * like something with mass. Fixed substeps keep it stable at any frame time.
 */
function spring(state, target, delta, k = 260, zeta = 0.62) {
  const damping = 2 * Math.sqrt(k) * zeta;
  let left = Math.min(delta, 0.1);
  while (left > 0) {
    const dt = Math.min(left, 1 / 120);
    state.v += (k * (target - state.x) - damping * state.v) * dt;
    state.x += state.v * dt;
    left -= dt;
  }
  return state.x;
}

/** Rect (screen UV, y from the top) → centre and size on the display, in scene units. */
function onDisplay({ x0, y0, x1, y1 }) {
  const a = screenToDisplay(x0, y0);
  const b = screenToDisplay(x1, y1);
  return { centre: new THREE.Vector2((a.x + b.x) / 2, (a.y + b.y) / 2), size: new THREE.Vector2(Math.abs(b.x - a.x), Math.abs(b.y - a.y)) };
}

/** A card's soft drop shadow (`look` is the dressing: tileShadow). */
function shadowMaterial(size, look) {
  return new THREE.ShaderMaterial({
    uniforms: {
      size: { value: size.clone() },
      plane: { value: new THREE.Vector2(size.x + 0.3, size.y + 0.3) },
      radii: { value: new THREE.Vector4() },
      softness: { value: 0.05 },
      opacity: { value: 0 },
      shade: { value: new THREE.Color(look.tileShadow) },
      lid: { value: new THREE.Vector4() },
      eyeLocal: { value: new THREE.Vector3() },
      toDisplay: { value: new THREE.Matrix4() },
    },
    vertexShader: shadowVertex,
    fragmentShader: shadowFragment,
    transparent: true,
    depthWrite: false,
    // On the screen's ungraded path: the shadow darkens the UI without pulling it into the graded world.
    ...keepMask,
  });
}

/**
 * Builds one breakout (a shot.breakouts entry) on the display anchor. `texture` holds its pixels (the screen texture,
 * or a detail crop whose screen rect is `crop`). `radius` is its card's corner on the display (scene units): every
 * lifted tile and its shadow take it on all four corners. `look` is the dressing (tile, tileLight, tileShadow).
 * Returns { group, corners(), pick(raycaster), update(lift, fan, delta, hover, eye) }.
 */
export function createBreakout({ display, breakout, texture, crop, look, spec, radius }) {
  const { id, rect, dividers = [], lead = 0, toBezel = true } = breakout;
  // How it leaves the screen. The KPI strip rises off the glass along its normal (rise, depth) and turns toward the
  // camera (the fan's arc). A breakout with `toEye` instead comes straight along the line of sight and turns to face
  // the camera exactly, growing by `scale`; with `overhang` it also slides right until, as the camera sees it, that
  // share of its width is past the screen's edge, so it plainly floats in front of the laptop. `shadow` is the drop
  // shadow's strength at rest, `shadowDrop` and `shadowSoft` how far it falls and spreads as the card lifts,
  // `hoverShadow` how much more a hover deepens and spreads it; `shadowToLid` ends it at the lid's edge (a card that
  // hangs well past the laptop). `hoverRise` is the hover's small lift up and `hoverScale` its growth (a big card
  // keeps it small, or it crowds its neighbours; its lift reads through the rise and the shadow). `fade`: the share
  // of the lift over which a card fades in from its slot; a card that travels far must stay opaque until it is back
  // in register, or it ghosts (`refill`, read by the screen, is the matching share over which its slot fills again).
  const motion = {
    toEye: false, depth: 0.42, rise: 0.05, scale: 0.04, overhang: null, fade: 1 / 3,
    shadow: 0.42, shadowDrop: 0.012, shadowSoft: 0.02, hoverShadow: 1, shadowToLid: false, hoverRise: 0.02, hoverScale: 0.04,
    ...breakout.motion,
  };
  const group = new THREE.Group();
  display.add(group);

  const strip = onDisplay(rect);
  // Toward the right bezel (the left of the frame is the headline's side), its end just reaching the bezel so
  // the last tile never hangs in the air past the laptop. A breakout without `toBezel` lifts straight out of its place.
  const overhang = toBezel ? spec.display.width / 2 + strip.size.x * 0.02 - (strip.centre.x + strip.size.x / 2) : 0;
  const { rise, depth } = motion;
  const spread = 0.22;
  const cornerRadius = radius;
  // Hover: the tile under the cursor springs toward the camera, grows about 6% and tilts toward the cursor (up
  // to 8°); its shadow deepens and its rim brightens; the others ease back a little.
  const hoverLift = 0.12;
  const { hoverScale } = motion;
  const hoverTilt = THREE.MathUtils.degToRad(8);
  const neighbourBack = 0.035;
  const neighbourApart = 0.04;
  // Fanned, the arc stays on the glass it left: as it fans, the strip slides back from the bezel far enough that
  // the last card's edge ends just inside the screen (same timing, same arc). The cards float well in front of
  // the glass and the camera looks from the right, so parallax carries them about 0.2 further right on screen.
  const stripRight = strip.centre.x + strip.size.x / 2;
  const parallax = 0.2;
  const fanShift = toBezel ? Math.max(0, stripRight + spread - (spec.display.width / 2 - 0.03 - parallax)) : 0;

  const edges = [rect.x0, ...dividers, rect.x1];
  const tiles = edges.slice(0, -1).map((x0, index) => {
    const tileRect = { x0, y0: rect.y0, x1: edges[index + 1], y1: rect.y1 };
    const { centre, size } = onDisplay(tileRect);
    const material = new THREE.ShaderMaterial({
      uniforms: {
        map: { value: texture },
        rect: { value: new THREE.Vector4(tileRect.x0, tileRect.y0, tileRect.x1, tileRect.y1) },
        crop: { value: new THREE.Vector4(crop.x0, crop.y0, crop.x1, crop.y1) },
        size: { value: size.clone() },
        radii: { value: new THREE.Vector4() },
        opacity: { value: 0 },
        rim: { value: 0 },
        glow: { value: 0 },
        rimColor: { value: new THREE.Color(look.tile) },
        tileLight: { value: new THREE.Color(look.tileLight) },
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
    // The holder takes the timeline's pose; the hover rides on a pivot inside it, so the two never fight.
    const holder = new THREE.Group();
    const pivot = new THREE.Group();
    const face = new THREE.Mesh(new THREE.PlaneGeometry(size.x, size.y), material);
    face.renderOrder = 5;
    face.userData.tile = index;
    pivot.add(face);
    holder.add(pivot);
    holder.visible = false;
    group.add(holder);
    // Each card's own soft drop shadow, just behind it: it rides with the card (and its hover), so it reads as
    // the card's depth. Cast down onto the far glass it drifted off the card and read as a row of smudges.
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(size.x + 0.3, size.y + 0.3), shadowMaterial(size, look));
    shadow.renderOrder = 3;
    shadow.visible = false;
    pivot.add(shadow);
    const springs = { hover: { x: 0, v: 0 }, tiltX: { x: 0, v: 0 }, tiltY: { x: 0, v: 0 }, back: { x: 0, v: 0 } };
    return { centre, size, index, holder, pivot, face, material, shadow, springs, side: 0 };
  });
  const faces = tiles.map((tile) => tile.face);
  const toward = new THREE.Vector3();
  const local3 = new THREE.Vector3();
  const sight = new THREE.Vector3();
  const facing = new THREE.Quaternion();
  // The lid's face on the display plane (the display sits centredY up the lid from the hinge), for shadowToLid.
  const lidFace = new THREE.Vector4(-spec.width / 2, -spec.display.centreY, spec.width / 2, spec.lidHeight - spec.display.centreY);

  const last = tiles.length - 1;
  const local = [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]];
  return {
    group,
    /** The lifted tile under a ray, as { id, index, u, v } (u, v across its face, 0 → 1 from the bottom-left), or null. */
    pick(raycaster) {
      if (!tiles[0].holder.visible) return null;
      const hit = raycaster.intersectObjects(faces, false)[0];
      return hit?.uv ? { id, index: hit.object.userData.tile, u: hit.uv.x, v: hit.uv.y } : null;
    },
    /** World corners of every lifted tile (for the HUD checks); empty while the strip sits in the screen. */
    corners() {
      const out = [];
      for (const tile of tiles) {
        if (!tile.holder.visible) continue;
        tile.pivot.updateWorldMatrix(true, false);
        for (const [a, b] of local) out.push(new THREE.Vector3(a * tile.size.x, b * tile.size.y, 0).applyMatrix4(tile.pivot.matrixWorld));
      }
      return out;
    },
    /**
     * lift: out of the screen (0 → 1); fan: apart, the lead forward (0 → 1). hover: the picked tile ({ index,
     * u, v }) or null; delta: seconds since the last frame, for the hover springs; eye: the camera's world
     * position (a hovered card lifts straight toward it, so it grows in place instead of drifting); compact: the
     * narrow layout, where the props sit closer to the laptop (`overhangCompact`).
     */
    update(lift, fan, delta = 0, hover = null, eye = null, compact = false) {
      const visible = lift > 0.002;
      // Every corner is round as soon as the strip is out: the outer ones always, the inner ones by mid-lift
      // (assembled in the screen, they are the card's dividers).
      const r = cornerRadius;
      const inner = r * Math.max(fan, Math.min(1, lift * 2));
      const pressed = hover ? tiles[hover.index].springs.hover.x : 0;
      for (const tile of tiles) {
        tile.holder.visible = visible;
        tile.shadow.visible = visible;
        if (!visible) continue;
        const i = tile.index;
        const distance = Math.abs(i - lead);
        // A single card has no arc to spread along.
        const across = last ? ((i - last / 2) / (last / 2)) * spread * fan : 0;
        if (motion.toEye && eye) {
          // Along the line of sight from its place on the glass: the same spot on screen, only nearer and larger.
          group.updateWorldMatrix(true, false);
          sight.copy(group.worldToLocal(local3.copy(eye))).sub(toward.set(tile.centre.x, tile.centre.y, 0));
          // That near the eye it looks larger (and a slide moves further on screen) by reach / (reach - depth).
          const reach = sight.length();
          sight.normalize();
          const near = reach / Math.max(1e-3, reach - depth);
          const span = tile.size.x * (1 + motion.scale);
          const overhang = compact ? motion.overhangCompact ?? motion.overhang : motion.overhang;
          const slide = overhang === null ? 0 : (spec.display.width / 2 + span * near * overhang - tile.centre.x) / near - span / 2;
          // It grows toward the viewer first and drifts right late in the lift (lift²), so it reads as lifting, not widening.
          tile.holder.position.set(tile.centre.x + slide * lift * lift, tile.centre.y + lift * rise, 0.006).addScaledVector(sight, lift * depth);
          // Face-on to the camera, turning with the lift.
          tile.holder.rotation.set(0, 0, 0);
          tile.holder.updateWorldMatrix(true, false);
          tile.holder.lookAt(eye);
          facing.copy(tile.holder.quaternion);
          tile.holder.quaternion.identity().slerp(facing, Math.min(1, lift));
        } else {
          tile.holder.position.set(
            tile.centre.x + overhang * lift * (1 - fan) - fanShift * fan + across,
            tile.centre.y + lift * rise + fan * (0.04 - distance * 0.014),
            0.006 + lift * depth + fan * (0.26 - distance * 0.08),
          );
          tile.holder.rotation.set(lift * 0.16, lift * 0.22, 0);
        }
        tile.holder.scale.setScalar(1 + lift * motion.scale + (i === lead ? fan * 0.2 : -fan * distance * 0.025));

        const mine = hover?.index === i;
        const { springs } = tile;
        const h = spring(springs.hover, mine ? 1 : 0, delta);
        const tiltX = spring(springs.tiltX, mine ? -(hover.v - 0.5) * 2 * hoverTilt : 0, delta);
        const tiltY = spring(springs.tiltY, mine ? (hover.u - 0.5) * 2 * hoverTilt : 0, delta);
        const back = spring(springs.back, hover && !mine ? pressed : 0, delta);
        if (hover && !mine) tile.side = Math.sign(i - hover.index);
        // Toward the camera, in the holder's own frame; neighbours ease back and a little apart.
        toward.set(0, 0, 1);
        if (eye) {
          tile.holder.updateWorldMatrix(true, false);
          toward.copy(tile.holder.worldToLocal(local3.copy(eye))).normalize();
        }
        tile.pivot.position.copy(toward).multiplyScalar(h * hoverLift - back * neighbourBack);
        tile.pivot.position.x += tile.side * back * neighbourApart;
        // A small rise as it lifts, so the hover reads as a lift, not only a zoom.
        tile.pivot.position.y += h * motion.hoverRise;
        tile.pivot.rotation.set(tiltX, tiltY, 0);
        tile.pivot.scale.setScalar(1 + h * hoverScale - back * 0.015);

        // The drop shadow: below and behind the card, deepening, dropping and softening as it lifts and as it is
        // hovered.
        const lifted = Math.max(0, h) * motion.hoverShadow;
        tile.shadow.position.set(0.004 * lift, -motion.shadowDrop * lift - 0.014 * lifted, -0.012);
        tile.shadow.material.uniforms.opacity.value = motion.shadow * lift * (1 + 0.4 * lifted);
        tile.shadow.material.uniforms.softness.value = 0.02 + motion.shadowSoft * lift + 0.03 * lifted;
        if (motion.shadowToLid && eye) {
          const u = tile.shadow.material.uniforms;
          u.lid.value.copy(lidFace);
          tile.shadow.updateWorldMatrix(true, false);
          u.toDisplay.value.copy(group.matrixWorld).invert().multiply(tile.shadow.matrixWorld);
          u.eyeLocal.value.copy(group.worldToLocal(local3.copy(eye)));
        }
        const outerLeft = i === 0 ? r : inner;
        const outerRight = i === last ? r : inner;
        for (const radii of [tile.material.uniforms.radii, tile.shadow.material.uniforms.radii]) {
          radii.value.set(outerLeft, outerRight, outerRight, outerLeft);
        }
        tile.material.uniforms.opacity.value = Math.min(1, lift / motion.fade);
        tile.material.uniforms.rim.value = lift;
        tile.material.uniforms.glow.value = Math.max(0, h);
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
