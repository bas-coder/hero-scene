"use client";

import { useEffect, useState } from "react";
import type { LibraryItem, LibraryType } from "../content/library";
import { libraryTypes } from "../content/library";
import { LibraryCard } from "./LibraryCard";

type Filter = LibraryType | "all";

/** Type filter synced to ?type= so a filtered view can be shared. Only types with items get a button. */
export function LibraryBrowser({ items }: { items: LibraryItem[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const available = libraryTypes.filter(({ type }) => items.some((item) => item.type === type));

  useEffect(() => {
    const requested = new URLSearchParams(location.search).get("type");
    if (items.some((item) => item.type === requested)) setFilter(requested as LibraryType);
  }, [items]);

  const choose = (next: Filter) => {
    setFilter(next);
    const url = new URL(location.href);
    if (next === "all") url.searchParams.delete("type");
    else url.searchParams.set("type", next);
    history.replaceState(null, "", url);
  };

  const visible = filter === "all" ? items : items.filter((item) => item.type === filter);
  const options: { value: Filter; label: string; count: number }[] = [
    { value: "all", label: "All", count: items.length },
    ...available.map(({ type, plural }) => ({ value: type, label: plural, count: items.filter((item) => item.type === type).length })),
  ];

  return (
    <section className="library-browser" aria-labelledby="library-shelf-title">
      <div className="library-browser__bar">
        <h2 id="library-shelf-title" className="section-kicker">The shelf</h2>
        <div className="library-filter" role="group" aria-label="Filter by type">
          {options.map((option) => (
            <button key={option.value} type="button" aria-pressed={filter === option.value} onClick={() => choose(option.value)}>
              {option.label} <span>{option.count}</span>
            </button>
          ))}
        </div>
      </div>
      <ul className="library-grid">
        {visible.map((item) => (
          <li key={item.slug}><LibraryCard item={item} /></li>
        ))}
      </ul>
    </section>
  );
}
