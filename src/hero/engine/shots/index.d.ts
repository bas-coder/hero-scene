/** Types for the shot registry (plain data, no three.js: safe to import on the page itself). */
export interface Shot {
  id: string;
  /** Seconds: the page's intro reveal clock runs over it. */
  introDuration: number;
  loopDuration: number;
  stillTime: number;
  caseKey: { href: string; label: string } | null;
}
export function getShot(id: string): Shot;
