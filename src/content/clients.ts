// Companies shown in the "Trusted by" logo grid, newest first. Facts come from the résumé in "Info About Me/".
// Logo files live in public/logos/clients/ and investor icons in public/logos/investors/, as svg, png, webp or ico,
// named by slug or by company name ("Marven Grey.svg"); src/lib/clientLogos.ts finds both at build time.

export const clientsLabel = "Trusted by AI & SaaS teams from San Francisco to Lagos";

export interface Client {
  slug: string;
  name: string;
  /** One sentence about the work, shown in the tile's tooltip. */
  note: string;
  /** Optical size correction for a logo that reads too big or small beside the others. */
  scale?: number;
  /** The logo is drawn for dark backgrounds (white lettering), so its tones flip the other way in each theme. */
  onDark?: boolean;
  /** Only publicly sourced funding; the tooltip shows it as investor chips. */
  funding?: Funding;
}

export interface Investor {
  name: string;
  slug: string;
  /** Inset a wordmark-style icon inside its circle instead of filling it. */
  padded?: boolean;
}

export interface Funding {
  kind: "raised" | "backed";
  /** Shown as "Raised <amount> from"; only with kind "raised". */
  amount?: string;
  investors: Investor[];
  /** Where the claim is published. Required, so unsourced funding never ships. */
  source: string;
}

export type InvestorWithIcon = Investor & { icon: string | null };

export type ClientWithLogo = Omit<Client, "funding"> & {
  logo: string | null;
  funding?: Omit<Funding, "investors"> & { investors: InvestorWithIcon[] };
};

export const clients: Client[] = [
  { slug: "aiwa", name: "AIWA", scale: 1.2, note: "Designing the AIWA marketing site: brand system, scroll motion and a homepage that shows the value first." },
  { slug: "qualia", name: "Qualia Technologies", note: "Built the design system and main web platform, shipped to GitHub so engineering built from the same files." },
  {
    slug: "flable",
    name: "Flable AI",
    note: "Redesigned the AI dashboard and set the design standards the team builds on.",
    funding: {
      kind: "backed",
      investors: [
        { name: "Microsoft for Startups", slug: "microsoft", padded: true },
        { name: "NVIDIA Inception", slug: "nvidia" },
      ],
      source: "https://flable.ai (homepage \"Backed By\" section)",
    },
  },
  { slug: "seorce", name: "SEORCE", note: "Redesigned the website and the SEO analytics product. Average session time doubled from 2 to 4 minutes." },
  { slug: "balanced-futures", name: "Balanced Futures", note: "Designed Loomify, a mobile marketplace, and handed it to engineering in 6 weeks." },
  { slug: "marven-grey", name: "Marven Grey", onDark: true, scale: 1.2, note: "Led creative direction across websites, SaaS products and brand work." },
  { slug: "tanta", name: "Tanta Innovative", note: "Ran 5 projects across healthcare, banking and retail; a shared design system cut delivery time by 25%." },
  { slug: "blue-algorithm", name: "Blue Algorithm Tech", note: "Where I started, designing live client interfaces after moving up from training." },
];
