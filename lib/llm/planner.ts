import { AppLanguage } from "../i18n";
import {
  TemplateId,
  VideoContent,
  Scene,
  limitsFor,
  validateVideoContent,
} from "../schema";
import { plannerSystemPrompt, plannerUserPrompt } from "./prompt";
import { getVendor } from "./vendors";
import { buildVoiceover } from "../speech";
import { pickContentStyle } from "./styles";

export type LlmConfig = {
  vendor: string;
  model: string;
  apiKey: string;
  baseUrl?: string;
};

type RawPlan = {
  title?: unknown;
  voiceover?: unknown;
  scenes?: unknown;
};

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const payload = fenced ? fenced[1] : trimmed;
  const start = payload.indexOf("{");
  const end = payload.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("策划没有返回 JSON");
  return JSON.parse(payload.slice(start, end + 1));
}

function asString(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function requireFit(text: string, max: number, label: string) {
  if (!text) return "";
  if (Array.from(text).length > max) throw new Error(`${label}太长`);
  return text;
}

function normalizeScenes(raw: unknown, template: TemplateId, max: ReturnType<typeof limitsFor>): Scene[] {
  if (!Array.isArray(raw)) throw new Error("策划没有给出分镜");
  const parsed: Scene[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const type = String(row.type || "");
    if (type === "title" || type === "statement" || type === "conclusion") {
      const text = asString(row.text);
      if (text) parsed.push({ type, text });
    }
    if (type === "list") {
      const items = Array.isArray(row.items)
        ? row.items.map((entry) => asString(entry)).filter(Boolean).slice(0, 3)
        : [];
      if (items.length) parsed.push({ type: "list", items });
    }
    if (type === "comparison") {
      const leftRaw = (row.left && typeof row.left === "object" ? row.left : {}) as Record<string, unknown>;
      const rightRaw = (row.right && typeof row.right === "object" ? row.right : {}) as Record<string, unknown>;
      const leftItems = Array.isArray(leftRaw.items)
        ? leftRaw.items.map((entry) => asString(entry)).filter(Boolean).slice(0, 3)
        : [];
      const rightItems = Array.isArray(rightRaw.items)
        ? rightRaw.items.map((entry) => asString(entry)).filter(Boolean).slice(0, 3)
        : [];
      parsed.push({
        type: "comparison",
        left: { title: asString(leftRaw.title) || "A", items: leftItems },
        right: { title: asString(rightRaw.title) || "B", items: rightItems },
      });
    }
  }

  const title = parsed.find((scene) => scene.type === "title");
  const conclusion = [...parsed].reverse().find((scene) => scene.type === "conclusion");
  if (!title || title.type !== "title") throw new Error("策划缺少标题镜头");
  if (!conclusion || conclusion.type !== "conclusion") throw new Error("策划缺少结论");

  let chosen: Scene[];
  if (template === "explain") {
    const statements = parsed.filter((scene) => scene.type === "statement").slice(0, 2);
    if (statements.length < 2) throw new Error("人话翻译需要两句展开");
    chosen = [title, ...statements, conclusion];
  } else if (template === "three_tips") {
    const statement = parsed.find((scene) => scene.type === "statement");
    const list = parsed.find((scene) => scene.type === "list");
    if (!statement || statement.type !== "statement") throw new Error("三条建议缺少那句拆穿");
    if (!list || list.type !== "list" || list.items.length < 3) throw new Error("三条建议要刚好 3 条");
    chosen = [title, statement, list, conclusion];
  } else {
    const comparison = parsed.find((scene) => scene.type === "comparison");
    if (!comparison || comparison.type !== "comparison") throw new Error("对比缺少 A/B");
    if (comparison.left.items.length < 3 || comparison.right.items.length < 3) {
      throw new Error("对比两侧都要 3 条");
    }
    chosen = [title, comparison, conclusion];
  }

  const fitted = chosen.map((scene) => fitScene(scene, max));
  return [...fitted, { type: "outro" }];
}

function fitScene(scene: Scene, max: ReturnType<typeof limitsFor>): Scene {
  if (scene.type === "title") return { type: "title", text: requireFit(scene.text, max.title, "标题") };
  if (scene.type === "statement" || scene.type === "conclusion") {
    return { type: scene.type, text: requireFit(scene.text, max.body, scene.type === "conclusion" ? "结论" : "正文") };
  }
  if (scene.type === "list") {
    return { type: "list", items: scene.items.map((item) => requireFit(item, max.tip, "建议")) };
  }
  if (scene.type === "comparison") {
    return {
      type: "comparison",
      left: {
        title: requireFit(scene.left.title, max.compareTitle, "对比标题"),
        items: scene.left.items.map((item) => requireFit(item, max.compareItem, "对比项")),
      },
      right: {
        title: requireFit(scene.right.title, max.compareTitle, "对比标题"),
        items: scene.right.items.map((item) => requireFit(item, max.compareItem, "对比项")),
      },
    };
  }
  return scene;
}

async function complete(
  config: LlmConfig,
  system: string,
  user: string,
  forceJson: boolean,
  temperature: number,
) {
  const vendor = getVendor(config.vendor);
  const baseUrl = (config.baseUrl || vendor?.baseUrl || "").replace(/\/$/, "");
  if (!baseUrl) throw new Error("自定义厂商需要接口地址");
  if (!config.model.trim()) throw new Error("请选择模型");
  if (!config.apiKey.trim()) throw new Error("请填写密钥");

  const body: Record<string, unknown> = {
    model: config.model.trim(),
    temperature,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  };
  if (forceJson) body.response_format = { type: "json_object" };

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey.trim()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(45_000),
  });
  const data = (await res.json().catch(() => ({}))) as {
    error?: { message?: string };
    choices?: Array<{ message?: { content?: string } }>;
  };
  if (!res.ok) {
    throw new Error(data.error?.message || `大模型请求失败（${res.status}）`);
  }
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("大模型没有返回内容");
  return content;
}

