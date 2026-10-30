export const SOCIAL_KEY = "ahsd:social:v1";
export const SOCIAL_UPDATED_EVENT = "ahsd:social-updated";
export type TopicInteraction = { liked: boolean; saved: boolean };
export type SocialState = Record<string, TopicInteraction>;
export const emptyInteraction: TopicInteraction = { liked: false, saved: false };
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);

/** v0 / 无版本旧 map 可迁移；逐项修复坏值，不信任未来版本或任意对象键。 */
export function parseSocialStorage(raw: string | null): SocialState {
  try {
    const value: unknown = JSON.parse(raw || "null");
    if (!isRecord(value) || (value.version !== undefined && value.version !== 0 && value.version !== 1)) return {};
    const topics = value.version === undefined ? value : value.topics;
    if (!isRecord(topics)) return {};
    return Object.fromEntries(Object.entries(topics).filter(([id, entry]) => /^H\d{2,3}$/.test(id) && isRecord(entry))
      .slice(0, 200).map(([id, entry]) => {
        const item = entry as Record<string, unknown>;
        return [id, { liked: item.liked === true, saved: item.saved === true || (value.version !== 1 && item.bookmarked === true) }];
      }));
  } catch { return {}; }
}
export function readSocialState(): SocialState {
  try { return parseSocialStorage(window.localStorage.getItem(SOCIAL_KEY)); } catch { return {}; }
}
export function writeSocialState(topics: SocialState): boolean {
  try {
    window.localStorage.setItem(SOCIAL_KEY, JSON.stringify({ version: 1, topics }));
    window.dispatchEvent(new Event(SOCIAL_UPDATED_EVENT));
    return true;
  } catch { return false; }
}
export function interactionCount(base: number, active: boolean): number { return base + Number(active); }
export function favoriteTopics<T extends { id: string }>(topics: readonly T[], state: SocialState): T[] {
  return topics.filter((topic) => state[topic.id]?.saved);
}
