import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { screenResponse } from "./mood.js";
import { rng } from "./rng.js";
import { contactShadow, cork, deskFalloff, deskRoughness, floorFalloff, leatherBump, speckle } from "./textures.js";

/**
 * The persistent world every shot shares. Scene units are 10 cm; the laptop sits at the origin with its front
 * toward +z on a desk top at y = 0. Positions follow the reference (sample 1.jpg): notebook and phone
 * left, two pen cups and a small box right with a coaster in front, an arm lamp at the back right leaning over the
 * cups, the out-of-focus room behind (shelf + LED, bed, plant, curtain) and a chair back in front at the bottom left.
 *
 * The world is black by default (the palette's own values, unlit). A shot dresses it in its own look
 * (applyDressing: material colours from that shot's reference) and its mood lights it; the intro's sun brings it
 * from black to alive. Background elements are depth cards placed from the canonical rest view.
 *
 * Shader budget: every distinct material feature set (maps, clearcoat, sheen, double-sided, flat shading)
 * compiles its own program, which is most of the time to first frame on a weak GPU. Props use
 * MeshStandardMaterial and share programs; only the desk keeps a clearcoat (its satin sheen).
 */

const color = (value) => new THREE.Color(value);

/**
 * Every dressable material registers here with a dressing key; applyDressing() recolours them per shot.
 * The world's own palette (black) is the default dressing.
 */
function registry() {
  const entries = [];
  return {
    add(key, material, property = "color") {
      entries.push({ key, material, property });
      return material;
    },
    apply(dressing) {
      for (const { key, material, property } of entries) {
        const value = dressing[key];
        if (value === undefined) continue;
        if (property === "color") material.color.set(value);
        else material[property] = value;
      }
    },
  };
}

/**
 * Blending for shades laid over the room plate: they darken colour but never touch alpha. Alpha marks the
 * plate's ungraded path (post.js); a shade that wrote it would push the plate under it into the graded world,
 * where the shot's saturation and gain clip it to pure magenta.
 */
export const keepMask = {
  blending: THREE.CustomBlending,
  blendSrc: THREE.SrcAlphaFactor,
  blendDst: THREE.OneMinusSrcAlphaFactor,
  blendSrcAlpha: THREE.ZeroFactor,
  blendDstAlpha: THREE.OneFactor,
};

/**
 * A contact shadow on the surface under an object: a soft dark rounded rectangle a little larger than its
 * footprint (width × depth, scene units), laid flat at `y`. Grounds things where the lamp's shadow map is too
 * coarse to (rule 7).
 */
let shadowTexture = null;
function groundShadow(width, depth, strength, y = 0) {
  shadowTexture ??= contactShadow();
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth),
    new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false, opacity: strength, color: new THREE.Color(0, 0, 0), ...keepMask }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = y + 0.003;
  mesh.renderOrder = -1;
  return mesh;
}

/** The under-desk occlusion: dark under the edge, fading out downward (alpha only). */
function underShade() {
  const canvas = document.createElement("canvas");
  canvas.width = 4;
  canvas.height = 64;
  const context = canvas.getContext("2d");
  const image = context.createImageData(4, 64);
  for (let y = 0; y < 64; y += 1) {
    const t = y / 63;
    const a = Math.round(255 * 0.62 * (1 - t) ** 2);
    for (let x = 0; x < 4; x += 1) image.data[(y * 4 + x) * 4 + 3] = a;
  }
  context.putImageData(image, 0, 0);
  return new THREE.CanvasTexture(canvas);
}

/** Desk (bevelled laminate slab), legs, floor. */
function buildDesk(world, palette, dress) {
  // 1.8 m wide, 50 cm deep: the front edge just ahead of the laptop, the back just behind the lamp (reference).
  // Satin laminate (a clearcoat that rolls the lamp and screen off as a soft sheen), and a slim 2 cm top whose
  // well-rounded front edge catches a thin lit line.
  const roughnessMap = deskRoughness();
  // The top face's UVs span 18 × 5 units: repeat less across the depth so the grain stays round, not streaked.
  roughnessMap.repeat.set(6, 6 * (5 / 18));
  // The top falls off away from the lamp (a baked albedo ramp across its width): lit around the lamp and the
  // cups, quieter toward the laptop's left, where the headline sits (rule 47).
  const material = dress.add("desk", new THREE.MeshPhysicalMaterial({ color: color(palette.desk), map: deskFalloff(), roughnessMap, roughness: 1, clearcoat: 0.45, clearcoatRoughness: 0.2 }));
  dress.add("deskRoughness", material, "roughness");
  // The desk sees the screen only at a grazing angle, where a real panel emits far less than the area light.
  screenResponse(material, { diffuse: palette.deskScreenSpill ?? 1, specular: palette.deskScreenSpill ?? 1 });
  const top = new RoundedBoxGeometry(18, 0.2, 5.0, 5, 0.08);
  // The front face (and the lip rolling onto it) samples the falloff's front-edge row: lit by the room behind the
  // viewer, it read as a bright band right over the headline once the camera zooms in.
  const uv = top.getAttribute("uv");
  const normal = top.getAttribute("normal");
  for (let i = 0; i < uv.count; i += 1) if (normal.getZ(i) > 0.35) uv.setY(i, 0);
  const desk = new THREE.Mesh(top, material);
  desk.position.set(0.6, -0.1, -1.1);
  // It casts too (its underside, three.js's default shadow side), so the lamp never lights the frame through it.
  desk.castShadow = desk.receiveShadow = true;
  desk.name = "desk";
  world.add(desk);
  buildFrame(world, palette, dress);
  // The floor is dark in the desk's shade and rises toward the wall and the bed's glow (a baked light falloff).
  // Seen at a grazing angle, a rough floor's sheen (the practical rim behind it, the room's reflection) would
  // outweigh its albedo and flatten it into one sheet, so it is purely diffuse (Lambert: no specular, no
  // environment) and the falloff also occludes its ambient (aoMap, linear).
  const falloff = floorFalloff(200);
  const occlusion = falloff.clone();
  occlusion.colorSpace = THREE.NoColorSpace;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), dress.add("floor", new THREE.MeshLambertMaterial({ color: color(palette.floor), map: falloff, aoMap: occlusion })));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -7.6;
  floor.name = "floor";
  world.add(floor);
  // The laptop rests on its feet at the origin: a soft shadow under the whole base.
  world.add(groundShadow(3.5, 2.55, 0.55));
  // Occlusion under the desk: the top shades what lies beneath its front edge (the room seen under the desk
  // would otherwise glow right up to the edge and the slab would float).
  const under = new THREE.Mesh(new THREE.PlaneGeometry(18, 3), new THREE.MeshBasicMaterial({ map: underShade(), transparent: true, depthWrite: false, color: new THREE.Color(0, 0, 0), ...keepMask }));
  under.position.set(0.6, -1.7, 1.38);
  under.renderOrder = -1;
  world.add(under);
  return desk;
}

