// Room plates for the hero's far depth card (the arc behind the desk). A plate is generated once per shot (its
// own world, from its reference), then placed here in the canonical frame (1440 × 900 rest view, fractions):
// `covers` is where the generated image sits; the output is padded out to `rect` (the arc's extent, lab: world.js
// roomArc.rect) with the image's own edge colours, blurred into soft light (never mirrored: mirrored plants and
// shelves read as copies), feathered under the image, darkened toward the far edges, and softened to the
// reference's defocus.
//
//   node scripts/build-plates.mjs            → public/media/hero/<shot>/room-{1024,2048}.webp
import { mkdir } from "node:fs/promises";
import sharp from "sharp";

const plates = [
  {
    shot: "flable",
    source: "assets/hero/plates/flable-room-v1.png",
    // Shelf just above the laptop's top edge, pillows beside it, curtains behind the lamp at the right edge.
    covers: [-0.09, -0.074, 1.33, 0.9],
    // Runs far below the desk: phones and the exit see well under it (a clamped edge would streak).
    rect: [-0.6, -0.35, 1.6, 2.2],
    blur: 3,
    // Toward the reference's rose-magenta (the generation drifted peach): saturation, then channel gains.
    grade: { saturation: 1.3, gain: [1.08, 0.94, 1.22] },
    // Below the desk line the reference reads a lit violet (about 64, 34, 109), not black: lift the plate's
    // lower band (frame y from `from` down) by up to `gain`, keeping its hue.
    lower: { from: 0.6, gain: 1.8 },
  },
];

for (const plate of plates) {
  const { width, height } = await sharp(plate.source).metadata();
  const [cx0, cy0, cx1, cy1] = plate.covers;
  const [rx0, ry0, rx1, ry1] = plate.rect;
  const perX = width / (cx1 - cx0);
  const perY = height / (cy1 - cy0);
  const pad = {
    left: Math.round((cx0 - rx0) * perX),
    right: Math.round((rx1 - cx1) * perX),
    top: Math.round((cy0 - ry0) * perY),
    bottom: Math.round((ry1 - cy1) * perY),
  };
  const full = { width: width + pad.left + pad.right, height: height + pad.top + pad.bottom };
  const extend = { ...pad, extendWith: "copy" };
  const near = await sharp(plate.source).blur(plate.blur).extend(extend).raw().toBuffer({ resolveWithObject: true });
  // Heavily softened: copied edge rows would otherwise run out as streaks across the deep padding.
  const far = await sharp(plate.source).extend(extend).blur(150).raw().toBuffer();

  // The image itself, feathered over its last ~6% into the soft padding; then a falloff toward a third of the
  // brightness at the far edges.
  const { data, info } = near;
  const feather = 0.06 * Math.min(width, height);
  const ease = (t) => t * t * (3 - 2 * t);
  for (let y = 0; y < info.height; y += 1) {
    const iy = y - pad.top;
    const outY = iy < 0 ? -iy / pad.top : iy >= height ? (iy - height) / pad.bottom : 0;
    for (let x = 0; x < info.width; x += 1) {
      const ix = x - pad.left;
      const outX = ix < 0 ? -ix / pad.left : ix >= width ? (ix - width) / pad.right : 0;
      const inside = Math.min(ix, width - 1 - ix, iy, height - 1 - iy);
      const w = ease(Math.min(1, Math.max(0, inside / feather)));
      let k = 1 - 0.68 * ease(Math.min(1, Math.hypot(outX * 1.0, outY * (iy >= height ? 0.5 : 1))));
      if (plate.lower) {
        const frameY = ry0 + (y / info.height) * (ry1 - ry0);
        k *= 1 + (plate.lower.gain - 1) * ease(Math.min(1, Math.max(0, (frameY - plate.lower.from) / 0.2)));
      }
      const i = (y * info.width + x) * info.channels;
      const rgb = [0, 1, 2].map((c) => (far[i + c] + (data[i + c] - far[i + c]) * w) * k);
      if (plate.grade) {
        // The regrade lands on the lit wall; darks (the bed below the desk) keep their own, quieter colour.
        const luma = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
        const t = Math.min(1, luma / 110);
        for (let c = 0; c < 3; c += 1) {
          const graded = (luma + (rgb[c] - luma) * plate.grade.saturation) * plate.grade.gain[c];
          rgb[c] += (graded - rgb[c]) * t;
        }
      }
      // A little seeded dither (an unstructured hash), so the encoder doesn't block up the smooth gradients.
      let h = Math.imul(x, 374761393) + Math.imul(y, 668265263);
      h = Math.imul(h ^ (h >>> 13), 1274126177);
      const dither = ((h ^ (h >>> 16)) >>> 0) / 4294967296 - 0.5;
      for (let c = 0; c < 3; c += 1) data[i + c] = Math.max(0, Math.min(255, Math.round(rgb[c] + dither * 2)));
    }
  }

  const out = `public/media/hero/${plate.shot}`;
  await mkdir(out, { recursive: true });
  for (const size of [2048, 1024]) {
    await sharp(data, { raw: info }).resize({ width: size }).webp({ quality: 94 }).toFile(`${out}/room-${size}.webp`);
  }
  console.log(`${plate.shot}: ${full.width}×${full.height} (pad ${JSON.stringify(pad)}) → ${out}/room-{2048,1024}.webp`);
}
