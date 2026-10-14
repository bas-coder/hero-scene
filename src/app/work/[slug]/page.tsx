import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cases, getCase } from "../../../content/cases";

type Params = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return cases.map((entry) => ({ slug: entry.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const study = getCase((await params).slug);
  if (!study) return {};
  return {
    title: `${study.title} case study`,
    description: study.summary,
    alternates: { canonical: `/work/${study.slug}` },
  };
}

export default async function CaseStudyPage({ params }: Params) {
  const study = getCase((await params).slug);
  if (!study) notFound();

  return (
    <article className="case-study">
      <header className="case-masthead" data-header-tone="dark">
        <nav className="case-crumbs" aria-label="Breadcrumb">
          <Link href="/#work">Work</Link>
          <span aria-hidden="true">/</span>
          <span>{study.title}</span>
        </nav>
        <h1 data-text-reveal="lines" data-text-reveal-load="">{study.title}</h1>
        <p>{study.summary}</p>
        <dl className="case-meta">
          {study.meta.map((item) => (
            <div key={item.label}>
              <dt>{item.label}</dt>
              <dd>{item.value}</dd>
            </div>
          ))}
        </dl>
      </header>

      <figure className="case-cover">
        <picture>
          <source type="image/avif" srcSet={study.cover.avif} />
          <img src={study.cover.webp} width={study.cover.width} height={study.cover.height} alt={study.cover.alt} />
        </picture>
      </figure>

      <div className="case-sections">
        {study.sections.map((section) => (
          <section key={section.title} className="case-section">
            <h2 data-text-reveal="lines">{section.title}</h2>
            <p>{section.body}</p>
          </section>
        ))}
      </div>

      <footer className="case-footer">
        <Link href="/#work">Back to work</Link>
      </footer>
    </article>
  );
}