/**
 * The desk's base: a powder-coated steel frame under the top. Four slim legs (3 cm square) on rubber glides, a
 * slim 3.5 cm apron with a 3 mm reveal against the legs, a low stretcher across the back and low side bars. The
 * frame sits 5 cm inside the top's front and back edges, so a shadow gap reads under the top. It is narrower
 * than the top (which overhangs it at both ends, off frame), so both front legs stay in view through the loop at
 * desktop sizes; on phones the right leg runs to the floor. It sits in the top's shade: no lamp light, less of
 * the environment, and paint that fades toward the floor (vertex colours), so it stays dim behind the headline.
 * The floor carries soft shadows under the feet and the whole frame.
 */
function buildFrame(world, palette, dress) {
  const material = dress.add("frame", new THREE.MeshStandardMaterial({ color: color(palette.frame), roughness: 0.5, envMapIntensity: 0.6, vertexColors: true }));
  const glide = dress.add("prop", new THREE.MeshStandardMaterial({ color: color(palette.prop), roughness: 0.7 }));
  const top = -0.2;
  const floor = -7.6;
  const leg = 0.3;
  const [left, right] = [-3.9, 3.3];
  const [front, back] = [0.75, -2.95];
  const parts = [];
  const box = (width, height, depth, x, y, z, radius = 0.025) => {
    const geometry = new RoundedBoxGeometry(width, height, depth, 2, radius);
    geometry.translate(x, y, z);
    parts.push(geometry);
  };
  const glideHeight = 0.08;
  for (const x of [left, right]) {
    for (const z of [front, back]) {
      box(leg, top - floor - glideHeight, leg, x, (top + floor + glideHeight) / 2, z);
      const foot = new THREE.Mesh(new RoundedBoxGeometry(leg - 0.04, glideHeight, leg - 0.04, 2, 0.02), glide);
      foot.position.set(x, floor + glideHeight / 2, z);
      foot.castShadow = foot.receiveShadow = true;
      world.add(foot);
      const shadow = groundShadow(1.1, 1.1, 0.6, floor);
      shadow.position.x = x;
      shadow.position.z = z;
      world.add(shadow);
    }
  }
  // Apron: 3.5 cm deep and 2 cm thick, 3 mm inside the legs' outer faces.
  const apron = { height: 0.35, thickness: 0.2, reveal: 0.03 };
  const span = right - left - leg;
  const run = front - back - leg;
  const apronY = top - apron.height / 2;
  const inset = leg / 2 - apron.reveal - apron.thickness / 2;
  box(span, apron.height, apron.thickness, (left + right) / 2, apronY, front + inset);
  box(span, apron.height, apron.thickness, (left + right) / 2, apronY, back - inset);
  box(apron.thickness, apron.height, run, left - inset, apronY, (front + back) / 2);
  box(apron.thickness, apron.height, run, right + inset, apronY, (front + back) / 2);
  // Stretchers about 10 cm off the floor: across the back, and along both sides.
  const low = floor + 1.0;
  box(span, 0.24, 0.18, (left + right) / 2, low, back);
  box(0.18, 0.24, run, left, low, (front + back) / 2);
  box(0.18, 0.24, run, right, low, (front + back) / 2);
  const under = groundShadow(right - left + 2.2, front - back + 2.2, 0.32, floor - 0.001);
  under.position.set((left + right) / 2, under.position.y, (front + back) / 2);
  world.add(under);
  const geometry = mergeGeometries(parts);
  const position = geometry.getAttribute("position");
  const shade = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i += 1) {
    const t = Math.min(1, Math.max(0, (top - position.getY(i)) / (top - floor)));
    shade.fill(1 - 0.72 * t * (2 - t), i * 3, i * 3 + 3);
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(shade, 3));
  const frame = new THREE.Mesh(geometry, material);
  frame.name = "desk-frame";
  frame.castShadow = frame.receiveShadow = true;
  world.add(frame);
}

/**
 * An iPhone 17 Pro lying face down (71.9 × 150 mm), its back up. The anodised aluminium unibody has flat sides with
 * tight edges, and its full-width camera plateau runs flush with the frame across the top, deep enough to leave
 * clear margins around the lenses. The plateau carries the three lenses in a triangle on the left (each standing
 * proud in a metal housing with a bright rim, dark coated glass and the front element) and, on the right, the
 * flash, mic and LiDAR. Below it sits the frosted glass panel, within a few percent of the aluminium's value (a
 * lighter panel reads as a lit screen, which turns the phone face up). Its top edge is straight under the
 * plateau. On the bottom face, the USB-C port between the speaker and mic holes. No side keys (at 1x they read
 * as notches cut in the rail) and no logo.
 * The body is 8 mm, not 8.75: at this angle the contact shadow adds to the near face, and the true depth read as
 * an old phone in a case. Phone-local: x across, z along (the top at -z), y up from the notebook its screen lies
 * on.
 */
