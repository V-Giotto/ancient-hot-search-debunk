/** 原创主题贴纸元数据；名称只描述题材，不包含史实结论。 */
export type Sticker = { id: string; name: string; mark: string };

const themes: Record<string, { name: string; mark: string }> = {
  H01: { name: "诗友手记", mark: "诗" },
  H02: { name: "街巷食记", mark: "巷" },
  H03: { name: "饭局手记", mark: "食" },
  H04: { name: "纸上手记", mark: "纸" },
  H05: { name: "釉彩手记", mark: "彩" },
  H06: { name: "器物手记", mark: "器" },
  H07: { name: "球场手记", mark: "球" },
  H08: { name: "晨间手记", mark: "晨" },
  H09: { name: "守望手记", mark: "望" },
  H10: { name: "活版手记", mark: "印" },
  H11: { name: "语录手记", mark: "言" },
  H12: { name: "兵书手记", mark: "书" },
  H13: { name: "陶俑手记", mark: "俑" },
  H14: { name: "夜市手记", mark: "夜" },
};

export function getSticker(topicId: string): Sticker {
  return { id: topicId, ...(themes[topicId] ?? { name: "话题手记", mark: "记" }) };
}
