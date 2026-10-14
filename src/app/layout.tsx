import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@fontsource-variable/inter";
import "@fontsource-variable/source-serif-4/opsz.css";
import "@fontsource-variable/source-serif-4/opsz-italic.css";
import "@fontsource/nothing-you-could-do/latin-400.css";
import "../design/tokens.css";
import "../styles.css";
import { faviconHref, themeInitScript } from "../design/themeInit";
import { TextReveal } from "../components/TextReveal";
import { siteUrl } from "../lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Abbas Alabura | Product Designer",
    template: "%s | Abbas Alabura",
  },
  description: "Abbas Alabura is a product designer for clear AI products and web experiences",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <link rel="icon" type="image/svg+xml" href={faviconHref("light")} />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <meta name="theme-color" content="" />
      </head>
      <body>
        {children}
        <TextReveal />
      </body>
    </html>
  );
}