function buildPhone(palette, dress) {
  const phone = new THREE.Group();
  phone.name = "phone";
  // Satin, partly diffuse and light: mirror metal stripes the thin sides and carries the window's violet as a neon
  // rail (it read as a purple phone, twice as saturated as the laptop); this reads as silver catching the light.
  const aluminium = dress.add("phone", new THREE.MeshStandardMaterial({ color: color(palette.phone), metalness: 0.65, roughness: 0.4, envMapIntensity: 0.65 }));
  // The lens rims: the same silver, a little brighter and less metallic so they read as rings at 1x.
  const rimMetal = dress.add("phone", new THREE.MeshStandardMaterial({ color: color(palette.phone), metalness: 0.4, roughness: 0.3 }));
  const glass = dress.add("phoneGlass", new THREE.MeshStandardMaterial({ color: color(palette.phoneGlass), metalness: 0.5, roughness: 0.55, envMapIntensity: 0.6 }));
  // Deep black sapphire: a clearcoat at this grazing angle mirrored the pink room and turned the lenses to lilac.
  const lensGlass = dress.add("graphite", new THREE.MeshPhysicalMaterial({ color: color(palette.graphite), roughness: 0.1, clearcoat: 0.3, clearcoatRoughness: 0.08, envMapIntensity: 0.25 }));
  // The lens rims and the flash catch light whatever the room reflects into the metal: a pale, frosted finish.
  const bright = dress.add("tile", new THREE.MeshStandardMaterial({ color: color(palette.tile), roughness: 0.3 }));
  const port = dress.add("prop", new THREE.MeshStandardMaterial({ color: color(palette.prop), roughness: 0.8 }));
  const [width, length, height] = [0.719, 1.5, 0.08];
  const top = -length / 2;
  phone.add(new THREE.Mesh(roundedSlab({ width, depth: length, height, radius: 0.115, bevel: 0.014 }), aluminium));

  // The plateau: one raised band of the unibody, edge to edge across the top, its far corners the body's own.
  const plateau = { length: 0.47, rise: 0.022, inset: 0.001 };
  const band = new THREE.Mesh(roundedSlab({ width: width - plateau.inset * 2, depth: plateau.length, height: plateau.rise, radius: [0.06, 0.114], bevel: 0.011 }), aluminium);
  band.position.set(0, height - 0.002, top + plateau.inset + plateau.length / 2);
  phone.add(band);
  const deck = height - 0.002 + plateau.rise;

  // The glass panel: about 2 mm inside the sides and the bottom, its straight top edge right under the plateau.
  const panelTop = top + plateau.inset + plateau.length + 0.006;
  const panelLength = length / 2 - 0.018 - panelTop;
  const panel = new THREE.Mesh(roundedSlab({ width: width - 0.036, depth: panelLength, height: 0.002, radius: [0.097, 0.012], bevel: 0.0008 }), glass);
  panel.position.set(0, height - 0.001, panelTop + panelLength / 2);
  phone.add(panel);

  // Lenses: two stacked and one beside them (about 23% of the width each, as on the phone), each standing about
  // 1.7 mm proud in its housing: a silver rim around deep black glass, a faint inner ring, the front element.
  const lensZ = top + plateau.inset + plateau.length / 2;
  const lens = (x, z) => {
    const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.087, 0.092, 0.017, 48), aluminium);
    housing.position.set(x, deck + 0.0085, z);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.082, 0.0065, 8, 48), rimMetal);
    rim.rotation.x = Math.PI / 2;
    rim.position.set(x, deck + 0.017, z);
    const cover = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.004, 48), lensGlass);
    cover.position.set(x, deck + 0.0165, z);
    const element = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.042, 0.003, 32), lensGlass);
    element.position.set(x, deck + 0.019, z);
    const inner = new THREE.Mesh(new THREE.TorusGeometry(0.054, 0.0018, 6, 40), port);
    inner.rotation.x = Math.PI / 2;
    inner.position.set(x, deck + 0.019, z);
    phone.add(housing, rim, cover, element, inner);
  };
  const column = -width / 2 + plateau.inset + 0.032 + 0.092;
  lens(column, lensZ - 0.1);
  lens(column, lensZ + 0.1);
  lens(column + 0.175, lensZ);
  // Flash (a pale frosted window) and LiDAR, each set in a thin metal ring, and the mic, on the plateau's right.
  const dot = (radius, material, x, z, rise = 0.003) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, rise, 24), material);
    mesh.position.set(x, deck + rise / 2, z);
    phone.add(mesh);
  };
  const right = width / 2 - plateau.inset - 0.08;
  dot(0.034, aluminium, right, lensZ - 0.1, 0.004);
  dot(0.027, bright, right, lensZ - 0.1, 0.005);
  dot(0.007, port, right, lensZ, 0.001);
  dot(0.036, aluminium, right, lensZ + 0.1, 0.004);
  dot(0.029, lensGlass, right, lensZ + 0.1, 0.005);

  // The bottom face: the USB-C port between two rows of speaker and mic holes, in a dark matte finish.
  const end = length / 2 - 0.0012;
  // A stadium (pill) opening: a thin rounded slab stood up to face out of the bottom face.
  const usb = new THREE.Mesh(roundedSlab({ width: 0.072, depth: 0.022, height: 0.003, radius: 0.0109, bevel: 0.0008 }), port);
  usb.rotation.x = Math.PI / 2;
  usb.position.set(0, height / 2, end - 0.0015);
  phone.add(usb);
  const hole = new THREE.CylinderGeometry(0.0055, 0.0055, 0.004, 12);
  hole.rotateX(Math.PI / 2);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 6; i += 1) {
      const mesh = new THREE.Mesh(hole, port);
      mesh.position.set(side * (0.07 + i * 0.021), height / 2, end);
      phone.add(mesh);
    }
  }
  return phone;
}

/**
 * A hardcover notebook (A5, about 1.3 cm): leather boards around a cream page block, a rounded spine on the
 * left, an elastic band near the right edge. On it, an iPhone lying face down (buildPhone; the reference shows a
 * light slab on the notebook, not a dark screen).
 */
