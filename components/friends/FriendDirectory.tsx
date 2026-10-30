import Link from "next/link";
import type { FriendProfile } from "@/lib/friend-schema";
import { PixelIcon } from "@/components/pixel/PixelIcon";
import { FriendAvatar } from "./FriendAvatar";

export function FriendDirectory({ friends }: { friends: readonly FriendProfile[] }) {
  return <details className="me-friends">
    <summary><PixelIcon name="friends" size={20} /><span>我的好友</span><span>{friends.length} 位 · 展开聊聊</span></summary>
    <ul aria-label="我的好友" className="me-friends-grid">
      {friends.map((friend) => <li key={friend.id}><Link href={`/friends/${friend.id}`} aria-label={`与${friend.name}对话`}>
        <FriendAvatar friend={friend} /><span>{friend.name}</span>
      </Link></li>)}
    </ul>
  </details>;
}
