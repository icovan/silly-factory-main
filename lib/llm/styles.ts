import { AppLanguage } from "../i18n";

export type ContentStyle = {
  id: string;
  name: string;
  instruction: string;
};

const ZH: ContentStyle[] = [
  {
    id: "deadpan",
    name: "一本正经",
    instruction: "像在宣读通知：不笑、不升华。损的事实要用具体动作说出来，例如已读不回、闹钟响三次。禁止写成社论。",
  },
  {
    id: "selfroast",
    name: "自嘲",
    instruction: "我们就是那个丢人的人。用「我」或「咱们」。刺的是同类习惯，不是骂谁。要有一个让人想起自己聊天记录的细节。",
  },
  {
    id: "cold",
    name: "冷幽默",
    instruction: "第一句像鸡汤或常识，第二句立刻拆穿。拆穿要具体，不要「其实没那么简单」。",
  },
  {
    id: "grumpy",
    name: "轻微暴躁",
    instruction: "被问烦了。短句、断句、可以翻白眼。狠在判断，不在脏字。",
  },
  {
    id: "invert",
    name: "反常识",
    instruction: "把朋友圈最爱转发的那句反过来。后面必须跟一个生活里立刻能对上号的证据，不能只喊口号。",
  },
];

const EN: ContentStyle[] = [
  {
    id: "deadpan",
    name: "deadpan",
    instruction: "Say a mean true thing like a memo. No pep talk.",
  },
  {
    id: "selfroast",
    name: "self-roast",
    instruction: "Make the topic about our own coping. Sharp, not cruel to a named person.",
  },
  {
    id: "cold",
    name: "cold joke",
    instruction: "Set up a cliché, then snap it. The snap must feel obvious in hindsight.",
  },
  {
    id: "grumpy",
    name: "grumpy",
    instruction: "Impatient short lines. Harsh is fine. Vulgar is not.",
  },
  {
    id: "invert",
    name: "inversion",
    instruction: "Attack the popular advice. Flip it, then prove it with a tiny real-life example.",
  },
];

export function pickContentStyle(language: AppLanguage): ContentStyle {
  const pool = language === "zh" ? ZH : EN;
  return pool[Math.floor(Math.random() * pool.length)]!;
}
