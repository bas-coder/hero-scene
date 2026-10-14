"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";

gsap.registerPlugin(ScrollTrigger, SplitText);

/**
 * Headline motion, after the extrafazant.nl hero (same GSAP recipe, read from their bundle):
 *
 * Reveal — `data-text-reveal="chars" | "lines"`
 *   Split into masked lines; each char (or line) rises from yPercent 135 to 0 over 1s, expo.out.
 *   Chars stagger 0.0175s, lines 0.07s. `data-text-reveal-load` plays on load (the hero);
 *   everything else plays once as it scrolls past 85% of the viewport. Headings inside a
 *   `[data-reveal]` card wait 0.12s for the card. Screen readers get the whole sentence.
 *
 * Weight hover — `data-font-weight-hover` (+ `data-weight-rest`, `data-weight-near`, `data-radius-em`)
 *   Each char's variable-font weight follows the pointer: rest + (near − rest) × (1 − d / r),
 *   eased with gsap.quickTo on --wght (0.4s, power2.out). Starts after the reveal; off on touch and
 *   with reduced motion.
 */

const ease = "expo.out";
const staggerChars = 0.0175;
const staggerLines = 0.07;

type Revealed = HTMLElement & { _split?: SplitText; _revealed?: boolean };

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
// Captures (posters, HUD checks) hold the finished headline, but still let a poster drive the hover.
const capturing = () => document.documentElement.dataset.capture === "true";

function initReveal(root: ParentNode) {
  const elements = Array.from(root.querySelectorAll<Revealed>("[data-text-reveal]"));
  const splits: SplitText[] = [];
  const reduced = reducedMotion() || capturing();

  elements.forEach((element) => {
    element.dataset.textReady = "true";
    if (reduced || element._split) {
      element._revealed = true;
      element.dispatchEvent(new CustomEvent("reveal:done"));
      return;
    }
    const byChars = element.dataset.textReveal === "chars";
    const onLoad = element.hasAttribute("data-text-reveal-load");
    const delay = (element.closest("[data-reveal]") ? 0.12 : 0) + (parseFloat(element.dataset.textRevealDelay ?? "") || 0);
    let split: SplitText;
    try {
      split = SplitText.create(element, {
      type: byChars ? "chars,words,lines" : "lines,words",
      linesClass: "line",
      charsClass: "char",
      mask: "lines",
      // Weight-hover headings keep their split: char positions are measured once the reveal ends.
      autoSplit: !element.hasAttribute("data-font-weight-hover"),
      onSplit(self) {
        element._split = self;
        return gsap.fromTo(
          byChars ? self.chars : self.lines,
          { yPercent: 135 },
          {
            yPercent: 0,
            duration: 1,
            ease,
            stagger: byChars ? staggerChars : staggerLines,
            delay,
            scrollTrigger: onLoad ? undefined : { trigger: element, start: "top 85%", once: true },
            onComplete: () => {
              element._revealed = true;
              element.dispatchEvent(new CustomEvent("reveal:done"));
            },
          },
        );
      },
      });
    } catch {
      // A heading that cannot be split simply shows, unanimated.
      element._revealed = true;
      return;
    }
    splits.push(split);
  });

  return () => {
    splits.forEach((split) => split.revert());
    elements.forEach((element) => {
      delete element._split;
      delete element._revealed;
    });
  };
}

interface WeightChar {
  el: HTMLElement;
  cx: number;
  cy: number;
  rest: number;
  near: number;
  radius: number;
  last: number;
  set: (value: number) => void;
}

