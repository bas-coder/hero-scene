// Headless Chrome (or Edge) over the DevTools protocol, shared by the capture and bake scripts.
// BROWSER_PATH points at Chrome or Edge if neither default path exists.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const wait = (ms) => new Promise((done) => setTimeout(done, ms));

const browserPath = [
  process.env.BROWSER_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].find((path) => path && existsSync(path));

async function connect(port) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      return (await response.json()).webSocketDebuggerUrl;
    } catch {
      await wait(200);
    }
  }
  throw new Error("Browser did not open its debugging port.");
}

/** Minimal DevTools-protocol client over the browser websocket. */
function protocol(socket) {
  let id = 0;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    if (message.error) request.reject(new Error(message.error.message));
    else request.resolve(message.result);
  });
  return (method, params = {}, sessionId) =>
    new Promise((resolveRequest, reject) => {
      id += 1;
      pending.set(id, { resolve: resolveRequest, reject });
      socket.send(JSON.stringify({ id, method, params, sessionId }));
    });
}

/**
 * Opens one headless tab. `page(method, params)` sends a protocol command to it; `close()` shuts the browser
 * and deletes its temporary profile. `gpu: true` uses the real GPU; the default is SwiftShader.
 */
export async function launchBrowser({ name = "headless", gpu = false } = {}) {
  if (!browserPath) throw new Error("No Chrome or Edge found. Set BROWSER_PATH.");
  const port = 9300 + Math.floor(Math.random() * 500);
  const profile = await mkdtemp(join(tmpdir(), `${name}-`));
  const browser = spawn(browserPath, [
    "--headless=new",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    ...(gpu ? ["--use-angle=default", "--ignore-gpu-blocklist", "--enable-gpu-rasterization"] : ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"]),
    "--hide-scrollbars",
    "about:blank",
  ], { stdio: "ignore" });
  let socket;
  const close = async () => {
    socket?.close();
    browser.kill();
    await wait(500);
    await rm(profile, { recursive: true, force: true }).catch(() => {});
  };
  try {
    socket = new WebSocket(await connect(port));
    await new Promise((opened) => socket.addEventListener("open", opened, { once: true }));
    const send = protocol(socket);
    const { targetId } = await send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
    return { page: (method, params) => send(method, params, sessionId), close };
  } catch (error) {
    await close();
    throw error;
  }
}

/** Evaluates an expression in the page, awaiting promises, and returns its value or throws the page's error. */
export async function evaluate(page, expression) {
  const { result, exceptionDetails } = await page("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
  return result.value;
}
