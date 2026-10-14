import { useGLTF } from "@react-three/drei";
import { createPortal } from "@react-three/fiber";
import { forwardRef, useLayoutEffect, useMemo } from "react";
import type { MutableRefObject, ReactNode } from "react";
import * as THREE from "three";
import { lidRotation } from "./deviceSpec";

/**
 * MacBook Pro 14", from "2021 Macbook Pro 14" (M1 Pro / M1 Max)" by akshatmittal (CC BY 4.0),
 * Draco-compressed with gltf-transform. The lid is re-hung on a pivot at the hinge so it can open and
 * close, the display mesh takes the shot's screen shader, and a display anchor (in scene units, on the
 * glass) carries the breakout.
 */

const modelUrl = "/models/macbook-pro-14.glb";
const dracoPath = "/draco/";

// Measured on the model (metres, model space).
const model = {
  lidNode: "BLWpxSqmmLNyfOl",
  displayNode: "abgVijaHVNRUvcc",
  hinge: new THREE.Vector3(0, 0.0005, -0.1177),
  openAngle: 109.9,
  displayCentre: new THREE.Vector3(0, 0.10235, -0.15685),
  /** Model metres → scene units, and the lift that sits the base on y = 0 centred on the origin. */
  scale: 10,
  offset: new THREE.Vector3(0, 0.1271, 0.0587),
};

useGLTF.preload(modelUrl, dracoPath);

interface MacBookProps {
  screenMaterial: THREE.Material;
  lidRef: MutableRefObject<THREE.Group | null>;
  displayRef: MutableRefObject<THREE.Group | null>;
  /** Mounted on the display, so it tilts with the lid (the breakout lives here). */
  displayChildren?: ReactNode;
}

export const MacBook = forwardRef<THREE.Group, MacBookProps>(function MacBook({ screenMaterial, lidRef, displayRef, displayChildren }, ref) {
  const { scene } = useGLTF(modelUrl, dracoPath);

  const rig = useMemo(() => {
    const root = scene.clone(true);
    root.updateMatrixWorld(true);
    const lid = root.getObjectByName(model.lidNode);
    const display = root.getObjectByName(model.displayNode) as THREE.Mesh | undefined;
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

    display.material = screenMaterial;
    root.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    display.castShadow = false;
    return { root, pivot, anchor };
  }, [scene, screenMaterial]);

  useLayoutEffect(() => {
    lidRef.current = rig.pivot;
    displayRef.current = rig.anchor;
  }, [displayRef, lidRef, rig]);

  return (
    <group ref={ref}>
      <group scale={model.scale} position={model.offset}>
        <primitive object={rig.root} />
      </group>
      {createPortal(<>{displayChildren}</>, rig.anchor)}
    </group>
  );
});
