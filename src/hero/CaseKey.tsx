import { Html, RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { sceneColor } from "./sceneColor";

/**
 * The case study lives under one key. The MacBook's Return key turns white (the site's primary button is a
 * keycap, so the key speaks the same language), breathes softly so it is found, presses on hover with a
 * glass tooltip, and opens the case study on click. Keyboard and screen-reader users get the same link
 * in the hero HUD, because the canvas is aria-hidden.
 */

// The Return key on the scanned keyboard, in device space (scene units): measured from the model's keycaps.
const returnKey = { x: 1.219, y: 0.1296, z: -0.271, width: 0.305, depth: 0.155 };
const press = 0.006;

export function CaseKey({ href, label }: { href: string; label: string }) {
  const router = useRouter();
  const [hovered, setHovered] = useState(false);
  const cap = useRef<THREE.Mesh>(null);
  const material = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: sceneColor("--scene-night-key"),
        emissive: sceneColor("--scene-night-key-glow"),
        emissiveIntensity: 0.2,
        roughness: 0.35,
        clearcoat: 0.6,
      }),
    [],
  );

  useEffect(() => {
    document.body.style.cursor = hovered ? "var(--cursor-pointer)" : "";
    return () => {
      document.body.style.cursor = "";
    };
  }, [hovered]);

  useFrame(({ clock }, delta) => {
    // A slow breath every few seconds, held steady while hovered.
    const t = clock.elapsedTime;
    const breath = Math.pow(Math.max(0, Math.sin(t * 1.4)), 6);
    material.emissiveIntensity = THREE.MathUtils.damp(material.emissiveIntensity, hovered ? 0.9 : 0.15 + breath * 0.55, 8, delta);
    if (cap.current) cap.current.position.y = THREE.MathUtils.damp(cap.current.position.y, returnKey.y + (hovered ? 0.002 : 0.002 + press), 18, delta);
  });

  return (
    <group position={[returnKey.x, 0, returnKey.z]}>
      <RoundedBox
        ref={cap}
        args={[returnKey.width, 0.016, returnKey.depth]}
        radius={0.006}
        smoothness={3}
        position={[0, returnKey.y + press, 0]}
        material={material}
        onPointerOver={(event) => {
          event.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
        onClick={(event) => {
          event.stopPropagation();
          router.push(href);
        }}
      />
      {hovered && (
        <Html position={[0, returnKey.y + 0.14, 0]} center zIndexRange={[5, 0]} pointerEvents="none">
          <span className="case-key-tip" role="tooltip">
            {label} <span aria-hidden="true">↵</span>
          </span>
        </Html>
      )}
    </group>
  );
}
