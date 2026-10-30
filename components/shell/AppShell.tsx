import Link from "next/link";
import type { ReactNode } from "react";
import { NavRail } from "./NavRail";
import { RightRail } from "./RightRail";

export function AppShell({ children }: { children: ReactNode }) {
  const preview = process.env.CONTENT_MODE === "preview";

  return (
    <div className="app-shell">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-card focus:p-3">
        跳到主要内容
      </a>
      <header className="shell-header sticky top-0 z-20 border-b border-ink/8 bg-card">
        <div className="flex flex-col items-start justify-center gap-2 px-4 py-3">
          <Link href="/trending" className="flex min-w-0 items-center gap-3 rounded-sm">
            <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent text-xl font-bold text-card">
              辟
            </span>
            <div>
              <p className="text-lg font-bold tracking-wide">古代热搜辟谣局</p>
              <p className="mt-0.5 text-xs text-muted">让古人上热搜，让你来辟谣。</p>
            </div>
          </Link>
          <span className="rounded-full border border-gold/40 bg-gold/10 px-3 py-0.5 text-[11px] text-ink">
            古代互联网·架空演绎
          </span>
        </div>
      </header>
      <div className="shell-content px-4 pt-6">
        <main id="main-content" tabIndex={-1} className="min-w-0 wrap-break-word">
          {preview && <div role="note" className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border border-gold/40 bg-gold/10 px-4 py-3 text-xs leading-6 text-muted">
            <span className="rounded-md bg-gold/15 px-2.5 py-1 font-medium text-ink">开发预览模式</span>
            <span>开发预览：本条史实尚待人工审核</span>
          </div>}
          {children}
          <RightRail />
        </main>
      </div>
      <NavRail />
    </div>
  );
}
