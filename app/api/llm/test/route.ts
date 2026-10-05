import { NextResponse } from "next/server";
import { pingLlm } from "../../../../lib/llm/ping";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    await pingLlm({
      vendor: String(body.vendor || ""),
      model: String(body.model || ""),
      apiKey: String(body.apiKey || ""),
      baseUrl: body.baseUrl ? String(body.baseUrl) : undefined,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "测试失败" },
      { status: 400 },
    );
  }
}
