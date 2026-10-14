import { readBreakpoints } from "./scripts/design-breakpoints.mjs";

// Breakpoints stay authored in the Responsive collection; expose the resolved width to image `sizes`.
const breakpoints = readBreakpoints();

/** @type {import("next").NextConfig} */
const config = {
  reactStrictMode: true,
  env: {
    DESIGN_BREAKPOINT_MOBILE: `${breakpoints.mobile}px`,
  },
  // The proximity headline became the variable weight headline; old links keep working.
  async redirects() {
    return [
      { source: "/library/proximity-headline", destination: "/library/variable-weight-headline", permanent: true },
      { source: "/demo/proximity-headline", destination: "/demo/variable-weight-headline", permanent: true },
    ];
  },
};

export default config;
