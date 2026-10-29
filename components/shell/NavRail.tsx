"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
  { href: "/trending", label: "热搜榜", symbol: "#" },
  { href: "/discover", label: "发现", symbol: "◫" },
];

export function NavRail() {
  const pathname = usePathname();

  return (
    <nav aria-label="主导航" className="shell-sticky-rail min-w-0 rounded-2xl border border-ink/5 bg-card p-4">
      <p className="px-4 pt-2 pb-4 text-xs tracking-widest text-muted">跨时空围观指南</p>
      <ul className="space-y-2">
        {navigation.map((item) => {
          const active = pathname === item.href;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors duration-200 ${active ? "bg-accent/10 text-accent" : "text-ink hover:bg-background"}`}
              >
                <span aria-hidden="true" className="w-5 text-center text-xl">{item.symbol}</span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="mt-6 border-t border-ink/5 px-4 pt-5 pb-2 text-xs leading-6 text-muted">
        热度是模拟的，<br />对历史的好奇是真的。
      </p>
    </nav>
  );
}
