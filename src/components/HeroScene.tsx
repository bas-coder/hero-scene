import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import * as THREE from "three";
import type { QualityTier } from "../types";
import { Breakout, stripLayout } from "../hero/Breakout";
import { lidRotation, macbook14 } from "../hero/deviceSpec";
import { applyFraming, convexHull, polygonHitsBox, projectPoints, screenBand, solveFraming, useHudStage } from "../hero/framing";
import type { Framing, Stage } from "../hero/framing";
import { MacBook } from "../hero/MacBook";
import { createScreenMaterial } from "../hero/screenMaterial";
import { emptyState, flableShot } from "../hero/shots/flable";
import type { ShotState } from "../hero/shots/flable";
import { clamp01, cubicBezier, easeStudio, lerp, sampleTracks } from "../hero/timeline";
import { NightDeskWorld } from "../hero/worlds/NightDeskWorld";
import { LayeredRender } from "../hero/LayeredRender";
import type { DrawnState } from "../hero/LayeredRender";
import { CaseKey } from "../hero/CaseKey";
import { caseHref } from "../content/cases";

/**
 * Hero shot runner. One product per shot: a real device inside the product's own world, moved by
 * mckp-format tracks, framed around the live HUD. Shot 01 is Flable.
 */

type RevealRef = MutableRefObject<number>;

interface HeroSceneProps {
  reveal: RevealRef;
  quality: QualityTier;
  onReady: () => void;
  /** 0 while the hero fills the view, 1 once it has scrolled away (closes the lid). */
  exit?: MutableRefObject<number>;
  /** False when the hero is off screen: rendering stops. */
  active?: boolean;
  reducedMotion?: boolean;
}

const shot = flableShot;
const spec = macbook14;
const shotAspect = shot.screens[0].width / shot.screens[0].height;
const fov = 14;
const distance = 24;
// Just above the desk, like the reference: the desk reads as a surface and the room fills the frame behind.
const elevation = 8;
const cameraTarget = new THREE.Vector3(0, 1.0, -0.25);
const parallaxYaw = 3;
const parallaxPitch = 1.5;

/**
 * Device points that bound its silhouette for a pose. The laptop never moves (it sits on the desk); the camera
 * orbits instead. Orbiting the camera by −yaw about the device's axis projects exactly like yawing the device,
 * so framing is solved in device space with the camera at rest.
 */
function devicePoints(rotY: number, lid: number, out: THREE.Vector3[] = []) {
  const points: THREE.Vector3[] = [];
  const w = spec.width / 2;
  const d = spec.depth / 2;
  for (const x of [-w, w]) for (const y of [0, spec.baseHeight]) for (const z of [-d, d]) points.push(new THREE.Vector3(x, y, z));
  const hinge = new THREE.Vector3(0, spec.hinge.y, spec.hinge.z);
  const tilt = new THREE.Euler(lidRotation(lid), 0, 0);
  for (const x of [-w, w]) {
    for (const y of [0, spec.lidHeight]) {
      for (const z of [0, -spec.lidThickness]) points.push(new THREE.Vector3(x, y, z).applyEuler(tilt).add(hinge));
    }
  }
  const yaw = new THREE.Euler(0, THREE.MathUtils.degToRad(rotY), 0);
  points.forEach((point, i) => {
    const target = out[i] ?? (out[i] = new THREE.Vector3());
    target.copy(point).applyEuler(yaw);
  });
  out.length = points.length;
  return out;
}

/** The four display corners in device space, for a pose. */
function displayPoints(rotY: number, lid: number) {
  const hinge = new THREE.Vector3(0, spec.hinge.y, spec.hinge.z);
  const tilt = new THREE.Euler(lidRotation(lid), 0, 0);
  const yaw = new THREE.Euler(0, THREE.MathUtils.degToRad(rotY), 0);
  const { width, height, centreY } = spec.display;
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) =>
    new THREE.Vector3((a * width) / 2, centreY + (b * height) / 2, 0.01).applyEuler(tilt).add(hinge).applyEuler(yaw),
  );
}

