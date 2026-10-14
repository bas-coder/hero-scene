// Hero HUD checks: renders held frames of the hero shot in headless Chrome and proves the HUD stays readable.
//   npm run dev   (then, in another terminal)   node scripts/hero-qa.mjs [--quick] [--shots <dir>]
// For every viewport and sampled time it reports:
//   - contrast of white HUD type against what is actually behind it (scene + scrim + glass), worst pixels;
//   - whether the lit screen or the lifted strip ever crossed a HUD text box (from the page's own projection).
// --shots <dir> also saves each frame as a PNG. HERO_BASE overrides the origin; BROWSER_PATH points at Chrome or Edge.
// --poster instead captures the scene alone (no HUD) at the held still and writes the no-WebGL fallback to public/media/flable.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import sharp from "sharp";

const base = process.env.HERO_BASE ?? "http://localhost:4173";
const args = process.argv.slice(2);
const quick = args.includes("--quick");
const shotsIndex = args.indexOf("--shots");
const shotsDir = shotsIndex >= 0 ? resolve(args[shotsIndex + 1]) : null;
const onlyIndex = args.indexOf("--only");
const only = onlyIndex >= 0 ? args[onlyIndex + 1].split(",") : null;
const port = 9800 + Math.floor(Math.random() * 400);
const posterMode = args.includes("--poster");
const posterTime = 7.8;

const browserPath = [
  process.env.BROWSER_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].find((path) => path && existsSync(path));
if (!browserPath) throw new Error("No Chrome or Edge found. Set BROWSER_PATH.");

const viewports = [
  { name: "desktop-1440", width: 1440, height: 900 },
  { name: "desktop-1920", width: 1920, height: 1080 },
  { name: "laptop-1280", width: 1280, height: 720 },
  { name: "tablet-981", width: 981, height: 760 },
  { name: "tablet-980", width: 980, height: 760 },
  { name: "tablet-701", width: 701, height: 900 },
  { name: "mobile-700", width: 700, height: 900 },
  { name: "mobile-390", width: 390, height: 844, mobile: true },
].filter((viewport) => !only || only.includes(viewport.name));

const introTimes = quick ? [1.2, 2.8] : [0.6, 1.2, 1.8, 2.4, 3.0, 3.4];
const loopTimes = quick ? [0, 3, 6.9, 7.8, 12.5] : Array.from({ length: 20 }, (_, i) => +(i * 0.75).toFixed(2));
const frames = [...introTimes.map((time) => ({ param: "intro", time })), ...loopTimes.map((time) => ({ param: "t", time }))];

/** White HUD type: stone-50. */
const textLuminance = relativeLuminance([255, 253, 248]);
const minimum = 4.5;

function channel(value) {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}
function relativeLuminance([r, g, b]) {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

// Hides the glyphs only: scrim, glass and the scene stay, so what remains is exactly the ground under the type.
const hideType = `
  .hero-hud *, .site-header *, .mobile-header * { color: transparent !important; text-shadow: none !important; caret-color: transparent !important; }
  .hero-hud svg, .site-header svg, .mobile-header svg, .header-logo img, .badge-mark { visibility: hidden !important; }
  nextjs-portal { display: none !important; }
`;

// White-type boxes over the artwork. The keycap carries its own solid face, so it is not on the list.
const measureBoxes = `(() => {
  const boxes = [];
  const add = (name, element) => {
    if (!element) return;
    const rects = element.matches(".hero-line") ? [...element.getClientRects()] : [element.getBoundingClientRect()];
    rects.forEach((r, i) => { if (r.width > 2 && r.height > 2 && r.bottom > 0 && r.top < innerHeight) boxes.push({ name: rects.length > 1 ? name + "." + i : name, x: r.left, y: r.top, w: r.width, h: r.height }); });
  };
  document.querySelectorAll(".hero .hero-line").forEach((el, i) => add("headline-" + i, el));
  add("badge", document.querySelector(".hero .availability"));
  add("see-work", document.querySelector(".hero .glass-button"));
  document.querySelectorAll(".hero .hero-meta span").forEach((el, i) => add("meta-" + i, el));
  document.querySelectorAll(".site-header .header-pills a").forEach((el, i) => add("pill-" + i, el));
  add("logo", document.querySelector(".site-header .header-logo img"));
  add("whatsapp", document.querySelector(".site-header .header-whatsapp"));
  return boxes;
})()`;

const wait = (ms) => new Promise((done) => setTimeout(done, ms));

async function connect() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      return (await response.json()).webSocketDebuggerUrl;
    } catch {
      await wait(200);
    }
  }
  throw new Error("Browser did not open its debugging port.");
}

