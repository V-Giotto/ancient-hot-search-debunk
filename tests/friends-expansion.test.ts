// @vitest-environment node
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/chat/route";
import { getAllFriends, getFriendSources, toFriendProfile } from "@/lib/friends";
import { FriendSchema } from "@/lib/friend-schema";
import { buildChatMessages, getChatEraInstruction } from "@/lib/chat-context";
import { findChatOutputViolations, getChatSafeReply } from "@/lib/chat-guard";
import { ERA_ORDER, EraSchema, isLaterEra } from "@/lib/era";
import { getAllTopics, getTopicById, getSourcesForTopic } from "@/lib/topics";

const expected = [
  ["libai", "李白", "唐代", 4], ["dufu", "杜甫", "唐代", 4], ["sushi", "苏轼", "北宋", 5],
  ["liqingzhao", "李清照", "宋代", 5], ["kongzi", "孔子", "春秋", 1], ["quyuan", "屈原", "战国", 2],
  ["qinshihuang", "秦始皇", "秦", 2.5], ["simaguang", "司马光", "北宋", 5], ["zhugeliang", "诸葛亮", "三国", 3.25],
  ["wangxizhi", "王羲之", "东晋", 3.5], ["chengjisihan", "成吉思汗", "蒙古", 6],
  ["wangyangming", "王阳明", "明", 7], ["kangxi", "康熙", "清", 8],
] as const;
const friends = getAllFriends();
const eras = Object.entries(ERA_ORDER).map(([label, order]) => EraSchema.parse({ label, order }));
const clean = { unsupportedQuotes: [], personaFragments: [], missingEraMarker: false, mixedSelfReferences: false };

describe("十三位人设与事实边界", () => {
  it("指定 ID、姓名、头像与稳定的名单顺序，年代与旧题体系协调", () => {
    expect(friends.map(({ id, name, era }) => [id, name, era.label, era.order])).toEqual(expected);
    expect(friends.map(({ displayOrder }) => displayOrder)).toEqual(Array.from({ length: 13 }, (_, i) => i + 1));
    for (const friend of friends) {
      expect(friend.avatarUrl).toBe(`/friends/${friend.id}.webp`);
      const bytes = readFileSync(`public${friend.avatarUrl}`);
      expect(bytes.subarray(0, 4).toString()).toBe("RIFF");
      expect(bytes.subarray(8, 12).toString()).toBe("WEBP");
    }
  });
  it.each(friends)("$name 完整加载结构化人设，开场与所有示例通过输出守卫", (friend) => {
    expect(FriendSchema.parse(friend)).toEqual(friend);
    expect(friend.personaReview).toEqual({ status: "pending", reviewer: "Giotto" });
    const { identity, chatRules, examples } = friend.persona;
    expect(identity.summary).toContain(friend.name === "康熙" ? "康熙" : friend.name);
    expect(identity.role).toContain("·");
    expect(chatRules.join()).toContain("看不到游戏数据");
    expect(examples.length).toBeGreaterThanOrEqual(2);
    for (const reply of [friend.greeting, ...examples.map((example) => example.reply), getChatSafeReply(friend)]) {
      expect(findChatOutputViolations(reply, friend, getFriendSources(friend))).toEqual(clean);
    }
    const context = JSON.parse(buildChatMessages(friend, getFriendSources(friend), "你好")[1].content.split("\n")[1]);
    expect(context.friend.persona).toEqual(friend.persona);
    expect(context.sourceIds).toEqual([...new Set([...friend.knowledge.map(({ sourceId }) => sourceId), ...friend.sourceIds])]);
    expect(context.knowledge.every((record: { reviewStatus: { status: string } }) => record.reviewStatus.status === "reviewed")).toBe(true);
    expect(toFriendProfile(friend)).not.toHaveProperty("personaReview");
    expect(toFriendProfile(friend)).not.toHaveProperty("persona");
  });
  it("缺少人物已审来源时保持空白名单，不借其它人物来源充数", () => {
    for (const friend of friends.filter(({ id }) => !["libai", "dufu", "kongzi", "qinshihuang"].includes(id))) {
      expect(friend.sourceIds).toEqual([]);
      expect(getFriendSources(friend)).toEqual([]);
      expect(findChatOutputViolations("《未审核的作品》", friend, []).unsupportedQuotes).toEqual(["未审核的作品"]);
    }
  });
  it.each([
    { personaReview: { status: "reviewed", reviewer: "Giotto" } }, { displayOrder: 0 },
    { persona: { ...friends[0].persona, examples: [{ user: "你好", reply: "" }] } },
    { persona: { ...friends[0].persona, identity: { summary: "", role: "陪聊" } } },
    { persona: { ...friends[0].persona, chatRules: [] } },
  ])("损坏的新增字段不能加载：%j", (patch) => {
    expect(FriendSchema.safeParse({ ...friends[0], ...patch }).success).toBe(false);
  });
});

