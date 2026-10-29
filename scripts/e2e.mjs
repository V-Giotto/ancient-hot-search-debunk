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
const output = path.resolve("artifacts/stage-3");
const screenshots = path.join(output, "screenshots");
const scenarios = [
  { id: "H01", answer: false, best: "A", wrong: "B", sourceCount: 1 },
  { id: "H02", answer: true, best: "C", wrong: "A", sourceCount: 3 },
  { id: "H03", answer: false, best: "C", wrong: "A", sourceCount: 3 },
  { id: "H04", answer: true, best: "B", wrong: "A", sourceCount: 3 },
  { id: "H05", answer: false, best: "B", wrong: "A", sourceCount: 1 },
  { id: "H06", answer: true, best: "A", wrong: "B", sourceCount: 2 },
  { id: "H07", answer: false, best: "C", wrong: "A", sourceCount: 1 },
  { id: "H08", answer: true, best: "B", wrong: "A", sourceCount: 1 },
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
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, `页面水平溢出：${page.url()}`);
}

async function focused(locator) {
  assert.ok(await locator.evaluate((node) => node === document.activeElement), "键盘焦点位置不正确");
}

async function focusVisible(locator) {
  assert.ok(await locator.evaluate((node) => node.matches(":focus-visible") && getComputedStyle(node).outlineStyle !== "none" && parseFloat(getComputedStyle(node).outlineWidth) >= 2), "缺少清晰的键盘焦点样式");
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
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  let verdictCalls = 0;
  page.on("request", (request) => { if (request.url().endsWith("/api/verdict")) verdictCalls++; });

  await page.goto(`${baseURL}/trending`);
  await visible(page.getByRole("heading", { name: "古代互联网实时吃瓜榜（模拟）" }));
  const trendingLinks = await page.locator('[aria-label="热搜排行"] > li > a').evaluateAll((links) => links.map((link) => link.getAttribute("href")));
  assert.deepEqual(trendingLinks, scenarios.map(({ id }) => `/post/${id}`));
  await noOverflow(page);
  await page.keyboard.press("Tab");
  await focusVisible(page.locator(":focus"));
  await page.screenshot({ path: path.join(output, "trending-1440.png"), fullPage: true });

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
    assert.equal(await page.locator(".verdict-stamp").evaluate((node) => getComputedStyle(node).animationDuration), "0.6s");
    await visible(page.getByText("答对了！这次吃瓜有依据。", { exact: true }));
    assert.equal(verdictCalls, callsBefore + 1);
    assert.ok(await page.getByRole("radio", { name: "是真的", exact: true }).isDisabled());
    assert.ok(await page.getByRole("radio", { name: "是假的", exact: true }).isDisabled());
    await page.getByText("展开详细解释", { exact: true }).click();
    await page.getByText(`展开史料依据（${sourceCount} 条）`, { exact: true }).click();
    assert.equal(await page.getByText("待人工审核", { exact: true }).count(), sourceCount);
    const links = await page.locator('a[target="_blank"]').evaluateAll((nodes) => nodes.map((node) => ({ href: node.href, rel: node.rel })));
    assert.deepEqual(links.map((link) => link.href), topic.sourceIds.map((sourceId) => new URL(sourceIndex.find((source) => source.id === sourceId).url).href));
    assert.ok(links.every((link) => link.rel.includes("noopener")));
    await page.getByRole("button", { name: new RegExp(`^${wrong} `) }).click();
    await visible(page.getByText("再打磨一下，看看遗漏了什么。", { exact: true }));
    await page.getByRole("button", { name: new RegExp(`^${best} `) }).click();
    await visible(page.getByText("改写正确，这样说更准确。", { exact: true }));
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
    await page.screenshot({ path: path.join(output, `${id}-card-preview-1440.png`) });
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
    await visible(page.getByText("重温本条 · 已恢复上次答案，不重复计分。", { exact: true }));
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
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1920, height: 1080 }, { width: 1024, height: 768 }]) {
    await page.setViewportSize(viewport);
    for (const route of ["/trending", "/discover", ...scenarios.map(({ id }) => `/post/${id}`)]) {
      await page.goto(`${baseURL}${route}`);
      await page.waitForLoadState("networkidle");
      await noOverflow(page);
      assert.equal(await page.locator(".shell-right-rail").isVisible(), viewport.width >= 1440);
      assert.ok(await page.locator("img").evaluateAll((images) => images.every((image) => image.complete && image.naturalWidth > 0)), "本地素材加载失败");
      const untabbable = await page.locator('a[href], button:not(:disabled), input:not(:disabled), textarea:not(:disabled), summary').evaluateAll((nodes) => nodes.filter((node) => node.getClientRects().length && node.tabIndex < 0).length);
      assert.equal(untabbable, 0, "存在不可 Tab 聚焦的可用控件");
      if (viewport.width >= 1440 && ["/trending", "/discover", "/post/H03"].includes(route)) {
        if (route === "/post/H03") {
          await visible(page.locator(".verdict-stamp"));
          await page.locator(".reveal-panel").scrollIntoViewIfNeeded();
        }
        const name = route === "/post/H03" ? "post-H03-revealed" : route.slice(1);
        await page.screenshot({ path: path.join(screenshots, `${name}-${viewport.width}x${viewport.height}.png`), fullPage: route !== "/post/H03" });
      }
    }
    await page.goto(`${baseURL}/post/H03`);
    await visible(page.locator(".verdict-stamp"));
    await page.getByRole("button", { name: "生成查证卡", exact: true }).click();
    await visible(page.getByRole("dialog"));
    await noOverflow(page);
    if (viewport.width >= 1440) await page.screenshot({ path: path.join(screenshots, `check-card-dialog-${viewport.width}x${viewport.height}.png`) });
    await page.keyboard.press("Escape");
    await focused(page.getByRole("button", { name: "生成查证卡", exact: true }));
  }
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
    await visible(page.getByText("重温本条 · 已恢复上次答案，不重复计分。", { exact: true }));
  }
  const missing = await page.goto(`${baseURL}/post/DOES-NOT-EXIST`);
  assert.equal(missing.status(), 404);
  await visible(page.getByRole("heading", { name: "这条热搜暂未找到" }));
  assert.equal((await fetch(`${baseURL}/api/verdict`, { method: "POST", body: JSON.stringify({ topicId: "H03", answer: "false" }) })).status, 400);
  assert.equal((await fetch(`${baseURL}/api/verdict`, { method: "POST", body: JSON.stringify({ topicId: "MISSING", answer: false }) })).status, 404);
  assert.deepEqual(errors, [], "浏览器出现运行错误");
  const summary = { passed: true, flow: "trending → H01–H08 → 判题 → 揭晓/来源 → 错误及正确改写 → PNG → 分题刷新恢复", flows, viewports: ["1440×900", "1920×1080", "1024×768"], keyboard: "Tab/focus-visible、弹窗焦点循环、Esc/按钮关闭及焦点返回通过", screenshots, browserErrors: errors };
  await writeFile(path.join(output, "result.json"), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
} catch (error) {
  if (serverLog) console.error(serverLog);
  throw error;
} finally {
  await browser?.close();
  server?.kill("SIGTERM");
}
