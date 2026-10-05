import type { Metadata } from "next";
import fs from "node:fs/promises";
import path from "node:path";
import { ResultClient } from "./ResultClient";

type Props = { params: Promise<{ id: string }> };

async function jobTitle(id: string) {
  if (!/^[a-zA-Z0-9-]+$/.test(id)) return "";
  try {
    const raw = await fs.readFile(path.resolve("public", "generated", `${id}.job.json`), "utf8");
    const job = JSON.parse(raw) as { content?: { title?: string } };
    return job.content?.title || "";
  } catch {
    return "";
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const title = await jobTitle(id);
  return {
    title: title || "出片中",
    description: title ? `${title} — 智障工厂出品的 15 秒竖屏短视频。` : "机器正在把一句话做成竖屏短视频。",
    robots: { index: false, follow: true },
  };
}

export default async function ResultPage({ params }: Props) {
  const { id } = await params;
  return <ResultClient id={id} />;
}