function buildNotebook(world, palette, dress) {
  const group = new THREE.Group();
  const cover = dress.add("notebook", new THREE.MeshStandardMaterial({ color: color(palette.notebook), roughness: 0.62, bumpMap: leatherBump(), bumpScale: 0.6 }));
  const pages = dress.add("pages", new THREE.MeshStandardMaterial({ color: color(palette.pages), map: pageLines(), roughness: 0.85 }));
  const prop = dress.add("prop", new THREE.MeshStandardMaterial({ color: color(palette.prop), roughness: 0.55 }));
  const board = 0.022;
  const block = 0.09;
  const [width, depth] = [1.64, 2.27];
  const lower = new THREE.Mesh(new RoundedBoxGeometry(width, board, depth, 3, 0.008), cover);
  lower.position.y = board / 2;
  // Pages sit flush with the spine and about 3 mm inside the boards' other three edges.
  const leaf = new THREE.Mesh(new RoundedBoxGeometry(width - 0.05, block, depth - 0.06, 2, 0.006), pages);
  leaf.position.set(-0.025, board + block / 2, 0);
  const upper = lower.clone();
  upper.position.y = board * 1.5 + block;
  const thickness = board * 2 + block;
  // The spine's cylinder UVs would stretch the pebbled grain into streaks; it is smooth, worn leather.
  const spineLeather = dress.add("notebook", cover.clone());
  spineLeather.bumpMap = null;
  const spine = new THREE.Mesh(new THREE.CylinderGeometry(thickness / 2, thickness / 2, depth, 24, 1, false, Math.PI, Math.PI), spineLeather);
  spine.rotation.x = Math.PI / 2;
  spine.position.set(-width / 2 + 0.004, thickness / 2, 0);
  // The elastic closure band runs front to back over the top board, close to the opening edge.
  const band = new THREE.Mesh(new RoundedBoxGeometry(0.05, 0.006, depth + 0.004, 1, 0.002), prop);
  band.position.set(width / 2 - 0.16, thickness + 0.003, 0);
  for (const mesh of [lower, leaf, upper, spine, band]) {
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
  }

  const phone = buildPhone(palette, dress);
  // Turned about 30° so its long side and the plateau's step show in profile: pointing straight away from the
  // camera, 150 mm foreshortens to a short slab and the plateau to a hairline. Clear of the elastic band, which
  // otherwise ran out from under the plateau like a cable.
  phone.position.set(-0.07, thickness, -0.04);
  phone.rotation.y = THREE.MathUtils.degToRad(-28);
  phone.traverse((child) => {
    child.castShadow = child.receiveShadow = true;
  });
  group.add(phone);
  // Tight to the phone (a wider shadow reads as a plinth under it), with a darker contact line right at its edge.
  const phoneShadow = groundShadow(0.78, 1.56, 0.7, thickness);
  const phoneContact = groundShadow(0.82, 1.6, 0.55, thickness + 0.0005);
  phoneContact.position.x = phone.position.x;
  phoneContact.position.z = phone.position.z;
  phoneContact.rotation.z = phone.rotation.y;
  group.add(phoneContact);
  phoneShadow.position.x = phone.position.x;
  phoneShadow.position.z = phone.position.z;
  phoneShadow.rotation.z = phone.rotation.y;
  group.add(phoneShadow, groundShadow(width + 0.22, depth + 0.22, 0.5));
  group.position.set(-2.62, 0, 0.2);
  group.rotation.y = THREE.MathUtils.degToRad(3);
  world.add(group);
}

/** Page edges: fine, slightly uneven lines across a page block's faces (sRGB luminance, v = the block's height). */
function pageLines() {
  const canvas = document.createElement("canvas");
  canvas.width = 4;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  const image = context.createImageData(4, 128);
  const random = rng(61);
  for (let y = 0; y < 128; y += 1) {
    const v = Math.round(255 * (y % 3 === 0 ? 0.8 + random() * 0.06 : 0.95 + random() * 0.05));
    for (let x = 0; x < 4; x += 1) image.data.set([v, v, v, 255], (y * 4 + x) * 4);
  }
  context.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * A rounded-rectangle slab (optionally with a rounded hole), extruded up from y = 0 with every edge rounded.
 * Normals are smoothed over merged positions (no faceting on the bevels); the side walls are split into rows so
 * the rounding stays at the edges. UVs are in scene units: the caps are planar, and the walls unwrap as one
 * continuous strip around the perimeter (its seam hidden at the back-left corner), so no corner shows a seam.
 */
function roundedSlab({ width, depth, height, radius, bevel, hole = null }) {
  // `radius` is one corner radius, or [near, far]: the corners at +z, then those at -z.
  const rect = (w, d, r, path) => {
    const x = w / 2;
    const y = d / 2;
    const [near, far] = Array.isArray(r) ? r : [r, r];
    path.moveTo(-x + near, -y);
    path.lineTo(x - near, -y);
    path.absarc(x - near, -y + near, near, -Math.PI / 2, 0);
    path.lineTo(x, y - far);
    path.absarc(x - far, y - far, far, 0, Math.PI / 2);
    path.lineTo(-x + far, y);
    path.absarc(-x + far, y - far, far, Math.PI / 2, Math.PI);
    path.lineTo(-x, -y + near);
    path.absarc(-x + near, -y + near, near, Math.PI, Math.PI * 1.5);
    return path;
  };
  const shape = rect(width, depth, radius, new THREE.Shape());
  if (hole) shape.holes.push(rect(hole.width, hole.depth, hole.radius, new THREE.Path()));
  const extruded = new THREE.ExtrudeGeometry(shape, {
    depth: height - bevel * 2,
    steps: Math.max(2, Math.round(height / 0.05)),
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelOffset: -bevel,
    bevelSegments: 4,
    curveSegments: 8,
  });
  extruded.deleteAttribute("normal");
  extruded.deleteAttribute("uv");
  const geometry = mergeVertices(extruded, 1e-4);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, bevel, 0);
  geometry.computeVertexNormals();
  const position = geometry.getAttribute("position");
  const normal = geometry.getAttribute("normal");
  const uv = new Float32Array(position.count * 2);
  for (let i = 0; i < position.count; i += 1) {
    const [x, y, z] = [position.getX(i), position.getY(i), position.getZ(i)];
    if (Math.abs(normal.getY(i)) > 0.7) {
      uv[i * 2] = x;
      uv[i * 2 + 1] = z;
      continue;
    }
    // This vertex's contour (outer wall or hole) as half-sizes, then its distance along that contour.
    const s = Math.max(Math.abs(x) / (width / 2), Math.abs(z) / (depth / 2));
    const a = (s * width) / 2;
    const b = (s * depth) / 2;
    let p;
    if (Math.abs(z) / b >= Math.abs(x) / a) p = z < 0 ? x + a : 2 * a + 2 * b + (a - x);
    else p = x > 0 ? 2 * a + (z + b) : 4 * a + 2 * b + (b - z);
    uv[i * 2] = p;
    uv[i * 2 + 1] = y;
  }
  geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return geometry;
}

/** A hollow square cup: walls about 5.5 mm thick, the rim rounded inside and out. */
function hollowCup(width, height, wall = 0.055) {
  const inner = width - wall * 2;
  return roundedSlab({ width, depth: width, height, radius: 0.085, bevel: 0.022, hole: { width: inner, depth: inner, radius: 0.04 } });
}

