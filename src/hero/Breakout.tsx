import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import type { MutableRefObject } from "react";
import * as THREE from "three";
import { screenshotToDisplay } from "./deviceSpec";
import type { DeviceSpec } from "./deviceSpec";
import { sceneColor } from "./sceneColor";
import type { Rect, ShotState } from "./shots/flable";

/**
 * The breakout beat: one dense row of the dashboard leaves the screen and becomes the clear answer.
 * The tiles copy their pixels from the screen texture itself, so they always match the shipped UI.
 * Assembled they are the KPI card; fanned, each metric stands alone and the lead one comes forward.
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
    vec2 sv = vec2(mix(rect.x, rect.z, vUv.x), mix(rect.y, rect.w, 1.0 - vUv.y));
    vec3 color = texture(map, vec2(sv.x, 1.0 - sv.y)).rgb;
    vec2 p = (vUv - 0.5) * size;
    float d = corner(p, size * 0.5, radii);
    float alpha = 1.0 - smoothstep(-0.004, 0.0, d);
    float edge = smoothstep(-0.03, -0.004, d) * rim;
    color = mix(color, rimColor, edge * 0.55);
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
    #include <colorspace_fragment>
  }
`;

/** Where the strip sits on the display, how far it slides out over the right bezel, and how wide the fan opens. */
export function stripLayout(spec: DeviceSpec, shotAspect: number, rect: Rect) {
  const a = screenshotToDisplay(spec, shotAspect, rect.x0, rect.y0);
  const b = screenshotToDisplay(spec, shotAspect, rect.x1, rect.y1);
  const centre = new THREE.Vector2((a.x + b.x) / 2, (a.y + b.y) / 2);
  const size = new THREE.Vector2(Math.abs(b.x - a.x), Math.abs(b.y - a.y));
  // Out over the right bezel: the left of the frame is the headline's darkened side.
  const overhang = spec.width / 2 + size.x * 0.12 - (centre.x + size.x / 2);
  return { centre, size, overhang, rise: 0.05, depth: 0.34, spread: 0.16 };
}

interface Tile {
  rect: Rect;
  centre: THREE.Vector2;
  size: THREE.Vector2;
  index: number;
}

interface BreakoutProps {
  spec: DeviceSpec;
  texture: THREE.Texture | null;
  shotAspect: number;
  rect: Rect;
  dividers: readonly number[];
  lead: number;
  state: MutableRefObject<ShotState>;
}

export function Breakout({ spec, texture, shotAspect, rect, dividers, lead, state }: BreakoutProps) {
  const groups = useRef<(THREE.Group | null)[]>([]);
  const shadow = useRef<THREE.Mesh>(null);

  const tiles = useMemo<Tile[]>(() => {
    const edges = [rect.x0, ...dividers, rect.x1];
    return edges.slice(0, -1).map((x0, index) => {
      const x1 = edges[index + 1];
      const a = screenshotToDisplay(spec, shotAspect, x0, rect.y0);
      const b = screenshotToDisplay(spec, shotAspect, x1, rect.y1);
      return {
        rect: { x0, y0: rect.y0, x1, y1: rect.y1 },
        centre: new THREE.Vector2((a.x + b.x) / 2, (a.y + b.y) / 2),
        size: new THREE.Vector2(Math.abs(b.x - a.x), Math.abs(b.y - a.y)),
        index,
      };
    });
  }, [dividers, rect, shotAspect, spec]);

  const strip = useMemo(() => stripLayout(spec, shotAspect, rect), [rect, shotAspect, spec]);

  const materials = useMemo(
    () =>
      tiles.map(
        (tile) =>
          new THREE.ShaderMaterial({
            uniforms: {
              map: { value: texture },
              rect: { value: new THREE.Vector4(tile.rect.x0, tile.rect.y0, tile.rect.x1, tile.rect.y1) },
              size: { value: tile.size.clone() },
              radii: { value: new THREE.Vector4() },
              opacity: { value: 0 },
              rim: { value: 0 },
              rimColor: { value: sceneColor("--scene-flable-tile") },
            },
            vertexShader: tileVertex,
            fragmentShader: tileFragment,
            transparent: true,
            toneMapped: false,
            depthWrite: false,
          }),
      ),
    [texture, tiles],
  );

  const backs = useMemo(
    () => tiles.map(() => new THREE.MeshBasicMaterial({ color: sceneColor("--scene-flable-halo"), transparent: true, opacity: 0, toneMapped: false, depthWrite: false })),
    [tiles],
  );

  const shadowMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          size: { value: strip.size.clone() },
          plane: { value: new THREE.Vector2(strip.size.x + 0.6, strip.size.y + 0.6) },
          softness: { value: 0.08 },
          opacity: { value: 0 },
          shade: { value: sceneColor("--scene-flable-shadow") },
        },
        vertexShader: tileVertex,
        fragmentShader: shadowFragment,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      }),
    [strip],
  );

  const { overhang } = strip;
  const cornerRadius = strip.size.y * 0.09;

  useFrame(() => {
    const { lift, fan } = state.current;
    const visible = lift > 0.002;
    const last = tiles.length - 1;
    tiles.forEach((tile, i) => {
      const group = groups.current[i];
      if (!group) return;
      group.visible = visible;
      if (!visible) return;
      const distance = Math.abs(i - lead);
      const spread = ((i - last / 2) / (last / 2)) * strip.spread * fan;
      group.position.set(
        tile.centre.x + overhang * lift + spread,
        tile.centre.y + lift * strip.rise + fan * (0.03 - distance * 0.012),
        0.006 + lift * strip.depth + fan * (0.16 - distance * 0.06),
      );
      group.rotation.set(lift * 0.16, lift * 0.22, 0);
      const scale = 1 + lift * 0.04 + (i === lead ? fan * 0.12 : -fan * distance * 0.02);
      group.scale.setScalar(scale);
      const material = materials[i];
      const r = cornerRadius;
      const outerLeft = i === 0 ? r : r * fan;
      const outerRight = i === last ? r : r * fan;
      material.uniforms.radii.value.set(outerLeft, outerRight, outerRight, outerLeft);
      material.uniforms.opacity.value = Math.min(1, lift * 3);
      material.uniforms.rim.value = lift;
      backs[i].opacity = Math.min(1, lift * 2) * 0.9;
    });
    if (shadow.current) {
      shadow.current.visible = visible;
      shadow.current.position.set(strip.centre.x + overhang * lift * 0.82 - lift * 0.06, strip.centre.y - lift * 0.1, 0.004);
      shadowMaterial.uniforms.opacity.value = lift * 0.32;
      shadowMaterial.uniforms.softness.value = 0.05 + lift * 0.14;
    }
  });

  return (
    <group>
      <mesh ref={shadow} material={shadowMaterial} renderOrder={3} visible={false}>
        <planeGeometry args={[strip.size.x + 0.6, strip.size.y + 0.6]} />
      </mesh>
      {tiles.map((tile, i) => (
        <group key={tile.index} ref={(node) => { groups.current[i] = node; }} visible={false}>
          <mesh position={[0.008, -0.012, -0.006]} material={backs[i]} renderOrder={4}>
            <planeGeometry args={[tile.size.x, tile.size.y]} />
          </mesh>
          <mesh material={materials[i]} renderOrder={5}>
            <planeGeometry args={[tile.size.x, tile.size.y]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
