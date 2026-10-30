import type { Sticker } from "@/lib/stickers";

export function StickerBadge({ sticker, unlocked }: { sticker: Sticker; unlocked: boolean }) {
  return <span aria-hidden="true" className={`sticker-badge ${unlocked ? "sticker-unlocked" : "sticker-locked"}`}>{unlocked ? sticker.mark : "？"}</span>;
}
