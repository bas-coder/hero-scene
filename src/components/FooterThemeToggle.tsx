"use client";

import { useTheme } from "../design/useTheme";
import { ThemeToggle } from "./ThemeToggle";

// Theme is a rare preference, so it sits in the footer rather than the header HUD.
export function FooterThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return <ThemeToggle variant="text" theme={theme} onToggle={toggleTheme} />;
}
