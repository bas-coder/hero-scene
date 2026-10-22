import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { flableShot } from "../src/hero/engine/shots/flable.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(root, "public", "media");

await mkdir(output, { recursive: true });

const images = [
  { source: "interface-sketch.png", name: "interface", widths: [720, 1440, 2160] },
  { source: "atelier-sketch.png", name: "atelier", widths: [720, 1440, 2160] },
  // The statement section's portrait: 4:5 like avecanni.studio's, cut from the 2770 px square and centred on the face.
  { source: "profile.png", name: "profile", widths: [720, 1440, 2160], crop: { left: 332, top: 0, width: 2216, height: 2770 } },
];

for (const image of images) {
  const input = resolve(root, "assets", image.source);
  for (const width of image.widths) {
    const source = image.crop ? sharp(input).extract(image.crop) : sharp(input);
    const pipeline = source.resize({ width, withoutEnlargement: true });
    await pipeline.clone().avif({ quality: 82, effort: 7 }).toFile(resolve(output, `${image.name}-${width}.avif`));
    await pipeline.clone().webp({ quality: 88, effort: 6 }).toFile(resolve(output, `${image.name}-${width}.webp`));
  }
}

// Hero screen textures, fitted to the MacBook GLB's display: 3024 × 1953 (30.346 × 19.600 cm at the 14" native
// width). Never stretched: 3024 × 1964 exports lose 11 px of empty bottom; other sizes fit by height and extend
// their own edge pixels sideways. WebGL samples them with mipmaps: one 2048 WebP per screen, 1024 for the low tier.
const display = { width: 3024, height: 1953 };
const heroScreens = [
  { source: "SignIn.png", name: "signin" },
  { source: "chats.png", name: "chats" },
  { source: "insights-table.png", name: "insights" },
  { source: "Mission Control.png", name: "mission" },
];
const heroOutput = resolve(output, "hero", "flable");
await mkdir(heroOutput, { recursive: true });

async function fitToDisplay(input) {
  const { width, height } = await sharp(input).metadata();
  if (width === display.width && height >= display.height) {
    return sharp(input).extract({ left: 0, top: 0, width: display.width, height: display.height }).png().toBuffer();
  }
  const scaledWidth = Math.round((width * display.height) / height);
  const scaled = await sharp(input).resize({ height: display.height, kernel: "lanczos3" }).png().toBuffer();
  if (scaledWidth >= display.width) {
    const left = Math.floor((scaledWidth - display.width) / 2);
    return sharp(scaled).extract({ left, top: 0, width: display.width, height: display.height }).png().toBuffer();
  }
  const pad = display.width - scaledWidth;
  return sharp(scaled).extend({ left: Math.floor(pad / 2), right: Math.ceil(pad / 2), extendWith: "copy" }).png().toBuffer();
}

for (const screen of heroScreens) {
  const fitted = await fitToDisplay(resolve(root, "assets", "flable", screen.source));
  for (const width of [1024, 2048]) {
    await sharp(fitted)
      .resize({ width, kernel: "lanczos3" })
      .webp({ quality: 92, effort: 6, smartSubsample: true })
      .toFile(resolve(heroOutput, `${screen.name}-${width}.webp`));
  }
}

// Each breakout's detail texture: its UI at the export's native resolution (the shot's own crop of its screen).
for (const breakout of flableShot.breakouts) {
  if (!breakout.detail) continue;
  const screenId = flableShot.screens[breakout.screen].id;
  const source = heroScreens.find((screen) => screen.name === screenId)?.source;
  if (!source) throw new Error(`No source export for the ${screenId} screen`);
  const { left, top, width, height } = breakout.detail.crop;
  const fitted = await fitToDisplay(resolve(root, "assets", "flable", source));
  const name = breakout.detail.src.split("/").pop();
  await sharp(fitted).extract({ left, top, width, height }).webp({ quality: 94, effort: 6, smartSubsample: true }).toFile(resolve(heroOutput, `${name}.webp`));
}

console.log("Responsive image assets are ready");
