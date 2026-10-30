# 古代热搜辟谣局

现代社交媒体反差喜剧 + 可靠历史科普的参赛 Web App（开发中）。

## 当前阶段

v0.15.0（2026-10-30）：新增“好友”第四个 Tab、数据驱动好友列表与李白/杜甫对话页。仅实现可扩展框架，详细人设待用户细化；不改题库与来源内容。采用原创 SVG 头像、左右气泡和仅页面内存的会话；服务端复用 DeepSeek adapter，无 key 显示“好友暂时不在线”。后续联调修复上游忽略 JSON 模式的兼容问题，并增加引用原文校验、一次重试和安全兜底。自动化测试仍 mock 或无 key，真实上游验收另见 [QA_REPORT.md](docs/QA_REPORT.md)。

v0.14.0（2026-10-30）：Giotto 单人审核全部 12 题（6 真 6 假）与全部 28 条来源，全部通过；项目负责人于同日确认。未进行第二人抽查。题目与来源均登记为 `reviewed`，审核时间为 `2026-10-30T02:33:00-07:00`。H05/H08/H10/H11 来源差异按现有页面措辞保留。formal 可进入 AI 流程；单测 mock 上游，E2E 不调用真实 AI。详见 [审核记录](docs/CONTENT_REVIEW.md)。

v0.13.2：每次进入、刷新或历史返回帖子都重新开始判断、揭晓、改写、投票与 AI 问答；揭晓后可点“再玩一次”原地重置并返回判题区。贴纸与已查证进度仍保存在本机，重玩不重复累计或提示获得，兼容旧版收藏但不恢复答案。截图：`/workspace/iter1/v0.13.2-revisit-390x844.png`。

v0.11.0：H09–H12 标题、正文和评论润色，仅改戏仿文案；H01–H12 标题统一标点。逐条自检见 [内容审核记录](docs/CONTENT_REVIEW.md)，当时待人工二审，现已完成上述单人审核。揭晓首屏的“问问 AI”直达追问区，409 显示“本条内容审核中，暂不开放追问”，503 显示“AI 未配置”，均可重试或返回揭晓。`npm start` 启动前检查目标端口；preview 页脚显示 package.json 版本和本次 BUILD_ID。截图：`/workspace/iter1/v0.11.0-H09-390x844.png`、`/workspace/iter1/v0.11.0-ai-390x844.png`，可用 `E2E_REVIEW_DIR=/workspace/iter1 npm run test:e2e` 复现。

v0.10.0：帖子、发现、贴纸与 404 使用 48px 返回顶栏；品牌只在 96px 热榜横幅出现，390×844 首屏完整露出至少五条热榜。五种 format 共用“作者行 → 形式标识条 → 标题 → 形式主体 → 封面 → 统计行”，只切换主体组件，评论统一在文章之后。十二位作者使用数据中显式命名的可读 handle（`^@[a-z_]{3,20}$`），评论展示昵称与时间，不再生成散列账号。H01–H12 封面底部说明条已移除，主标题与插画保留。史实、来源与审核状态不变。截图：`/workspace/iter1/v0.10.0-trending-390x844.png`、`/workspace/iter1/v0.10.0-post-390x844.png`；E2E 可设置 `E2E_REVIEW_DIR=/workspace/iter1` 同步输出这两张截图。

v0.9.0：揭晓滚动留出吸顶头高度加 8px，结果首屏展示居中大印章、绿/红答题结果条和准确说法；为什么、全部史料依据与延伸冷知识默认折叠。首次提交即时显示“获得贴纸”及已查证进度，可直接进入贴纸墙，重温不重复提示获得。面包屑使用有序列表、独立分隔符与当前页标记，保持 44px 链接触控范围。沿用现有视觉风格及题库内容。

v0.8.0：发现页采用双列 CSS columns 瀑布流，封面完整显示、标题最多两行，底部为头像/作者与心形点赞数。全部帖子模板和评论共用圆形头像、派生原创 handle、静态相对时间，以及回复/转发/点赞/浏览四项只读统计；不引入伪交互，沿用项目色板和原创素材。新截图为 `artifacts/stage-6/screenshots/v0.8.0-discover-390x844.png` 与 `v0.8.0-post-390x844.png`。