function toContent(
  template: TemplateId,
  language: AppLanguage,
  raw: RawPlan,
): VideoContent {
  const max = limitsFor(language);
  const scenes = normalizeScenes(raw.scenes, template, max);
  const title = requireFit(asString(raw.title), max.title, "标题") || sceneTitle(scenes);
  const voiceover = buildVoiceover(scenes, language);
  if (!title) throw new Error("策划标题是空的");
  if (!voiceover) throw new Error("策划没有可念的句子");
  return {
    template,
    language,
    title,
    scenes,
    voiceover,
    durationInFrames: 450,
  };
}

function sceneTitle(scenes: Scene[]) {
  const title = scenes.find((scene) => scene.type === "title");
  return title && title.type === "title" ? title.text : "";
}

export async function planVideoContent(options: {
  template: TemplateId;
  topic: string;
  language: AppLanguage;
  llm: LlmConfig;
}): Promise<VideoContent> {
  const { template, topic, language, llm } = options;
  const style = pickContentStyle(language);
  const system = plannerSystemPrompt(template, language, style);
  const user = plannerUserPrompt(topic, template, language, style);

  const temperature = language === "zh" ? 1.15 : 0.95;
  let lastError = "策划失败";
  let feedback = "";
  const passes = [true, false, false];
  for (let attempt = 0; attempt < passes.length; attempt += 1) {
    const forceJson = passes[attempt]!;
    try {
      const text = await complete(llm, system, feedback ? `${user}\n\n${feedback}` : user, forceJson, temperature);
      const parsed = extractJson(text) as RawPlan;
      const content = toContent(template, language, parsed);
      const errors = validateVideoContent(content);
      if (errors.length) {
        lastError = errors.join("；");
        feedback = `上次不合格：${lastError}。只改这个问题。不要加镜头，不要写超字数。`;
        continue;
      }
      return content;
    } catch (error) {
      const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
      lastError = timedOut ? "大模型超时。再试一次。" : error instanceof Error ? error.message : "策划失败";
      const unsupported = /response_format|json_object|unknown parameter/i.test(lastError);
      if (forceJson && unsupported) continue;
      feedback = `上次失败：${lastError}。按镜头结构重写 JSON。`;
      if (attempt === passes.length - 1) break;
    }
  }
  throw new Error(lastError);
}
