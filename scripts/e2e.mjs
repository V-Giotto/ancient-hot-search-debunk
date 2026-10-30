import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { setTimeout } from "node:timers/promises";
import { chromium } from "playwright";

// 使用真实生产服务、真实接口和真实下载，不 mock 判题或导出。
const port = process.env.E2E_PORT || "3123";
const baseURL = process.env.E2E_BASE_URL || `http://127.0.0.1:${port}`;
const output = path.resolve("artifacts/stage-6");
const screenshots = path.join(output, "screenshots");
const reviewDir = process.env.E2E_REVIEW_DIR || "/workspace/iter1";
const scenarios = [
  { id: "H01", answer: false, best: "A", wrong: "B", sourceCount: 2 },
  { id: "H02", answer: true, best: "C", wrong: "A", sourceCount: 3 },
  { id: "H03", answer: false, best: "C", wrong: "A", sourceCount: 3 },
  { id: "H04", answer: true, best: "B", wrong: "A", sourceCount: 3 },
  { id: "H05", answer: false, best: "B", wrong: "A", sourceCount: 2 },
  { id: "H06", answer: true, best: "A", wrong: "B", sourceCount: 2 },
  { id: "H07", answer: false, best: "C", wrong: "A", sourceCount: 2 },
  { id: "H08", answer: true, best: "B", wrong: "A", sourceCount: 2 },
  { id: "H09", answer: true, best: "A", wrong: "B", sourceCount: 2, format: "news" },
  { id: "H10", answer: true, best: "C", wrong: "A", sourceCount: 2, format: "moments" },
  { id: "H11", answer: false, best: "B", wrong: "A", sourceCount: 3, format: "chat" },
  { id: "H12", answer: false, best: "C", wrong: "A", sourceCount: 2, format: "poll" },
];
const sourceIndex = JSON.parse(await readFile("data/source-index.json", "utf8"));
const { version: packageVersion } = JSON.parse(await readFile("package.json", "utf8"));
const allTopics = await Promise.all(scenarios.map(({ id }) => readFile(`data/topics/${id.toLowerCase()}.json`, "utf8").then(JSON.parse)));
const trendingTopics = allTopics.filter((topic) => topic.module === "trending").map((topic, index) => ({ ...topic, rank: index + 1 }));
const discoverTopics = allTopics.filter((topic) => topic.module === "discover");
const postPageTitle = (topic) => `${topic.module === "trending" ? "热搜 · 报道" : "发现 · 帖子"} ${topic.id}`;
assert.equal(trendingTopics.length, 6);
assert.equal(discoverTopics.length, 6);
for (const topics of [trendingTopics, discoverTopics]) assert.equal(topics.filter((topic) => topic.isTrue).length, 3);
await mkdir(output, { recursive: true });
await mkdir(screenshots, { recursive: true });
if (reviewDir) await mkdir(reviewDir, { recursive: true });
let server;
let serverLog = "";
let browser;
const revealChecks = [];
const replayChecks = [];

async function requireFreePort() {
  const probe = createServer();
  await new Promise((resolve, reject) => {
    probe.once("error", () => reject(new Error(`E2E 端口 ${port} 被占用，请先结束该端口的旧 Next 进程。`)));
    probe.listen(Number(port), "127.0.0.1", () => probe.close(resolve));
  });
}

async function compactHeaderChecks(page, title) {
  const header = page.locator(".shell-header");
  assert.equal(await header.count(), 1);
  assert.equal(await header.locator(".shell-page-title").textContent(), title);
  const isPost = title.startsWith("发现 · 帖子");
  assert.equal(await header.getByRole("link", { name: isPost ? "返回发现" : "返回热搜榜", exact: true }).getAttribute("href"), isPost ? "/discover" : "/trending");
  const layout = await header.evaluate((node) => ({ height: node.getBoundingClientRect().height, position: getComputedStyle(node).position, top: getComputedStyle(node).top }));
  assert.equal(layout.height, 48, "页面顶栏应为 48px");
  assert.equal(layout.position, "sticky");
  assert.equal(layout.top, "0px");
  assert.equal(await page.getByRole("navigation", { name: "面包屑", exact: true }).count(), 0);
  assert.equal(await page.locator(".app-shell").getByText("古代热搜辟谣局", { exact: true }).count(), 0, "品牌大头只在热榜横幅出现");
  return { title, ...layout };
}

async function trendingDensityChecks(page) {
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  const layout = await page.evaluate(() => {
    const hero = document.querySelector(".trending-hero").getBoundingClientRect();
    const tabs = document.querySelector(".bottom-tabs").getBoundingClientRect();
    const rows = [...document.querySelectorAll(".trending-list > li")].map((row) => {
      const box = row.getBoundingClientRect();
      return { top: box.top, bottom: box.bottom };
    });
    return { heroHeight: hero.height, tabsTop: tabs.top, fullyVisible: rows.filter((row) => row.top >= 0 && row.bottom <= tabs.top).length, fourthBottom: rows[3].bottom, scrollY: window.scrollY };
  });
  assert.equal(layout.scrollY, 0);
  assert.equal(layout.heroHeight, 96, "热榜横幅应为 96px");
  assert.equal(await page.locator(".shell-header").count(), 0);
  assert.equal(await page.getByText("古代热搜辟谣局", { exact: true }).count(), 1);
  if (page.viewportSize().width === 390 && page.viewportSize().height === 844) {
    assert.ok(layout.fullyVisible >= 4 && layout.fourthBottom <= layout.tabsTop, `390×844 首屏必须完整露出至少 4 条新闻条目：${JSON.stringify(layout)}`);
  }
  return layout;
}

async function versionScreenshot(page, name, version = "0.10.0", { scrollToTop = true } = {}) {
  await page.waitForFunction(() => [...document.images].every((image) => image.complete && image.naturalWidth > 0));
  if (scrollToTop) await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  const filename = `v${version}-${name}-390x844.png`;
  const target = path.join(screenshots, filename);
  await page.screenshot({ path: target, animations: "disabled" });
  if (reviewDir) await copyFile(target, path.join(reviewDir, filename));
}

async function firstLoadChecks(browser, errors) {
  // 从构建内容识别导出库独立 chunk，避免把文件名散列写死。
  const chunkDir = ".next/static/chunks";
  const files = (await readdir(chunkDir, { recursive: true })).filter((name) => name.endsWith(".js"));
  const exportChunks = (await Promise.all(files.map(async (file) => (await readFile(path.join(chunkDir, file), "utf8")).includes("Failed to fetch resource:") ? `/_next/static/chunks/${file}` : null))).filter(Boolean);
  assert.ok(exportChunks.length > 0, "未找到 html-to-image 的独立动态 chunk");
  const routes = [];
  for (const route of ["/trending", "/discover", "/me", "/me?tab=favorites", "/post/H12"]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    try {
      const page = await context.newPage();
      page.on("pageerror", (error) => errors.push(error.message));
      const session = await context.newCDPSession(page);
      await session.send("Network.enable");
      await session.send("Network.setCacheDisabled", { cacheDisabled: true });
      await page.goto(`${baseURL}${route}`);
      await visible(page.getByRole("heading", { level: 1 }));
      // 只在冷启动资源计量时等待网络空闲，包含首屏自动预取，不进行任何交互。
      await page.waitForLoadState("networkidle");
      const scripts = await page.evaluate(() => performance.getEntriesByType("resource").filter((entry) => new URL(entry.name).pathname.endsWith(".js")).map((entry) => ({
        path: new URL(entry.name).pathname, encodedBytes: entry.encodedBodySize, decodedBytes: entry.decodedBodySize, transferBytes: entry.transferSize,
      })));
      assert.ok(scripts.length > 0 && scripts.every((entry) => entry.encodedBytes > 0), "冷启动 JS 计量缺失或命中缓存");
      const sum = (field) => scripts.reduce((total, script) => total + script[field], 0);
      const encodedBytes = sum("encodedBytes");
      assert.ok(encodedBytes < 300000, `${route} 首屏压缩 JS 超过 300KB：${encodedBytes} 字节`);
      assert.ok(scripts.every((script) => !exportChunks.includes(script.path)), `${route} 首屏提前请求 html-to-image`);
      routes.push({ route, encodedBytes, decodedBytes: sum("decodedBytes"), transferBytes: sum("transferBytes"), scripts });
    } finally { await context.close(); }
  }
  return { viewport: "390×844", cache: "每路由新会话、禁用 HTTP 缓存", budgetBytes: 300000, metric: "ResourceTiming encodedBodySize；全部外部 JS，含自动预取；另记解压大小与含协议开销的传输大小", exportChunks, routes };
}

async function pollTendencyChecks(page) {
  const poll = page.getByRole("region", { name: "直觉投票", exact: true });
  await visible(poll.getByText("少数倾向", { exact: true }));
  await visible(poll.getByText("多数倾向", { exact: true }));
  assert.doesNotMatch(await poll.textContent(), /\d+(?:\.\d+)?\s*%/);
  assert.equal(await poll.locator('[style*="width"]').count(), 0, "倾向文字条不应保留精确比例图形");
  assert.equal(await poll.getByRole("button", { pressed: true }).count(), 1);
  assert.equal(await poll.locator("button:enabled").count(), 0);
}

async function taskLandingChecks(page) {
  // 核验用户投票或再玩一次后的真实落点，不调用测试滚动来修正位置。
  const layout = await page.evaluate(async () => {
    const visible = (selector) => [...document.querySelectorAll(selector)].find((node) => node.checkVisibility());
    let previous;
    let stableFrames = 0;
    const deadline = performance.now() + 10000;
    while (performance.now() < deadline) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const panel = visible(".task-panel");
      if (!panel) continue;
      const heading = panel.querySelector("#task-heading");
      const box = panel.getBoundingClientRect();
      const headingBox = heading.getBoundingClientRect();
      const headerBottom = visible(".shell-header").getBoundingClientRect().bottom;
      const tabsTop = visible(".bottom-tabs").getBoundingClientRect().top;
      const current = { panelTop: box.top, panelBottom: box.bottom, headingTop: headingBox.top, headingBottom: headingBox.bottom, headerBottom, tabsTop, scrollY: window.scrollY };
      // 接近页尾时无需强求顶部对齐；收藏提示异步加载也可能改变最大滚动距离。
      const landed = current.scrollY > 0 && box.top >= headerBottom + 7.5 && box.bottom <= tabsTop
        && document.activeElement === heading;
      stableFrames = landed && previous && Math.abs(previous.scrollY - current.scrollY) < 0.5
        && Math.abs(previous.panelTop - current.panelTop) < 0.5 ? stableFrames + 1 : 0;
      if (stableFrames >= 5) return current;
      previous = current;
    }
    throw new Error(`判题区滚动未稳定或被遮挡：${JSON.stringify(previous)}`);
  });
  await focused(page.locator("#task-heading"));
  assert.ok(layout.scrollY > 0 && layout.panelTop >= layout.headerBottom + 7.5 && layout.headingBottom < layout.tabsTop, `判题区标题被吸顶头部或底栏遮挡：${JSON.stringify(layout)}`);
  assert.ok(layout.panelBottom <= layout.tabsTop, "判题区未完整进入首屏");
  return layout;
}

async function pollHandoffChecks(page) {
  const layout = await taskLandingChecks(page);
  await pollTendencyChecks(page);
  return layout;
}

async function freshPost(page, { poll = false } = {}) {
  await visible(page.getByRole("heading", { name: "这条主张，你信吗？", exact: true }));
  await page.waitForFunction(() => [...document.querySelectorAll(".task-panel")].some((panel) => panel.checkVisibility()
    && panel.querySelectorAll("input:checked").length === 0
    && panel.querySelectorAll("input:disabled").length === 0
    && panel.querySelector("button:disabled")?.textContent.trim() === "提交判断"));
  assert.equal(await page.getByRole("radio").count(), 2);
  assert.equal(await page.locator(".reveal-panel:visible").count(), 0);
  assert.equal(await page.getByRole("group", { name: "三选一改写", exact: true }).count(), 0);
  assert.equal(await page.getByRole("log", { name: "AI 问答记录", exact: true }).count(), 0);
  assert.equal(await page.getByRole("textbox").count(), 0);
  assert.equal(await page.getByRole("dialog").count(), 0);
  assert.equal(await page.getByRole("button", { name: "再玩一次", exact: true }).count(), 0);
  assert.equal(await page.getByText(/获得贴纸/).count(), 0);
  if (poll) {
    const section = page.getByRole("region", { name: "直觉投票", exact: true });
    assert.equal(await section.getByRole("button", { pressed: true }).count(), 0);
    assert.equal(await section.locator("button:enabled").count(), 2);
    assert.equal(await section.locator(".poll-tendency").count(), 0);
  }
}

async function replayPost(page, scenario, geometry) {
  const saved = await page.evaluate(() => localStorage.getItem("ahsd:progress:v1"));
  const button = page.getByRole("button", { name: "再玩一次", exact: true });
  const box = await button.boundingBox();
  assert.ok(box.width >= 44 && box.height >= 44, "再玩一次触控范围不足 44px");
  await button.click();
  await freshPost(page, { poll: scenario.id === "H12" });
  const landing = await taskLandingChecks(page);
  assert.equal(await page.evaluate(() => localStorage.getItem("ahsd:progress:v1")), saved, "原地重玩不得改变进度或贴纸");
  const record = { id: scenario.id, ...(await mobileGeometry(page, `${scenario.id} 再玩一次原地重置`)), landing, touchTarget: { width: box.width, height: box.height }, progressUnchanged: true };
  replayChecks.push(record);
  geometry.push(record);
}

async function discoverEmptyChecks(page, geometry) {
  const search = page.getByRole("searchbox", { name: "筛选话题", exact: true });
  await search.fill("没有匹配话题的关键词");
  await visible(page.getByRole("heading", { name: "没有找到匹配的话题", exact: true }));
  assert.equal(await page.getByRole("status").textContent(), "0 条话题");
  assert.equal(await page.getByRole("list", { name: "发现话题", exact: true }).count(), 0);
  const start = page.getByRole("link", { name: "从热榜第 1 条开始", exact: true });
  const firstTopic = trendingTopics.find(({ rank }) => rank === 1);
  assert.equal(await start.getAttribute("href"), `/post/${firstTopic.id}`);
  geometry.push(await mobileGeometry(page, "发现页筛选无结果"));
  await page.getByRole("button", { name: "清除筛选", exact: true }).click();
  assert.equal(await search.inputValue(), "");
  assert.equal(await page.getByRole("list", { name: "发现话题", exact: true }).getByRole("listitem").count(), discoverTopics.length);
  assert.equal(await start.count(), 0);
  await search.fill("没有匹配话题的关键词");
  await start.click();
  await page.waitForURL(`**/post/${firstTopic.id}`);
  await visible(page.getByRole("heading", { level: 1, name: firstTopic.title, exact: true }));
  await page.goto(`${baseURL}/discover`);
}