阶段 6：题库已扩至 12 条（6 真 6 假），H09–H12 引入快讯、朋友圈、群聊与对比投票四种形式。移动端优先，基准 `390×844`，适配 `375×667`、`430×932`；固定底部热搜榜/发现 Tab，公告与守则移入页内折叠，桌面端仅显示居中的 390px 手机列（最大 430px），不设侧栏或额外展示区。保留现有配色、字体、卡片、焦点管理和减少动态效果支持。结果见 [QA 报告](docs/QA_REPORT.md)，产品依据为 [任务书](docs/任务书.md)。

阶段4已补充 H01/H05/H07/H08 的第二来源；本轮新增九条指定来源并补齐逐题人工审核清单。全部 12 条题目和 28 条来源已于 2026-10-30 由 Giotto 审核通过。

文档入口：[人工审核清单](docs/人工审核清单.md) · [三分钟演示与容灾](docs/DEMO_SCRIPT.md) · [交付清单与官方规则待确认表](docs/DELIVERY_CHECKLIST.md) · [AI 使用说明](docs/AI_USAGE.md) · [Node 服务端部署说明](docs/DEPLOYMENT.md) · [QA 报告](docs/QA_REPORT.md)。

基于阶段 A 的 Next.js App Router、TypeScript、Tailwind CSS 与 Zod 数据校验，已接通热搜榜／手机双列发现页 → H01–H12 帖子与各 8 条预制评论 → 真／假提交 → 揭晓与可展开来源 → A/B/C 改写反馈 → 查证卡预览和真实 PNG 下载。首页跳转至 `/trending`，未知帖子显示 404；所有页面共用手机列与底部安全区留白。查证卡预览等比缩放，准确说法另以正常字号呈现，导出仍为 `1200×675`。发现页当前没有筛选控件。

当前为 `data/topics/h01.json` 至 `h12.json`，rank 依次为 1–12；H01/H03/H05/H07/H11/H12 为假，H02/H04/H06/H08/H09/H10 为真，正确改写依次为 A、C、C、B、B、A、C、B、A、C、B、C。来源共 28 条，全部来源和题目均为 `reviewed`，审核人为 Giotto，时间为 `2026-10-30T02:33:00-07:00`；来源列表与导出卡显示实际审核状态，preview 模式保留。审核结果与原有核对要点见 [内容审核记录](docs/CONTENT_REVIEW.md)，原创 SVG 登记见 [素材登记](docs/ASSET_LICENSES.md)。

H01 保留石门分手后是否再见的存疑；H02 区分《东京梦华录》原文与现代解释，限定北宋东京等特定城市，不等同于现代平台或全国普及；H04 区分私交子与官交子，国博来源页题为《会子版》，不能当作交子印版。新增封面均为原创 SVG，头像复用已登记素材。

H05 区分多彩铅釉陶器与严格三色；H06 使用国博《青铜冰鉴》具体词条替换任务书中的入口页，说明借冰降温、仅贵族享用，“冰箱”只作现代比喻；H07 区分宋以前记载与宋代发展，不等同现代足球规则；H08 只证明带孔牙刷柄存在，不推断普遍刷牙，“马尾毛”保留文章归属并说明毛束已消失。所有新增 aiFacts 均带本题来源 ID 前缀。

提交判断并揭晓后，AskPanel 可自由输入或点击三个预设问题，真实调用服务端 AI，展示加载、回答、来源标题外链及失败重试；失败时保留输入，不预录或写死回答。每条 AI 回答提示“AI 生成，可能有误，以史料为准”，preview 回答另标“开发预览”，仅当题目或准许来源含 pending 时提示“开发预览·资料待审核”。对话仅保存在组件内存，不写入 localStorage。

初始客户端 props 由 `toPublicTopic()` 显式白名单生成，不包含答案、来源、改写、事实卡。`POST /api/verdict` 接收 `{ topicId, answer: boolean }`，在服务端判题并返回揭晓内容；非法 body 返回 400，未知 id 返回 404，响应不缓存。版本化 `ahsd:progress:v1` 保留首次完成记录以统计本机收藏，不用于恢复单帖交互；判断、改写与投票选择只在本次页面内生效，重进或刷新不自动请求揭晓。未引入积分系统；存储异常时当前页面可继续体验。

## 本地运行

使用 npm；Node.js 版本须符合 `package.json` 的 `engines.node`：`^22.22.2 || ^24.15.0 || >=26.0.0`，即 Node.js 22.22.2 至 23 之前、24.15.0 至 25 之前，或 26.0.0 及以上。依赖版本固定在 `package.json` 和 `package-lock.json`。

