"use client";

import { useState } from "react";
import type { Tutorial } from "../content/tutorials";

/** Self-hosted thumbnail first; YouTube (privacy-enhanced domain) only loads after a visitor presses play. */
export function YouTubeFacade({ tutorial }: { tutorial: Tutorial }) {
  const [playing, setPlaying] = useState(false);

  if (playing) {
    return (
      <div className="video-frame">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${tutorial.youtubeId}?autoplay=1&rel=0`}
          title={tutorial.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <button type="button" className="video-frame video-frame--poster" onClick={() => setPlaying(true)} aria-label={`Play tutorial: ${tutorial.title}`}>
      <img src={`/tutorials/${tutorial.id}.jpg`} alt="" loading="lazy" decoding="async" />
      <span className="video-frame__play" aria-hidden="true">Play</span>
    </button>
  );
}
