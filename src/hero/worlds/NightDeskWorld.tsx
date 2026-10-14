import { ContactShadows, Environment, Lightformer, RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import type { MutableRefObject } from "react";
import * as THREE from "three";
import type { QualityTier } from "../../types";
import { layer, OnLayer } from "../LayeredRender";
import { sceneColor } from "../sceneColor";
import type { ShotState } from "../shots/flable";
import { FlableMark } from "./FlableMark";

/**
 * Shot 01 world, round 2: before sunrise at a white desk (after the reference you picked).
 * A violet room falls soft behind the laptop: a floating shelf with a pink LED strip, plants and candle
 * jars, a sheer curtain glowing at the right. On the desk, sharp: the laptop, a notebook and phone on the
 * left, and a white arm lamp on the right whose warm pool lands behind the primary CTA. The room is cool,
 * the pool is the only warm light, and the lamp's arm points down to it: the eye ends on "Start a project".
 */

// Scene units are 10 cm. The laptop sits at the origin, its front toward +z, on a desk top at y = 0.
const lampBase = new THREE.Vector3(4.55, 0, -0.9);
const lampHead = new THREE.Vector3(3.7, 1.5, 0.25);
const lampPool = new THREE.Vector3(3.6, 0, 2.0);
// The shelf hides behind the screen: its LED wash flanks the laptop like the reference, and the plants on it
// stand dark against the top of the frame, where the header sits.
const shelf = { x: -0.4, y: 1.7, z: -6.0, width: 13 };
const wallZ = -6.6;

const enableAllLayers = (light: THREE.Object3D | null) => light?.layers.enableAll();

const glowVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/** Soft light washing a wall: an elliptical falloff, additive. */
const washFragment = /* glsl */ `
  uniform vec3 color;
  uniform vec3 edge;
  uniform float strength;
  uniform vec2 shape;
  varying vec2 vUv;
  void main() {
    vec2 p = (vUv - vec2(0.5, shape.y)) * vec2(1.0, shape.x);
    float d = length(p);
    float glow = exp(-d * d * 7.0);
    vec3 tint = mix(color, edge, smoothstep(0.0, 0.5, abs(vUv.x - 0.5)));
    gl_FragColor = vec4(tint * glow * strength, 1.0);
    #include <colorspace_fragment>
  }
`;

/** A lens's out-of-focus light: a disc with a soft edge and a slightly brighter rim. */
const bokehFragment = /* glsl */ `
  uniform vec3 color;
  uniform float strength;
  varying vec2 vUv;
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    float disc = 1.0 - smoothstep(0.86, 1.0, d);
    float rim = smoothstep(0.6, 0.95, d) * disc * 0.35;
    gl_FragColor = vec4(color * (disc * 0.55 + rim) * strength, 1.0);
    #include <colorspace_fragment>
  }
`;

function Wash({ position, size, color, edge, strength, shape = [1, 0.5] }: { position: [number, number, number]; size: [number, number]; color: string; edge?: string; strength: number; shape?: [number, number] }) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { color: { value: sceneColor(color) }, edge: { value: sceneColor(edge ?? color) }, strength: { value: strength }, shape: { value: new THREE.Vector2(...shape) } },
        vertexShader: glowVertex,
        fragmentShader: washFragment,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    [color, edge, strength, shape],
  );
  return (
    <mesh position={position} material={material}>
      <planeGeometry args={size} />
    </mesh>
  );
}

