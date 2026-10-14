"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

/**
 * Smooth scroll, matched to the Bricx reference (Lenis, 1.1s, ease-out cubic, wheel only).
 * Touch and coarse pointers keep native scrolling, and reduced motion turns it off.
 * A new page always starts at the top (unless it was reached with back/forward or a #hash),
 * and the first wheel, touch or key from the visitor wins over that reset.
 */

let current: Lenis | null = null;
export const getLenis = () => current;

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

export function SmoothScroll() {
  const pathname = usePathname();
  const fromHistory = useRef(false);

  useEffect(() => {
    const mark = () => {
      fromHistory.current = true;
    };
    window.addEventListener("popstate", mark);
    return () => window.removeEventListener("popstate", mark);
  }, []);

  useEffect(() => {
    if (window.location.hash) return;
    if (fromHistory.current) {
      fromHistory.current = false;
      return;
    }
    const start = performance.now();
    let frame = 0;
    let released = false;
    const release = () => {
      released = true;
      window.removeEventListener("wheel", release);
      window.removeEventListener("touchstart", release);
      window.removeEventListener("keydown", release);
    };
    const hold = () => {
      if (released) return;
      const lenis = getLenis();
      if (lenis && !lenis.isStopped) {
        lenis.stop();
        lenis.start();
      }
      if (window.scrollY !== 0) window.scrollTo(0, 0);
      if (performance.now() - start < 250) frame = requestAnimationFrame(hold);
      else release();
    };
    window.addEventListener("wheel", release, { passive: true });
    window.addEventListener("touchstart", release, { passive: true });
    window.addEventListener("keydown", release);
    hold();
    return () => {
      release();
      cancelAnimationFrame(frame);
    };
  }, [pathname]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !window.matchMedia("(any-pointer: fine)").matches) return;
    const lenis = new Lenis({ duration: 1.1, easing: easeOutCubic, smoothWheel: true });
    current = lenis;
    lenis.on("scroll", ScrollTrigger.update);
    let frame = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    };
    frame = requestAnimationFrame(raf);
    return () => {
      cancelAnimationFrame(frame);
      lenis.destroy();
      current = null;
    };
  }, []);

  return null;
}
