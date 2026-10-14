// Captures Library posters (4:3) and link-preview images (1200×630) from the live demos.
// Capture from a production server so no dev overlay appears:
//   npm run build && npm start      (then, in another terminal)   npm run posters [slug ...]
// POSTER_BASE overrides the origin; BROWSER_PATH points at Chrome or Edge if neither default path exists.
// Each demo sets <html data-poster-ready> once its held frame is on screen; the screenshot waits for that.
import { mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { launchBrowser, wait } from "./lib/headless.mjs";
import { libraryItems } from "../src/content/library.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const base = process.env.POSTER_BASE ?? "http://localhost:4173";
const only = process.argv.slice(2);

const shots = [
  { name: "poster", width: 1600, height: 1200 },
  { name: "og", width: 1200, height: 630 },
];

const { page, close } = await launchBrowser({ name: "library-posters" });
try {
  for (const item of libraryItems.filter((entry) => entry.demo && (only.length === 0 || only.includes(entry.slug)))) {
    const output = join(root, "public", "library", item.slug);
    await mkdir(output, { recursive: true });

    for (const shot of shots) {
      await page("Emulation.setDeviceMetricsOverride", { width: shot.width, height: shot.height, deviceScaleFactor: 1, mobile: false });
      await page("Page.navigate", { url: `${base}/demo/${item.slug}?poster&capture` });
      let ready = false;
      for (let attempt = 0; attempt < 150 && !ready; attempt += 1) {
        await wait(200);
        const { result } = await page("Runtime.evaluate", { expression: "document.documentElement.dataset.posterReady === 'true'", returnByValue: true });
        ready = result.value === true;
      }
      if (!ready) throw new Error(`${item.slug} never signalled poster-ready`);

      const { data } = await page("Page.captureScreenshot", { format: "png" });
      const image = Buffer.from(data, "base64");
      if (shot.name === "poster") {
        for (const width of [800, 1600]) {
          const pipeline = sharp(image).resize({ width });
          await pipeline.clone().avif({ quality: 70, effort: 6 }).toFile(join(output, `poster-${width}.avif`));
          await pipeline.clone().webp({ quality: 84, effort: 6 }).toFile(join(output, `poster-${width}.webp`));
        }
      } else {
        await sharp(image).jpeg({ quality: 86, mozjpeg: true }).toFile(join(output, "og.jpg"));
      }
    }
    console.log(`Captured ${item.slug}`);
  }
} finally {
  await close();
}