function Room({ state }: { state: MutableRefObject<ShotState> }) {
  const wall = useMemo(() => new THREE.MeshStandardMaterial({ color: sceneColor("--scene-night-wall"), roughness: 0.95 }), []);
  const shelfMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: sceneColor("--scene-night-wall-lit"), roughness: 0.8 }), []);
  const led = useMemo(() => new THREE.MeshBasicMaterial({ color: sceneColor("--scene-night-led").multiplyScalar(4), toneMapped: true }), []);
  const silhouette = useMemo(() => new THREE.MeshStandardMaterial({ color: sceneColor("--scene-night-plant"), roughness: 1 }), []);
  const candle = useMemo(() => new THREE.MeshBasicMaterial({ color: sceneColor("--scene-night-bokeh").multiplyScalar(3) }), []);
  const curtain = useMemo(() => {
    const geometry = new THREE.PlaneGeometry(4.6, 12, 64, 1);
    const position = geometry.getAttribute("position");
    for (let i = 0; i < position.count; i += 1) {
      const x = position.getX(i);
      position.setZ(i, Math.sin(x * 3.4) * 0.12 + Math.sin(x * 7.1) * 0.04);
    }
    geometry.computeVertexNormals();
    return geometry;
  }, []);
  const curtainMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: sceneColor("--scene-night-curtain"), emissive: sceneColor("--scene-night-window"), emissiveIntensity: 0.55, roughness: 1, transparent: true, opacity: 0.88, side: THREE.DoubleSide }),
    [],
  );
  const ledLight = useRef<THREE.PointLight>(null);
  useFrame(() => {
    const on = state.current.sun;
    led.color.copy(sceneColor("--scene-night-led")).multiplyScalar(0.6 + 3.4 * on);
    if (ledLight.current) ledLight.current.intensity = 5 * on;
  });

  const plants = useMemo(() => {
    let seed = 5;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    return [shelf.x - 4.2, shelf.x + 3.1].map((x) =>
      Array.from({ length: 11 }, () => ({
        position: new THREE.Vector3(x + (random() - 0.5) * 0.7, shelf.y + 0.55 + random() * 0.9, shelf.z + (random() - 0.5) * 0.4),
        rotation: new THREE.Euler(0, random() * Math.PI, (random() - 0.5) * 1.6),
        scale: new THREE.Vector3(0.16 + random() * 0.1, 0.42 + random() * 0.32, 0.05),
      })),
    );
  }, []);

  return (
    <OnLayer value={layer.room}>
      <mesh position={[0, 5, wallZ]} material={wall} receiveShadow>
        <planeGeometry args={[44, 22]} />
      </mesh>
      {/* Halo behind the laptop: keeps its silhouette off the dark wall. */}
      <Wash position={[0.6, 1.4, wallZ + 0.05]} size={[13, 6]} color="--scene-night-halo" edge="--scene-night-led" strength={0.45} shape={[1.4, 0.45]} />
      {/* LED wash down the wall from under the shelf, pink in the middle, peach at the ends. */}
      <Wash position={[shelf.x, shelf.y - 1.3, wallZ + 0.04]} size={[shelf.width + 3, 4]} color="--scene-night-led" edge="--scene-night-led-warm" strength={1.25} shape={[1.6, 0.86]} />
      <mesh position={[shelf.x, shelf.y, shelf.z]} material={shelfMaterial}>
        <boxGeometry args={[shelf.width, 0.16, 1.1]} />
      </mesh>
      <mesh position={[shelf.x, shelf.y - 0.1, shelf.z + 0.5]} material={led}>
        <boxGeometry args={[shelf.width - 0.4, 0.04, 0.04]} />
      </mesh>
      <pointLight ref={(light) => { ledLight.current = light; enableAllLayers(light); }} position={[shelf.x, shelf.y - 0.4, shelf.z + 1.2]} color={sceneColor("--scene-night-led")} distance={10} decay={1.4} intensity={0} />
      {/* Plants, a book stack and candle jars on the shelf; the blur turns them into shapes and lights. */}
      {plants.map((leaves, p) => (
        <group key={p}>
          <mesh position={[leaves[0].position.x, shelf.y + 0.3, shelf.z]} material={silhouette}>
            <cylinderGeometry args={[0.26, 0.2, 0.46, 20]} />
          </mesh>
          {leaves.map((leaf, i) => (
            <mesh key={i} position={leaf.position} rotation={leaf.rotation} scale={leaf.scale} material={silhouette}>
              <sphereGeometry args={[1, 12, 8]} />
            </mesh>
          ))}
        </group>
      ))}
      <mesh position={[shelf.x - 1.2, shelf.y + 0.28, shelf.z]} material={shelfMaterial}>
        <boxGeometry args={[1.1, 0.4, 0.7]} />
      </mesh>
      {[shelf.x - 2.4, shelf.x + 0.6, shelf.x + 4.6].map((x) => (
        <mesh key={x} position={[x, shelf.y + 0.2, shelf.z + 0.1]} material={candle}>
          <cylinderGeometry args={[0.12, 0.12, 0.24, 16]} />
        </mesh>
      ))}
      {/* Sheer curtain over a violet window at the right. */}
      <Wash position={[8.6, 4.2, wallZ + 0.1]} size={[6, 12]} color="--scene-night-window" strength={0.9} shape={[0.5, 0.55]} />
      <mesh position={[8.2, 4.2, -5.2]} rotation={[0, -0.45, 0]} geometry={curtain} material={curtainMaterial} />
    </OnLayer>
  );
}

