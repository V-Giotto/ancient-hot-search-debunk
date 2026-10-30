import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { setTimeout } from "node:timers/promises";
import { chromium } from "playwright";

// 使用真实生产服务、真实接口和真实下载，不 mock 判题或导出。
const port = process.env.E2E_PORT || "3123";
const baseURL = process.env.E2E_BASE_URL || `http://127.0.0.1:${port}`;
const output = path.resolve("artifacts/stage-5");
const screenshots = path.join(output, "screenshots");
const scenarios = [
  { id: "H01", answer: false, best: "A", wrong: "B", sourceCount: 2 },
  { id: "H02", answer: true, best: "C", wrong: "A", sourceCount: 3 },
  { id: "H03", answer: false, best: "C", wrong: "A", sourceCount: 3 },
  { id: "H04", answer: true, best: "B", wrong: "A", sourceCount: 3 },
  { id: "H05", answer: false, best: "B", wrong: "A", sourceCount: 2 },
  { id: "H06", answer: true, best: "A", wrong: "B", sourceCount: 2 },
  { id: "H07", answer: false, best: "C", wrong: "A", sourceCount: 2 },
  { id: "H08", answer: true, best: "B", wrong: "A", sourceCount: 2 },
];
const sourceIndex = JSON.parse(await readFile("data/source-index.json", "utf8"));
await mkdir(output, { recursive: true });
await mkdir(screenshots, { recursive: true });
let server;
let serverLog = "";
let browser;

async function visible(locator) {
  await locator.waitFor({ state: "visible" });
}

async function noOverflow(page) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true, `页面水平溢出：${page.url()}`);
}

async function noDisclaimerLabels(page) {
  const displayed = await page.evaluate(() => [document.body.innerText, ...[...document.querySelectorAll("img")].map((image) => image.alt), ...[...document.querySelectorAll("[aria-label]")].map((node) => node.getAttribute("aria-label"))].join("\n"));
  assert.doesNotMatch(displayed, /虚构|架空|模拟|非史料|只是创作|只是梗|非实物复原|仅作戏仿|不是历史人物原话|现代类比，不等于古代原貌|拟人账号/, `页面残留免责声明标签：${page.url()}`);
}

async function focused(locator) {
  assert.ok(await locator.evaluate((node) => node === document.activeElement), "键盘焦点位置不正确");
}

async function focusVisible(locator) {
  assert.ok(await locator.evaluate((node) => node.matches(":focus-visible") && getComputedStyle(node).outlineStyle !== "none" && parseFloat(getComputedStyle(node).outlineWidth) >= 2), "缺少清晰的键盘焦点样式");
}

// 核对实际可点击范围；原生 radio 的触控范围为关联的整张 label。
async function mobileGeometry(page, state) {
  await noOverflow(page);
  await noDisclaimerLabels(page);
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
  return { state, viewport, horizontalOverflow: false, touchTargets: ">=44px" };
}

