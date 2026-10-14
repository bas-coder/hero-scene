"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { readToken } from "../design/readToken";

gsap.registerPlugin(ScrollTrigger);

/**
 * A wordmark that is not there until the cursor finds it.
 *
 * Torch (fine pointer): the word is drawn in ink but masked by a soft radial light at --x/--y with radius --r.
 * The light trails the pointer a little (0.5s, power3), swells in as the pointer enters the section and fades as
 * it leaves, so the word only lives where you look.
 * Sweep (touch): no cursor, so the light crosses the word once, scrubbed by scroll as it comes into view.
 * Ghost (reduced motion): the word sits faintly, with no light at all.
 *
 * Decorative, so it is hidden from assistive tech. The effect is self-contained: swap this component to change it.
 */
export function WordmarkReveal({ text, className = "" }: { text: string; className?: string }) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      element.dataset.mode = "ghost";
      return;
    }
    const radius = () => parseFloat(readToken("--statement-torch-radius"));

    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      element.dataset.mode = "sweep";
      const sweep = gsap.fromTo(
        element,
        { "--x": () => -radius(), "--y": () => element.offsetHeight / 2, "--r": () => radius() * 1.4 },
        {
          "--x": () => element.offsetWidth + radius(),
          ease: "none",
          scrollTrigger: { trigger: element, start: "top 90%", end: "bottom 35%", scrub: true, invalidateOnRefresh: true },
        },
      );
      return () => {
        sweep.scrollTrigger?.kill();
        sweep.kill();
      };
    }

    element.dataset.mode = "torch";
    const area = element.closest("section") ?? element;
    const moveX = gsap.quickTo(element, "--x", { duration: 0.5, ease: "power3" });
    const moveY = gsap.quickTo(element, "--y", { duration: 0.5, ease: "power3" });
    const pointer = { x: 0, y: 0, inside: false };

    // The light is placed in the word's own box, so it follows the page as well as the pointer.
    const aim = (jump: boolean) => {
      const box = element.getBoundingClientRect();
      const x = pointer.x - box.left;
      const y = pointer.y - box.top;
      if (jump) {
        moveX(x, x);
        moveY(y, y);
      } else {
        moveX(x);
        moveY(y);
      }
    };
    const onEnter = (event: PointerEvent) => {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      pointer.inside = true;
      aim(true);
      gsap.to(element, { "--r": radius(), duration: 0.6, ease: "power3.out", overwrite: "auto" });
    };
    const onMove = (event: PointerEvent) => {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      aim(false);
    };
    const onLeave = () => {
      pointer.inside = false;
      gsap.to(element, { "--r": 0, duration: 0.6, ease: "power2.inOut", overwrite: "auto" });
    };
    const onScroll = () => {
      if (pointer.inside) aim(false);
    };

    area.addEventListener("pointerenter", onEnter as EventListener);
    area.addEventListener("pointermove", onMove as EventListener, { passive: true });
    area.addEventListener("pointerleave", onLeave);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      area.removeEventListener("pointerenter", onEnter as EventListener);
      area.removeEventListener("pointermove", onMove as EventListener);
      area.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("scroll", onScroll);
      gsap.killTweensOf(element);
    };
  }, []);

  return (
    <div ref={root} className={`wordmark-reveal ${className}`} aria-hidden="true">
      {text}
    </div>
  );
}
