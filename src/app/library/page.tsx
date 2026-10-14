import type { Metadata } from "next";
import { libraryItems, libraryMedia } from "../../content/library";
import type { LibraryItem } from "../../content/library";
import { tutorials, youtubeChannel } from "../../content/tutorials";
import type { Tutorial } from "../../content/tutorials";
import { LibraryBrowser } from "../../library/LibraryBrowser";
import { LibraryCard } from "../../library/LibraryCard";
import { YouTubeFacade } from "../../library/YouTubeFacade";

const description = "Free components, effects and prompts from Abbas Alabura's own product and web work. Copy them, take them apart, ship them.";
const shareImage = libraryItems[0] ? libraryMedia(libraryItems[0].slug).og : undefined;

export const metadata: Metadata = {
  title: "Library",
  description,
  alternates: { canonical: "/library" },
  openGraph: { title: "Library | Abbas Alabura", description, url: "/library", images: shareImage ? [{ url: shareImage, width: 1200, height: 630 }] : undefined },
  twitter: { card: "summary_large_image", title: "Library | Abbas Alabura", description, images: shareImage ? [shareImage] : undefined },
};

function TutorialFeature({ latest, earlier }: { latest: Tutorial; earlier: Tutorial[] }) {
  return (
    <div className="library-feature">
      <p className="section-kicker">Latest tutorial</p>
      <YouTubeFacade tutorial={latest} />
      <h2 data-text-reveal="lines">{latest.title}</h2>
      <p>{latest.summary}</p>
      {earlier.length > 0 && (
        <ul className="library-feature__more">
          {earlier.slice(0, 3).map((tutorial) => (
            <li key={tutorial.id}><a href={`https://www.youtube.com/watch?v=${tutorial.youtubeId}`}>{tutorial.title} ↗</a></li>
          ))}
        </ul>
      )}
      {youtubeChannel && <a className="text-link" href={youtubeChannel}>All tutorials on YouTube ↗</a>}
    </div>
  );
}

function NewestItem({ item }: { item: LibraryItem }) {
  return (
    <div className="library-feature">
      <p className="section-kicker">Newest on the shelf</p>
      <LibraryCard item={item} />
    </div>
  );
}

export default function LibraryPage() {
  const [latest, ...earlier] = tutorials;
  const newest = libraryItems[0];
  return (
    <>
      <section className="library-masthead" aria-labelledby="library-title">
        <div className="library-masthead__intro">
          <p className="section-kicker">Library</p>
          <h1 id="library-title" data-text-reveal="lines" data-text-reveal-load="">Free components,<br />effects and prompts</h1>
          <p>Pieces from my own product and web work, open for yours. Copy them, take them apart, ship them.</p>
        </div>
        {latest ? <TutorialFeature latest={latest} earlier={earlier} /> : newest && <NewestItem item={newest} />}
      </section>
      <LibraryBrowser items={libraryItems} />
    </>
  );
}
