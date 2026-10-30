import { createServer } from "node:net";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const start = args[0] === "--start";
const nextArgs = start ? args.slice(1) : args;

function option(long, short) {
  for (let index = nextArgs.length - 1; index >= 0; index--) {
    const arg = nextArgs[index];
    if (arg === long || arg === short) return nextArgs[index + 1] ?? "";
    if (arg.startsWith(`${long}=`)) return arg.slice(long.length + 1);
    if (arg.startsWith(short) && arg.length > short.length) return arg.slice(short.length);
  }
}

async function main() {
  const rawPort = option("--port", "-p") ?? process.env.PORT ?? "3000";
  if (!/^\d+$/.test(rawPort) || Number(rawPort) < 1 || Number(rawPort) > 65535) {
    throw new Error("端口须为 1–65535 的整数；请检查 PORT 或 --port/-p 参数。");
  }
  const port = Number(rawPort);
  const hostname = option("--hostname", "-H");
  // Windows allows a wildcard/IPv6 listener to coexist with an occupied IPv4
  // loopback port. Probe the address Next's local URL uses unless the caller
  // explicitly selected another hostname.
  const probeHostname = hostname || "127.0.0.1";
  const probe = createServer();
  await new Promise((resolve, reject) => {
    probe.once("error", (error) => reject(new Error(error.code === "EADDRINUSE"
      ? `端口 ${port} 已被占用。请先确认并停止该端口的旧服务，或用 PORT / --port 选择其他端口；启动已取消。`
      : `无法检查端口 ${port}，请检查监听地址与端口权限。`)));
    probe.listen({ port, host: probeHostname }, () => probe.close(resolve));
  });
  console.log(`端口 ${port} 可用${start ? "，正在启动当前构建。" : "。"}`);
  if (!start) return;

  const next = fileURLToPath(new URL("../node_modules/next/dist/bin/next", import.meta.url));
  const child = spawn(process.execPath, [next, "start", ...nextArgs], { stdio: "inherit" });
  for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
  child.once("error", () => { console.error("生产服务启动失败，请确认依赖已安装并完成构建。"); process.exitCode = 1; });
  child.once("exit", (code, signal) => { process.exitCode = code ?? (signal === "SIGINT" ? 130 : 143); });
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
