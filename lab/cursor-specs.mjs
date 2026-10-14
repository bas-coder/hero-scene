// The cursor set, shared by the lab (lab/cursors.html) and the bake (scripts/bake-cursors.mjs).
// Coordinates are in the source SVGs' 64-unit grid, y down.
//   file     source SVG in lab/cursors/source/
//   hotspot  "centre" (the face's bounding-box centre) or [x, y], snapped to the nearest body-outline vertex
//   rim      how far the black body grows past the white face: the SVGs' 3-unit outline (outline-free icons get the same)
//   join     "miter" keeps sharp tips sharp (the SVG strokes are mitred); "round" suits outline-free icons
//   depth    body thickness relative to the arrow's; thin-stroked icons stay shallow so 1x strokes don't double
//   shadow   shadow strength relative to the arrow's; a full shadow under a 1.6px stem greys it out at 1x
//   hint     1x only: grow the face by this many units so thin strokes keep a white core of at least 2px

export const densities = [1, 2, 3];

/** Largest cursor image, in CSS px. Chromium and Firefox drop bigger cursors near the viewport edge. */
export const maxCursorSize = 32;

export const cursors = [
  { name: "default", file: "pointer 1.svg", token: "--cursor-default", keyword: "default", hotspot: [3, 4.2], rim: 3, join: "miter" },
  { name: "pointer", file: "hover 1.svg", token: "--cursor-pointer", keyword: "pointer", hotspot: [28.36, 1.4], rim: 3, join: "miter" },
  { name: "text", file: "Text highlight Dark 1.svg", token: "--cursor-text", keyword: "text", hotspot: "centre", rim: 3, join: "round", depth: 0.5, shadow: 0.6, hint: 1.2 },
  { name: "grab", file: "Hand 1.svg", token: "--cursor-grab", keyword: "grab", hotspot: "centre", rim: 3, join: "miter" },
  { name: "grabbing", file: "HandGrabbing 1.svg", token: "--cursor-grabbing", keyword: "grabbing", hotspot: "centre", rim: 3, join: "miter" },
  { name: "ew-resize", file: "Arrows expand Horizontal 1.svg", token: "--cursor-ew-resize", keyword: "ew-resize", hotspot: "centre", rim: 3, join: "round", depth: 0.5, shadow: 0.6, hint: 1.2 },
  { name: "ns-resize", file: "Arrows expandVertical 1.svg", token: "--cursor-ns-resize", keyword: "ns-resize", hotspot: "centre", rim: 3, join: "round", depth: 0.5, shadow: 0.6, hint: 1.2 },
];

export const fileName = (name, density) => (density === 1 ? `${name}.png` : `${name}@${density}x.png`);
