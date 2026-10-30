"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
  { href: "/trending", label: "热搜榜", symbol: "#" },
  { href: "/discover", label: "发现", symbol: "◫" },
  { href: "/stickers", label: "贴纸", symbol: "▧" },
  { href: "/friends", label: "好友", symbol: null },
];

export function NavRail() {
  const pathname = usePathname();

  return (
    <nav aria-label="主导航" className="bottom-tabs border-t border-ink/10 bg-card">
      <ul className="grid grid-cols-4 gap-1 px-2 py-2">
        {navigation.map((item) => {
          const active = pathname === item.href || Boolean(pathname?.startsWith(`${item.href}/`));
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-12 items-center justify-center gap-1 rounded-xl px-1 py-2 text-sm font-medium whitespace-nowrap transition-colors duration-200 ${active ? "bg-accent/10 text-accent" : "text-ink hover:bg-background"}`}
              >
                {item.symbol ? <span aria-hidden="true" className="w-5 text-center text-xl">{item.symbol}</span> : <svg aria-hidden="true" focusable="false" className="h-5 w-5" viewBox="0 0 24 24" fill="none"><path d="M4 5h12v10H9l-5 4V5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /><path d="M19 8h2v13l-5-3h-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
