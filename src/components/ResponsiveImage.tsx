import type { ProjectMedia } from "../types";

export function ResponsiveImage({ media, className = "", sizes = `(max-width: ${process.env.DESIGN_BREAKPOINT_MOBILE}) 94vw, 88vw` }: { media: ProjectMedia; className?: string; sizes?: string }) {
  // Every media file ships at 720, 1440 and 2160 wide; the 1440 path names the set.
  const stem = (path: string) => path.replace(/-1440\.(avif|webp)$/, "");
  return (
    <picture className={className}>
      <source type="image/avif" srcSet={`${stem(media.avif)}-720.avif 720w, ${media.avif} 1440w, ${stem(media.avif)}-2160.avif 2160w`} sizes={sizes} />
      <source type="image/webp" srcSet={`${stem(media.webp)}-720.webp 720w, ${media.webp} 1440w, ${stem(media.webp)}-2160.webp 2160w`} sizes={sizes} />
      <img src={media.webp} width={media.width} height={media.height} alt={media.alt} decoding="async" />
    </picture>
  );
}
