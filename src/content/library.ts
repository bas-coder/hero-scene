/**
 * The Library: free assets from Abbas's own work. Plain data, so Work can read it without loading any demo code.
 * Rules (Strategy/architecture.md): own work only, never gated, launch with 4+ real items, Work sample needs 3 featured.
 */
export type LibraryType = "inspiration" | "prompt" | "component" | "effect";
export type LibraryStack = "react" | "next" | "three" | "r3f" | "gsap" | "css";

export interface LibraryItem {
  slug: string;
  type: LibraryType;
  title: string;
  summary: string;
  /** How it works, or what to notice. Short, concrete lines. */
  notes: string[];
  stack?: LibraryStack[];
  /** npm packages someone needs to add to use the source. */
  dependencies?: string[];
  /** Project-relative files shown as code on the asset page. They are the real source, never a copy. */
  source?: string[];
  prompt?: { text: string; tool: string };
  /** Poster and OG images live in public/library/<slug>/ and are made by `npm run posters`. */
  media: { alt: string };
  /** A live demo exists at /demo/<slug>. */
  demo?: boolean;
  tutorialId?: string;
  caseSlug?: string;
  featuredOnWork?: boolean;
  published: string;
  access: "free";
  /** Drafts are never listed, routed or put in the sitemap. */
  draft?: { reason: string };
}

export const libraryTypes: { type: LibraryType; label: string; plural: string }[] = [
  { type: "component", label: "Component", plural: "Components" },
  { type: "effect", label: "Effect", plural: "Effects" },
  { type: "prompt", label: "Prompt", plural: "Prompts" },
  { type: "inspiration", label: "Inspiration", plural: "Inspiration" },
];

export const stackLabels: Record<LibraryStack, string> = {
  react: "React",
  next: "Next.js",
  three: "Three.js",
  r3f: "React Three Fiber",
  gsap: "GSAP",
  css: "CSS",
};

const items: LibraryItem[] = [
  {
    slug: "ink-reveal",
    type: "effect",
    title: "Ink-to-render reveal",
    summary: "A 3D object draws itself in ink, shades in graphite, then turns into the real material. One progress value drives all three phases.",
    notes: [
      "Draw: dashed edge lines grow until the outline is complete (progress 0 to 0.34).",
      "Shade: the paper-white surface greys towards graphite (0.30 to 0.66).",
      "Life: the real colour and material arrive while the ink lifts away (0.62 to 1).",
      "The phases overlap on purpose, so no frame of the reveal sits still.",
      "Put RevealMaterial and InkEdges inside any mesh, then drive the progress ref from a timeline, scroll or a slider.",
      "Ink only follows edges where faces meet at more than 18°. Crisp shapes outline fully; very round ones, like DrawnRoundedBox, take the shading with little ink.",
      "Colours come from design tokens through readToken. Swap in your own values.",
    ],
    stack: ["three", "r3f"],
    dependencies: ["three", "@react-three/fiber", "@react-three/drei"],
    source: ["src/components/ink-reveal.tsx"],
    media: { alt: "Blocks and a cylinder outlined in ink and shaded in graphite, halfway to their finished colours" },
    demo: true,
    featuredOnWork: true,
    published: "2026-10-09",
    access: "free",
  },
  {
    slug: "variable-weight-headline",
    type: "effect",
    title: "Variable weight headline",
    summary: "The headline rises in letter by letter, then each letter thins out as the cursor nears it, on the font's own weight axis.",
    notes: [
      "Built on GSAP SplitText: chars inside masked lines rise from 135% to 0 over one second on expo.out, 0.0175s apart.",
      "After the reveal, each letter's weight eases between 560 and 200 by distance to the pointer, falling off linearly across about three times the font size.",
      "One gsap.quickTo per letter drives a --wght custom property, and a letter only re-tweens when its weight moves by a whole unit.",
      "It needs a variable font with a weight axis. Source Serif 4 Variable runs from 200 to 900, and the optical size axis stays automatic.",
      "Off on touch screens and with reduced motion. Screen readers get the whole sentence.",
    ],
    stack: ["react"],
    dependencies: ["react", "gsap"],
    source: ["src/components/TextReveal.tsx"],
    media: { alt: "A large serif headline with the letters under the cursor drawn thin and the rest semibold" },
    demo: true,
    featuredOnWork: true,
    published: "2026-10-12",
    access: "free",
  },
  {
    slug: "theme-switch",
    type: "component",
    title: "No-flash theme switch for Next.js",
    summary: "Light and dark mode that never flashes the wrong theme on load, remembers the choice and stays in step across tabs.",
    notes: [
      "A tiny inline script in <head> sets data-theme on <html> before the first paint.",
      "Add suppressHydrationWarning to <html>, because that script changes it before React hydrates.",
      "The hook starts from the same value on the server and the client, so there is no hydration mismatch, then reads the real theme on mount.",
      "The choice is saved to localStorage, and a storage listener keeps every open tab in step. Toggle the demo and this page follows.",
      "Blocked storage never breaks switching, and ?capture forces Light for screenshots.",
    ],
    stack: ["next", "react"],
    source: ["src/design/themeInit.ts", "src/design/useTheme.ts", "src/components/ThemeToggle.tsx"],
    media: { alt: "The same interface card shown in light and dark themes side by side" },
    demo: true,
    featuredOnWork: true,
    published: "2026-10-09",
    access: "free",
  },
  {
    slug: "dimensional-sketch-prompt",
    type: "prompt",
    title: "Dimensional Sketch prompt",
    summary: "Turns any 3D object into a loose blue ballpoint concept sketch on paper. Real form, drawn by hand.",
    notes: [
      "Contour first: the outline defines the object.",
      "Hatching only where the form needs it. Empty paper reads as light.",
      "Keep one light source, upper left.",
    ],
    prompt: {
      text: "Loose blue ballpoint pen concept sketch, expressive contour linework, subtle cross-hatching, light directional shading, hand-drawn industrial design sketch, minimal white paper background.",
      tool: "ChatGPT Images",
    },
    media: { alt: "A studio scene drawn as a blue ballpoint concept sketch" },
    published: "2026-10-09",
    access: "free",
    draft: { reason: "Confirm which images this prompt produced before showing them as its output." },
  },
];

export const libraryItems = items
  .filter((item) => !item.draft)
  .sort((a, b) => b.published.localeCompare(a.published));

export function getLibraryItem(slug: string) {
  return libraryItems.find((item) => item.slug === slug);
}

export function libraryMedia(slug: string) {
  const base = `/library/${slug}`;
  return {
    avif: `${base}/poster-800.avif 800w, ${base}/poster-1600.avif 1600w`,
    webp: `${base}/poster-800.webp 800w, ${base}/poster-1600.webp 1600w`,
    fallback: `${base}/poster-800.webp`,
    og: `${base}/og.jpg`,
    width: 1600,
    height: 1200,
  };
}

/** Work only shows the sample once it can be a real set. */
export const workSampleMinimum = 3;

export function workSampleItems() {
  const featured = libraryItems.filter((item) => item.featuredOnWork);
  return featured.length >= workSampleMinimum ? featured.slice(0, 6) : [];
}

export function typeLabel(type: LibraryType) {
  return libraryTypes.find((entry) => entry.type === type)?.label ?? type;
}
