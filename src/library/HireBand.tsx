import { KeycapButton } from "../components/KeycapButton";
import { bookHref } from "../lib/contact";

/** Ends every Library page: the quiet route from a free asset back to hiring. */
export function HireBand() {
  return (
    <section className="hire-band" aria-labelledby="hire-band-title">
      <div>
        <p className="section-kicker">Made by Abbas Alabura</p>
        <h2 id="hire-band-title" data-text-reveal="lines">Want this level of care<br />in your product?</h2>
      </div>
      <div className="hire-band__actions">
        <a className="text-link" href="/#work">See the work</a>
        <KeycapButton href={bookHref}>Start a project</KeycapButton>
      </div>
    </section>
  );
}
