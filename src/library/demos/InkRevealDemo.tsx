"use client";

import { ContactShadows } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import gsap from "gsap";
import { useEffect, useMemo, useRef } from "react";
import type { ReactNode } from "react";
import * as THREE from "three";
import { InkEdges, RevealMaterial } from "../../components/ink-reveal";
import type { RevealRef } from "../../components/ink-reveal";
import { readToken } from "../../design/readToken";
import { markPosterReady } from "./poster";
import type { DemoProps } from "./poster";

const revealDuration = 4.4;
// Poster frame: ink outlines still visible while graphite shading takes over.
const posterProgress = 0.48;
// Framed for 16:10; narrower frames (4:3 posters, phones) pull the camera back so nothing is cropped.
const cameraBase = new THREE.Vector3(3.9, 2.9, 7.3);
const cameraTarget = new THREE.Vector3(0.1, 0.5, 0);
const framedAspect = 1.6;


function FitCamera() {
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  useEffect(() => {
    const scale = Math.max(1, framedAspect / (size.width / size.height));
    camera.position.copy(cameraBase).multiplyScalar(scale);
    camera.lookAt(cameraTarget);
  }, [camera, size]);
  return null;
}

/** Any mesh can take the reveal: the material greys then colours, the edges ink in and lift away. */
function Drawn({ reveal, color, position, rotation, children }: { reveal: RevealRef; color: string; position: [number, number, number]; rotation?: [number, number, number]; children: ReactNode }) {
  return (
    <mesh position={position} rotation={rotation} castShadow receiveShadow>
      {children}
      <RevealMaterial reveal={reveal} color={color} roughness={0.5} />
      <InkEdges reveal={reveal} />
    </mesh>
  );
}

/** Signals the poster capture once a few frames have rendered the held progress. */
function PosterSignal({ enabled }: { enabled: boolean }) {
  const frames = useRef(0);
  useFrame(() => {
    if (!enabled || frames.current > 12) return;
    frames.current += 1;
    if (frames.current === 12) markPosterReady();
  });
  return null;
}

export function InkRevealDemo({ poster }: DemoProps) {
  const reveal = useRef(0);
  const slider = useRef<HTMLInputElement>(null);
  const tween = useRef<gsap.core.Tween | null>(null);
  const colors = useMemo(
    () => ({
      paper: readToken("--scene-paper"),
      woodTop: readToken("--scene-wood-top"),
      cobalt: readToken("--scene-cobalt"),
      coral: readToken("--scene-coral"),
      amber: readToken("--scene-amber"),
      plaster: readToken("--scene-plaster"),
      fill: readToken("--scene-light-fill"),
      key: readToken("--scene-light-key"),
      rim: readToken("--scene-light-rim"),
    }),
    [],
  );

  const show = (value: number) => {
    reveal.current = value;
    if (slider.current) slider.current.value = String(value);
  };

  const play = () => {
    tween.current?.kill();
    show(0);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    tween.current = gsap.to(reveal, {
      current: 1,
      duration: reduced ? 0.01 : revealDuration,
      ease: "none",
      onUpdate: () => show(reveal.current),
    });
  };

  useEffect(() => {
    if (poster) {
      show(posterProgress);
      return;
    }
    play();
    return () => {
      tween.current?.kill();
    };
  }, [poster]);

  return (
    <main className="demo-stage demo-stage--canvas">
      <Canvas
        className="demo-canvas"
        dpr={[1, 2]}
        shadows
        camera={{ fov: 30, near: 0.1, far: 40 }}
        gl={{ antialias: true, alpha: true, preserveDrawingBuffer: poster }}
        onCreated={({ gl }) => {
          gl.outputColorSpace = THREE.SRGBColorSpace;
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.05;
        }}
      >
        <color attach="background" args={[colors.paper]} />
        <FitCamera />
        <PosterSignal enabled={poster} />
        <ambientLight intensity={1.25} color={colors.fill} />
        <directionalLight position={[-4.2, 4.8, 3.4]} intensity={3.6} color={colors.key} castShadow shadow-mapSize={[1024, 1024]} />
        <directionalLight position={[3.4, 2.2, 2.4]} intensity={0.85} color={colors.rim} />
        <Drawn reveal={reveal} color={colors.woodTop} position={[0, -0.07, 0]}><boxGeometry args={[4.4, 0.14, 2.6]} /></Drawn>
        <Drawn reveal={reveal} color={colors.cobalt} position={[-1.15, 0.85, -0.25]}><boxGeometry args={[1.1, 1.7, 1.1]} /></Drawn>
        <Drawn reveal={reveal} color={colors.amber} position={[-1.15, 2.01, -0.25]} rotation={[0, 0.5, 0]}><boxGeometry args={[0.62, 0.62, 0.62]} /></Drawn>
        <Drawn reveal={reveal} color={colors.coral} position={[0.35, 0.5, 0.45]}><cylinderGeometry args={[0.5, 0.5, 1, 48]} /></Drawn>
        <Drawn reveal={reveal} color={colors.plaster} position={[1.45, 0.05, -0.45]} rotation={[0, 0.3, 0]}><boxGeometry args={[1.4, 0.1, 0.95]} /></Drawn>
        <ContactShadows position={[0, 0.002, 0]} opacity={0.32} scale={9} blur={1.8} far={3} />
      </Canvas>

      {!poster && (
        <div className="demo-controls">
          <button type="button" onClick={play}>Replay</button>
          <label className="demo-scrub">
            <span className="visually-hidden">Reveal progress</span>
            <input
              ref={slider}
              type="range"
              min={0}
              max={1}
              step={0.001}
              defaultValue={0}
              onInput={(event) => {
                tween.current?.kill();
                reveal.current = Number(event.currentTarget.value);
              }}
            />
            <span className="demo-phases" aria-hidden="true"><span>Draw</span><span>Shade</span><span>Life</span></span>
          </label>
        </div>
      )}
    </main>
  );
}
