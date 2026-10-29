# 古代热搜辟谣局

现代社交媒体反差喜剧 + 可靠历史科普的参赛 Web App（开发中）。

## 当前阶段

阶段2第1部分：在已提交的阶段 A/B/C 基础上新增 H01、H02、H04 三条数据，完全复用 H03 的组件、判题、揭晓、改写、AI 追问和 PNG 导出流程。产品依据为 [任务书](docs/任务书.md)，本阶段未新增功能或修改产品组件。

基于阶段 A 的 Next.js App Router、TypeScript、Tailwind CSS 与 Zod 数据校验，已接通热搜榜／双列发现页 → H01–H04 帖子与各 8 条预制评论 → 真／假提交 → 揭晓与可展开来源 → A/B/C 改写反馈 → 查证卡预览和真实 PNG 下载。首页跳转至 `/trending`，未知帖子显示 404；桌面布局优先适配 1440×900，1440px 以下隐藏右栏。

当前为 `data/topics/h01.json` 至 `h04.json`，rank 依次为 1–4；H03 仅调整排名。真假依次为假、真、假、真，正确改写依次为 A、C、C、B。来源限定为技术负责人提供的记录，共 10 条，本次新增 7 条。题目和全部来源保持 `pending`，未填写审核签名，页面与导出卡都显示“开发预览：本条史实尚待人工审核”。人工待核对项见 [内容审核记录](docs/CONTENT_REVIEW.md)，原创 SVG 登记见 [素材登记](docs/ASSET_LICENSES.md)。H05–H08 和完整真实题库 4:4 验收留待后续阶段。

H01 保留石门分手后是否再见的存疑；H02 区分《东京梦华录》原文与现代解释，限定北宋东京等特定城市，不等同于现代平台或全国普及；H04 区分私交子与官交子，国博来源页题为《会子版》，不能当作交子印版。新增封面均为原创 SVG，头像复用已登记素材。

提交判断并揭晓后，AskPanel 可自由输入或点击三个预设问题，真实调用服务端 AI，展示加载、回答、来源标题外链及失败重试；失败时保留输入，不预录或写死回答。每条 AI 回答提示“AI 生成，可能有误，以史料为准”，preview 回答另标“开发预览·资料待审核”。对话仅保存在组件内存，不写入 localStorage。

初始客户端 props 由 `toPublicTopic()` 显式白名单生成，不包含答案、来源、改写、事实卡。`POST /api/verdict` 接收 `{ topicId, answer: boolean }`，在服务端判题并返回揭晓内容；非法 body 返回 400，未知 id 返回 404，响应不缓存。进度使用版本化 `ahsd:progress:v1` 保存答案、提交时间和改写选择；刷新后用已存答案重新调用判题接口，显示“重温本条”，不重复计分。未引入积分系统；存储异常时当前页面可继续体验。

## 本地启动

使用 npm，建议 Node.js 24 LTS（至少 24.15.0；也支持 22.22.2+ 的 Node.js 22）。依赖版本固定在 `package.json` 和 `package-lock.json`。

```bash
npm ci
npm run dev
```

打开 <http://localhost:3000>。无需 API Key 即可浏览、判题、查看史实、改写和导出；AI 接口通过审核门控后，缺少 Key 返回 503。默认 `formal` 下，当前 pending 的 H03 优先返回 409；本地真实 AI 联调需显式设置 `CONTENT_MODE=preview`。

## 测试、类型检查与构建

```bash
npm run typecheck
npm test
npm run build
npm start
```

`typecheck` 执行 `tsc --noEmit`，`test` 执行 `vitest run`，`start` 在构建后运行生产服务。Vitest 默认提供 jsdom 环境及 `@/` 路径别名，已安装 Testing Library；数据测试使用 Node 环境。

`tests/content.test.ts` 按 4 条真实题目校验，检查排名、真假、pending、审核签名缺省、80–150 字正文、各 8 条四角色评论、指定改写位置与任务书原文、事实卡来源 ID、给定 locator、本地 SVG 与素材登记；完整八题与 4:4 的真实题库验收仍为 todo。内存 fixture 继续覆盖完整性规则正反例，不进入题库。其他测试覆盖 JSON 加载、四条真实数据的真假判题 API、进度读写及存储异常、组件交互。H03 组件测试仍使用本题来源，避免新增来源改变全局数组位置后混入其它题目。AI 单元与组件测试全部 mock fetch，不调用外网，覆盖 400/404/409/503/504/502/429、引用过滤、注入消息隔离、敏感数据不进入日志或响应、AskPanel 加载/重试/预设问题。

构建后可运行真实浏览器验收：

```bash
npm run build
npm run test:e2e
```

脚本自动启动本地生产服务（默认端口 3123），使用 Playwright 和系统 `/usr/bin/google-chrome`。其他环境可先 `npx playwright install chromium`，或用 `CHROME_PATH` 指定浏览器；`E2E_PORT` 可改端口，`E2E_BASE_URL` 可使用已启动的服务。脚本逐条实际完成榜单 → H01/H02/H03/H04 → 选假／真／假／真 → 提交 → 查来源 → 错误及正确改写 → 下载 PNG → 分题刷新恢复，并检查首次 HTML 无答案、来源链接归属、卡片文案无裁切、1200×675 PNG 签名／尺寸／非空像素、404、减少动态效果与三个桌面宽度无溢出。下载和截图保存在忽略的 `artifacts/stage-2-part-1/`，验收结果为 `result.json`。

