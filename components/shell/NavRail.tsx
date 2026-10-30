"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
  { href: "/trending", label: "热搜榜", symbol: "#" },
  { href: "/discover", label: "发现", symbol: "◫" },
  { href: "/stickers", label: "贴纸", symbol: "▧" },
];

export function NavRail() {
  const pathname = usePathname();

  return (
    <nav aria-label="主导航" className="bottom-tabs border-t border-ink/10 bg-card">
      <ul className="grid grid-cols-3 gap-2 px-3 py-2">
        {navigation.map((item) => {
          const active = pathname === item.href;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors duration-200 ${active ? "bg-accent/10 text-accent" : "text-ink hover:bg-background"}`}
              >
                <span aria-hidden="true" className="w-5 text-center text-xl">{item.symbol}</span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
