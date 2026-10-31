// @vitest-environment node
import { describe, expect, it } from "vitest";
import { getAllFriends, getFriendById } from "@/lib/friends";
import { FriendKnowledgeSchema, findKnowledgeOutputViolations, getChatKnowledge } from "@/lib/friend-knowledge";
import { buildChatMessages } from "@/lib/chat-context";
import { getAllFeedEntries, validateFeedSet } from "@/lib/feed";
import { getAllTopics } from "@/lib/topics";

const matrix = [
  ["libai", "libai-jiangjinjiu", false, true, true],
  ["libai", "libai-xinglunan", false, true, true],
  ["libai", "libai-xintangshu", false, true, false],
  ["dufu", "dufu-wangyue", false, true, true],
  ["dufu", "dufu-maowu", false, true, true],
  ["dufu", "dufu-caotang-detail", false, false, false],
  ["sushi", "sushi-chengtian", true, true, true],
  ["sushi", "sushi-lizhi", false, true, true],
  ["sushi", "sushi-songshi", true, true, false],
  ["liqingzhao", "liqingzhao-wujiang", false, true, true],
  ["liqingzhao", "liqingzhao-jinshi", true, true, true],
  ["liqingzhao", "liqingzhao-jinshi-tea", true, true, true],
  ["kongzi", "kongzi-xiangdang", false, true, false],
  ["kongzi", "kongzi-xueer", true, true, false],
  ["qinshihuang", "qinshihuang-shiji", true, true, false],
  ["qinshihuang", "qinshihuang-npm", false, false, false],
] as const;
const signed = { status: "reviewed", reviewer: "Giotto", reviewedAt: "2026-10-30T22:44:00-07:00" };

