import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile, useVideoConfig } from "remotion";
import { Scene, SceneTiming, VideoContent } from "../lib/schema";
import { COVER_FRAMES, PAPER } from "./config";
import { FONT } from "./font";
import { Cover } from "./components/Cover";
import { ExplainBoard, TipsBoard, VersusBoard } from "./components/Boards";

function placedTiming(scenes: Scene[], timings: SceneTiming[] | undefined, index: number, contentFrames: number): SceneTiming {
  const fallbackSlot = Math.floor((contentFrames - 24) / Math.max(scenes.length, 1));
  return (
    timings?.[index] ?? {
      from: index * fallbackSlot,
      durationInFrames: index === scenes.length - 1 ? Math.max(1, contentFrames - index * fallbackSlot) : fallbackSlot,
      cueStart: 0,
      cueEnd: 0,
    }
  );
}

function Film({ content, slots }: { content: VideoContent; slots: SceneTiming[] }) {
  if (content.template === "three_tips") return <TipsBoard content={content} slots={slots} />;
  if (content.template === "compare") return <VersusBoard content={content} slots={slots} />;
  return <ExplainBoard content={content} slots={slots} />;
}

export function VideoComposition({ content, audioSrc }: { content: VideoContent; audioSrc?: string }) {
  const { durationInFrames } = useVideoConfig();
  const scenes = content.scenes;
  const contentFrames = Math.max(1, durationInFrames - COVER_FRAMES);
  const slots = scenes.map((_, index) => placedTiming(scenes, content.sceneTimings, index, contentFrames));

  return (
    <AbsoluteFill style={{ background: PAPER, fontFamily: FONT }}>
      <Sequence from={0} durationInFrames={COVER_FRAMES} name="cover">
        <Cover title={content.title} template={content.template} language={content.language} />
      </Sequence>
      <Sequence from={COVER_FRAMES} durationInFrames={contentFrames} name="film">
        <Film content={content} slots={slots} />
      </Sequence>
      {audioSrc ? (
        <Sequence from={COVER_FRAMES} durationInFrames={contentFrames}>
          <Audio src={staticFile(audioSrc)} />
        </Sequence>
      ) : null}
    </AbsoluteFill>
  );
}
