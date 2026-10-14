export const criticalImageUrls = [
  "/media/interface-1440.avif",
  "/media/atelier-1440.avif",
];

export async function decodeImage(url: string) {
  const image = new Image();
  image.decoding = "async";
  image.src = url;
  await image.decode();
}

export function selectQualityTier() {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) return "low" as const;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
  const cores = navigator.hardwareConcurrency || 8;
  if (memory <= 4 || cores <= 4 || window.innerWidth < 720) return "low" as const;
  if (memory <= 8 || cores <= 8) return "medium" as const;
  return "high" as const;
}
