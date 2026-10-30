// @vitest-environment node
import { createServer, type Server } from "node:net";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";

const exec = promisify(execFile);
const servers: Server[] = [];
async function reservePort() {
  const server = createServer();
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return { server, port: String((server.address() as { port: number }).port) };
}
function check(args: string[], port?: string) {
  return exec(process.execPath, ["scripts/check-port.mjs", ...args], { env: { ...process.env, PORT: port ?? "invalid" } });
}
afterEach(async () => {
  await Promise.all(servers.splice(0).filter((server) => server.listening).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
});

describe("启动前端口检查", () => {
  it.each([{ args: [] }, { args: ["--start"] }])("PORT 指向已占用端口时退出，不启动服务：$args", async ({ args }) => {
    const { port } = await reservePort();
    await expect(check(args, port)).rejects.toMatchObject({ code: 1, stdout: "", stderr: expect.stringContaining(`端口 ${port} 已被占用`) });
  });
  it.each(["--port", "-p", "--port="])("识别 CLI %s 并优先于 PORT", async (flag) => {
    const { port } = await reservePort();
    const args = flag.endsWith("=") ? [`${flag}${port}`] : [flag, port];
    await expect(check(args)).rejects.toMatchObject({ code: 1, stderr: expect.stringContaining(`端口 ${port} 已被占用`) });
  });
  it("空闲端口通过且不启动生产服务", async () => {
    const { server, port } = await reservePort();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    const result = await check([], port);
    expect(result.stdout).toContain(`端口 ${port} 可用`);
    expect(result.stderr).toBe("");
  });
  it.each(["0", "65536", "abc", "3000.1", ""])("无效端口 %j 提供明确提示", async (port) => {
    await expect(check([], port)).rejects.toMatchObject({ code: 1, stderr: expect.stringContaining("端口须为 1–65535 的整数") });
  });
});
