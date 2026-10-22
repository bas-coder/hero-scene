"use client";

import { Plus, Minus, ArrowRight, ArrowUp } from "@phosphor-icons/react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Fragment, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SiteHeader } from "../components/SiteHeader";
import { SmoothScroll } from "../components/SmoothScroll";
import { ClientLogos } from "../components/ClientLogos";
import { FooterThemeToggle } from "../components/FooterThemeToggle";
import { KeycapButton } from "../components/KeycapButton";
import { ResponsiveImage } from "../components/ResponsiveImage";
import { Statement } from "../components/Statement";
import { selectQualityTier } from "../lib/assets";
import { workSampleItems } from "../content/library";
import { youtubeChannel } from "../content/tutorials";
import { LibraryCard } from "../library/LibraryCard";
import { bookHref, email } from "../lib/contact";
import { getShot } from "../hero/engine/shots/index.js";
import { caseHref } from "../content/cases";
import type { HeroContent, ProjectMedia, QualityTier } from "../types";
import type { ClientWithLogo } from "../content/clients";

gsap.registerPlugin(ScrollTrigger);

const HeroCanvas = dynamic(() => import("../components/HeroCanvas").then((module) => module.HeroCanvas), { ssr: false });
const heroShot = getShot("flable");

const heroContent: HeroContent = {
  badge: "A few project slots are open",
  name: "Abbas Alabura -",
  headline: [
    [{ text: "a " }, { text: "product designer", em: true }, { text: " who makes" }],
    [{ text: "complex products feel simple" }],
  ],
  primaryLabel: "Start a project",
  primaryHref: bookHref,
  secondaryLabel: "See my work",
  secondaryHref: "#work",
};

const heroMeta = {
  role: ["Product Designer", "Building at AIWA"],
  place: ["EMEA Based", "Working Globally"],
};

const interfaceMedia: ProjectMedia = {
  name: "Flable product interface",
  avif: "/media/interface-1440.avif",
  webp: "/media/interface-1440.webp",
  width: 1440,
  height: 900,
  alt: "A black ink interface study for an AI product",
};

/** The hero shot's held breakout frame, for browsers without WebGL. */
const heroPosterMedia: ProjectMedia = {
  name: "Flable hero shot",
  avif: "/media/flable/hero-poster-1440.avif",
  webp: "/media/flable/hero-poster-1440.webp",
  width: 1440,
  height: 900,
  alt: "Flable's AI CMO on a MacBook in a lilac morning studio, with its key numbers lifting out of the screen",
};

const atelierMedia: ProjectMedia = {
  name: "Abbas workspace study",
  avif: "/media/atelier-1440.avif",
  webp: "/media/atelier-1440.webp",
  width: 1440,
  height: 900,
  alt: "A drawn studio with a laptop, lamp, notebook and interface work",
};

// The hero's MacBook is CC BY 4.0, which asks for this credit wherever the work is shown.
const modelCredit = {
  short: "MacBook model by akshatmittal, CC BY 4.0",
  full: "Based on \"2021 Macbook Pro 14\" (M1 Pro / M1 Max)\" by akshatmittal, licensed under CC BY 4.0",
  href: "https://sketchfab.com/3d-models/2021-macbook-pro-14-m1-pro-m1-max-f6b0b940fb6a4286b18a674ef32af2d3",
};

const services = [
  {
    number: "01",
    title: "Product interfaces",
    copy: "Clear flows, strong UI and the small states that make software feel done",
    deliverables: "Product strategy · User flows · UI systems · Prototypes",
  },
  {
    number: "02",
    title: "AI products",
    copy: "Hard AI workflows shaped into tools people can understand and trust",
    deliverables: "AI UX · Trust states · Prompt flows · Product design",
  },
  {
    number: "03",
    title: "Marketing sites",
    copy: "A clear story, a bold visual world and a site built to hold attention",
    deliverables: "Story · Art direction · Web design · Motion",
  },
];

const processSteps = [
  ["01", "Frame the real problem", "We agree on what must change, what is fixed and what good looks like"],
  ["02", "Make the direction real", "I map the core flow and build the most important moments early"],
  ["03", "Refine in the open", "You see focused progress often, while the work is still easy to improve"],
  ["04", "Finish the last ten percent", "States, motion, mobile behavior and handoff are part of the design"],
];

const faqItems = [
  ["Can one designer handle the project?", "Yes for focused product and web work. You work with me from the first idea to handoff. If we need more skills, I can bring in trusted people from WeAreQuest and make every role clear before we start"],
  ["What happens in the first week?", "We set the goal, study the current product and make one key part real enough to judge together"],
  ["How fast can we start?", "Send the context first. I will reply with fit, timing and the first useful step"],
  ["How do feedback and updates work?", "You get direct updates and short reviews at the points where your input matters most"],
  ["Are you open to full-time roles?", "Yes. I am open to the right product design role and a small number of focused projects"],
];

