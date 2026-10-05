import { getVendor } from "./vendors";

export type LlmCallConfig = {
  vendor: string;
  model: string;
  apiKey: string;
  baseUrl?: string;
};

export async function pingLlm(config: LlmCallConfig) {
  const vendor = getVendor(config.vendor);
  const baseUrl = (config.baseUrl || vendor?.baseUrl || "").replace(/\/$/, "");
  if (!baseUrl) throw new Error("自定义厂商需要接口地址");
  if (!config.model.trim()) throw new Error("请选择模型");
  if (!config.apiKey.trim()) throw new Error("请填写密钥");

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey.trim()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model.trim(),
      temperature: 0,
      max_tokens: 16,
      messages: [{ role: "user", content: "Reply with ok." }],
    }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    error?: { message?: string };
    choices?: Array<{ message?: { content?: string } }>;
  };
  if (!res.ok) {
    throw new Error(data.error?.message || `大模型请求失败（${res.status}）`);
  }
  if (!data.choices?.[0]?.message?.content) {
    throw new Error("大模型没有返回内容");
  }
}
