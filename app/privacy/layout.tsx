import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "隐私",
  description: "密钥只存在浏览器。本站不设账号，不出售个人数据。广告可能使用 Cookie。",
};

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
