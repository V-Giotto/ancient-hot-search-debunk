import { authorHandle } from "@/lib/social-display";

export function AuthorRow({ name, avatarUrl, relativeTime }: { name: string; avatarUrl?: string; relativeTime: string }) {
  return <div className="author-row">
    {avatarUrl ? <img src={avatarUrl} alt={`${name}头像`} width={42} height={42} className="author-avatar" /> : <span aria-hidden="true" className="author-avatar author-initial">{name.slice(0, 1)}</span>}
    <div className="author-identity">
      <p className="author-name">{name}</p>
      <p className="author-meta"><span className="author-handle">{authorHandle(name)}</span><span aria-hidden="true">·</span><span className="author-time">{relativeTime}</span></p>
    </div>
  </div>;
}