const up = new THREE.Vector3(0, 1, 0);
const orbitTarget = new THREE.Vector3();

/** The camera orbits the laptop: yaw (degrees, the device's apparent turn) and pitch over the rest elevation. */
function placeCamera(camera: THREE.PerspectiveCamera, pitch: number, yaw = 0) {
  const angle = THREE.MathUtils.degToRad(elevation + pitch);
  const azimuth = THREE.MathUtils.degToRad(-yaw);
  orbitTarget.copy(cameraTarget).applyAxisAngle(up, azimuth);
  camera.position.set(
    orbitTarget.x + Math.sin(azimuth) * Math.cos(angle) * distance,
    orbitTarget.y + Math.sin(angle) * distance,
    orbitTarget.z + Math.cos(azimuth) * Math.cos(angle) * distance,
  );
  camera.lookAt(orbitTarget);
  camera.updateMatrixWorld();
}

/** Capture mode can hold any frame: `?capture&t=7.8` (loop time) or `?capture&intro=1.2` (intro time). */
function readFixedFrame(): { phase: "intro" | "loop"; time: number } | null {
  const params = new URLSearchParams(window.location.search);
  for (const phase of ["intro", "t"] as const) {
    const value = params.get(phase);
    const time = value === null ? NaN : Number(value);
    if (Number.isFinite(time)) return { phase: phase === "t" ? "loop" : "intro", time };
  }
  return null;
}

function useScreens(quality: QualityTier) {
  const width = quality === "low" ? 1024 : 2048;
  const textures = useTexture(shot.screens.map((screen) => `${screen.src}-${width}.webp`));
  const { gl } = useThree();
  useMemo(() => {
    textures.forEach((texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = gl.capabilities.getMaxAnisotropy();
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.generateMipmaps = true;
      texture.needsUpdate = true;
    });
  }, [gl, textures]);
  return { textures, width };
}

interface ShotProps {
  reveal: RevealRef;
  exit?: MutableRefObject<number>;
  quality: QualityTier;
  reducedMotion: boolean;
}

