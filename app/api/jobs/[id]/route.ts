import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { ensureRenderWorker } from "../../../../lib/render-worker";
import { queueFor } from "../../../../lib/queue";
import { sweepExpiredVideos } from "../../../../lib/video-retention";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!/^[a-zA-Z0-9-]+$/.test(id)) {
    return NextResponse.json({ error: "无效任务" }, { status: 400 });
  }
  await sweepExpiredVideos().catch(() => undefined);
  const dir = path.resolve("public", "generated");
  const mp4 = path.join(dir, `${id}.mp4`);
  const errorFile = path.join(dir, `${id}.job.error.txt`);
  const jobFile = path.join(dir, `${id}.job.json`);

  try {
    const failed = await fs.readFile(errorFile, "utf8").catch(() => "");
    if (failed.trim()) {
      return NextResponse.json({ status: "failed", error: failed.trim() });
    }
    await fs.access(mp4);
    let title = "";
    let template = "";
    try {
      const job = JSON.parse(await fs.readFile(jobFile, "utf8")) as {
        content?: { title?: string; template?: string };
      };
      title = job.content?.title || "";
      template = job.content?.template || "";
    } catch {
      /* ignore */
    }
    return NextResponse.json({
      status: "completed",
      videoUrl: `/api/media/${id}`,
      title,
      template,
    });
  } catch {
    try {
      await fs.access(jobFile);
      let title = "";
      let template = "";
      try {
        const job = JSON.parse(await fs.readFile(jobFile, "utf8")) as {
          content?: { title?: string; template?: string };
        };
        title = job.content?.title || "";
        template = job.content?.template || "";
      } catch {
        /* ignore */
      }
      ensureRenderWorker();
      const queue = await queueFor(id, dir);
      return NextResponse.json({ status: "rendering", title, template, ...queue });
    } catch {
      return NextResponse.json({ status: "missing" }, { status: 404 });
    }
  }
}
