// 手动真实 AI 采样：先 npm run build，再 node scripts/sample-chat.mjs [friendId] [message]。
// 此脚本不接入单测/E2E。会启动独立的本机 next start，并产生真实 AI 调用。
import { readFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const root = fileURLToPath(new URL("../", import.meta.url));
let server;
let key = "";

async function main() {
  let localEnv = {};
  try { localEnv = parseEnv(await readFile(new URL("../.env.local", import.meta.url), "utf8")); }
  catch (error) { if (error.code !== "ENOENT") throw new Error("无法读取本机配置。"); }
  const env = { ...localEnv, ...process.env };
  key = env.AI_API_KEY?.trim() || "";
  if (!key) throw new Error("请在环境或 .env.local 中配置 AI_API_KEY。");
  env.AI_API_KEY = key;
  const friendId = process.argv[2] || "libai";
  const message = process.argv[3] || "今日有些疲惫，陪我聊两句吧。";
  if (!/^[a-z][a-z0-9-]{0,47}$/.test(friendId) || !message.trim() || message.length > 200) throw new Error("好友 ID 或消息格式无效。");
  const port = env.SAMPLE_CHAT_PORT || "3210";
  if (!/^\d+$/.test(port) || Number(port) < 1024 || Number(port) > 65535) throw new Error("SAMPLE_CHAT_PORT 须为 1024–65535。");
  // 不复用未知的已有服务，确保实际请求的是本脚本启动的本机生产构建。
  const probe = createServer();
  await new Promise((resolve, reject) => {
    probe.once("error", () => reject(new Error("采样端口已占用，请设置 SAMPLE_CHAT_PORT。")));
    probe.listen(Number(port), "127.0.0.1", () => probe.close(resolve));
  });
  server = spawn(process.execPath, [fileURLToPath(new URL("../node_modules/next/dist/bin/next", import.meta.url)), "start", "--hostname", "127.0.0.1", "--port", port], {
    cwd: root, env, stdio: "ignore",
  });
  let stopped = false;
  server.once("error", () => { stopped = true; });
  server.once("exit", () => { stopped = true; });
  const base = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let attempt = 0; attempt < 120 && !stopped; attempt++) {
    try { ready = (await fetch(`${base}/friends`, { signal: AbortSignal.timeout(1000), redirect: "error" })).ok; }
    catch { /* 等待本机生产服务就绪，不输出网络异常或服务日志。 */ }
    if (ready) break;
    await delay(250);
  }
  if (!ready) throw new Error("本机生产服务未就绪，请先完成 npm run build。");
  const response = await fetch(`${base}/api/chat`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ friendId, message, history: [] }),
    signal: AbortSignal.timeout(180000), redirect: "error",
  });
  if (!response.ok) throw new Error(`本机 /api/chat 返回 HTTP ${response.status}。`);
  const payload = await response.json();
  if (typeof payload.reply !== "string" || payload.reply.includes(key)) throw new Error("采样响应不可显示。");
  console.log(JSON.stringify({ friendId, reply: payload.reply }));
}

for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => {
  server?.kill("SIGTERM");
  process.exit(signal === "SIGINT" ? 130 : 143);
});

try { await main(); }
catch {
  // 不回显任意异常、请求、配置或密钥；详细网络诊断交由服务端既有错误契约。
  console.error("采样未完成：请检查本机配置、构建、端口及好友 ID。");
  process.exitCode = 1;
} finally { server?.kill("SIGTERM"); }
