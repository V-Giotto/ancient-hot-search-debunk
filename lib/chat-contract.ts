import { z } from "zod";

export const CHAT_MESSAGE_MAX_LENGTH = 200;
export const CHAT_HISTORY_MAX_LENGTH = 12;
export const CHAT_REPLY_MAX_LENGTH = 1200;
export const CHAT_MAX_TOKENS = 1200;
export const CHAT_RETRY_MAX_TOKENS = 2400;

export const ChatHistoryEntrySchema = z.discriminatedUnion("role", [
  z.strictObject({ role: z.literal("user"), content: z.string().trim().min(1).max(CHAT_MESSAGE_MAX_LENGTH) }),
  z.strictObject({ role: z.literal("assistant"), content: z.string().trim().min(1).max(CHAT_REPLY_MAX_LENGTH) }),
]);
export const ChatRequestSchema = z.strictObject({
  friendId: z.string().regex(/^[a-z][a-z0-9-]{0,47}$/),
  message: z.string().trim().min(1).max(CHAT_MESSAGE_MAX_LENGTH),
  sharedTopicId: z.string().regex(/^H\d{2,3}$/).optional(),
  history: z.array(ChatHistoryEntrySchema).max(CHAT_HISTORY_MAX_LENGTH).default([]),
});
// 上游可能附带额外字段；对外仍只保留经过校验的 reply。
export const ChatResponseSchema = z.object({ reply: z.string().trim().min(1).max(CHAT_REPLY_MAX_LENGTH) });
export type ChatHistoryEntry = z.infer<typeof ChatHistoryEntrySchema>;

export function chatErrorMessage(status: number): string {
  if (status === 503) return "好友暂时不在线，稍后再来聊聊吧。你的消息还在输入框里。";
  if (status === 429) return "消息发得有些快啦，请稍等一分钟再试。";
  if (status === 504) return "好友回复得有点慢，请稍后重试。你的消息已保留。";
  if (status === 400) return "请发送 1–200 字的消息，对话历史最多 12 条。";
  if (status === 409) return "这条内容尚未完成审核，暂时不能与好友聊它。";
  if (status === 404) return "这位好友还没加入，先回好友列表看看吧。";
  return "暂时没能收到好友的回复，请稍后重试。你的消息已保留。";
}
