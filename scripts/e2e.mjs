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
const output = path.resolve("artifacts/stage-b");
await mkdir(output, { recursive: true });
let server;
let serverLog = "";
let browser;

async function visible(locator) {
  await locator.waitFor({ state: "visible" });
}

async function noOverflow(page) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, `页面水平溢出：${page.url()}`);
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

  const initialHtml = await (await fetch(`${baseURL}/post/H03`)).text();
  for (const forbidden of ["isTrue", "isCorrect", "reveal", "sources", "sourceIds", "rewriteOptions", "isBest", "feedback", "aiFacts", "aiLimitations"]) {
    assert.ok(!initialHtml.includes(`"${forbidden}"`) && !initialHtml.includes(`\\"${forbidden}\\"`), `初始 HTML 泄漏答案字段 ${forbidden}`);
  }
  for (const forbidden of ["约在明末", "S-H03-01", "谣言退散"]) assert.ok(!initialHtml.includes(forbidden), `初始 HTML 泄漏答案 ${forbidden}`);
  await writeFile(path.join(output, "initial-post.html"), initialHtml);

  await page.goto(`${baseURL}/trending`);
  await visible(page.getByRole("heading", { name: "古代互联网实时吃瓜榜（模拟）" }));
  assert.equal(await page.locator('[aria-label="热搜排行"] > li').count(), 1);
  await noOverflow(page);
  await page.screenshot({ path: path.join(output, "trending-1440.png"), fullPage: true });
  await page.getByRole("link", { name: /大唐火锅/ }).click();
  await page.waitForURL("**/post/H03");
  const submit = page.getByRole("button", { name: "提交判断", exact: true });
  assert.ok(await submit.isDisabled());
  assert.equal(verdictCalls, 0);
  assert.equal(await page.getByText("谣言退散", { exact: true }).count(), 0);
  assert.equal(await page.getByText("重温本条", { exact: false }).count(), 0);
  assert.equal(await page.locator("#post-comments > li").count(), 4);
  await page.getByRole("button", { name: /展开更多评论/ }).click();
  assert.equal(await page.locator("#post-comments > li").count(), 8);
  await page.getByRole("button", { name: "收起评论", exact: true }).click();
  assert.equal(await page.locator("#post-comments > li").count(), 4);
  await page.getByRole("radio", { name: "是真的", exact: true }).check();
  await page.getByRole("radio", { name: "是假的", exact: true }).check();
  await submit.click();
  await visible(page.getByText("谣言退散", { exact: true }));
  assert.equal(verdictCalls, 1);
  assert.ok(await page.getByRole("radio", { name: "是真的", exact: true }).isDisabled());
  await page.getByText("展开详细解释", { exact: true }).click();
  await page.getByText("展开史料依据（3 条）", { exact: true }).click();
  assert.equal(await page.getByText("待人工审核", { exact: true }).count(), 3);
  const links = await page.locator('a[target="_blank"]').evaluateAll((nodes) => nodes.map((node) => ({ href: node.href, rel: node.rel })));
  assert.equal(links.length, 3);
  assert.ok(links.every((link) => link.rel.includes("noopener")));
  await page.getByRole("button", { name: /^A / }).click();
  await visible(page.getByText("再打磨一下，看看遗漏了什么。", { exact: true }));
  await page.getByRole("button", { name: /^C / }).click();
  await visible(page.getByText("改写正确，这样说更准确。", { exact: true }));
  await page.getByRole("button", { name: "生成查证卡", exact: true }).click();
  await visible(page.getByRole("dialog", { name: "查证卡预览" }));
  const overflow = await page.getByTestId("check-card").evaluate((node) => ({ width: node.scrollWidth, height: node.scrollHeight, clientHeight: node.clientHeight }));
  assert.equal(overflow.width, 1200);
  assert.equal(overflow.height, 675);
  assert.equal(overflow.clientHeight, 675);
  await page.screenshot({ path: path.join(output, "card-preview-1440.png") });
  const downloadReady = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载 PNG", exact: true }).click();
  const download = await downloadReady;
  assert.equal(await download.failure(), null);
  const pngPath = path.join(output, "H03-check-card.png");
  await download.saveAs(pngPath);
  const png = await readFile(pngPath);
  assert.ok(png.length > 10000, "导出 PNG 为空或异常小");
  assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.equal(png.readUInt32BE(16), 1200);
  assert.equal(png.readUInt32BE(20), 675);
  const colorCount = await page.evaluate(async (base64) => {
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
  assert.ok(colorCount > 20, "导出图片可能空白");
  await page.getByRole("button", { name: "关闭预览", exact: true }).click();
  assert.equal(await page.getByRole("dialog").count(), 0);
  const saved = await page.evaluate(() => localStorage.getItem("ahsd:progress:v1"));
  await page.reload();
  await visible(page.getByText("重温本条 · 已恢复上次答案，不重复计分。", { exact: true }));
  assert.equal(verdictCalls, 2);
  assert.equal(await page.evaluate(() => localStorage.getItem("ahsd:progress:v1")), saved);
  await visible(page.getByText("改写正确，这样说更准确。", { exact: true }));
  await page.emulateMedia({ reducedMotion: "reduce" });
  const animation = await page.locator(".verdict-stamp").evaluate((node) => getComputedStyle(node).animationDuration);
  assert.ok(parseFloat(animation) < 0.01, "减少动态效果设置未生效");

  for (const viewport of [{ width: 1440, height: 900 }, { width: 1920, height: 1080 }, { width: 1024, height: 768 }]) {
    await page.setViewportSize(viewport);
    for (const route of ["/trending", "/discover", "/post/H03"]) {
      await page.goto(`${baseURL}${route}`);
      await page.waitForLoadState("networkidle");
      await noOverflow(page);
      assert.ok(await page.locator("img").evaluateAll((images) => images.every((image) => image.complete && image.naturalWidth > 0)), "本地素材加载失败");
    }
  }
  await page.goto(`${baseURL}/discover`);
  const columns = await page.locator('[aria-label="发现话题"]').evaluate((node) => getComputedStyle(node).gridTemplateColumns.split(" ").length);
  assert.equal(columns, 2);
  await page.getByRole("link", { name: /大唐火锅/ }).click();
  await page.waitForURL("**/post/H03");
  const missing = await page.goto(`${baseURL}/post/DOES-NOT-EXIST`);
  assert.equal(missing.status(), 404);
  await visible(page.getByRole("heading", { name: "这条热搜暂未找到" }));
  assert.equal((await fetch(`${baseURL}/api/verdict`, { method: "POST", body: JSON.stringify({ topicId: "H03", answer: "false" }) })).status, 400);
  assert.equal((await fetch(`${baseURL}/api/verdict`, { method: "POST", body: JSON.stringify({ topicId: "MISSING", answer: false }) })).status, 404);
  assert.deepEqual(errors, [], "浏览器出现运行错误");
  const summary = { passed: true, flow: "trending → H03 → 选假 → 提交 → 改写 A/C → PNG → 刷新恢复", pngPath, pngBytes: (await stat(pngPath)).size, dimensions: "1200×675", sampledColors: colorCount, initialAnswerLeak: false, viewports: ["1440×900", "1920×1080", "1024×768"], browserErrors: errors };
  await writeFile(path.join(output, "result.json"), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
} catch (error) {
  if (serverLog) console.error(serverLog);
  throw error;
} finally {
  await browser?.close();
  server?.kill("SIGTERM");
}