function Bokeh({ state }: { state: MutableRefObject<ShotState> }) {
  const lights = useMemo(
    () => [
      { position: [shelf.x - 2.4, shelf.y + 0.25, shelf.z + 0.2], size: 0.62, color: "--scene-night-bokeh" },
      { position: [shelf.x + 0.6, shelf.y + 0.25, shelf.z + 0.2], size: 0.5, color: "--scene-night-bokeh" },
      { position: [shelf.x + 4.6, shelf.y + 0.25, shelf.z + 0.2], size: 0.56, color: "--scene-night-bokeh" },
      { position: [shelf.x - 5.4, shelf.y - 0.9, wallZ + 0.3], size: 0.4, color: "--scene-night-bokeh-cool" },
      { position: [shelf.x + 2.2, shelf.y - 1.4, wallZ + 0.3], size: 0.34, color: "--scene-night-bokeh-cool" },
      { position: [7.2, 6.4, -5.0], size: 0.46, color: "--scene-night-bokeh-cool" },
    ] as const,
    [],
  );
  const materials = useMemo(
    () =>
      lights.map(
        (light) =>
          new THREE.ShaderMaterial({
            uniforms: { color: { value: sceneColor(light.color) }, strength: { value: 1 } },
            vertexShader: glowVertex,
            fragmentShader: bokehFragment,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            depthTest: false,
            toneMapped: false,
          }),
      ),
    [lights],
  );
  const group = useRef<THREE.Group>(null);
  useFrame(({ camera, clock }) => {
    const t = clock.elapsedTime;
    group.current?.children.forEach((child, i) => {
      child.quaternion.copy(camera.quaternion);
      materials[i].uniforms.strength.value = state.current.sun * (0.85 + 0.15 * Math.sin(t * (0.6 + i * 0.13) + i));
    });
  });
  return (
    <OnLayer value={layer.bokeh}>
      <group ref={group}>
        {lights.map((light, i) => (
          <mesh key={i} position={light.position as unknown as [number, number, number]} material={materials[i]}>
            <planeGeometry args={[light.size, light.size]} />
          </mesh>
        ))}
      </group>
    </OnLayer>
  );
}

function Lamp({ state, quality }: { state: MutableRefObject<ShotState>; quality: QualityTier }) {
  const ceramic = useMemo(() => new THREE.MeshPhysicalMaterial({ color: sceneColor("--scene-night-ceramic"), roughness: 0.32, clearcoat: 0.7, clearcoatRoughness: 0.25 }), []);
  const bulb = useMemo(() => new THREE.MeshBasicMaterial({ color: sceneColor("--scene-night-lamp"), toneMapped: false, side: THREE.DoubleSide }), []);
  const arm = useMemo(() => {
    const top = lampBase.clone().setY(1.3);
    const curve = new THREE.CatmullRomCurve3([top, top.clone().lerp(lampHead, 0.5).setY(1.85), lampHead.clone().add(new THREE.Vector3(0.14, 0.12, -0.08))]);
    return new THREE.TubeGeometry(curve, 40, 0.042, 10, false);
  }, []);
  const head = useMemo(() => {
    const profile = Array.from({ length: 18 }, (_, i) => {
      const a = (i / 17) * (Math.PI / 2);
      return new THREE.Vector2(Math.sin(a) * 0.34 + 0.02, Math.cos(a) * 0.27);
    });
    return new THREE.LatheGeometry(profile, 48);
  }, []);
  // The head aims at the pool on the desk.
  const aim = useMemo(() => {
    const direction = lampPool.clone().sub(lampHead).normalize();
    return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), direction);
  }, []);
  const spot = useRef<THREE.SpotLight>(null);
  const target = useMemo(() => {
    const object = new THREE.Object3D();
    object.position.copy(lampPool);
    object.updateMatrixWorld();
    return object;
  }, []);
  const spill = useRef<THREE.PointLight>(null);
  useFrame(() => {
    const on = state.current.sun;
    if (spot.current) spot.current.intensity = 14 * on;
    if (spill.current) spill.current.intensity = 2.2 * on;
    bulb.color.copy(sceneColor("--scene-night-lamp")).multiplyScalar(0.15 + 2.6 * on);
  });
  return (
    <group>
      <mesh position={[lampBase.x, 0.035, lampBase.z]} material={ceramic} castShadow receiveShadow>
        <cylinderGeometry args={[0.44, 0.48, 0.07, 48]} />
      </mesh>
      <mesh position={[lampBase.x, 0.68, lampBase.z]} material={ceramic} castShadow>
        <cylinderGeometry args={[0.04, 0.045, 1.26, 16]} />
      </mesh>
      <mesh geometry={arm} material={ceramic} castShadow />
      <group position={lampHead} quaternion={aim}>
        <mesh geometry={head} material={ceramic} castShadow rotation={[Math.PI, 0, 0]} />
        <mesh position={[0, -0.04, 0]} rotation={[-Math.PI / 2, 0, 0]} material={bulb}>
          <circleGeometry args={[0.3, 40]} />
        </mesh>
      </group>
      <primitive object={target} />
      {/* The shade spills a little light around the head: the pen cups and the lamp's own base. */}
      <pointLight ref={(light) => { spill.current = light; enableAllLayers(light); }} position={lampHead.clone().add(new THREE.Vector3(0, -0.15, 0))} color={sceneColor("--scene-night-lamp")} distance={3.2} decay={1.6} intensity={0} />
      <spotLight
        ref={(light) => { spot.current = light; enableAllLayers(light); }}
        position={lampHead}
        target={target}
        color={sceneColor("--scene-night-lamp-warm")}
        angle={0.5}
        penumbra={0.7}
        decay={0}
        distance={0}
        intensity={0}
        castShadow={quality !== "low"}
        shadow-mapSize={[quality === "high" ? 2048 : 1024, quality === "high" ? 2048 : 1024]}
        shadow-bias={-0.0005}
        shadow-normalBias={0.02}
        shadow-radius={5}
      />
    </group>
  );
}

