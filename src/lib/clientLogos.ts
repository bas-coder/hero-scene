import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { clients, type ClientWithLogo } from "../content/clients";

const logoExtensions = ["svg", "png", "webp", "ico"];

// "Marven Grey.svg", "marven-grey.svg" and "MARVEN_GREY.svg" all name the same company.
const normalise = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Public URL of the logo file dropped into public/logos/<folder>/, matched by slug or by name in any case or
 * spacing, else null. The URL keeps the file's real spelling so it also resolves on case-sensitive hosts.
 */
function findLogo(folder: string, ...names: string[]): string | null {
  const directory = join(process.cwd(), "public", "logos", folder);
  if (!existsSync(directory)) return null;
  const wanted = names.map(normalise);
  const file = readdirSync(directory).find((entry) => {
    const dot = entry.lastIndexOf(".");
    return dot > 0 && logoExtensions.includes(entry.slice(dot + 1).toLowerCase()) && wanted.includes(normalise(entry.slice(0, dot)));
  });
  return file ? `/logos/${folder}/${encodeURIComponent(file)}` : null;
}

/** Server-only: pairs each client and investor with the logo file dropped into public/logos, if there is one yet. */
export function clientsWithLogos(): ClientWithLogo[] {
  return clients.map(({ funding, ...client }) => ({
    ...client,
    logo: findLogo("clients", client.slug, client.name),
    funding: funding && { ...funding, investors: funding.investors.map((investor) => ({ ...investor, icon: findLogo("investors", investor.slug, investor.name) })) },
  }));
}
