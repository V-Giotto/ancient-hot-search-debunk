import { PixelIcon, type PixelIconSize } from "@/components/pixel/PixelIcon";
export type StatusIconName = "burst" | "flame" | "spark" | "verified" | "refuted";

export function StatusIcon({ name, size = 16, className }: { name: StatusIconName; size?: PixelIconSize; className?: string }) {
  return <PixelIcon name={name} size={size} data-status-icon={name} className={className} />;
}
