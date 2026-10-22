/**
 * Types for the hero engine (plain three.js, src/hero/engine/*.js), for the site's TypeScript (allowJs is off).
 * The lab (lab/hero/index.html) uses the same modules untyped.
 */
import type * as THREE from "three";

export type Quality = "low" | "medium" | "high";
export type FixedFrame = { phase: "intro" | "loop" | "exit"; time: number };

export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface Stage {
  width: number;
  height: number;
  bounds: Box;
  keepOut: Box[];
  compact: boolean;
  chromeTop: number;
  footerTop: number;
  version: number;
}

export interface KeyHover {
  hovered: boolean;
  /** The Return key's anchor in canvas CSS pixels (for the tooltip). */
  x: number;
  y: number;
}

export interface HudReport {
  frames: number;
  hits: number;
  last: string[];
}

export interface HeroRendererOptions {
  /** A resolved palette (resolvePalette(heroPalette, readCssToken)). */
  palette: unknown;
  quality?: Quality;
  reducedMotion?: boolean;
  shot?: string;
  mood?: string;
  /** Where public/ is served from ("/" on the site). */
  assetBase?: string;
  dressing?: string;
  fixedFrame?: FixedFrame | null;
  parallax?: boolean;
  onKeyHover?: (hover: KeyHover) => void;
  onKeyClick?: () => void;
  onFrame?: (frame: number, state: Record<string, number>) => void;
  /** The page's clocks, read every frame: the intro reveal (0 → 1) and the scroll exit (0 → 1). */
  sources?: { reveal?: () => number; exit?: () => number } | null;
  /** Count frames where the lit screen or the lifted strip hits the HUD text (scripts/hero-qa.mjs). */
  qa?: boolean;
}

export interface HeroRenderer {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  state: Record<string, number>;
  qa: HudReport | null;
  readonly stage: Stage | null;
  bench(frames?: number): Promise<{ median: number; p95: number; dpr: number }>;
  renderFrames(count?: number): Promise<void>;
  setReveal(value: number): void;
  setExit(value: number): void;
  setStage(stage: Stage | null): void;
  setActive(active: boolean): void;
  setMood(name: string): void;
  setShot(id: string): void;
  start(): void;
  dispose(): void;
}

export function createHeroRenderer(canvas: HTMLCanvasElement, options: HeroRendererOptions): Promise<HeroRenderer>;

export function watchStage(canvas: HTMLCanvasElement, onChange?: () => void): { current: Stage | null; dispose(): void };

export const heroPalette: unknown;
export function resolvePalette<T>(definition: T, read: (token: string) => string): T;
export function readCssToken(token: string): string;

export type { Shot } from "./shots/index.js";
export { getShot } from "./shots/index.js";
