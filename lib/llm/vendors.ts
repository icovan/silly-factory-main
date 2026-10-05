export type VendorId =
  | "openai"
  | "deepseek"
  | "moonshot"
  | "qwen"
  | "groq"
  | "custom";

export type Vendor = {
  id: VendorId;
  name: string;
  nameEn: string;
  baseUrl: string;
  models: string[];
  allowCustomBase?: boolean;
};

export const VENDORS: Vendor[] = [
  {
    id: "openai",
    name: "OpenAI",
    nameEn: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    models: ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini", "gpt-4.1"],
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    nameEn: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    models: ["deepseek-chat", "deepseek-reasoner"],
  },
  {
    id: "moonshot",
    name: "月之暗面 Kimi",
    nameEn: "Moonshot Kimi",
    baseUrl: "https://api.moonshot.cn/v1",
    models: ["moonshot-v1-8k", "moonshot-v1-32k", "moonshot-v1-128k"],
  },
  {
    id: "qwen",
    name: "通义千问",
    nameEn: "Qwen",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    models: ["qwen-plus", "qwen-turbo", "qwen-max"],
  },
  {
    id: "groq",
    name: "Groq",
    nameEn: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"],
  },
  {
    id: "custom",
    name: "自定义兼容接口",
    nameEn: "Custom OpenAI-compatible",
    baseUrl: "",
    models: [],
    allowCustomBase: true,
  },
];

export function getVendor(id: string): Vendor | undefined {
  return VENDORS.find((v) => v.id === id);
}
