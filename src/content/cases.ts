/** Case studies. Flable is a placeholder until the story is written; the hero's white key and "View case" open it. */

export interface CaseSection {
  title: string;
  body: string;
}

export interface CaseStudy {
  slug: string;
  title: string;
  summary: string;
  meta: { label: string; value: string }[];
  cover: { avif: string; webp: string; width: number; height: number; alt: string };
  sections: CaseSection[];
}

export const cases: CaseStudy[] = [
  {
    slug: "flable",
    title: "Flable",
    summary: "An AI platform made clear enough to trust and simple enough to use each day",
    meta: [
      { label: "Product", value: "AI CMO for e-commerce teams" },
      { label: "Role", value: "Product designer" },
      { label: "Shipped", value: "2026" },
    ],
    cover: {
      avif: "/media/flable/hero-poster-1440.avif",
      webp: "/media/flable/hero-poster-1440.webp",
      width: 1440,
      height: 900,
      alt: "Flable's AI CMO on a MacBook, with its key numbers lifting out of the screen",
    },
    sections: [
      { title: "The problem", body: "Case study in progress. This section will cover what marketers could not see in their Shopify, Meta and Google numbers." },
      { title: "The people", body: "Case study in progress. This section will cover who uses Flable each morning and what they need from it." },
      { title: "The outcome", body: "Case study in progress. This section will cover what changed after launch." },
    ],
  },
];

export const getCase = (slug: string) => cases.find((entry) => entry.slug === slug);
export const caseHref = (slug: string) => `/work/${slug}`;
