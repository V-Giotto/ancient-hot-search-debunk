import assert from "node:assert/strict";
import { copyFile } from "node:fs/promises";
import path from "node:path";

async function geometry(page, state) {
  const layout = await page.evaluate(() => {
    const rect = (selector) => document.querySelector(selector).getBoundingClientRect().toJSON();
    const log = document.querySelector(".chat-transcript");
    const style = getComputedStyle(log);
    return {
      composer: rect(".chat-composer"), tabs: rect(".bottom-tabs"), header: rect(".shell-header"),
      shell: rect(".app-shell"), transcript: rect(".chat-transcript"),
      targets: [".chat-composer textarea", ".chat-composer button", ".chat-session-tools button", ".shell-back", ".bottom-tabs a"].map(rect),
      scrollHeight: log.scrollHeight, clientHeight: log.clientHeight, scrollTop: log.scrollTop,
      overflowY: style.overflowY, minHeight: style.minHeight, flexGrow: style.flexGrow,
      viewportTop: visualViewport.offsetTop, viewportBottom: visualViewport.offsetTop + visualViewport.height,
      scrollY, documentHeight: document.documentElement.scrollHeight, innerHeight,
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
    };
  });
  const detail = `${state} ${JSON.stringify(layout)}`;
  assert.ok(Math.abs(layout.tabs.top - layout.composer.bottom) <= 2, `输入区须紧贴 tab 顶边：${detail}`);
  assert.ok(layout.composer.top >= layout.viewportTop && layout.composer.bottom <= layout.viewportBottom, `输入区须完全在可见视口内：${detail}`);
  assert.ok(layout.composer.left >= 0 && layout.composer.right <= page.viewportSize().width, `输入区不得横向溢出：${detail}`);
  assert.ok(Math.abs(layout.tabs.bottom - layout.viewportBottom) <= 2, `tab 栏须贴合可见视口底部：${detail}`);
  assert.ok(layout.transcript.bottom <= layout.composer.top && layout.transcript.height > 0, `消息区须在输入区上方且可见：${detail}`);
  assert.equal(layout.flexGrow, "1");
  assert.equal(layout.minHeight, "0px");
  assert.equal(layout.overflowY, "auto");
  assert.equal(layout.scrollY, 0, `聊天页不应整页滚动：${detail}`);
  assert.ok(layout.documentHeight <= layout.innerHeight, `聊天页不应产生文档滚动：${detail}`);
  assert.equal(layout.horizontalOverflow, false);
  for (const target of layout.targets) assert.ok(target.width >= 44 && target.height >= 44, `触控目标须至少 44px：${detail}`);
  return { state, ...layout };
}

function stable(before, after) {
  for (const edge of ["top", "bottom", "left", "right"]) {
    assert.ok(Math.abs(before.composer[edge] - after.composer[edge]) <= 2, `消息增加/滚动不应移动输入区 ${edge}`);
  }
}

