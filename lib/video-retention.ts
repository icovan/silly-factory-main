import fs from "node:fs/promises";
import path from "node:path";

export const VIDEO_KEEP_MS = 10 * 60 * 1000;

const SUFFIXES = [".mp4", ".mp3.json", ".mp3", ".job.error.txt", ".job.running", ".job.ready", ".job.done", ".job.started", ".job.json"];

let lastSweep = 0;

function jobId(name: string) {
  for (const suffix of SUFFIXES) {
    if (!name.endsWith(suffix)) continue;
    const id = name.slice(0, -suffix.length);
    if (/^[0-9a-f-]{36}$/i.test(id)) return id;
  }
  return "";
}

async function mtime(file: string) {
  try {
    return (await fs.stat(file)).mtimeMs;
  } catch {
    return 0;
  }
}

async function sweepDir(dir: string, expired: Set<string>) {
  const names = await fs.readdir(dir).catch(() => [] as string[]);
  for (const name of names) {
    const id = jobId(name);
    if (!id || !expired.has(id)) continue;
    await fs.unlink(path.join(dir, name)).catch(() => undefined);
  }
}

export async function sweepExpiredVideos(options?: {
  dir?: string;
  extraDirs?: string[];
  now?: number;
  keepMs?: number;
  force?: boolean;
}) {
  const now = options?.now ?? Date.now();
  if (!options?.force && now - lastSweep < 15_000) return;
  lastSweep = now;
  const dir = options?.dir ?? path.resolve("public", "generated");
  const keepMs = options?.keepMs ?? VIDEO_KEEP_MS;
  const names = await fs.readdir(dir).catch(() => [] as string[]);
  const groups = new Map<string, string[]>();
  for (const name of names) {
    const id = jobId(name);
    if (!id) continue;
    const list = groups.get(id) || [];
    list.push(name);
    groups.set(id, list);
  }

  const expired = new Set<string>();
  for (const [id, files] of groups) {
    if (files.some((name) => name.endsWith(".job.running") || name.endsWith(".job.ready"))) continue;
    const mp4 = files.find((name) => name.endsWith(".mp4"));
    const anchor = mp4
      ? await mtime(path.join(dir, mp4))
      : Math.max(...(await Promise.all(files.map((name) => mtime(path.join(dir, name))))));
    if (!anchor || now - anchor < keepMs) continue;
    expired.add(id);
  }

  await sweepDir(dir, expired);
  const extras = options?.extraDirs ?? [path.resolve(".remotion-bundle", "public", "generated")];
  for (const extra of extras) await sweepDir(extra, expired);
}