async function revealSummaryChecks(page, { correct, isTrue, firstScreen = false }) {
  // 等真实提交触发的滚动稳定；此处不手动滚动，避免掩盖吸顶遮挡回归。
  try {
    await page.waitForFunction(() => {
      const panel = document.querySelector(".reveal-panel");
      // Chrome 的滚动位置可能取整，布局仍保留半像素；容许 1px 取整误差。
      return panel && Math.abs(panel.getBoundingClientRect().top - parseFloat(getComputedStyle(panel).scrollMarginTop)) <= 1;
    });
  } catch (error) {
    const position = await page.locator(".reveal-panel").evaluate((panel) => ({ top: panel.getBoundingClientRect().top, margin: getComputedStyle(panel).scrollMarginTop, scrollY: window.scrollY, maxScrollY: document.documentElement.scrollHeight - window.innerHeight }));
    await page.screenshot({ path: path.join(screenshots, `v${packageVersion}-reveal-scroll-failure-${page.viewportSize().width}.png`), animations: "disabled" });
    throw new Error(`揭晓滚动未到位：${page.url()} ${JSON.stringify({ viewport: page.viewportSize(), ...position })}`, { cause: error });
  }
  const layout = await page.locator(".reveal-panel").evaluate((panel) => {
    const heading = panel.querySelector("#reveal-heading");
    const header = document.querySelector(".shell-header").getBoundingClientRect();
    const stamp = panel.querySelector(".verdict-stamp");
    const stampBox = stamp.getBoundingClientRect();
    const rowBox = panel.querySelector(".verdict-stamp-row").getBoundingClientRect();
    const feedback = panel.querySelector(".verdict-feedback");
    const corrected = panel.querySelector(".corrected-claim").getBoundingClientRect();
    return {
      panelTop: panel.getBoundingClientRect().top, titleTop: heading.getBoundingClientRect().top, headerBottom: header.bottom,
      headingMargin: parseFloat(getComputedStyle(heading).scrollMarginTop), panelMargin: parseFloat(getComputedStyle(panel).scrollMarginTop), headerHeight: header.height,
      stampSize: parseFloat(getComputedStyle(stamp).fontSize), stampCentered: Math.abs(stampBox.left + stampBox.width / 2 - rowBox.left - rowBox.width / 2) < 0.5,
      stampText: stamp.textContent, feedbackClass: feedback.className,
      stampIcon: stamp.querySelector('svg[aria-hidden="true"]').getAttribute("data-status-icon"),
      icon: feedback.querySelector('[aria-hidden="true"]').textContent,
      feedbackColor: getComputedStyle(feedback).color, feedbackBackground: getComputedStyle(feedback).backgroundColor,
      order: [...panel.querySelectorAll(".verdict-stamp-row, .verdict-feedback, .corrected-claim")].map((node) => node.classList[0]),
      details: [...panel.querySelectorAll("details")].map((node) => node.open),
      duplicateAnswer: panel.innerText.includes("明确答案"),
      correctedBottom: corrected.bottom, stickerBottom: panel.querySelector(".sticker-earned").getBoundingClientRect().bottom,
      aiLinkTop: panel.querySelector('a[href="#ask-heading"]').getBoundingClientRect().top,
      aiLinkBottom: panel.querySelector('a[href="#ask-heading"]').getBoundingClientRect().bottom,
      tabsTop: document.querySelector(".bottom-tabs").getBoundingClientRect().top,
    };
  });
  assert.ok(layout.titleTop >= layout.headerBottom, "提交后结果标题被吸顶头遮挡");
  assert.ok(layout.panelTop >= layout.headerBottom, "提交后结果卡片顶部被吸顶头遮挡");
  assert.equal(layout.headingMargin, layout.headerHeight + 8);
  assert.equal(layout.panelMargin, layout.headerHeight + 8);
  assert.ok(layout.stampSize >= 32 && layout.stampCentered, "印章未放大居中");
  assert.match(layout.stampText, new RegExp(`核心主张为${isTrue ? "真" : "假"}`));
  assert.equal(layout.stampIcon, isTrue ? "verified" : "refuted");
  assert.ok(layout.feedbackClass.includes(correct ? "feedback-correct" : "feedback-incorrect"));
  assert.equal(layout.icon, correct ? "✓" : "✕");
  assert.equal(layout.feedbackColor, correct ? "rgb(52, 88, 68)" : "rgb(162, 51, 46)");
  assert.notEqual(layout.feedbackBackground, "rgba(0, 0, 0, 0)");
  assert.deepEqual(layout.order, ["verdict-stamp-row", "verdict-feedback", "corrected-claim"]);
  assert.deepEqual(layout.details, [false, false, false]);
  assert.equal(layout.duplicateAnswer, false);
  if (firstScreen) assert.ok(layout.correctedBottom <= layout.tabsTop && layout.stickerBottom <= layout.tabsTop, "准确说法或获得贴纸反馈未完整进入揭晓首屏");
  if (firstScreen) assert.ok(layout.aiLinkTop >= layout.headerBottom && layout.aiLinkBottom <= layout.tabsTop, "问问 AI 入口未完整进入揭晓首屏");
  revealChecks.push({ route: new URL(page.url()).pathname, viewport: page.viewportSize(), correct, ...layout });
}

async function earnedSticker(page, id, count) {
  const sticker = page.getByRole("region", { name: "本题贴纸", exact: true });
  assert.equal(await sticker.getAttribute("aria-live"), "polite");
  assert.equal(await sticker.getAttribute("aria-atomic"), "true");
  await visible(sticker.getByText(new RegExp(`^获得贴纸：.+ · 已查证 ${count}/${scenarios.length}$`)));
  if (id === "H03") await visible(sticker.getByText(`获得贴纸：饭局手记 · 已查证 ${count}/${scenarios.length}`, { exact: true }));
  assert.equal(await sticker.getByRole("link", { name: "去贴纸墙 →", exact: true }).getAttribute("href"), "/me?tab=stickers");
  assert.equal(await page.locator(".reveal-panel .sticker-earned").count(), 1);
}

async function visible(locator) {
  await locator.waitFor({ state: "visible" });
}

async function noOverflow(page) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true, `页面水平溢出：${page.url()}`);
  assert.ok(await page.evaluate(() => Math.abs((window.visualViewport?.scale ?? 1) - 1) < 0.01), `视口被瞬时溢出缩放：${page.url()}`);
}

async function noDisclaimerLabels(page) {
  const displayed = await page.evaluate(() => [document.body.innerText, ...[...document.querySelectorAll("img")].map((image) => image.alt), ...[...document.querySelectorAll("[aria-label]")].map((node) => node.getAttribute("aria-label"))].join("\n"));
  assert.doesNotMatch(displayed, /虚构|架空|模拟|非史料|只是创作|只是梗|非实物复原|仅作戏仿|不是历史人物原话|现代类比，不等于古代原貌|拟人账号/, `页面残留免责声明标签：${page.url()}`);
}

async function noHashtagTitles(page) {
  const titles = await page.locator('h1, h2, h3, .comments-context > span').allTextContents();
  titles.push(await page.title());
  for (const title of titles) assert.doesNotMatch(title, /#/, `标题仍带 #：${title}`);
  for (const value of await page.locator('meta[property="og:title"], meta[name="twitter:title"]').evaluateAll((nodes) => nodes.map((node) => node.content))) assert.doesNotMatch(value, /#/);
}

async function noAuxiliaryContent(page) {
  assert.equal(await page.locator(".desktop-rail, .left-rail, .right-rail, .mobile-briefing, .rail-stickers").count(), 0, `侧栏与页内公告必须从 DOM 移除：${page.url()}`);
  assert.doesNotMatch(await page.locator("body").textContent(), /辟谣局公告|今天的吃瓜守则/, `页面残留公告或守则文案：${page.url()}`);
}

async function centeredColumnChecks(page) {
  await visible(page.locator(".app-shell"));
  await noAuxiliaryContent(page);
  await noOverflow(page);
  assert.equal(await page.locator(".app-shell").count(), 1);
  const layout = await page.evaluate(() => {
    const shell = document.querySelector(".app-shell");
    const box = shell.getBoundingClientRect();
    const background = getComputedStyle(document.body);
    const outside = [...document.body.querySelectorAll("*")].filter((node) => {
      if (shell.contains(node) || node.contains(shell) || !node.checkVisibility()) return false;
      const rect = node.getBoundingClientRect();
      return rect.width > 1 && rect.height > 1;
    }).map((node) => ({ tag: node.tagName, className: node.className }));
    return { shell: { x: box.x, width: box.width }, outside, background: { color: background.backgroundColor, image: background.backgroundImage } };
  });
  const viewport = page.viewportSize();
  assert.equal(layout.shell.width, 390, "桌面仅保留 390px 手机列");
  assert.equal(layout.shell.x, (viewport.width - 390) / 2, "手机列应水平居中");
  assert.deepEqual(layout.outside, [], "手机列之外不应有其它可见内容");
  assert.equal(layout.background.image, "none", "背景应为纯色");
  const channels = layout.background.color.match(/^rgb\((\d+), (\d+), (\d+)\)$/);
  assert.ok(channels && channels.slice(1).every((channel) => Number(channel) >= 230), "背景应保持中性浅色");
  return { viewport, ...layout, horizontalOverflow: false, noAuxiliaryContent: true };
}

async function homeScreenshots(browser, errors) {
  const captures = [];
  let desktop;
  for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    const context = await browser.newContext({ viewport, isMobile: viewport.width === 390, hasTouch: viewport.width === 390 });
    try {
      const page = await context.newPage();
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`${baseURL}/`);
      await page.waitForURL("**/trending");
      if (viewport.width === 390) {
        await mobileGeometry(page, "390×844 全新会话首页");
        await versionScreenshot(page, "home", packageVersion);
        captures.push(path.join(reviewDir, `v${packageVersion}-home-390x844.png`));
      } else {
        desktop = await centeredColumnChecks(page);
        assert.equal(await page.locator('canvas, [class*="qr" i], [id*="qr" i]').count(), 0);
        await page.waitForFunction(() => [...document.images].every((image) => image.complete && image.naturalWidth > 0));
        const filename = `v${packageVersion}-desktop-1440x900.png`;
        await page.screenshot({ path: path.join(screenshots, filename), animations: "disabled" });
        if (reviewDir) await copyFile(path.join(screenshots, filename), path.join(reviewDir, filename));
        captures.push(path.join(reviewDir, filename));
      }
    } finally { await context.close(); }
  }
  return { desktop, screenshots: captures };
}

async function focused(locator) {
  assert.ok(await locator.evaluate((node) => node === document.activeElement), "键盘焦点位置不正确");
}

async function navigationChecks(page) {
  const navigation = page.getByRole("navigation", { name: "主导航", exact: true, includeHidden: true });
  const links = navigation.getByRole("link", { includeHidden: true });
  assert.deepEqual(await links.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("href"))), ["/trending", "/discover", "/friends", "/me"]);
  assert.deepEqual(await links.evaluateAll((nodes) => nodes.map((node) => {
    const label = node.cloneNode(true);
    label.querySelectorAll('[aria-hidden="true"]').forEach((icon) => icon.remove());
    return label.textContent.trim();
  })), ["热搜榜", "发现", "好友", "我的"]);
  assert.equal(await page.locator('a[href="/stickers"], a[href^="/stickers?"]').count(), 0, "站内链接不得再指向旧贴纸路由");
}

async function meFlow(page, viewport, geometry) {
  const legacy = await page.request.get(`${baseURL}/stickers`, { maxRedirects: 0 });
  assert.equal(legacy.status(), 307, "旧贴纸路由应返回服务端 redirect");
  assert.equal(new URL(legacy.headers().location, baseURL).pathname, "/me");
  await page.goto(`${baseURL}/stickers`);
  await page.waitForURL("**/me");
  await compactHeaderChecks(page, "我的");
  const tablist = page.getByRole("tablist", { name: "我的内容", exact: true });
  const stickers = tablist.getByRole("tab", { name: "贴纸", exact: true });
  const favorites = tablist.getByRole("tab", { name: "收藏", exact: true });
  assert.deepEqual(await tablist.getByRole("tab").allTextContents(), ["贴纸", "收藏"]);
  assert.equal(await stickers.getAttribute("aria-selected"), "true");
  await collectionCount(page, 0);
  geometry.push(await mobileGeometry(page, "我的贴纸与旧路由重定向"));
  await favorites.click();
  await page.waitForURL("**/me?tab=favorites");
  await visible(page.getByRole("tabpanel", { name: "收藏", exact: true }));
  assert.equal(await page.getByRole("tabpanel", { name: "贴纸", exact: true }).count(), 0);
  await visible(page.getByRole("link", { name: "去热搜榜看看", exact: true }));
  geometry.push(await mobileGeometry(page, "我的收藏空态与点击切换"));
  for (const [key, selected] of [["ArrowRight", "贴纸"], ["ArrowLeft", "收藏"], ["Home", "贴纸"], ["End", "收藏"]]) {
    await page.keyboard.press(key);
    const tab = tablist.getByRole("tab", { name: selected, exact: true });
    await page.waitForFunction((label) => [...document.querySelectorAll('.me-tabs [role="tab"]')].some((node) => node.textContent === label && node.getAttribute("aria-selected") === "true"), selected);
    await focused(tab);
    assert.equal(await tab.getAttribute("tabindex"), "0");
    assert.equal(await tablist.getByRole("tab", { selected: false }).getAttribute("tabindex"), "-1");
    const panel = page.getByRole("tabpanel", { name: selected, exact: true });
    assert.equal(await panel.getAttribute("id"), await tab.getAttribute("aria-controls"));
  }
  // 验证原生按钮的 Enter/Space 激活，及 Tab 从选中标签进入内容区。
  await stickers.focus(); await page.keyboard.press("Enter");
  await page.waitForURL("**/me?tab=stickers");
  await favorites.focus(); await page.keyboard.press("Space");
  await page.waitForURL("**/me?tab=favorites");
  await page.keyboard.press("Tab");
  await focused(page.getByRole("tabpanel", { name: "收藏", exact: true }));
  await page.reload();
  assert.equal(await favorites.getAttribute("aria-selected"), "true");
  await page.goto(`${baseURL}/me?tab=favorites`);
  await visible(page.getByRole("heading", { name: "我的收藏 0", exact: true }));
  geometry.push(await mobileGeometry(page, "我的收藏直达与刷新保持子标签"));
  // 通过原帖操作收藏两条，截图与测试使用同一条真实界面路径。
  for (const id of ["H01", "H05"]) {
    await page.goto(`${baseURL}/post/${id}`);
    await page.getByRole("button", { name: "收藏", exact: true }).click();
  }
  await page.goto(`${baseURL}/me?tab=favorites`);
  const list = page.getByRole("list", { name: "我的收藏", exact: true });
  await visible(list);
  assert.deepEqual(await list.getByRole("link").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("href"))), ["/post/H01", "/post/H05"]);
  geometry.push(await mobileGeometry(page, "我的收藏两条与底部导航"));
  if (viewport.width === 390) await versionScreenshot(page, "me", packageVersion);
  for (const id of ["H01", "H05"]) {
    await page.goto(`${baseURL}/post/${id}`);
    await page.waitForFunction(() => document.querySelector('.post-actions [aria-label="收藏"]')?.getAttribute("aria-pressed") === "true");
    await page.getByRole("button", { name: "收藏", exact: true }).click();
  }
}

