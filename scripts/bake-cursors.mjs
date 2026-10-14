// Bakes the 3D cursors: renders lab/cursors.html in headless Chrome on the real GPU, then writes
// public/cursors/<name>.png, @2x and @3x, and the tokens in src/design/cursors.css.
//   npm run cursors                         bake every cursor
//   npm run cursors -- --serve              serve the lab at http://localhost:4190/lab/cursors.html for tuning
//   npm run cursors -- --sheet <file.png>   bake, then capture the review sheet at DPR 2 for scoring
// CURSORS_SOFTWARE=1 renders with SwiftShader instead of the GPU (pixels differ slightly; bake on one backend).
import { createServer } from "node:http";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { cursors, densities, fileName } from "../lab/cursor-specs.mjs";
import { evaluate, launchBrowser, wait } from "./lib/headless.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const sheetPath = args.includes("--sheet") ? resolve(args[args.indexOf("--sheet") + 1]) : null;

const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png" };
const sources = ["/lab/", "/node_modules/three/", "/node_modules/clipper-lib/", "/src/design/"];

/** Serves the lab and its modules; everything else comes from public/, as on the site. */
function serve(port) {
  const server = createServer(async (request, response) => {
    const path = decodeURIComponent(new URL(request.url, "http://lab").pathname);
    const file = resolve(root, sources.some((prefix) => path.startsWith(prefix)) ? `.${path}` : `public${path}`);
    if (!file.startsWith(root + sep)) return response.writeHead(403).end();
    try {
      const body = await readFile(file);
      response.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream", "cache-control": "no-store" }).end(body);
    } catch {
      response.writeHead(404).end();
    }
  });
  return new Promise((listening) => server.listen(port, "127.0.0.1", () => listening(server)));
}

if (args.includes("--serve")) {
  await serve(4190);
  console.log("Cursor lab: http://localhost:4190/lab/cursors.html");
} else {
  const server = await serve(0);
  const base = `http://127.0.0.1:${server.address().port}/lab/cursors.html`;
  const { page, close } = await launchBrowser({ name: "cursor-bake", gpu: !process.env.CURSORS_SOFTWARE });
  try {
    await page("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    await open(page, `${base}?bake`);
    const gpu = await evaluate(page, "window.cursorLab.gpu");
    console.log(`Renderer: ${gpu.renderer}`);
    if (!gpu.floatTargets) throw new Error("This GPU can't render to float targets; try CURSORS_SOFTWARE=1.");

    // Render everything first, then swap the files in, so the site never goes without cursors mid-bake.
    const baked = [];
    const files = new Map();
    for (const spec of cursors) {
      const result = await evaluate(page, `window.cursorLab.bake(${JSON.stringify(spec.name)})`);
      const sizes = [];
      for (const density of densities) {
        // The lab renders above the target size; Lanczos keeps 1px outlines crisp where a plain average greys them.
        const scale = result.scales[density];
        const png = await sharp(Buffer.from(result.images[density], "base64"), { raw: { width: result.width * scale, height: result.height * scale, channels: 4 } })
          .resize(result.width * density, result.height * density, { kernel: "lanczos3" })
          .png({ compressionLevel: 9, adaptiveFiltering: true })
          .toBuffer();
        files.set(fileName(spec.name, density), png);
        sizes.push(`${(png.length / 1024).toFixed(1)} KB`);
      }
      baked.push({ ...spec, hotspot: result.hotspot });
      console.log(`${spec.name}: ${result.width}×${result.height} CSS px, hotspot ${result.hotspot.join(" ")}, ${sizes.join(" / ")}`);
    }
    const output = join(root, "public", "cursors");
    await rm(output, { recursive: true, force: true });
    await mkdir(output, { recursive: true });
    for (const [name, png] of files) await writeFile(join(output, name), png);
    await writeFile(join(root, "src", "design", "cursors.css"), tokens(baked));
    console.log(`Wrote ${(await readdir(output)).length} images and src/design/cursors.css`);

    if (sheetPath) {
      await page("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 2, mobile: false });
      await open(page, `${base}?sheet`, "sheetReady");
      const { cssContentSize } = await page("Page.getLayoutMetrics");
      const { data } = await page("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: 0, y: 0, width: 1280, height: Math.ceil(cssContentSize.height), scale: 1 } });
      await writeFile(sheetPath, Buffer.from(data, "base64"));
      console.log(`Sheet: ${sheetPath}`);
    }
  } finally {
    await close();
    server.close();
  }
}

async function open(page, url, flag = "ready") {
  await page("Page.navigate", { url });
  for (let attempt = 0; attempt < 600; attempt += 1) {
    await wait(100);
    const state = await evaluate(page, `({ done: window.cursorLab?.${flag} === true, error: document.querySelector("#status")?.dataset.error ?? null })`).catch(() => ({}));
    if (state.error) throw new Error(state.error);
    if (state.done) return;
  }
  throw new Error(`The lab never became ${flag} at ${url}`);
}

function tokens(baked) {
  const set = (spec) => `image-set(${densities.map((d) => `url("/cursors/${fileName(spec.name, d)}") ${d}x`).join(", ")}) ${spec.hotspot.join(" ")}, ${spec.keyword}`;
  return [
    "/* Cursors — generated by `npm run cursors` from lab/cursors.html. Don't edit; change the lab and re-bake. */",
    "/* Native cursors: the operating system draws them, so they never lag. Each falls back to its keyword while",
    "   its image loads, in forced colours, and where the image would cross the viewport edge. */",
    ":root {",
    ...baked.map((spec) => `  ${spec.token}: ${set(spec)};`),
    "}",
    "",
    "@media (forced-colors: active) {",
    "  :root {",
    ...baked.map((spec) => `    ${spec.token}: ${spec.keyword};`),
    "  }",
    "}",
    "",
  ].join("\n");
}
