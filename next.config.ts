import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: [
    "node-edge-tts",
    "ws",
    "@remotion/bundler",
    "@remotion/renderer",
    "@rspack/core",
    "@rspack/binding",
    "@rspack/binding-win32-x64-msvc",
    "@rspack/binding-linux-x64-gnu",
  ],
};

export default nextConfig;
