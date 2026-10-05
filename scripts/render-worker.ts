import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { makeCancelSignal } from "@remotion/renderer";
import { renderVideo } from "../lib/render-video";
import { RENDER_ATTEMPTS } from "../lib/render-worker";
import { recordRenderSec } from "../lib/queue";
import { sweepExpiredVideos } from "../lib/video-retention";
import { VideoContent } from "../lib/schema";

const dir = path.resolve("public", "generated");
const RENDER_LIMIT_MS = 8 * 60 * 1000;

type Job = {
  content: VideoContent;
  audioSrc: string;
  output: string;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readAttempts(file: string, fallback: number) {
  try {
    const value = Number(fsSync.readFileSync(file, "utf8").trim());
    return Number.isFinite(value) && value > 0 ? value : fallback;
  } catch {
    return fallback;
  }
}

async function failJob(jobFile: string, runningFile: string, message: string, output?: string) {
  const errorFile = jobFile.replace(/\.json$/, ".error.txt");
  if (output) await fs.unlink(output).catch(() => undefined);
  await fs.writeFile(errorFile, message).catch(() => undefined);
  await fs.unlink(runningFile).catch(() => undefined);
}

async function reclaimAbandoned() {
  const names = await fs.readdir(dir);
  for (const name of names) {
    if (!name.endsWith(".job.running")) continue;
    const runningFile = path.join(dir, name);
    const jobFile = runningFile.replace(/\.running$/, ".json");
    const readyFile = jobFile.replace(/\.json$/, ".ready");
    const doneFile = jobFile.replace(/\.json$/, ".done");
    const errorFile = jobFile.replace(/\.json$/, ".error.txt");
    if (!fsSync.existsSync(jobFile) || fsSync.existsSync(doneFile) || fsSync.existsSync(errorFile)) {
      await fs.unlink(runningFile).catch(() => undefined);
      continue;
    }
    const attempts = readAttempts(runningFile, 1);
    if (attempts >= RENDER_ATTEMPTS) {
      await failJob(jobFile, runningFile, "渲染中断。再试一次。");
      console.log("gave up", path.basename(jobFile));
      continue;
    }
    await fs.writeFile(readyFile, String(attempts));
    await fs.unlink(runningFile).catch(() => undefined);
    console.log("requeued", path.basename(jobFile));
  }
}

async function takeReadyJobs() {
  await fs.mkdir(dir, { recursive: true });
  const names = await fs.readdir(dir);
  const ready = names.filter((name) => name.endsWith(".job.ready")).map((name) => path.join(dir, name));
  const stamped = await Promise.all(
    ready.map(async (file) => ({ file, time: (await fs.stat(file)).mtimeMs })),
  );
  stamped.sort((a, b) => a.time - b.time);
  return stamped.map((item) => item.file);
}

async function runJob(readyFile: string) {
  const jobFile = readyFile.replace(/\.job\.ready$/, ".job.json");
  const runningFile = jobFile.replace(/\.json$/, ".running");
  const doneFile = jobFile.replace(/\.json$/, ".done");
  const errorFile = jobFile.replace(/\.json$/, ".error.txt");
  const attempts = readAttempts(readyFile, 0);
  const startedFile = jobFile.replace(/\.json$/, ".started");
  await fs.unlink(readyFile).catch(() => undefined);
  if (!fsSync.existsSync(jobFile)) return;
  if (fsSync.existsSync(doneFile) || fsSync.existsSync(errorFile)) return;
  if (attempts >= RENDER_ATTEMPTS) {
    await fs.writeFile(errorFile, "渲染中断。再试一次。");
    return;
  }

  let output = "";
  const { cancel, cancelSignal } = makeCancelSignal();
  const timer = setTimeout(() => cancel(), RENDER_LIMIT_MS);
  try {
    const startedAt = Date.now();
    await fs.writeFile(runningFile, String(attempts + 1));
    await fs.writeFile(startedFile, String(startedAt));
    const job = JSON.parse(await fs.readFile(jobFile, "utf8")) as Job;
    output = job.output;
    await renderVideo({ ...job, cancelSignal });
    await fs.writeFile(doneFile, "ok");
    await recordRenderSec(dir, (Date.now() - startedAt) / 1000);
  } catch (error) {
    const raw = error instanceof Error ? error.message : String(error);
    const message = raw.includes("got cancelled") ? "渲染超时。再试一次。" : raw;
    console.error(message);
    await failJob(jobFile, runningFile, message, output);
  } finally {
    clearTimeout(timer);
    await fs.unlink(runningFile).catch(() => undefined);
    await fs.unlink(startedFile).catch(() => undefined);
  }
}

async function main() {
  console.log("render worker ready");
  await reclaimAbandoned();
  for (;;) {
    await sweepExpiredVideos().catch(() => undefined);
    const ready = await takeReadyJobs();
    for (const file of ready) {
      await runJob(file);
    }
    await sleep(500);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
