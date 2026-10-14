"use client";

import { useEffect } from "react";
import { ThemeToggle } from "../../components/ThemeToggle";
import { useTheme } from "../../design/useTheme";
import type { ThemeMode } from "../../design/useTheme";
import { markPosterReady } from "./poster";
import type { DemoProps } from "./poster";

function SettingsCard({ mode, label }: { mode?: ThemeMode; label: string }) {
  return (
    <article className="demo-theme-card" data-theme={mode}>
      <p className="section-kicker">Settings</p>
      <h2>Appearance</h2>
      <p>Choose how the interface looks. The choice is saved on this device.</p>
      <dl>
        <div><dt>Theme</dt><dd>{label}</dd></div>
        <div><dt>Sync</dt><dd>Every open tab</dd></div>
      </dl>
    </article>
  );
}

export function ThemeSwitchDemo({ poster }: DemoProps) {
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    if (poster) document.fonts.ready.then(() => requestAnimationFrame(markPosterReady));
  }, [poster]);

  if (poster) {
    return (
      <main className="demo-stage demo-stage--split">
        <SettingsCard mode="light" label="Light" />
        <SettingsCard mode="dark" label="Dark" />
      </main>
    );
  }

  return (
    <main className="demo-stage">
      <SettingsCard label={theme === "dark" ? "Dark" : "Light"} />
      <div className="demo-theme-controls">
        <ThemeToggle theme={theme} onToggle={toggleTheme} />
        <span>Switch theme. Other open tabs follow.</span>
      </div>
    </main>
  );
}
