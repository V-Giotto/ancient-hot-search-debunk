import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "古代热搜辟谣局", template: "%s · 古代热搜辟谣局" },
  description: "让古人上热搜，让你来辟谣。",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

// CONTENT_MODE 在生产服务启动后读取，使页脚与 API 使用同一个运行模式。
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
