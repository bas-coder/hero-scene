import { useEffect, useState } from "react";
import { faviconHref, themeStorageKey } from "./themeInit";
export type ThemeMode = "light" | "dark";
export function useTheme() {
  // Server and first client render agree on Light; the real theme is already on <html> from themeInit.
  const [theme, setTheme] = useState<ThemeMode | null>(null);
  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
  }, []);
  useEffect(() => {
    if (!theme) return;
    document.documentElement.dataset.theme = theme;
    try { if (!new URLSearchParams(location.search).has("capture")) localStorage.setItem(themeStorageKey, theme); } catch { /* Theme still works when storage is unavailable. */ }
    const color = getComputedStyle(document.documentElement).getPropertyValue("--surface-canvas").trim();
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", color);
    document.querySelector('link[rel="icon"]')?.setAttribute("href", faviconHref(theme));
  }, [theme]);
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === themeStorageKey) setTheme(event.newValue === "dark" ? "dark" : "light");
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  useEffect(() => {
    // Keeps several toggles on one page (footer, demos) in step; re-setting the same value is a no-op.
    const root = document.documentElement;
    const observer = new MutationObserver(() => setTheme(root.dataset.theme === "dark" ? "dark" : "light"));
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);
  return { theme: theme ?? "light", toggleTheme: () => setTheme(current => (current ?? "light") === "light" ? "dark" : "light") };
}