```bash
npm ci
cp .env.example .env.local
npm run dev
```

打开 <http://localhost:3000>。无 Key 时可浏览热搜榜、发现页和帖子，提交真假判断，查看揭晓与来源，完成改写并导出 PNG 查证卡。

要用 DeepSeek Key 开启 AI 追问，在本地编辑 `.env.local`：将自己的 Key 填入 `AI_API_KEY`（模板留空），其余配置如下，然后重启开发服务。`AI_MODEL` 示例沿用代码默认值，请使用自己账号可用的模型 ID。

```dotenv
AI_BASE_URL=https://api.deepseek.com
AI_MODEL=deepseek-flash
AI_TIMEOUT_MS=20000
CONTENT_MODE=formal
```

当前十二条内容及 28 条来源全部 `reviewed`，默认 `CONTENT_MODE=formal` 可通过审核门控；配置有效 Key 后可调用 AI，无 Key 时返回 **503**。pending/rejected 话题在 formal 下仍返回 **409**；`preview` 继续允许 pending 资料用于开发联调，成功响应标记 `preview:true`，审核状态按实际数据提示。在帖子提交判断并揭晓后，可通过 AI 提问面板继续追问。Key 仅供服务端读取，不要打印、添加 `NEXT_PUBLIC_` 前缀或提交到 Git。

本地验证生产构建与启动（同样读取 `.env.local`）：

```bash
npm run build && npm start
```

打开 <http://localhost:3000>；若需要 AI，在 `.env.local` 使用 `CONTENT_MODE=formal` 并配置 Key。

演示前检查：

- 在预定端口执行 `npm run check:port`（默认 3000），先确认无旧服务；占用时查看并停止确认过的旧进程，或更换端口。`npm start` 会自动再检查，检测失败即退出。
- 自定义端口用 `PORT=3999 npm run check:port` / `PORT=3999 npm start`，也可用 `npm run check:port -- --port 3999` / `npm start -- --port 3999`；启动参数优先于 PORT，`--hostname/-H` 同步用于检查和监听。
- 启动 `CONTENT_MODE=preview npm start` 后，检查任意页底部为 `v0.15.0`，构建 ID 与 `cat .next/BUILD_ID` 完全一致，并确认该构建是在本次目标工作区修改完成后生成。BUILD_ID 是构建标识，不是提交哈希。模式在服务运行时读取；formal 页脚不显示版本信息。
- 用独立演示浏览器实测判题、“问问 AI”、来源和 PNG 下载。409 表示内容审核门控；503 表示 AI 未配置，均有重试/返回操作。密钥仅从服务端安全配置读取，不输出或截图配置内容。

## 测试、类型检查与构建

```bash
npm run typecheck
npm test
npm run build
npm start
```

`typecheck` 执行 `tsc --noEmit`，`test` 执行 `vitest run`，`start` 在构建后运行生产服务。Vitest 默认提供 jsdom 环境及 `@/` 路径别名，已安装 Testing Library；数据测试使用 Node 环境。

仓库未配置 `lint` 脚本；当前检查使用上述类型检查、测试与构建。

`tests/content.test.ts` 对真实题库启用 `expectedCount=12` 与 6:6 校验，并检查缺项或比例被破坏时失败；原 todo 已删除。覆盖排名、逐题真假、reviewed、Giotto 审核署名与时间、80–150 字正文、各 8 条四角色评论、指定改写位置与任务书原文、事实卡来源 ID、给定 locator、本地 SVG 与素材登记。内存 fixture 继续覆盖完整性规则正反例，不进入题库。其他测试覆盖 JSON 加载、十二条真实数据的真假判题 API、进度读写及存储异常、组件交互。H03 组件测试仍使用本题来源，避免新增来源改变全局数组位置后混入其它题目。AI 单元与组件测试全部 mock fetch，不调用外网，覆盖 400/404/409/503/504/502/429、引用过滤、注入消息隔离、敏感数据不进入日志或响应、AskPanel 加载/重试/预设问题。

构建后可运行真实浏览器验收：

```bash
npm run build
CHROME_PATH=/usr/bin/google-chrome npm run test:e2e
```