async function openMyStickers(page) {
  await page.getByRole("navigation", { name: "主导航", exact: true }).getByRole("link", { name: "我的", exact: true }).click();
  await page.waitForURL("**/me");
  await page.getByRole("tab", { name: "贴纸", exact: true }).click();
  await page.waitForURL("**/me?tab=stickers");
}

async function persistentSocialFlow(page, viewport, geometry) {
  await page.goto(`${baseURL}/me?tab=favorites`);
  await visible(page.getByRole("link", { name: "去热搜榜看看", exact: true }));
  const nav = page.getByRole("navigation", { name: "主导航", exact: true });
  await navigationChecks(page);
  geometry.push(await mobileGeometry(page, "我的页收藏空状态"));
  for (const [id, friendId, friendName] of [["H01", "libai", "李白"], ["H05", "dufu", "杜甫"]]) {
    const topic = allTopics.find((entry) => entry.id === id);
    await page.goto(`${baseURL}/post/${id}`);
    for (const name of ["点赞", "收藏"]) {
      const action = page.getByRole("button", { name, exact: true });
      await action.click(); assert.equal(await action.getAttribute("aria-pressed"), "true");
      assert.match(await action.innerText(), /\+1/);
    }
    await page.reload();
    for (const name of ["点赞", "收藏"]) await page.waitForFunction((label) => document.querySelector(`.post-actions [aria-label="${label}"]`)?.getAttribute("aria-pressed") === "true", name);
    await freshPost(page);
    await page.goto(`${baseURL}/${topic.module}`);
    const card = page.locator(`a[href="/post/${id}"]`).filter({ hasText: topic.title }).first();
    await visible(card.getByText("已收藏", { exact: true }));
    if (topic.module === "trending") await visible(card.getByText("已赞", { exact: true }));
    await nav.getByRole("link", { name: "我的", exact: true }).click();
    await page.waitForURL("**/me");
    await page.getByRole("tab", { name: "收藏", exact: true }).click();
    await page.waitForURL("**/me?tab=favorites");
    const favorites = page.getByRole("list", { name: "我的收藏", exact: true });
    const favorite = favorites.getByRole("link");
    assert.equal(await favorite.getAttribute("href"), `/post/${id}`);
    await visible(favorite.getByText(topic.module === "trending" ? "热搜" : "发现", { exact: true }));
    geometry.push(await mobileGeometry(page, `${id} 我的收藏列表`));
    await favorite.click();
    await page.getByRole("group", { name: "帖子互动", exact: true }).scrollIntoViewIfNeeded();
    if (id === "H05" && viewport.width === 390) await versionScreenshot(page, "liked", packageVersion, { scrollToTop: false });
    const trigger = page.getByRole("button", { name: "转发", exact: true });
    await trigger.click();
    const sheet = page.getByRole("dialog", { name: "转发给好友", exact: true });
    assert.equal(await sheet.getAttribute("aria-modal"), "true");
    await visible(sheet.getByRole("link", { name: "转发给李白", exact: true }));
    await visible(sheet.getByRole("link", { name: "转发给杜甫", exact: true }));
    await visible(sheet.getByRole("button", { name: "复制链接", exact: true }));
    await focused(sheet.getByRole("button", { name: "关闭转发弹层", exact: true }));
    await page.keyboard.press("Shift+Tab"); await focused(sheet.getByRole("textbox"));
    await page.keyboard.press("Tab"); await focused(sheet.getByRole("button", { name: "关闭转发弹层", exact: true }));
    const sheetBox = await sheet.boundingBox();
    const navBox = await page.locator(".bottom-tabs").boundingBox();
    assert.ok(sheetBox.y + sheetBox.height <= navBox.y + 1, "转发弹层应保留底部标签栏的可视区域");
    geometry.push(await mobileGeometry(page, `${id} 转发弹层`));
    if (id === "H05" && viewport.width === 390) await versionScreenshot(page, "share-sheet", packageVersion, { scrollToTop: false });
    await page.keyboard.press("Escape"); assert.equal(await sheet.count(), 0); await focused(trigger);
    await trigger.click(); await page.mouse.click(4, 4); assert.equal(await sheet.count(), 0); await focused(trigger);
    await trigger.click();
    if (process.env.E2E_BASE_URL) await page.route("**/api/chat", (route) => route.fulfill({ status: 503, json: { error: "好友暂时不在线" } }));
    const offline = page.waitForResponse((response) => response.url().endsWith("/api/chat"));
    await sheet.getByRole("link", { name: `转发给${friendName}`, exact: true }).click();
    await page.waitForURL(new RegExp(`/friends/${friendId}(?:\\?|$)`));
    const response = await offline;
    assert.equal(response.status(), 503);
    assert.equal(response.request().postDataJSON().sharedTopicId, id);
    const shareCard = page.getByRole("link", { name: `分享卡片：${topic.title}`, exact: true });
    await visible(shareCard); assert.equal(await shareCard.getAttribute("href"), `/post/${id}`);
    await visible(page.getByText("好友暂时不在线", { exact: true }));
    geometry.push(await mobileGeometry(page, `${id} 分享卡片与离线好友`));
    let calls = 0;
    const countCalls = (request) => { if (request.url().endsWith("/api/chat")) calls++; };
    page.on("request", countCalls);
    await page.reload(); await visible(shareCard);
    assert.equal(await page.locator(".chat-share-card").count(), 1); assert.equal(calls, 0, "刷新不重复请求好友");
    page.off("request", countCalls);
    await shareCard.click(); await freshPost(page);
    await page.goto(`${baseURL}/friends/${friendId}`);
    await page.getByRole("button", { name: "清空对话", exact: true }).click();
    await page.reload(); assert.equal(await page.locator(".chat-share-card").count(), 0);
    if (process.env.E2E_BASE_URL) await page.unroute("**/api/chat");
    await page.goto(`${baseURL}/post/${id}`);
    for (const name of ["点赞", "收藏"]) {
      const action = page.getByRole("button", { name, exact: true });
      await page.waitForFunction((label) => document.querySelector(`.post-actions [aria-label="${label}"]`)?.getAttribute("aria-pressed") === "true", name);
      await action.click(); assert.equal(await action.getAttribute("aria-pressed"), "false");
    }
    await page.goto(`${baseURL}/me?tab=favorites`);
    await visible(page.getByRole("link", { name: "去热搜榜看看", exact: true }));
  }
}

async function friendsFlow(page, viewport, geometry) {
  await page.goto(`${baseURL}/friends`);
  await visible(page.getByRole("heading", { name: "见字如面", exact: true }));
  await compactHeaderChecks(page, "好友");
  const navigation = page.getByRole("navigation", { name: "主导航", exact: true });
  await navigationChecks(page);
  assert.equal(await navigation.getByRole("link", { name: "好友", exact: true }).getAttribute("aria-current"), "page");
  assert.equal(await page.locator(".friends-list .friend-avatar").count(), 2);
  geometry.push(await mobileGeometry(page, "好友列表"));
  if (viewport.width === 390) await versionScreenshot(page, "friends", packageVersion);

  await page.getByRole("link", { name: "与李白对话", exact: true }).click();
  await visible(page.getByRole("heading", { name: "李白", exact: true }));
  assert.equal(await navigation.getByRole("link", { name: "好友", exact: true }).getAttribute("aria-current"), "page");
  assert.equal(await page.getByRole("link", { name: "返回好友列表", exact: true }).getAttribute("href"), "/friends");
  assert.equal(await page.locator(".chat-role-note").count(), 1);
  const input = page.getByRole("textbox", { name: "写给李白", exact: true });
  const send = page.getByRole("button", { name: "发送消息", exact: true });
  assert.equal(await input.getAttribute("maxlength"), "200");
  assert.equal(await send.isDisabled(), true);
  geometry.push(await mobileGeometry(page, "李白对话初始"));

  // 自启服务显式无 key，真实验证 503；外部服务始终 mock，避免使用其 AI 配置。
  if (process.env.E2E_BASE_URL) await page.route("**/api/chat", (route) => route.fulfill({ status: 503, json: { error: "好友暂时不在线" } }));
  await input.fill("你好");
  const offline = page.waitForResponse((response) => response.url().endsWith("/api/chat"));
  await send.click();
  assert.equal((await offline).status(), 503);
  await visible(page.locator(".chat-error").getByText("好友暂时不在线", { exact: true }));
  assert.equal(await input.inputValue(), "你好");
  geometry.push(await mobileGeometry(page, "好友无 key 503 保留草稿"));
  if (process.env.E2E_BASE_URL) await page.unroute("**/api/chat");

  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  let status = 200;
  let reply = "此事吾记不真切了，换个话头可好？";
  const sent = [];
  await page.route("**/api/chat", async (route) => {
    sent.push(route.request().postDataJSON());
    await gate;
    await route.fulfill({ status, json: status === 200 ? { reply } : { error: "不展示的上游错误" } });
  });
  try {
    await page.getByRole("button", { name: "重试发送", exact: true }).click();
    await visible(page.getByRole("status").filter({ hasText: "正在回信" }));
    assert.equal(await send.isDisabled(), true);
    assert.equal(await page.locator(".chat-message-user").getByText("我", { exact: true }).count(), 1, "发送中的自己消息只显示一处我");
    geometry.push(await mobileGeometry(page, "好友发送中"));
    release();
    await visible(page.getByRole("log").getByText(reply, { exact: true }));
    assert.equal(await input.inputValue(), "");
    assert.equal(await page.locator(".chat-message-user").count(), 1, "失败重试不得重复插入用户消息");
    assert.equal(await page.locator(".chat-message-user").getByText("我", { exact: true }).count(), 1, "发送后的自己消息只显示一处我");
    assert.deepEqual(sent[0], { friendId: "libai", message: "你好", history: [] });
    const sides = await page.evaluate(() => {
      const assistant = document.querySelector(".chat-message-assistant .friend-avatar").getBoundingClientRect();
      const user = document.querySelector(".chat-self-avatar").getBoundingClientRect();
      const input = document.querySelector(".chat-composer").getBoundingClientRect();
      const tabs = document.querySelector(".bottom-tabs").getBoundingClientRect();
      return { assistantX: assistant.x, userX: user.x, composerBottom: input.bottom, tabsTop: tabs.top };
    });
    assert.ok(sides.userX > sides.assistantX, "自己在右、好友在左");
    assert.ok(sides.composerBottom <= sides.tabsTop, "输入框不得被导航遮挡");
    geometry.push({ ...await mobileGeometry(page, "好友 mock 回复"), sides });
    if (viewport.width === 390) {
      // mock 对话截图只留在 artifacts；指定交付截图仅为好友列表。
      await page.screenshot({ path: path.join(screenshots, `v${packageVersion}-chat-mock-390x844.png`), animations: "disabled" });
    }
    reply = "此事吾不敢妄言。".repeat(120);
    await input.fill("还有呢？");
    await send.click();
    await visible(page.getByRole("log").getByText(reply, { exact: true }));
    assert.equal(sent[1].history.length, 2);
    geometry.push(await mobileGeometry(page, "好友长回复"));
    for (const failure of [429, 502, 504]) {
      status = failure;
      await input.fill("消息保留");
      const pending = page.waitForResponse((response) => response.url().endsWith("/api/chat"));
      await send.click();
      assert.equal((await pending).status(), failure);
      await visible(page.locator(".chat-error"));
      assert.equal(await input.inputValue(), "消息保留");
      assert.ok(!(await page.locator(".chat-error").textContent()).includes("上游错误"));
      geometry.push(await mobileGeometry(page, `好友 ${failure} 重试状态`));
    }
  } finally { release(); await page.unroute("**/api/chat"); }
  await page.reload();
  await visible(page.getByRole("heading", { name: "李白", exact: true }));
  assert.equal(await page.locator(".chat-message-user").count(), 2, "刷新后保留成功发送的本机对话");
  await page.getByRole("button", { name: "清空对话", exact: true }).click();
  await page.reload();
  assert.equal(await page.locator(".chat-message-user").count(), 0, "清空后刷新仍为空");
  assert.equal(await input.inputValue(), "");
  await page.getByRole("link", { name: "返回好友列表", exact: true }).click();
  await page.getByRole("link", { name: "与杜甫对话", exact: true }).click();
  await visible(page.getByRole("heading", { name: "杜甫", exact: true }));
  geometry.push(await mobileGeometry(page, "杜甫对话初始"));
  const missing = await page.goto(`${baseURL}/friends/missing-friend`);
  assert.equal(missing.status(), 404);
  await visible(page.getByRole("heading", { name: "这位好友还没加入", exact: true }));
  geometry.push(await mobileGeometry(page, "未知好友 404"));
}

async function focusVisible(locator) {
  assert.ok(await locator.evaluate((node) => node.matches(":focus-visible") && getComputedStyle(node).outlineStyle !== "none" && parseFloat(getComputedStyle(node).outlineWidth) >= 2), "缺少清晰的键盘焦点样式");
}

// 核对实际可点击范围；原生 radio 的触控范围为关联的整张 label。
async function mobileGeometry(page, state) {
  await visible(page.locator(".app-shell"));
  await noOverflow(page);
  await navigationChecks(page);
  await noDisclaimerLabels(page);
  await noHashtagTitles(page);
  await noAuxiliaryContent(page);
  const small = await page.evaluate(() => {
    const root = document.querySelector("dialog[open]") || document;
    return [...root.querySelectorAll('a[href], button, input, textarea, summary')].flatMap((node) => {
      if (!node.checkVisibility() || node.classList.contains("sr-only")) return [];
      const target = node instanceof HTMLInputElement && node.type === "radio" ? node.closest("label") : node;
      const { width, height } = target.getBoundingClientRect();
      return width < 44 - 0.1 || height < 44 - 0.1 ? [{ text: node.textContent?.trim().slice(0, 80) || node.getAttribute("aria-label") || node.type, width, height }] : [];
    });
  });
  assert.deepEqual(small, [], `${state} 存在小于 44px 的触控目标`);
  const viewport = page.viewportSize();
  const shell = await page.locator(".app-shell").boundingBox();
  assert.ok(shell.width <= 430 && Math.abs(shell.x + shell.width / 2 - viewport.width / 2) < 1, "手机列未居中或超过 430px");
  if (!await page.getByRole("dialog").count()) {
    const tabs = await page.getByRole("navigation", { name: "主导航", exact: true }).boundingBox();
    assert.ok(Math.abs(tabs.y + tabs.height - viewport.height) < 1 && Math.abs(tabs.width - shell.width) < 1, "底部导航未固定在手机列底部");
  }
  return { state, viewport, horizontalOverflow: false, touchTargets: ">=44px", noAuxiliaryContent: true, noHashtagTitles: true };
}

