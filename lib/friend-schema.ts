import { z } from "zod";

const text = (max: number) => z.string().trim().min(1).max(max);
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const traits = z.array(text(200)).min(1).max(12);

export const FriendPersonaSchema = z.strictObject({
  // 首项用于服务端兜底自称，只接受汉字，避免夹带括号、引号或指令。
  selfReference: z.array(text(12).regex(/^[\p{Script=Han}]+$/u)).min(1).max(4)
    .refine((values) => new Set(values).size === values.length, "自称不能重复"),
  personality: traits,
  speakingStyle: traits,
  relationships: z.array(z.strictObject({
    friendId: z.string().regex(/^[a-z][a-z0-9-]{0,47}$/),
    description: text(200),
  })).min(1).max(12),
  era: text(200),
  habits: traits,
  taboos: traits,
});

// 头像由本项目原创 SVG 绘制；数据只配置纹样和颜色，不执行 SVG/HTML 字符串。
export const FriendSchema = z.strictObject({
  id: z.string().regex(/^[a-z][a-z0-9-]{0,47}$/),
  name: text(24),
  avatar: z.strictObject({ motif: z.enum(["moon", "reeds"]), paper: color, ink: color, accent: color }),
  bio: text(100),
  greeting: text(200),
  sourceIds: z.array(text(100)).min(1).max(16).refine((ids) => new Set(ids).size === ids.length, "来源 ID 不能重复"),
  // 人设控制表达；生平事实须有已审内容依据，不能扩大 sourceIds 的事实白名单。
  persona: FriendPersonaSchema,
});

export type Friend = z.infer<typeof FriendSchema>;
export type FriendProfile = Pick<Friend, "id" | "name" | "avatar" | "bio" | "greeting">;