启动前先结束测试端口的旧 Next 服务；脚本检测到端口占用会退出，并校验服务提供的 BUILD_ID 静态产物与本次本地构建一致。v0.10.0 在三个手机视口检查紧凑顶栏与六段帖子骨架，在 390×844 断言 96px 横幅、第 5 条榜单完整露出且不被底部导航遮挡，并核对可读 handle。继续覆盖 v0.9.0 的结果标题无遮挡、揭晓层级/默认折叠/全部来源、贴纸即时反馈与重温去重；原面包屑检查由顶栏检查替代。H03 首次提交后首屏截图为 `artifacts/stage-6/screenshots/v0.9.0-reveal-390x844.png`。

脚本自动启动生产服务（默认端口 3123），使用 Playwright 与系统 Chrome；`CHROME_PATH` 可指定其他浏览器，`E2E_PORT` 可改端口，`E2E_BASE_URL` 可接已有服务。三个手机视口均检查热榜、双列发现、全部十二题、两种 404，以及判题/揭晓/展开来源/改写/AI/弹窗状态：`scrollWidth <= clientWidth`、触控范围宽高 ≥44px（radio 按关联 label）、底部导航无遮挡。390×844 完成十二题真实判题、来源、改写、PNG 下载及离开重进/刷新后重新作答，另验答错可揭晓、原地再玩一次及收集去重；H03 在三尺寸下载均为 1200×675。保留首次 HTML 无答案、PNG 非空与无裁切、焦点循环/返回、减少动态效果，并检查一次 1440×900 居中 390px 列。AI 加载、409/503、重试和超长回答用浏览器 mock 检查布局；另启动同一构建的 formal 与无密钥 preview 服务，真实验证 reviewed 资料通过审核门控后均返回无配置 503、preview 页脚版本及 BUILD_ID，不调用模型。结果与下载在忽略的 `artifacts/stage-6/`，`screenshots/` 包含手机及桌面状态截图（包括 H09–H12 顶部、H11 揭晓及 v0.8.0 发现页/帖子）。

## 数据约定

- `lib/schemas.ts` 定义任务书 7.3 的 `Source`、`Comment`、`RewriteOption`、`HotTopic`、`TopicProgress`、`ReviewStatus` 类型及 Zod schema。
- 每个 `data/topics/*.json` 存放一个 `HotTopic` 对象；`data/source-index.json` 存放 `Source[]`。`.gitkeep` 不参与加载。
- `getAllTopics()` 校验并按 rank 升序返回，`getTopicById(id)` 对未知 ID 返回 `undefined`，页面调用 `notFound()`；`getSourcesForTopic(topic)` 按 `sourceIds` 顺序返回来源。
- `validateContentSet(topics, sources, { expectedCount })` 校验失败时抛错。默认按当前题目数量检查从 1 开始的连续排名；显式传入 `expectedCount: 12` 时额外要求总数为 12 且真假 6:6（8/16 条阶段也检查均衡）。
- 当前加载器按已有题目数量校验，允许空题库与 `pending` 的开发预览。当前 12 题与 28 条来源的人工审核已完成；本次无第二人抽查。后续新增未审内容仍需人工审核，正式发布遵循仅发布 `reviewed` 题目的要求；结构校验不能代替内容审核。
- `simulatedViews` 为独立的预制浏览数；帖子统计行展示回复/转发/点赞/浏览，`simulatedBookmarks` 继续保留在数据中。评论可含 `simulatedReplies`、`simulatedReposts`、`simulatedViews`，旧数据缺省时展示 0。全部统计只读，UI 不附加虚构/模拟标签。
- `public/covers/`、`public/avatars/` 存放 H01–H12 原创封面与复用的原创头像；`public/decorations/` 继续预留。使用系统中文无衬线字体，不提交字体文件。

## 好友对话（v0.15.0）

`/friends` 展示好友列表，`/friends/libai` 与 `/friends/dufu` 为初始对话页；四个底部标签在 375px 宽下均保持 ≥44px 触控范围。无需登录，会话仅存组件内存，刷新清空；发送失败保留草稿，可手动重试，无自动模型请求。对话页只保留一行角色扮演轻说明。

新增好友只需添加 `data/friends/<id>.json`（文件名与 id 一致）；加载器自动发现并通过 `lib/friend-schema.ts` 的 Zod Schema 和来源完整性校验，无需改路由或列表：

```json
{
  "id": "new-friend",
  "name": "好友名称",
  "avatar": { "motif": "moon", "paper": "#EAEDE5", "ink": "#415C53", "accent": "#C8955E" },
  "bio": "简短介绍，避免新增无来源史实。",
  "greeting": "开场白。",
  "sourceIds": ["S-H01-01", "S-H01-02"],
  "persona": ["表达风格要点；不能用作历史事实。"]
}
```