function PenCups() {
  const ceramic = useMemo(() => new THREE.MeshPhysicalMaterial({ color: sceneColor("--scene-night-ceramic"), roughness: 0.55, clearcoat: 0.2 }), []);
  const body = useMemo(() => new THREE.MeshStandardMaterial({ color: sceneColor("--scene-night-pencil"), roughness: 0.5 }), []);
  const wood = useMemo(() => new THREE.MeshStandardMaterial({ color: sceneColor("--scene-night-pencil-wood"), roughness: 0.8 }), []);
  const cups = useMemo(() => {
    let seed = 9;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    return [
      { position: new THREE.Vector3(3.05, 0, -1.15), size: [0.5, 0.6, 0.5] as const },
      { position: new THREE.Vector3(3.68, 0, -0.62), size: [0.44, 0.5, 0.44] as const },
    ].map((cup) => ({
      ...cup,
      pencils: Array.from({ length: 7 }, () => ({
        offset: new THREE.Vector3((random() - 0.5) * cup.size[0] * 0.6, 0, (random() - 0.5) * cup.size[2] * 0.6),
        tilt: new THREE.Euler((random() - 0.5) * 0.35, 0, (random() - 0.5) * 0.35),
        length: 0.8 + random() * 0.3,
      })),
    }));
  }, []);
  return (
    <group>
      {cups.map((cup, c) => (
        <group key={c} position={cup.position}>
          <RoundedBox args={[cup.size[0], cup.size[1], cup.size[2]]} radius={0.03} smoothness={4} position={[0, cup.size[1] / 2, 0]} material={ceramic} castShadow receiveShadow />
          {cup.pencils.map((pencil, i) => (
            <group key={i} position={[pencil.offset.x, cup.size[1] * 0.35, pencil.offset.z]} rotation={pencil.tilt}>
              <mesh position={[0, pencil.length / 2, 0]} material={body} castShadow>
                <cylinderGeometry args={[0.02, 0.02, pencil.length, 6]} />
              </mesh>
              <mesh position={[0, pencil.length + 0.04, 0]} material={wood}>
                <coneGeometry args={[0.02, 0.08, 6]} />
              </mesh>
            </group>
          ))}
        </group>
      ))}
    </group>
  );
}

function NotebookAndPhone() {
  const cover = useMemo(() => new THREE.MeshStandardMaterial({ color: sceneColor("--scene-night-notebook"), roughness: 0.7 }), []);
  const pages = useMemo(() => new THREE.MeshStandardMaterial({ color: sceneColor("--scene-night-ceramic"), roughness: 0.9 }), []);
  const glass = useMemo(() => new THREE.MeshPhysicalMaterial({ color: sceneColor("--scene-night-phone"), roughness: 0.15, metalness: 0.2, clearcoat: 1 }), []);
  return (
    <group position={[-3.2, 0, -0.2]} rotation={[0, 0.22, 0]}>
      <RoundedBox args={[1.5, 0.08, 1.06]} radius={0.02} smoothness={3} position={[0, 0.04, 0]} material={cover} castShadow receiveShadow />
      <mesh position={[0.04, 0.06, 0]} material={pages}>
        <boxGeometry args={[1.42, 0.04, 1.0]} />
      </mesh>
      <RoundedBox args={[0.72, 0.04, 1.46]} radius={0.06} smoothness={4} position={[0.1, 0.1, 0.02]} rotation={[0, -0.12, 0]} material={glass} castShadow />
    </group>
  );
}

