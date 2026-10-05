import { NextResponse } from "next/server";
import path from "node:path";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import { ensureRenderWorker } from "../../../lib/render-worker";
import { planVideoContent } from "../../../lib/llm/planner";
import { MAX_DURATION_FRAMES, validateRenderedDuration, validateVideoContent, TemplateId } from "../../../lib/schema";
import { generateVoiceover } from "../../../lib/tts";
import { AppLanguage } from "../../../lib/i18n";
import { FPS } from "../../../video/config";
import { withSyncedSpeech } from "../../../lib/speech";
import { sweepExpiredVideos } from "../../../lib/video-retention";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const template = body.template as TemplateId;
    const input = String(body.input || "").trim();
    const language: AppLanguage = body.language === "en" ? "en" : "zh";
    const llm = body.llm || {};

    if (!["explain", "three_tips", "compare"].includes(template)) {
      return NextResponse.json({ error: "不支持的视频类型" }, { status: 400 });
    }
    if (!input) return NextResponse.json({ error: "请先输入内容" }, { status: 400 });
    if (!String(llm.apiKey || "").trim()) {
      return NextResponse.json(
        { error: language === "en" ? "Put a key in the machine room first." : "先在机房填密钥。没有脑子，机器不会装聪明。" },
        { status: 400 },
      );
    }

    const content = await planVideoContent({
      template,
      topic: input,
      language,
      llm: {
        vendor: String(llm.vendor || "openai"),
        model: String(llm.model || ""),
        apiKey: String(llm.apiKey || ""),
        baseUrl: llm.baseUrl ? String(llm.baseUrl) : undefined,
      },
    });
    const errors = validateVideoContent(content);
    if (errors.length) return NextResponse.json({ error: errors.join("；") }, { status: 400 });

    await sweepExpiredVideos().catch(() => undefined);
    const id = crypto.randomUUID();
    const voice = await generateVoiceover(content.voiceover, id, language);
    const synced = withSyncedSpeech(content, voice.cues, FPS);
    const late = validateRenderedDuration(synced);
    if (late.length) {
      await fs.unlink(voice.filePath).catch(() => undefined);
      await fs.unlink(`${voice.filePath}.json`).catch(() => undefined);
      const error =
        language === "en"
          ? synced.durationInFrames > MAX_DURATION_FRAMES
            ? "This cut is too long. Try again."
            : "This cut is too short. Try again."
          : late[0];
      return NextResponse.json({ error }, { status: 400 });
    }

    const output = path.resolve("public", "generated", `${id}.mp4`);
    const jobFile = path.resolve("public", "generated", `${id}.job.json`);
    await fs.writeFile(
      jobFile,
      JSON.stringify({
        content: synced,
        audioSrc: voice.publicSrc,
        output,
      }),
    );
    await fs.writeFile(path.resolve("public", "generated", `${id}.job.ready`), "");
    ensureRenderWorker();

    return NextResponse.json({
      jobId: id,
      status: "rendering",
      title: synced.title,
      template,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "生成失败" }, { status: 500 });
  }
}
