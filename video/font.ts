import { loadFont } from "@remotion/google-fonts/NotoSansSC";

const loaded = loadFont("normal", {
  weights: ["900"],
  subsets: ["chinese-simplified", "latin"],
  ignoreTooManyRequestsWarning: true,
});

export const FONT = `${loaded.fontFamily}, "Microsoft YaHei", "PingFang SC", sans-serif`;
