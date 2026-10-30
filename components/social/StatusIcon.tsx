export type StatusIconName = "burst" | "flame" | "spark" | "verified" | "refuted";

// 原创线性图标；旁边的文字提供名称，图形提供不依赖颜色的第二种提示。
export function StatusIcon({ name, size = 16, className }: { name: StatusIconName; size?: number; className?: string }) {
  return <svg data-status-icon={name} aria-hidden="true" focusable="false" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
    {name === "burst" && <path d="m12 2 2.5 5.5L20 5l-2 6 4 3-6 1 .5 6-4.5-4-4.5 4 .5-6-6-1 4-3-2-6 5.5 2.5Z" />}
    {name === "flame" && <path d="M13 2c1 6-5 7-5 11 0 2 1.5 3 3 3-1-3 2-4 3-6 3 3 5 5 5 8a7 7 0 0 1-14 0C3 11 11 9 13 2Z" />}
    {name === "spark" && <path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5Z" />}
    {(name === "verified" || name === "refuted") && <circle cx="12" cy="12" r="9" />}
    {name === "verified" && <path d="m7.5 12 3 3 6-6" />}
    {name === "refuted" && <path d="m8.5 8.5 7 7m0-7-7 7" />}
  </svg>;
}
