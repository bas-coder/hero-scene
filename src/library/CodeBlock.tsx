import { readFile } from "node:fs/promises";
import path from "node:path";
import { codeToHtml, createCssVariablesTheme } from "shiki";
import { CopyButton } from "./CopyButton";

// Token colours are CSS variables, mapped to the design system's --code-* roles in library.css.
const theme = createCssVariablesTheme({ name: "design-tokens", variablePrefix: "--shiki-", variableDefaults: {}, fontStyle: true });

const languages: Record<string, string> = { ".tsx": "tsx", ".ts": "ts", ".css": "css", ".mjs": "js", ".js": "js" };

/** Reads the real file at build time, so the published code can never drift from what runs on the site. */
export async function CodeBlock({ file }: { file: string }) {
  const code = (await readFile(path.join(/* turbopackIgnore: true */ process.cwd(), file), "utf8")).trimEnd();
  const html = await codeToHtml(code, { lang: languages[path.extname(file)] ?? "text", theme });
  return (
    <figure className="code-block">
      <figcaption>
        <span>{path.basename(file)}</span>
        <CopyButton text={code} />
      </figcaption>
      <div className="code-block__body" dangerouslySetInnerHTML={{ __html: html }} />
    </figure>
  );
}
