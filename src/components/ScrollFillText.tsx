"use client";

import { Fragment, useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/**
 * Scroll fill, ported from cr8ivelarry.live's ScrollColorChangeText (Framer Motion, read from its bundle).
 *
 * Progress runs 0 → 1 while the heading's top travels from 80% to 20% of the viewport. Letter k of N (spaces
 * not counted) fills over [k/N, (k+1)/N]: opacity 0.2 → 1 and colour start → end, linear and clamped, so only
 * one letter is ever part-way. Words never break inside. The server renders the text fully inked, so it reads
 * without JavaScript; reduced motion and captures keep it that way. Screen readers get the plain sentence.
 */
export function ScrollFillText({ text, id, className = "" }: { text: string; id?: string; className?: string }) {
  const root = useRef<HTMLHeadingElement>(null);
  const words = text.split(" ");

  useLayoutEffect(() => {
    const heading = root.current;
    if (!heading) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || document.documentElement.dataset.capture === "true") return;

    const letters = Array.from(heading.querySelectorAll<HTMLElement>(".scroll-fill__letter"));
    const total = letters.length;
    const painted = new Array<number>(total).fill(-1);
    const paint = (progress: number) => {
      for (let index = 0; index < total; index += 1) {
        const amount = Math.min(1, Math.max(0, progress * total - index));
        if (amount === painted[index]) continue;
        painted[index] = amount;
        letters[index].style.opacity = String(0.2 + 0.8 * amount);
        letters[index].style.color = `color-mix(in srgb, var(--text-statement-end) ${amount * 100}%, var(--text-statement-start))`;
      }
    };

    const trigger = ScrollTrigger.create({
      trigger: heading,
      start: "top 80%",
      end: "top 20%",
      onUpdate: (self) => paint(self.progress),
      onRefresh: (self) => paint(self.progress),
    });
    paint(trigger.progress);

    return () => {
      trigger.kill();
      letters.forEach((letter) => {
        letter.style.opacity = "";
        letter.style.color = "";
      });
    };
  }, [text]);

  return (
    <h2 ref={root} id={id} className={`scroll-fill ${className}`}>
      <span className="visually-hidden">{text}</span>
      <span aria-hidden="true">
        {words.map((word, wordIndex) => (
          <Fragment key={wordIndex}>
            <span className="scroll-fill__word">
              {Array.from(word).map((letter, letterIndex) => (
                <span key={letterIndex} className="scroll-fill__letter">{letter}</span>
              ))}
            </span>
            {wordIndex < words.length - 1 && " "}
          </Fragment>
        ))}
      </span>
    </h2>
  );
}
