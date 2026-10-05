import React from "react";
import { AbsoluteFill } from "remotion";
import { AppLanguage } from "../../lib/i18n";
import { TemplateId } from "../../lib/schema";
import { COVER_TITLE, INK, PAPER, SAFE } from "../config";
import { FONT } from "../font";
import { BigText } from "./BigText";

const labels: Record<AppLanguage, Record<TemplateId, string>> = {
  zh: { explain: "人话翻译", three_tips: "三条建议", compare: "对比" },
  en: { explain: "PLAIN TALK", three_tips: "THREE TIPS", compare: "VERSUS" },
};

export function Cover({
  title,
  template,
  language,
}: {
  title: string;
  template: TemplateId;
  language: AppLanguage;
}) {
  return (
    <AbsoluteFill
      style={{
        background: PAPER,
        color: INK,
        paddingTop: SAFE.top,
        paddingRight: SAFE.right,
        paddingBottom: SAFE.bottom,
        paddingLeft: SAFE.left,
        fontFamily: FONT,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          alignSelf: "flex-start",
          background: INK,
          color: PAPER,
          padding: "12px 18px",
          fontWeight: 900,
          fontSize: 30,
          letterSpacing: 0,
        }}
      >
        {labels[language][template]}
      </div>
      <div style={{ flex: 1, display: "flex", alignItems: "center", width: "100%" }}>
        <div style={{ width: "100%" }}>
          <BigText size={COVER_TITLE}>{title}</BigText>
        </div>
      </div>
      <div style={{ height: 10, background: INK, marginBottom: 28 }} />
      <div style={{ fontWeight: 900, fontSize: 32, letterSpacing: 0 }}>
        {language === "zh" ? "智障工厂™" : "Silly Factory™"}
      </div>
    </AbsoluteFill>
  );
}
