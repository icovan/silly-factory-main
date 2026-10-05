import fs from "node:fs/promises";
import path from "node:path";

export const DEFAULT_RENDER_SEC = 90;
const statsName = "render-times.json";

export type QueuePhase = "running" | "queued";

export type QueueInfo = {
  ahead: number;
  estimatedSec: number;
  phase: QueuePhase;
};

async function mtime(file: string) {
  try {
    return (await fs.stat(file)).mtimeMs;
  } catch {
    return 0;
  }
}

async function readyIds(dir: string) {
  const names = await fs.readdir(dir).catch(() => [] as string[]);
  const ready = names.filter((name) => name.endsWith(".job.ready"));
  const stamped = await Promise.all(
    ready.map(async (name) => ({
      id: name.replace(/\.job\.ready$/, ""),
      time: await mtime(path.join(dir, name)),
    })),
  );
  stamped.sort((a, b) => a.time - b.time || a.id.localeCompare(b.id));
  return stamped.map((item) => item.id);
}

async function runningId(dir: string) {
  const names = await fs.readdir(dir).catch(() => [] as string[]);
  const running = names.find((name) => name.endsWith(".job.running"));
  return running ? running.replace(/\.job\.running$/, "") : "";
}

export async function averageRenderSec(dir: string) {
  try {
    const raw = JSON.parse(await fs.readFile(path.join(dir, statsName), "utf8")) as { samples?: number[] };
    const samples = (raw.samples || []).filter((n) => n >= 20 && n <= 480);
    if (!samples.length) return DEFAULT_RENDER_SEC;
    return Math.round(samples.reduce((sum, n) => sum + n, 0) / samples.length);
  } catch {
    return DEFAULT_RENDER_SEC;
  }
}

export async function recordRenderSec(dir: string, seconds: number) {
  if (seconds < 5 || seconds > 600) return;
  let samples: number[] = [];
  try {
    const raw = JSON.parse(await fs.readFile(path.join(dir, statsName), "utf8")) as { samples?: number[] };
    samples = Array.isArray(raw.samples) ? raw.samples : [];
  } catch {
    samples = [];
  }
  samples.push(Math.round(seconds));
  await fs.writeFile(path.join(dir, statsName), JSON.stringify({ samples: samples.slice(-8) }));
}

export async function queueFor(id: string, dir = path.resolve("public", "generated")): Promise<QueueInfo> {
  const [ready, active, avg] = await Promise.all([readyIds(dir), runningId(dir), averageRenderSec(dir)]);
  const started = Number(await fs.readFile(path.join(dir, `${active}.job.started`), "utf8").catch(() => "0"));
  const elapsed = started > 0 ? Math.max(0, (Date.now() - started) / 1000) : 0;
  const currentRemain = active ? Math.max(15, avg - elapsed) : 0;

  if (active === id) {
    return { ahead: 0, estimatedSec: Math.round(Math.max(15, avg - elapsed)), phase: "running" };
  }

  const index = ready.indexOf(id);
  const waitingBefore = index < 0 ? ready.length : index;
  const ahead = waitingBefore + (active ? 1 : 0);
  const estimatedSec = Math.round(waitingBefore * avg + currentRemain + avg);
  return { ahead, estimatedSec, phase: "queued" };
}
