import React from "react";
import {
  AbsoluteFill,
  Sequence,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { BigText } from "./components/BigText";
import { TypingText } from "./components/TypingText";

const bg = "#F7F7F3";
const black = "#111111";

function SceneTitle() {
  return (
    <AbsoluteFill style={{ background: bg, color: black, padding: 96, justifyContent: "center" }}>
      <BigText>
        <TypingText text={"创业\n=\n自由？"} charsPerFrame={0.11} />
      </BigText>
    </AbsoluteFill>
  );
}

function SceneNo() {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: bg, padding: 96, justifyContent: "center" }}>
      <div style={{ opacity }}>
        <BigText>不一定。</BigText>
      </div>
    </AbsoluteFill>
  );
}

function SceneComparison() {
  const frame = useCurrentFrame();
  const y = interpolate(frame, [0, 10], [40, 0], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: bg, padding: 96, justifyContent: "center" }}>
      <div style={{ transform: `translateY(${y}px)`, fontFamily: 'Arial, "Noto Sans SC", sans-serif' }}>
        <div style={{ fontSize: 42, fontWeight: 900, marginBottom: 30 }}>打工：</div>
        <div style={{ fontSize: 54, fontWeight: 900, marginBottom: 70 }}>老板 1 个</div>

        <div style={{ fontSize: 42, fontWeight: 900, marginBottom: 30 }}>创业：</div>
        <div style={{ fontSize: 54, fontWeight: 900, lineHeight: 1.35 }}>
          客户<br />员工<br />投资人<br />平台<br />税务局
        </div>
      </div>
    </AbsoluteFill>
  );
}

function SceneConclusion() {
  return (
    <AbsoluteFill style={{ background: bg, padding: 96, justifyContent: "center" }}>
      <BigText>
        不是没有老板。
        {"\n\n"}
        是老板变多了。
      </BigText>
    </AbsoluteFill>
  );
}

function Outro() {
  return (
    <AbsoluteFill style={{ background: black, color: "#fff", padding: 96, justifyContent: "center" }}>
      <div style={{ fontFamily: 'Arial, "Noto Sans SC", sans-serif' }}>
        <div style={{ fontSize: 54, fontWeight: 900, letterSpacing: "-.04em" }}>
          智障工厂™
        </div>
        <div style={{ fontSize: 28, marginTop: 30, lineHeight: 1.5 }}>
          一本正经地<br />
          把你的废话做成视频
        </div>
      </div>
    </AbsoluteFill>
  );
}

export function SillyFactoryVideo() {
  return (
    <AbsoluteFill>
      <Sequence from={0} durationInFrames={90}>
        <SceneTitle />
      </Sequence>
      <Sequence from={90} durationInFrames={75}>
        <SceneNo />
      </Sequence>
      <Sequence from={165} durationInFrames={135}>
        <SceneComparison />
      </Sequence>
      <Sequence from={300} durationInFrames={90}>
        <SceneConclusion />
      </Sequence>
      <Sequence from={390} durationInFrames={60}>
        <Outro />
      </Sequence>
    </AbsoluteFill>
  );
}