async function coverGeometry(page, route) {
  const list = route === "/trending" ? '[aria-label="热搜排行"]' : '[aria-label="发现话题"]';
  const covers = await page.locator(`${list} > li > a > img`).evaluateAll((images) => images.map((image) => {
    const { width, height, left, right } = image.getBoundingClientRect();
    const link = image.closest("a").getBoundingClientRect();
    const heading = image.closest("a").querySelector("h2");
    return {
      width, height, objectFit: getComputedStyle(image).objectFit,
      loaded: image.complete && image.naturalWidth > 0,
      contained: left >= link.left && right <= link.right,
      titleClipped: heading.scrollWidth > heading.clientWidth || heading.scrollHeight > heading.clientHeight,
    };
  }));
  assert.equal(covers.length, scenarios.length, `${route} 封面数量不正确`);
  for (const cover of covers) {
    assert.ok(cover.loaded && cover.contained && !cover.titleClipped, `${route} 封面未加载、越界或标题被裁切`);
    assert.ok(Math.abs(cover.width / cover.height - 16 / 9) < 0.01, `${route} 封面未保持 16:9`);
    assert.equal(cover.objectFit, "contain", `${route} 封面应完整展示，避免裁切内嵌标题`);
    if (route === "/trending") assert.ok(cover.width >= 112 && cover.width <= 128, "热搜榜缩略图宽度应为 112–128px");
  }
  return covers;
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
  await page.getByRole("main").getByRole("link", { name: "贴纸墙 →", exact: true }).click();
  await page.waitForURL("**/stickers");
  await collectionCount(page, 0);
  assert.equal(await stickers.locator(":scope > li").count(), scenarios.length);
  assert.equal(await stickers.getByRole("link").count(), 0);
  assert.equal(await stickers.getByText("未解锁 · 提交判断后收集", { exact: true }).count(), scenarios.length);
  geometry.push(await mobileGeometry(page, "贴纸墙全部锁定"));
  await navigation.getByRole("link", { name: "热搜榜", exact: true }).click();
  await page.locator('[aria-label="热搜排行"] a[href="/post/H03"]').click();
  await page.getByRole("radio", { name: "是假的", exact: true }).check();
  // 只选答案不解锁；返回后仍可继续提交。
  await navigation.getByRole("link", { name: "贴纸", exact: true }).click();
  await collectionCount(page, 0);
  assert.equal(await stickers.getByRole("link").count(), 0);
  await navigation.getByRole("link", { name: "热搜榜", exact: true }).click();
  await page.locator('[aria-label="热搜排行"] a[href="/post/H03"]').click();
  await page.getByRole("button", { name: "提交判断", exact: true }).click();
  await visible(page.getByRole("region", { name: "本题贴纸", exact: true }).getByText("饭局手记 · 已解锁", { exact: true }));
  await navigation.getByRole("link", { name: "热搜榜", exact: true }).click();
  await collectionCount(page, 1);
  geometry.push(await mobileGeometry(page, "答一题后热榜进度 1/N"));
  if (viewport.width === 390) await page.screenshot({ path: path.join(screenshots, "trending-progress-390x844.png"), animations: "disabled" });
  await navigation.getByRole("link", { name: "贴纸", exact: true }).click();
  await page.waitForURL("**/stickers");
  assert.equal(await navigation.getByRole("link", { name: "贴纸", exact: true }).getAttribute("aria-current"), "page");
  await collectionCount(page, 1);
  assert.equal(await stickers.getByRole("link").count(), 1);
  assert.equal(await stickers.locator('[data-unlocked="false"]').count(), scenarios.length - 1);
  const unlocked = stickers.locator('[data-sticker-id="H03"]');
  assert.equal(await unlocked.getAttribute("data-unlocked"), "true");
  await visible(unlocked.getByText("已解锁 · 回看帖子 →", { exact: true }));
  geometry.push(await mobileGeometry(page, "贴纸墙解锁一枚"));
  if (viewport.width === 390) await page.screenshot({ path: path.join(screenshots, "stickers-390x844.png"), animations: "disabled" });
  await unlocked.getByRole("link").click();
  await page.waitForURL("**/post/H03");
  await visible(page.getByText("重温本条 · 已恢复上次答案，不重复累计。", { exact: true }));
  await navigation.getByRole("link", { name: "贴纸", exact: true }).click();
  await collectionCount(page, 1);
  await page.reload();
  await collectionCount(page, 1);
  assert.equal(await stickers.getByRole("link").count(), 1);
  geometry.push(await mobileGeometry(page, "贴纸墙刷新恢复与重温去重"));
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await collectionCount(page, 0);
  assert.equal(await stickers.getByRole("link").count(), 0);
  geometry.push(await mobileGeometry(page, "清除本机存储后贴纸归零"));
}

async function screenshotAt(page, locator, filename) {
  await locator.evaluate((node) => {
    const headerHeight = document.querySelector("header").getBoundingClientRect().height;
    window.scrollTo({ top: node.getBoundingClientRect().top + window.scrollY - headerHeight - 16, behavior: "instant" });
  });
  await page.screenshot({ path: path.join(screenshots, filename), animations: "disabled" });
}