/** Two speckled square pen cups with pencils and pens, a small box behind, a cork coaster in front. */
function buildCups(world, palette, random, dress) {
  const cupMaterial = dress.add("cup", new THREE.MeshStandardMaterial({ color: color(palette.cup), map: speckle(), roughness: 0.74 }));
  const inside = dress.add("prop", new THREE.MeshStandardMaterial({ color: color(palette.prop), roughness: 0.9 }));
  const cups = [
    { x: 2.45, z: -0.55, w: 0.95, h: 0.72, count: 8 },
    { x: 3.62, z: -1.05, w: 0.76, h: 0.7, count: 5 },
  ];
  const total = cups.reduce((sum, cup) => sum + cup.count, 0);
  // Pencils: a hexagonal lacquered barrel, a sharpened wood cone and a graphite point per instance. Mostly
  // upright, standing about 0.6× the cup's height above the rim (reference). Barrels take the dressing's tints.
  const radius = 0.04;
  // The barrel's six faces are real facets (flat shading); the sharpened cone and the point are smooth.
  const bodies = new THREE.InstancedMesh(new THREE.CylinderGeometry(radius, radius, 1, 6), new THREE.MeshStandardMaterial({ roughness: 0.34, flatShading: true }), total);
  const cones = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.021, radius, 0.11, 12, 1, true), dress.add("pencilWood", new THREE.MeshStandardMaterial({ color: color(palette.pencilWood), roughness: 0.8 })), total);
  // Graphite: dark and faintly metallic, long enough to read as the point at full size.
  const points = new THREE.InstancedMesh(new THREE.ConeGeometry(0.021, 0.065, 12), dress.add("graphite", new THREE.MeshStandardMaterial({ color: color(palette.graphite), roughness: 0.32, metalness: 0.65 })), total);
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const one = new THREE.Vector3(1, 1, 1);
  const slots = [];
  let index = 0;
  for (const cup of cups) {
    const body = new THREE.Mesh(hollowCup(cup.w, cup.h), cupMaterial);
    body.position.set(cup.x, 0, cup.z);
    body.castShadow = body.receiveShadow = true;
    const ground = groundShadow(cup.w + 0.2, cup.w + 0.2, 0.6);
    ground.position.x = cup.x;
    ground.position.z = cup.z;
    world.add(body, ground);
    // The cup's floor, recessed well below the rim so the inner walls and their shade show.
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(cup.w - 0.11, cup.w - 0.11), inside);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(cup.x, 0.16, cup.z);
    floor.receiveShadow = true;
    world.add(floor);
    for (let i = 0; i < cup.count; i += 1) {
      const above = cup.h * (0.3 + random() * 0.65);
      const length = cup.h - 0.2 + above;
      const offset = new THREE.Vector3((random() - 0.5) * 0.5 * cup.w, 0, (random() - 0.5) * 0.5 * cup.w);
      const base = new THREE.Vector3(cup.x, 0.2, cup.z).add(offset);
      // Lean away from the cup's centre (they rest against the rim and fan out), plus a little scatter.
      const lean = offset.clone().multiplyScalar(0.7 / cup.w).add(new THREE.Vector3((random() - 0.5) * 0.12, 1, (random() - 0.5) * 0.12)).normalize();
      quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), lean).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), random() * Math.PI));
      const axis = lean;
      matrix.compose(base.clone().addScaledVector(axis, length / 2), quaternion, new THREE.Vector3(1, length, 1));
      bodies.setMatrixAt(index, matrix);
      matrix.compose(base.clone().addScaledVector(axis, length + 0.055), quaternion, one);
      cones.setMatrixAt(index, matrix);
      matrix.compose(base.clone().addScaledVector(axis, length + 0.1425), quaternion, one);
      points.setMatrixAt(index, matrix);
      slots.push(Math.floor(random() * 997));
      index += 1;
    }
  }
  bodies.castShadow = cones.castShadow = true;
  world.add(bodies, cones, points);
  const box = new THREE.Mesh(new RoundedBoxGeometry(0.36, 0.62, 0.36, 2, 0.02), cupMaterial);
  box.position.set(3.05, 0.31, -2.15);
  box.castShadow = box.receiveShadow = true;
  const boxShadow = groundShadow(0.56, 0.56, 0.55);
  boxShadow.position.set(box.position.x, 0, box.position.z);
  world.add(box, boxShadow);
  const coaster = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.34, 0.03, 48),
    dress.add("coaster", new THREE.MeshStandardMaterial({ color: color(palette.coaster), map: cork(), roughness: 0.92 })),
  );
  coaster.position.set(2.72, 0.015, 0.55);
  coaster.receiveShadow = true;
  const coasterShadow = groundShadow(0.8, 0.8, 0.3);
  coasterShadow.position.set(coaster.position.x, 0, coaster.position.z);
  world.add(coaster, coasterShadow);
  return {
    /** Barrels take their tints from the dressing's set (seeded per instance). */
    dressPencils(set) {
      const tint = new THREE.Color();
      for (let i = 0; i < slots.length; i += 1) bodies.setColorAt(i, tint.set(set[slots[i] % set.length]));
      bodies.instanceColor.needsUpdate = true;
    },
  };
}

/**
 * Radial diffuser glow: a hot core easing toward the rim, with a soft (antialiased) edge in alpha. Half-float
 * data: the bulb multiplies it about ×28 into HDR, which would turn 8-bit steps into visible rings.
 */
function diffuserTexture(size = 128) {
  const data = new Uint16Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const r = Math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2) / (size / 2);
      const value = THREE.DataUtils.toHalfFloat(0.36 + 0.64 * Math.exp((-r * r) / 0.16));
      const alpha = THREE.DataUtils.toHalfFloat(Math.min(1, Math.max(0, (1 - r) * size * 0.25)));
      data.set([value, value, value, alpha], (y * size + x) * 4);
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.HalfFloatType);
  texture.magFilter = texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

/** The hood's inner reflector, lit by the bulb: brightest beside the diffuser, falling toward the rim (v: rim → top). */
function reflectorTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 4;
  canvas.height = 64;
  const context = canvas.getContext("2d");
  const image = context.createImageData(4, 64);
  for (let y = 0; y < 64; y += 1) {
    // Canvas rows run top to bottom; flipY puts row 0 at v = 1 (beside the diffuser).
    const v = Math.round(255 * (0.25 + 0.75 * (1 - y / 63) ** 2));
    for (let x = 0; x < 4; x += 1) image.data.set([v, v, v, 255], (y * 4 + x) * 4);
  }
  context.putImageData(image, 0, 0);
  return new THREE.CanvasTexture(canvas);
}

