import { z } from "zod";
import { EraSchema } from "./era";
import { FriendKnowledgeSchema, LifespanSchema } from "./friend-knowledge";

const text = (max: number) => z.string().trim().min(1).max(max);
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const traits = z.array(text(200)).min(1).max(12);

export const FriendPersonaSchema = z.strictObject({
  // 仅限通行姓名、字/号、时代和身份，不放生平轶事或作品引文。
  identity: z.strictObject({ summary: text(200), role: text(200) }),
  // 首项用于服务端兜底自称，只接受汉字，避免夹带括号、引号或指令。
  selfReference: z.array(text(12).regex(/^[\p{Script=Han}]+$/u)).min(1).max(4)
    .refine((values) => new Set(values).size === values.length, "自称不能重复"),
  personality: traits,
  speakingStyle: traits,
  relationships: z.array(z.strictObject({
    friendId: z.string().regex(/^[a-z][a-z0-9-]{0,47}$/),
    description: text(200),
  })).max(12),
  era: text(200),
  habits: traits,
  chatRules: traits,
  taboos: traits,
  examples: z.array(z.strictObject({ user: text(200), reply: text(400) })).min(2).max(6),
});

// 本地像素风头像；保留旧纹样配置以兼容历史数据，不传给客户端。
export const FriendSchema = z.strictObject({
  id: z.string().regex(/^[a-z][a-z0-9-]{0,47}$/),
  name: text(24),
  era: EraSchema,
  lifespan: LifespanSchema,
  knowledge: z.array(FriendKnowledgeSchema).max(64)
    .refine((records) => new Set(records.map(({ factId }) => factId)).size === records.length, "factId 不能重复"),
  avatarUrl: z.string().regex(/^\/friends\/[a-z][a-z0-9-]{0,47}\.webp$/),
  avatar: z.strictObject({ motif: z.enum(["moon", "reeds"]), paper: color, ink: color, accent: color }).optional(),
  bio: text(100),
  greeting: text(200),
  emojiWhitelist: z.array(z.enum(["🍶", "🌙"])).max(2)
    .refine((values) => new Set(values).size === values.length, "emoji 白名单不能重复"),
  displayOrder: z.number().int().positive(),
  personaReview: z.strictObject({ status: z.literal("pending"), reviewer: z.literal("Giotto") }),
  // 无已审人物来源时允许为空：可闲聊，不能借用其它人物的史实。
  sourceIds: z.array(text(100)).max(16).refine((ids) => new Set(ids).size === ids.length, "来源 ID 不能重复"),
  // 人设控制表达；生平事实须有已审内容依据，不能扩大 sourceIds 的事实白名单。
  persona: FriendPersonaSchema,
});

export type Friend = z.infer<typeof FriendSchema>;
export type FriendProfile = Pick<Friend, "id" | "name" | "avatarUrl" | "bio" | "greeting">;