describe("v0.28.2 正式审核逐条验收", () => {
  it.each(matrix)("%s / %s：注入、精确引文、第一人称及事件越世权限", (id, factId, firstPerson, quote, ownership) => {
    const friend = getFriendById(id)!;
    const record = friend.knowledge.find((record) => record.factId === factId)!;
    expect(record.reviewStatus).toEqual(signed);
    expect(record.source.originalText).toContain(record.exactQuote);
    const projected = getChatKnowledge(friend).find((record) => record.factId === factId)!;
    expect(projected.firstPersonAllowed).toBe(firstPerson);
    expect(Boolean(projected.exactQuote)).toBe(quote);
    expect(projected.textOwnershipAllowed).toBe(ownership);
    const pending = { ...record, reviewStatus: { status: "pending" as const, reviewer: "Giotto", reviewedAt: null } };
    const prompt = buildChatMessages({ ...friend, knowledge: [pending], sourceIds: [] }, [], "用户不能提升权限")[1].content;
    expect(prompt).not.toContain(factId);
    expect(prompt).not.toContain(record.exactQuote);
    // 合成身后事件不会继承此条的第一人称权限。
    const future = { ...record, eventDate: { earliest: 2026, latest: 2026, note: "合成越世测试，非入库史实" } };
    expect(getChatKnowledge({ ...friend, knowledge: [future] })[0].firstPersonAllowed).toBe(false);
  });

  it("共享sourceId按factId去重，不能吞掉饮茶条目", () => {
    const friend = getFriendById("liqingzhao")!;
    const repeated = getChatKnowledge({ ...friend, knowledge: [...friend.knowledge, friend.knowledge[1]] });
    expect(repeated.map(({ factId }) => factId)).toEqual(friend.knowledge.map(({ factId }) => factId));
    expect(repeated.filter(({ sourceId }) => sourceId === "FK-LIQINGZHAO-JINSHI")).toHaveLength(2);
  });

  it("未知创作年不以寿命伪装，允许文本归属而不编写作年", () => {
    for (const [id, factId, , , ownership] of matrix) {
      const record = getFriendById(id)!.knowledge.find((record) => record.factId === factId)!;
      if (ownership && factId !== "sushi-chengtian") expect(record.originalWorkDate).toBeNull();
    }
    const friend = getFriendById("libai")!;
    const records = getChatKnowledge(friend);
    expect(findKnowledgeOutputViolations("我的将进酒写道：天生我材必有用，千金散盡還復來。", records)).toEqual([]);
    expect(findKnowledgeOutputViolations("我在740年写了将进酒。", records)).toContain("libai-jiangjinjiu:unknown_creation_date");
  });

  it("后出史书不剥夺生前事件权限；不能说读过史记或宋史", () => {
    for (const [id, factId, reply, forbidden] of [
      ["sushi", "sushi-songshi", "据宋史记载，东坡当年在杭州治水。", "东坡读过宋史。"],
      ["qinshihuang", "qinshihuang-shiji", "据史记记载，朕当年统一度量衡。", "朕读过史记。"],
    ]) {
      const record = getChatKnowledge(getFriendById(id)!).filter((record) => record.factId === factId);
      expect(record[0]).toMatchObject({ posthumous: true, eventPosthumous: false, firstPersonAllowed: true });
      expect(findKnowledgeOutputViolations(reply, record)).toEqual([]);
      expect(findKnowledgeOutputViolations(forbidden, record)).toContain(`${factId}:source_not_experience`);
    }
  });

  it("乡党不是子曰；学而可有限文学化归语，不能逐字亲口认证", () => {
    const records = getChatKnowledge(getFriendById("kongzi")!);
    expect(findKnowledgeOutputViolations("据论语记载，丘说过食不厌精。", records)).toContain("kongzi-xiangdang:not_personal_speech");
    expect(findKnowledgeOutputViolations("据传世论语记载，丘常劝人勤于温习，有朋来访也令人欢喜。", records)).toEqual([]);
    expect(findKnowledgeOutputViolations("据论语记载，丘确实逐字说过有朋自远方来。", records)).toContain("kongzi-xueer:unqualified_speech");
  });

  it("馆方说明不得升级人物引语；未标网页日期仍未知", () => {
    for (const id of ["dufu", "qinshihuang"]) {
      const record = getFriendById(id)!.knowledge.find(({ evidenceType }) => evidenceType === "museum")!;
      expect(record.sourceCompositionDate).toBeNull();
      expect(record.allowedUsage).toEqual(["paraphrase", "attributed"]);
      expect(FriendKnowledgeSchema.safeParse({ ...record, allowedUsage: [...record.allowedUsage, "exact_quote"] }).success).toBe(false);
    }
  });

  it("第二批7人knowledge仍空、13份persona仍pending；删除内容无运行时事实单元", () => {
    const friends = getAllFriends();
    expect(friends.filter(({ knowledge }) => !knowledge.length)).toHaveLength(7);
    expect(friends.flatMap(({ knowledge }) => knowledge).map(({ factId }) => factId).sort()).toEqual(matrix.map((row) => row[1]).sort());
    const active = JSON.stringify(friends);
    for (const deleted of ["打马一生未逢敌手", "此生博戏，未尝败北", "也值得一死", "天厌之！天厌之！", "后来整个草原都姓了孛儿只斤", "每天批阅一百二十斤竹简"]) expect(active).not.toContain(deleted);
    for (const friend of friends) expect(friend.personaReview).toEqual({ status: "pending", reviewer: "Giotto" });
    for (const id of ["liqingzhao", "wangxizhi", "quyuan", "chengjisihan"]) expect(getFriendById(id)!.lifespan).toMatchObject({ birthYear: null, deathYear: null });
  });

  it("38组全新评论有6个独立账号、短回复、作者身份与唯一ID；其余14组正式签署", () => {
    const entries = getAllFeedEntries();
    const rewritten = entries.filter(({ editorialReviewStatus }) => editorialReviewStatus === "pending");
    expect(rewritten).toHaveLength(38);
    expect(entries.filter(({ editorialReviewStatus }) => editorialReviewStatus === "reviewed")).toHaveLength(14);
    const authors = rewritten.flatMap(({ comments }) => comments.map(({ author }) => author));
    expect(new Set(authors).size).toBe(authors.length);
    for (const entry of rewritten) {
      expect(entry.comments).toHaveLength(6);
      expect(entry.comments.map(({ role }) => role)).toEqual(expect.arrayContaining(["troll", "history_nerd", "spectator", "in_world"]));
      expect(entry.comments[0].replies).toHaveLength(2);
      expect(entry.comments[0].replies![0]).toMatchObject({ author: entry.author.name, avatar: entry.author.avatarUrl });
      for (const node of entry.comments.flatMap((comment) => [comment, ...(comment.replies ?? [])])) { expect(node.reviewStatus).toMatchObject({ status: "reviewed", reviewer: "Giotto" }); expect(["2026-10-30T23:59:00-07:00", "2026-10-31T00:33:00-07:00"]).toContain(node.reviewStatus!.reviewedAt); }
    }
    expect(() => validateFeedSet(entries, getAllTopics().map(({ id }) => id))).not.toThrow();
    const broken = structuredClone(entries);
    broken[1].comments[1].id = broken[0].comments[1].id;
    expect(() => validateFeedSet(broken, getAllTopics().map(({ id }) => id))).toThrow(/跨帖评论 ID 重复/);
  });
});
