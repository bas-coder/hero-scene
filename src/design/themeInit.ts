/**
 * Runs in <head> before first paint so the saved theme never flashes.
 * `?capture` forces Light for deterministic screenshots and never touches the saved choice.
 * It also points the favicon <link> (rendered before this script) at the matching file in public/.
 */
export const themeStorageKey = "abbas-theme";
/** Bump when public/favicon-*.svg change, so browsers drop their cached icon. */
export const faviconVersion = "2";
export const faviconHref = (theme: "light" | "dark") => `/favicon-${theme}.svg?v=${faviconVersion}`;

export const themeInitScript = `(() => {
  const root = document.documentElement;
  const capture = new URLSearchParams(location.search).has("capture");
  if (capture) root.dataset.capture = "true";
  if (!capture && !matchMedia("(prefers-reduced-motion: reduce)").matches) root.classList.add("motion");
  try {
    root.dataset.theme = !capture && localStorage.getItem("${themeStorageKey}") === "dark" ? "dark" : "light";
  } catch {
    root.dataset.theme = "light";
  }
  document.querySelector('link[rel="icon"]')?.setAttribute("href", "/favicon-" + root.dataset.theme + ".svg?v=${faviconVersion}");
})();`;
