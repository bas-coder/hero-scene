export type QualityTier = "high" | "medium" | "low" | "static";

export type AssetGateState =
  | "loading"
  | "decoding"
  | "gpu-preparing"
  | "ready"
  | "degraded"
  | "failed";

/** A run of headline text; `em` sets it in italic. */
export interface HeadlineRun {
  text: string;
  em?: boolean;
}

export interface HeroContent {
  badge: string;
  /** Opens the headline on its own line, then the sentence continues (olenkevich.com). */
  name: string;
  /** The sentence after the name, one entry per line. */
  headline: HeadlineRun[][];
  primaryLabel: string;
  primaryHref: string;
  secondaryLabel: string;
  secondaryHref: string;
}

export interface ProjectMedia {
  name: string;
  avif: string;
  webp: string;
  width: number;
  height: number;
  alt: string;
}
