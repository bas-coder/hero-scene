/**
 * YouTube tutorials teased in the Library hero. Newest first.
 * Thumbnails are self-hosted in public/tutorials/<id>.jpg so nothing loads from YouTube until a visitor presses play.
 */
export interface Tutorial {
  id: string;
  youtubeId: string;
  title: string;
  summary: string;
  published: string;
  /** Library slugs this video builds or explains. */
  relatedSlugs: string[];
}

export const tutorials: Tutorial[] = [];

/** Full channel URL, or null until the channel is live. */
export const youtubeChannel: string | null = null;

export function tutorialFor(slug: string) {
  return tutorials.find((tutorial) => tutorial.relatedSlugs.includes(slug));
}

export function getTutorial(id: string) {
  return tutorials.find((tutorial) => tutorial.id === id);
}
