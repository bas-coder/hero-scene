import { bookHref } from "../lib/contact";
import type { ProjectMedia } from "../types";
import { ResponsiveImage } from "./ResponsiveImage";
import { ScrollFillText } from "./ScrollFillText";
import { WordmarkReveal } from "./WordmarkReveal";

// Under the client grid: avecanni.studio's about layout (statement top left, portrait block bottom right),
// at cr8ivelarry.live's statement size with his letter-by-letter scroll fill, and a hidden wordmark bottom left.
// The words are Abbas's own principle: complex products made simple, carried through to what ships.
const statement = {
  headline:
    "Most complex products don’t need more screens. They need fewer, clearer ones. I’m Abbas, and since 2021 I’ve helped AI and SaaS teams find them, and ship products people understand on first use.",
  note: "I start from the problem, not the screen list, design the fewest steps that solve it, and stay through the build so nothing gets lost. If your product feels harder than it should, ",
  invite: "let’s talk",
  signature: ["Led by", "Abbas"],
  wordmark: "action studios",
};

const portraitMedia: ProjectMedia = {
  name: "Abbas Alabura",
  avif: "/media/profile-1440.avif",
  webp: "/media/profile-1440.webp",
  width: 1440,
  height: 1800,
  alt: "Abbas Alabura",
};

export function Statement() {
  return (
    <section className="statement" id="statement" aria-labelledby="statement-title">
      <ScrollFillText id="statement-title" className="statement__headline" text={statement.headline} />
      <div className="statement__wordmark">
        <WordmarkReveal text={statement.wordmark} />
      </div>
      <div className="statement__aside" data-reveal>
        <div className="statement__lead">
          {/* 80 px wide here, 144 on phones: the 720 file is at least 3x either way, so it stays sharp on retina. */}
          <ResponsiveImage
            media={portraitMedia}
            className="statement__portrait"
            sizes={`(max-width: ${process.env.DESIGN_BREAKPOINT_MOBILE}) 144px, 80px`}
          />
          <p className="statement__signature">
            {statement.signature[0]}
            <br />
            {statement.signature[1]}
          </p>
        </div>
        <p className="statement__note">
          {statement.note}
          <a href={bookHref}>{statement.invite}</a>.
        </p>
      </div>
    </section>
  );
}
