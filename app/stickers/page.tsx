import type { Metadata } from "next";
import { StickerWall } from "@/components/stickers/StickerWall";
import { getSticker } from "@/lib/stickers";
import { getAllTopics } from "@/lib/topics";
import { AppShell } from "@/components/shell/AppShell";

export const metadata: Metadata = { title: "贴纸档案" };

export default function StickersPage() {
  // 仅传主题徽记，不把题目的真假、解释或改写答案发送到贴纸墙。
  const topics = getAllTopics();
  const stickers = topics.map((topic) => getSticker(topic.id));
  return (
    <AppShell title="贴纸档案">
      <div className="mb-6">
        <p className="mb-2 text-xs font-medium tracking-widest text-accent">贴纸档案</p>
        <h1 className="text-2xl leading-snug font-bold">查证贴纸墙</h1>
        <p className="mt-3 text-sm leading-6 text-muted">每查证一条，留下一枚主题贴纸。答对答错都能收集，点击已收藏贴纸可重新挑战，进度不重复累计。</p>
      </div>
      <StickerWall stickers={stickers} firstTopicId={topics.find((topic) => topic.rank === 1)?.id} />
    </AppShell>
  );
}
