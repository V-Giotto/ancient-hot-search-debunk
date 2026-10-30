import { z } from "zod";

const text = (max: number) => z.string().trim().min(1).max(max);
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);

// 头像由本项目原创 SVG 绘制；数据只配置纹样和颜色，不执行 SVG/HTML 字符串。
export const FriendSchema = z.strictObject({
  id: z.string().regex(/^[a-z][a-z0-9-]{0,47}$/),
  name: text(24),
  avatar: z.strictObject({ motif: z.enum(["moon", "reeds"]), paper: color, ink: color, accent: color }),
  bio: text(100),
  greeting: text(200),
  sourceIds: z.array(text(100)).min(1).max(16).refine((ids) => new Set(ids).size === ids.length, "来源 ID 不能重复"),
  // 这里只描述口吻；史实必须来自 sourceIds 对应的 reviewed supports。
  persona: z.array(text(200)).min(1).max(12),
});

export type Friend = z.infer<typeof FriendSchema>;
export type FriendProfile = Pick<Friend, "id" | "name" | "avatar" | "bio" | "greeting">;
