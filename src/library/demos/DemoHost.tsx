"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { ComponentType } from "react";
import { useTheme } from "../../design/useTheme";
import type { DemoProps } from "./poster";
import "./demo.css";

const demos: Record<string, ComponentType<DemoProps>> = {
  "ink-reveal": dynamic(() => import("./InkRevealDemo").then((module) => module.InkRevealDemo), { ssr: false }),
  "variable-weight-headline": dynamic(() => import("./WeightHeadlineDemo").then((module) => module.WeightHeadlineDemo)),
  "theme-switch": dynamic(() => import("./ThemeSwitchDemo").then((module) => module.ThemeSwitchDemo)),
};

export function DemoHost({ slug }: { slug: string }) {
  // Keeps an embedded demo in step when the surrounding page changes theme.
  useTheme();
  const [poster, setPoster] = useState(false);
  useEffect(() => {
    setPoster(new URLSearchParams(location.search).has("poster"));
  }, []);
  const Demo = demos[slug];
  return Demo ? <Demo poster={poster} /> : null;
}
