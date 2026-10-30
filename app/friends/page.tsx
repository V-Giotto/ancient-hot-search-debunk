
import { PixelIcon } from "@/components/pixel/PixelIcon";
import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "@/components/shell/AppShell";
import { FriendAvatar } from "@/components/friends/FriendAvatar";
import { getAllFriends } from "@/lib/friends";

export const metadata: Metadata = { title: "好友" };

export default function FriendsPage() {
  const friends = getAllFriends();
  return <AppShell title="好友">
    <section className="friends-intro">
      <p className="friends-eyebrow">尺素之间 · 有人可聊</p>
      <h1>见字如面</h1>
      <p>从热搜里的旧事，聊到眼前的小事。<br />选一位好友，坐下来聊聊。</p>
      <PixelIcon name="mail" size={32} />
    </section>
    <div className="friends-list-heading"><h2>我的好友</h2><span>{friends.length} 位</span></div>
    <ul className="friends-list" aria-label="好友列表">
      {friends.map((friend) => <li key={friend.id}>
        <Link href={`/friends/${friend.id}`} className="friend-card" aria-label={`与${friend.name}对话`}>
          <FriendAvatar friend={friend} />
          <div className="friend-card-copy"><h3>{friend.name}</h3><p>{friend.bio}</p><span>开始对话 <PixelIcon name="external" size={16} /></span></div>
        </Link>
      </li>)}
    </ul>
    <p className="friends-footnote">一段闲谈，从一句“你来了”开始。</p>
  </AppShell>;
}