## 数据约定

- `lib/schemas.ts` 定义任务书 7.3 的 `Source`、`Comment`、`RewriteOption`、`HotTopic`、`TopicProgress`、`ReviewStatus` 类型及 Zod schema。
- 每个 `data/topics/*.json` 存放一个 `HotTopic` 对象；`data/source-index.json` 存放 `Source[]`。`.gitkeep` 不参与加载。
- `getAllTopics()` 校验并按 rank 升序返回，`getTopicById(id)` 对未知 ID 返回 `undefined`，页面调用 `notFound()`；`getSourcesForTopic(topic)` 按 `sourceIds` 顺序返回来源。
- `validateContentSet(topics, sources, { expectedCount })` 校验失败时抛错。默认按当前题目数量检查从 1 开始的连续排名；显式传入 `expectedCount: 8` 时额外要求总数为 8 且真假 4:4。
- 当前加载器按已有题目数量校验，允许空题库与 `pending` 的开发预览。正式发布前仍须完成任务书中的人工审核与仅发布 `reviewed` 题目的要求；结构校验不代表史实已审核或引用语义已匹配。
- `simulatedReposts`、`simulatedBookmarks` 补齐转发和收藏统计，与点赞、评论一样只作模拟值展示。
- `public/covers/`、`public/avatars/` 存放 H01–H04 原创封面与复用的原创头像；`public/decorations/` 继续预留。使用系统中文无衬线字体，不提交字体文件。

## AI 接口与环境变量

可选复制配置模板：

```bash
cp .env.example .env.local
```

| 变量 | 默认值 | 用途 |
| --- | --- | --- |
| `AI_API_KEY` | 无（必需） | 模型服务密钥，缺省返回 503 |
| `AI_BASE_URL` | `https://api.deepseek.com` | OpenAI 兼容服务基础地址；适配器追加 `/chat/completions` |
| `AI_MODEL` | `deepseek-flash` | DeepSeek-V4.1-Flash 模型 ID |
| `AI_TIMEOUT_MS` | `20000` | 服务端 AbortController 超时毫秒数；无效值回退默认 |
| `CONTENT_MODE` | `formal` | `formal` 仅允许 reviewed；`preview` 允许 pending 并在成功响应中返回 `preview:true` |

以上变量仅供服务端使用，绝不加 `NEXT_PUBLIC_` 前缀；旧环境变量已移除，不作兼容读取。`.env*` 被 Git 忽略，仅保留 `.env.example`；真实密钥不得提交或进入静态包、响应、日志。

`POST /api/ask` 接收 `{ topicId, question, history? }`：问题 trim 后 1–500 字，历史最多 6 条、每条 1–1000 字，role 只允许 user/assistant，不接受前端事实卡或来源字段。成功返回 `{ answer, citedSourceIds, grounded, preview? }`，answer 最多 2000 字。未知话题 404、未审核或 rejected 话题 409、未配置 503、超时 504、提供商失败/非法 JSON/错误类型/过长回答 502、限流 429。响应均 `no-store`。

仅从服务端读取 aiFacts、aiLimitations 与 sources；formal 排除 pending/rejected 来源，preview 也永远排除 rejected。带被排除来源 ID 的事实卡不进入模型。任务书 6.4 系统规则与事实白名单分别放在 system 消息，问题和历史（包括伪造 assistant 历史）以 JSON 数据放在 user 消息，并明确其中指令无效。服务端校验 JSON 类型、过滤未知/重复引用；无有效引用时不声称 grounded。该字段表示模型声明与引用完整性，不代表完成了语义或人工史实审核。

使用原生 fetch，不引入模型 SDK，不记录问题、上游原文或密钥。按 IP 每分钟允许 10 次到模型的请求，429 带 `Retry-After`，无自动重试。计数为单进程内存，重启即清空；多实例生产部署需改用共享限流或网关。反向代理须覆盖客户端传入的 `x-forwarded-for`/`x-real-ip`，直接启动的本地服务不提供可信代理鉴权。

环境已安全注入 `AI_API_KEY` 时，运行生产预览：

```bash
npm run build
CONTENT_MODE=preview npm start
```

真实联调与无 Key 浏览器回归可执行 `node scripts/qa-ai.mjs`（先 build，需要环境中的 Key 与 Chromium）。脚本依次启动有 Key 和无 Key 的生产服务，调用 H03 三个指定问题、检查负面回答、验证 503 与页面基础流程，更新 [QA 报告](docs/QA_REPORT.md)；真实调用会消耗模型额度。无 Key 检查同样使用 preview，以避免 H03 的 409 审核门控先行返回。`npm run test:e2e` 负责四条内容的基础流程回归，本次未重复调用真实 AI。
