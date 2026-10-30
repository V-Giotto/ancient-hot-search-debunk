"use client";

import { PixelIcon } from "@/components/pixel/PixelIcon";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
  { href: "/trending", label: "热搜榜", icon: "trending" },
  { href: "/discover", label: "发现", icon: "discover" },
  { href: "/friends", label: "好友", icon: "friends" },
  { href: "/me", label: "我的", icon: "me" },
] as const;

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
                <PixelIcon name={item.icon} />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
