// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import sourceIndex from "@/data/source-index.json";
import {
  CommentSchema,
  HotTopicSchema,
  ReviewStatusSchema,
  RewriteOptionSchema,
  SourceSchema,
  TopicProgressSchema,
} from "@/lib/schemas";
import { getAllTopics, validateContentSet } from "@/lib/topics";
import { toPublicTopic } from "@/lib/public-topic";
import { makeSource, makeTopic, makeTopics } from "./fixtures";

const sources = [makeSource()];

describe("validateContentSet：当前题目的完整性规则", () => {
  it("接受阶段 A 的空题库及空来源索引", () => {
    expect(() => validateContentSet([], [], { expectedCount: 0 })).not.toThrow();
  });

  it("接受字段完整的单条 pending 话题，不要求凑满十二条", () => {
    expect(() => validateContentSet([makeTopic()], sources, { expectedCount: 1 })).not.toThrow();
  });

  it("默认按当前题目数量验证，不强制部分题库真假平衡", () => {
    expect(() => validateContentSet(makeTopics(3, 0), sources)).not.toThrow();
  });

  it("接受顺序打乱但排名连续的题库", () => {
    expect(() => validateContentSet(makeTopics(3).reverse(), sources)).not.toThrow();
  });

  it("拒绝重复话题 id，即使排名不同", () => {
    const topics = makeTopics(2);
    topics[1].id = topics[0].id;
    expect(() => validateContentSet(topics, sources)).toThrow(/话题 id 重复/);
  });

  it("拒绝重复 rank，即使 id 不同", () => {
    const topics = makeTopics(2);
    topics[1].rank = 1;
    expect(() => validateContentSet(topics, sources)).toThrow(/rank 重复/);
  });

  it.each([0, -1, 1.5, Number.NaN])("拒绝无效排名 %s", (rank) => {
    expect(() => validateContentSet([makeTopic({ rank })], sources)).toThrow();
  });

  it.each([[2, 3], [1, 3], [1, 9]])("拒绝不从 1 连续排列的 rank：%j", (first, second) => {
    const topics = makeTopics(2);
    topics[0].rank = first;
    topics[1].rank = second;
    expect(() => validateContentSet(topics, sources)).toThrow(/rank 必须从 1 连续排列/);
  });

  it.each(["title", "claim", "coverUrl"] as const)("拒绝空白 %s", (field) => {
    for (const value of ["", " \n\t "]) {
      const topic = makeTopic({ [field]: value });
      expect(() => validateContentSet([topic], sources)).toThrow();
    }
  });

  it.each([undefined, null, {}])("拒绝缺失或不完整的 reveal：%j", (reveal) => {
    expect(() => validateContentSet([{ ...makeTopic(), reveal }], sources)).toThrow();
  });

  it.each([
    "verdictHeadline", "shortExplanation", "detailedExplanation", "correctedClaim", "funFact",
  ] as const)("拒绝 reveal.%s 为空白", (field) => {
    const topic = makeTopic();
    topic.reveal[field] = " \t ";
    expect(() => validateContentSet([topic], sources)).toThrow();
  });

  it.each(["aiFacts", "sourceIds"] as const)("拒绝空 %s 或空白数组项", (field) => {
    for (const value of [[], [""], [" \n "]]) {
      expect(() => validateContentSet([makeTopic({ [field]: value })], sources)).toThrow();
    }
  });

  it("拒绝少于 6 条评论", () => {
    const topic = makeTopic();
    topic.comments.pop();
    expect(() => validateContentSet([topic], sources)).toThrow(/至少需要 6 条评论/);
  });

  it("拒绝数量足够但含空白文本的评论", () => {
    const topic = makeTopic();
    topic.comments[5].text = " \n ";
    expect(() => validateContentSet([topic], sources)).toThrow();
  });

  it("接受超过 6 条有内容的评论", () => {
    const topic = makeTopic();
    topic.comments.push({ ...topic.comments[0], id: "COMMENT-7" });
    expect(() => validateContentSet([topic], sources)).not.toThrow();
  });

  it("拒绝任意未知 sourceId，错误说明话题与来源", () => {
    const topic = makeTopic({ sourceIds: ["TEST-SOURCE", "MISSING"] });
    expect(() => validateContentSet([topic], sources)).toThrow(/TEST-1 的 sourceId 不存在：MISSING/);
  });

  it("有话题时不能使用空来源索引", () => {
    expect(() => validateContentSet([makeTopic()], [])).toThrow(/sourceId 不存在/);
  });

  it("接受已存在的多个来源", () => {
    const topic = makeTopic({ sourceIds: ["TEST-SOURCE", "SECOND"] });
    expect(() => validateContentSet([topic], [...sources, makeSource({ id: "SECOND" })])).not.toThrow();
  });

  it("拒绝来源索引中重复的 id，避免关联歧义", () => {
    expect(() => validateContentSet([makeTopic()], [makeSource(), makeSource()])).toThrow(/来源 id 重复/);
  });

  it.each([0, 1, 2, 4])("拒绝 %i 个改写选项", (count) => {
    const topic = makeTopic();
    topic.rewriteOptions = Array.from({ length: count }, (_, index) => ({
      ...topic.rewriteOptions[0], id: String(index), isBest: index === 0,
    }));
    expect(() => validateContentSet([topic], sources)).toThrow(/恰好有 3 个改写选项/);
  });

  it.each([0, 2, 3])("拒绝 %i 个 isBest: true", (bestCount) => {
    const topic = makeTopic();
    topic.rewriteOptions.forEach((option, index) => { option.isBest = index < bestCount; });
    expect(() => validateContentSet([topic], sources)).toThrow(/恰好有 1 个 isBest/);
  });

  it.each([0, 1, 2])("接受唯一正确选项位于索引 %i", (bestIndex) => {
    const topic = makeTopic();
    topic.rewriteOptions.forEach((option, index) => { option.isBest = index === bestIndex; });
    expect(() => validateContentSet([topic], sources)).not.toThrow();
  });

  it("按 12 条真实题目启用 expectedCount=12 与真假 6:6 校验", () => {
    const topics = getAllTopics();
    expect(() => validateContentSet(topics, sourceIndex, { expectedCount: 12 })).not.toThrow();
    expect(topics.filter((topic) => !topic.isTrue).map((topic) => topic.id)).toEqual(["H01", "H03", "H05", "H07", "H11", "H12"]);
    expect(topics.filter((topic) => topic.isTrue).map((topic) => topic.id)).toEqual(["H02", "H04", "H06", "H08", "H09", "H10"]);
  });

  it("真实题库缺项或破坏 6:6 时校验失败", () => {
    const topics = getAllTopics();
    expect(() => validateContentSet(topics.slice(0, 11), sourceIndex, { expectedCount: 12 })).toThrow(/题目数量应为 12/);
    const unbalanced = topics.map((topic) => topic.id === "H06" ? { ...topic, isTrue: false } : topic);
    expect(() => validateContentSet(unbalanced, sourceIndex, { expectedCount: 12 })).toThrow(/真假比例必须为 6:6/);
  });

  it("阶段6扩至 H01–H12，排名连续，题目及来源全部 pending 且没有审核签名", () => {
    const topics = getAllTopics();
    expect(topics.map((topic) => [topic.id, topic.rank, topic.isTrue])).toEqual([
      ["H01", 1, false], ["H02", 2, true], ["H03", 3, false], ["H04", 4, true],
      ["H05", 5, false], ["H06", 6, true], ["H07", 7, false], ["H08", 8, true],
      ["H09", 9, true], ["H10", 10, true], ["H11", 11, false], ["H12", 12, false],
    ]);
    expect(topics.every((topic) => topic.reviewStatus === "pending")).toBe(true);
    expect(sourceIndex.map((source) => source.id)).toEqual([
      "S-H01-01", "S-H01-02", "S-H02-01", "S-H02-02", "S-H02-03",
      "S-H03-01", "S-H03-02", "S-H03-03", "S-H04-01", "S-H04-02", "S-H04-03",
      "S-H05-01", "S-H05-02", "S-H06-01", "S-H06-02", "S-H07-01", "S-H07-02", "S-H08-01", "S-H08-02",
      "S-H09-01", "S-H09-02", "S-H10-01", "S-H10-02", "S-H11-01", "S-H11-02", "S-H11-03", "S-H12-01", "S-H12-02",
    ]);
    const locators: Record<string, string> = {
      "S-H01-02": "卷二百二十四·與李十二白同尋範十隱居",
      "S-H02-01": "卷三·马行街铺席",
      "S-H02-02": "卷二·饮食果子",
      "S-H07-02": "卷六十九·苏秦列传·说齐宣王",
      "S-H09-01": "卷三·防火", "S-H10-01": "卷十八", "S-H11-01": "卷十四·宪问",
    };
    for (const source of sourceIndex) {
      expect(source.status).toBe("pending");
      expect(source.locator).toBe(locators[source.id] ?? "");
    }
    const raw = JSON.stringify([topics, sourceIndex]);
    for (const field of ["reviewBy", "reviewedAt", "verifiedBy", "verifiedAt"]) expect(raw).not.toContain(`"${field}"`);
  });

  it.each([
    { id: "H01", best: "A", sources: ["S-H01-01", "S-H01-02"], corrected: "李白与杜甫在唐代相识并有交游记载。" },
    { id: "H02", best: "C", sources: ["S-H02-01", "S-H02-02", "S-H02-03"], corrected: "宋代部分城市已有购买现成饭食、代买送食等服务，与现代外卖平台不同。" },
    { id: "H03", best: "C", sources: ["S-H03-01", "S-H03-02", "S-H03-03"], corrected: "唐代有胡椒、花椒等辛香料，但来自美洲的辣椒约在明末传入中国。" },
    { id: "H04", best: "B", sources: ["S-H04-01", "S-H04-02", "S-H04-03"], corrected: "北宋四川出现交子，并经历民间使用到官府发行的发展过程。" },
    { id: "H05", best: "B", sources: ["S-H05-01", "S-H05-02"], corrected: "唐三彩是多种釉色的唐代彩釉陶器，并非严格只有三种颜色。" },
    { id: "H06", best: "A", sources: ["S-H06-01", "S-H06-02"], corrected: "战国已有可借助冰块冷却酒饮的冰鉴等器具，不等于电冰箱。" },
    { id: "H07", best: "C", sources: ["S-H07-01", "S-H07-02"], corrected: "蹴鞠在宋代以前已有记载，宋代进一步发展，不能说起源于宋代。" },
    { id: "H08", best: "B", sources: ["S-H08-01", "S-H08-02"], corrected: "唐代遗址发现带植毛孔的牙刷柄，可证明当时已有这种器具。" },
    { id: "H09", best: "A", sources: ["S-H09-01", "S-H09-02"], corrected: "北宋东京设望火楼瞭望火情，楼下驻军并备救火器具，遇火由军兵扑救。" },
    { id: "H10", best: "C", sources: ["S-H10-01", "S-H10-02"], corrected: "据沈括《梦溪笔谈》，北宋庆历年间布衣毕昇以胶泥刻字、火烧令坚，制成活版。" },
    { id: "H11", best: "B", sources: ["S-H11-01", "S-H11-02", "S-H11-03"], corrected: "传世《论语·宪问》中，孔子回应“以德报怨”时主张“以直报怨，以德报德”。" },
    { id: "H12", best: "C", sources: ["S-H12-01", "S-H12-02"], corrected: "1972 年银雀山汉墓同时出土《孙子兵法》与《孙膑兵法》竹简，证实两部兵书各自传世。" },
  ])("$id 保持文案模板、八条四角色评论、指定改写及本题事实来源前缀", ({ id, best, sources, corrected }) => {
    const topic = getAllTopics().find((topic) => topic.id === id)!;
    expect(topic.author.fictitious).toBe(true);
    expect([...topic.title].length).toBeGreaterThanOrEqual(18);
    expect([...topic.title].length).toBeLessThanOrEqual(43);
    expect([...topic.body].length).toBeGreaterThanOrEqual(80);
    expect([...topic.body].length).toBeLessThanOrEqual(150);
    expect(topic.comments).toHaveLength(8);
    expect(new Set(topic.comments.map((comment) => comment.id)).size).toBe(8);
    expect(new Set(topic.comments.map((comment) => comment.role))).toEqual(new Set(["spectator", "troll", "history_nerd", "in_world"]));
    expect(topic.sourceIds).toEqual(sources);
    expect(topic.rewriteOptions.map((option) => option.id)).toEqual(["A", "B", "C"]);
    expect(topic.rewriteOptions.find((option) => option.isBest)).toMatchObject({ id: best, text: corrected });
    expect(topic.reveal.correctedClaim).toBe(corrected);
    expect(topic.aiLimitations.length).toBeGreaterThan(0);
    for (const fact of topic.aiFacts) {
      expect(topic.sourceIds).toContain(fact.match(/^\[([^\]]+)\]/)?.[1]);
    }
  });

  it("真实题目封面与所有头像使用已登记的本地原创 SVG", () => {
    const assets = new Set(getAllTopics().flatMap((topic) => [topic.coverUrl, topic.author.avatarUrl, ...topic.comments.map((comment) => comment.avatar!)]));
    const licenses = readFileSync(path.join(process.cwd(), "docs/ASSET_LICENSES.md"), "utf8");
    for (const asset of assets) {
      expect(asset).toMatch(/^\/(covers|avatars)\/[\w-]+\.svg$/);
      const svg = readFileSync(path.join(process.cwd(), "public", asset), "utf8");
      expect(svg).not.toMatch(/虚构|架空|模拟|非史料|非实物复原|不是实物复原|仅作戏仿|场景为创作/);
      expect(svg).not.toContain('<rect x="834" y="578"');
      expect(svg).not.toContain('<circle cx="861" cy="600"');
      if (asset.startsWith("/covers/")) {
        expect(svg).not.toMatch(/<rect x="70" y="578"|<text x="242" y="607"|<text x="70" y="609"/);
        expect(svg).toContain('viewBox="0 0 1200 675"');
        expect(svg).toContain('font-size="70"');
        expect(svg).toContain("热搜档案 / H");
      }
      expect(svg).not.toMatch(/(?:href|src)=["']https?:/);
      expect(licenses).toContain(`public${asset}`);
    }
  });

  it("题面、账号、评论及揭晓不含虚构标签，保留内部素材登记与 AI 事实边界", () => {
    for (const topic of getAllTopics()) {
      const displayed = JSON.stringify({ ...toPublicTopic(topic), reveal: topic.reveal, rewriteOptions: topic.rewriteOptions });
      expect(displayed).not.toMatch(/虚构|架空|模拟|非史料|只是创作|只是梗|均为现代演绎|拟人账号/);
      expect(topic.aiLimitations.length).toBeGreaterThan(0);
      expect(topic.assetLicense).toContain("艺术创作·非史料");
      expect(topic.reviewStatus).toBe("pending");
    }
  });

});

describe("validateContentSet：expectedCount=12 的扩容校验（仅内存 fixture）", () => {
  it("接受恰好 12 条且真假 6:6", () => {
    expect(() => validateContentSet(makeTopics(12, 6), sources, { expectedCount: 12 })).not.toThrow();
  });

  it.each([0, 11, 13])("拒绝 %i 条题目", (count) => {
    expect(() => validateContentSet(makeTopics(count), sources, { expectedCount: 12 })).toThrow(/题目数量应为 12/);
  });

  it.each([0, 5, 7, 12])("拒绝 12 条中 %i 真、其余假的比例", (trueCount) => {
    expect(() => validateContentSet(makeTopics(12, trueCount), sources, { expectedCount: 12 })).toThrow(/真假比例必须为 6:6/);
  });

  it("其他 expectedCount 也检查数量", () => {
    expect(() => validateContentSet(makeTopics(1), sources, { expectedCount: 2 })).toThrow(/题目数量应为 2/);
  });
});

describe("7.3 的类型及 Zod 字段约束", () => {
  it.each(["pending", "reviewed", "rejected"])("保留合法审核状态 %s", (status) => {
    expect(ReviewStatusSchema.parse(status)).toBe(status);
    expect(SourceSchema.parse({ ...makeSource(), status }).status).toBe(status);
    const topic = HotTopicSchema.parse({ ...makeTopic(), reviewStatus: status });
    expect(topic.reviewStatus).toBe(status);
  });

  it("拒绝未知审核状态", () => {
    expect(() => validateContentSet([{ ...makeTopic(), reviewStatus: "verified" }], sources)).toThrow();
    expect(() => validateContentSet([makeTopic()], [{ ...makeSource(), status: "verified" }])).toThrow();
  });

  it.each(["primary", "museum", "academic", "public_culture"])("接受来源种类 %s", (kind) => {
    expect(SourceSchema.parse({ ...makeSource(), kind }).kind).toBe(kind);
  });

  it("拒绝无效来源 URL 和缺失的具体支持点", () => {
    expect(() => validateContentSet([makeTopic()], [makeSource({ url: "not-a-url" })])).toThrow();
    expect(() => validateContentSet([makeTopic()], [makeSource({ supports: " " })])).toThrow();
  });

  it("允许来源定位为空，且不生成虚构审核人或时间", () => {
    const source = SourceSchema.parse(makeSource({ locator: "" }));
    expect(source.locator).toBe("");
    expect(source.verifiedAt).toBeUndefined();
    expect(source.verifiedBy).toBeUndefined();
  });

  it.each(["spectator", "troll", "history_nerd", "in_world"])("接受评论角色 %s", (role) => {
    expect(CommentSchema.parse({ ...makeTopic().comments[0], role }).role).toBe(role);
  });

  it("拒绝未知评论角色、负数或非整数模拟统计", () => {
    const comment = makeTopic().comments[0];
    expect(CommentSchema.safeParse({ ...comment, role: "admin" }).success).toBe(false);
    expect(CommentSchema.safeParse({ ...comment, simulatedLikes: -1 }).success).toBe(false);
    expect(HotTopicSchema.safeParse(makeTopic({ simulatedHeat: 1.5 })).success).toBe(false);
    expect(HotTopicSchema.safeParse(makeTopic({ simulatedViews: -1 })).success).toBe(false);
    for (const field of ["simulatedReplies", "simulatedReposts", "simulatedViews"]) {
      expect(CommentSchema.safeParse({ ...comment, [field]: -1 }).success).toBe(false);
      expect(CommentSchema.safeParse({ ...comment, [field]: 1.5 }).success).toBe(false);
    }
  });

  it("架空账号标识必须为 true，isTrue 不接受字符串", () => {
    const topic = makeTopic();
    expect(HotTopicSchema.safeParse({ ...topic, author: { ...topic.author, fictitious: false } }).success).toBe(false);
    expect(HotTopicSchema.safeParse({ ...topic, isTrue: "false" }).success).toBe(false);
  });

  it.each([undefined, null, "", "abc", "@ab", "@abcdefghijklmnopqrstu", "@Uppercase", "@guwen_1pjmn5g", "@with-dash", "@name ", "@名字"])("拒绝缺失或格式无效的作者 handle：%j", (handle) => {
    const topic = makeTopic();
    expect(HotTopicSchema.safeParse({ ...topic, author: { ...topic.author, handle } }).success).toBe(false);
  });

  it.each(["@abc", "@abcdefghijklmnopqrst", "@changan_chihuo"])("接受 3–20 位小写字母/下划线 handle：%s", (handle) => {
    const topic = makeTopic();
    expect(HotTopicSchema.parse({ ...topic, author: { ...topic.author, handle } }).author.handle).toBe(handle);
  });

  it("改写选项的文本和反馈均不能为空", () => {
    const option = makeTopic().rewriteOptions[0];
    expect(RewriteOptionSchema.safeParse({ ...option, text: "" }).success).toBe(false);
    expect(RewriteOptionSchema.safeParse({ ...option, feedback: " " }).success).toBe(false);
  });

  it("进度支持最小状态与显式 false，不默认为已揭晓", () => {
    expect(TopicProgressSchema.parse({ topicId: "TEST-1", revealed: false })).toEqual({ topicId: "TEST-1", revealed: false });
    const progress = TopicProgressSchema.parse({
      topicId: "TEST-1", selectedAnswer: false, submittedAt: "2026-10-29T12:00:00Z",
      revealed: true, selectedRewriteOptionId: "C",
    });
    expect(progress.selectedAnswer).toBe(false);
    expect(progress.selectedRewriteOptionId).toBe("C");
    expect(TopicProgressSchema.safeParse({ topicId: "TEST-1" }).success).toBe(false);
    expect(TopicProgressSchema.safeParse({ topicId: "TEST-1", revealed: "false" }).success).toBe(false);
  });
});

describe("阶段6的形式与史实边界", () => {
  it("每题只归属一个模块，各六题且各三真三假，公开题面保留归属", () => {
    const topics = getAllTopics();
    for (const module of ["trending", "discover"] as const) {
      const members = topics.filter((topic) => topic.module === module);
      expect(members).toHaveLength(6);
      expect(members.filter((topic) => topic.isTrue)).toHaveLength(3);
      expect(members.every((topic) => toPublicTopic(topic).module === module)).toBe(true);
    }
    expect(HotTopicSchema.safeParse({ ...makeTopic(), module: "other" }).success).toBe(false);
    const { module: _module, ...missing } = makeTopic();
    expect(HotTopicSchema.safeParse(missing).success).toBe(false);
  });

  it("发现回复仅使用指定围观语气，作者身份一致，楼中楼父节点完整", () => {
    const allowed = new Set([
      "来了来了，评论我看到了！先一起围观，别急着替我下结论。",
      "收到，前排的椅子搬好了，等大家一起看完再聊。",
      "这楼先留着，等你看完回来接着聊。",
    ]);
    for (const topic of getAllTopics()) {
      const comment = topic.comments[0];
      const replies = comment.replies ?? [];
      if (topic.module === "trending") { expect(replies).toHaveLength(0); continue; }
      expect(replies).toHaveLength(3);
      expect(replies.map((reply) => reply.author)).toEqual([topic.author.name, comment.author, topic.author.name]);
      const ids = new Set([comment.id]);
      for (const reply of replies) {
        expect(ids.has(reply.id)).toBe(false);
        expect(ids.has(reply.replyTo)).toBe(true);
        expect(allowed.has(reply.text)).toBe(true);
        ids.add(reply.id);
      }
    }
  });

  it.each(["missing", "cycle", "duplicate"])("拒绝无效回复线程：%s", (kind) => {
    const topic = makeTopic();
    topic.comments[0].replies = [{ id: kind === "duplicate" ? "COMMENT-1" : "R1", replyTo: kind === "missing" ? "UNKNOWN" : kind === "cycle" ? "R1" : "COMMENT-1", author: "测试网友", text: "围观中" }];
    expect(() => validateContentSet([topic], [makeSource()])).toThrow(/回复线程/);
  });

  it("全部标题不含 #，无首尾空白或重复的句末标点", () => {
    for (const topic of getAllTopics()) {
      expect(topic.title).not.toContain("#");
      expect(topic.title).toBe(topic.title.trim());
      expect(topic.title).not.toMatch(/\s#|#\s|[！？，。]{2,}/);
    }
  });
  it("旧题缺省 post，新题依次为 news/moments/chat/poll，公开题面保留 format", () => {
    const topics = getAllTopics();
    expect(topics.slice(0, 8).every((topic) => topic.format === undefined)).toBe(true);
    expect(topics.slice(8).map((topic) => topic.format)).toEqual(["news", "moments", "chat", "poll"]);
    for (const topic of topics) expect(toPublicTopic(topic).format).toBe(topic.format);
    expect(HotTopicSchema.safeParse(makeTopic({ format: "video" as never })).success).toBe(false);
    expect(HotTopicSchema.parse(makeTopic({ format: "post" })).format).toBe("post");
  });

  it("原文字形差异及传世本/异读被记录，异读不混入事实卡或来源", () => {
    const [h09, h10, h11, h12] = getAllTopics().slice(8);
    expect(h09.aiFacts.join("")).toContain("酒子");
    expect(h09.aiLimitations.join("")).toContain("洒子");
    expect(h10.aiLimitations.join("")).toContain("毕升");
    expect(h11.reveal.shortExplanation).toContain("传世");
    expect(h11.reveal.shortExplanation).toContain("以直报怨");
    expect(h11.reveal.funFact).toContain("吴昊亨");
    expect(h11.aiLimitations.join("")).toContain("仅作学术异读");
    expect(h11.aiFacts.join("")).not.toContain("吴昊亨");
    expect(sourceIndex.filter((source) => source.id.startsWith("S-H11-"))).toHaveLength(3);
    expect(JSON.stringify(sourceIndex)).not.toMatch(/論語\/憲問第十四|吴昊亨/);
    expect(h12.aiLimitations.join("")).toContain("抄写时期");
    for (const topic of [h09, h10, h11, h12]) {
      for (const comment of topic.comments) {
        expect(comment.text).not.toContain(topic.reveal.correctedClaim);
        expect(comment.text).not.toMatch(/查证属实|谣言退散|核心主张为[真假]|1972|以直报怨|火烧令坚/);
      }
    }
  });
});