function FlableShot({ reveal, exit, quality, reducedMotion }: ShotProps) {
  const { camera, gl, invalidate } = useThree();
  const perspective = camera as THREE.PerspectiveCamera;
  const state = useRef<ShotState>(emptyState());
  const scratch = useRef<ShotState>(emptyState());
  const device = useRef<THREE.Group>(null);
  const lid = useRef<THREE.Group>(null);
  const display = useRef<THREE.Group>(null);
  const glowCentre = useRef(new THREE.Vector3(0, 1.2, -0.6));
  const { textures, width } = useScreens(quality);
  const screen = useMemo(() => createScreenMaterial(spec.display.width / spec.display.height, spec.notch), []);
  const stage = useHudStage(gl.domElement, invalidate);
  const framing = useRef<{ version: number; value: Framing; compact: boolean } | null>(null);
  const pointer = useRef(new THREE.Vector2());
  const parallax = useRef(new THREE.Vector2());
  const loopStart = useRef<number | null>(null);
  const fixedFrame = useMemo(() => (document.documentElement.dataset.capture === "true" ? readFixedFrame() : null), []);
  const heldFrames = useRef(0);
  const drawn = useRef<DrawnState>({ ink: 0, real: 0 });
  const renderedFrames = useRef(0);
  const strip = useMemo(() => stripLayout(spec, shotAspect, shot.breakout.rect), []);

  useEffect(() => {
    const [chats, cards, table] = textures;
    screen.uniforms.map0.value = chats;
    screen.uniforms.map1.value = cards;
    screen.uniforms.map2.value = table;
    screen.uniforms.texel.value.set(1 / width, 1 / Math.round((width * shot.screens[0].height) / shot.screens[0].width));
    screen.uniforms.menubar.value = spec.menubar;
  }, [screen, textures, width]);

  // mckp's "move" with affectWholePage: the pointer anywhere on the page, so the HUD never freezes the parallax.
  useEffect(() => {
    if (reducedMotion || !window.matchMedia("(pointer: fine)").matches) return;
    const move = (event: PointerEvent) => {
      pointer.current.set((event.clientX / window.innerWidth) * 2 - 1, (event.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => window.removeEventListener("pointermove", move);
  }, [reducedMotion]);

  const restFraming = (current: Stage) => {
    const compactScale = current.compact ? shot.compactYawScale : 1;
    const points: THREE.Vector3[] = [];
    const screenCorners: THREE.Vector3[] = [];
    for (let i = 0; i <= 24; i += 1) {
      const time = (i / 24) * shot.loopDuration;
      const pose = sampleTracks(shot.loop, time, scratch.current);
      if (pose.zoom > 1.001 || pose.focus > 0.01 || pose.lift > 0.001) continue;
      points.push(...devicePoints(pose.rotY * compactScale, pose.lid).map((p) => p.clone()));
      screenCorners.push(...displayPoints(pose.rotY * compactScale, pose.lid));
    }
    perspective.clearViewOffset();
    placeCamera(perspective, 0);
    perspective.updateProjectionMatrix();
    const projected = projectPoints(points, perspective, current.width, current.height);
    const screen = { points: projectPoints(screenCorners, perspective, current.width, current.height).map((p) => p.clone()), ...screenBand(current) };
    if (current.compact) return solveFraming(projected, current, new THREE.Vector2(0.5, 0.3), Infinity, screen);
    // Centred, large, like the Bricx hero: the HUD overlaps the device's edges and the light falls off under it.
    const margin = current.height * 0.03;
    const centred: Stage = {
      ...current,
      keepOut: [],
      bounds: { left: current.width * 0.05, right: current.width * 0.95, top: current.chromeTop + margin, bottom: current.footerTop - margin * 0.5 },
    };
    // The deck may run behind the headline (Bricx); the lit screen may not.
    return solveFraming(projected, centred, new THREE.Vector2(0.5, 0.46), current.width * 0.55, screen);
  };

  const focusWorld = useMemo(() => Array.from({ length: 8 }, () => new THREE.Vector3()), []);
  const focusPixels = useRef<THREE.Vector2[]>([]);
  const shift = useMemo(() => new THREE.Vector2(), []);
  const pivot = useMemo(() => new THREE.Vector2(), []);

  useFrame((_, delta) => {
    const current = stage.current;
    if (!current || current.width === 0) return;
    if (!framing.current || framing.current.version !== current.version) {
      framing.current = { version: current.version, value: restFraming(current), compact: current.compact };
      if (reducedMotion) invalidate();
    }

    // Clock: intro rides the page's reveal; then the loop; reduced motion and captures hold one frame.
    const s = state.current;
    const introDone = reveal.current >= 1;
    if (fixedFrame) {
      sampleTracks(fixedFrame.phase === "intro" ? shot.intro : shot.loop, fixedFrame.time, s);
    } else if (reducedMotion) {
      sampleTracks(shot.loop, shot.stillTime, s);
    } else if (!introDone) {
      sampleTracks(shot.intro, reveal.current * shot.introDuration, s);
      loopStart.current = null;
    } else {
      const now = performance.now() / 1000;
      if (loopStart.current === null) loopStart.current = now;
      sampleTracks(shot.loop, (now - loopStart.current) % shot.loopDuration, s);
    }

    // Scroll exit, scrubbed.
    const leave = cubicBezier(easeStudio)(clamp01(exit?.current ?? 0));
    if (leave > 0) {
      s.lid = lerp(s.lid, shot.exit.lid, leave);
      s.power *= lerp(1, shot.exit.power, leave);
      s.rotX += shot.exit.rotX * leave;
      s.zoom *= lerp(1, shot.exit.zoom, leave);
      s.lift *= 1 - leave;
      s.fan *= 1 - leave;
    }

    const compact = framing.current.compact;
    const yawScale = compact ? shot.compactYawScale : 1;
    parallax.current.x = THREE.MathUtils.damp(parallax.current.x, pointer.current.x, 2.4, delta);
    parallax.current.y = THREE.MathUtils.damp(parallax.current.y, pointer.current.y, 2.4, delta);

    if (lid.current) {
      const rotation = lidRotation(s.lid);
      // The laptop never moves, so the lamp's shadow map is redrawn only while the lid does.
      renderedFrames.current += 1;
      if (Math.abs(rotation - lid.current.rotation.x) > 1e-4 || renderedFrames.current < 3) gl.shadowMap.needsUpdate = true;
      lid.current.rotation.x = rotation;
    }
    placeCamera(perspective, s.rotX + parallax.current.y * parallaxPitch, s.rotY * yawScale + parallax.current.x * parallaxYaw);

    const u = screen.uniforms;
    u.screen.value = s.screen;
    u.power.value = s.power;
    // The whole frame is drawn to life by the renderer now; the screen itself always shows the real UI.
    u.ink.value = 1;
    u.real.value = 1;
    drawn.current.ink = s.ink;
    drawn.current.real = s.real;
    u.focus.value = s.focus;
    u.focusRect.value.set(s.focusX, s.focusY, s.focusW, s.focusH);
    u.lifted.value = s.lift;

    display.current?.updateWorldMatrix(true, false);
    if (display.current) glowCentre.current.setFromMatrixPosition(display.current.matrixWorld);

    // Framing: rest fit, then zoom about the spotlit region, nudged so the region (and the lifted strip) stays in the stage.
    perspective.clearViewOffset();
    perspective.updateProjectionMatrix();
    const base = framing.current.value;
    shift.set(0, 0);
    let zoom = s.zoom;
    if (display.current) {
      const toLocal = (su: number, sv: number) => {
        const contentAspect = spec.display.width / spec.display.height / (1 - spec.menubar);
        const x = ((su - 0.5) * (shotAspect / contentAspect)) * spec.display.width;
        const y = (0.5 - (spec.menubar + sv * (1 - spec.menubar))) * spec.display.height;
        return [x, y] as const;
      };
      const corners = [
        toLocal(s.focusX - s.focusW / 2, s.focusY - s.focusH / 2),
        toLocal(s.focusX + s.focusW / 2, s.focusY - s.focusH / 2),
        toLocal(s.focusX + s.focusW / 2, s.focusY + s.focusH / 2),
        toLocal(s.focusX - s.focusW / 2, s.focusY + s.focusH / 2),
      ];
      corners.forEach(([x, y], i) => focusWorld[i].set(x, y, 0).applyMatrix4(display.current!.matrixWorld));
      const sx = strip.centre.x + strip.overhang * s.lift;
      const sy = strip.centre.y + strip.rise * s.lift;
      const sz = strip.depth * s.lift;
      // The fanned tiles spread wider than the strip; frame the spread, not just the strip.
      const half = strip.size.x / 2 + strip.spread * s.fan;
      [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([a, b], i) => {
        focusWorld[4 + i].set(sx + a * half, sy + (b * strip.size.y) / 2, sz).applyMatrix4(display.current!.matrixWorld);
      });
      const pixels = projectPoints(s.lift > 0.01 ? focusWorld : focusWorld.slice(0, 4), perspective, current.width, current.height, focusPixels.current);
      const centre = new THREE.Vector2();
      pixels.slice(0, 4).forEach((p) => centre.add(p));
      centre.divideScalar(4).multiplyScalar(base.scale).add(base.offset);
      pivot.copy(centre);
      // At any zoom the lit display stays inside its band: under the header, above the headline.
      // A push-in that would not fit is shortened, then the frame moves the least it can.
      {
        const w = spec.display.width / 2;
        const h = spec.display.height / 2;
        let top = Infinity;
        let bottom = -Infinity;
        [[-w, h], [w, h], [w, -h], [-w, -h]].forEach(([x, y]) => {
          const p = new THREE.Vector3(x, y, 0).applyMatrix4(display.current!.matrixWorld).project(perspective);
          const py = ((1 - p.y) / 2) * current.height * base.scale + base.offset.y;
          top = Math.min(top, py);
          bottom = Math.max(bottom, py);
        });
        const band = screenBand(current);
        zoom = Math.min(s.zoom, Math.max(1, (band.bottom - band.top) / Math.max(1, bottom - top)));
        const zTop = (top - pivot.y) * zoom + pivot.y;
        const zBottom = (bottom - pivot.y) * zoom + pivot.y;
        if (zTop < band.top) shift.y = band.top - zTop;
        if (zBottom + shift.y > band.bottom) shift.y = band.bottom - zBottom;
      }
      if (s.focus > 0.001 || s.lift > 0.001) {
        // Where the region lands after the zoom, then the smallest move that keeps it clear of the HUD.
        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;
        pixels.forEach((p) => {
          const x = (p.x * base.scale + base.offset.x - pivot.x) * zoom + pivot.x;
          const y = (p.y * base.scale + base.offset.y - pivot.y) * zoom + pivot.y;
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        });
        const { bounds } = current;
        let dx = 0;
        let dy = 0;
        if (minX < bounds.left) dx = bounds.left - minX;
        if (maxX + dx > bounds.right) dx = bounds.right - maxX;
        const band = screenBand(current);
        if (minY + shift.y < band.top) dy = band.top - (minY + shift.y);
        if (maxY + shift.y + dy > band.bottom) dy = band.bottom - (maxY + shift.y);
        shift.x = dx * Math.max(s.focus, s.lift);
        shift.y += dy * Math.max(s.focus, s.lift);
      }
    }
    applyFraming(perspective, current.width, current.height, base, zoom, pivot, shift);
    perspective.updateProjectionMatrix();

    // Posters and the HUD checks wait for a held frame drawn with final fonts and framing.
    if (fixedFrame && document.fonts.status === "loaded") {
      heldFrames.current += 1;
      if (heldFrames.current === 4) document.documentElement.dataset.heroReady = "true";
    }
  });

  return (
    <>
      <NightDeskWorld state={state} quality={quality} glowCentre={glowCentre} />
      <group ref={device}>
        <CaseKey href={caseHref("flable")} label="Open the case study" />
        <MacBook
          screenMaterial={screen.material}
          lidRef={lid}
          displayRef={display}
          displayChildren={
            <Breakout
              spec={spec}
              texture={textures[shot.breakout.screen]}
              shotAspect={shotAspect}
              rect={shot.breakout.rect}
              dividers={shot.breakout.dividers}
              lead={shot.breakout.lead}
              state={state}
            />
          }
        />
      </group>
      <HudQa state={state} stage={stage} display={display} strip={strip} />
      <LayeredRender blur={quality !== "low"} drawn={drawn} />
    </>
  );
}

/**
 * `?hud-qa`: exposes the shot to the HUD checks. The screen quad and the lifted strip are projected
 * every frame and tested against the HUD boxes; hits are counted for the QA script to read.
 */
function HudQa({
  state,
  stage,
  display,
  strip,
}: {
  state: MutableRefObject<ShotState>;
  stage: MutableRefObject<Stage | null>;
  display: MutableRefObject<THREE.Group | null>;
  strip: ReturnType<typeof stripLayout>;
}) {
  const enabled = useMemo(() => new URLSearchParams(window.location.search).has("hud-qa"), []);
  const { camera, scene } = useThree();
  const report = useRef({ frames: 0, hits: 0, last: [] as string[] });
  const points = useMemo(() => Array.from({ length: 8 }, () => new THREE.Vector3()), []);
  useEffect(() => {
    if (!enabled) return;
    (window as unknown as { __heroQa: unknown }).__heroQa = { report: report.current, stage, state, scene };
  }, [enabled, scene, stage, state]);
  useFrame(() => {
    if (!enabled || !display.current || !stage.current) return;
    const current = stage.current;
    const s = state.current;
    const w = spec.display.width / 2;
    const h = spec.display.height / 2;
    [[-w, -h], [w, -h], [w, h], [-w, h]].forEach(([x, y], i) => points[i].set(x, y, 0).applyMatrix4(display.current!.matrixWorld));
    const sx = strip.centre.x + strip.overhang * s.lift;
    const sy = strip.centre.y + strip.rise * s.lift;
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([a, b], i) => points[4 + i].set(sx + (a * strip.size.x) / 2, sy + (b * strip.size.y) / 2, strip.depth * s.lift).applyMatrix4(display.current!.matrixWorld));
    const pixels = projectPoints(points, camera as THREE.PerspectiveCamera, current.width, current.height);
    const screenQuad = convexHull(pixels.slice(0, 4).map((p) => p.clone()));
    const slab = convexHull(pixels.slice(4).map((p) => p.clone()));
    report.current.frames += 1;
    const hits: string[] = [];
    // Only HUD text boxes (copy, actions, footer) count; the chrome bars are glass over the top and bottom edges.
    current.keepOut.slice(0, 3).forEach((box, i) => {
      if (s.power > 0.05 && polygonHitsBox(screenQuad, box)) hits.push(`screen×${i}`);
      if (s.lift > 0.05 && polygonHitsBox(slab, box)) hits.push(`strip×${i}`);
    });
    if (hits.length) {
      report.current.hits += 1;
      report.current.last = hits;
    }
  });
  return null;
}

function SceneReadiness({ onReady }: { onReady: () => void }) {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    let active = true;
    const prepare = async () => {
      try {
        await gl.compileAsync(scene, camera);
        gl.render(scene, camera);
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      } finally {
        if (active) onReady();
      }
    };
    void prepare();
    return () => {
      active = false;
    };
  }, [camera, gl, onReady, scene]);
  return null;
}

