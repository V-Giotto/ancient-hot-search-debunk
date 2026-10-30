import type { Sticker } from "@/lib/stickers";
import { PixelSticker } from "@/components/pixel/PixelSticker";

export function StickerBadge({ sticker, unlocked }: { sticker: Sticker; unlocked: boolean }) {
  return <span aria-hidden="true" className={`sticker-badge ${unlocked ? "sticker-unlocked" : "sticker-locked"}`}><PixelSticker id={sticker.id} unlocked={unlocked} /></span>;
}
