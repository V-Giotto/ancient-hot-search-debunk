import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";

export async function discoverHeaderChecks(page) {
  const header = page.locator(".discover-hero");
  assert.equal(await header.count(), 1);
  const title = header.getByRole("heading", { level: 1, name: "发现", exact: true });
  const tagline = header.locator(".discover-tagline");
  const search = page.getByRole("searchbox", { name: "筛选话题", exact: true });
  for (const node of [header, title, tagline, search]) assert.ok(await node.isVisible());
  assert.equal(await tagline.textContent(), "今天，巷子里聊什么？");
  assert.equal(await search.getAttribute("placeholder"), "搜索标题、分类或作者…");
  assert.equal(await header.getByRole("link", { name: "返回热搜榜" }).getAttribute("href"), "/trending");
  assert.equal(await page.locator(".shell-header").count(), 0);
  const layout = await page.evaluate(() => {
    const selectors = [".discover-title-row h1", ".discover-tagline", "#discover-query"];
    const items = selectors.map((selector) => {
      const node = document.querySelector(selector), box = node.getBoundingClientRect();
      return { selector, ...box.toJSON(), scrollWidth: node.scrollWidth, clientWidth: node.clientWidth, scrollHeight: node.scrollHeight, clientHeight: node.clientHeight };
    });
    const banner = document.querySelector(".discover-banner"), back = document.querySelector(".discover-hero .shell-back");
    return { items, back: back.getBoundingClientRect().toJSON(), objectFit: getComputedStyle(banner).objectFit, overflow: document.documentElement.scrollWidth > innerWidth, tabsTop: document.querySelector(".bottom-tabs").getBoundingClientRect().top };
  });
  assert.equal(layout.objectFit, "cover");
  assert.equal(layout.overflow, false);
  assert.ok(layout.back.width >= 44 && layout.back.height >= 44);
  for (const item of layout.items) {
    assert.ok(item.left >= 0 && item.right <= page.viewportSize().width && item.top >= 0 && item.bottom < layout.tabsTop, `顶部文字/搜索不可裁切或遮挡：${JSON.stringify(item)}`);
    assert.ok(item.scrollWidth <= item.clientWidth && item.scrollHeight <= item.clientHeight, `顶部文案溢出：${JSON.stringify(item)}`);
  }
  assert.ok(layout.items[0].bottom <= layout.items[1].top && layout.items[1].bottom <= layout.items[2].top, "标题、标语、搜索框的几何顺序错误");
  return layout;
}

