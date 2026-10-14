import type { ReactNode } from "react";
import { SiteHeader } from "../../components/SiteHeader";
import { HireBand } from "../../library/HireBand";
import { LibraryFooter } from "../../library/LibraryFooter";
import "../../library/library.css";

export default function LibraryLayout({ children }: { children: ReactNode }) {
  return (
    <div className="site-shell library-shell">
      <SiteHeader />
      <main className="library">
        {children}
        <HireBand />
      </main>
      <LibraryFooter />
    </div>
  );
}