interface NightDeskWorldProps {
  state: MutableRefObject<ShotState>;
  quality: QualityTier;
  /** World position of the display centre (for the screen's light on the desk). */
  glowCentre: MutableRefObject<THREE.Vector3>;
}

export function NightDeskWorld({ state, quality, glowCentre }: NightDeskWorldProps) {
  const desk = useMemo(() => new THREE.MeshStandardMaterial({ color: sceneColor("--scene-night-desk"), roughness: 0.55 }), []);
  const screenLight = useRef<THREE.SpotLight>(null);
  const screenTarget = useMemo(() => new THREE.Object3D(), []);
  useFrame(() => {
    const { glow, power } = state.current;
    if (screenLight.current) {
      screenLight.current.intensity = 2.2 * power * (0.6 + glow);
      screenLight.current.position.copy(glowCentre.current);
      screenTarget.position.set(glowCentre.current.x, 0, glowCentre.current.z + 2.2);
      screenTarget.updateMatrixWorld();
    }
  });

  return (
    <>
      {/* Low ambient: the room is dark before sunrise, so the lamp, the screen and the LED shelf do the lighting. */}
      <hemisphereLight ref={enableAllLayers} args={[sceneColor("--scene-night-sky"), sceneColor("--scene-night-ground"), 0.16]} />
      {/* Window light from the right only: it rims the laptop and the lamp and leaves the headline side dark. */}
      <spotLight ref={enableAllLayers} position={[10, 4.5, -3]} color={sceneColor("--scene-night-window")} intensity={2.2} angle={0.42} penumbra={1} decay={0} distance={0} />
      <primitive object={screenTarget} />
      <spotLight
        ref={(light) => { screenLight.current = light; enableAllLayers(light); }}
        target={screenTarget}
        color={sceneColor("--scene-flable-glow")}
        angle={0.95}
        penumbra={1}
        decay={0}
        distance={0}
        intensity={0}
      />

      {/* The room's lights as softboxes, so the aluminium reflects the scene it sits in. */}
      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={2.6} color={sceneColor("--scene-night-led")} position={[shelf.x, shelf.y, shelf.z + 0.6]} rotation-x={Math.PI / 2} scale={[10, 0.3, 1]} />
        <Lightformer form="rect" intensity={1.6} color={sceneColor("--scene-night-window")} position={[8, 4, -3]} rotation-y={-Math.PI / 3} scale={[2.5, 7, 1]} />
        <Lightformer form="circle" intensity={4} color={sceneColor("--scene-night-lamp")} position={lampHead} scale={0.8} />
        <Lightformer form="rect" intensity={0.5} color={sceneColor("--scene-night-sky")} position={[0, 8, 3]} rotation-x={Math.PI / 2} scale={[12, 4, 1]} />
      </Environment>

      <Room state={state} />
      <Bokeh state={state} />

      {/* The desk: a white top with a crisp front edge, so the floor reads at a glance. */}
      <RoundedBox args={[24, 0.36, 7.6]} radius={0.05} smoothness={4} position={[0, -0.18, -0.6]} material={desk} receiveShadow />
      {/* Everything on the desk is static (only the lid moves, and its shadow is the lamp's), so this bakes once. */}
      <ContactShadows frames={1} position={[0, 0.003, 0]} scale={10} far={1.6} blur={quality === "high" ? 2.4 : 1.8} opacity={0.7} resolution={quality === "high" ? 1024 : 512} color={sceneColor("--scene-night-ground")} />

      <Lamp state={state} quality={quality} />
      <PenCups />
      <NotebookAndPhone />
      {/* The Flable mark lies in the lamp's pool like an acrylic coaster. */}
      <group position={[2.45, 0.05, 1.7]} rotation={[-Math.PI / 2, 0, 0.3]} scale={[0.85, 0.85, 0.35]}>
        <FlableMark />
      </group>
    </>
  );
}