async function coverGeometry(page, route) {
  const list = route === "/trending" ? '[aria-label="热搜排行"]' : '[aria-label="发现话题"]';
  const coverSelector = route === "/trending" ? `${list} .trending-thumbnail` : `${list} > li > a > img`;
  const covers = await page.locator(coverSelector).evaluateAll((images) => images.map((image) => {
    const { width, height, left, right } = image.getBoundingClientRect();
    const link = image.closest("a").getBoundingClientRect();
    const heading = image.closest("a").querySelector("h2, h3");
    return {
      width, height, objectFit: getComputedStyle(image).objectFit,
      loaded: image.complete && image.naturalWidth > 0,
      contained: left >= link.left && right <= link.right,
      titleClipped: heading.scrollWidth > heading.clientWidth || heading.scrollHeight > heading.clientHeight,
      titleHorizontalOverflow: heading.scrollWidth > heading.clientWidth,
      titleHeight: heading.getBoundingClientRect().height,
      titleLineHeight: parseFloat(getComputedStyle(heading).lineHeight),
      titleLineClamp: getComputedStyle(heading).webkitLineClamp,
    };
  }));
  assert.equal(covers.length, route === "/trending" ? trendingTopics.length : discoverTopics.length, `${route} 封面数量不正确`);
  for (const cover of covers) {
    assert.ok(cover.loaded && cover.contained && !cover.titleHorizontalOverflow, `${route} 封面未加载、越界或标题横向溢出`);
    assert.ok(Math.abs(cover.width / cover.height - 16 / 9) < 0.01, `${route} 封面未保持 16:9`);
    assert.equal(cover.objectFit, "contain", `${route} 封面应完整展示，避免裁切内嵌标题`);
    assert.equal(cover.titleLineClamp, "2", `${route} 标题必须最多两行`);
    assert.ok(cover.titleHeight <= cover.titleLineHeight * 2 + 1, `${route} 标题超过两行`);
    if (route === "/trending") {
      assert.ok(cover.width >= 88 && cover.width <= 112, "热搜榜缩略图宽度应为 88–112px");
      assert.equal(cover.titleLineClamp, "2", "热榜标题必须最多两行");
      assert.ok(cover.titleHeight <= cover.titleLineHeight * 2 + 1, "热榜标题超过两行");
    }
  }
  return covers;
}

async function discoverChecks(page) {
  const layout = await page.getByRole("list", { name: "发现话题", exact: true }).evaluate((list) => {
    const cards = [...list.children];
    const rows = cards.map((card) => {
      const box = card.getBoundingClientRect();
      const byline = card.querySelector(".discover-byline");
      const likes = byline.querySelector(".discover-likes").getBoundingClientRect();
      const author = byline.querySelector(".discover-author").getBoundingClientRect();
      const avatar = byline.querySelector("img");
      return { x: box.x, y: box.y, bottom: box.bottom, width: box.width, breakInside: getComputedStyle(card).breakInside,
        avatarRound: getComputedStyle(avatar).borderRadius === "50%", likesRight: likes.left >= author.right,
        bylineContained: byline.scrollWidth <= byline.clientWidth,
        likeIcon: byline.querySelectorAll('svg[data-social-icon="like"]').length,
        links: card.querySelectorAll("a").length, buttons: card.querySelectorAll('button, [role="button"]').length };
    });
    // 用一行短标题验证卡片高度由内容决定，下一张紧跟，不受另一列行高约束。
    const title = cards[0].querySelector("h2");
    const original = title.textContent;
    title.textContent = "街巷见闻";
    const first = cards[0].getBoundingClientRect();
    const next = cards[1].getBoundingClientRect();
    const naturalGap = next.top - first.bottom;
    title.textContent = original;
    return { columns: getComputedStyle(list).columnCount, rows, naturalGap };
  });
  assert.equal(layout.columns, "2", "发现页必须为两列瀑布流");
  assert.equal(new Set(layout.rows.map(({ x }) => x)).size, 2);
  assert.ok(Math.abs(layout.naturalGap - 10) < 1, "瀑布流应根据卡片实际高度连续排列");
  for (const card of layout.rows) {
    assert.equal(card.breakInside, "avoid");
    assert.ok(card.avatarRound && card.likesRight && card.bylineContained, "发现卡片作者/点赞行越界或头像不圆");
    assert.equal(card.likeIcon, 1);
    assert.equal(card.links, 1);
    assert.equal(card.buttons, 0);
  }
  for (const card of await page.locator(".discover-card").evaluateAll((nodes) => nodes.map((node) => ({ radius: parseFloat(getComputedStyle(node).borderRadius), shadow: getComputedStyle(node).boxShadow })))) {
    assert.ok(card.radius >= 20 && card.shadow !== "none", "发现卡片需要大圆角与阴影");
  }
  return layout;
}

async function postSocialChecks(page, topic) {
  const article = page.locator("article[data-format]");
  const news = topic.module === "trending";
  assert.equal(await article.getAttribute("data-module"), topic.module);
  const sections = await article.evaluate((node) => [...node.children].map((child) => child.getAttribute("data-post-section")));
  assert.deepEqual(sections, news ? ["masthead", "title", "byline", "lead", "cover", "body", "related", "actions"] : ["author", "format", "title", "cover", "body", "actions"]);
  if (news) {
    assert.equal(await article.locator(".news-lead").textContent(), topic.news.lead);
    assert.ok((await article.locator(".news-byline").textContent()).includes(topic.news.outlet));
    assert.equal(await article.locator("time").getAttribute("datetime"), topic.news.publishedAt);
    assert.equal(await article.getByRole("region", { name: "相关报道" }).locator("li").count(), 2);
    for (const text of topic.news.related) assert.ok((await article.locator(".news-related").textContent()).includes(text));
    assert.equal(await page.locator(".news-experience .social-stats, .news-experience .author-row, .news-experience .comments-panel, [data-reply-id], .follow-button").count(), 0);
    assert.doesNotMatch(await article.innerText(), /\p{Extended_Pictographic}|\p{Regional_Indicator}|[\u20e3\ufe0f]/u, "新闻稿不得出现 emoji");
    assert.doesNotMatch(await article.innerText(), /家人们|谁懂啊|顶流|塑料友情|小板凳|在线蹲/);
  } else {
    const header = article.locator(".author-row").first();
    assert.equal(await header.locator(".author-handle").textContent(), topic.author.handle);
    assert.equal(await header.locator(".author-badge").textContent(), "作者");
    assert.match(await header.locator(".author-time").textContent(), /^\d+(分钟|小时|天)$/);
    assert.ok(await header.evaluate((node) => node.closest("article").firstElementChild.contains(node) && getComputedStyle(node.querySelector(".author-avatar")).borderRadius === "50%"));
    assert.equal(await article.getByRole("button", { name: `关注${topic.author.name}`, exact: true }).count(), 1);
    const actions = article.getByRole("group", { name: "帖子互动" });
    assert.equal(await actions.getByRole("button").count(), 3);
    for (const name of ["点赞", "收藏"]) assert.equal(await actions.getByRole("button", { name, exact: true }).count(), 1);
    assert.equal(await actions.getByRole("button", { name: /^转发/ }).count(), 1);
    assert.match(await article.innerText(), /\p{Extended_Pictographic}/u);
    for (const reply of topic.comments[0].replies) {
      const node = page.locator(`[data-reply-id="${reply.id}"]`);
      assert.equal(await node.getAttribute("data-reply-to"), reply.replyTo);
      assert.ok((await node.locator(":scope > .reply-text").textContent()).includes(reply.text));
      assert.equal(await node.locator(":scope > .author-row .author-badge").count(), reply.author === topic.author.name ? 1 : 0);
      const parent = await node.evaluate((node) => node.parentElement.parentElement.getAttribute("data-reply-id"));
      assert.equal(parent, reply.replyTo === topic.comments[0].id ? null : reply.replyTo);
    }
    assert.equal(await page.locator("#post-comments > li > .author-row").count(), await page.locator("#post-comments > li").count());
  }
  assert.equal(await article.locator("h1").count(), 1);
  assert.equal(await article.locator(".post-body").count(), 1);
  assert.equal(await article.locator(".post-cover").count(), 1);
  assert.equal(await article.locator('[data-post-section="body"] .post-cover').count(), 0);
  const cover = article.locator(".post-cover img");
  await cover.evaluate((image) => image.decode());
  assert.ok(await cover.evaluate((image) => {
    const box = image.getBoundingClientRect();
    return Math.abs(box.width / box.height - image.naturalWidth / image.naturalHeight) < 0.01 && getComputedStyle(image).objectFit === "contain";
  }), "配图应保持原比例完整显示");
  const style = await article.evaluate((node) => ({ radius: parseFloat(getComputedStyle(node).borderRadius), accent: getComputedStyle(node).getPropertyValue("--accent").trim(), bodyLineHeight: parseFloat(getComputedStyle(node.querySelector(".post-body")).lineHeight), bodyWidth: node.querySelector(".post-body").getBoundingClientRect().width }));
  assert.equal(style.accent, news ? "#244f68" : "#c85c41");
  assert.ok(news ? style.radius === 0 && style.bodyLineHeight >= 32 : style.radius >= 24);
  if (news) assert.ok(style.bodyWidth >= (await page.locator(".app-shell").boundingBox()).width - 50.1, "新闻正文应使用较宽文本栏");
  return { module: topic.module, sections, ...style, noNewsEmoji: news, authorThreads: !news };
}

async function localSocialChecks(page, topic, geometry) {
  const before = await page.evaluate(() => localStorage.getItem("ahsd:progress:v1"));
  let calls = 0;
  const onRequest = (request) => { if (new URL(request.url()).pathname.startsWith("/api/")) calls++; };
  page.on("request", onRequest);
  try {
    const follow = page.getByRole("button", { name: `关注${topic.author.name}`, exact: true });
    if (await follow.getAttribute("aria-pressed") === "true") await follow.click();
    await follow.click();
    assert.equal(await follow.getAttribute("aria-pressed"), "true");
    assert.equal(await page.evaluate((handle) => localStorage.getItem(`ahsd:following:v1:${handle}`), topic.author.handle), "true");
    await page.reload();
    await page.waitForFunction(() => document.querySelector(".follow-button")?.getAttribute("aria-pressed") === "true");
    assert.equal(await follow.textContent(), "已关注");
    await follow.click();
    assert.equal(await follow.getAttribute("aria-pressed"), "false");
    for (const name of ["点赞", "收藏"]) {
      const button = page.getByRole("button", { name, exact: true });
      await button.click();
      assert.equal(await button.getAttribute("aria-pressed"), "true");
      await button.click();
      assert.equal(await button.getAttribute("aria-pressed"), "false");
    }
    await page.getByRole("button", { name: /^转发/ }).click();
    assert.equal(await page.getByLabel("把这条见闻分享给朋友", { exact: true }).inputValue(), page.url());
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.getByRole("button", { name: "复制链接", exact: true }).click();
    await visible(page.getByRole("button", { name: "链接已复制", exact: true }));
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), page.url());
    geometry.push(await mobileGeometry(page, "发现关注切换/刷新恢复/取消及点赞收藏转发"));
    await page.getByRole("button", { name: "关闭转发弹层", exact: true }).click();
    assert.equal(await page.evaluate(() => localStorage.getItem("ahsd:progress:v1")), before);
    assert.equal(calls, 0, "关注及帖子互动不能请求 API 或影响判题");
  } finally { page.off("request", onRequest); }
}