// 以最亮白色图像为底合成半透明表面，给真实图片亮度一个保守上界。
async function surfaceContrast(page, selectors) {
  return page.evaluate((selectors) => {
    const rgba = (value) => value.match(/[\d.]+/g).map(Number);
    const blend = (top, bottom) => top.slice(0, 3).map((value, i) => value * (top[3] ?? 1) + bottom[i] * (1 - (top[3] ?? 1)));
    const luminance = (rgb) => rgb.map((value) => value / 255).map((v) => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
    return selectors.map((selector) => {
      const node = document.querySelector(selector);
      if (!node) throw new Error(`缺少对比度样本：${selector}`);
      const chain = [];
      for (let parent = node; parent && parent !== document.body; parent = parent.parentElement) chain.unshift(parent);
      const bg = chain.reduce((color, parent) => blend(rgba(getComputedStyle(parent).backgroundColor), color), [255, 255, 255]);
      const fg = blend(rgba(getComputedStyle(node).color), bg);
      const a = luminance(fg), b = luminance(bg);
      return { selector, ratio: (Math.max(a, b) + .05) / (Math.min(a, b) + .05) };
    });
  }, selectors);
}

export async function nightThemeChecks({ browser, baseURL, errors, topics }) {
  const bannerPath = "public/banners/discover-night.webp", backgroundPath = "public/backgrounds/night-lake.webp";
  const backgroundBytes = (await stat(backgroundPath)).size;
  assert.ok(backgroundBytes <= 150000, "夜景背景不得超过150KB");
  for (const file of [bannerPath, backgroundPath]) {
    const data = await readFile(file);
    assert.equal(data.toString("ascii", 0, 4), "RIFF");
    assert.equal(data.toString("ascii", 8, 12), "WEBP");
  }
  const records = [];
  for (const viewport of [{ width: 390, height: 844 }, { width: 375, height: 667 }, { width: 430, height: 932 }, { width: 1440, height: 900 }]) {
    const context = await browser.newContext({ viewport, isMobile: viewport.width < 600, hasTouch: viewport.width < 600, reducedMotion: "reduce" });
    try {
      const page = await context.newPage();
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`${baseURL}/discover`);
      await page.waitForFunction(() => document.querySelector(".discover-banner").naturalWidth === 1200);
      const header = await discoverHeaderChecks(page);
      const input = page.getByRole("searchbox", { name: "筛选话题", exact: true });
      for (const query of [topics[0].title, topics[0].category, topics[0].author.name]) {
        await input.fill(` ${query} `);
        const expected = topics.filter((topic) => [topic.title, topic.category, ...topic.tags, topic.author.name].some((text) => text.toLocaleLowerCase("zh-CN").includes(query.toLocaleLowerCase("zh-CN")))).map(({ id }) => `/post/${id}`);
        await page.waitForFunction((expected) => document.querySelectorAll(".discover-card").length === expected, expected.length);
        assert.deepEqual(await page.locator(".discover-card > a").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("href"))), expected);
      }
      await input.fill("无匹配夜景关键词");
      await page.getByRole("heading", { name: "没有找到匹配的话题" }).waitFor();
      await page.getByRole("button", { name: "清除筛选" }).click();
      assert.equal(await page.locator(".discover-card").count(), topics.length);
      const surfaces = [];
      for (const [route, selectors] of [
        ["/discover", [".discover-title-row h1", ".discover-tagline", ".discover-copy h2", ".discover-author"]],
        ["/trending", [".trending-copy h3", ".trending-copy .trending-byline"]],
        ["/friends", [".friends-intro h1", ".friend-card h3", ".friend-card p"]],
        ["/me", [".me-page > h1", ".me-intro", ".me-panel > h2", ".sticker-intro", ".me-tabs button"]],
        ["/post/P01", [".post-title", ".post-body"]],
        ["/post/T01", [".post-title", ".post-body"]],
        ["/friends/libai", [".chat-profile h1", ".chat-bubble", ".chat-sender"]],
      ]) {
        await page.goto(`${baseURL}${route}`);
        await page.waitForLoadState("networkidle");
        const background = await page.evaluate(async () => {
          const style = getComputedStyle(document.body, "::before");
          const image = new Image();
          image.src = "/backgrounds/night-lake.webp";
          await image.decode();
          return { position: style.position, image: style.backgroundImage, width: image.naturalWidth, height: image.naturalHeight, animationDuration: getComputedStyle(document.body, "::after").animationDuration, overflow: document.documentElement.scrollWidth > innerWidth };
        });
        assert.equal(background.position, "fixed");
        assert.ok(background.image.includes("/backgrounds/night-lake.webp"));
        assert.equal(background.width, 780);
        assert.equal(background.height, 1388);
        assert.equal(background.animationDuration, "0s");
        assert.equal(background.overflow, false);
        const contrast = await surfaceContrast(page, selectors);
        for (const sample of contrast) assert.ok(sample.ratio >= 4.5, `${route} 最亮底图合成后的对比度不足：${JSON.stringify(sample)}`);
        surfaces.push({ route, background, contrast });
      }
      await context.route("**/banners/discover-night.webp", (route) => route.abort());
      await context.route("**/backgrounds/night-lake.webp", (route) => route.abort());
      await page.goto(`${baseURL}/discover`);
      await page.waitForFunction(() => document.querySelector(".discover-banner").complete && document.querySelector(".discover-banner").naturalWidth === 0);
      await discoverHeaderChecks(page);
      assert.equal(await page.locator(".discover-hero").evaluate((node) => getComputedStyle(node).backgroundColor), "rgb(8, 12, 35)");
      await input.fill(topics[0].title);
      assert.equal(await page.locator(".discover-card").count(), 1);
      records.push({ viewport, header, surfaces, failedImagesFallback: true, search: "标题/分类/作者/空结果/清除" });
    } finally { await context.close(); }
  }
  return { backgroundBytes, budgetBytes: 150000, records };
}
