import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";

/** 已审新题在 formal 完整验收，并核对同一生产构建的 preview；AI 接口仅本机无 key。 */
export async function phase4Checks({ browser, formalURL, previewURL, errors, geometryCheck, screenshot, version }) {
  const topics = await Promise.all(["h13", "h14"].map(async (id) => JSON.parse(await readFile(`data/topics/${id}.json`, "utf8"))));
  const sourceIndex = JSON.parse(await readFile("data/source-index.json", "utf8"));
  const constraints = JSON.parse(await readFile("tests/fixtures/display-constraints.json", "utf8"));
  const formal = [];
  for (const topic of topics) {
    assert.equal(topic.reviewStatus, "reviewed");
    assert.equal(topic.reviewBy, "Giotto");
    assert.equal(topic.reviewedAt, "2026-10-30T09:53:00-07:00");
    assert.deepEqual(topic.eraReview, { status: "reviewed", reviewer: "Giotto", reviewedAt: "2026-10-30T09:53:00-07:00" });
    assert.equal((await fetch(`${formalURL}/post/${topic.id}`)).status, 200);
    assert.equal((await fetch(`${previewURL}/post/${topic.id}`)).status, 200);
    for (const [route, body] of [
      ["verdict", { topicId: topic.id, answer: topic.isTrue }],
      ["ask", { topicId: topic.id, question: "本题的限制是什么？" }],
      ["chat", { friendId: "libai", message: "聊聊这条", sharedTopicId: topic.id }],
    ]) {
      const response = await fetch(`${formalURL}/api/${route}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      assert.equal(response.status, route === "verdict" ? 200 : 503, `${topic.id} formal ${route} 已审核`);
      const result = await response.json();
      if (route === "verdict") {
        assert.equal(result.isCorrect, true);
        assert.deepEqual(result.sources.map(({ id }) => id), topic.sourceIds);
        for (const source of result.sources) {
          assert.equal(source.status, "reviewed");
          assert.equal(source.verifiedBy, "Giotto");
          assert.equal(source.verifiedAt, "2026-10-30T09:53:00-07:00");
        }
      } else assert.doesNotMatch(JSON.stringify(result), /"(?:isTrue|reveal|sources|rewriteOptions)"/);
    }
    formal.push({ id: topic.id, reviewStatus: topic.reviewStatus, reviewedAt: topic.reviewedAt, detail: 200, verdict: 200, ask: 503, chat: 503, previewDetail: 200 });
  }
  const flows = [], geometry = [], screenshots = [];
  const viewports = [{ width: 390, height: 844 }, { width: 375, height: 667 }, { width: 430, height: 932 }, { width: 1440, height: 900 }];
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport, isMobile: viewport.width < 600, hasTouch: true, reducedMotion: "reduce", acceptDownloads: true });
    try {
      const page = await context.newPage();
      page.on("pageerror", (error) => errors.push(error.message));
      for (const [module, count, id] of [["trending", 19, "H14"], ["discover", 25, "H13"]]) {
        await page.goto(`${formalURL}/${module}`);
        const selector = module === "trending" ? ".trending-list > li" : ".discover-card";
        assert.equal(await page.locator(selector).count(), count);
        await page.locator(`${selector} a[href='/post/${id}']`).waitFor();
        geometry.push(await geometryCheck(page, `Phase 4 formal ${module} ${count} 条`));
        if (viewport.width === 390 && module === "trending") {
          await page.locator("a[href='/post/H14']").scrollIntoViewIfNeeded();
          await screenshot(page, "trending", version, { scrollToTop: false });
          screenshots.push(`v${version}-trending-390x844.png`);
        }
      }
      for (const topic of topics) {
        const html = await (await fetch(`${formalURL}/post/${topic.id}`)).text();
        for (const field of ["isTrue", "isCorrect", "reveal", "sources", "sourceIds", "rewriteOptions", "isBest", "feedback", "aiFacts", "aiLimitations", "eraReview"]) assert.ok(!html.includes(`"${field}"`) && !html.includes(`\\"${field}\\"`), `${topic.id} 首次 HTML 泄漏 ${field}`);
        assert.ok(!html.includes(topic.reveal.correctedClaim));
        await page.goto(`${formalURL}/post/${topic.id}`);
        await page.getByRole("heading", { name: topic.title, exact: true }).waitFor();
        const cover = page.locator(`img[src='${topic.coverUrl}']`);
        await cover.waitFor();
        await page.waitForFunction((src) => [...document.images].some((image) => image.getAttribute("src") === src && image.complete && image.naturalWidth > 0), topic.coverUrl);
        const dimensions = await cover.evaluate((image) => ({ width: image.naturalWidth, height: image.naturalHeight }));
        assert.deepEqual(dimensions, { width: 1200, height: 675 });
        assert.equal((await fetch(`${formalURL}${topic.coverUrl}`)).status, 200);
        assert.equal(await page.getByText(topic.era.label, { exact: true }).count(), 1);
        if (viewport.width === 390) {
          await screenshot(page, topic.id.toLowerCase(), version);
          screenshots.push(`v${version}-${topic.id.toLowerCase()}-390x844.png`);
        }
        await page.getByRole("button", { name: /展开更多评论/ }).click();
        assert.equal(await page.locator("#post-comments > li").count(), 6);
        const copy = (await page.locator(".post-title, .post-body, .news-lead, .news-related, .comments-panel").allTextContents()).join("\n");
        for (const word of constraints.answerKeywords[topic.id]) assert.ok(!copy.includes(word), `${topic.id} 提前揭晓 ${word}`);
        geometry.push(await geometryCheck(page, `${topic.id} 初始与全部评论`));
        const judge = page.waitForResponse((response) => response.url().endsWith("/api/verdict"));
        await page.getByRole("radio", { name: topic.isTrue ? "是真的" : "是假的", exact: true }).check();
        await page.getByRole("button", { name: "提交判断", exact: true }).click();
        const verdictResponse = await judge;
        assert.equal(verdictResponse.status(), 200);
        const result = await verdictResponse.json();
        assert.equal(result.isCorrect, true);
        assert.deepEqual(result.sources.map(({ id }) => id), topic.sourceIds);
        assert.ok(result.sources.every(({ status }) => status === "reviewed"));
        await page.getByText("答对了！这次吃瓜有依据。", { exact: true }).waitFor();
        await page.getByText("为什么", { exact: true }).click();
        await page.getByText(`展开史料依据（${topic.sourceIds.length} 条）`, { exact: true }).click();
        await page.getByText("延伸冷知识", { exact: true }).click();
        const reveal = page.locator(".reveal-panel");
        for (const field of ["shortExplanation", "detailedExplanation", "correctedClaim", "funFact"]) assert.ok(await reveal.getByText(topic.reveal[field], { exact: true }).isVisible());
        const urls = await reveal.locator("a[target='_blank']").evaluateAll((nodes) => nodes.map((node) => node.href));
        assert.deepEqual(urls, topic.sourceIds.map((id) => new URL(sourceIndex.find((source) => source.id === id).url).href));
        assert.equal(await reveal.getByText("已人工审核", { exact: true }).count(), topic.sourceIds.length);
        assert.equal(await reveal.getByText("待人工审核", { exact: true }).count(), 0);
        const best = topic.rewriteOptions.find(({ isBest }) => isBest);
        const wrong = topic.rewriteOptions.find(({ isBest }) => !isBest);
        await page.getByRole("button", { name: new RegExp(`^${wrong.id} `) }).click();
        await page.getByText("再打磨一下，看看遗漏了什么。", { exact: true }).waitFor();
        await page.getByRole("button", { name: new RegExp(`^${best.id} `) }).click();
        await page.getByText("改写正确，这样说更准确。", { exact: true }).waitFor();
        geometry.push(await geometryCheck(page, `${topic.id} 揭晓/范围限制/来源/改写`));
        await page.getByRole("link", { name: "问问 AI", exact: true }).click();
        await page.getByRole("textbox").fill("这道题不能外推哪些范围？");
        const ask = page.waitForResponse((response) => response.url().endsWith("/api/ask"));
        await page.getByRole("button", { name: "发送问题", exact: true }).click();
        assert.equal((await ask).status(), 503);
        await page.getByText("AI 未配置", { exact: true }).waitFor();
        if (viewport.width === 390) {
          await page.getByRole("button", { name: "生成查证卡", exact: true }).click();
          await page.getByRole("dialog", { name: "查证卡预览" }).waitFor();
          assert.ok(await page.getByTestId("check-card").getByText("已人工审核", { exact: true }).isVisible());
          assert.equal(await page.getByTestId("check-card").getByText("开发预览：本条史实尚待人工审核", { exact: true }).count(), 0);
          const card = await page.getByTestId("check-card").evaluate((node) => {
            const bounds = node.getBoundingClientRect();
            return { width: node.scrollWidth, height: node.scrollHeight, clipped: [...node.querySelectorAll("*")].some((child) => {
              const box = child.getBoundingClientRect();
              return box.top < bounds.top - 1 || box.bottom > bounds.bottom + 1 || box.left < bounds.left - 1 || box.right > bounds.right + 1;
            }) };
          });
          assert.deepEqual(card, { width: 1200, height: 675, clipped: false }, `${topic.id} 查证卡不得裁掉结论或审核状态`);
          const download = page.waitForEvent("download");
          await page.getByRole("button", { name: /下载 PNG/ }).click();
          const file = await download;
          const target = `artifacts/stage-6/${topic.id}-v${version}.png`;
          await file.saveAs(target);
          const png = await readFile(target);
          assert.equal(png.readUInt32BE(16), 1200); assert.equal(png.readUInt32BE(20), 675);
          assert.ok((await stat(target)).size > 1000);
          await page.getByRole("button", { name: "关闭预览", exact: true }).click();
        }
        await page.reload();
        await page.getByRole("button", { name: "提交判断", exact: true }).waitFor();
        assert.equal(await page.locator(".verdict-stamp").count(), 0);
        assert.equal(await page.locator("input[type=radio]:checked").count(), 0);
        flows.push({ id: topic.id, viewport, mode: "formal", reviewedSources: topic.sourceIds.length, initialAnswerLeak: false, revealAndLimitations: true, correctedRewrite: best.id, reloadFresh: true, aiUnconfigured: 503, cover: dimensions });
      }
      await page.goto(`${formalURL}/me`);
      await page.getByRole("list", { name: "贴纸收藏" }).waitFor();
      assert.equal(await page.getByRole("list", { name: "贴纸收藏" }).locator(":scope > li").count(), 14);
      assert.ok((await page.getByRole("status").textContent()).includes("2/14"));
      geometry.push(await geometryCheck(page, "Phase 4 十四枚贴纸/同题去重"));
    } finally { await context.close(); }
  }
  assert.deepEqual(errors, [], "Phase 4 浏览器运行错误");
  return { formal, flows, geometry, screenshots, browserErrors: [...errors], realAiCalls: 0, topics: 14, trueFalse: "7:7", feedEntries: 44, pendingSourceIds: sourceIndex.filter(({ status }) => status === "pending").map(({ id }) => id) };
}