头像使用本项目新绘的 SVG 山月（`moon`）或汀草（`reeds`）纹样，可在数据中搭配三种六位十六进制颜色；不加载外部图片、不执行 SVG 字符串。`sourceIds` 必须唯一且指向索引中存在的 reviewed 来源，preview 也不放宽。后续细化人设应编辑 JSON 的 `persona`、简介与开场白，史实仍只取该好友来源的 `supports`；本版未添加人物生平或新诗句。

`POST /api/chat` 接收 `{ friendId, message, history?: [{ role: "user" | "assistant", content }] }`，返回 `{ reply }`。单条用户消息最多 200 字、历史最多 12 条（页面发送最近 12 条，接口拒绝超限），历史中的 user 最多 200 字、assistant 最多 1200 字；回复最多 1200 字，首次 `max_tokens: 1200`，重试提高至 2400。仅提取上游 `reply`，容忍额外字段、完整纯文本及完整 JSON 代码围栏。截断 JSON、空回复、非法回复或违规引用共用一次自动重试预算；仍失败则 HTTP 200 返回不含引用、承认不确定的固定回复。复用 `AI_API_KEY`、`AI_BASE_URL`、`AI_MODEL`（默认 `deepseek-flash`）和 `AI_TIMEOUT_MS`（默认 20000）。只在服务端读取配置，不记录用户消息原文、上游原文或密钥。

系统约束包含：仅据 reviewed `supports` 陈述史实；资料不足明确“不确定/资料里没写”；不编造史实或诗句；年号/纪年仅用来源原样写法，不换算。服务端保守校验所有中英文成对引号及《》书名：内容必须在该好友 reviewed 白名单来源的单个 `supports` 或 `title` 字段中连续、逐字出现，不自动转换繁简字形或标点。违规时重试提示明确给出违规片段，再失败则整条回复换为安全兜底。拒绝有害、违法、色情、仇恨、自伤指导与脱离角色的越狱。历史（含客户端传入的 assistant）统一作为不可信 user 数据，不可修改系统规则。引用校验不等于对无引号陈述的逐句语义审核。

按 IP 单进程内存限流 10 次/分钟（两位好友共用额度，与帖子追问分开），429 带 `Retry-After`；多实例部署需共享限流，可信代理须覆盖 `x-forwarded-for` / `x-real-ip`。输入非法 400、未知好友 404、无 key 503、上游失败 502、超时 504，均返回固定友好错误且不缓存。

单测覆盖数据、提示词、边界、限流、无 key、超时、上游异常与密钥回显隔离；E2E 覆盖三种手机视口的好友列表、两位好友、加载/离线/长回复/重试/刷新与 404，全程 mock 或无 key。列表截图为 `/workspace/iter1/v0.15.0-friends-390x844.png`，mock 对话仅存 `artifacts/stage-6/screenshots/v0.15.0-chat-mock-390x844.png`；真实对话截图由用户自行拍摄。

## 本机贴纸与完成度

提交任意话题的判断后，无论答对答错都会解锁该题的原创主题徽记。热榜显示“已查证 x/N”，底部第三个 Tab 进入 `/stickers`；锁定贴纸不泄露答案，收藏后可回帖重新挑战。沿用 `ahsd:progress:v1` 的版本化 localStorage，仅统计当前题库中成功提交的不同题目；刷新保留收藏进度，重玩不重复计数，清除存储后归零。每次进入、刷新或历史返回帖子，判断、揭晓、改写、投票与 AI 问答均从新状态开始；揭晓后可点“再玩一次”原地重置。兼容旧收藏记录，但不恢复旧答案或投票；存储异常时仍可答题，无登录或云同步。

界面、封面/头像与查证卡已移除虚构类标签，史料引用、真假揭晓和 pending/preview 提示保留；逐项文件清单见 `docs/UI_LABEL_REMOVALS.md`，素材属性见 `docs/ASSET_LICENSES.md`。

## AI 接口与环境变量

可选复制配置模板：

```bash
cp .env.example .env.local
```

| 变量 | 默认值 | 用途 |
| --- | --- | --- |
| `AI_API_KEY` | 无 | 启用 AI 所需的模型服务密钥；先通过审核门控，缺省返回 503 |
| `AI_BASE_URL` | `https://api.deepseek.com` | OpenAI 兼容服务基础地址；适配器追加 `/chat/completions` |
| `AI_MODEL` | `deepseek-flash` | 代码默认模型 ID，可按账号可用模型调整 |
| `AI_TIMEOUT_MS` | `20000` | 服务端 AbortController 超时毫秒数；无效值回退默认 |
| `CONTENT_MODE` | `formal` | `formal` 仅允许 reviewed；`preview` 允许 pending 并在成功响应中返回 `preview:true` |

