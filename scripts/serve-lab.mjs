// Static server for the hero lab: serves the prototype-v2 root so the lab can import the real engine
// (src/hero/engine), three.js from node_modules, and the GLB, Draco decoder and screens from public/.
//   node scripts/serve-lab.mjs [port]      → http://localhost:4192/lab/hero/index.html
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.argv[2] ?? process.env.PORT ?? 4192);
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".glb": "model/gltf-binary",
  ".wasm": "application/wasm",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".hdr": "application/octet-stream",
  ".woff2": "font/woff2",
};

createServer(async (request, response) => {
  try {
    const path = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    let file = normalize(join(root, path));
    if (!file.startsWith(root)) throw Object.assign(new Error("outside root"), { code: 403 });
    if ((await stat(file)).isDirectory()) file = join(file, "index.html");
    const body = await readFile(file);
    response.writeHead(200, { "Content-Type": types[extname(file).toLowerCase()] ?? "application/octet-stream", "Cache-Control": "no-store" });
    response.end(body);
  } catch (error) {
    response.writeHead(error.code === 403 ? 403 : 404, { "Content-Type": "text/plain" });
    response.end(error.code === 403 ? "Forbidden" : "Not found");
  }
}).listen(port, () => console.log(`Hero lab on http://localhost:${port}/lab/hero/index.html`));