describe.each(friends)("$name 的 hearsay 与输出安全", (friend) => {
  const sources = getFriendSources(friend);
  it("对每个可用时代及十四题比较 order，只对更晚时代要求耳闻", () => {
    for (const era of [...eras, ...getAllTopics().map(({ era }) => era)]) {
      const later = era.order > friend.era.order;
      expect(isLaterEra(era, friend.era)).toBe(later);
      expect(Boolean(getChatEraInstruction(friend, { era }))).toBe(later);
      expect(findChatOutputViolations("此事不敢多说。", friend, sources, [], era).missingEraMarker).toBe(later);
      expect(findChatOutputViolations("听说此事，不敢多说。", friend, sources, [], era)).toEqual(clean);
      const fallback = getChatSafeReply(friend, era);
      expect(findChatOutputViolations(fallback, friend, sources, [], era)).toEqual(clean);
      expect(fallback.includes("身后")).toBe(later);
    }
    expect(getChatEraInstruction(friend)).toBe("");
  });
  it("元话语、第三人称、伪诗题和不一致自称均拦截，能报姓名介绍", () => {
    expect(findChatOutputViolations("根据资料，此事不能确定。", friend, sources).personaFragments.length).toBeGreaterThan(0);
    expect(findChatOutputViolations(`${friend.name}认为如此。`, friend, sources).personaFragments.length).toBeGreaterThan(0);
    expect(findChatOutputViolations("《未审的诗题》", friend, sources).unsupportedQuotes).toEqual(["未审的诗题"]);
    const self = friend.persona.selfReference[0];
    const other = self === "某" ? "吾" : "某";
    expect(findChatOutputViolations(`${self}不敢说，${other}也不敢说。`, friend, sources).mixedSelfReferences).toBe(true);
    expect(findChatOutputViolations(`${self}是${friend.name}，很高兴见到你。`, friend, sources)).toEqual(clean);
  });
});

describe("十三位好友的真实路由配合 mock 上游", () => {
  const fetchMock = vi.fn<typeof fetch>();
  let serial = 0;
  const result = (reply: string) => Response.json({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ reply }) } }] });
  function request(friendId: string, sharedTopicId?: string) {
    return new Request("http://localhost/api/chat", { method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": `expansion-${++serial}` }, body: JSON.stringify({ friendId, message: "聊聊这件事", ...(sharedTopicId ? { sharedTopicId } : {}) }) });
  }
  beforeEach(() => {
    vi.stubEnv("AI_API_KEY", "synthetic-friend-expansion-key");
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  it.each(friends)("$name 对分享题按时代重试，发送本人完整 persona，来源按 ID 合并", async (friend) => {
    const topic = getTopicById("H02")!;
    const later = topic.era.order > friend.era.order;
    fetchMock.mockResolvedValueOnce(result("此事不敢多说。"))
      .mockResolvedValueOnce(result(`听说后世有此事，${friend.persona.selfReference[0]}不敢多说。`));
    const response = await POST(request(friend.id, topic.id));
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(later ? 2 : 1);
    expect((await response.json()).reply).toBe(later ? `听说后世有此事，${friend.persona.selfReference[0]}不敢多说。` : "此事不敢多说。");
    const payload = JSON.parse(fetchMock.mock.calls[0][1]!.body as string);
    const context = JSON.parse(payload.messages[1].content.split("\n")[1]);
    expect(context.friend.persona).toEqual(friend.persona);
    expect(new Set(context.sourceIds)).toEqual(new Set([...friend.knowledge.map(({ sourceId }) => sourceId), ...friend.sourceIds, ...getSourcesForTopic(topic).map(({ id }) => id)]));
    expect(context.sharedTopic.era).toEqual(topic.era);
  });
  it.each(friends)("$name 连续违规共用一次重试，返回本人自称和正确时代的兜底", async (friend) => {
    const topic = getTopicById("H02")!;
    fetchMock.mockResolvedValue(result("根据资料，《未审作品》不能确定。"));
    expect(await (await POST(request(friend.id, topic.id))).json()).toEqual({ reply: getChatSafeReply(friend, topic.era) });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it.each(friends)("$name 未配置时返回 503，无上游调用", async (friend) => {
    vi.stubEnv("AI_API_KEY", "");
    expect((await POST(request(friend.id))).status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
