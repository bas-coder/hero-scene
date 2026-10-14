import { Edges, RoundedBox } from "@react-three/drei";
import type { EdgesRef } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import type { MutableRefObject } from "react";
import * as THREE from "three";
import { readToken } from "../design/readToken";

/**
 * Ink-to-render reveal. One progress value (0 → 1) drives three overlapping phases:
 * draw (dashed ink contours trace the form), shade (paper greys into graphite), life (real material arrives, ink lifts).
 */
export type RevealRef = MutableRefObject<number>;

const drawEnd = 0.34;
const shadeStart = 0.3;
const shadeEnd = 0.66;
const lifeStart = 0.62;
const edgeLength = 14;

export function phaseDraw(value: number) {
  return THREE.MathUtils.smoothstep(value, 0, drawEnd);
}

export function phaseShade(value: number) {
  return THREE.MathUtils.smoothstep(value, shadeStart, shadeEnd);
}

export function phaseLife(value: number) {
  return THREE.MathUtils.smoothstep(value, lifeStart, 1);
}

interface InkPalette {
  ink: string;
  paper: string;
  shade: string;
  pure: string;
}

let inkPaletteCache: InkPalette | null = null;

/** Scene colours come from the design-system `--scene-*` tokens. */
export function inkPalette(): InkPalette {
  inkPaletteCache ??= {
    ink: readToken("--scene-metal-ink"),
    paper: readToken("--scene-paper"),
    shade: readToken("--scene-shade"),
    pure: readToken("--scene-pure"),
  };
  return inkPaletteCache;
}

export function InkEdges({ reveal, color }: { reveal: RevealRef; color?: string }) {
  const ink = color ?? inkPalette().ink;
  const edges = useRef<EdgesRef>(null);
  useFrame(() => {
    const material = edges.current?.material;
    if (!material || !edges.current) return;
    const draw = phaseDraw(reveal.current);
    const life = phaseLife(reveal.current);
    material.transparent = true;
    material.dashSize = Math.max(draw * edgeLength, 0.001);
    material.gapSize = edgeLength;
    material.opacity = draw * (1 - life);
    edges.current.visible = material.opacity > 0.02;
  });
  return (
    <Edges
      ref={edges}
      threshold={18}
      color={ink}
      scale={1.002}
      lineWidth={1.2}
      dashed
      transparent
      dashSize={0.001}
      gapSize={edgeLength}
    />
  );
}

export function RevealMaterial({
  reveal,
  color,
  roughness = 0.55,
  metalness = 0,
  map = null,
}: {
  reveal: RevealRef;
  color: string;
  roughness?: number;
  metalness?: number;
  map?: THREE.Texture | null;
}) {
  const material = useRef<THREE.MeshStandardMaterial>(null);
  const palette = inkPalette();
  const target = useMemo(() => new THREE.Color(color), [color]);
  const paper = useMemo(() => new THREE.Color(palette.paper), [palette.paper]);
  const graphite = useMemo(() => new THREE.Color(palette.shade), [palette.shade]);
  const white = useMemo(() => new THREE.Color(palette.pure), [palette.pure]);
  useFrame(() => {
    if (!material.current) return;
    const shade = phaseShade(reveal.current);
    const life = phaseLife(reveal.current);
    material.current.color.copy(paper).lerp(graphite, shade * (1 - life) * 0.72);
    material.current.color.lerp(map ? white : target, life);
    material.current.map = map && life > 0.04 ? map : null;
    material.current.roughness = THREE.MathUtils.lerp(0.95, roughness, life);
    material.current.metalness = metalness * life;
  });
  return <meshStandardMaterial ref={material} color={palette.paper} roughness={0.95} />;
}

export function DrawnRoundedBox({
  reveal,
  args,
  position,
  rotation,
  color,
  radius = 0.08,
  roughness,
  metalness,
  castShadow = true,
}: {
  reveal: RevealRef;
  args: [number, number, number];
  position: [number, number, number];
  rotation?: [number, number, number];
  color: string;
  radius?: number;
  roughness?: number;
  metalness?: number;
  castShadow?: boolean;
}) {
  return (
    <RoundedBox args={args} radius={radius} smoothness={4} position={position} rotation={rotation} castShadow={castShadow} receiveShadow>
      <RevealMaterial reveal={reveal} color={color} roughness={roughness} metalness={metalness} />
      <InkEdges reveal={reveal} />
    </RoundedBox>
  );
}
