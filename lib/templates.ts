import { TemplateId, VideoContent } from "./schema";
import { buildVoiceover } from "./speech";

const clean = (s: string) => s.replace(/\s+/g, " ").trim();

function finish(content: Omit<VideoContent, "voiceover"> & { voiceover?: string }): VideoContent {
  const scenes = content.scenes;
  return { ...content, voiceover: buildVoiceover(scenes) };
}

export function buildContent(template: TemplateId, input: string): VideoContent {
  const text = clean(input).slice(0, 100);

  if (template === "three_tips") {
    const topic = text.replace(/[。！？!?]+$/, "");
    const tips = [
      `先把「${topic}」说清楚`,
      "只做最重要的一件事",
      "做完再决定要不要继续",
    ];
    return finish({
      template,
      title: topic.slice(0, 20),
      scenes: [
        { type: "title", text: topic.slice(0, 20) },
        { type: "statement", text: "给你三条建议。" },
        { type: "list", items: tips },
        { type: "conclusion", text: "先做。再优化。" },
        { type: "outro" },
      ],
      language: "zh",
      durationInFrames: 450,
    });
  }

  if (template === "compare") {
    const topic = text.slice(0, 20);
    return finish({
      template,
      title: `${topic} vs 传统做法`.slice(0, 20),
      scenes: [
        { type: "title", text: `${topic} VS 传统做法` },
        { type: "comparison", left: { title: topic, items: ["快", "简单", "先做"] }, right: { title: "传统做法", items: ["慢", "复杂", "先规划"] } },
        { type: "conclusion", text: "没有绝对正确。先看你的目标。" },
        { type: "outro" },
      ],
      language: "zh",
      durationInFrames: 450,
    });
  }

  return finish({
    template: "explain",
    title: text.slice(0, 20),
    scenes: [
      { type: "title", text: text.slice(0, 20) },
      { type: "statement", text: "先别被词吓住。" },
      { type: "statement", text: "它在解决一个具体问题。" },
      { type: "conclusion", text: "懂了。就够了。" },
      { type: "outro" },
    ],
    language: "zh",
    durationInFrames: 450,
  });
}
