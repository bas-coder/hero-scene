import * as THREE from "three";
import { devicePoints, displayPoints, lidRotation, macbook14, screenToDisplay } from "./device.js";
import { applyFraming, canonicalStage, convexHull, polygonHitsBox, projectPoints, screenBand, solveFraming } from "./framing.js";
import { loadLaptop, returnKey } from "./laptop.js";
import { applyMood, createLights, createScreenLight } from "./mood.js";
import { createScreenMaterial, loadDetails, loadScreens, setScreen } from "./screen.js";
import { emptyState, screenIndex } from "./shots/flable.js";
import { getShot } from "./shots/index.js";
import { clamp01, cubicBezier, easeStudio, lerp, sampleTracks } from "./timeline.js";
import { createPost } from "./post.js";
import { buildWorld } from "./world.js";
import { createBreakout, createCaseKey } from "./breakout.js";

/**
 * The hero engine: one persistent black world, one shot at a time. Plain three.js, shared by the lab
 * (lab/hero/index.html) and the site (src/components/HeroCanvas.tsx). Colours never live here: the palette
 * and the shot moods are injected.
 *
 * createHeroRenderer(canvas, options) → { ready, setReveal, setExit, setStage, setActive, setShot, dispose, stats }
 */

const spec = macbook14;
const parallaxYaw = 3;
const parallaxPitch = 1.5;
const dprCap = { high: 1.5, medium: 1.25, low: 1 };

const up = new THREE.Vector3(0, 1, 0);
const orbitTarget = new THREE.Vector3();
// The shot's rest camera (fov, distance, elevation, target); set by createHeroRenderer.
const rig = { fov: 14, distance: 24, elevation: 5, target: new THREE.Vector3(0, 1.0, -0.25) };

/** The camera orbits the laptop: yaw (degrees, the device's apparent turn) and pitch over the rest elevation. */
function placeCamera(camera, pitch, yaw = 0) {
  const { distance, elevation, target: cameraTarget } = rig;
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

/** A small environment for the metal: emissive cards (lamp, window, LED, screen) in a black room, mood-coloured. */
function buildEnvironment(renderer, mood) {
  const scene = new THREE.Scene();
  const card = (color, strength, w, h, position, look) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(strength), side: THREE.DoubleSide }));
    mesh.position.copy(position);
    mesh.lookAt(look);
    scene.add(mesh);
  };
  const origin = new THREE.Vector3();
  // Each card sits where its light really is (Meng: a sheen must never mirror a window that is not there).
  card(mood.lamp.color, mood.env.lamp, 1.0, 1.0, new THREE.Vector3(2.75, 2.2, 0.0), new THREE.Vector3(2.4, 0, 0.9));
  card(mood.window.color, mood.env.window, 2, 8, new THREE.Vector3(10, 2, -4), origin);
  card(mood.practicals.color, mood.env.practicals, 12, 0.5, new THREE.Vector3(-1, 3, -9), origin);
  card(mood.screen.color, mood.env.screen, 3, 2, new THREE.Vector3(0, 1.2, -1.15), new THREE.Vector3(0, 1.0, 5));
  // The room behind the viewer, faintly lit by the lamp and the window: a broad, dim bounce, so faces turned to
  // the camera (page edges, the chassis sides, the lamp's arm) read by a motivated fill, not a flat ambient.
  card(mood.env.roomColor ?? mood.ambient.sky, mood.env.room ?? 0, 34, 9, new THREE.Vector3(0, 2.5, 20), new THREE.Vector3(0, 1, 0));
  // The lit desk below and in front: the chassis' front edge and the phone's rails reflect it (aluminium faces
  // turned down-forward otherwise mirror nothing and read as a black band).
  card(mood.env.deskColor ?? mood.lamp.color, mood.env.desk ?? 0, 30, 14, new THREE.Vector3(0, -5, 7), new THREE.Vector3(0, 4, 3));
  const pmrem = new THREE.PMREMGenerator(renderer);
  const target = pmrem.fromScene(scene, 0.02);
  pmrem.dispose();
  scene.traverse((child) => {
    child.geometry?.dispose();
    child.material?.dispose();
  });
  return target;
}