async function bottomNavigationAtEnd(page) {
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const info = page.getByRole("complementary", { name: "辟谣局信息", exact: true });
  const box = await info.boundingBox();
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
    } else {
      await route.fulfill({ json: { answer: "浏览器布局测试（mock）：" + "长文本换行".repeat(30) + " https://example.test/" + "a".repeat(180), citedSourceIds: ["S-H03-02"], grounded: true, preview: true } });
    }
  };
  await page.route("**/api/ask", handler);
  try {
    const input = page.getByRole("textbox", { name: "向值班史官提问" });
    const question = "手机布局测试问题";
    await input.fill(question);
    await page.getByRole("button", { name: "发送问题", exact: true }).click();
    await visible(page.getByText("值班史官正在查阅资料…", { exact: true }));
    await mobileGeometry(page, "AI loading");
    release();
    await visible(page.getByRole("alert"));
    assert.equal(await input.inputValue(), question);
    await mobileGeometry(page, "AI error");
    await page.getByRole("button", { name: "重试提问", exact: true }).click();
    await visible(page.getByText(/^浏览器布局测试（mock）：/));
    await mobileGeometry(page, "AI response + long URL");
    assert.equal(await input.inputValue(), "");
  } finally {
    release?.();
    await page.unroute("**/api/ask", handler);
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
  if (!process.env.E2E_BASE_URL) {
    server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", port], { stdio: ["ignore", "pipe", "pipe"] });
    for (const stream of [server.stdout, server.stderr]) stream.on("data", (data) => { serverLog += data.toString(); });
  }
  let started = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    try { started = (await fetch(`${baseURL}/trending`)).ok; } catch { /* 服务启动中 */ }
    if (started) break;
    await setTimeout(250);
  }
  assert.ok(started, "生产服务未启动");
  const executablePath = process.env.CHROME_PATH || (existsSync("/usr/bin/google-chrome") ? "/usr/bin/google-chrome" : undefined);
  browser = await chromium.launch({ executablePath, headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  let verdictCalls = 0;
  page.on("request", (request) => { if (request.url().endsWith("/api/verdict")) verdictCalls++; });

  await page.goto(`${baseURL}/`);
  await page.waitForURL("**/trending");
  await visible(page.getByRole("heading", { name: "古代互联网实时吃瓜榜" }));
  await collectionCount(page, 0);
  const trendingLinks = await page.locator('[aria-label="热搜排行"] > li > a').evaluateAll((links) => links.map((link) => link.getAttribute("href")));
  assert.deepEqual(trendingLinks, scenarios.map(({ id }) => `/post/${id}`));
  await noOverflow(page);
  await mobileGeometry(page, "热搜榜");
  await page.screenshot({ path: path.join(screenshots, "trending-390x844.png"), animations: "disabled" });
  await page.keyboard.press("Tab");
  await focusVisible(page.locator(":focus"));

  const flows = [];
  for (const scenario of scenarios) {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    const { id, answer, best, wrong, sourceCount } = scenario;
    const topic = JSON.parse(await readFile(`data/topics/${id.toLowerCase()}.json`, "utf8"));
    const initialHtml = await (await fetch(`${baseURL}/post/${id}`)).text();
    for (const forbidden of ["isTrue", "isCorrect", "reveal", "sources", "sourceIds", "rewriteOptions", "isBest", "feedback", "aiFacts", "aiLimitations"]) {
      assert.ok(!initialHtml.includes(`"${forbidden}"`) && !initialHtml.includes(`\\"${forbidden}\\"`), `${id} 初始 HTML 泄漏答案字段 ${forbidden}`);
    }
    for (const forbidden of [topic.reveal.correctedClaim, ...topic.sourceIds, "谣言退散", "查证属实"]) {
      assert.ok(!initialHtml.includes(forbidden), `${id} 初始 HTML 泄漏答案 ${forbidden}`);
    }
    await writeFile(path.join(output, `${id}-initial-post.html`), initialHtml);

    await page.goto(`${baseURL}/trending`);
    await page.locator(`[aria-label="热搜排行"] a[href="/post/${id}"]`).click();
    await page.waitForURL(`**/post/${id}`);
    await visible(page.getByRole("heading", { name: topic.title, exact: true }));
    await visible(page.getByText(topic.author.name, { exact: true }));
    await visible(page.getByText(topic.body, { exact: true }));
    await visible(page.getByText(topic.claim, { exact: true }));
    assert.equal(await page.getByRole("radio").count(), 2);
    await visible(page.getByLabel("互动统计"));
    await visible(page.getByLabel("互动统计").getByText(topic.simulatedLikes.toLocaleString("zh-CN"), { exact: true }));
    assert.ok(topic.comments.every((comment) => !comment.text.includes(topic.reveal.correctedClaim) && !/核心主张为[真假]|查证属实|谣言退散|正确(?:答案|选项)[：:]/.test(comment.text)), `${id} 评论直接泄漏结论`);
    await mobileGeometry(page, `${id} 初始帖子与判题区`);
    if (id === "H03") {
      await screenshotAt(page, page.locator("main"), "post-H03-top-390x844.png");
      await screenshotAt(page, page.locator(".task-panel"), "post-H03-task-390x844.png");
    }
    const callsBefore = verdictCalls;
    const stamp = answer ? "查证属实" : "谣言退散";
    const submit = page.getByRole("button", { name: "提交判断", exact: true });
    assert.ok(await submit.isDisabled());
    assert.equal(await page.getByText(stamp, { exact: true }).count(), 0);
    assert.equal(await page.getByText("重温本条", { exact: false }).count(), 0);
    assert.equal(await page.locator("#post-comments > li").count(), 4);
    await page.getByRole("button", { name: /展开更多评论/ }).click();
    assert.equal(await page.locator("#post-comments > li").count(), 8);
    await page.getByRole("button", { name: "收起评论", exact: true }).click();
    assert.equal(await page.locator("#post-comments > li").count(), 4);
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
    if (id === "H03") {
      await page.keyboard.press("Tab");
      await focused(page.getByText("展开详细解释", { exact: true }));
      await focusVisible(page.getByText("展开详细解释", { exact: true }));
    }
    assert.equal(await page.locator(".verdict-stamp").evaluate((node) => getComputedStyle(node).animationDuration), "0.6s");
    await visible(page.getByText("答对了！这次吃瓜有依据。", { exact: true }));
    assert.equal(verdictCalls, callsBefore + 1);
    assert.ok(await page.getByRole("radio", { name: "是真的", exact: true }).isDisabled());
    assert.ok(await page.getByRole("radio", { name: "是假的", exact: true }).isDisabled());
    await page.getByText("展开详细解释", { exact: true }).click();
    await page.getByText(`展开史料依据（${sourceCount} 条）`, { exact: true }).click();
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
    assert.equal(await page.getByText("待人工审核", { exact: true }).count(), sourceCount);
    await mobileGeometry(page, `${id} 揭晓与展开来源`);
    if (id === "H03") await revealScreenshot(page, "post-H03-reveal-390x844.png");
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
      await askStates(page);
    }
    await page.getByRole("button", { name: "生成查证卡", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "查证卡预览" });
    await visible(dialog);
    await visible(dialog.getByText(`查证结果：${answer ? "真" : "假"}`, { exact: true }));
    await visible(dialog.getByText(topic.reveal.correctedClaim, { exact: true }));
    await visible(dialog.getByText("开发预览：本条史实尚待人工审核", { exact: true }));
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
    const downloadReady = page.waitForEvent("download");
    await page.getByRole("button", { name: "下载 PNG", exact: true }).click();
    const download = await downloadReady;
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
    assert.equal(progress.selectedRewriteOptionId, best);
    await page.reload();
    await visible(page.getByText("重温本条 · 已恢复上次答案，不重复累计。", { exact: true }));
    assert.equal(verdictCalls, callsBefore + 2);
    assert.equal(await page.evaluate(() => localStorage.getItem("ahsd:progress:v1")), saved);
    await visible(page.getByText("改写正确，这样说更准确。", { exact: true }));
    await page.emulateMedia({ reducedMotion: "reduce" });
    const animation = await page.locator(".verdict-stamp").evaluate((node) => getComputedStyle(node).animationDuration);
    assert.ok(parseFloat(animation) < 0.01, "减少动态效果设置未生效");
    flows.push({ id, answer, verdict: stamp, bestRewrite: best, sourceCount, pngPath, pngBytes: (await stat(pngPath)).size, dimensions: "1200×675", sampledColors: colorCount, initialAnswerLeak: false, cardClipped: false, restored: true });
  }

  const progressIds = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem("ahsd:progress:v1"))));
  assert.deepEqual(progressIds.sort(), scenarios.map(({ id }) => id));
  await page.goto(`${baseURL}/stickers`);
  await collectionCount(page, scenarios.length);
  assert.equal(await page.locator('[aria-label="贴纸收藏"] a').count(), scenarios.length);
  const stickersHtml = await (await fetch(`${baseURL}/stickers`)).text();
  for (const scenario of scenarios) {
    const topic = JSON.parse(await readFile(`data/topics/${scenario.id.toLowerCase()}.json`, "utf8"));
    for (const forbidden of [topic.reveal.correctedClaim, ...topic.sourceIds, "谣言退散", "查证属实"]) {
      assert.ok(!stickersHtml.includes(forbidden), `贴纸墙初始 HTML 泄漏答案 ${forbidden}`);
    }
  }
  for (const forbidden of ["isTrue", "isCorrect", "reveal", "sources", "sourceIds", "rewriteOptions", "isBest", "feedback", "aiFacts", "aiLimitations"]) {
    assert.ok(!stickersHtml.includes(`"${forbidden}"`) && !stickersHtml.includes(`\\"${forbidden}\\"`), `贴纸墙初始 HTML 泄漏字段 ${forbidden}`);
  }
  const geometry = [];
  for (const viewport of [{ width: 390, height: 844 }, { width: 375, height: 667 }, { width: 430, height: 932 }]) {
    const mobileContext = await browser.newContext({ viewport, acceptDownloads: true, isMobile: true, hasTouch: true });
    const mobile = await mobileContext.newPage();
    mobile.on("pageerror", (error) => errors.push(error.message));
    await stickerCollectionFlow(mobile, viewport, geometry);
    for (const route of ["/trending", "/discover", "/stickers", ...scenarios.map(({ id }) => `/post/${id}`), "/post/DOES-NOT-EXIST", "/missing-page"]) {
      const response = await mobile.goto(`${baseURL}${route}`);
      await visible(mobile.getByRole("heading", { level: 1 }));
      if (route.includes("DOES-NOT-EXIST") || route === "/missing-page") assert.equal(response.status(), 404);
      const pageGeometry = await mobileGeometry(mobile, route);
      await mobile.waitForFunction(() => [...document.images].every((image) => image.complete && image.naturalWidth > 0));
      if (route === "/trending" || route === "/discover") pageGeometry.covers = await coverGeometry(mobile, route);
      geometry.push(pageGeometry);
      const untabbable = await mobile.locator('a[href], button:not(:disabled), input:not(:disabled), textarea:not(:disabled), summary').evaluateAll((nodes) => nodes.filter((node) => node.checkVisibility() && node.tabIndex < 0).length);
      assert.equal(untabbable, 0, "存在不可 Tab 聚焦的控件");
      if (route === "/trending") {
        await mobile.getByText("辟谣局公告", { exact: true }).click();
        await visible(mobile.getByText(/提交后可查看结论与来源/));
        await mobile.getByText("今天的吃瓜守则", { exact: true }).click();
        await visible(mobile.getByText("标题可以有梗，结论要看证据。", { exact: false }));
        await mobileGeometry(mobile, "页内公告/守则展开");
      }
      if (route === "/discover") {
        assert.equal(await mobile.locator('[aria-label="发现话题"]').evaluate((node) => getComputedStyle(node).gridTemplateColumns.split(" ").length), 2);
        if (viewport.width === 390) await screenshotAt(mobile, mobile.locator("main"), "discover-390x844.png");
      }
      const scenario = scenarios.find(({ id }) => route === `/post/${id}`);
      if (scenario) {
        await mobile.getByRole("button", { name: /展开更多评论/ }).click();
        await mobileGeometry(mobile, `${route} 评论展开`);
        await mobile.getByRole("radio", { name: scenario.answer ? "是真的" : "是假的", exact: true }).check();
        if (scenario.id === "H03") await mobile.emulateMedia({ reducedMotion: "reduce" });
        await mobile.getByRole("button", { name: "提交判断", exact: true }).click();
        await visible(mobile.locator(".verdict-stamp"));
        await focused(mobile.locator("#reveal-heading"));
        if (scenario.id === "H03") {
          await mobile.waitForFunction(() => {
            const heading = document.querySelector("#reveal-heading").getBoundingClientRect();
            const header = document.querySelector("header").getBoundingClientRect();
            return heading.y >= header.bottom && heading.bottom < window.innerHeight - 65;
          });
          assert.equal(await mobile.locator(".verdict-stamp").evaluate((node) => getComputedStyle(node).animationDuration), "0s");
        }
        await mobile.getByText("展开详细解释", { exact: true }).click();
        await mobile.getByText(`展开史料依据（${scenario.sourceCount} 条）`, { exact: true }).click();
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
        await mobile.reload();
        await visible(mobile.getByText("重温本条 · 已恢复上次答案，不重复累计。", { exact: true }));
        await mobileGeometry(mobile, `${route} 刷新恢复`);
        await bottomNavigationAtEnd(mobile);
      }
      if (route === "/post/DOES-NOT-EXIST" && viewport.width === 390) await mobile.screenshot({ path: path.join(screenshots, "not-found-390x844.png"), animations: "disabled" });
    }
    await mobileContext.close();
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${baseURL}/trending`);
  await mobileGeometry(page, "1440×900 桌面居中列");
  const desktopShell = await page.locator(".app-shell").boundingBox();
  assert.equal(desktopShell.width, 390);
  assert.equal(desktopShell.x, (1440 - 390) / 2);
  assert.equal(await page.locator('.shell-sticky-rail, .shell-right-rail, canvas, [class*="qr" i], [id*="qr" i]').count(), 0);
  await page.screenshot({ path: path.join(screenshots, "trending-desktop-1440x900.png"), animations: "disabled" });
  await page.goto(`${baseURL}/discover`);
  assert.equal(await page.locator('[aria-label="发现话题"] > li').count(), 8);
  const discoverLinks = await page.locator('[aria-label="发现话题"] > li > a').evaluateAll((links) => links.map((link) => link.getAttribute("href")));
  assert.deepEqual(discoverLinks, scenarios.map(({ id }) => `/post/${id}`));
  const columns = await page.locator('[aria-label="发现话题"]').evaluate((node) => getComputedStyle(node).gridTemplateColumns.split(" ").length);
  assert.equal(columns, 2);
  for (const { id } of scenarios) {
    await page.goto(`${baseURL}/discover`);
    await page.locator(`[aria-label="发现话题"] a[href="/post/${id}"]`).click();
    await page.waitForURL(`**/post/${id}`);
    await visible(page.getByText("重温本条 · 已恢复上次答案，不重复累计。", { exact: true }));
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
  await wrongPage.getByRole("button", { name: "生成查证卡", exact: true }).click();
  await visible(wrongPage.getByRole("dialog", { name: "查证卡预览" }));
  await wrongPage.getByRole("button", { name: "关闭预览", exact: true }).click();
  await wrongPage.getByRole("navigation", { name: "主导航", exact: true }).getByRole("link", { name: "贴纸", exact: true }).click();
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
  const summary = { passed: true, flow: "首页 → trending → H01–H08 → 判题 → 揭晓/来源 → 错误及正确改写 → PNG → 分题刷新恢复", flows, wrongAnswerRevealed: true, stickerCollection: "三视口：未提交不收集、提交后 1/N、贴纸解锁回帖、刷新恢复、重温去重、清除归零；答错也解锁；八题全收集；初始 HTML 不泄题", viewports: ["390×844", "375×667", "430×932", "1440×900"], geometry, desktopShell, aiStates: "仅 AI loading/503/重试/长回答使用浏览器 mock，无模型调用", keyboard: "提交后焦点与 Tab、focus-visible、弹窗焦点循环、Esc/按钮关闭及焦点返回通过", screenshots, browserErrors: errors };
  await writeFile(path.join(output, "result.json"), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({ passed: true, flows: flows.length, viewports: summary.viewports, geometryChecks: geometry.length, browserErrors: errors, result: path.join(output, "result.json"), screenshots }, null, 2));
} catch (error) {
  if (serverLog) console.error(serverLog);
  throw error;
} finally {
  await browser?.close();
  server?.kill("SIGTERM");
}
