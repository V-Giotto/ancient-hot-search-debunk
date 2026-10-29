# 部署与生产预览

本项目需要 **Node.js 服务端**运行 Next.js，`/api/ask` 和 `/api/verdict` 不能只靠纯静态托管。依赖 Node.js `^22.22.2 || ^24.15.0 || >=26.0.0`，建议使用满足该范围的 Node.js 24 环境。

```bash
npm ci
npm run typecheck
npm test
npm run build
# 在托管平台的服务端密钥配置中预先注入 AI_API_KEY，以下命令不含密钥。
CONTENT_MODE=preview npm start
```

默认端口 3000；可用 `PORT=3000` 或 `npm start -- --port 3000` 指定。反向代理到该 Node 服务，应用由进程管理器或支持 Next.js 服务端的平台保持运行。公网地址、域名与托管平台尚待团队决定，本次没有部署或发布操作。

## 服务端环境变量

| 变量 | 默认值 | 用途 |
| --- | --- | --- |
| `AI_API_KEY` | 无 | 必须由服务端密钥管理注入；没有时 AI 返回 503（通过审核门控后） |
| `AI_BASE_URL` | `https://api.deepseek.com` | OpenAI 兼容基础地址，服务端追加 `/chat/completions`；自建兼容服务可填写带 `/v1` 的基础路径 |
| `AI_MODEL` | `deepseek-flash` | 模型 ID，真实联调记录应注明实际模型 |
| `AI_TIMEOUT_MS` | `20000` | 上游请求超时毫秒；无效、非正数或超过 2147483647 时回退默认 |
| `CONTENT_MODE` | `formal` | 仅显式 `preview` 开启待审核资料联调，其余值按 formal 处理 |

只提供变量名和示例占位，不把真实 Key 写进文件、命令历史、日志、报告、Git、截图或提交包。可参考仓库 `.env.example`；不要使用 `NEXT_PUBLIC_` 前缀。环境配置须在构建/启动阶段按平台方式注入；当前运行时读取由 Node 服务负责。更换变量后重启服务并复验。

## preview 与 formal

- `preview`：允许 pending 话题及 pending/reviewed 来源进入 AI 上下文，仍排除 rejected；成功响应带 `preview:true`，页面提示开发预览、资料待审核。用于当前开发联调，不等于内容已经审核。
- `formal`：AI 只接受 reviewed 话题，且只传 reviewed 来源；pending/rejected 话题返回 409。当前八题全部 pending，因此默认 formal 下 AI 均受门控。
- 当前浏览层仍展示带开发预览标记的八题，不因环境设置自动变成正式内容筛选或改变审核状态。公开正式发布前须人工完成内容复核，并落实仅发布 reviewed 的验收条件；不能仅设置 formal 就宣称已正式交付。

## 代理、限流与异常

当前限流为单 Node 进程内存：每 IP 每分钟允许 10 次模型请求，第 11 次返回 429 与 `Retry-After`，进程重启会清空，多实例互不共享。计数以 `x-forwarded-for` 首地址、其次 `x-real-ip`、最后 `unknown` 为准。**限流依赖可信代理 IP**：生产入口必须覆盖外部传入的这些头，并限制源站只能由可信代理访问；否则可伪造地址绕过限流。直连本机未带代理头的请求共享 unknown 桶。多实例须在网关或共享存储实现统一限制，本阶段没有新增该能力。

AI 响应 `no-store`，输入错误 400、未知题目 404、审核未通过 409、未配置 503、超时 504、上游/格式失败 502、限流 429。失败时输入保留并提供手动重试，不影响预制主流程，不自动无限重试。

## 验证与演示

```bash
npm run test:e2e
# 环境已安全注入 Key；启动独立 preview 生产服务，七题真实调用会消耗额度。
node scripts/qa-stage-3-ai.mjs
```

E2E 默认独立启动端口 3123，可用 `E2E_PORT` 修改，或 `E2E_BASE_URL` 连接已有生产服务；使用 `/usr/bin/google-chrome`，也可设置 `CHROME_PATH` 或预装 Playwright Chromium。真实 AI 七问脚本默认端口 3136，可用 `AI_QA_STAGE3_PORT` 修改；强制模型 `deepseek-flash`、preview，并沿用环境兼容基础地址。验收产物在被忽略的 `artifacts/stage-3/`；截图见其 `screenshots/`。完整结果见 [QA 报告](QA_REPORT.md)，现场准备见 [演示脚本](DEMO_SCRIPT.md)。
