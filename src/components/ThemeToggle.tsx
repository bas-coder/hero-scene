import { Moon, Sun } from "@phosphor-icons/react";
import type { ThemeMode } from "../design/useTheme";
export function ThemeToggle({ theme, onToggle, variant = "icon" }: { theme: ThemeMode; onToggle: () => void; variant?: "icon" | "text" }) {
  // The text variant lives in footers, beside links like "Back to top".
  if (variant === "text") {
    const Icon = theme === "light" ? Moon : Sun;
    return <button type="button" className="theme-toggle-text" aria-pressed={theme === "dark"} onClick={onToggle}>
      {theme === "light" ? "Dark mode" : "Light mode"} <Icon weight="bold" aria-hidden="true" />
    </button>;
  }
  return <button type="button" className="theme-toggle" aria-label={theme === "light" ? "Switch to dark theme" : "Switch to light theme"} aria-pressed={theme === "dark"} onClick={onToggle}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      {theme === "light" ? <path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z" /> : <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></>}
    </svg>
  </button>;
}
