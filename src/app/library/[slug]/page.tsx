import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLibraryItem, libraryItems, libraryMedia, libraryTypes, stackLabels, typeLabel } from "../../../content/library";
import { getTutorial, tutorialFor } from "../../../content/tutorials";
import { CodeBlock } from "../../../library/CodeBlock";
import { CopyButton } from "../../../library/CopyButton";
import { LibraryCard } from "../../../library/LibraryCard";
import { YouTubeFacade } from "../../../library/YouTubeFacade";

type Params = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return libraryItems.map((item) => ({ slug: item.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const item = getLibraryItem((await params).slug);
  if (!item) return {};
  const og = libraryMedia(item.slug).og;
  return {
    title: item.title,
    description: item.summary,
    alternates: { canonical: `/library/${item.slug}` },
    openGraph: { type: "article", title: item.title, description: item.summary, url: `/library/${item.slug}`, images: [{ url: og, width: 1200, height: 630, alt: item.media.alt }] },
    twitter: { card: "summary_large_image", title: item.title, description: item.summary, images: [og] },
  };
}

const published = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

export default async function LibraryItemPage({ params }: Params) {
  const item = getLibraryItem((await params).slug);
  if (!item) notFound();

  const media = libraryMedia(item.slug);
  const plural = libraryTypes.find((entry) => entry.type === item.type)?.plural ?? typeLabel(item.type);
  const tutorial = item.tutorialId ? getTutorial(item.tutorialId) : tutorialFor(item.slug);
  const others = libraryItems.filter((other) => other.slug !== item.slug);
  const related = [...others.filter((other) => other.type === item.type), ...others.filter((other) => other.type !== item.type)].slice(0, 3);

  return (
    <article className="library-item">
      <header className="library-masthead library-masthead--item">
        <div className="library-masthead__intro">
          <nav className="library-crumbs" aria-label="Breadcrumb">
            <Link href="/library">Library</Link>
            <span aria-hidden="true">/</span>
            <Link href={`/library?type=${item.type}`}>{plural}</Link>
          </nav>
          <h1 data-text-reveal="lines" data-text-reveal-load="">{item.title}</h1>
          <p>{item.summary}</p>
        </div>
        <dl className="library-meta">
          <div><dt>Type</dt><dd>{typeLabel(item.type)}</dd></div>
          {item.stack && <div><dt>Built with</dt><dd>{item.stack.map((stack) => stackLabels[stack]).join(", ")}</dd></div>}
          {item.prompt && <div><dt>Made in</dt><dd>{item.prompt.tool}</dd></div>}
          <div><dt>Published</dt><dd><time dateTime={item.published}>{published.format(new Date(item.published))}</time></dd></div>
          <div><dt>Access</dt><dd>Free</dd></div>
        </dl>
      </header>

      {item.demo && (
        <figure className="library-demo">
          <div className="library-demo__frame" style={{ backgroundImage: `url(${media.fallback})` }}>
            <iframe src={`/demo/${item.slug}`} title={`${item.title}, live demo`} loading="lazy" />
          </div>
          <figcaption>
            <span>Live demo</span>
            <a href={`/demo/${item.slug}`} target="_blank" rel="noopener">Open on its own ↗</a>
          </figcaption>
        </figure>
      )}

      {item.prompt && (
        <section className="library-prompt" aria-labelledby="prompt-title">
          <div className="library-prompt__head">
            <h2 id="prompt-title" className="section-kicker">Prompt</h2>
            <CopyButton text={item.prompt.text} label="Copy prompt" />
          </div>
          <blockquote>{item.prompt.text}</blockquote>
        </section>
      )}

      {!item.demo && (
        <picture className="library-still">
          <source type="image/avif" srcSet={media.avif} sizes="100vw" />
          <source type="image/webp" srcSet={media.webp} sizes="100vw" />
          <img src={media.fallback} width={media.width} height={media.height} alt={item.media.alt} decoding="async" />
        </picture>
      )}

      <div className="library-item__body">
        <section className="library-notes" aria-labelledby="notes-title">
          <h2 id="notes-title" className="section-kicker">{item.type === "inspiration" ? "What to notice" : "How it works"}</h2>
          <ol>
            {item.notes.map((note) => <li key={note}>{note}</li>)}
          </ol>
        </section>

        {item.source && (
          <section className="library-source" aria-labelledby="source-title">
            <h2 id="source-title" className="section-kicker">Source</h2>
            {item.dependencies && item.dependencies.length > 0 && (
              <div className="library-install">
                <code>npm i {item.dependencies.join(" ")}</code>
                <CopyButton text={`npm i ${item.dependencies.join(" ")}`} />
              </div>
            )}
            {item.source.map((file) => <CodeBlock key={file} file={file} />)}
          </section>
        )}
      </div>

      {tutorial && (
        <section className="library-tutorial" aria-labelledby="tutorial-title">
          <h2 id="tutorial-title" className="section-kicker">Watch how it is built</h2>
          <YouTubeFacade tutorial={tutorial} />
          <p>{tutorial.title}</p>
        </section>
      )}

      {related.length > 0 && (
        <section className="library-related" aria-labelledby="related-title">
          <h2 id="related-title" className="section-kicker">More from the Library</h2>
          <ul className="library-grid">
            {related.map((other) => <li key={other.slug}><LibraryCard item={other} /></li>)}
          </ul>
        </section>
      )}
    </article>
  );
}