async function trendingChecks(page, keyboard = false) {
  const tabs = page.getByRole("tablist", { name: "热榜分类", exact: true });
  const list = page.getByRole("list", { name: "热搜排行", exact: true });
  const categories = [...new Set(trendingTopics.map((topic) => topic.category))];
  assert.deepEqual(await tabs.getByRole("tab").allTextContents(), ["全部", ...categories]);
  assert.ok(await tabs.evaluate((node) => node.scrollWidth > node.clientWidth && getComputedStyle(node).overflowX === "auto"), "分类应在栏内横向滚动");

  const ranks = await list.getByTestId("trending-rank").evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).color));
  assert.deepEqual(ranks, trendingTopics.map(({ rank }) => rank === 1 ? "rgb(36, 79, 104)" : rank === 2 ? "rgb(59, 100, 123)" : rank === 3 ? "rgb(76, 107, 125)" : "rgb(153, 150, 157)"), "排名采用墨蓝、石青与灰色");
  const rankThreeContrast = await list.locator(".trending-rank-3").evaluate((node) => {
    const luminance = (rgb) => rgb.match(/[\d.]+/g).slice(0, 3).map(Number).map((value) => value / 255).map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
    const foreground = getComputedStyle(node).color;
    const backgrounds = [getComputedStyle(node.closest(".trending-list")).backgroundColor, getComputedStyle(document.body).backgroundColor];
    const ratios = backgrounds.map((color) => (Math.max(luminance(foreground), luminance(color)) + 0.05) / (Math.min(luminance(foreground), luminance(color)) + 0.05));
    return { foreground, backgrounds, ratios };
  });
  assert.ok(rankThreeContrast.ratios.every((ratio) => ratio >= 4.5), `排名第 3 对比度不足：${JSON.stringify(rankThreeContrast)}`);
  const quarter = Math.ceil(trendingTopics.length / 4);
  const tagFor = (rank) => rank <= quarter ? "爆" : rank > trendingTopics.length - quarter ? "新" : "热";
  const tagColors = { 爆: "rgb(36, 79, 104)", 热: "rgb(66, 108, 131)", 新: "rgb(217, 231, 237)" };
  const capsules = await list.getByTestId("trending-tag").evaluateAll((nodes) => nodes.map((node) => ({
    text: node.textContent, background: getComputedStyle(node).backgroundColor,
    radius: parseFloat(getComputedStyle(node).borderRadius), color: getComputedStyle(node).color,
    icon: node.querySelector('svg[aria-hidden="true"][focusable="false"]')?.getAttribute("data-status-icon"),
  })));
  assert.deepEqual(capsules.map(({ text }) => text), trendingTopics.map(({ rank }) => tagFor(rank)));
  for (const capsule of capsules) {
    assert.equal(capsule.icon, { 爆: "burst", 热: "flame", 新: "spark" }[capsule.text], "胶囊需文字和不同图标双编码");
    assert.equal(capsule.background, tagColors[capsule.text]);
    assert.equal(capsule.color, capsule.text === "新" ? "rgb(36, 79, 104)" : "rgb(255, 255, 255)");
    assert.equal(capsule.radius, 2, "新闻标签使用小圆角");
  }
  assert.doesNotMatch(await list.innerText(), /\p{Extended_Pictographic}/u);
  for (const [index, row] of (await list.locator(":scope > li").all()).entries()) {
    const topic = trendingTopics[index];
    assert.ok((await row.locator(".trending-byline").textContent()).includes(topic.news.outlet));
    assert.equal(await row.locator("time").getAttribute("datetime"), topic.news.publishedAt);
    assert.equal(await row.locator(".trending-lead").textContent(), topic.news.lead);
    assert.equal(await row.locator(".trending-lead").evaluate((node) => getComputedStyle(node).whiteSpace), "nowrap");
  }
  const progressBefore = await page.getByRole("status").textContent();
  for (const category of categories) {
    const tab = tabs.getByRole("tab", { name: category, exact: true });
    await tab.click();
    assert.equal(await tab.getAttribute("aria-selected"), "true");
    assert.equal(await tabs.getByRole("tab", { selected: true }).count(), 1);
    assert.ok(await tab.evaluate((node) => parseFloat(getComputedStyle(node, "::after").height) >= 3 && getComputedStyle(node, "::after").backgroundColor !== "rgba(0, 0, 0, 0)"), "选中分类缺少下划线");
    const panel = page.getByRole("tabpanel", { name: category, exact: true });
    assert.equal(await tab.getAttribute("aria-controls"), await panel.getAttribute("id"));
    const expected = trendingTopics.filter((topic) => topic.category === category);
    assert.deepEqual(await list.getByRole("link").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("href"))), expected.map(({ id }) => `/post/${id}`));
    assert.deepEqual(await list.getByTestId("trending-rank").allTextContents(), expected.map(({ rank }) => String(rank)), "筛选必须保留全榜名次");
    assert.deepEqual(await list.getByTestId("trending-tag").allTextContents(), expected.map(({ rank }) => tagFor(rank)), "筛选必须保留全榜标签");
    assert.equal(await page.getByRole("status").textContent(), progressBefore, "分类筛选不应改变本机进度");
    assert.equal(await page.getByRole("progressbar", { name: "已查证题目", exact: true }).getAttribute("max"), String(allTopics.length));
    await noOverflow(page);
  }
  const all = tabs.getByRole("tab", { name: "全部", exact: true });
  await all.click();
  assert.equal(await list.getByRole("listitem").count(), trendingTopics.length);
  if (keyboard) {
    await all.focus();
    for (const [key, name] of [["ArrowRight", categories[0]], ["ArrowLeft", "全部"], ["ArrowLeft", categories.at(-1)], ["ArrowRight", "全部"], ["End", categories.at(-1)], ["Home", "全部"]]) {
      await page.keyboard.press(key);
      const selected = tabs.getByRole("tab", { name, exact: true });
      await focused(selected);
      await focusVisible(selected);
      assert.equal(await selected.getAttribute("aria-selected"), "true");
      assert.equal(await tabs.locator('[tabindex="0"]').count(), 1);
      const box = await selected.boundingBox();
      const tabBox = await tabs.boundingBox();
      assert.ok(box.x >= tabBox.x - 1 && box.x + box.width <= tabBox.x + tabBox.width + 1, "键盘选中项未滚动到分类栏可见范围");
    }
    await page.keyboard.press("Enter");
    await page.keyboard.press("Space");
    assert.equal(await all.getAttribute("aria-selected"), "true");
    await page.keyboard.press("Tab");
    await focused(page.getByRole("link", { name: "我的 →", exact: true }));
    await page.keyboard.press("Shift+Tab");
    await focused(all);
  }
  await page.evaluate(() => {
    document.activeElement?.blur();
    document.querySelector('[role="tablist"]').scrollLeft = 0;
    window.scrollTo(0, 0);
  });
  return { categories, filters: "逐类匹配、全部恢复、保留原排名/标签与全题库进度", ranks, rankThreeContrast, capsules, keyboard };
}

async function collectionCount(page, count) {
  await visible(page.getByRole("status").filter({ hasText: new RegExp(`^已查证 ${count}/${scenarios.length}$`) }));
  const meter = page.getByRole("progressbar", { name: "已查证题目", exact: true });
  assert.equal(await meter.getAttribute("value"), String(count));
  assert.equal(await meter.getAttribute("max"), String(scenarios.length));
}

async function stickerCollectionFlow(page, viewport, geometry) {
  const navigation = page.getByRole("navigation", { name: "主导航", exact: true });
  const stickers = page.getByRole("list", { name: "贴纸收藏", exact: true });
  await page.goto(`${baseURL}/trending`);
  await collectionCount(page, 0);
  await page.getByRole("main").getByRole("link", { name: "我的 →", exact: true }).click();
  await page.waitForURL("**/me");
  await collectionCount(page, 0);
  assert.equal(await stickers.locator(":scope > li").count(), scenarios.length);
  assert.equal(await stickers.getByRole("link").count(), 0);
  assert.equal(await stickers.getByText("未解锁 · 提交判断后收集", { exact: true }).count(), scenarios.length);
  geometry.push(await mobileGeometry(page, "贴纸墙全部锁定"));
  const start = page.getByRole("link", { name: "从热榜第 1 条开始", exact: true });
  const firstTopic = trendingTopics.find(({ rank }) => rank === 1);
  assert.equal(await start.getAttribute("href"), `/post/${firstTopic.id}`);
  if (viewport.width === 390) await versionScreenshot(page, "stickers-empty", packageVersion);
  await start.click();
  await page.waitForURL(`**/post/${firstTopic.id}`);
  await visible(page.getByRole("heading", { level: 1, name: firstTopic.title, exact: true }));
  await navigation.getByRole("link", { name: "热搜榜", exact: true }).click();
  await page.waitForURL("**/trending");
  await page.locator('[aria-label="热搜排行"] a[href="/post/H03"]').click();
  await page.getByRole("radio", { name: "是假的", exact: true }).check();
  // 只选答案不解锁；返回后草稿也必须清空。
  await openMyStickers(page);
  await page.waitForURL("**/me?tab=stickers");
  await collectionCount(page, 0);
  assert.equal(await stickers.getByRole("link").count(), 0);
  await navigation.getByRole("link", { name: "热搜榜", exact: true }).click();
  await page.waitForURL("**/trending");
  await page.locator('[aria-label="热搜排行"] a[href="/post/H03"]').click();
  await freshPost(page);
  await page.getByRole("radio", { name: "是假的", exact: true }).check();
  await page.getByRole("button", { name: "提交判断", exact: true }).click();
  await visible(page.locator(".verdict-stamp"));
  await revealSummaryChecks(page, { correct: true, isTrue: false, firstScreen: viewport.width === 390 });
  await earnedSticker(page, "H03", 1);
  if (viewport.width === 390) await page.screenshot({ path: path.join(screenshots, "v0.9.0-reveal-390x844.png"), animations: "disabled" });
  await page.getByRole("region", { name: "本题贴纸", exact: true }).getByRole("link", { name: "去贴纸墙 →", exact: true }).click();
  await page.waitForURL("**/me?tab=stickers");
  await collectionCount(page, 1);
  assert.equal(await start.count(), 0, "已有贴纸时不应出现空态引导");
  await navigation.getByRole("link", { name: "热搜榜", exact: true }).click();
  await page.waitForURL("**/trending");
  await visible(page.locator(".trending-hero"));
  await collectionCount(page, 1);
  geometry.push(await mobileGeometry(page, "答一题后热榜进度 1/N"));
  if (viewport.width === 390) await page.screenshot({ path: path.join(screenshots, "trending-progress-390x844.png"), animations: "disabled" });
  await openMyStickers(page);
  await page.waitForURL("**/me?tab=stickers");
  assert.equal(await navigation.getByRole("link", { name: "我的", exact: true }).getAttribute("aria-current"), "page");
  await collectionCount(page, 1);
  assert.equal(await stickers.getByRole("link").count(), 1);
  assert.equal(await stickers.locator('[data-unlocked="false"]').count(), scenarios.length - 1);
  const unlocked = stickers.locator('[data-sticker-id="H03"]');
  assert.equal(await unlocked.getAttribute("data-unlocked"), "true");
  await visible(unlocked.getByText("已收藏 · 重新挑战 →", { exact: true }));
  geometry.push(await mobileGeometry(page, "贴纸墙解锁一枚"));
  if (viewport.width === 390) await page.screenshot({ path: path.join(screenshots, "stickers-390x844.png"), animations: "disabled" });
  await unlocked.getByRole("link").click();
  await page.waitForURL("**/post/H03");
  await freshPost(page);
  const saved = await page.evaluate(() => localStorage.getItem("ahsd:progress:v1"));
  await visible(page.getByText(`贴纸已收藏 · 已查证 1/${scenarios.length}，重玩不重复累计。`, { exact: true }));
  if (viewport.width === 390) {
    await page.locator(".task-panel").evaluate((panel) => panel.scrollIntoView({ block: "start", behavior: "instant" }));
    await versionScreenshot(page, "revisit", "0.13.2", { scrollToTop: false });
  }
  // 使用与首次相反的答案重答，仍只有一枚贴纸，也不覆盖首次完成记录。
  await page.getByRole("radio", { name: "是真的", exact: true }).check();
  assert.equal(await page.evaluate(() => localStorage.getItem("ahsd:progress:v1")), saved);
  await page.getByRole("button", { name: "提交判断", exact: true }).click();
  await visible(page.getByText("这次答错了，带走一个新知识。", { exact: true }));
  assert.equal(await page.getByText(/获得贴纸/).count(), 0);
  await visible(page.getByText("饭局手记 · 已收藏", { exact: true }));
  await replayPost(page, scenarios.find(({ id }) => id === "H03"), geometry);
  await page.getByRole("radio", { name: "是假的", exact: true }).check();
  await page.getByRole("button", { name: "提交判断", exact: true }).click();
  await visible(page.locator(".verdict-stamp"));
  await openMyStickers(page);
  await page.waitForURL("**/me?tab=stickers");
  await collectionCount(page, 1);
  // 子标签替换当前 URL，后退一步回到帖子并验证缓存中的帖子重置。
  await page.goBack();
  await page.waitForURL("**/post/H03");
  await freshPost(page);
  assert.equal(await page.evaluate(() => localStorage.getItem("ahsd:progress:v1")), saved);
  await page.goForward();
  await page.waitForURL("**/me?tab=stickers");
  await collectionCount(page, 1);
  await navigation.getByRole("link", { name: "热搜榜", exact: true }).click();
  await page.waitForURL("**/trending");
  await page.locator('[aria-label="热搜排行"] a[href="/post/H03"]').click();
  await page.waitForURL("**/post/H03");
  await freshPost(page);
  await openMyStickers(page);
  await page.waitForURL("**/me?tab=stickers");
  await collectionCount(page, 1);
  await page.reload();
  await collectionCount(page, 1);
  assert.equal(await stickers.getByRole("link").count(), 1);
  geometry.push(await mobileGeometry(page, "贴纸墙刷新保留进度，重进/历史返回/重玩去重"));
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await collectionCount(page, 0);
  assert.equal(await stickers.getByRole("link").count(), 0);
  geometry.push(await mobileGeometry(page, "清除本机存储后贴纸归零"));
  await visible(start);
}

async function screenshotAt(page, locator, filename) {
  await locator.evaluate((node) => {
    const headerHeight = document.querySelector("header").getBoundingClientRect().height;
    window.scrollTo({ top: node.getBoundingClientRect().top + window.scrollY - headerHeight - 16, behavior: "instant" });
  });
  await page.screenshot({ path: path.join(screenshots, filename), animations: "disabled" });
}

async function bottomNavigationAtEnd(page) {
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
  const box = await page.getByRole("main").boundingBox();
  const nav = page.getByRole("navigation", { name: "主导航", exact: true });
  const navBox = await nav.boundingBox();
  assert.ok(box.y + box.height <= navBox.y, "底部 Tab 遮挡页面末尾内容");
  const link = nav.getByRole("link", { name: "发现", exact: true });
  assert.ok(await link.evaluate((node) => {
    const box = node.getBoundingClientRect();
    return node.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
  }), "底部导航被遮挡");
  await link.click();
  await page.waitForURL("**/discover");
  assert.equal(await link.getAttribute("aria-current"), "page");
}

async function askStates(page) {
  // 仅 AI 布局状态使用浏览器 mock，避免消耗模型额度；判题和 PNG 均走真实服务。
  let release;
  let calls = 0;
  const handler = async (route) => {
    calls++;
    if (calls === 1) {
      await new Promise((resolve) => { release = resolve; });
      await route.fulfill({ status: 503, json: { error: "test" } });
    } else if (calls === 2) {
      await route.fulfill({ status: 409, json: { error: "test" } });
    } else {
      await route.fulfill({ json: { answer: "浏览器布局测试（mock）：" + "长文本换行".repeat(30) + " https://example.test/" + "a".repeat(180), citedSourceIds: ["S-H03-02"], grounded: true, preview: true } });
    }
  };
  await page.route("**/api/ask", handler);
  try {
    await page.getByRole("link", { name: "问问 AI", exact: true }).click();
    await focused(page.locator("#ask-heading"));
    await page.waitForFunction(() => document.querySelector("#ask-heading").getBoundingClientRect().top >= document.querySelector(".shell-header").getBoundingClientRect().bottom);
    const input = page.getByRole("textbox", { name: "向值班史官提问" });
    const question = "手机布局测试问题";
    await input.fill(question);
    await page.getByRole("button", { name: "发送问题", exact: true }).click();
    await visible(page.getByText("值班史官正在查阅资料…", { exact: true }));
    await mobileGeometry(page, "AI loading");
    release();
    const alert = page.locator('[aria-labelledby="ask-heading"]').getByRole("alert");
    await visible(alert);
    assert.equal(await alert.textContent(), "AI 未配置");
    assert.equal(await input.inputValue(), question);
    await mobileGeometry(page, "AI error");
    await page.getByRole("button", { name: "重试提问", exact: true }).click();
    await visible(page.getByText("本条内容审核中，暂不开放追问", { exact: true }));
    await page.getByRole("link", { name: "返回揭晓", exact: true }).click();
    await focused(page.locator("#reveal-heading"));
    assert.equal(await input.inputValue(), question);
    await page.getByRole("link", { name: "问问 AI", exact: true }).click();
    await focused(page.locator("#ask-heading"));
    await page.getByRole("button", { name: "重试提问", exact: true }).click();
    await visible(page.getByText(/^浏览器布局测试（mock）：/));
    await visible(page.getByText("开发预览", { exact: true }));
    assert.equal(await page.getByText("开发预览·资料待审核", { exact: true }).count(), 0);
    await mobileGeometry(page, "AI response + long URL");
    assert.equal(await input.inputValue(), "");
  } finally {
    release?.();
    await page.unroute("**/api/ask", handler);
  }
}

