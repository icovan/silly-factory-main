import fs from "node:fs/promises";
import { renderVideo } from "../lib/render-video";
import { VideoContent } from "../lib/schema";

type Job = {
  content: VideoContent;
  audioSrc: string;
  output: string;
};

async function main() {
  const jobPath = process.argv[2];
  if (!jobPath) throw new Error("missing job file");
  const job = JSON.parse(await fs.readFile(jobPath, "utf8")) as Job;
  await renderVideo(job);
  await fs.writeFile(jobPath.replace(/\.json$/, ".done"), "ok");
}

main().catch(async (error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  const jobPath = process.argv[2];
  if (jobPath) {
    await fs.writeFile(jobPath.replace(/\.json$/, ".error.txt"), message).catch(() => undefined);
  }
  process.exit(1);
});