/**
 * Architect lamp at the back right (reference): a weighted foot right of the small cup, a straight post up to an
 * elbow joint, then a straight upper arm reaching up, left and forward to a dome hood that hangs near screen-top
 * height over the near cup, tipped toward the camera so its recessed diffuser shows. The spot inside is the key.
 */
function buildLamp(world, palette, dress) {
  const group = new THREE.Group();
  // Matte enamel. It takes no environment reflection: the environment's lamp card sits at the hood itself, so
  // the shell would mirror its own bulb (light that cannot reach the outside) and read as a glass bowl.
  const body = dress.add("lampBody", new THREE.MeshStandardMaterial({ color: color(palette.lampBody), roughness: 0.62, envMapIntensity: 0.15 }));
  // The foot stands just behind and right of the small cup and the elbow sits low, so the upper arm crosses the frame on a
  // long diagonal up to the hood (rising toward the camera from a foot far behind, it foreshortened to a stub).
  const foot = new THREE.Vector3(4.3, 0, -1.85);
  const elbow = new THREE.Vector3(4.3, 1.55, -1.85);
  // The arm reaches forward so the hood hangs just in front of the near cup: its pool lands on the desk's front
  // and lights the cups' faces (reference). Aimed about 14° toward the camera: the diffuser shows as a crescent.
  const head = new THREE.Vector3(2.75, 2.25, 0.0);
  const target = new THREE.Vector3(2.45, 0, 0.55);
  const meshes = [];
  const part = (geometry, material = body) => {
    const mesh = new THREE.Mesh(geometry, material);
    meshes.push(mesh);
    return mesh;
  };
  const rod = (from, to, radius) => {
    const mesh = part(new THREE.CylinderGeometry(radius, radius, from.distanceTo(to), 20));
    mesh.position.copy(from).add(to).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
    return mesh;
  };

  // Foot: a bevelled weighted disc with a collar where the post enters. Lathe profiles run bottom to top, so
  // three.js winds the faces outward (top to bottom turned the foot inside out: its open underside z-fought the
  // contact shadow and blinked as the camera drifted).
  const footProfile = [[0.001, 0.0], [0.355, 0.0], [0.352, 0.035], [0.335, 0.062], [0.3, 0.075], [0.001, 0.075]].map(([x, y]) => new THREE.Vector2(x, y));
  const footMesh = part(new THREE.LatheGeometry(footProfile, 48));
  footMesh.position.copy(foot);
  const collar = part(new THREE.CylinderGeometry(0.075, 0.085, 0.08, 24));
  collar.position.copy(foot).setY(0.11);

  // Hood: a dome opening along its local −y, aimed from the head at the pool on the desk.
  const radius = 0.5;
  const height = 0.36;
  const wall = 0.018;
  const lip = 0.012;
  const profile = [new THREE.Vector2(0.001, height + lip)];
  for (let i = 1; i <= 18; i += 1) {
    const a = (i / 18) * (Math.PI / 2);
    profile.push(new THREE.Vector2(Math.sin(a) * radius, Math.cos(a) * height + lip));
  }
  profile.push(new THREE.Vector2(radius, -0.05), new THREE.Vector2(radius - wall, -0.05));
  for (let i = 18; i >= 1; i -= 1) {
    const a = (i / 18) * (Math.PI / 2);
    profile.push(new THREE.Vector2(Math.sin(a) * (radius - wall), Math.cos(a) * (height - wall) + lip));
  }
  profile.push(new THREE.Vector2(0.001, height - wall + lip));
  const hood = new THREE.Group();
  hood.position.copy(head);
  const aim = target.clone().sub(head).normalize();
  hood.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), aim);
  // Traced outside-down then inside-up, so the lathe winds it inside out (see the foot). Kept that way on
  // purpose: the camera sees the inner wall's outer faces, a clean shell, while the outward lip ring would catch
  // a dashed grazing highlight along the rim at 1x.
  const shell = new THREE.Mesh(new THREE.LatheGeometry(profile, 64), body);
  shell.castShadow = shell.receiveShadow = true;
  hood.add(shell);
  // The diffuser sits deep in the hood (about 10 mm above the hood's lip), so the lit inner reflector shows as a
  // band around it. Both take their colour and strength from the shot mood (mood.js).
  const inner = radius - wall - 0.002;
  const depth = 0.1;
  const top = Math.acos((depth - lip) / (height - wall));
  const band = [new THREE.Vector2(inner, -0.05), new THREE.Vector2(inner, lip)];
  for (let i = 0; i <= 6; i += 1) {
    const a = Math.PI / 2 - (i / 6) * (Math.PI / 2 - top);
    band.push(new THREE.Vector2(Math.sin(a) * inner, Math.cos(a) * (height - wall) + lip));
  }
  const reflector = new THREE.Mesh(new THREE.LatheGeometry(band, 64), new THREE.MeshBasicMaterial({ map: reflectorTexture(), side: THREE.DoubleSide }));
  const bulb = new THREE.Mesh(new THREE.CircleGeometry(Math.sin(top) * inner, 64), new THREE.MeshBasicMaterial({ map: diffuserTexture(), transparent: true, toneMapped: false }));
  bulb.rotation.x = Math.PI / 2;
  bulb.position.y = depth;
  hood.add(reflector, bulb);
  hood.updateMatrixWorld(true);

  // Post and upper arm: straight tubes meeting at an elbow (a knuckle with a hinge barrel across it). The arm
  // takes the hood at the dome's upper back, through a knuckle, the way an architect lamp holds its shade (a
  // mount on top would hang it like a pendant).
  const toElbow = hood.worldToLocal(elbow.clone()).setY(0).normalize();
  const slope = Math.acos(0.55);
  const mount = new THREE.Vector3(toElbow.x * Math.sin(slope) * radius, Math.cos(slope) * height + lip, toElbow.z * Math.sin(slope) * radius)
    .addScaledVector(toElbow, 0.05)
    .applyMatrix4(hood.matrixWorld);
  // Finger-thick tubes (about 1 cm and 9 mm), as on the reference's sturdy lamp.
  rod(foot.clone().setY(0.14), elbow, 0.05);
  rod(elbow, mount, 0.045);
  const knuckle = part(new THREE.SphereGeometry(0.075, 24, 16));
  knuckle.position.copy(elbow);
  const reach = mount.clone().sub(elbow).setY(0).normalize();
  const across = new THREE.Vector3(-reach.z, 0, reach.x);
  rod(elbow.clone().addScaledVector(across, -0.095), elbow.clone().addScaledVector(across, 0.095), 0.058);
  const neck = part(new THREE.SphereGeometry(0.062, 20, 14));
  neck.position.copy(mount);

  for (const mesh of meshes) mesh.castShadow = mesh.receiveShadow = true;
  const footShadow = groundShadow(0.95, 0.95, 0.55);
  footShadow.position.set(foot.x, 0, foot.z);
  group.add(...meshes, hood, footShadow);

  // A dome lamp throws a wide, soft cone: the pool covers both cups and fades well before the notebook.
  const light = new THREE.SpotLight(0xffffff, 1, 18, THREE.MathUtils.degToRad(56), 0.85, 2);
  light.position.copy(head).addScaledVector(aim, 0.02);
  light.target.position.copy(target);
  light.castShadow = true;
  light.shadow.mapSize.set(2048, 2048);
  light.shadow.bias = -0.0004;
  // The lamp sits near the lid's height, so its shadow grazes the lid's top edge: a firmer normal bias keeps
  // that edge free of acne.
  light.shadow.normalBias = 0.045;
  light.shadow.radius = 7;
  group.add(light, light.target);
  world.add(group);
  return { group, light, bulb, reflector, head };
}