function supportsWebGL() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

function Hero({
  reveal,
  quality,
  onSceneReady,
  hasWebGL,
  reducedMotion,
  exit,
  active,
  heroRef,
}: {
  reveal: MutableRefObject<number>;
  quality: QualityTier;
  onSceneReady: () => void;
  hasWebGL: boolean | null;
  reducedMotion: boolean;
  exit: MutableRefObject<number>;
  active: boolean;
  heroRef: MutableRefObject<HTMLElement | null>;
}) {
  return (
    <section ref={heroRef} className="hero" id="top" aria-labelledby="hero-title" data-header-tone="dark" data-header-current="glass" data-hero-shot={heroShot.id}>
      <div className="hero-visual" aria-hidden="true">
        {hasWebGL === true && (
          <Suspense fallback={null}>
            <HeroCanvas reveal={reveal} quality={quality} onReady={onSceneReady} exit={exit} active={active} reducedMotion={reducedMotion} />
          </Suspense>
        )}
        {hasWebGL === false && <ResponsiveImage media={heroPosterMedia} className="hero-fallback" sizes="100vw" />}
        <div className="hero-vignette" />
      </div>

      <div className="hero-hud">
        <div className="hero-body">
          <div className="hero-copy">
            <div className="availability">
              <i className="badge-mark" aria-hidden="true" />
              {heroContent.badge}
            </div>
            {/* The name opens the sentence, as on olenkevich.com. Weight follows the pointer (extrafazant.nl):
                semibold at rest, thin under the cursor. */}
            <h1
              id="hero-title"
              data-text-reveal="chars"
              data-text-reveal-load=""
              data-text-reveal-delay="0.15"
              data-font-weight-hover=""
              data-weight-rest="560"
              data-weight-near="200"
              data-radius-em="3.1"
            >
              <span className="hero-line hero-line--name">{heroContent.name}</span>
              {/* A real space between lines, so the heading reads as one sentence to screen readers. */}
              {heroContent.headline.map((line, index) => (
                <Fragment key={index}>
                  {" "}
                  <span className="hero-line">
                    {line.map((run) => (run.em ? <em key={run.text}>{run.text}</em> : run.text))}
                  </span>
                </Fragment>
              ))}
            </h1>
          </div>
          <div className="hero-actions">
            <a className="glass-button" href={heroContent.secondaryHref}>{heroContent.secondaryLabel}</a>
            <KeycapButton href={heroContent.primaryHref}>{heroContent.primaryLabel}</KeycapButton>
          </div>
        </div>
        <Link className="hero-case-link" href={caseHref("flable")}>Open the Flable case study</Link>
        <div className="hero-footer">
          <p className="hero-meta">
            <span>{heroMeta.role[0]}</span>
            <span>{heroMeta.role[1]}</span>
          </p>
          <p className="hero-meta hero-meta--end">
            <span>{heroMeta.place[0]}</span>
            <span>{heroMeta.place[1]}</span>
          </p>
        </div>
      </div>
    </section>
  );
}

function SelectedWork() {
  return (
    <section className="selected-work" id="work">
      <div className="section-intro" data-reveal>
        <p className="section-kicker">02 / Selected work</p>
        <h2 data-text-reveal="lines">Four products<br />No filler</h2>
        <p className="section-lede">Shipped work first<br />The thinking sits one level deeper</p>
      </div>

      <article className="project project--lead" data-reveal>
        <div className="project-meta"><span>01</span><span>AI product</span><span>Shipped 2026</span></div>
        <div className="project-media project-media--ink">
          <ResponsiveImage media={interfaceMedia} />
          <div className="project-stamp">FL / 01</div>
          <Link href={caseHref("flable")} aria-label="Open the Flable case study">View case ↗</Link>
        </div>
        <div className="project-copy">
          <h3 data-text-reveal="lines">Flable</h3>
          <p>An AI platform made clear enough to trust and simple enough to use each day</p>
        </div>
      </article>

      <div className="project-grid">
        <article className="project" data-reveal>
          <div className="project-meta"><span>02</span><span>Community product</span><span>Shipped</span></div>
          <div className="project-art project-art--qualia" aria-hidden="true">
            <span>QUALIA</span><strong>COMMON<br />GROUND</strong><b>QC</b>
          </div>
          <div className="project-copy"><h3 data-text-reveal="lines">Qualia Commons</h3><p>A calmer way to find people, ideas and common ground</p></div>
        </article>
        <article className="project" data-reveal>
          <div className="project-meta"><span>03</span><span>AI workflow</span><span>Shipped</span></div>
          <div className="project-art project-art--aiwa" aria-hidden="true">
            <div className="aiwa-window"><span /><span /><span /><strong>AIWA</strong><small>Ask clearly<br />Move faster</small></div>
          </div>
          <div className="project-copy"><h3 data-text-reveal="lines">AIWA</h3><p>A capable AI workflow made direct and easy to read</p></div>
        </article>
      </div>

      <article className="reserved-project" data-reveal>
        <p className="section-kicker">04 / Reserved</p>
        <h3 data-text-reveal="lines">The next shipped story</h3>
        <p>This place stays open until the work can prove the problem, choices and result</p>
      </article>
    </section>
  );
}

