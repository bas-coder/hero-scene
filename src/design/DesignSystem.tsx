"use client";
import { ArrowLeft } from "@phosphor-icons/react";
import { useTheme } from "./useTheme";
import { KeycapButton } from "../components/KeycapButton";
import { ThemeToggle } from "../components/ThemeToggle";
const ramps = ["stone", "green", "cobalt", "amber", "coral", "red", "plaster", "wood", "metal", "blossom", "lilac", "plum", "rose", "sun"];
const steps = [50,100,200,300,400,500,600,700,800,900];
const sizes = ["xxs","xs","sm","base","md","lg","xl","2xl","3xl","4xl","5xl","6xl","7xl","8xl","9xl"];
const semantics = ["surface-canvas","surface-bright","surface-raised","surface-sunken","surface-inverse","line-default","line-strong","line-focus","action-primary","action-primary-hover","action-primary-press","action-disabled","state-success","state-warning","state-error","state-info","text-heading","text-body","text-muted","icon-heading","icon-muted","icon-accent"];
export function DesignSystem() {
 const {theme, toggleTheme} = useTheme();
 return <main className="ds-page">
  <header className="ds-header"><a href="/"><ArrowLeft weight="bold" /> Portfolio</a><ThemeToggle theme={theme} onToggle={toggleTheme}/></header>
  <p className="text-xs">ABBAS ALABURA / DESIGN SYSTEM</p>
  <h1 className="text-5xl">One system. Every detail.</h1>
  <p className="text-lg">Primitives → Responsive & Theme → Styles → Components</p>
  <p className="ds-mode text-sm">Current responsive mode: </p>
  <section id="primary-buttons"><h2 className="text-3xl">Primary button / Design Minis keycap</h2><p className="text-base">Shared geometry and bevels across both palettes. Geist font download is pending; these examples currently use the bundled body-font fallback.</p><div className="ds-keycap-themes">{(["light", "dark"] as const).map(mode => <div key={mode} className="ds-keycap-theme" data-theme={mode}><h3 className="text-lg">{mode}</h3><div className="ds-keycap-samples">{[{label:"Rest",className:""},{label:"Hover",className:"ds-keycap-hover"},{label:"Pressed",className:"ds-keycap-press"}].map(state => <div key={state.label} className={state.className}><code>{state.label}</code><KeycapButton href="#primary-buttons">Submit a tool</KeycapButton></div>)}</div></div>)}</div></section>
  <section><h2 className="text-3xl">Primitives / Color</h2><p className="text-base">Current working palette. Colors remain editable; the collection structure stays consistent.</p>
   {ramps.map(ramp=><div key={ramp}><h3 className="text-lg">{ramp}</h3><div className="ds-ramp">{steps.map(step=><div key={step}><div className="ds-swatch" style={{background: `var(--color-${ramp}-${step})`}}/><code>{step}</code></div>)}</div></div>)}
  </section>
  <section><h2 className="text-3xl">Theme / {theme}</h2><div className="ds-semantic-grid">{semantics.map(token=><div key={token} className="ds-semantic"><span className="ds-swatch" style={{background:`var(--${token})`}}/><code>{token}</code></div>)}</div></section>
  <section><h2 className="text-3xl">Responsive / Layout & Spacing</h2><div className="layout-grid ds-grid">{Array.from({length:12},(_,i)=><span key={i}/>)}</div><p className="text-base">Resize the window to inspect the shared margin, column count, gutter and text sizes.</p><div className="ds-spacing">{["3xs","2xs","xs","sm","md","lg","xl","2xl","3xl"].map(size=><div key={size}><span style={{width:`var(--space-${size})`}}/><code>space-{size}</code></div>)}</div></section>
  <section><h2 className="text-3xl">Text styles / xxs–9xl</h2><div className="ds-type-list">{sizes.map(size=><div key={size}><code>text-{size}</code><p className={`text-${size}`}>Clear by design.</p></div>)}</div></section>
  <section><h2 className="text-3xl">Effects / Liquid glass</h2><p className="text-base">Browser approximations using tokenized fill, highlight, blur and shadow. Figma optical settings are retained in the recipes.</p><div className="ds-glass-stage">{["card","elevated","icon"].map(kind=><article key={kind} className={`glass-${kind}`}><h3 className="text-xl">{kind}</h3><p className="text-base">A shared, reusable effect.</p></article>)}</div></section>
 </main>;
}
