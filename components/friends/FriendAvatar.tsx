import type { Friend } from "@/lib/friend-schema";

// 原创山月 / 汀草纹样，均由路径绘制，无外部图片或品牌元素。
export function FriendAvatar({ avatar, className = "" }: { avatar: Friend["avatar"]; className?: string }) {
  return <svg className={`friend-avatar ${className}`} viewBox="0 0 80 80" fill="none" aria-hidden="true" focusable="false">
    <rect width="80" height="80" rx="24" fill={avatar.paper} />
    {avatar.motif === "moon" ? <>
      <circle cx="53" cy="25" r="10" fill={avatar.accent} />
      <path d="M10 59 28 31l16 27m-12-7 10-15 28 23M10 65c18-6 39-6 60 0" stroke={avatar.ink} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m23 40 5-9 5 9m-7 22 8-12" stroke={avatar.ink} strokeWidth="1.5" strokeLinecap="round" />
    </> : <>
      <path d="M18 65c12-5 30-6 45-3M31 61c8-16 9-32 5-47m9 46c-2-14 0-25 8-36M22 57c6-6 8-13 7-21" stroke={avatar.ink} strokeWidth="2" strokeLinecap="round" />
      <path d="M36 32c-10-1-16-7-16-12 10 0 15 6 16 12Zm2 9c9-1 14-7 14-12-9 0-14 6-14 12Zm10-3c8 0 14-4 16-9-9-2-15 2-16 9Z" fill={avatar.ink} />
      <circle cx="23" cy="26" r="6" fill={avatar.accent} />
    </>}
  </svg>;
}
