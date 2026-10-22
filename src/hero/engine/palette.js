/**
 * The hero's palette: the default world (black), each shot's dressing (its reference's materials) and mood (its
 * lights and grade). Colours are never written here: each is a --scene-hero-* token (theme.css → primitives.css),
 * resolved at run time against the page's CSS, so the site and the lab share one source. Numbers (intensities,
 * grade values, roughness) are the engine's own settings and live here.
 */
export const heroPalette = {
  world: {
    void: "--scene-hero-world-void",
    desk: "--scene-hero-world-desk",
    deskRoughness: 0.6,
    deskScreenSpill: 0.3,
    frame: "--scene-hero-world-frame",
    prop: "--scene-hero-world-prop",
    cup: "--scene-hero-world-cup",
    speckle: "--scene-hero-world-speckle",
    pencils: [
      "--scene-hero-world-pencils-1",
      "--scene-hero-world-pencils-2"
    ],
    pencilWood: "--scene-hero-world-pencil-wood",
    lampBody: "--scene-hero-world-lamp-body",
    notebook: "--scene-hero-world-notebook",
    pages: "--scene-hero-world-pages",
    phone: "--scene-hero-world-phone",
    phoneGlass: "--scene-hero-world-phone-glass",
    coaster: "--scene-hero-world-coaster",
    wall: "--scene-hero-world-wall",
    floor: "--scene-hero-world-floor",
    plateTint: "--scene-hero-world-plate-tint",
    laptopShell: 0.12,
    graphite: "--scene-hero-world-graphite",
    chair: "--scene-hero-world-chair",
    tile: "--scene-hero-world-tile",
    tileShadow: "--scene-hero-world-tile-shadow",
    key: "--scene-hero-world-key",
    keyGlow: "--scene-hero-world-key-glow",
    tileLight: "--scene-hero-world-tile-light"
  },
  dressings: {
    flable: {
      desk: "--scene-hero-flable-desk",
      deskRoughness: 0.52,
      frame: "--scene-hero-flable-frame",
      prop: "--scene-hero-flable-prop",
      cup: "--scene-hero-flable-cup",
      speckle: "--scene-hero-flable-speckle",
      pencils: [
        "--scene-hero-flable-pencils-1",
        "--scene-hero-flable-pencils-2",
        "--scene-hero-flable-pencils-3",
        "--scene-hero-flable-pencils-4",
        "--scene-hero-flable-pencils-5",
        "--scene-hero-flable-pencils-6"
      ],
      pencilWood: "--scene-hero-flable-pencil-wood",
      lampBody: "--scene-hero-flable-lamp-body",
      notebook: "--scene-hero-flable-notebook",
      pages: "--scene-hero-flable-pages",
      phone: "--scene-hero-flable-phone",
      phoneGlass: "--scene-hero-flable-phone-glass",
      coaster: "--scene-hero-flable-coaster",
      wall: "--scene-hero-flable-wall",
      floor: "--scene-hero-flable-floor",
      plateTint: "--scene-hero-flable-plate-tint",
      laptopShell: 0.62,
      graphite: "--scene-hero-flable-graphite",
      roomPlate: "media/hero/flable/room",
      chair: "--scene-hero-flable-chair",
      tile: "--scene-hero-flable-tile",
      tileShadow: "--scene-hero-flable-tile-shadow",
      key: "--scene-hero-flable-key",
      keyGlow: "--scene-hero-flable-key-glow",
      tileLight: "--scene-hero-flable-tile-light"
    }
  },
  laptop: {
    shell: 0.62,
    metalness: 1,
    roughness: 0.36,
    envIntensity: 1,
    screenSheen: 0.3
  },
  screen: {
    // Just under full: a night scene's lit panel, not a clipped white card competing with the headline.
    brightness: 0.92,
    off: "--scene-hero-screen-off",
    dim: "--scene-hero-screen-dim",
    glass: "--scene-hero-screen-glass"
  },
  moods: {
    base: {
      lamp: {
        color: "--scene-hero-base-lamp",
        intensity: 95,
        bulb: 30
      },
      window: {
        color: "--scene-hero-base-window",
        intensity: 0.35
      },
      ambient: {
        sky: "--scene-hero-base-ambient-sky",
        ground: "--scene-hero-base-ambient-ground",
        intensity: 0.015
      },
      screen: {
        color: "--scene-hero-base-screen",
        intensity: 3.2
      },
      practicals: {
        color: "--scene-hero-base-practicals",
        intensity: 0.2
      },
      env: {
        intensity: 0.3,
        lamp: 3,
        window: 1.2,
        practicals: 1.5,
        screen: 2,
        room: 0.75,
        roomColor: "--scene-hero-base-env-room",
        desk: 0.6,
        deskColor: "--scene-hero-base-env-desk"
      },
      grade: {
        exposure: 1,
        lift: [
          0,
          0,
          0
        ],
        gamma: [
          1,
          1,
          1
        ],
        gain: [
          1,
          1,
          1
        ],
        saturation: 1,
        vignette: 0.7,
        grain: 0.012,
        bloom: {
          threshold: 7,
          knee: 2,
          strength: 0.18
        }
      },
      sketch: {
        paper: "--scene-hero-base-sketch-paper",
        ink: "--scene-hero-base-sketch-ink",
        shade: "--scene-hero-base-sketch-shade"
      }
    },
    flable: {
      lamp: {
        color: "--scene-hero-flable-lamp",
        intensity: 95,
        bulb: 30
      },
      window: {
        color: "--scene-hero-flable-window",
        intensity: 1.2
      },
      ambient: {
        sky: "--scene-hero-flable-ambient-sky",
        ground: "--scene-hero-flable-ambient-ground",
        intensity: 0.015
      },
      screen: {
        color: "--scene-hero-flable-screen",
        intensity: 0.7
      },
      practicals: {
        color: "--scene-hero-flable-practicals",
        intensity: 0.3
      },
      env: {
        intensity: 0.32,
        lamp: 3,
        window: 1.8,
        practicals: 1.8,
        screen: 1,
        room: 0.9,
        roomColor: "--scene-hero-flable-env-room",
        desk: 0.9,
        deskColor: "--scene-hero-flable-env-desk"
      },
      grade: {
        exposure: 1.5,
        lift: [
          0.0006,
          0,
          0.0016
        ],
        gamma: [
          1,
          0.97,
          1.04
        ],
        gain: [
          1,
          0.86,
          1.06
        ],
        saturation: 1.35,
        vignette: 0.75,
        grain: 0.012,
        bloom: {
          threshold: 7,
          knee: 2,
          strength: 0.2
        }
      },
      sketch: {
        paper: "--scene-hero-flable-sketch-paper",
        ink: "--scene-hero-flable-sketch-ink",
        shade: "--scene-hero-flable-sketch-shade"
      }
    }
  }
};

/** Resolves every token name in a palette definition with `read(token)` (the computed CSS value). */
export function resolvePalette(definition, read) {
  if (Array.isArray(definition)) return definition.map((item) => resolvePalette(item, read));
  if (definition && typeof definition === "object") {
    return Object.fromEntries(Object.entries(definition).map(([key, value]) => [key, resolvePalette(value, read)]));
  }
  if (typeof definition === "string" && definition.startsWith("--")) return read(definition).trim();
  return definition;
}

/** Reads tokens from the document (site and lab both load the design collections). */
export function readCssToken(token) {
  return getComputedStyle(document.documentElement).getPropertyValue(token);
}