/**
 * A depth card: a plane at a given distance from the camera, covering a rect of the framed rest view
 * ([x0, y0, x1, y1] in view fractions, y from the top; rects carry their own overscan).
 */
export function placeCard(card, camera, depthFromCamera, rect, overscan = 1) {
  // Unproject the rect's corners through the camera as framed (lens shift and zoom included), then hang the
  // card at that depth facing the camera.
  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  const at = (fx, fy) => {
    const point = new THREE.Vector3(fx * 2 - 1, 1 - fy * 2, 0.5).unproject(camera);
    const direction = point.sub(camera.position).normalize();
    return camera.position.clone().addScaledVector(direction, depthFromCamera / direction.dot(forward));
  };
  const [x0, y0, x1, y1] = rect;
  const topLeft = at(x0, y0);
  const topRight = at(x1, y0);
  const bottomLeft = at(x0, y1);
  const bottomRight = at(x1, y1);
  card.position.copy(topLeft).add(topRight).add(bottomLeft).add(bottomRight).multiplyScalar(0.25);
  card.quaternion.copy(camera.quaternion);
  card.scale.set(topLeft.distanceTo(topRight) * overscan, topLeft.distanceTo(bottomLeft) * overscan, 1);
}

/** Graybox placeholder art for a card: grey shapes drawn where the reference has them (plates replace these). */
function placeholderTexture(draw, width = 1024, height = 640) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  draw(context, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function buildCards(world, palette) {
  const card = (name, texture, transparent) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: texture, transparent, depthWrite: !transparent }));
    mesh.name = name;
    world.add(mesh);
    return mesh;
  };
  // Placeholder greys as CSS strings, computed from 0–255 values.
  const grey = (v, alpha = 1) => {
    const style = new THREE.Color().setRGB(v / 255, v / 255, v / 255, THREE.SRGBColorSpace).getStyle();
    return alpha === 1 ? style : style.replace(")", `,${alpha})`).replace(/^(\w+)\(/, "$1a(");
  };
  // Placeholders are drawn in reference-frame coordinates (fractions of the reference photo), mapped into each
  // card's rect, so the graybox reads against the reference exactly where the plates will sit.
  const inCard = (layout, w, h) => {
    const [x0, y0, x1, y1] = layout.rect;
    return { x: (fx) => ((fx - x0) / (x1 - x0)) * w, y: (fy) => ((fy - y0) / (y1 - y0)) * h, sx: (fw) => (fw / (x1 - x0)) * w, sy: (fh) => (fh / (y1 - y0)) * h };
  };
  // Far room: wall, floating shelf with its under-glow, items on it, bed with backlit pillows.
  const room = placeholderTexture((c, w, h) => {
    const m = inCard(cardLayout.room, w, h);
    // A dark wall that falls off away from the shelf's glow and the lamp side (plates replace this).
    const wall = c.createRadialGradient(m.x(0.55), m.y(0.3), 0, m.x(0.55), m.y(0.3), m.sx(0.9));
    wall.addColorStop(0, grey(44));
    wall.addColorStop(1, grey(10));
    c.fillStyle = wall;
    c.fillRect(0, 0, w, h);
    const glow = c.createLinearGradient(0, m.y(0.245), 0, m.y(0.33));
    glow.addColorStop(0, grey(210));
    glow.addColorStop(1, grey(40, 0));
    c.fillStyle = glow;
    c.fillRect(m.x(0.013), m.y(0.245), m.sx(0.707), m.sy(0.085));
    c.fillStyle = grey(150);
    c.fillRect(m.x(0.013), m.y(0.225), m.sx(0.707), m.sy(0.02));
    c.fillStyle = grey(16);
    for (const [x0, y0, x1, y1] of [[0.313, 0.09, 0.357, 0.225], [0.627, 0.07, 0.707, 0.225], [0.22, 0.17, 0.247, 0.225], [0.487, 0.165, 0.507, 0.225], [0.547, 0.155, 0.573, 0.225]]) {
      c.fillRect(m.x(x0), m.y(y0), m.sx(x1 - x0), m.sy(y1 - y0));
    }
    c.fillStyle = grey(255);
    for (const [x, y] of [[0.083, 0.192], [0.59, 0.175], [0.533, 0.205]]) {
      c.beginPath();
      c.arc(m.x(x), m.y(y), m.sy(0.012), 0, Math.PI * 2);
      c.fill();
    }
    c.fillStyle = grey(190);
    for (const x of [0.15, 0.25, 0.34]) {
      c.beginPath();
      c.ellipse(m.x(x), m.y(0.42), m.sx(0.045), m.sy(0.03), 0, 0, Math.PI * 2);
      c.fill();
    }
    c.fillStyle = grey(70);
    c.fillRect(m.x(0.09), m.y(0.44), m.sx(0.28), m.sy(0.08));
    c.fillStyle = grey(24);
    c.fillRect(m.x(-0.1), m.y(0.47), m.sx(0.49), m.sy(0.23));
  });
  // The foreground chair back: a soft, defocused silhouette, dark, with the room's light faintly catching its
  // rounded top (the texture carries the shape and that rim; the colour comes from the dressing: navy-violet in
  // Flable). It sits behind the headline: a bright rim read as a glowing halo there.
  const chair = placeholderTexture((c, w, h) => {
    // A rounded backrest: a broad arch over straight sides, heavily defocused.
    const back = (inset) => {
      c.beginPath();
      c.moveTo(w * (0.1 + inset), h);
      c.lineTo(w * (0.1 + inset), h * 0.52);
      c.bezierCurveTo(w * (0.1 + inset), h * (0.1 + inset), w * (0.9 - inset), h * (0.1 + inset), w * (0.9 - inset), h * 0.52);
      c.lineTo(w * (0.9 - inset), h);
    };
    c.filter = `blur(${Math.round(w * 0.04)}px)`;
    c.fillStyle = grey(40);
    back(0);
    c.closePath();
    c.fill();
    // The room's light along the top curve: a soft rim, kept off the straight sides.
    c.filter = `blur(${Math.round(w * 0.018)}px)`;
    const rim = c.createLinearGradient(0, h * 0.12, 0, h * 0.62);
    rim.addColorStop(0, grey(110));
    rim.addColorStop(1, grey(110, 0));
    c.strokeStyle = rim;
    c.lineWidth = w * 0.026;
    back(0.02);
    c.stroke();
  }, 256, 256);
  const arc = new THREE.Mesh(
    new THREE.CylinderGeometry(roomArc.radius, roomArc.radius, roomArc.top - roomArc.bottom, 96, 1, true, Math.PI - THREE.MathUtils.degToRad(roomArc.halfAngle), THREE.MathUtils.degToRad(roomArc.halfAngle * 2)),
    new THREE.MeshBasicMaterial({ map: room, side: THREE.DoubleSide }),
  );
  arc.name = "card-room";
  arc.userData.placeholder = room;
  world.add(arc);
  return {
    room: arc,
    chair: card("card-chair", chair, true),
  };
}

