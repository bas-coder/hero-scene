import type { ReactNode } from "react";
import { SiteHeader } from "../../components/SiteHeader";
import { SmoothScroll } from "../../components/SmoothScroll";
import "../../work/case.css";

export default function WorkLayout({ children }: { children: ReactNode }) {
  return (
    <div className="site-shell case-shell">
      <SmoothScroll />
      <SiteHeader />
      <main className="case">{children}</main>
    </div>
  );
}
