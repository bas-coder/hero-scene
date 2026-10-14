"use client";

import { useEffect, useRef } from "react";
import { markPosterReady } from "./poster";
import type { DemoProps } from "./poster";

// Poster frame: the pointer rests on the "o" of "Move".
const posterLetter = 1;

export function WeightHeadlineDemo({ poster }: DemoProps) {
  const stage = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!poster || !stage.current) return;
    const root = stage.current;
    let cancelled = false;
    void document.fonts.ready.then(() => {
      setTimeout(() => {
        const letter = root.querySelectorAll(".char")[posterLetter];
        if (cancelled || !letter) return;
        const box = letter.getBoundingClientRect();
        window.dispatchEvent(new PointerEvent("pointermove", { clientX: box.left + box.width / 2, clientY: box.top + box.height / 2, pointerType: "mouse" }));
        setTimeout(markPosterReady, 900);
      }, 600);
    });
    return () => {
      cancelled = true;
    };
  }, [poster]);

  return (
    <main className="demo-stage" ref={stage}>
      <div className="demo-headline">
        <h1
          data-text-reveal="chars"
          data-text-reveal-load=""
          data-font-weight-hover=""
          data-weight-rest="560"
          data-weight-near="200"
          data-radius-em="3.1"
        >
          <span className="demo-headline__line">Move across</span>
          <span className="demo-headline__line">these letters</span>
        </h1>
      </div>
      {!poster && <p className="demo-hint">Move your pointer slowly across the words</p>}
    </main>
  );
}
