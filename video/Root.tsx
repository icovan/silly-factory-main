import React from "react";
import { Composition, registerRoot } from "remotion";
import { VideoComposition } from "./VideoComposition";
import { COVER_FRAMES, FPS, VIDEO_DURATION_FRAMES, VIDEO_HEIGHT, VIDEO_WIDTH } from "./config";
import { VideoContent } from "../lib/schema";

const demo: VideoContent = {
  template: "explain",
  language: "zh",
  title: "创业 = 自由？",
  scenes: [
    { type: "title", text: "创业\n=\n自由？" },
    { type: "statement", text: "不一定。" },
    { type: "statement", text: "打工：老板 1 个\n创业：老板变多了" },
    { type: "conclusion", text: "不是没有老板。\n是老板变多了。" },
    { type: "outro" },
  ],
  voiceover: "创业等于自由吗。不一定。不是没有老板，是老板变多了。",
  durationInFrames: VIDEO_DURATION_FRAMES,
};

export const RemotionRoot: React.FC = () => (
  <Composition
    id="SillyFactory"
    component={VideoComposition}
    durationInFrames={VIDEO_DURATION_FRAMES}
    fps={FPS}
    width={VIDEO_WIDTH}
    height={VIDEO_HEIGHT}
    defaultProps={{ content: demo, audioSrc: undefined as string | undefined }}
    calculateMetadata={({ props }) => ({
      durationInFrames: (props.content?.durationInFrames || VIDEO_DURATION_FRAMES) + COVER_FRAMES,
    })}
  />
);

registerRoot(RemotionRoot);
