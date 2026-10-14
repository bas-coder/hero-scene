// Headless captures for the hero lab (Meng's Sunset `tools/shot.mjs`, adapted). GPU on, never a visible window.
//
//   Frames:  node scripts/shot.mjs --url "http://localhost:4192/lab/hero/index.html?shot=flable" \
//              --frames "intro:0.6,intro:1.8,t:7.8,exit:1" --sizes "1440x900@1,1440x900@2,390x844@2" --out <dir>
//            Each frame loads url&<phase>=<time>, waits for <html data-hero-ready="true">, saves <size>-<phase>-<time>.png,
//            and prints console errors (the console must be clean) and the lab's frame-time stats when present.
//   Bench:   add --bench (the lab renders 180 unfrozen frames and reports median / p95 ms).
//   Probe:   add --probe "<js expression>" to print its JSON value once the frame is ready (e.g. projected points
//            via window.__lab.project(x, y, z)).
//   HUD:     node scripts/shot.mjs --hud http://localhost:4173 --sizes "1440x900,390x844" --out lab/hero/hud.json
//            Measures the live site's HUD boxes relative to the hero canvas, for the lab's keep-out overlay.
// BROWSER_PATH points at Chrome or Edge; SHOT_SOFTWARE=1 uses SwiftShader instead of the GPU.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import sharp from "sharp";

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const hudBase = arg("hud");
const url = arg("url");
const out = resolve(arg("out", "lab/hero/shots"));
const sizes = arg("sizes", "1440x900@1").split(",").map((spec) => {
  const [size, dpr = "1"] = spec.split("@");
  const [width, height] = size.split("x").map(Number);
  return { width, height, dpr: Number(dpr), mobile: width < 700 };
});
const frames = arg("frames", "t:7.8").split(",").map((spec) => {
  const [phase, time] = spec.split(":");
  return { phase, time };
});
const bench = args.includes("--bench");
const extra = arg("query", "");
const probe = arg("probe");
const port = 9200 + Math.floor(Math.random() * 500);

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
if (!hudBase && !url) throw new Error("Pass --url (frames) or --hud (HUD boxes).");

const wait = (ms) => new Promise((done) => setTimeout(done, ms));

// Headless Chrome on some GPUs (the HD 4000) intermittently presents a frame as its top-left quarter, zoomed 2x and
// repeated in all four quadrants. A real frame never has four identical quadrants: detect it and capture again.
// Near-uniform frames (the intro's first black beats) match trivially and are skipped.
async function tiledGlitch(png) {
  const { data } = await sharp(png).greyscale().resize(64, 40, { fit: "fill" }).raw().toBuffer({ resolveWithObject: true });
  let mean = 0;
  for (const v of data) mean += v / data.length;
  let spread = 0;
  for (const v of data) spread += (v - mean) ** 2 / data.length;
  if (Math.sqrt(spread) < 6) return false;
  let diff = 0;
  for (let y = 0; y < 20; y += 1) for (let x = 0; x < 32; x += 1) diff += Math.abs(data[y * 64 + x] - data[(y + 20) * 64 + x + 32]);
  return diff / (32 * 20) < 1.5;
}

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