以上变量仅供服务端使用，绝不加 `NEXT_PUBLIC_` 前缀；旧环境变量已移除，不作兼容读取。`.env*` 被 Git 忽略，仅保留 `.env.example`；真实密钥不得提交或进入静态包、响应、日志。

`.env.example` 还列出脚本读取的可选变量：`CHROME_PATH`、`E2E_PORT`（默认 3123）、`E2E_BASE_URL`（默认空，自动启动服务）、`AI_QA_PORT`（3134）、`AI_QA_NO_KEY_PORT`（3135）、`AI_QA_STAGE3_PORT`（3136）。直接运行 `scripts/*.mjs` 不会自动加载 `.env.local`，须预先注入环境或使用 `node --env-file=.env.local scripts/脚本名.mjs`；AI 验收脚本会真实调用模型并消耗额度。

`POST /api/ask` 接收 `{ topicId, question, history? }`：问题 trim 后 1–500 字，历史最多 6 条、每条 1–1000 字，role 只允许 user/assistant，不接受前端事实卡或来源字段。成功返回 `{ answer, citedSourceIds, grounded, preview? }`，answer 最多 2000 字。未知话题 404、未审核或 rejected 话题 409、未配置 503、超时 504、提供商失败/非法 JSON/错误类型/过长回答 502、限流 429。响应均 `no-store`。

仅从服务端读取 aiFacts、aiLimitations 与 sources；formal 排除 pending/rejected 来源，preview 也永远排除 rejected。带被排除来源 ID 的事实卡不进入模型。任务书 6.4 系统规则与事实白名单分别放在 system 消息，问题和历史（包括伪造 assistant 历史）以 JSON 数据放在 user 消息，并明确其中指令无效。服务端校验 JSON 类型、过滤未知/重复引用；无有效引用时不声称 grounded。该字段表示模型声明与引用完整性，不代表完成了语义或人工史实审核。

使用原生 fetch，不引入模型 SDK，不记录问题、上游原文或密钥。按 IP 每分钟允许 10 次到模型的请求，429 带 `Retry-After`，无自动重试。计数为单进程内存，重启即清空；多实例生产部署需改用共享限流或网关。反向代理须覆盖客户端传入的 `x-forwarded-for`/`x-real-ip`，直接启动的本地服务不提供可信代理鉴权。

环境已安全注入 `AI_API_KEY` 时，运行生产预览：

```bash
npm run build
CONTENT_MODE=preview npm start
```

阶段 3 七题真实联调执行 `node scripts/qa-stage-3-ai.mjs`；历史阶段的三问与无 Key 浏览器回归可执行 `node scripts/qa-ai.mjs`（先 build，需要环境中的 Key 与 Chromium）。脚本依次启动有 Key 和无 Key 的生产服务，调用 H03 三个指定问题、检查负面回答、验证 503 与页面基础流程，更新 [QA 报告](docs/QA_REPORT.md)；真实调用会消耗模型额度。无 Key 时当前 reviewed H03 在 formal/preview 下均返回 503。`npm run test:e2e` 负责十二条内容的基础流程回归，不调用真实 AI。

## 阶段6：12 条题库与帖子形式

H09 望火楼、H10 胶泥活字为真题，H11 以德报怨、H12 兵书辨名为假题，总计 6:6。可选 `format` 支持 post/news/moments/chat/poll，旧题缺省使用 post；模板位于 `components/post/formats/`。H12 投票选择只保存在本次页面状态，忽略旧版 `ahsd:poll:v1:H12` 记录；每次进入、刷新或再玩一次均可重投。投票后显示预设“少数倾向/多数倾向”文字条，不写入判题进度、不解锁贴纸。所有内容与来源 reviewed，字形差异、异读及历史来源访问记录见审核文档。

`CHROME_PATH=/usr/bin/google-chrome npm run test:e2e` 覆盖全部 12 条判题/揭晓/改写/导出与多视口检查，结果在 `artifacts/stage-6/result.json`；`artifacts/stage-6/screenshots/` 保存 H09–H12 各一张 390×844 帖子顶部及 H11 揭晓截图。
