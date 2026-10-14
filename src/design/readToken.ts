/** Bridge for canvas/WebGL consumers; keep the CSS collections authoritative. */
export function readToken(name: string): string {
 const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
 if (!value) throw new Error("Missing design token " + name);
 return value;
}
