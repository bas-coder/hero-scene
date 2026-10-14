"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import logomark from "../../assets/logomark.svg";
import { bookHref, whatsappHref } from "../lib/contact";
import { KeycapButton } from "./KeycapButton";

type View = "work" | "index" | "yard" | "library";

// Views of Abbas, followed by the Library pill.
const viewLinks: { label: string; href: string; view: View }[] = [
  { label: "Work", href: "/#work", view: "work" },
  { label: "Index", href: "/#index", view: "index" },
  { label: "Yard", href: "/#yard", view: "yard" },
];

// The view you're on, from the URL. Index and Yard still scroll within the home page, so they join once they
// become views of their own; until then the home page and its case studies are Work.
function currentView(pathname: string): View | null {
  if (pathname === "/" || pathname.startsWith("/work")) return "work";
  if (pathname.startsWith("/library")) return "library";
  return null;
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12.04 2C6.58 2 2.15 6.4 2.15 11.83c0 1.74.46 3.44 1.32 4.94L2 22l5.39-1.41a10.1 10.1 0 0 0 4.65 1.12h.01c5.46 0 9.89-4.4 9.89-9.83C21.94 6.4 17.5 2 12.04 2Zm5.76 14.02c-.24.68-1.4 1.3-1.94 1.38-.49.07-1.12.1-1.81-.11-.41-.13-.95-.31-1.64-.61-2.88-1.25-4.76-4.15-4.9-4.34-.14-.19-1.16-1.54-1.16-2.94s.73-2.08 1-2.37c.24-.27.64-.39.85-.39h.61c.2 0 .46-.07.72.55.27.64.91 2.22.99 2.38.08.16.13.35.03.56-.1.21-.15.34-.3.52-.15.18-.31.4-.44.54-.15.15-.3.31-.13.61.17.3.76 1.25 1.63 2.03 1.12 1 2.06 1.31 2.36 1.46.3.15.47.13.65-.08.18-.2.75-.87.95-1.17.2-.3.4-.24.67-.14.27.1 1.73.82 2.03.97.3.15.5.22.57.34.08.13.08.74-.16 1.42Z"
      />
    </svg>
  );
}

function useAutoHide(menuOpen: boolean) {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    let lastY = window.scrollY;
    let directionTravel = 0;
    const onScroll = () => {
      const nextY = window.scrollY;
      const delta = nextY - lastY;
      if (Math.sign(delta) !== Math.sign(directionTravel)) directionTravel = 0;
      directionTravel += delta;
      if (nextY < 24 || menuOpen) {
        setHidden(false);
      } else if (directionTravel > 96) {
        setHidden(true);
        directionTravel = 0;
      } else if (directionTravel < -24) {
        setHidden(false);
        directionTravel = 0;
      }
      lastY = nextY;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [menuOpen]);
  return hidden;
}

type HeaderTone = "dark" | "light";

// Relative luminance on sRGB channels (0-1); above half reads as light, as before.
const toneOf = (red: number, green: number, blue: number): HeaderTone => (0.2126 * red + 0.7152 * green + 0.0722 * blue > 0.5 ? "light" : "dark");

function backgroundTone(element: Element): HeaderTone | null {
  const color = getComputedStyle(element).backgroundColor;
  const channels = color.match(/[\d.]+/g)?.map(Number);
  if (!channels || channels.length < 3 || (channels[3] ?? 1) < 0.5) return null;
  // Computed colours report 0–255 channels, except the color() form (from color-mix), which reports 0–1.
  const scale = color.startsWith("color(") ? 1 : 255;
  const [red, green, blue] = channels.map((value) => value / scale);
  return toneOf(red, green, blue);
}

// An image's own brightness, averaged once over a 24 px thumbnail and cached per file. Transparent images (logos)
// and images the page may not read (other origins) give no answer, so whatever is under them decides.
const imageTones = new Map<string, HeaderTone | null>();
function imageTone(image: HTMLImageElement): HeaderTone | null {
  const source = image.currentSrc || image.src;
  if (!source || !image.complete || !image.naturalWidth) return null;
  const cached = imageTones.get(source);
  if (cached !== undefined) return cached;
  let tone: HeaderTone | null = null;
  try {
    const size = 24;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (context) {
      context.drawImage(image, 0, 0, size, size);
      const { data } = context.getImageData(0, 0, size, size);
      let light = 0;
      let cover = 0;
      for (let index = 0; index < data.length; index += 4) {
        const alpha = data[index + 3] / 255;
        light += alpha * (0.2126 * data[index] + 0.7152 * data[index + 1] + 0.0722 * data[index + 2]) / 255;
        cover += alpha;
      }
      if (cover > (size * size) / 2) tone = light / cover > 0.5 ? "light" : "dark";
    }
  } catch {
    tone = null;
  }
  imageTones.set(source, tone);
  return tone;
}

interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/**
 * What sits behind one header cluster (the pills, the logo, the tools), topmost first. A declared data-header-tone
 * decides (the hero's artwork); otherwise the first image or solid background that fills the cluster's whole box,
 * so a dark card or photo behind the pills turns them dark, but a small dark chip or a line of text never flickers
 * them. Nothing found reads as dark, as the artwork does.
 */
function toneBehind(cluster: HTMLElement, header: HTMLElement): HeaderTone {
  // The visible controls, not the grid cell they sit in (the pills' nav spans a third of the header).
  const parts = Array.from(cluster.children).map((child) => child.getBoundingClientRect());
  const left = Math.min(...parts.map((part) => part.left));
  const right = Math.max(...parts.map((part) => part.right));
  // offsetTop ignores the hide transform, so a tucked-away header keeps sampling its own line.
  const box: Box = { left, right, top: cluster.offsetTop, bottom: cluster.offsetTop + cluster.offsetHeight };
  const stack = document.elementsFromPoint((box.left + box.right) / 2, (box.top + box.bottom) / 2);
  for (const node of stack) {
    if (header.contains(node)) continue;
    const declared = node.getAttribute("data-header-tone");
    if (declared === "dark" || declared === "light") return declared;
    const rect = node.getBoundingClientRect();
    if (rect.left > box.left || rect.right < box.right || rect.top > box.top || rect.bottom < box.bottom) continue;
    const tone = node instanceof HTMLImageElement ? imageTone(node) : backgroundTone(node);
    if (tone) return tone;
  }
  return "dark";
}

// Each cluster carries its own data-tone, written straight to the DOM so scrolling never re-renders the header.
function useHeaderTone(header: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const element = header.current;
    if (!element) return;
    const clusters = Array.from(element.querySelectorAll<HTMLElement>("[data-tone-probe]"));
    let frame = 0;
    const sample = () => {
      frame = 0;
      clusters.forEach((cluster) => {
        const tone = toneBehind(cluster, element);
        if (cluster.dataset.tone !== tone) cluster.dataset.tone = tone;
      });
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(sample);
    };
    sample();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    // Images decode after the first sample; look again once each one lands.
    window.addEventListener("load", schedule, true);
    const themeObserver = new MutationObserver(schedule);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("load", schedule, true);
      themeObserver.disconnect();
    };
  }, [header]);
}

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const hidden = useAutoHide(menuOpen);
  const headerRef = useRef<HTMLElement>(null);
  useHeaderTone(headerRef);
  const current = currentView(usePathname());
  const at = (view: View) => (current === view ? "page" : undefined);
  const close = () => setMenuOpen(false);

  return (
    <>
      <header ref={headerRef} className={`site-header${hidden ? " is-hidden" : ""}`} data-header>
        <nav className="header-pills" aria-label="Portfolio view" data-tone-probe>
          {viewLinks.map((link) => (
            <a className="lift-pill" key={link.href} href={link.href} aria-current={at(link.view)}>{link.label}</a>
          ))}
          <Link className="lift-pill" href="/library" aria-current={at("library")}>Library</Link>
        </nav>
        <a className="header-logo" href="/#top" aria-label="Abbas Alabura home" data-tone-probe>
          <img src={logomark.src} alt="" />
        </a>
        <div className="header-tools" data-tone-probe>
          <a className="header-whatsapp lift-pill" href={whatsappHref} aria-label="Talk on WhatsApp">
            <WhatsAppIcon />
          </a>
          <KeycapButton href={bookHref}>Book a call</KeycapButton>
        </div>
      </header>

      <header className="mobile-header" aria-label="Mobile header">
        <a className="mobile-logo" href="/#top" aria-label="Abbas Alabura home">AA</a>
        <div className="mobile-actions">
          <a className="mobile-icon" href={whatsappHref} aria-label="Talk on WhatsApp">W</a>
          <KeycapButton href={bookHref}>Let’s talk</KeycapButton>
          <button className="mobile-menu-button" type="button" aria-label="Open menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>
            <span /><span /><span />
          </button>
        </div>
      </header>

      <div className={`mobile-menu${menuOpen ? " is-open" : ""}`} aria-hidden={!menuOpen}>
        <button type="button" onClick={close} aria-label="Close menu">Close</button>
        <a href="/#work" onClick={close} aria-current={at("work")}>Work</a>
        <a href="/#index" onClick={close}>Index</a>
        <a href="/#yard" onClick={close}>Yard</a>
        <Link href="/library" onClick={close} aria-current={at("library")}>Library</Link>
        <a href="/#contact" onClick={close}>Contact</a>
      </div>
    </>
  );
}
