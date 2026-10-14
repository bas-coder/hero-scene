/** `poster` is set by ?poster: controls hide and motion holds a representative frame for `npm run posters`. */
export interface DemoProps {
  poster: boolean;
}

/** Tells scripts/capture-posters.mjs the poster frame is on screen. */
export function markPosterReady() {
  document.documentElement.dataset.posterReady = "true";
}