// Rects carry their own overscan (wider than the frame) so the orbit and parallax never show an edge.
// The room is not a flat card: it is an arc around the laptop (radius from the orbit target), textured by
// projecting the canonical rest view, so the intro's swing still finds room. Its rect is the plate's extent in
// canonical-frame fractions (scripts/build-plates.mjs pads each shot's plate out to it; beyond it the plate's
// darkened edge colours clamp). A shot's plate carries the whole out-of-focus room: shelf, LED, bed, plant,
// curtain.
// It runs well below the desk: with a plate there is no floor in front of it, so the camera sees its lower band.
export const roomArc = { radius: 38, halfAngle: 80, bottom: -30, top: 26, rect: [-0.6, -0.35, 1.6, 2.2] };
/** Rest-view layout of the depth cards: distance from the camera (scene units) and rest-view rect. */
export const cardLayout = {
  room: { depth: 62, rect: roomArc.rect },
  // Big enough to stay in the frame through the loop's zoom, overlapping the desk's front edge (reference).
  chair: { depth: 13, rect: [-0.18, 0.54, 0.3, 1.22] },
};

export function buildWorld({ palette, seed = 7 }) {
  const random = rng(seed);
  const dress = registry();
  const group = new THREE.Group();
  const desk = buildDesk(group, palette, dress);
  buildNotebook(group, palette, dress);
  const cups = buildCups(group, palette, random, dress);
  const lamp = buildLamp(group, palette, dress);
  const cards = buildCards(group, palette);
  const plateMaterials = [cards.room.material];
  const chairTint = color(palette.chair);
  const plateTint = color(palette.plateTint);
  const shell = { value: palette.laptopShell };
  const world = {
    group,
    desk,
    lamp,
    cards,
    shell,
    /** Dresses the world for a shot (its reference look); the world palette itself is the black default. */
    applyDressing(dressing = {}) {
      const look = { ...palette, ...dressing };
      dress.apply(look);
      cups.dressPencils(look.pencils);
      plateTint.set(look.plateTint);
      chairTint.set(look.chair);
      shell.value = look.laptopShell;
    },
    /**
     * A shot's room plate (a finished photograph) on the far arc, or null for the world's own graybox room. The
     * plate bypasses tone mapping and the grade (alpha 0, as the screen does), so it keeps its own colours and
     * brightness; only the room's light (setLight) scales it.
     */
    setRoomPlate(texture) {
      const material = cards.room.material;
      material.map = texture ?? cards.room.userData.placeholder;
      material.blending = texture ? THREE.NoBlending : THREE.NormalBlending;
      material.opacity = texture ? 0 : 1;
      material.needsUpdate = true;
      // The plate carries the room's floor and bed below the desk; the graybox floor would hide them.
      group.getObjectByName("floor").visible = !texture;
    },
    /** Light level of the room (the intro's sun): the plates are unlit cards, so they follow it here. */
    setLight(amount) {
      for (const material of plateMaterials) material.color.copy(plateTint).multiplyScalar(amount);
      cards.chair.material.color.copy(chairTint).multiplyScalar(amount);
    },
    /** Places the depth cards (and projects the room arc's UVs) from a camera at its canonical rest pose. */
    layoutCards(camera, orbitTarget) {
      for (const [name, layout] of Object.entries(cardLayout)) {
        if (name !== "room") placeCard(cards[name], camera, layout.depth, layout.rect, 1);
      }
      const arc = cards.room;
      arc.position.set(orbitTarget.x, (roomArc.top + roomArc.bottom) / 2, orbitTarget.z);
      arc.updateMatrixWorld(true);
      const [x0, y0, x1, y1] = roomArc.rect;
      const position = arc.geometry.getAttribute("position");
      const uv = arc.geometry.getAttribute("uv");
      const point = new THREE.Vector3();
      for (let i = 0; i < position.count; i += 1) {
        point.fromBufferAttribute(position, i).applyMatrix4(arc.matrixWorld).project(camera);
        const fx = (point.x + 1) / 2;
        const fy = (1 - point.y) / 2;
        uv.setXY(i, (fx - x0) / (x1 - x0), 1 - (fy - y0) / (y1 - y0));
      }
      uv.needsUpdate = true;
    },
  };
  world.applyDressing();
  return world;
}
