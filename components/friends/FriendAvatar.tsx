import type { FriendProfile } from "@/lib/friend-schema";

export function FriendAvatar({ friend, className = "" }: { friend: Pick<FriendProfile, "name" | "avatarUrl">; className?: string }) {
  // 列表仅两张，聊天中复用同一缓存图片；及时显示，并预留方形尺寸防止布局偏移。
  return <img src={friend.avatarUrl} alt={friend.name} width={64} height={64} loading="eager" decoding="async" className={`friend-avatar ${className}`} />;
}
