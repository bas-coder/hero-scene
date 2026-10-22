import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import type { MutableRefObject } from "react";
import { createHeroRenderer, heroPalette, readCssToken, resolvePalette, watchStage } from "../hero/engine/index.js";
import { getShot } from "../hero/engine/shots/index.js";
import type { FixedFrame, HeroRenderer, KeyHover } from "../hero/engine/index.js";
import { useHoverIntent } from "../hero/useHoverIntent";
import { caseHref } from "../content/cases";
import type { QualityTier } from "../types";

/**
 * The hero scene on the site: a thin wrapper around the plain three.js engine (src/hero/engine, built and judged
 * in lab/hero). The engine owns the world, the shot, the framing and the post chain; this component gives it a
 * canvas, the design tokens, the page's clocks (intro reveal, scroll exit) and the live HUD, and keeps the
 * capture (`?capture&t=`), poster and HUD-check (`?hud-qa`) bridges.
 */

const shot = getShot("flable");

interface HeroCanvasProps {
  reveal: MutableRefObject<number>;
  quality: QualityTier;
  onReady: () => void;
  /** 0 while the hero fills the view, 1 once it has scrolled away (closes the lid). */
  exit?: MutableRefObject<number>;
  /** False when the hero is off screen: rendering stops. */
  active?: boolean;
  reducedMotion?: boolean;
}

/** Capture mode can hold any frame: `?capture&t=7.8` (loop), `?capture&intro=1.2`, `?capture&exit=1`. */
function readFixedFrame(): FixedFrame | null {
  const params = new URLSearchParams(window.location.search);
  for (const [param, phase] of [["intro", "intro"], ["t", "loop"], ["exit", "exit"]] as const) {
    const value = params.get(param);
    const time = value === null ? NaN : Number(value);
    if (Number.isFinite(time)) return { phase, time };
  }
  return null;
}

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

export function HeroCanvas({ reveal, quality, onReady, exit, active = true, reducedMotion = false }: HeroCanvasProps) {
  const router = useRouter();
  const canvas = useRef<HTMLCanvasElement>(null);
  const tip = useRef<HTMLSpanElement>(null);
  const engine = useRef<HeroRenderer | null>(null);
  const { visible, setHovered } = useHoverIntent();
  // Latest callbacks for the engine (created once) without re-creating it.
  const latest = useRef({ onReady, setHovered, open: () => router.push(caseHref(shot.caseKey?.href ?? shot.id)) });
  latest.current = { onReady, setHovered, open: () => router.push(caseHref(shot.caseKey?.href ?? shot.id)) };

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    let disposed = false;
    let stage: ReturnType<typeof watchStage> | null = null;
    const capture = document.documentElement.dataset.capture === "true";
    const fixedFrame = capture ? readFixedFrame() : null;
    const qa = new URLSearchParams(window.location.search).has("hud-qa");
    // The tooltip trails the key softly, so it never swims with the parallax.
    const anchor = { x: 0, y: 0, placed: false };

    const onKeyHover = ({ hovered, x, y }: KeyHover) => {
      latest.current.setHovered(hovered);
      document.body.style.cursor = hovered ? "var(--cursor-pointer)" : "";
      if (!anchor.placed) {
        anchor.x = x;
        anchor.y = y;
        anchor.placed = true;
      }
      anchor.x += (x - anchor.x) * 0.25;
      anchor.y += (y - anchor.y) * 0.25;
      tip.current?.style.setProperty("translate", `${anchor.x}px ${anchor.y}px`);
    };

    const start = async () => {
      const renderer = await createHeroRenderer(element, {
        palette: resolvePalette(heroPalette, readCssToken),
        // "static" (no live scene) never reaches a canvas; treat it as the lightest tier if it ever does.
        quality: quality === "static" ? "low" : quality,
        reducedMotion,
        shot: shot.id,
        assetBase: "/",
        fixedFrame,
        sources: { reveal: () => reveal.current, exit: () => exit?.current ?? 0 },
        qa,
        onKeyHover,
        onKeyClick: () => latest.current.open(),
      });
      if (disposed) {
        renderer.dispose();
        return;
      }
      engine.current = renderer;
      stage = watchStage(element, () => renderer.setStage(stage?.current ?? null));
      if (qa) (window as unknown as { __heroQa: unknown }).__heroQa = { report: renderer.qa, state: renderer.state, scene: renderer.scene, get stage() { return renderer.stage; } };

      if (fixedFrame) {
        // Posters and the HUD checks wait for a held frame drawn with final fonts and framing.
        await document.fonts.ready;
        while (!renderer.stage && !disposed) await nextFrame();
        await renderer.renderFrames(4);
        document.documentElement.dataset.heroReady = "true";
      } else {
        renderer.start();
      }
      latest.current.onReady();
    };
    start().catch((error) => {
      console.error(error);
      latest.current.onReady();
    });

    return () => {
      disposed = true;
      stage?.dispose();
      engine.current?.dispose();
      engine.current = null;
      document.body.style.cursor = "";
    };
    // The engine is created once per mount; quality and motion settle before the hero mounts it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    engine.current?.setActive(active);
  }, [active]);

  return (
    <>
      <canvas ref={canvas} className="hero-canvas" />
      <span ref={tip} className="case-key-tip hero-key-tip" data-visible={visible} role="tooltip">
        {shot.caseKey?.label ?? "Open the case study"} <span aria-hidden="true">↵</span>
      </span>
    </>
  );
}
