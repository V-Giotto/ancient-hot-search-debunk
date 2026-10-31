import Link from "next/link";
import { PixelIcon } from "@/components/pixel/PixelIcon";
import { DISCOVER_TAGLINE } from "@/lib/copy";

export function DiscoverHeader() {
  return <header className="discover-hero">
    <img className="discover-banner" src="/banners/discover-night.webp" alt="" width={1200} height={675} fetchPriority="high" />
    <div className="discover-title-row">
      <Link href="/trending" aria-label="返回热搜榜" className="shell-back"><PixelIcon name="back" size={32} /></Link>
      <h1>发现</h1>
    </div>
    <p className="discover-tagline">{DISCOVER_TAGLINE}</p>
  </header>;
}