export async function chatLayoutChecks({ browser, baseURL, errors, screenshots, reviewDir, version }) {
  const records = [];
  for (const viewport of [{ width: 390, height: 844 }, { width: 412, height: 915 }, { width: 430, height: 932 }, { width: 375, height: 667 }, { width: 1440, height: 900 }]) {
    const mobile = viewport.width < 600;
    const context = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, reducedMotion: "reduce" });
    try {
      const page = await context.newPage();
      page.on("pageerror", (error) => errors.push(error.message));
      let requests = 0;
      await context.route("**/api/chat", (route) => {
        requests++;
        return route.fulfill({ json: { reply: `吾听着呢，这是第${requests}封回信。` } });
      });
      await page.goto(`${baseURL}/friends/chengjisihan`);
      await page.getByRole("textbox").fill(" "); // 等待事件绑定及本机历史恢复。
      await page.getByRole("textbox").fill("");
      assert.equal(await page.locator(".chat-transcript li").count(), 1, "新会话只有欢迎消息");
      assert.equal(requests, 0);
      const initial = await geometry(page, "欢迎消息");
      if (!mobile) {
        assert.equal(initial.shell.width, 390);
        assert.equal(initial.shell.x, (viewport.width - 390) / 2);
      }
      const capture = async (name) => {
        await page.waitForFunction(() => [...document.images].every((img) => img.complete && img.naturalWidth > 0));
        const filename = `v${version}-${name}-${viewport.width}x${viewport.height}.png`;
        const target = path.join(screenshots, filename);
        await page.screenshot({ path: target, animations: "disabled" });
        if (reviewDir) await copyFile(target, path.join(reviewDir, filename));
      };
      if (viewport.width === 390 || viewport.width === 412) await capture("chat");

      // 通过既有本机历史格式注入长对话，再实际发送一轮（仅 mock）。
      await page.evaluate(() => {
        const entries = Array.from({ length: 40 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: `第${i + 1}条消息：慢慢聊，今日还有许多话想说。`.repeat(3) }));
        localStorage.setItem("ahsd:chat:v1:chengjisihan", JSON.stringify({ version: 1, entries }));
      });
      await page.reload();
      await page.waitForFunction(() => document.querySelectorAll(".chat-transcript li").length === 41);
      stable(initial, await geometry(page, "恢复多条消息"));
      await page.getByRole("textbox").fill("还有些话想说。");
      await page.getByRole("button", { name: "发送消息", exact: true }).click();
      await page.waitForFunction(() => document.querySelectorAll(".chat-transcript li").length === 43 && !document.querySelector(".chat-composer textarea").disabled);
      assert.equal(requests, 1);
      const many = await geometry(page, "发送后多条消息");
      stable(initial, many);
      assert.ok(many.scrollHeight > many.clientHeight && many.scrollTop > 0, "长对话须溢出消息区并滚到最新消息");
      await page.locator(".chat-transcript").evaluate((node) => { node.scrollTop = 0; });
      const top = await geometry(page, "滚到最早消息");
      assert.equal(top.scrollTop, 0);
      stable(initial, top);
      await page.locator(".chat-transcript").evaluate((node) => { node.scrollTop = node.scrollHeight; });
      stable(initial, await geometry(page, "滚到最新消息"));
      if (viewport.width === 390) await capture("chat-many");

      const states = [initial, many, top];
      if (mobile) {
        // 覆盖支持 resize-content/dvh 的浏览器。
        await page.setViewportSize({ width: viewport.width, height: viewport.height - 280 });
        await page.waitForFunction(() => Math.abs(document.querySelector(".app-shell").getBoundingClientRect().height - visualViewport.height) < 1);
        states.push(await geometry(page, "布局视口缩小（键盘）"));
        await page.setViewportSize(viewport);
        await page.waitForFunction(() => Math.abs(document.querySelector(".app-shell").getBoundingClientRect().height - visualViewport.height) < 1);

        // 内嵌浏览器只缩小 visualViewport 的合成回归；不声称是真机键盘。
        await page.evaluate(() => {
          Object.defineProperty(visualViewport, "height", { configurable: true, value: innerHeight - 300 });
          Object.defineProperty(visualViewport, "offsetTop", { configurable: true, value: 12 });
          visualViewport.dispatchEvent(new Event("resize"));
        });
        const keyboard = await geometry(page, "仅可见视口缩小（合成键盘）");
        assert.equal(keyboard.innerHeight, viewport.height, "合成键盘不能缩小布局视口");
        states.push(keyboard);
        await page.evaluate(() => {
          Object.defineProperty(visualViewport, "offsetTop", { configurable: true, value: 24 });
          visualViewport.dispatchEvent(new Event("scroll"));
        });
        states.push(await geometry(page, "可见视口平移"));
        await page.evaluate(() => {
          delete visualViewport.height;
          delete visualViewport.offsetTop;
          visualViewport.dispatchEvent(new Event("resize"));
        });
        stable(initial, await geometry(page, "键盘收起"));

        const cdp = await context.newCDPSession(page);
        await cdp.send("Emulation.setSafeAreaInsetsOverride", { insets: { top: 24, bottom: 34 } });
        const safeArea = await geometry(page, "上下安全区");
        assert.equal(safeArea.header.height, initial.header.height + 24);
        assert.equal(safeArea.tabs.height, initial.tabs.height + 34, "底部安全区应仅计入 tab 栏一次");
        states.push(safeArea);
      }
      // 离开聊天页须清除视口样式及固定布局。
      await page.getByRole("link", { name: "返回好友列表", exact: true }).click();
      await page.getByRole("heading", { name: "见字如面", exact: true }).waitFor();
      await page.waitForFunction(() => !document.querySelector(".app-shell").style.getPropertyValue("--chat-viewport-height"));
      assert.notEqual(await page.locator(".app-shell").evaluate((node) => getComputedStyle(node).position), "fixed");
      records.push({ viewport, states });
    } finally { await context.close(); }
  }
  return { records, realAiCalls: 0 };
}