function initWeightHover(root: ParentNode) {
  if (reducedMotion() || (!capturing() && window.matchMedia("(hover: none), (pointer: coarse)").matches)) return () => {};
  const hosts = Array.from(root.querySelectorAll<Revealed>("[data-font-weight-hover]"));
  if (!hosts.length) return () => {};

  let chars: WeightChar[] = [];
  const pointer = { x: 0, y: 0, active: false };
  const cleanups: (() => void)[] = [];

  const measure = () => {
    chars.forEach((char) => {
      const rect = char.el.getBoundingClientRect();
      char.cx = rect.left + rect.width / 2 + window.scrollX;
      char.cy = rect.top + rect.height / 2 + window.scrollY;
    });
  };

  const collect = () => {
    chars = [];
    hosts.forEach((host) => {
      const split = host._split;
      if (!split) return;
      const style = getComputedStyle(host);
      const restAttr = parseFloat(host.dataset.weightRest ?? "");
      const rest = Number.isFinite(restAttr) ? restAttr : parseFloat(style.fontWeight) || 400;
      const nearAttr = parseFloat(host.dataset.weightNear ?? "");
      const near = Number.isFinite(nearAttr) ? nearAttr : rest;
      const radius = (parseFloat(host.dataset.radiusEm ?? "") || 3.1) * parseFloat(style.fontSize);
      split.chars.forEach((node) => {
        const el = node as HTMLElement;
        el.style.setProperty("--wght", String(rest));
        el.style.fontVariationSettings = "'wght' var(--wght)";
        chars.push({ el, cx: 0, cy: 0, rest, near, radius, last: rest, set: gsap.quickTo(el, "--wght", { duration: 0.4, ease: "power2.out" }) });
      });
    });
    measure();
  };

  // After the reveal, re-split as plain chars so the heading can reflow on resize without masks.
  const resplit = () => {
    hosts.forEach((host) => {
      host._split?.revert();
      host._split = SplitText.create(host, { type: "chars,words", charsClass: "char" });
    });
    collect();
  };

  const tick = () => {
    if (!pointer.active) return;
    for (const char of chars) {
      const distance = Math.hypot(pointer.x - char.cx, pointer.y - char.cy);
      const amount = distance >= char.radius ? 0 : 1 - distance / char.radius;
      const lo = Math.min(char.rest, char.near);
      const hi = Math.max(char.rest, char.near);
      const weight = Math.min(hi, Math.max(lo, char.rest + (char.near - char.rest) * amount));
      if (Math.abs(weight - char.last) < 1) continue;
      char.last = weight;
      char.set(weight);
    }
  };

  const move = (event: PointerEvent) => {
    pointer.active = true;
    pointer.x = event.pageX;
    pointer.y = event.pageY;
  };
  let frame = 0;
  const onResize = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(resplit);
  };

  const start = () => {
    resplit();
    gsap.ticker.add(tick);
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });
  };

  const pending = hosts.filter((host) => host.hasAttribute("data-text-reveal") && !host._revealed);
  if (pending.length) {
    let waiting = pending.length;
    pending.forEach((host) => {
      const done = () => {
        waiting -= 1;
        if (waiting === 0) start();
      };
      host.addEventListener("reveal:done", done, { once: true });
      cleanups.push(() => host.removeEventListener("reveal:done", done));
    });
  } else {
    start();
  }

  return () => {
    cleanups.forEach((cleanup) => cleanup());
    cancelAnimationFrame(frame);
    gsap.ticker.remove(tick);
    window.removeEventListener("pointermove", move);
    window.removeEventListener("resize", onResize);
    chars.forEach((char) => {
      gsap.killTweensOf(char.el);
      char.el.style.removeProperty("--wght");
      char.el.style.fontVariationSettings = "";
    });
  };
}

/** Runs the headline reveal and weight hover for a subtree; returns a cleanup. Reused by the Library demo. */
export function initHeadlineMotion(root: ParentNode = document) {
  const stopReveal = initReveal(root);
  const stopHover = initWeightHover(root);
  return () => {
    stopHover();
    stopReveal();
  };
}

/** Mounted once in the root layout: every page's headlines, re-wired on route change, after fonts load. */
export function TextReveal() {
  const pathname = usePathname();
  useEffect(() => {
    let cleanup: (() => void) | null = null;
    let cancelled = false;
    // Wait for fonts so lines break where they will finally sit, but never longer than a beat.
    const fontsReady = Promise.race([document.fonts.ready, new Promise((resolve) => setTimeout(resolve, 1200))]);
    void fontsReady.then(() => {
      if (cancelled) return;
      cleanup = initHeadlineMotion(document);
      ScrollTrigger.refresh();
    });
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [pathname]);
  return null;
}
