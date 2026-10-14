import Link from "next/link";
import { FooterThemeToggle } from "../components/FooterThemeToggle";
import { youtubeChannel } from "../content/tutorials";

export function LibraryFooter() {
  return (
    <footer className="library-footer">
      <span>Abbas Alabura © 2026</span>
      <nav aria-label="Footer">
        <a href="/#work">Work</a>
        <Link href="/library">Library</Link>
        {youtubeChannel && <a href={youtubeChannel}>YouTube</a>}
        <FooterThemeToggle />
      </nav>
    </footer>
  );
}