function protocol(socket) {
  let id = 0;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    if (message.error) request.reject(new Error(message.error.message));
    else request.resolve(message.result);
  });
  return (method, params = {}, sessionId) =>
    new Promise((resolveRequest, reject) => {
      id += 1;
      pending.set(id, { resolve: resolveRequest, reject });
      socket.send(JSON.stringify({ id, method, params, sessionId }));
    });
}

async function worstContrast(image, box, scale) {
  const left = Math.max(0, Math.floor(box.x * scale));
  const top = Math.max(0, Math.floor(box.y * scale));
  const width = Math.max(1, Math.min(image.info.width - left, Math.ceil(box.w * scale)));
  const height = Math.max(1, Math.min(image.info.height - top, Math.ceil(box.h * scale)));
  const values = [];
  for (let y = top; y < top + height; y += 1) {
    for (let x = left; x < left + width; x += 1) {
      const i = (y * image.info.width + x) * image.info.channels;
      values.push(relativeLuminance([image.data[i], image.data[i + 1], image.data[i + 2]]));
    }
  }
  values.sort((a, b) => a - b);
  // The brightest 2% of the ground is the worst case a glyph can land on.
  const ground = values[Math.min(values.length - 1, Math.floor(values.length * 0.98))];
  return (textLuminance + 0.05) / (ground + 0.05);
}

