# 古代热搜辟谣局

现代社交媒体反差喜剧 + 可靠历史科普的参赛 Web App（开发中）。

## 当前阶段

阶段 B：H03 唐代辣椒单条完整交互闭环。产品依据为 [任务书](docs/任务书.md)。

基于阶段 A 的 Next.js App Router、TypeScript、Tailwind CSS 与 Zod 数据校验，已接通热搜榜／双列发现页 → H03 帖子与 8 条预制评论 → 真／假提交 → 揭晓与可展开来源 → A/B/C 改写反馈 → 查证卡预览和真实 PNG 下载。首页跳转至 `/trending`，未知帖子显示 404；桌面布局优先适配 1440×900，1440px 以下隐藏右栏。

当前只有 `data/topics/h03.json`，rank 暂为 1；来源限定为技术负责人提供的三条记录。题目和全部来源保持 `pending`，页面与导出卡都显示“开发预览：本条史实尚待人工审核”。人工待核对项见 [内容审核记录](docs/CONTENT_REVIEW.md)，原创 SVG 登记见 [素材登记](docs/ASSET_LICENSES.md)。其余七条和真实题库 4:4 验收留待后续阶段；AI 追问区与接口在阶段 C 实现，本阶段不渲染占位功能。

初始客户端 props 由 `toPublicTopic()` 显式白名单生成，不包含答案、来源、改写、事实卡。`POST /api/verdict` 接收 `{ topicId, answer: boolean }`，在服务端判题并返回揭晓内容；非法 body 返回 400，未知 id 返回 404，响应不缓存。进度使用版本化 `ahsd:progress:v1` 保存答案、提交时间和改写选择；刷新后用已存答案重新调用判题接口，显示“重温本条”，不重复计分。未引入积分系统；存储异常时当前页面可继续体验。

## 本地启动

使用 npm，建议 Node.js 24 LTS（至少 24.15.0；也支持 22.22.2+ 的 Node.js 22）。依赖版本固定在 `package.json` 和 `package-lock.json`。

```bash
npm ci
npm run dev
```

打开 <http://localhost:3000>。无需 API Key 即可运行阶段 B。

## 测试、类型检查与构建

```bash
npm run typecheck
npm test
npm run build
npm start
```

`typecheck` 执行 `tsc --noEmit`，`test` 执行 `vitest run`，`start` 在构建后运行生产服务。Vitest 默认提供 jsdom 环境及 `@/` 路径别名，已安装 Testing Library；数据测试使用 Node 环境。

`tests/content.test.ts` 对真实 H03 和来源运行校验，并检查 pending、审核签名缺省、8 条评论四种角色、C 为正确改写、事实卡来源 ID、本地 SVG 与素材登记；内存 fixture 继续覆盖完整性规则正反例，不进入题库。其他测试覆盖 JSON 加载、判题、进度读写及存储异常、组件交互和真实数据的 API 路由行为。合成真题只用于验证“查证属实”分支，不新增正式话题。

构建后可运行真实浏览器验收：

```bash
npm run build
npm run test:e2e
```

脚本自动启动本地生产服务（默认端口 3123），使用 Playwright 和系统 `/usr/bin/google-chrome`。其他环境可先 `npx playwright install chromium`，或用 `CHROME_PATH` 指定浏览器；`E2E_PORT` 可改端口，`E2E_BASE_URL` 可使用已启动的服务。脚本实际完成榜单 → H03 → 选假 → 提交 → 查来源 → 改写 → 下载 PNG → 刷新恢复，并检查首次 HTML 无答案、1200×675 PNG 签名／尺寸／非空像素、404、减少动态效果与三个桌面宽度无溢出。下载和截图保存在忽略的 `artifacts/stage-b/`，验收结果为 `result.json`。

## 数据约定

- `lib/schemas.ts` 定义任务书 7.3 的 `Source`、`Comment`、`RewriteOption`、`HotTopic`、`TopicProgress`、`ReviewStatus` 类型及 Zod schema。
- 每个 `data/topics/*.json` 存放一个 `HotTopic` 对象；`data/source-index.json` 存放 `Source[]`。`.gitkeep` 不参与加载。
- `getAllTopics()` 校验并按 rank 升序返回，`getTopicById(id)` 对未知 ID 返回 `undefined`，页面调用 `notFound()`；`getSourcesForTopic(topic)` 按 `sourceIds` 顺序返回来源。
- `validateContentSet(topics, sources, { expectedCount })` 校验失败时抛错。默认按当前题目数量检查从 1 开始的连续排名；显式传入 `expectedCount: 8` 时额外要求总数为 8 且真假 4:4。
- 当前加载器按已有题目数量校验，允许空题库与 `pending` 的开发预览。正式发布前仍须完成任务书中的人工审核与仅发布 `reviewed` 题目的要求；结构校验不代表史实已审核或引用语义已匹配。
- `simulatedReposts`、`simulatedBookmarks` 补齐转发和收藏统计，与点赞、评论一样只作模拟值展示。
- `public/covers/`、`public/avatars/` 存放 H03 原创 SVG；`public/decorations/` 继续预留。使用系统中文无衬线字体，不提交字体文件。

## 环境变量

可选复制配置模板：

```bash
cp .env.example .env.local
```

| 变量 | 模板值 | 用途（后续阶段） |
| --- | --- | --- |
| `LLM_API_KEY` | 留空 | 模型服务密钥 |
| `LLM_BASE_URL` | `https://api.openai.com/v1` | 兼容模型服务地址 |
| `LLM_MODEL` | 留空 | 部署时指定的模型名称 |
| `LLM_TIMEOUT_MS` | `20000` | 服务端超时毫秒数 |

以上变量仅供服务端使用，绝不加 `NEXT_PUBLIC_` 前缀。阶段 B 继续仅保留模板，尚未读取这些变量或调用模型。`.env*` 被 Git 忽略，仅保留 `.env.example`；真实密钥不得提交。
