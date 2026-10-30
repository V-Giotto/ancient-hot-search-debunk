import Link from "next/link";
import type { ReactNode } from "react";
import { NavRail } from "./NavRail";
import { RightRail } from "./RightRail";
import { version } from "@/package.json";

export function AppShell({ children, title }: { children: ReactNode; title?: string }) {
  const preview = process.env.CONTENT_MODE === "preview";

  return (
    <div className="app-shell">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-card focus:p-3">
        跳到主要内容
      </a>
      {title && <header className="shell-header">
        <Link href="/trending" aria-label="返回热搜榜" className="shell-back"><span aria-hidden="true">←</span></Link>
        <p className="shell-page-title">{title}</p>
      </header>}
      <div className="shell-content px-4 pt-4">
        <main id="main-content" tabIndex={-1} className="min-w-0 wrap-break-word">
          {preview && <div role="note" className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border border-gold/40 bg-gold/10 px-4 py-3 text-xs leading-6 text-muted">
            <span className="rounded-md bg-gold/15 px-2.5 py-1 font-medium text-ink">开发预览模式</span>
            <span>开发预览：本条史实尚待人工审核</span>
          </div>}
          {children}
          <RightRail />
        </main>
        {preview && <footer aria-label="预览构建信息" className="mt-5 border-t border-ink/10 pt-4 text-xs leading-6 text-muted break-words">
          <span>v{version}</span><span className="mx-2" aria-hidden="true">·</span>
          <span>构建 ID：<code>{process.env.APP_BUILD_ID}</code></span>
        </footer>}
      </div>
      <NavRail />
    </div>
  );
}