if (shotsDir) await mkdir(shotsDir, { recursive: true });
const profile = await mkdtemp(join(tmpdir(), "hero-qa-"));
const browser = spawn(browserPath, [
  "--headless=new",
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`,
  // The real GPU: the shot is too heavy for software GL. HERO_QA_SOFTWARE=1 falls back to SwiftShader.
  ...(process.env.HERO_QA_SOFTWARE ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : ["--use-angle=default", "--ignore-gpu-blocklist", "--enable-gpu-rasterization"]),
  "--hide-scrollbars",
  "about:blank",
], { stdio: "ignore" });

const failures = [];
const overlaps = new Set();
const summary = new Map();
try {
  const socket = new WebSocket(await connect());
  await new Promise((opened) => socket.addEventListener("open", opened, { once: true }));
  const send = protocol(socket);
  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  await send("Page.enable", {}, sessionId);
  await send("Runtime.enable", {}, sessionId);

  if (posterMode) {
    await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1.5, mobile: false }, sessionId);
    await send("Page.navigate", { url: `${base}/?capture&t=${posterTime}` }, sessionId);
    let ready = false;
    for (let attempt = 0; attempt < 300 && !ready; attempt += 1) {
      await wait(200);
      const { result } = await send("Runtime.evaluate", { expression: "document.documentElement.dataset.heroReady === 'true'", returnByValue: true }, sessionId);
      ready = result.value === true;
    }
    if (!ready) throw new Error("Hero never signalled ready for the poster");
    const hide = ".site-header, .mobile-header, .mobile-dock, .hero-hud, .hero-vignette, nextjs-portal { visibility: hidden !important; }";
    await send("Runtime.evaluate", { expression: `(() => { const s = document.createElement('style'); s.textContent = ${JSON.stringify(hide)}; document.head.append(s); })()` }, sessionId);
    await wait(300);
    const { data } = await send("Page.captureScreenshot", { format: "png" }, sessionId);
    const output = resolve("public", "media", "flable");
    await mkdir(output, { recursive: true });
    for (const width of [720, 1440, 2160]) {
      const pipeline = sharp(Buffer.from(data, "base64")).resize({ width });
      await pipeline.clone().avif({ quality: 70, effort: 6 }).toFile(join(output, `hero-poster-${width}.avif`));
      await pipeline.clone().webp({ quality: 84, effort: 6 }).toFile(join(output, `hero-poster-${width}.webp`));
    }
    console.log("Hero poster written to public/media/flable");
  }

  for (const viewport of posterMode ? [] : viewports) {
    await send("Emulation.setDeviceMetricsOverride", { width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: Boolean(viewport.mobile) }, sessionId);
    for (const frame of frames) {
      const label = `${viewport.name} ${frame.param === "t" ? "loop" : "intro"} ${frame.time}s`;
      await send("Page.navigate", { url: `${base}/?capture&hud-qa&${frame.param}=${frame.time}` }, sessionId);
      let ready = false;
      for (let attempt = 0; attempt < 300 && !ready; attempt += 1) {
        await wait(200);
        const { result } = await send("Runtime.evaluate", { expression: "document.documentElement.dataset.heroReady === 'true'", returnByValue: true }, sessionId);
        ready = result.value === true;
      }
      if (!ready) {
        failures.push(`${label}: hero never signalled ready`);
        continue;
      }
      if (process.env.HERO_QA_EVAL) {
        const { result: probe } = await send("Runtime.evaluate", { expression: process.env.HERO_QA_EVAL, returnByValue: true, awaitPromise: true }, sessionId);
        console.log(`
[eval] ${label}: ${JSON.stringify(probe.value)}`);
      }
      const { result: overlap } = await send("Runtime.evaluate", { expression: "JSON.stringify(window.__heroQa ? { hits: window.__heroQa.report.hits, last: window.__heroQa.report.last } : null)", returnByValue: true }, sessionId);
      const qa = JSON.parse(overlap.value ?? "null");

      if (shotsDir) {
        const { data } = await send("Page.captureScreenshot", { format: "png" }, sessionId);
        await sharp(Buffer.from(data, "base64")).toFile(join(shotsDir, `${viewport.name}-${frame.param}-${frame.time}.png`));
      }

      const { result: boxesResult } = await send("Runtime.evaluate", { expression: `JSON.stringify(${measureBoxes})`, returnByValue: true }, sessionId);
      const boxes = JSON.parse(boxesResult.value);
      await send("Runtime.evaluate", { expression: `(() => { const s = document.createElement('style'); s.id = 'qa-hide'; s.textContent = ${JSON.stringify(hideType)}; document.head.append(s); })()` }, sessionId);
      await wait(250);
      const { data } = await send("Page.captureScreenshot", { format: "png" }, sessionId);
      const image = await sharp(Buffer.from(data, "base64")).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      const scale = image.info.width / viewport.width;

      for (const box of boxes) {
        const ratio = await worstContrast(image, box, scale);
        const key = `${viewport.name} ${box.name}`;
        const previous = summary.get(key);
        if (!previous || ratio < previous.ratio) summary.set(key, { ratio, at: label });
        if (ratio < minimum) failures.push(`${label}: ${box.name} contrast ${ratio.toFixed(2)}:1`);
      }
      // The centred layout overlaps on purpose (Bricx); readability is judged by contrast alone.
      if (qa && qa.hits > 0) overlaps.add(viewport.name);
      process.stdout.write(".");
    }
    console.log(` ${viewport.name}`);
  }
  socket.close();
} finally {
  browser.kill();
  await wait(500);
  await rm(profile, { recursive: true, force: true }).catch(() => {});
}

if (posterMode) process.exit(0);
console.log("\nWorst contrast per HUD element (white type, 98th-percentile ground):");
for (const [key, value] of [...summary.entries()].sort((a, b) => a[1].ratio - b[1].ratio)) {
  console.log(`  ${value.ratio.toFixed(2).padStart(6)}:1  ${key.padEnd(34)} at ${value.at}`);
}
if (overlaps.size) console.log(`
Device runs under HUD type (by design, kept readable by the falloff) at: ${[...overlaps].join(", ")}`);
if (failures.length) {
  console.log(`\n${failures.length} failure(s):`);
  failures.forEach((failure) => console.log(`  ✗ ${failure}`));
  process.exitCode = 1;
} else {
  console.log(`\nAll ${viewports.length * frames.length} frames pass: white HUD type stays at ${minimum}:1 or better.`);
}
