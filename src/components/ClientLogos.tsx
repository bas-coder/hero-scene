"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { clientsLabel, type ClientWithLogo } from "../content/clients";
import { readToken } from "../design/readToken";

// Hover or keyboard focus opens a tile's tooltip; on touch a tap toggles it. Escape or a tap elsewhere closes it.
export function ClientLogos({ clients }: { clients: ClientWithLogo[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const grid = useRef<HTMLDivElement>(null);
  const pointerType = useRef("mouse");
  const baseId = useId();

  useEffect(() => {
    if (open === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(null);
    };
    const onPointer = (event: PointerEvent) => {
      if (!grid.current?.contains(event.target as Node)) setOpen(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  // Shift the open tooltip sideways so it stays inside the viewport; the arrow keeps pointing at the tile.
  useLayoutEffect(() => {
    if (open === null) return;
    const tile = grid.current?.querySelector<HTMLElement>(`[data-index="${open}"]`);
    const tooltip = tile?.querySelector<HTMLElement>(".client-tooltip");
    if (!tile || !tooltip) return;
    const edge = parseFloat(readToken("--tooltip-edge"));
    const tileBox = tile.getBoundingClientRect();
    const centre = tileBox.left + tileBox.width / 2;
    const half = tooltip.offsetWidth / 2;
    const viewport = document.documentElement.clientWidth;
    const shift = Math.max(edge - (centre - half), 0) - Math.max(centre + half - (viewport - edge), 0);
    tooltip.style.setProperty("--tooltip-shift", `${shift}px`);
  }, [open]);

  const close = (index: number) => setOpen((current) => (current === index ? null : current));

  return (
    <section className="client-logos" aria-labelledby={`${baseId}-label`} data-reveal>
      <div className="client-logos__grid" ref={grid}>
        <p className="client-logos__label" id={`${baseId}-label`}>{clientsLabel}</p>
        {clients.map((client, index) => {
          const tooltipId = `${baseId}-${client.slug}`;
          return (
            <button
              key={client.slug}
              type="button"
              className={`client-logo${client.onDark ? " client-logo--on-dark" : ""}`}
              aria-label={client.name}
              aria-describedby={tooltipId}
              data-index={index}
              data-open={open === index ? "" : undefined}
              style={client.scale ? ({ "--logo-scale": client.scale } as CSSProperties) : undefined}
              onPointerDown={(event) => { pointerType.current = event.pointerType; }}
              onPointerEnter={(event) => { if (event.pointerType === "mouse") setOpen(index); }}
              onPointerLeave={(event) => { if (event.pointerType === "mouse") close(index); }}
              onFocus={(event) => { if (event.currentTarget.matches(":focus-visible")) setOpen(index); }}
              onBlur={() => close(index)}
              onClick={(event) => {
                // Mouse users already have hover; keyboard clicks (detail 0) and taps toggle.
                if (pointerType.current === "mouse" && event.detail > 0) return;
                setOpen((current) => (current === index ? null : index));
              }}
            >
              {client.logo && <img src={client.logo} alt="" loading="lazy" decoding="async" />}
              <span className="client-logo__hint" aria-hidden="true" />
              <span className={`client-tooltip${client.funding ? " client-tooltip--rich" : ""}`} role="tooltip" id={tooltipId}>
                {client.funding ? (
                  <>
                    <span>{client.note}</span>
                    <span className="client-tooltip__funding">
                      <span className="client-tooltip__raised">
                        {client.funding.kind === "raised" ? <>Raised <strong>{client.funding.amount}</strong> from</> : "Backed by"}
                      </span>
                      <span className="client-tooltip__investors">
                        {client.funding.investors.map((investor) => (
                          <span className="investor-chip" key={investor.slug}>
                            <span className={`investor-chip__icon${investor.padded ? " investor-chip__icon--padded" : ""}`} aria-hidden="true">
                              {investor.icon ? <img src={investor.icon} alt="" decoding="async" /> : investor.name.charAt(0)}
                            </span>
                            <span className="investor-chip__name">{investor.name}</span>
                          </span>
                        ))}
                      </span>
                    </span>
                  </>
                ) : client.note}
              </span>
            </button>
          );
        })}
        <p className="client-logos__more">And many more</p>
      </div>
    </section>
  );
}