/** A shot's room plate: sRGB, mipmapped, clamped (the arc runs past the plate's rect into its edge colours). */
async function loadPlate(url, renderer) {
  const texture = await new THREE.TextureLoader().loadAsync(url);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

export async function createHeroRenderer(canvas, options) {
  const {
    palette,
    quality = "high",
    reducedMotion = false,
    shot: shotId = "flable",
    mood: moodOverride,
    assetBase = "",
    dressing: dressingOverride,
    fixedFrame = null,
    parallax: parallaxEnabled = !reducedMotion,
    onKeyHover,
    onKeyClick,
    onFrame,
    // The site's clocks (its GSAP intro and scroll exit), read every frame; the lab pushes values instead.
    sources = null,
    // The HUD checks (scripts/hero-qa.mjs): count frames where the lit screen or the lifted strip hits HUD text.
    qa = false,
  } = options;
  let shot = getShot(shotId);
  let mood = palette.moods[moodOverride ?? shot.mood] ?? palette.moods.base;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: quality !== "low", powerPreference: quality === "low" ? "default" : "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap[quality] ?? 1));
  // Linear HDR into the post chain, which tone-maps once (post.js).
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = quality !== "low";
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  renderer.setClearColor(new THREE.Color(palette.world.void), 1);

  const scene = new THREE.Scene();
  Object.assign(rig, shot.camera, { target: new THREE.Vector3(...shot.camera.target) });
  const camera = new THREE.PerspectiveCamera(rig.fov, 1, 1, 220);
  const world = buildWorld({ palette: palette.world });
  scene.add(world.group);
  const dressingFor = (current) => (dressingOverride === "none" ? {} : palette.dressings?.[dressingOverride ?? current.id] ?? {});
  world.applyDressing(dressingFor(shot));
  const post = createPost(renderer, { quality });
  const lights = createLights(scene);
  world.lamp.light.shadow.mapSize.setScalar(quality === "high" ? 2048 : 1024);
  world.lamp.light.castShadow = quality !== "low";

  const screen = createScreenMaterial(palette);
  const roomPlate = dressingFor(shot).roomPlate;
  const [laptop, textures, plate, details] = await Promise.all([
    loadLaptop({ assetBase, palette, screenMaterial: screen }),
    loadScreens(shot, { assetBase, quality, renderer }),
    roomPlate ? loadPlate(`${assetBase}${roomPlate}-${quality === "low" ? 1024 : 2048}.webp`, renderer) : null,
    loadDetails(shot, { assetBase, quality, renderer }),
  ]);
  world.setRoomPlate(plate);
  scene.add(laptop.group);
  laptop.setShell(world.shell.value);
  lights.screen = createScreenLight(laptop.display, spec.display);

  let environment = buildEnvironment(renderer, mood);
  scene.environment = environment.texture;

  // Breakouts: UI that lifts out of its screen (pixels copied from the screen it leaves), and the socket it leaves
  // there. The socket opens only while its tiles exist, on its own screen, so the screen never shows an empty hole.
  // The case key under Return.
  screen.uniforms.aspect.value = shot.screens[0].width / shot.screens[0].height;
  screen.uniforms.radius.value = shot.ui.radius;
  screen.uniforms.sidebar.value.set(...shot.ui.sidebar);
  const look = { ...palette.world, ...dressingFor(shot) };
  const breakouts = (shot.breakouts ?? []).map((entry, i) => ({
    entry,
    tiles: createBreakout({
      display: laptop.display,
      breakout: entry,
      texture: details[i] ?? textures[entry.screen],
      crop: details[i] ? entry.detail.crop.rect : { x0: 0, y0: 0, x1: 1, y1: 1 },
      look,
      spec,
      radius: (entry.radius ?? shot.ui.radius) * spec.display.height,
    }),
  }));
  const liftOf = (s, entry) => s[entry.lift] ?? 0;
  /** The breakout lifted most this frame (they never overlap), or null while every one sits in its screen. */
  const activeBreakout = (s) => {
    let active = null;
    for (const breakout of breakouts) if (liftOf(s, breakout.entry) > 0.002 && (!active || liftOf(s, breakout.entry) > liftOf(s, active.entry))) active = breakout;
    return active;
  };
  const caseKey = shot.caseKey ? createCaseKey({ base: laptop.group, look }) : null;

  const state = emptyState();
  const scratch = emptyState();
  let reveal = fixedFrame ? 1 : 0;
  let exit = 0;
  let stage = null;
  let framing = null;
  let active = true;
  let loopStart = null;
  let frame = 0;
  let disposed = false;
  let cardsPlaced = false;
  const pointer = new THREE.Vector2();
  const parallax = new THREE.Vector2();
  const timer = new THREE.Timer();

  const restFraming = (current, cam = camera) => {
    const compactScale = current.compact ? shot.compactYawScale : 1;
    const points = [];
    const corners = [];
    for (let i = 0; i <= 24; i += 1) {
      const pose = sampleTracks(shot.loop, (i / 24) * shot.loopDuration, scratch);
      // Rest poses are camera poses: the spotlight and the breakouts don't move the device. (Every focus or lift
      // time before the Chats beat also had zoom > 1, so the sample set is unchanged.)
      if (pose.zoom > 1.001) continue;
      points.push(...devicePoints(pose.rotY * compactScale, pose.lid));
      corners.push(...displayPoints(pose.rotY * compactScale, pose.lid));
    }
    cam.clearViewOffset();
    placeCamera(cam, 0);
    cam.aspect = current.width / current.height;
    cam.updateProjectionMatrix();
    const projected = projectPoints(points, cam, current.width, current.height).map((p) => p.clone());
    const band = { points: projectPoints(corners, cam, current.width, current.height).map((p) => p.clone()), stage: current };
    const { compact, desktop } = shot.framing;
    if (current.compact) return solveFraming(projected, current, new THREE.Vector2(...compact.anchor), current.width * compact.maxWidth, band);
    // The reference's size: the HUD may overlap the deck's edges; the lit screen stays above the headline.
    const margin = current.height * 0.03;
    const centred = {
      ...current,
      keepOut: [],
      bounds: { left: current.width * 0.05, right: current.width * 0.95, top: current.chromeTop + margin, bottom: current.footerTop - margin * 0.5 },
    };
    // The composition holds (the lamp and cups stay in frame): the device may move only a little to buy size.
    return solveFraming(projected, centred, new THREE.Vector2(...desktop.anchor), current.width * desktop.maxWidth, band, 0.12);
  };

  // Pointer: parallax anywhere on the page (fine pointers only), and the Return key under the cursor.
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let keyHovered = false;
  let lastClient = null;
  const onMove = (event) => {
    pointer.set((event.clientX / window.innerWidth) * 2 - 1, (event.clientY / window.innerHeight) * 2 - 1);
    lastClient = { x: event.clientX, y: event.clientY };
  };
  const onClick = (event) => {
    lastClient = { x: event.clientX, y: event.clientY };
    if (keyHovered) onKeyClick?.();
  };
  const fine = window.matchMedia("(pointer: fine)").matches;
  window.addEventListener("pointermove", onMove, { passive: true });
  window.addEventListener("click", onClick);

  const keyWorld = new THREE.Vector3();
  const keyPixel = new THREE.Vector3();
  function updateKey() {
    if (!lastClient || !onKeyHover) return;
    const rect = canvas.getBoundingClientRect();
    const inside = lastClient.x >= rect.left && lastClient.x <= rect.right && lastClient.y >= rect.top && lastClient.y <= rect.bottom;
    let hit = false;
    if (inside && state.lid > 60 && exit < 0.5) {
      ndc.set(((lastClient.x - rect.left) / rect.width) * 2 - 1, -((lastClient.y - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      hit = raycaster.intersectObject(laptop.keyHit, false).length > 0;
    }
    keyWorld.set(returnKey.x, returnKey.y + 0.14, returnKey.z).applyMatrix4(laptop.group.matrixWorld);
    keyPixel.copy(keyWorld).project(camera);
    keyHovered = hit;
    onKeyHover({ hovered: hit, x: ((keyPixel.x + 1) / 2) * rect.width, y: ((1 - keyPixel.y) / 2) * rect.height });
  }

  // The lifted tile under the cursor (fine pointers, full motion, a breakout out), against last frame's pose.
  function pickTile(s) {
    const active = activeBreakout(s);
    if (!active || !fine || reducedMotion || !lastClient || liftOf(s, active.entry) < 0.6 || exit > 0.05) return null;
    const rect = canvas.getBoundingClientRect();
    if (lastClient.x < rect.left || lastClient.x > rect.right || lastClient.y < rect.top || lastClient.y > rect.bottom) return null;
    ndc.set(((lastClient.x - rect.left) / rect.width) * 2 - 1, -((lastClient.y - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    return active.tiles.pick(raycaster);
  }

  const focusWorld = Array.from({ length: 4 }, () => new THREE.Vector3());
  const focusPixels = [];
  const shift = new THREE.Vector2();
  const pivot = new THREE.Vector2();

  function sample(delta) {
    if (sources?.reveal) reveal = sources.reveal();
    if (sources?.exit) exit = sources.exit();
    if (fixedFrame) {
      const tracks = fixedFrame.phase === "intro" ? shot.intro : shot.loop;
      sampleTracks(tracks, fixedFrame.time, state);
    } else if (reducedMotion) {
      sampleTracks(shot.loop, shot.stillTime, state);
    } else if (reveal < 1) {
      sampleTracks(shot.intro, reveal * shot.introDuration, state);
      loopStart = null;
    } else {
      const now = performance.now() / 1000;
      if (loopStart === null) loopStart = now;
      sampleTracks(shot.loop, (now - loopStart) % shot.loopDuration, state);
    }
    const leave = cubicBezier(easeStudio)(clamp01(fixedFrame?.phase === "exit" ? fixedFrame.time : exit));
    if (leave > 0) {
      state.lid = lerp(state.lid, shot.exit.lid, leave);
      state.power *= lerp(1, shot.exit.power, leave);
      state.rotX += shot.exit.rotX * leave;
      state.zoom *= lerp(1, shot.exit.zoom, leave);
      state.lift *= 1 - leave;
      state.fan *= 1 - leave;
      for (const { lift } of shot.breakouts ?? []) state[lift] *= 1 - leave;
    }
    if (parallaxEnabled && fine && !fixedFrame) {
      parallax.x = THREE.MathUtils.damp(parallax.x, pointer.x, 2.4, delta);
      parallax.y = THREE.MathUtils.damp(parallax.y, pointer.y, 2.4, delta);
    }
  }

  function render() {
    if (!stage || stage.width === 0) return false;
    timer.update();
    const delta = Math.min(timer.getDelta(), 1 / 15);
    if (!framing || framing.version !== stage.version) {
      framing = { version: stage.version, value: restFraming(stage), compact: stage.compact };
      const width = Math.round(stage.width);
      const height = Math.round(stage.height);
      renderer.setSize(width, height, false);
      post.setSize(Math.round(width * renderer.getPixelRatio()), Math.round(height * renderer.getPixelRatio()));
      camera.aspect = width / height;
      if (!cardsPlaced) {
        // The depth cards are laid out once, in world space, from the canonical desktop rest view (loop start,
        // no zoom): the room sits where the reference has it, and phones see a narrower slice of the same room.
        const canonical = canonicalStage();
        const reference = new THREE.PerspectiveCamera(rig.fov, canonical.width / canonical.height, 1, 220);
        const restCanonical = restFraming(canonical, reference);
        placeCamera(reference, 0, shot.loop.rotY[0].v);
        applyFraming(reference, canonical.width, canonical.height, restCanonical, 1);
        reference.updateProjectionMatrix();
        world.layoutCards(reference, rig.target);
        cardsPlaced = true;
      }
    }
    sample(delta);
    const s = state;
    const yawScale = framing.compact ? shot.compactYawScale : 1;

    const rotation = lidRotation(s.lid);
    if (Math.abs(rotation - laptop.lid.rotation.x) > 1e-4 || frame < 3) renderer.shadowMap.needsUpdate = true;
    laptop.lid.rotation.x = rotation;
    placeCamera(camera, s.rotX + parallax.y * parallaxPitch, s.rotY * yawScale + parallax.x * parallaxYaw);

    setScreen(screen, textures, s.screen);
    screen.uniforms.power.value = s.power;
    screen.uniforms.focus.value = s.focus;
    screen.uniforms.focusRect.value.set(s.focusX, s.focusY, s.focusW, s.focusH);
    screen.uniforms.focusRadius.value = s.focusR;
    // The socket follows the breakout that is out, and opens only on that breakout's own screen.
    const active = activeBreakout(s);
    if (active) {
      const { rect, radius, screen: home } = active.entry;
      screen.uniforms.socketRect.value.set(rect.x0, rect.y0, rect.x1, rect.y1);
      screen.uniforms.radius.value = radius ?? shot.ui.radius;
      screen.uniforms.lifted.value = screenIndex(Math.floor(s.screen)) === home ? liftOf(s, active.entry) : 0;
      screen.uniforms.refill.value = active.entry.motion?.refill ?? 0.3;
    } else {
      screen.uniforms.lifted.value = 0;
    }
    const hover = pickTile(s);
    for (const { entry, tiles } of breakouts) {
      tiles.update(liftOf(s, entry), entry.fan ? s[entry.fan] : 0, delta, hover?.id === entry.id ? hover : null, camera.position, Boolean(stage?.compact));
    }
    // Held frames breathe at their own time, so captures stay deterministic.
    caseKey?.update(fixedFrame ? 1 : delta, fixedFrame ? fixedFrame.time : performance.now() / 1000, keyHovered);
    const level = applyMood({ lights, lamp: world.lamp }, mood, { sun: s.sun, power: s.power, glow: s.glow });
    // Black by default: the room, its reflections and its plates come up with the shot's (staged) light.
    scene.environmentIntensity = mood.env.intensity * Math.max(level.room, 0.12 * level.lamp);
    world.setLight(level.room);

    // Framing: rest fit, then zoom about the spotlit region; the lit display stays inside its band.
    camera.clearViewOffset();
    camera.updateProjectionMatrix();
    laptop.group.updateMatrixWorld(true);
    const base = framing.value;
    shift.set(0, 0);
    let zoom = s.zoom;
    const anchor = laptop.display;
    const corners = [
      [s.focusX - s.focusW / 2, s.focusY - s.focusH / 2],
      [s.focusX + s.focusW / 2, s.focusY - s.focusH / 2],
      [s.focusX + s.focusW / 2, s.focusY + s.focusH / 2],
      [s.focusX - s.focusW / 2, s.focusY + s.focusH / 2],
    ];
    corners.forEach(([u, v], i) => {
      const local = screenToDisplay(u, v);
      focusWorld[i].set(local.x, local.y, 0).applyMatrix4(anchor.matrixWorld);
    });
    const pixels = projectPoints(focusWorld, camera, stage.width, stage.height, focusPixels);
    const centre = new THREE.Vector2();
    pixels.forEach((p) => centre.add(p));
    centre.divideScalar(4).multiplyScalar(base.scale).add(base.offset);
    pivot.copy(centre);
    let band;
    {
      const w = spec.display.width / 2;
      const h = spec.display.height / 2;
      let top = Infinity;
      let bottom = -Infinity;
      let left = Infinity;
      let right = -Infinity;
      [[-w, h], [w, h], [w, -h], [-w, -h]].forEach(([x, y]) => {
        const p = new THREE.Vector3(x, y, 0).applyMatrix4(anchor.matrixWorld).project(camera);
        const px = ((p.x + 1) / 2) * stage.width * base.scale + base.offset.x;
        const py = ((1 - p.y) / 2) * stage.height * base.scale + base.offset.y;
        left = Math.min(left, px);
        right = Math.max(right, px);
        top = Math.min(top, py);
        bottom = Math.max(bottom, py);
      });
      // The band for the screen's span at its widest this frame (fully zoomed about the pivot).
      band = screenBand(stage, { left: (left - pivot.x) * s.zoom + pivot.x, right: (right - pivot.x) * s.zoom + pivot.x });
      zoom = Math.min(s.zoom, Math.max(1, (band.bottom - band.top) / Math.max(1, bottom - top)));
      const zTop = (top - pivot.y) * zoom + pivot.y;
      const zBottom = (bottom - pivot.y) * zoom + pivot.y;
      if (zTop < band.top) shift.y = band.top - zTop;
      if (zBottom + shift.y > band.bottom) shift.y = band.bottom - zBottom;
    }
    if (s.focus > 0.001) {
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
      const { bounds } = stage;
      let dx = 0;
      let dy = 0;
      if (minX < bounds.left) dx = bounds.left - minX;
      if (maxX + dx > bounds.right) dx = bounds.right - maxX;
      if (minY + shift.y < band.top) dy = band.top - (minY + shift.y);
      if (maxY + shift.y + dy > band.bottom) dy = band.bottom - (maxY + shift.y);
      shift.x = dx * s.focus;
      shift.y += dy * s.focus;
    }
    applyFraming(camera, stage.width, stage.height, base, zoom, pivot, shift);
    camera.updateProjectionMatrix();

    post.render(scene, camera, mood.grade, fixedFrame ? 0 : frame % 97, level.room, { ink: s.ink, real: s.real, sketch: mood.sketch });
    if (qaReport) checkHud(s, anchor);
    updateKey();
    frame += 1;
    onFrame?.(frame, s);
    return true;
  }

  // HUD checks: the screen quad and the lifted strip, projected as framed, against the HUD text boxes.
  const qaReport = qa ? { frames: 0, hits: 0, last: [] } : null;
  function checkHud(s, anchor) {
    const w = spec.display.width / 2;
    const h = spec.display.height / 2;
    const quad = [[-w, -h], [w, -h], [w, h], [-w, h]].map(([x, y]) => new THREE.Vector3(x, y, 0).applyMatrix4(anchor.matrixWorld));
    const screenQuad = convexHull(projectPoints(quad, camera, stage.width, stage.height).map((p) => p.clone()));
    const tiles = breakouts.flatMap(({ entry, tiles: breakout }) => (liftOf(s, entry) > 0.05 ? breakout.corners() : []));
    const slab = tiles.length ? convexHull(projectPoints(tiles, camera, stage.width, stage.height).map((p) => p.clone())) : null;
    qaReport.frames += 1;
    const hits = [];
    // Only HUD text boxes (copy, actions, footer) count; the chrome bars are glass over the top and bottom edges.
    stage.keepOut.slice(0, 3).forEach((box, i) => {
      if (s.power > 0.05 && polygonHitsBox(screenQuad, box)) hits.push(`screen×${i}`);
      if (slab && polygonHitsBox(slab, box)) hits.push(`strip×${i}`);
    });
    if (hits.length) {
      qaReport.hits += 1;
      qaReport.last = hits;
    }
  }

  let raf = 0;
  const loop = () => {
    raf = 0;
    if (disposed || !active) return;
    render();
    if (!fixedFrame && !reducedMotion) raf = requestAnimationFrame(loop);
  };
  const kick = () => {
    if (!raf && !disposed) raf = requestAnimationFrame(loop);
  };
  const onVisibility = () => {
    active = !document.hidden;
    if (active) kick();
  };
  document.addEventListener("visibilitychange", onVisibility);

  // Compile every program before the first frame, off the main thread where the browser allows it, and for
  // the HDR target the frames render into (compiling for the canvas would compile them all a second time).
  renderer.setRenderTarget(post.target);
  await renderer.compileAsync(scene, camera);
  renderer.setRenderTarget(null);

  /** Renders frames free-running and reports median / p95 ms (render + GPU finish). */
  async function bench(frames = 180) {
    const gl = renderer.getContext();
    const times = [];
    const held = fixedFrame;
    for (let i = 0; i < frames; i += 1) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const start = performance.now();
      render();
      gl.finish();
      times.push(performance.now() - start);
    }
    void held;
    times.sort((a, b) => a - b);
    return { median: +times[Math.floor(times.length / 2)].toFixed(2), p95: +times[Math.floor(times.length * 0.95)].toFixed(2), dpr: renderer.getPixelRatio() };
  }

  return {
    renderer,
    scene,
    camera,
    state,
    bench,
    qa: qaReport,
    /** The live stage the frame is framed against (for the HUD checks). */
    get stage() {
      return stage;
    },
    /** Renders `count` frames now (held frames, demand rendering) and resolves after the last. */
    async renderFrames(count = 1) {
      for (let i = 0; i < count; i += 1) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
        render();
      }
    },
    setReveal(value) {
      reveal = value;
      if (reducedMotion) kick();
    },
    setExit(value) {
      exit = value;
      if (reducedMotion || fixedFrame) kick();
    },
    setStage(next) {
      stage = next;
      kick();
    },
    setActive(value) {
      active = value;
      if (active) kick();
    },
    setMood(name) {
      mood = palette.moods[name] ?? mood;
      environment.dispose();
      environment = buildEnvironment(renderer, mood);
      scene.environment = environment.texture;
      kick();
    },
    setShot(id) {
      shot = getShot(id);
      world.applyDressing(dressingFor(shot));
      laptop.setShell(world.shell.value);
      kick();
    },
    start: kick,
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("click", onClick);
      document.removeEventListener("visibilitychange", onVisibility);
      environment.dispose();
      textures.forEach((texture) => texture.dispose());
      // The breakouts' detail crops live in their tiles' uniforms, which the material sweep below never sees.
      details.forEach((texture) => texture?.dispose());
      scene.traverse((child) => {
        child.geometry?.dispose();
        const materials = Array.isArray(child.material) ? child.material : child.material ? [child.material] : [];
        materials.forEach((material) => {
          material.map?.dispose();
          material.dispose();
        });
      });
      post.dispose();
      renderer.dispose();
    },
  };
}

// The site's entry points (src/components/HeroCanvas.tsx): one module, typed by index.d.ts.
export { watchStage } from "./framing.js";
export { heroPalette, readCssToken, resolvePalette } from "./palette.js";
export { getShot } from "./shots/index.js";
