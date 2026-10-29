import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/AppShell";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "古代热搜辟谣局", template: "%s · 古代热搜辟谣局" },
  description: "让古人上热搜，让你来辟谣。古代互联网·架空演绎。",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body><AppShell>{children}</AppShell></body>
    </html>
  );
}
