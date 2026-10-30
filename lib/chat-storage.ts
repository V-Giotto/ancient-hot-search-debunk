import { z } from "zod";
import { ChatHistoryEntrySchema, type ChatHistoryEntry } from "./chat-contract";
export const CHAT_STORAGE_MAX_ENTRIES = 60;
export const chatStorageKey = (friendId: string) => `ahsd:chat:v1:${friendId}`;
export const SharedTopicSchema = z.strictObject({ id: z.string().regex(/^H\d{2,3}$/), title: z.string().min(1).max(200), module: z.enum(["trending", "discover"]) });
export type SharedTopic = z.infer<typeof SharedTopicSchema>;
const ShareEntrySchema = z.strictObject({ role: z.literal("share"), id: z.string().min(1).max(100), topic: SharedTopicSchema, status: z.enum(["pending", "offline", "answered", "failed"]) });
export type ShareEntry = z.infer<typeof ShareEntrySchema>;
export type StoredChatEntry = ChatHistoryEntry | ShareEntry;
const EntrySchema = z.union([ChatHistoryEntrySchema, ShareEntrySchema]);
export function parseChatStorage(raw: string | null): StoredChatEntry[] {
  try {
    const value = JSON.parse(raw || "null");
    // 兼容旧版未包装的消息数组和 v0；逐条丢弃损坏内容。
    const entries: unknown = Array.isArray(value) ? value : value && [0, 1].includes(value.version) ? value.entries : [];
    if (!Array.isArray(entries)) return [];
    return entries.slice(-CHAT_STORAGE_MAX_ENTRIES).flatMap((entry) => {
      const parsed = EntrySchema.safeParse(entry);
      return parsed.success ? [parsed.data] : [];
    });
  } catch { return []; }
}
export function readChatHistory(friendId: string): StoredChatEntry[] {
  try { return parseChatStorage(window.localStorage.getItem(chatStorageKey(friendId))); } catch { return []; }
}
export function saveChatHistory(friendId: string, entries: StoredChatEntry[]): boolean {
  try {
    window.localStorage.setItem(chatStorageKey(friendId), JSON.stringify({ version: 1, entries: entries.slice(-CHAT_STORAGE_MAX_ENTRIES) }));
    return true;
  } catch { return false; }
}
