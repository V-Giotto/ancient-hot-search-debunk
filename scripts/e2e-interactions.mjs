/** 定位真实按钮后只点击一次；同时处理点击与响应的失败，避免悬空的响应等待。 */
export async function clickAndWaitForResponse(page, button, pathname) {
  // 重玩或锚点跳转后，取消尚未完成的滚动，并避开吸顶头部和固定底栏。
  await button.evaluate((node) => node.scrollIntoView({ behavior: "instant", block: "center" }));
  const [response] = await Promise.all([
    page.waitForResponse((response) => new URL(response.url()).pathname === pathname && response.request().method() === "POST"),
    button.click(),
  ]);
  return response;
}
