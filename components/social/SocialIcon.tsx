import { PixelIcon, type PixelIconSize } from "@/components/pixel/PixelIcon";
export type SocialIconName = "reply" | "repost" | "like" | "views" | "bookmark";

export function SocialIcon({ name, filled = false, size = 20 }: { name: SocialIconName; filled?: boolean; size?: PixelIconSize }) {
  const icon = filled && (name === "like" || name === "bookmark") ? `${name}Filled` as const : name;
  return <PixelIcon name={icon} size={size} data-social-icon={name} className={filled ? "pixel-icon-selected" : ""} />;
}