function protocol(socket, onEvent) {
  let id = 0;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (!message.id) return onEvent?.(message);
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

const measureHud = `(() => {
  const canvas = document.querySelector('.hero-visual') || document.querySelector('.hero canvas') || document.querySelector('.hero');
  const origin = canvas.getBoundingClientRect();
  const boxOf = (el, base) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    if (!r.width || !r.height || s.display === 'none' || s.visibility === 'hidden') return null;
    return { left: r.left - base.left, top: r.top - base.top, right: r.right - base.left, bottom: r.bottom - base.top };
  };
  const section = canvas.closest('.hero') || document;
  const hud = ['.hero-copy', '.hero-actions', '.hero-footer'].map((s) => boxOf(section.querySelector(s), origin)).filter(Boolean);
  const chrome = ['.site-header', '.mobile-header', '.mobile-dock'].map((s) => {
    const el = document.querySelector(s);
    if (!el) return null;
    return boxOf(el, getComputedStyle(el).position === 'fixed' ? { left: origin.left, top: 0 } : origin);
  }).filter(Boolean);
  const text = [...section.querySelectorAll('.hero-line, .availability, .glass-button, .hero-meta span')].map((el) => boxOf(el, origin)).filter(Boolean);
  return { width: origin.width, height: origin.height, hud, chrome, text };
})()`;

const profile = await mkdtemp(join(tmpdir(), "hero-shot-"));
const browser = spawn(browserPath, [
  "--headless=new",
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`,
  ...(process.env.SHOT_SOFTWARE ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : ["--use-angle=default", "--ignore-gpu-blocklist", "--enable-gpu-rasterization"]),
  "--hide-scrollbars",
  "about:blank",
], { stdio: "ignore" });

let failed = false;
try {
  const errors = [];
  const socket = new WebSocket(await connect());
  await new Promise((opened) => socket.addEventListener("open", opened, { once: true }));
  const send = protocol(socket, (message) => {
    if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails?.exception?.description ?? message.params.exceptionDetails?.text);
    if (message.method === "Runtime.consoleAPICalled" && ["error", "warning"].includes(message.params.type)) {
      const text = message.params.args.map((a) => a.value ?? a.description ?? "").join(" ");
      // ANGLE's D3D compiler notes constant-folding precision (X4122) in three's own shadow packing; not our code.
      const angleNote = text.includes("Program Info Log") && text.split("\n").filter((line) => line.trim() && !line.includes("warning X4122")).length <= 1;
      if (!angleNote) errors.push(`${message.params.type}: ${text}`);
    }
    if (message.method === "Log.entryAdded" && ["error", "warning"].includes(message.params.entry.level)) errors.push(`${message.params.entry.level}: ${message.params.entry.text}`);
  });
  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  await send("Page.enable", {}, sessionId);
  await send("Runtime.enable", {}, sessionId);
  await send("Log.enable", {}, sessionId);
  const evaluate = async (expression) => (await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }, sessionId)).result.value;

  if (hudBase) {
    const result = {};
    for (const size of sizes) {
      await send("Emulation.setDeviceMetricsOverride", { width: size.width, height: size.height, deviceScaleFactor: 1, mobile: size.mobile }, sessionId);
      await send("Page.navigate", { url: `${hudBase}/?capture&t=7.8` }, sessionId);
      await wait(1500);
      for (let attempt = 0; attempt < 100; attempt += 1) {
        if (await evaluate("document.fonts.status === 'loaded' && !!document.querySelector('.hero-copy')")) break;
        await wait(200);
      }
      await wait(600);
      result[`${size.width}x${size.height}`] = await evaluate(measureHud);
    }
    await mkdir(dirname(out), { recursive: true });
    await writeFile(out, JSON.stringify(result, null, 2));
    console.log(`HUD boxes written to ${out}`);
  } else {
    await mkdir(out, { recursive: true });
    for (const size of sizes) {
      await send("Emulation.setDeviceMetricsOverride", { width: size.width, height: size.height, deviceScaleFactor: size.dpr, mobile: size.mobile }, sessionId);
      for (const frame of frames) {
        const query = `${frame.phase}=${frame.time}${extra ? `&${extra}` : ""}${bench ? "&bench=180" : ""}`;
        const target = `${url}${url.includes("?") ? "&" : "?"}${query}`;
        const label = `${size.width}x${size.height}@${size.dpr}-${frame.phase}-${frame.time}`;
        let data;
        for (let take = 0; take < 3; take += 1) {
          errors.length = 0;
          await send("Page.navigate", { url: target }, sessionId);
          let ready = false;
          for (let attempt = 0; attempt < 400 && !ready; attempt += 1) {
            await wait(150);
            ready = (await evaluate("document.documentElement.dataset.heroReady === 'true'")) === true;
          }
          if (!ready) {
            failed = true;
            console.log(`✗ ${label}: never signalled ready`);
          }
          ({ data } = await send("Page.captureScreenshot", { format: "png" }, sessionId));
          if (!(await tiledGlitch(Buffer.from(data, "base64")))) break;
          console.log(`    ${label}: tiled capture glitch, capturing again`);
        }
        await writeFile(join(out, `${label}.png`), Buffer.from(data, "base64"));
        const stats = await evaluate("JSON.stringify(window.__lab?.stats ?? null)");
        const statsText = stats && stats !== "null" ? ` ${stats}` : "";
        console.log(`${errors.length ? "✗" : "✓"} ${label}${statsText}`);
        if (probe) console.log(`    probe: ${JSON.stringify(await evaluate(`(async () => (${probe}))()`))}`);
        if (errors.length) {
          failed = true;
          errors.forEach((error) => console.log(`    ${error}`));
        }
      }
    }
    console.log(`Captures in ${out}`);
  }
  socket.close();
} finally {
  browser.kill();
  await wait(400);
  await rm(profile, { recursive: true, force: true }).catch(() => {});
}
if (failed) process.exitCode = 1;
