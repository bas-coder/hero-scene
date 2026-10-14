import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { lidRotation } from "./device.js";

/**
 * MacBook Pro 14", from "2021 Macbook Pro 14" (M1 Pro / M1 Max)" by akshatmittal (CC BY 4.0),
 * Draco-compressed with gltf-transform. Ported from the old MacBook.tsx: the lid is re-hung on a pivot at
 * the hinge so it can open and close, the display mesh takes the shot's screen material, and a display
 * anchor (scene units, on the glass) carries the breakout. Every material is made achromatic (the world is
 * black); the shell's value comes from the palette.
 */

const model = {
  url: "models/macbook-pro-14.glb",
  lidNode: "BLWpxSqmmLNyfOl",
  displayNode: "abgVijaHVNRUvcc",
  // Measured on the model (metres, model space).
  hinge: new THREE.Vector3(0, 0.0005, -0.1177),
  openAngle: 109.9,
  displayCentre: new THREE.Vector3(0, 0.10235, -0.15685),
  /** Model metres → scene units, and the lift that sits the base on y = 0 centred on the origin. */
  scale: 10,
  offset: new THREE.Vector3(0, 0.1271, 0.0587),
  /** The keycaps' legend layer (white glyphs over the caps). */
  legends: "SKOFticEGTqECbB",
  /** The aluminium shell materials (near-white metal in the source). */
  shell: ["zqeFZcIteZtOShc", "hPcehRUjcLAosED", "pZbDFXVUkfRwjmQ"],
};

/** The Return key on the scanned keyboard, in device space (scene units): measured from the model's keycaps. */
export const returnKey = { x: 1.219, y: 0.1296, z: -0.271, width: 0.305, depth: 0.155 };

const luminance = (color) => 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;

/** Rescales the display mesh's UVs (inset by ~0.7% in the source) so the screen image maps edge to edge. */
function normaliseDisplayUv(mesh) {
  const uv = mesh.geometry.getAttribute("uv");
  if (!uv) return;
  let u0 = Infinity;
  let u1 = -Infinity;
  let v0 = Infinity;
  let v1 = -Infinity;
  for (let i = 0; i < uv.count; i += 1) {
    u0 = Math.min(u0, uv.getX(i));
    u1 = Math.max(u1, uv.getX(i));
    v0 = Math.min(v0, uv.getY(i));
    v1 = Math.max(v1, uv.getY(i));
  }
  const geometry = mesh.geometry.clone();
  const out = new THREE.BufferAttribute(new Float32Array(uv.count * 2), 2);
  for (let i = 0; i < uv.count; i += 1) out.setXY(i, (uv.getX(i) - u0) / (u1 - u0), (uv.getY(i) - v0) / (v1 - v0));
  geometry.setAttribute("uv", out);
  mesh.geometry = geometry;
}

/**
 * Loads and rigs the laptop. Returns { group, lid (pivot: rotation.x = lidRotation(angle)), display (anchor,
 * scene units, on the glass), displayMesh, keyHit (invisible mesh over Return), materials }.
 */
export async function loadLaptop({ assetBase, palette, screenMaterial }) {
  const draco = new DRACOLoader().setDecoderPath(`${assetBase}draco/`);
  const loader = new GLTFLoader().setDRACOLoader(draco);
  const gltf = await loader.loadAsync(`${assetBase}${model.url}`);
  draco.dispose();
  const root = gltf.scene;
  root.updateMatrixWorld(true);
  const lid = root.getObjectByName(model.lidNode);
  const display = root.getObjectByName(model.displayNode);
  if (!lid || !display) throw new Error("MacBook model is missing its lid or display node");

  // Outer pivot takes lidRotation(angle) like any upright lid; the inner one restores the model's own tilt.
  const pivot = new THREE.Group();
  pivot.position.copy(model.hinge);
  pivot.rotation.x = lidRotation(model.openAngle);
  const tilt = new THREE.Group();
  tilt.rotation.x = -lidRotation(model.openAngle);
  pivot.add(tilt);
  root.add(pivot);
  root.updateMatrixWorld(true);
  tilt.attach(lid);

  const screenTilt = THREE.MathUtils.degToRad(model.openAngle - 90);
  const anchor = new THREE.Group();
  anchor.position.copy(model.displayCentre).sub(model.hinge);
  anchor.rotation.x = -screenTilt;
  anchor.translateZ(0.0004);
  anchor.scale.setScalar(1 / model.scale);
  tilt.add(anchor);

  normaliseDisplayUv(display);
  display.material = screenMaterial;

  // Achromatic: every source colour collapses to its luminance; the shell takes the dressing's metal value.
  const materials = new Set();
  const shellMaterials = [];
  root.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = true;
    child.receiveShadow = true;
    if (child === display) return;
    const material = child.material;
    if (materials.has(material)) return;
    materials.add(material);
    if (material.color) material.color.setScalar(luminance(material.color));
    // Nothing on the laptop glows by itself (the source's faint grey emissive lifted it out of the black).
    if (material.emissive) material.emissive.setScalar(0);
    if (model.shell.includes(material.name)) {
      material.metalness = palette.laptop.metalness;
      material.roughness = palette.laptop.roughness;
      shellMaterials.push(material);
    }
    material.envMapIntensity = palette.laptop.envIntensity;
    for (const texture of [material.map, material.normalMap, material.roughnessMap]) {
      if (texture) texture.anisotropy = 8;
    }
    // Key legends: at 1x they read as dark caps with faint grey glyphs, not white speckle.
    if (material.name === model.legends) material.color.setScalar(0.35);
  });
  display.castShadow = false;

  const group = new THREE.Group();
  const scaled = new THREE.Group();
  scaled.scale.setScalar(model.scale);
  scaled.position.copy(model.offset);
  scaled.add(root);
  group.add(scaled);

  // Hover target for the case study: ~40% larger than the key so a wandering cursor stays on it.
  const keyHit = new THREE.Mesh(
    new THREE.BoxGeometry(returnKey.width * 1.4, 0.06, returnKey.depth * 1.4),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  keyHit.position.set(returnKey.x, returnKey.y + 0.01, returnKey.z);
  group.add(keyHit);

  return {
    group,
    lid: pivot,
    display: anchor,
    displayMesh: display,
    keyHit,
    materials: [...materials],
    /** The aluminium's value (linear): silver for Flable, near-black for the default world. */
    setShell(value) {
      shellMaterials.forEach((material) => material.color.setScalar(value));
    },
  };
}
