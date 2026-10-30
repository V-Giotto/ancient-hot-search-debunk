import { SocialIcon, type SocialIconName } from "./SocialIcon";
import { compactCount } from "@/lib/social-display";

export type SocialCounts = { replies: number; reposts: number; likes: number; views: number };
const metrics: { key: keyof SocialCounts; label: string; icon: SocialIconName }[] = [
  { key: "replies", label: "回复", icon: "reply" },
  { key: "reposts", label: "转发", icon: "repost" },
  { key: "likes", label: "点赞", icon: "like" },
  { key: "views", label: "浏览", icon: "views" },
];

export function SocialStats({ counts, label = "互动统计" }: { counts: SocialCounts; label?: string }) {
  return <dl className="social-stats" aria-label={label}>
    {metrics.map(({ key, label: metricLabel, icon }) => <div key={key} className="social-stat">
      <dt><SocialIcon name={icon} size={16} /><span className="sr-only">{metricLabel}</span></dt>
      <dd title={counts[key].toLocaleString("zh-CN")} aria-label={counts[key].toLocaleString("zh-CN")}>{compactCount(counts[key])}</dd>
    </div>)}
  </dl>;
}