function Services() {
  const [open, setOpen] = useState(0);
  return (
    <section className="services" id="services">
      <div className="services-intro" data-reveal>
        <p className="section-kicker">03 / What I take on</p>
        <h2 data-text-reveal="lines">One designer<br />A full point of view</h2>
        <p>Focused work where product thinking and strong craft need to arrive together</p>
      </div>
      <div className="service-list" data-reveal>
        {services.map((service, index) => (
          <article className={open === index ? "is-open" : ""} key={service.title}>
            <button type="button" aria-expanded={open === index} onClick={() => setOpen(index)}>
              <span>({service.number})</span><h3 data-text-reveal="lines">{service.title}</h3><b>{open === index ? <Minus weight="bold" /> : <Plus weight="bold" />}</b>
            </button>
            <div className="service-answer">
              <p>{service.copy}</p><small>{service.deliverables}</small>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function Process() {
  return (
    <section className="process">
      <div className="process-heading" data-reveal>
        <p className="section-kicker">04 / How we work</p>
        <h2 data-text-reveal="lines">Close enough to care<br />Clear enough to move</h2>
        <p>You work with me from the first question to the final handoff</p>
      </div>
      <ol className="process-list">
        {processSteps.map(([number, title, copy]) => (
          <li key={number} data-reveal><span>{number}</span><div><h3 data-text-reveal="lines">{title}</h3><p>{copy}</p></div></li>
        ))}
      </ol>
    </section>
  );
}

function About() {
  return (
    <section className="about" id="index">
      <div className="about-image" data-reveal>
        <ResponsiveImage media={atelierMedia} />
        <span>Portrait study / Your photo will replace this</span>
      </div>
      <div className="about-copy" data-reveal>
        <p className="section-kicker">05 / Behind the work</p>
        <h2 data-text-reveal="lines">The interface is precise<br />The process stays human</h2>
        <p>I’m Abbas, a Product Designer in Lagos. I care about the parts people feel before they can name them</p>
        <div className="route-cards" id="yard">
          <a href="#index"><span>Index</span><small>The fast, clear version</small><b>↗</b></a>
          <a href="#yard"><span>The Yard</span><small>Tools, worlds and experiments</small><b>↗</b></a>
          <Link className="route-card--wide" href="/library"><span>Library</span><small>Free components, effects and prompts</small><b>↗</b></Link>
        </div>
      </div>
    </section>
  );
}

function FAQ() {
  return (
    <section className="faq">
      <div className="faq-heading" data-reveal>
        <p className="section-kicker">06 / Before we begin</p>
        <h2 data-text-reveal="lines">Good questions<br />Clear answers</h2>
        <p>Still unsure?</p>
        <a href={bookHref}>Send a short note <ArrowRight weight="bold" /></a>
      </div>
      <div className="faq-list" data-reveal>
        {faqItems.map(([question, answer], index) => (
          <details key={question} open={index === 0}>
            <summary>{question}<span><Plus weight="bold" /></span></summary>
            <p>{answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

/** Pulls featured Library items. Hidden until there are enough real ones to read as a set. */
function WorkSample() {
  const items = workSampleItems();
  if (items.length === 0) return null;
  return (
    <section className="work-sample" aria-labelledby="work-sample-title">
      <div className="work-sample__intro" data-reveal>
        <p className="section-kicker">07 / Work sample</p>
        <h2 id="work-sample-title" data-text-reveal="lines">Small pieces<br />Built properly</h2>
        <Link className="text-link" href="/library">All in the Library</Link>
      </div>
      <ul className="library-grid" data-reveal>
        {items.map((item) => <li key={item.slug}><LibraryCard item={item} /></li>)}
      </ul>
    </section>
  );
}

function Closing() {
  return (
    <section className="closing" id="contact">
      <div data-reveal>
        <p className="section-kicker">{`${workSampleItems().length > 0 ? "08" : "07"} / Your move`}</p>
        <h2 data-text-reveal="lines">Have a product<br />worth caring about?</h2>
      </div>
      <div className="closing-actions" data-reveal>
        <KeycapButton href={bookHref}>Start a project <span aria-hidden="true">↗</span></KeycapButton>
        <p>A short note is enough<br /><a href={bookHref}>{email}</a></p>
      </div>
      <footer>
        <span>Abbas Alabura © 2026</span>
        <nav aria-label="Footer">
          <Link href="/library">Library</Link>
          {youtubeChannel && <a href={youtubeChannel}>YouTube</a>}
          <FooterThemeToggle />
          <a href={modelCredit.href} title={modelCredit.full} rel="noreferrer" target="_blank">{modelCredit.short}</a>
          <a href="#top">Back to top <ArrowUp weight="bold" /></a>
        </nav>
      </footer>
    </section>
  );
}

function MobileDock() {
  return (
    <nav className="mobile-dock" aria-label="Mobile navigation">
      <a className="is-active" href="#work">Work</a>
      <a href="#index">Index</a>
      <a href="#yard">Yard</a>
      <a href="#contact">Contact</a>
    </nav>
  );
}

const sceneRevealDuration = heroShot.introDuration;

export function WorkPage({ clients }: { clients: ClientWithLogo[] }) {
  const [isCaptureMode] = useState(() => typeof document !== "undefined" && document.documentElement.dataset.capture === "true");
  const reveal = useRef(isCaptureMode ? 1 : 0);
  // Device capability is only known in the browser; the server renders the hero without its visual.
  const [hasWebGL, setHasWebGL] = useState<boolean | null>(null);
  const [quality, setQuality] = useState<QualityTier>("low");
  const [sceneReady, setSceneReady] = useState(isCaptureMode);
  const [reducedMotion, setReducedMotion] = useState(false);
  const heroRef = useRef<HTMLElement | null>(null);
  const exit = useRef(0);
  const [heroActive, setHeroActive] = useState(true);

  const handleSceneReady = useCallback(() => {
    setSceneReady(true);
  }, []);

  useEffect(() => {
    const webgl = supportsWebGL();
    setReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    setQuality(selectQualityTier());
    setHasWebGL(webgl);
    if (!webgl) setSceneReady(true);
  }, []);

  useLayoutEffect(() => {
    if (!sceneReady || isCaptureMode) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timeline = gsap.timeline();
    timeline.to(reveal, {
      current: 1,
      duration: reduced ? 0.01 : sceneRevealDuration,
      ease: "none",
    });
    return () => {
      timeline.kill();
    };
  }, [sceneReady, isCaptureMode]);

  useLayoutEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    const context = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>("[data-reveal]").forEach((element) => {
        // A block that holds a revealing headline only fades: the headline's own masked rise is the motion.
        const rise = element.querySelector("[data-text-reveal]") ? 0 : 44;
        gsap.fromTo(
          element,
          { autoAlpha: 0, y: rise },
          {
            autoAlpha: 1,
            y: 0,
            duration: 1,
            ease: "power3.out",
            scrollTrigger: { trigger: element, start: "top 86%", once: true },
          },
        );
      });
    });
    return () => context.revert();
  }, []);

  // On the way out, scroll closes the lid; once the hero is off screen the canvas stops rendering.
  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const observer = new IntersectionObserver(([entry]) => setHeroActive(entry.isIntersecting), { rootMargin: "64px 0px" });
    observer.observe(hero);
    const trigger = ScrollTrigger.create({
      trigger: hero,
      start: "top top",
      end: "bottom top",
      onUpdate: (self) => {
        exit.current = reduced ? 0 : self.progress;
      },
    });
    return () => {
      observer.disconnect();
      trigger.kill();
    };
  }, []);

  useEffect(() => {
    const closeOthers = (event: Event) => {
      const current = event.currentTarget as HTMLDetailsElement;
      if (!current.open) return;
      document.querySelectorAll<HTMLDetailsElement>(".faq-list details").forEach((item) => {
        if (item !== current) item.open = false;
      });
    };
    const details = document.querySelectorAll<HTMLDetailsElement>(".faq-list details");
    details.forEach((item) => item.addEventListener("toggle", closeOthers));
    return () => details.forEach((item) => item.removeEventListener("toggle", closeOthers));
  }, []);

  return (
    <div className="site-shell">
      <SmoothScroll />
      <SiteHeader />
      <main>
        <Hero reveal={reveal} quality={quality} onSceneReady={handleSceneReady} hasWebGL={hasWebGL} reducedMotion={reducedMotion} exit={exit} active={heroActive} heroRef={heroRef} />
        <ClientLogos clients={clients} />
        <Statement />
        <SelectedWork />
        <Services />
        <Process />
        <About />
        <FAQ />
        <WorkSample />
        <Closing />
      </main>
      <MobileDock />
    </div>
  );
}