async function previewBuildChecks(buildId) {
  const probe = createServer();
  await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
  const previewPort = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  const previewURL = `http://127.0.0.1:${previewPort}`;
  const previewServer = spawn(process.execPath, ["scripts/check-port.mjs", "--start", "-H", "127.0.0.1", "-p", String(previewPort)], {
    env: { ...process.env, CONTENT_MODE: "preview", AI_API_KEY: "" }, stdio: ["ignore", "pipe", "pipe"],
  });
  for (const stream of [previewServer.stdout, previewServer.stderr]) stream.on("data", (data) => { serverLog += data.toString(); });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  try {
    let ready = false;
    for (let attempt = 0; attempt < 60; attempt++) {
      assert.equal(previewServer.exitCode, null, "preview 服务启动失败");
      try { ready = (await fetch(`${previewURL}/trending`)).ok; } catch { /* 服务启动中 */ }
      if (ready) break;
      await setTimeout(250);
    }
    assert.ok(ready, "preview 服务未就绪");
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    for (const route of ["/trending", "/discover", "/me", "/me?tab=favorites", "/post/H03"]) {
      await page.goto(`${previewURL}${route}`);
      assert.equal(await page.getByText("开发预览：本条史实尚待人工审核", { exact: true }).count(), 0);
      const footer = page.getByRole("contentinfo", { name: "预览构建信息" });
      assert.ok((await footer.textContent()).includes(`v${packageVersion}`));
      assert.ok((await footer.textContent()).includes(buildId), "预览页脚的构建 ID 与 .next/BUILD_ID 不一致");
      await noOverflow(page);
    }
    await page.getByRole("radio", { name: "是假的", exact: true }).check();
    await page.getByRole("button", { name: "提交判断", exact: true }).click();
    await visible(page.getByRole("link", { name: "问问 AI", exact: true }));
    await page.getByRole("link", { name: "问问 AI", exact: true }).click();
    await focused(page.locator("#ask-heading"));
    await page.getByRole("textbox").fill("唐朝人用什么调料获得辛辣味？");
    for (const button of ["发送问题", "重试提问"]) {
      const pending = page.waitForResponse((response) => response.url().endsWith("/api/ask"));
      await page.getByRole("button", { name: button, exact: true }).click();
      assert.equal((await pending).status(), 503);
      await visible(page.getByText("AI 未配置", { exact: true }));
    }
    const filename = `v${packageVersion}-ai-390x844.png`;
    await screenshotAt(page, page.locator('[aria-labelledby="ask-heading"]'), filename);
    if (reviewDir) await copyFile(path.join(screenshots, filename), path.join(reviewDir, filename));
    await page.getByRole("link", { name: "返回揭晓", exact: true }).click();
    await focused(page.locator("#reveal-heading"));
    assert.equal(await page.getByRole("textbox").inputValue(), "唐朝人用什么调料获得辛辣味？");
    assert.deepEqual(errors, [], "preview 浏览器运行错误");
    return { version: packageVersion, buildId, routes: 4, unconfiguredStatus: 503, retried: true, returned: true };
  } finally {
    await context.close();
    const stopped = new Promise((resolve) => previewServer.once("exit", resolve));
    previewServer.kill("SIGTERM");
    await stopped;
  }
}

async function revealScreenshot(page, filename) {
  await visible(page.locator(".verdict-stamp"));
  await page.locator(".reveal-panel").evaluate((node) => {
    const headerHeight = document.querySelector("header").getBoundingClientRect().height;
    window.scrollTo(0, node.getBoundingClientRect().top + window.scrollY - headerHeight - 24);
  });
  await page.screenshot({ path: path.join(screenshots, filename), animations: "disabled" });
}

async function dialogKeyboard(page) {
  const trigger = page.getByRole("button", { name: "生成查证卡", exact: true });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "查证卡预览" });
  await visible(dialog);
  const close = dialog.getByRole("button", { name: "关闭预览", exact: true });
  const download = dialog.getByRole("button", { name: "下载 PNG", exact: true });
  await focused(close);
  await focusVisible(close);
  await page.keyboard.press("Tab");
  await focused(download);
  await focusVisible(download);
  await page.keyboard.press("Tab");
  await focused(close);
  await page.keyboard.press("Shift+Tab");
  await focused(download);
  await page.keyboard.press("Escape");
  assert.equal(await page.getByRole("dialog").count(), 0);
  await focused(trigger);
  await focusVisible(trigger);
  await page.keyboard.press("Enter");
  await visible(dialog);
  await page.keyboard.press("Enter");
  assert.equal(await page.getByRole("dialog").count(), 0);
  await focused(trigger);
}

async function sampledColors(page, png) {
  return page.evaluate(async (base64) => {
    const blob = await (await fetch(`data:image/png;base64,${base64}`)).blob();
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = 1200; canvas.height = 675;
    const context = canvas.getContext("2d");
    context.drawImage(bitmap, 0, 0);
    const pixels = context.getImageData(0, 0, 1200, 675).data;
    const colors = new Set();
    for (let i = 0; i < pixels.length; i += 64) colors.add(`${pixels[i]},${pixels[i + 1]},${pixels[i + 2]}`);
    return colors.size;
  }, png.toString("base64"));
}

