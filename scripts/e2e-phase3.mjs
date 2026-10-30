import assert from "node:assert/strict";

/** 使用原生产服务与确定性判题；额外玩法和本机评论不请求 AI。 */
export async function phase3Checks({ browser, baseURL, errors, geometryCheck, screenshot, version, topics }) {
  const records = [];
  const viewports = [{ width: 390, height: 844 }, { width: 375, height: 667 }, { width: 430, height: 932 }, { width: 1440, height: 900 }];
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport, isMobile: viewport.width < 600, hasTouch: true, reducedMotion: "reduce" });
    try {
      const page = await context.newPage();
      page.on("pageerror", (error) => errors.push(error.message));
      // 新流程拒绝任何 AI 出站请求；固定 Demo 无需发送消息。
      await context.route(/\/api\/(?:ask|chat)(?:\?|$)/, (route) => { throw new Error(`Phase 3 不应请求 ${new URL(route.request().url()).pathname}`); });
      const apiRequests = [];
      page.on("request", (request) => { if (new URL(request.url()).pathname.startsWith("/api/")) apiRequests.push(new URL(request.url()).pathname); });
      const record = { viewport, states: [], demo: [] };
      const check = async (state) => { await geometryCheck(page, state); record.states.push(state); };
      const capture = async (name, selector) => {
        if (viewport.width !== 390) return;
        await page.locator(selector).evaluate((node) => window.scrollTo({ top: window.scrollY + node.getBoundingClientRect().top - 64, behavior: "instant" }));
        await screenshot(page, name, version, { scrollToTop: false });
      };
      await page.goto(`${baseURL}/trending`);
      await page.locator('.trending-list a[href="/post/H03"]').click();
      await page.waitForURL((url) => url.pathname === "/post/H03");
      record.demo.push("热搜", "详情");
      const thread = page.getByRole("region", { name: "争议回复串", exact: true });
      await thread.waitFor();
      assert.equal(await thread.locator(".debate-correction").count(), 0);
      assert.ok((await thread.innerText()).includes("味道能直接当配料表"));
      await check("争议回复串未揭晓");

      const scenario = page.locator(".scenario-panel");
      await scenario.locator("summary").click();
      const options = scenario.getByRole("group", { name: "情境选择", exact: true }).getByRole("button");
      await options.nth(0).click();
      assert.equal(await options.nth(0).getAttribute("aria-pressed"), "true");
      assert.ok((await scenario.getByRole("status").innerText()).includes("颜色和味道"));
      await options.nth(1).click();
      assert.equal(await options.nth(0).getAttribute("aria-pressed"), "false");
      assert.ok((await scenario.getByRole("status").innerText()).includes("味道与食材分开"));
      await check("情境改选及反馈");
      await capture("scenario", ".participation-panel");

      await page.getByRole("button", { name: "找可疑措辞", exact: true }).click();
      await page.getByLabel("评论措辞练习", { exact: true }).getByRole("button", { name: "检查措辞：一定", exact: true }).click();
      assert.ok((await page.locator(".wording-panel [role=status]").innerText()).includes("绝对化"));
      assert.ok((await page.locator(".wording-panel [role=status]").innerText()).includes("不等于整句话必然为假"));
      await thread.getByRole("button", { name: "检查措辞：只要", exact: true }).click();
      assert.ok((await page.locator(".wording-panel [role=status]").innerText()).includes("概念跳跃"));
      await check("点选实际评论措辞");
      await capture("wording", ".wording-toggle");
      await page.getByRole("button", { name: "结束措辞点选", exact: true }).click();
      assert.equal(await page.getByRole("button", { name: "提交判断", exact: true }).isDisabled(), true);
      assert.deepEqual(apiRequests, []);

      await page.getByRole("button", { name: "写本机评论", exact: true }).click();
      const input = page.getByRole("textbox", { name: "写本机评论", exact: true });
      assert.equal(await input.getAttribute("maxlength"), "280");
      await input.fill("  ");
      await page.getByRole("button", { name: "保存评论", exact: true }).click();
      assert.equal(await page.locator(".comments-panel").getByRole("alert").innerText(), "写点内容再保存吧。");
      await input.fill("我先核对配料，再决定怎么回复。".repeat(30));
      assert.equal((await input.inputValue()).length, 280);
      await input.fill("我先核对配料，再决定怎么回复。");
      await check("本机评论输入与长度限制");
      await page.getByRole("button", { name: "保存评论", exact: true }).click();
      const localRoot = page.locator(".comments-panel > .local-replies > [data-local-id]");
      await localRoot.waitFor();
      await localRoot.getByRole("button", { name: /^回复我/ }).click();
      await page.getByRole("textbox", { name: "回复 我", exact: true }).fill("这条补充也只留在本机。");
      await page.getByRole("button", { name: "保存回复", exact: true }).click();
      const preset = topics.find(({ id }) => id === "H03").comments[0];
      await page.getByRole("button", { name: `回复${preset.author}：${preset.id}`, exact: true }).click();
      await page.getByRole("textbox", { name: `回复 ${preset.author}`, exact: true }).fill("看到争论了，我也想先查配料。");
      await page.getByRole("button", { name: "保存回复", exact: true }).click();
      await check("本机评论及楼中楼已保存");
      await capture("local-comment", ".comments-panel > .local-replies");
      assert.deepEqual(apiRequests, []);
      await page.reload();
      await page.locator(".comments-panel > .local-replies").getByText("这条补充也只留在本机。", { exact: true }).waitFor();
      assert.equal(await scenario.locator("summary").isVisible(), true);
      assert.equal(await scenario.getAttribute("open"), null);
      assert.equal(await page.getByRole("button", { name: "找可疑措辞", exact: true }).getAttribute("aria-pressed"), "false");
      assert.equal(await thread.locator(".debate-correction").count(), 0);
      await localRoot.getByRole("button", { name: "删除自己的评论：我先核对配料，再决定怎么回复。", exact: true }).click();
      assert.equal(await page.getByText("这条补充也只留在本机。", { exact: true }).count(), 0);
      assert.equal(await page.getByText("看到争论了，我也想先查配料。", { exact: true }).count(), 1);
      await page.reload();
      assert.equal(await page.getByText("这条补充也只留在本机。", { exact: true }).count(), 0);
      await page.getByText("看到争论了，我也想先查配料。", { exact: true }).waitFor();
      // 已保存的本机数据与判题、点赞收藏分开。
      await page.getByRole("button", { name: "点赞", exact: true }).click();
      await page.getByRole("button", { name: "收藏", exact: true }).click();
      await page.getByRole("radio", { name: "是假的", exact: true }).check();
      await page.getByRole("button", { name: "提交判断", exact: true }).click();
      await page.locator("#reveal-heading").waitFor();
      record.demo.push("判题");
      const topic = topics.find(({ id }) => id === "H03");
      await thread.getByText(topic.reveal.correctedClaim, { exact: true }).waitFor();
      assert.deepEqual(await thread.locator(".debate-correction a").evaluateAll((nodes) => nodes.map((node) => node.href)), topic.sourceIds.map((id) => topic.sources.find((source) => source.id === id).url));
      await check("判题后证据纠正");
      await capture("thread", ".debate-thread");
      await page.getByRole("button", { name: "再玩一次", exact: true }).click();
      assert.equal(await thread.locator(".debate-correction").count(), 0);
      assert.equal(await page.getByRole("button", { name: "提交判断", exact: true }).isDisabled(), true);
      await page.getByRole("list", { name: "同话题推荐", exact: true }).locator('a[href="/post/P05"]').click();
      await page.waitForURL((url) => url.pathname === "/post/P05");
      record.demo.push("同话题");
      assert.equal(await page.locator("[data-local-id]").count(), 0, "同题不同帖子评论独立");
      await page.goBack();
      await page.waitForURL((url) => url.pathname === "/post/H03");
      assert.equal(await page.getByRole("button", { name: "找可疑措辞", exact: true }).getAttribute("aria-pressed"), "false");
      assert.equal(await page.getByRole("button", { name: "点赞", exact: true }).getAttribute("aria-pressed"), "true");
      assert.equal(await page.getByRole("button", { name: "收藏", exact: true }).getAttribute("aria-pressed"), "true");
      await page.getByText("看到争论了，我也想先查配料。", { exact: true }).waitFor();
      assert.equal(await thread.locator(".debate-correction").count(), 0);
      const nav = page.getByRole("navigation", { name: "主导航", exact: true });
      for (const [label, pathname] of [["发现", "/discover"], ["好友", "/friends"], ["我的", "/me"]]) {
        await nav.getByRole("link", { name: label, exact: true }).click();
        await page.waitForURL((url) => url.pathname === pathname);
        await check(`Demo 到达${label}`);
        record.demo.push(label);
      }
      await page.getByRole("tab", { name: "贴纸", exact: true }).click();
      await page.locator('[data-sticker-id="H03"][data-unlocked="true"]').waitFor();
      assert.deepEqual(apiRequests, ["/api/verdict"]);
      records.push(record);
    } finally { await context.close(); }
  }
  return { records, realAiCalls: 0, screenshots: ["thread", "scenario", "wording", "local-comment"].map((name) => `v${version}-${name}-390x844.png`) };
}
