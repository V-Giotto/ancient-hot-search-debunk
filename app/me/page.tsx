import type { Metadata } from "next";
import { Suspense } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { MeTabs } from "@/components/me/MeTabs";
import { getSticker } from "@/lib/stickers";
import { getAvailableTopics as getAllTopics } from "@/lib/topics";
import { getAvailableFeedEntries as getAllFeedEntries } from "@/lib/feed";
import { getAllFriends, toFriendProfile } from "@/lib/friends";
import { FriendDirectory } from "@/components/friends/FriendDirectory";

export const metadata: Metadata = { title: "我的" };

export default function MePage() {
  const topics = getAllTopics();
  return <AppShell title="我的"><div className="me-page"><h1>我的</h1><p className="me-intro">留住想再读的见闻，也看看一路收集的贴纸。</p>
    <FriendDirectory friends={getAllFriends().map(toFriendProfile)} />
    <Suspense fallback={<p role="status">正在打开我的收藏与贴纸…</p>}>
      <MeTabs
        stickers={topics.map((topic) => getSticker(topic.id))}
        firstTopicId={topics.find((topic) => topic.rank === 1)?.id}
        topics={getAllFeedEntries().map(({ id, title, module }) => ({ id, title, module }))}
      />
    </Suspense>
  </div></AppShell>;
}
