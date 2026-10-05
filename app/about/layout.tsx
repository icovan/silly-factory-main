import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "关于",
  description: "智障工厂用代码把一句话做成约 15 秒竖屏视频。不用 AI 生图生视频。",
};

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
