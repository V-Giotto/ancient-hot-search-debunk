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
      <svg viewBox="0 0 96 80" fill="none" aria-hidden="true" focusable="false"><path d="m12 28 53-15 20 43-55 13Z" stroke="currentColor" strokeWidth="1.5" /><path d="m13 28 38 19 14-34M30 69l13-26m42 13L58 42" stroke="currentColor" strokeWidth="1.5" /><circle cx="52" cy="46" r="4" fill="currentColor" /></svg>
    </section>
    <div className="friends-list-heading"><h2>我的好友</h2><span>{friends.length} 位</span></div>
    <ul className="friends-list" aria-label="好友列表">
      {friends.map((friend) => <li key={friend.id}>
        <Link href={`/friends/${friend.id}`} className="friend-card" aria-label={`与${friend.name}对话`}>
          <FriendAvatar friend={friend} />
          <div className="friend-card-copy"><h3>{friend.name}</h3><p>{friend.bio}</p><span>开始对话 <span aria-hidden="true">↗</span></span></div>
        </Link>
      </li>)}
    </ul>
    <p className="friends-footnote">一段闲谈，从一句“你来了”开始。</p>
  </AppShell>;
}
