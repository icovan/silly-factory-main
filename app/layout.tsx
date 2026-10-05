import type { Metadata } from "next";
import Script from "next/script";
import { SessionProvider } from "./hooks/useFactorySession";
import "./globals.css";

const site = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: {
    default: "智障工厂™ | 一句话做成 15 秒短视频",
    template: "%s | 智障工厂™",
  },
  description:
    "把一句话做成大约 15 秒的竖屏短视频。纯色大字、打字机、机械配音。不用 AI 生图，不用 AI 生视频。内容可以聪明，表现必须笨。",
  keywords: ["短视频生成", "竖屏视频", "Remotion", "人话翻译", "三条建议", "智障工厂", "Silly Factory"],
  alternates: {
    canonical: "/",
    languages: { "zh-CN": "/", en: "/?lang=en" },
  },
  openGraph: {
    title: "智障工厂™",
    description: "一本正经地把你的废话做成视频。",
    url: site,
    siteName: "智障工厂",
    locale: "zh_CN",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const ads = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
  return (
    <html lang="zh-CN">
      <body>
        <SessionProvider>{children}</SessionProvider>
        {ads ? (
          <Script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ads}`}
            crossOrigin="anonymous"
          />
        ) : null}
      </body>
    </html>
  );
}
