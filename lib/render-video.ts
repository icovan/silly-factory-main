import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition, type CancelSignal } from "@remotion/renderer";
import fs from "node:fs";
import path from "node:path";
import { VideoContent } from "./schema";

let bundled: string | null = null;

function findCachedBrowser() {
  const root = path.resolve("node_modules", ".remotion");
  if (!fs.existsSync(root)) return "";
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop()!;
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      if (fs.statSync(full).isDirectory()) {
        stack.push(full);
        continue;
      }
      if (/^(chrome|chromium)(-headless-shell)?(\.exe)?$/i.test(name)) return full;
    }
  }
  return "";
}

function findBrowser() {
  const candidates = [
    process.env.REMOTION_BROWSER,
    findCachedBrowser(),
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/google-chrome",
    path.join(process.env.LOCALAPPDATA || "", "Google/Chrome/Application/chrome.exe"),
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  ].filter(Boolean) as string[];
  return candidates.find((file) => fs.existsSync(file));
}

async function getBundle() {
  if (bundled) return bundled;
  bundled = await bundle({
    entryPoint: path.resolve("video/Root.tsx"),
    publicDir: path.resolve("public"),
    outDir: path.resolve(".remotion-bundle"),
    enableCaching: true,
    webpackOverride: (config) => config,
  });
  return bundled;
}

function syncPublicAsset(rel: string) {
  const from = path.resolve("public", rel);
  const to = path.resolve(".remotion-bundle", "public", rel);
  if (!fs.existsSync(from)) {
    throw new Error(`配音文件不存在：${rel}`);
  }
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

export async function renderVideo(options: {
  content: VideoContent;
  audioSrc: string;
  output: string;
  cancelSignal?: CancelSignal;
}) {
  const serveUrl = await getBundle();
  if (options.audioSrc) {
    syncPublicAsset(options.audioSrc);
  }
  const inputProps = { content: options.content, audioSrc: options.audioSrc };
  const browserExecutable = findBrowser();
  const composition = await selectComposition({
    serveUrl,
    id: "SillyFactory",
    inputProps,
    browserExecutable,
  });
  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    pixelFormat: "yuv420p",
    outputLocation: options.output,
    inputProps,
    browserExecutable,
    cancelSignal: options.cancelSignal,
    timeoutInMilliseconds: 45_000,
  });
}