export function HeroScene({ reveal, quality, onReady, exit, active = true, reducedMotion = false }: HeroSceneProps) {
  const [visible, setVisible] = useState(!document.hidden);
  useEffect(() => {
    const handleVisibility = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  // Capped pixel ratios: the scene is soft-lit and long-lens, so 1.5x is indistinguishable from 2x at half the cost.
  const dpr: [number, number] = quality === "high" ? [1, 1.5] : quality === "medium" ? [1, 1.25] : [1, 1];
  const running = visible && active;

  return (
    <Canvas
      className="hero-canvas"
      dpr={dpr}
      frameloop={!running ? "never" : reducedMotion ? "demand" : "always"}
      camera={{ fov, near: 1, far: 90, position: [0, 4, distance] }}
      gl={{ antialias: true, alpha: true, powerPreference: quality === "low" ? "default" : "high-performance" }}
      shadows={quality === "low" ? false : "percentage"}
      onCreated={({ gl }) => {
        // Shadows only change when the lid moves; FlableShot asks for a redraw then.
        gl.shadowMap.autoUpdate = false;
        gl.shadowMap.needsUpdate = true;
        gl.outputColorSpace = THREE.SRGBColorSpace;
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1;
      }}
    >
      <Suspense fallback={null}>
        <FlableShot reveal={reveal} exit={exit} quality={quality} reducedMotion={reducedMotion} />
        <SceneReadiness onReady={onReady} />
      </Suspense>
    </Canvas>
  );
}
