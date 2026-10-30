import { z } from "zod";

// 标签对应核心主张的历史背景；跨时代标签取最早时期的序号，不取证据年代。
export const ERA_ORDER = { 春秋: 1, 春秋战国: 1, 战国: 2, 汉: 3, 唐代: 4, 北宋: 5 } as const;

export const EraSchema = z.strictObject({
  label: z.enum(["春秋", "春秋战国", "战国", "汉", "唐代", "北宋"]),
  order: z.number().int().positive(),
}).refine((era) => era.order === ERA_ORDER[era.label], {
  path: ["order"], message: "时代标签与比较序号不一致",
});
export type Era = z.infer<typeof EraSchema>;

export function isLaterEra(topicEra: Era, friendEra: Era): boolean {
  return topicEra.order > friendEra.order;
}
