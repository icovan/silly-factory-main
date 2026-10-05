import { VENDORS, VendorId } from "./vendors";
import { AppLanguage } from "../i18n";

export type LlmState = {
  vendor: VendorId;
  model: string;
  apiKey: string;
  baseUrl: string;
};

export function defaultLlm(): LlmState {
  const vendor = VENDORS.find((v) => v.id === "deepseek") || VENDORS[0];
  return {
    vendor: vendor.id,
    model: vendor.models[0] || "",
    apiKey: "",
    baseUrl: "",
  };
}

export function parseLlm(raw: unknown): LlmState {
  const base = defaultLlm();
  if (!raw || typeof raw !== "object") return base;
  const row = raw as Record<string, unknown>;
  const vendor = VENDORS.find((v) => v.id === row.vendor) || VENDORS.find((v) => v.id === base.vendor) || VENDORS[0];
  const model =
    typeof row.model === "string" && row.model.trim()
      ? row.model.trim()
      : vendor.models[0] || "";
  return {
    vendor: vendor.id,
    model,
    apiKey: typeof row.apiKey === "string" ? row.apiKey : "",
    baseUrl: typeof row.baseUrl === "string" ? row.baseUrl : "",
  };
}

export function llmFingerprint(llm: LlmState) {
  return [llm.vendor, llm.model, llm.baseUrl, llm.apiKey].join("\n");
}

export function llmStatus(llm: LlmState, language: AppLanguage, okPrint = "") {
  const vendor = VENDORS.find((v) => v.id === llm.vendor);
  const name = language === "en" ? vendor?.nameEn || vendor?.name : vendor?.name;
  const hasKey = Boolean(llm.apiKey.trim());
  const live = hasKey && okPrint === llmFingerprint(llm);
  return { hasKey, live, name: name || "LLM" };
}
