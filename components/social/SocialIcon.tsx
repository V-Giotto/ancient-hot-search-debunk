export type SocialIconName = "reply" | "repost" | "like" | "views" | "bookmark";

/** 项目原创线性图标，仅表达统计含义，无品牌素材。 */
export function SocialIcon({ name }: { name: SocialIconName }) {
  return <svg data-social-icon={name} aria-hidden="true" focusable="false" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    {name === "reply" && <path d="M8 18.5 4.5 21v-5A7.6 7.6 0 0 1 3 11.5C3 7.4 6.8 4 11.5 4S20 7.4 20 11.5 16.2 19 11.5 19a10 10 0 0 1-3.5-.5Z" />}
    {name === "repost" && <><path d="M4 10V7a2 2 0 0 1 2-2h12m-3-3 3 3-3 3M20 14v3a2 2 0 0 1-2 2H6m3-3-3 3 3 3" /><path d="m4 13 2 2m14-4-2-2" /></>}
    {name === "like" && <path d="M12 20s-8-4.7-8-10a4.5 4.5 0 0 1 8-2.7A4.5 4.5 0 0 1 20 10c0 5.3-8 10-8 10Z" />}
    {name === "bookmark" && <path d="M6 3h12v18l-6-4-6 4V3Z" />}
    {name === "views" && <><path d="M4 20h16M6 16v-4m6 4V5m6 11V9" /><path d="M5 8h2m4-6h2m4 4h2" /></>}
  </svg>;
}
