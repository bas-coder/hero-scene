import Link from "next/link";
import type { LibraryItem } from "../content/library";
import { libraryMedia, stackLabels, typeLabel } from "../content/library";
import "./library-card.css";

/** Poster-only card. Never mounts a live demo, so grids and the Work sample stay light. */
export function LibraryCard({ item }: { item: LibraryItem }) {
  const media = libraryMedia(item.slug);
  const sizes = `(max-width: ${process.env.DESIGN_BREAKPOINT_MOBILE}) 94vw, 32vw`;
  return (
    <article className="library-card">
      <Link className="library-card__link" href={`/library/${item.slug}`}>
        <div className="library-card__media">
          <picture>
            <source type="image/avif" srcSet={media.avif} sizes={sizes} />
            <source type="image/webp" srcSet={media.webp} sizes={sizes} />
            <img src={media.fallback} width={media.width} height={media.height} alt={item.media.alt} loading="lazy" decoding="async" />
          </picture>
          <span className="library-card__type">{typeLabel(item.type)}</span>
        </div>
        <div className="library-card__copy">
          <h3 data-text-reveal="lines">{item.title}</h3>
          <p>{item.summary}</p>
          {item.stack && (
            <ul className="library-chips" aria-label="Built with">
              {item.stack.map((stack) => <li key={stack}>{stackLabels[stack]}</li>)}
            </ul>
          )}
        </div>
      </Link>
    </article>
  );
}