try {
  const buildId = (await readFile(".next/BUILD_ID", "utf8")).trim();
  let serverStartError;
  if (!process.env.E2E_BASE_URL) {
    await requireFreePort();
    server = spawn(process.execPath, ["scripts/check-port.mjs", "--start", "--hostname", "127.0.0.1", "--port", port], { env: { ...process.env, CONTENT_MODE: "formal", AI_API_KEY: "" }, stdio: ["ignore", "pipe", "pipe"] });
    server.once("error", (error) => { serverStartError = error; });
    for (const stream of [server.stdout, server.stderr]) stream.on("data", (data) => { serverLog += data.toString(); });
  }
  let started = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (serverStartError) throw serverStartError;
    assert.ok(!server || server.exitCode === null, "当前构建的 Next 进程启动失败，拒绝使用旧服务");
    try { started = (await fetch(`${baseURL}/trending`)).ok; } catch { /* 服务启动中 */ }
    if (started) break;
    await setTimeout(250);
  }
  assert.ok(started, "生产服务未启动");
  const manifestPath = `/_next/static/${buildId}/_buildManifest.js`;
  const servedManifest = await fetch(`${baseURL}${manifestPath}`);
  assert.equal(servedManifest.status, 200, "服务 BUILD_ID 与当前构建不一致");
  assert.equal(await servedManifest.text(), await readFile(`.next/static/${buildId}/_buildManifest.js`, "utf8"), "服务构建产物与本地不一致");
  const executablePath = process.env.CHROME_PATH || (existsSync("/usr/bin/google-chrome") ? "/usr/bin/google-chrome" : undefined);
  browser = await chromium.launch({ executablePath, headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const performanceChecks = await firstLoadChecks(browser, errors);
  const exportChunkLoads = new Set();
  page.on("request", (request) => {
    const pathname = new URL(request.url()).pathname;
    if (performanceChecks.exportChunks.includes(pathname)) exportChunkLoads.add(pathname);
  });
  let verdictCalls = 0;
  page.on("request", (request) => { if (request.url().endsWith("/api/verdict")) verdictCalls++; });

  await page.goto(`${baseURL}/`);
  await page.waitForURL("**/trending");
  await visible(page.getByRole("heading", { name: "古代热搜辟谣局", level: 1, exact: true }));
  if (!process.env.E2E_BASE_URL) assert.equal(await page.getByRole("contentinfo", { name: "预览构建信息" }).count(), 0);
  await collectionCount(page, 0);
  const trendingLinks = await page.locator('[aria-label="热搜排行"] > li > a').evaluateAll((links) => links.map((link) => link.getAttribute("href")));
  assert.deepEqual(trendingLinks, trendingTopics.map(({ id }) => `/post/${id}`));
  await noOverflow(page);
  await mobileGeometry(page, "热搜榜");
  const trending = await trendingChecks(page, true);
  trending.density = await trendingDensityChecks(page);
  await page.waitForFunction(() => [...document.images].every((image) => image.complete && image.naturalWidth > 0));
  await page.screenshot({ path: path.join(screenshots, "trending-390x844.png"), animations: "disabled" });
  await page.screenshot({ path: path.join(screenshots, "v0.7.0-trending-390x844.png"), animations: "disabled" });
  await versionScreenshot(page, "trending", packageVersion);
  await page.keyboard.press("Tab");
  await focusVisible(page.locator(":focus"));

  const flows = [];
  const formatChecks = [];
  for (const scenario of scenarios) {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    const { id, answer, best, wrong, sourceCount } = scenario;
    const topic = JSON.parse(await readFile(`data/topics/${id.toLowerCase()}.json`, "utf8"));
    const initialHtml = await (await fetch(`${baseURL}/post/${id}`)).text();
    for (const forbidden of ["isTrue", "isCorrect", "reveal", "sources", "sourceIds", "rewriteOptions", "isBest", "feedback", "aiFacts", "aiLimitations", "rumorEra", "coreContext", "evidenceEra", "eraReview"]) {
      assert.ok(!initialHtml.includes(`"${forbidden}"`) && !initialHtml.includes(`\\"${forbidden}\\"`), `${id} 初始 HTML 泄漏答案字段 ${forbidden}`);
    }
    for (const forbidden of [topic.reveal.correctedClaim, ...topic.sourceIds, "谣言退散", "查证属实"]) {
      assert.ok(!initialHtml.includes(forbidden), `${id} 初始 HTML 泄漏答案 ${forbidden}`);
    }
    await writeFile(path.join(output, `${id}-initial-post.html`), initialHtml);

    if (id === "H12") await page.evaluate(() => localStorage.setItem("ahsd:poll:v1:H12", "different"));
    await page.goto(`${baseURL}/${topic.module === "trending" ? "trending" : "discover"}`);
    await page.locator(`[aria-label="${topic.module === "trending" ? "热搜排行" : "发现话题"}"] a[href="/post/${id}"]`).click();
    await page.waitForURL(`**/post/${id}`);
    await freshPost(page, { poll: id === "H12" });
    await visible(page.getByRole("heading", { name: topic.title, exact: true }));
    if (topic.module === "discover") await visible(page.locator("article .author-row"));
    await visible(page.getByText(topic.body, { exact: true }));
    await visible(page.getByText(topic.claim, { exact: true }));
    assert.equal(await page.getByRole("radio").count(), 2);
    if (topic.module === "discover") await visible(page.getByRole("group", { name: "帖子互动" }));
    assert.ok(topic.comments.every((comment) => !comment.text.includes(topic.reveal.correctedClaim) && !/核心主张为[真假]|查证属实|谣言退散|正确(?:答案|选项)[：:]/.test(comment.text)), `${id} 评论直接泄漏结论`);
    const initialGeometry = await mobileGeometry(page, `${id} 初始帖子与判题区`);
    initialGeometry.header = await compactHeaderChecks(page, postPageTitle(topic));
    initialGeometry.social = await postSocialChecks(page, topic);
    assert.equal(await page.locator("article[data-format]").getAttribute("data-format"), topic.module === "trending" ? "news" : scenario.format || "post");
    if (scenario.format) {
      formatChecks.push({ id, format: scenario.format, ...initialGeometry });
      await page.waitForFunction(() => [...document.images].every((image) => image.complete && image.naturalWidth > 0));
      await screenshotAt(page, page.locator("main"), `post-${id}-top-390x844.png`);
    }
    if (id === "H01") await versionScreenshot(page, "news", packageVersion);
    if (id === "H05") {
      await versionScreenshot(page, "post", packageVersion);
      await localSocialChecks(page, topic, []);
      await page.locator(".comments-panel").scrollIntoViewIfNeeded();
      await page.locator(".comments-panel").evaluate((node) => node.scrollIntoView({ block: "start", behavior: "instant" }));
      await versionScreenshot(page, "discover-post", packageVersion, { scrollToTop: false });
    }
    if (id === "H09") await versionScreenshot(page, "H09", packageVersion);
    if (id === "H12") {
      const poll = page.getByRole("region", { name: "直觉投票", exact: true });
      assert.equal(await poll.getByText("少数倾向", { exact: true }).count(), 0);
      assert.equal(await poll.getByText("多数倾向", { exact: true }).count(), 0);
      const savedBeforeVote = await page.evaluate(() => localStorage.getItem("ahsd:progress:v1"));
      const verdictCallsBeforeVote = verdictCalls;
      // 投与后续判题相反的直觉，确认投票不会输入判题或解锁贴纸。
      await poll.getByRole("button", { name: "直觉：同一部书", exact: true }).click();
      await pollTendencyChecks(page);
      assert.equal(await page.evaluate(() => localStorage.getItem("ahsd:poll:v1:H12")), "different", "新投票不得读取或覆盖旧版投票存储");
      assert.equal(await page.evaluate(() => localStorage.getItem("ahsd:progress:v1")), savedBeforeVote);
      assert.equal(verdictCalls, verdictCallsBeforeVote);
      assert.ok(await page.getByRole("button", { name: "提交判断", exact: true }).isDisabled());
      const handoff = await pollHandoffChecks(page);
      await versionScreenshot(page, "H12", packageVersion, { scrollToTop: false });
      formatChecks.push({ id, format: "poll", ...(await mobileGeometry(page, "H12 投票后倾向文字条与原判题区")), handoff, pollSessionOnly: true, legacyVoteIgnored: true });
    }
    if (id === "H03") {
      await versionScreenshot(page, "post");
      await screenshotAt(page, page.locator("main"), "post-H03-top-390x844.png");
      await screenshotAt(page, page.locator("article[data-format]"), "v0.8.0-post-390x844.png");
      await screenshotAt(page, page.locator(".task-panel"), "post-H03-task-390x844.png");
    }
    const callsBefore = verdictCalls;
    const stamp = answer ? "查证属实" : "谣言退散";
    const submit = page.getByRole("button", { name: "提交判断", exact: true });
    assert.ok(await submit.isDisabled());
    assert.equal(await page.getByText(stamp, { exact: true }).count(), 0);
    assert.equal(await page.getByText("重温本条", { exact: false }).count(), 0);
    if (topic.module === "discover") {
      assert.equal(await page.locator("#post-comments > li").count(), 4);
      await page.getByRole("button", { name: /展开更多评论/ }).click();
      assert.equal(await page.locator("#post-comments > li").count(), 8);
      await page.getByRole("button", { name: "收起评论", exact: true }).click();
      assert.equal(await page.locator("#post-comments > li").count(), 4);
    }
    await page.getByRole("radio", { name: answer ? "是假的" : "是真的", exact: true }).check();
    await page.getByRole("radio", { name: answer ? "是真的" : "是假的", exact: true }).check();
    const verdictReady = page.waitForResponse((response) => response.url().endsWith("/api/verdict"));
    await submit.click();
    const verdictResponse = await verdictReady;
    assert.equal(verdictResponse.status(), 200);
    assert.deepEqual(verdictResponse.request().postDataJSON(), { topicId: id, answer });
    const result = await verdictResponse.json();
    assert.equal(result.isTrue, answer);
    assert.equal(result.isCorrect, true);
    assert.equal(result.reveal.correctedClaim, topic.reveal.correctedClaim);
    assert.equal(result.rewriteOptions.find((option) => option.isBest).id, best);
    await visible(page.getByText(stamp, { exact: true }));
    await focused(page.locator("#reveal-heading"));
    await revealSummaryChecks(page, { correct: true, isTrue: answer, firstScreen: true });
    await earnedSticker(page, id, flows.length + 1);
    if (id === "H03") {
      await page.keyboard.press("Tab");
      await focused(page.getByRole("link", { name: "问问 AI", exact: true }));
      await focusVisible(page.getByRole("link", { name: "问问 AI", exact: true }));
      await page.keyboard.press("Tab");
      await focused(page.getByRole("region", { name: "本题贴纸", exact: true }).getByRole("link", { name: "去贴纸墙 →", exact: true }));
      await focusVisible(page.getByRole("region", { name: "本题贴纸", exact: true }).getByRole("link", { name: "去贴纸墙 →", exact: true }));
      await page.keyboard.press("Tab");
      await focused(page.getByText("为什么", { exact: true }));
      await focusVisible(page.getByText("为什么", { exact: true }));
    }
    assert.equal(await page.locator(".verdict-stamp").evaluate((node) => getComputedStyle(node).animationDuration), "0.6s");
    await visible(page.getByText("答对了！这次吃瓜有依据。", { exact: true }));
    assert.equal(verdictCalls, callsBefore + 1);
    assert.ok(await page.getByRole("radio", { name: "是真的", exact: true }).isDisabled());
    assert.ok(await page.getByRole("radio", { name: "是假的", exact: true }).isDisabled());
    await page.getByText("为什么", { exact: true }).click();
    await page.getByText(`展开史料依据（${sourceCount} 条）`, { exact: true }).click();
    await page.getByText("延伸冷知识", { exact: true }).click();
    const reveal = page.locator(".reveal-panel");
    for (const field of ["shortExplanation", "detailedExplanation", "correctedClaim", "funFact"]) {
      await visible(reveal.getByText(topic.reveal[field], { exact: true }));
    }
    for (const sourceId of topic.sourceIds) {
      const source = sourceIndex.find((item) => item.id === sourceId);
      const sourceItem = reveal.getByRole("listitem").filter({ hasText: sourceId });
      await visible(sourceItem.getByText(source.organization, { exact: true }));
      await visible(sourceItem.getByText(`支持要点：${source.supports}`, { exact: true }));
    }
    assert.equal(await page.getByText("已人工审核", { exact: true }).count(), sourceCount);
    assert.equal(await page.getByText("待人工审核", { exact: true }).count(), 0);
    assert.ok(result.sources.every((source) => source.status === "reviewed"));
    await mobileGeometry(page, `${id} 揭晓与展开来源`);
    if (id === "H03") await revealScreenshot(page, "post-H03-reveal-390x844.png");
    if (id === "H11") await revealScreenshot(page, "post-H11-reveal-390x844.png");
    const links = await page.locator('a[target="_blank"]').evaluateAll((nodes) => nodes.map((node) => ({ href: node.href, rel: node.rel })));
    assert.deepEqual(links.map((link) => link.href), topic.sourceIds.map((sourceId) => new URL(sourceIndex.find((source) => source.id === sourceId).url).href));
    assert.ok(links.every((link) => link.rel.includes("noopener")));
    await page.getByRole("button", { name: new RegExp(`^${wrong} `) }).click();
    await visible(page.getByText("再打磨一下，看看遗漏了什么。", { exact: true }));
    await page.getByRole("button", { name: new RegExp(`^${best} `) }).click();
    await visible(page.getByText("改写正确，这样说更准确。", { exact: true }));
    await mobileGeometry(page, `${id} 改写反馈`);
    if (id === "H03") {
      await screenshotAt(page, page.locator('[aria-labelledby="rewrite-heading"]'), "post-H03-rewrite-390x844.png");
      await screenshotAt(page, page.locator('[aria-labelledby="ask-heading"]'), "post-H03-ai-390x844.png");
      // reviewed 资料通过 formal 门控后，无 Key 返回 503；布局异常分支另用 mock。
      if (!process.env.E2E_BASE_URL) {
        const pending = page.waitForResponse((response) => response.url().endsWith("/api/ask"));
        await page.getByRole("textbox").fill("唐朝人用什么调料获得辛辣味？");
        await page.getByRole("button", { name: "发送问题", exact: true }).click();
        assert.equal((await pending).status(), 503);
        await visible(page.getByText("AI 未配置", { exact: true }));
        await page.getByRole("link", { name: "返回揭晓", exact: true }).click();
        await focused(page.locator("#reveal-heading"));
      }
      await askStates(page);
    }
    await page.getByRole("button", { name: "生成查证卡", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "查证卡预览" });
    await visible(dialog);
    await visible(dialog.getByText(`查证结果：${answer ? "真" : "假"}`, { exact: true }));
    await visible(dialog.getByText(topic.reveal.correctedClaim, { exact: true }));
    await visible(dialog.getByText("已人工审核", { exact: true }));
    const overflow = await page.getByTestId("check-card").evaluate((node) => {
      const bounds = node.getBoundingClientRect();
      return {
        width: node.scrollWidth, height: node.scrollHeight, clientHeight: node.clientHeight,
        clipped: [...node.querySelectorAll("*")].some((child) => {
          const box = child.getBoundingClientRect();
          return box.top < bounds.top - 1 || box.bottom > bounds.bottom + 1 || box.left < bounds.left - 1 || box.right > bounds.right + 1;
        }),
      };
    });
    assert.deepEqual(overflow, { width: 1200, height: 675, clientHeight: 675, clipped: false }, `${id} 查证卡内容溢出`);
    await mobileGeometry(page, `${id} 查证卡弹窗`);
    if (id === "H03") await page.screenshot({ path: path.join(screenshots, "check-card-390x844.png"), animations: "disabled" });
    if (id === "H01") assert.equal(exportChunkLoads.size, 0, "首次 PNG 下载前不应请求导出库");
    const downloadReady = page.waitForEvent("download");
    await page.getByRole("button", { name: "下载 PNG", exact: true }).click();
    const download = await downloadReady;
    if (id === "H01") {
      assert.ok(exportChunkLoads.size > 0, "下载时应动态请求 html-to-image");
      performanceChecks.lazyExport = { beforeDownload: "未加载", afterDownload: [...exportChunkLoads], downloaded: true };
    }
    assert.equal(await download.failure(), null);
    assert.equal(download.suggestedFilename(), `${id}-查证卡.png`);
    const pngPath = path.join(output, `${id}-check-card.png`);
    await download.saveAs(pngPath);
    const png = await readFile(pngPath);
    assert.ok(png.length > 10000, `${id} 导出 PNG 为空或异常小`);
    assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
    assert.equal(png.readUInt32BE(16), 1200);
    assert.equal(png.readUInt32BE(20), 675);
    const colorCount = await sampledColors(page, png);
    assert.ok(colorCount > 20, `${id} 导出图片可能空白`);
    await page.getByRole("button", { name: "关闭预览", exact: true }).click();
    assert.equal(await page.getByRole("dialog").count(), 0);
    await focused(page.getByRole("button", { name: "生成查证卡", exact: true }));
    if (id === "H03") await dialogKeyboard(page);
    const saved = await page.evaluate(() => localStorage.getItem("ahsd:progress:v1"));
    const progress = JSON.parse(saved)[id];
    assert.equal(progress.selectedAnswer, answer);
    assert.equal(progress.selectedRewriteOptionId, undefined, "改写只存本次页面状态");
    // 经所属模块离开再进入，随后刷新，均不自动请求揭晓或恢复任何交互。
    await page.getByRole("link", { name: /← 返回.*继续/ }).click();
    await page.waitForURL(`**/${topic.module}`);
    await page.locator(`[aria-label="${topic.module === "trending" ? "热搜排行" : "发现话题"}"] a[href="/post/${id}"]`).click();
    await page.waitForURL(`**/post/${id}`);
    await freshPost(page, { poll: id === "H12" });
    await page.reload();
    await freshPost(page, { poll: id === "H12" });
    assert.equal(verdictCalls, callsBefore + 1, "重进/刷新不应自动恢复揭晓");
    assert.equal(await page.evaluate(() => localStorage.getItem("ahsd:progress:v1")), saved);
    await page.getByRole("radio", { name: answer ? "是真的" : "是假的", exact: true }).check();
    assert.equal(await page.evaluate(() => localStorage.getItem("ahsd:progress:v1")), saved, "重选不得覆盖完成记录");
    await page.getByRole("button", { name: "提交判断", exact: true }).click();
    await visible(page.locator(".verdict-stamp"));
    assert.equal(verdictCalls, callsBefore + 2);
    assert.equal(await page.getByText(/获得贴纸/).count(), 0, "重答不重复提示获得贴纸");
    await visible(page.getByRole("region", { name: "本题贴纸", exact: true }).getByText(/已收藏/));
    assert.equal(await page.getByRole("group", { name: "三选一改写", exact: true }).getByRole("button", { pressed: true }).count(), 0);
    assert.equal(await page.getByRole("textbox").inputValue(), "");
    assert.equal(await page.getByRole("log", { name: "AI 问答记录", exact: true }).textContent(), "");
    assert.equal(await page.locator('[aria-labelledby="ask-heading"]').getByRole("alert").count(), 0);
    assert.equal(await page.evaluate(() => localStorage.getItem("ahsd:progress:v1")), saved);
    await page.emulateMedia({ reducedMotion: "reduce" });
    const animation = await page.locator(".verdict-stamp").evaluate((node) => getComputedStyle(node).animationDuration);
    assert.ok(parseFloat(animation) < 0.01, "减少动态效果设置未生效");
    flows.push({ id, answer, verdict: stamp, bestRewrite: best, sourceCount, pngPath, pngBytes: (await stat(pngPath)).size, dimensions: "1200×675", sampledColors: colorCount, initialAnswerLeak: false, cardClipped: false, revisitFresh: true, reloadFresh: true, progressUnchanged: true, noDuplicateUnlock: true });
  }

  const progressIds = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem("ahsd:progress:v1"))));
  assert.deepEqual(progressIds.sort(), scenarios.map(({ id }) => id));
  await page.goto(`${baseURL}/me`);
  await collectionCount(page, scenarios.length);
  assert.equal(await page.locator('[aria-label="贴纸收藏"] a').count(), scenarios.length);
  const stickersHtml = await (await fetch(`${baseURL}/me`)).text();
  for (const scenario of scenarios) {
    const topic = JSON.parse(await readFile(`data/topics/${scenario.id.toLowerCase()}.json`, "utf8"));
    for (const forbidden of [topic.reveal.correctedClaim, ...topic.sourceIds, "谣言退散", "查证属实"]) {
      assert.ok(!stickersHtml.includes(forbidden), `贴纸墙初始 HTML 泄漏答案 ${forbidden}`);
    }
  }
  for (const forbidden of ["isTrue", "isCorrect", "reveal", "sources", "sourceIds", "rewriteOptions", "isBest", "feedback", "aiFacts", "aiLimitations", "rumorEra", "coreContext", "evidenceEra", "eraReview"]) {
    assert.ok(!stickersHtml.includes(`"${forbidden}"`) && !stickersHtml.includes(`\\"${forbidden}\\"`), `贴纸墙初始 HTML 泄漏字段 ${forbidden}`);
  }
  const geometry = [];
  for (const viewport of [{ width: 390, height: 844 }, { width: 375, height: 667 }, { width: 430, height: 932 }]) {
    const mobileContext = await browser.newContext({ viewport, acceptDownloads: true, isMobile: true, hasTouch: true });
    const mobile = await mobileContext.newPage();
    mobile.on("pageerror", (error) => errors.push(error.message));
    await meFlow(mobile, viewport, geometry);
    await friendsFlow(mobile, viewport, geometry);
    await persistentSocialFlow(mobile, viewport, geometry);
    await stickerCollectionFlow(mobile, viewport, geometry);
    for (const route of ["/trending", "/discover", "/me", "/me?tab=favorites", ...scenarios.map(({ id }) => `/post/${id}`), "/post/DOES-NOT-EXIST", "/missing-page"]) {
      const response = await mobile.goto(`${baseURL}${route}`);
      await visible(mobile.getByRole("heading", { level: 1 }));
      if (route.includes("DOES-NOT-EXIST") || route === "/missing-page") assert.equal(response.status(), 404);
      const pageGeometry = await mobileGeometry(mobile, route);
      if (route !== "/trending") {
        const title = response.status() === 404 ? "页面未找到" : route === "/discover" ? "发现" : route.startsWith("/me") ? "我的" : postPageTitle(allTopics.find(({ id }) => id === route.split("/").at(-1)));
        pageGeometry.header = await compactHeaderChecks(mobile, title);
      }
      await mobile.waitForFunction(() => [...document.images].every((image) => image.complete && image.naturalWidth > 0));
      const detailTopic = allTopics.find(({ id }) => route === `/post/${id}`);
      if (detailTopic) {
        const chip = mobile.getByLabel(`历史年代：${detailTopic.era.label}`, { exact: true });
        await visible(chip);
        assert.equal(await chip.textContent(), detailTopic.era.label);
        assert.equal(await chip.evaluate((node) => node.closest('[data-post-section]')?.getAttribute('data-post-section')), detailTopic.module === "trending" ? "byline" : "format");
        pageGeometry.eraChip = { ...detailTopic.era, section: detailTopic.module === "trending" ? "byline" : "format" };
        if (detailTopic.id === "H12") {
          assert.deepEqual(detailTopic.era, { label: "春秋战国", order: 1 });
          await mobile.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
          const box = await chip.boundingBox();
          assert.ok(box && box.y >= 48 && box.y + box.height < viewport.height - 65, "H12 春秋战国年代 chip 须在详情首屏可见");
          pageGeometry.eraChip = { ...pageGeometry.eraChip, firstScreen: true, box };
          if (viewport.width === 390) await versionScreenshot(mobile, "era", packageVersion);
        }
      }
      if (route === "/trending" || route === "/discover") pageGeometry.covers = await coverGeometry(mobile, route);
      geometry.push(pageGeometry);
      // ARIA Tab 使用 roving tabindex：未选分类由方向键访问，只有选中项进入 Tab 顺序。
      const untabbable = await mobile.locator('a[href], button:not(:disabled):not([role="tab"]), input:not(:disabled), textarea:not(:disabled), summary').evaluateAll((nodes) => nodes.filter((node) => node.checkVisibility() && node.tabIndex < 0).length);
      assert.equal(untabbable, 0, "存在不可 Tab 聚焦的控件");
      if (route === "/trending") {
        pageGeometry.trending = await trendingChecks(mobile);
        pageGeometry.trending.density = await trendingDensityChecks(mobile);
      }
      if (route === "/discover") {
        await discoverEmptyChecks(mobile, geometry);
        pageGeometry.masonry = await discoverChecks(mobile);
        if (viewport.width === 390) {
          await mobile.waitForLoadState("networkidle");
          await screenshotAt(mobile, mobile.locator("main"), "discover-390x844.png");
          await mobile.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
          await mobile.screenshot({ path: path.join(screenshots, "v0.8.0-discover-390x844.png"), animations: "disabled" });
        }
      }
      const scenario = scenarios.find(({ id }) => route === `/post/${id}`);
      if (scenario) {
        const topic = allTopics.find(({ id }) => id === scenario.id);
        pageGeometry.social = await postSocialChecks(mobile, topic);
        if (scenario.format) assert.equal(await mobile.locator("article[data-format]").getAttribute("data-format"), scenario.format);
        if (scenario.id === "H12") {
          if (viewport.width === 375) await mobile.emulateMedia({ reducedMotion: "reduce" });
          const savedBeforeVote = await mobile.evaluate(() => localStorage.getItem("ahsd:progress:v1"));
          const poll = mobile.getByRole("region", { name: "直觉投票", exact: true });
          await poll.getByRole("button", { name: "直觉：两部书", exact: true }).click();
          const handoff = await pollHandoffChecks(mobile);
          assert.equal(await mobile.evaluate(() => localStorage.getItem("ahsd:progress:v1")), savedBeforeVote);
          if (viewport.width === 390) await versionScreenshot(mobile, "H12", packageVersion, { scrollToTop: false });
          geometry.push({ ...(await mobileGeometry(mobile, "H12 移动端投票后")), handoff, reducedMotion: viewport.width === 375 });
          await mobile.emulateMedia({ reducedMotion: "no-preference" });
        }
        if (topic.module === "discover") {
          if (scenario.id === "H05") await localSocialChecks(mobile, topic, geometry);
          await mobile.getByRole("button", { name: /展开更多评论/ }).click();
          await postSocialChecks(mobile, topic);
          await mobileGeometry(mobile, `${route} 评论展开`);
        }
        await mobile.getByRole("radio", { name: scenario.answer ? "是真的" : "是假的", exact: true }).check();
        if (scenario.id === "H03") await mobile.emulateMedia({ reducedMotion: "reduce" });
        await mobile.getByRole("button", { name: "提交判断", exact: true }).click();
        await visible(mobile.locator(".verdict-stamp"));
        await focused(mobile.locator("#reveal-heading"));
        await revealSummaryChecks(mobile, { correct: true, isTrue: scenario.answer, firstScreen: viewport.width === 390 });
        if (scenario.id === "H03") {
          await mobile.waitForFunction(() => {
            const heading = document.querySelector("#reveal-heading").getBoundingClientRect();
            const header = document.querySelector("header").getBoundingClientRect();
            return heading.y >= header.bottom && heading.bottom < window.innerHeight - 65;
          });
          assert.equal(await mobile.locator(".verdict-stamp").evaluate((node) => getComputedStyle(node).animationDuration), "0s");
          assert.equal(await mobile.locator(".verdict-stamp").evaluate((node) => getComputedStyle(node).animationName), "none");
        }
        await mobile.getByText("为什么", { exact: true }).click();
        await mobile.getByText(`展开史料依据（${scenario.sourceCount} 条）`, { exact: true }).click();
        await mobile.getByText("延伸冷知识", { exact: true }).click();
        geometry.push(await mobileGeometry(mobile, `${route} 揭晓/证据/AI/改写`));
        await mobile.getByRole("button", { name: new RegExp(`^${scenario.best} `) }).click();
        await mobileGeometry(mobile, `${route} 改写反馈`);
        if (scenario.id === "H03") await askStates(mobile);
        await mobile.getByRole("button", { name: "生成查证卡", exact: true }).click();
        await visible(mobile.getByRole("dialog"));
        geometry.push(await mobileGeometry(mobile, `${route} 查证卡预览`));
        const preview = await mobile.getByTestId("check-card").boundingBox();
        assert.ok(preview.width < viewport.width && Math.abs(preview.width / preview.height - 1200 / 675) < 0.01, "手机预览未等比缩放");
        if (scenario.id === "H03") {
          const ready = mobile.waitForEvent("download");
          await mobile.getByRole("button", { name: "下载 PNG", exact: true }).click();
          const download = await ready;
          assert.equal(await download.failure(), null);
          const pngPath = path.join(output, `H03-${viewport.width}x${viewport.height}-check-card.png`);
          await download.saveAs(pngPath);
          const png = await readFile(pngPath);
          assert.equal(png.readUInt32BE(16), 1200);
          assert.equal(png.readUInt32BE(20), 675);
        }
        await mobile.getByRole("button", { name: "关闭预览", exact: true }).click();
        await focused(mobile.getByRole("button", { name: "生成查证卡", exact: true }));
        await replayPost(mobile, scenario, geometry);
        const saved = await mobile.evaluate(() => localStorage.getItem("ahsd:progress:v1"));
        if (scenario.id === "H12") {
          await mobile.getByRole("button", { name: "直觉：同一部书", exact: true }).click();
          await pollHandoffChecks(mobile);
          assert.equal(await mobile.evaluate(() => localStorage.getItem("ahsd:progress:v1")), saved);
        }
        await mobile.getByRole("radio", { name: scenario.answer ? "是真的" : "是假的", exact: true }).check();
        await mobile.getByRole("button", { name: "提交判断", exact: true }).click();
        await visible(mobile.locator(".verdict-stamp"));
        assert.equal(await mobile.getByText(/获得贴纸/).count(), 0);
        assert.equal(await mobile.evaluate(() => localStorage.getItem("ahsd:progress:v1")), saved);
        assert.equal(await mobile.getByRole("group", { name: "三选一改写", exact: true }).getByRole("button", { pressed: true }).count(), 0);
        assert.equal(await mobile.getByRole("textbox").inputValue(), "");
        assert.equal(await mobile.getByRole("log", { name: "AI 问答记录", exact: true }).textContent(), "");
        assert.equal(await mobile.locator('[aria-labelledby="ask-heading"]').getByRole("alert").count(), 0);
        await mobile.reload();
        await freshPost(mobile, { poll: scenario.id === "H12" });
        assert.equal(await mobile.evaluate(() => localStorage.getItem("ahsd:progress:v1")), saved);
        await mobileGeometry(mobile, `${route} 刷新后交互全新、收集不变`);
        await bottomNavigationAtEnd(mobile);
      }
      if (route === "/post/DOES-NOT-EXIST" && viewport.width === 390) await mobile.screenshot({ path: path.join(screenshots, "not-found-390x844.png"), animations: "disabled" });
    }
    await mobileContext.close();
  }
  const desktopChecks = [];
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const route of ["/", "/discover", "/me", "/me?tab=favorites", "/friends", "/friends/libai", "/friends/dufu", ...scenarios.map(({ id }) => `/post/${id}`), "/post/DOES-NOT-EXIST", "/missing-page"]) {
    await page.goto(`${baseURL}${route}`);
    await visible(page.getByRole("heading", { level: 1 }));
    if (route === "/") await mobileGeometry(page, "1440×900 桌面居中列");
    desktopChecks.push({ route, ...(await centeredColumnChecks(page)) });
  }
  const desktopShell = desktopChecks[0].shell;
  for (const width of [1023, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${baseURL}/`);
    desktopChecks.push({ route: "/", ...(await centeredColumnChecks(page)) });
  }
  const homeLayout = await homeScreenshots(browser, errors);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${baseURL}/discover`);
  assert.equal(await page.locator('[aria-label="发现话题"] > li').count(), discoverTopics.length);
  const discoverLinks = await page.locator('[aria-label="发现话题"] > li > a').evaluateAll((links) => links.map((link) => link.getAttribute("href")));
  assert.deepEqual(discoverLinks, discoverTopics.map(({ id }) => `/post/${id}`));
  await discoverChecks(page);
  for (const { id } of discoverTopics) {
    await page.goto(`${baseURL}/discover`);
    await page.locator(`[aria-label="发现话题"] a[href="/post/${id}"]`).click();
    await page.waitForURL(`**/post/${id}`);
    await freshPost(page, { poll: id === "H12" });
  }
  const wrongContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const wrongPage = await wrongContext.newPage();
  wrongPage.on("pageerror", (error) => errors.push(error.message));
  await wrongPage.goto(`${baseURL}/post/H03`);
  await wrongPage.getByRole("radio", { name: "是真的", exact: true }).check();
  await wrongPage.getByRole("button", { name: "提交判断", exact: true }).click();
  await visible(wrongPage.getByText("这次答错了，带走一个新知识。", { exact: true }));
  await visible(wrongPage.getByText("谣言退散", { exact: true }));
  await focused(wrongPage.locator("#reveal-heading"));
  await revealSummaryChecks(wrongPage, { correct: false, isTrue: false, firstScreen: true });
  await earnedSticker(wrongPage, "H03", 1);
  await wrongPage.getByRole("button", { name: "生成查证卡", exact: true }).click();
  await visible(wrongPage.getByRole("dialog", { name: "查证卡预览" }));
  await wrongPage.getByRole("button", { name: "关闭预览", exact: true }).click();
  await openMyStickers(wrongPage);
  await collectionCount(wrongPage, 1);
  assert.equal(await wrongPage.locator('[data-sticker-id="H03"]').getAttribute("data-unlocked"), "true");
  assert.equal(await wrongPage.locator('[data-sticker-id="H03"] a').getAttribute("href"), "/post/H03");
  await wrongContext.close();
  const missing = await page.goto(`${baseURL}/post/DOES-NOT-EXIST`);
  assert.equal(missing.status(), 404);
  await visible(page.getByRole("heading", { name: "这条热搜暂未找到" }));
  assert.equal((await fetch(`${baseURL}/api/verdict`, { method: "POST", body: JSON.stringify({ topicId: "H03", answer: "false" }) })).status, 400);
  assert.equal((await fetch(`${baseURL}/api/verdict`, { method: "POST", body: JSON.stringify({ topicId: "MISSING", answer: false }) })).status, 404);
  assert.deepEqual(errors, [], "浏览器出现运行错误");
  const previewBuild = await previewBuildChecks(buildId);
  const summary = { passed: true, social: { persistentLikesAndFavorites: true, modules: ["trending", "discover"], meFavoritesAndEmptyState: true, navigationOrder: ["热搜榜", "发现", "好友", "我的"], meTabs: { directFavorites: true, keyboard: "ArrowLeft/ArrowRight/Home/End/Enter/Space", redirect: "/stickers → /me" }, shareFriends: ["libai", "dufu"], shareModalFocusAndDismiss: true, offlineCardsPersistAndDeduplicate: true, screenshots: [path.join(reviewDir, `v${packageVersion}-me-390x844.png`), path.join(reviewDir, `v${packageVersion}-liked-390x844.png`), path.join(reviewDir, `v${packageVersion}-share-sheet-390x844.png`)] }, buildId, previewBuild, friends: { routes: ["/friends", "/friends/libai", "/friends/dufu", "/friends/missing-friend"], viewports: ["390×844", "375×667", "430×932"], states: ["初始", "无 key 503", "发送中", "mock 回复", "长回复", "429", "502", "504", "刷新恢复/清空对话", "404"], realAiCalls: 0, memoryOnly: false, localStorageMaxEntries: 60, maxHistory: 12, listScreenshot: path.join(reviewDir, `v${packageVersion}-friends-390x844.png`), mockChatScreenshot: path.join(screenshots, `v${packageVersion}-chat-mock-390x844.png`) }, revealChecks, replayChecks, trending, flow: "首页 → trending → H01–H12 → 判题 → 揭晓/来源 → 错误及正确改写 → PNG → 分题离开重进/刷新全新 → 重答不重复解锁", flows, formatChecks, performance: performanceChecks, poll: "多数/少数倾向文字条；主动投票滚动并聚焦判题区、避开吸顶头部；每次进入/刷新/再玩一次均可重投；旧版投票不恢复、不覆盖，与判题/贴纸隔离", wrongAnswerRevealed: true, stickerCollection: "三视口：未提交不收集、首次提交结果内即时反馈与贴纸墙链接、提交后 1/N、已收藏贴纸回帖全新、历史后退全新、进度刷新保留、再玩一次原地清空并聚焦判题、重答不重复获得、清除归零；答错也解锁；十二题全收集；初始 HTML 不泄题", viewports: ["390×844", "375×667", "430×932", "1440×900"], geometry, desktopShell, desktopChecks, homeLayout, modules: { trending: trendingTopics.map(({ id }) => id), discover: discoverTopics.map(({ id }) => id), eachTrueFalse: "3:3", authorThreads: true, newsLayout: "机构/发布时间/导语/正文/相关报道；无 emoji 或楼层评论；含本机点赞/收藏/好友转发", socialLayout: "暖色大圆角/配图/emoji/楼中楼/本机关注切换刷新恢复/点赞收藏/真实复制链接", screenshots: [path.join(reviewDir, `v${packageVersion}-news-390x844.png`), path.join(reviewDir, `v${packageVersion}-post-390x844.png`)] }, aiStates: "真实 formal/preview 无配置均 503；三视口 AI 锚点/返回/重试及 loading/409/503/长回答布局 mock，无模型调用", keyboard: "提交后焦点与 Tab、focus-visible、弹窗焦点循环、Esc/按钮关闭及焦点返回通过", screenshots, browserErrors: errors };
  const eraDetails = geometry.filter((record) => record.eraChip);
  assert.equal(eraDetails.length, allTopics.length * 3, "十二题的年代 chip 须在三种手机视口全部通过");
  summary.era = { detailChecks: eraDetails.length, h12FirstScreenChecks: eraDetails.filter((record) => record.eraChip.firstScreen).length, screenshot: path.join(reviewDir, `v${packageVersion}-era-390x844.png`) };
  await writeFile(path.join(output, "result.json"), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({ passed: true, flows: flows.length, viewports: summary.viewports, geometryChecks: geometry.length, browserErrors: errors, result: path.join(output, "result.json"), screenshots }, null, 2));
} catch (error) {
  if (serverLog) console.error(serverLog);
  throw error;
} finally {
  await browser?.close();
  server?.kill("SIGTERM");
}
