# 古代热搜辟谣局

现代社交媒体反差喜剧 + 可靠历史科普的参赛 Web App（开发中）。

## 当前阶段

阶段 A：工程脚手架 + 数据 Schema + 校验器。产品依据为 [任务书](docs/任务书.md)。

已提供 Next.js App Router、TypeScript、Tailwind CSS、统一桌面壳层、热搜榜/发现页骨架、帖子占位路由与 404，以及基于 Zod 的类型、JSON 加载与完整性校验。首页跳转至 `/trending`；热搜榜与发现页共用数据，无数据时显示友好空状态。桌面布局优先适配 1440×900，1440px 以下隐藏右栏。

`data/topics/` 当前为空，`data/source-index.json` 为 `[]`，尚无正式题目、史料或图片。页面明确标注“开发预览模式”，不会将待审核内容称为已核验。H03 内容、评论交互、真假判断与揭晓、改写、AI 问答、进度存储及 PNG 导出均尚未实现，留待后续阶段。八条真实内容及真假 4:4 的验收在测试中明确标为待办。

## 本地启动

使用 npm，建议 Node.js 24 LTS（至少 24.15.0；也支持 22.22.2+ 的 Node.js 22）。依赖版本固定在 `package.json` 和 `package-lock.json`。

```bash
npm ci
npm run dev
```

打开 <http://localhost:3000>。无需 API Key 即可运行阶段 A。

## 测试、类型检查与构建

```bash
npm run typecheck
npm test
npm run build
npm start
```

`typecheck` 执行 `tsc --noEmit`，`test` 执行 `vitest run`，`start` 在构建后运行生产服务。Vitest 默认提供 jsdom 环境及 `@/` 路径别名，已安装 Testing Library；数据测试使用 Node 环境。

`tests/content.test.ts` 用内存合成 fixture 覆盖完整性规则的正反例，并按当前真实题目数量验证仓库数据；fixture 不写入正式题库。`tests/topics.test.ts` 验证 JSON 加载、排序、查询、来源关联与错误处理。

## 数据约定

- `lib/schemas.ts` 定义任务书 7.3 的 `Source`、`Comment`、`RewriteOption`、`HotTopic`、`TopicProgress`、`ReviewStatus` 类型及 Zod schema。
- 每个 `data/topics/*.json` 存放一个 `HotTopic` 对象；`data/source-index.json` 存放 `Source[]`。`.gitkeep` 不参与加载。
- `getAllTopics()` 校验并按 rank 升序返回，`getTopicById(id)` 对未知 ID 返回 `undefined`，页面调用 `notFound()`；`getSourcesForTopic(topic)` 按 `sourceIds` 顺序返回来源。
- `validateContentSet(topics, sources, { expectedCount })` 校验失败时抛错。默认按当前题目数量检查从 1 开始的连续排名；显式传入 `expectedCount: 8` 时额外要求总数为 8 且真假 4:4。
- 当前加载器按已有题目数量校验，允许空题库与 `pending` 的开发预览。正式发布前仍须完成任务书中的人工审核与仅发布 `reviewed` 题目的要求；结构校验不代表史实已审核或引用语义已匹配。
- `public/covers/`、`public/avatars/`、`public/decorations/` 预留素材位置。使用系统中文无衬线字体，不提交字体文件。

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

以上变量仅供服务端使用，绝不加 `NEXT_PUBLIC_` 前缀。阶段 A 仅提供模板，尚未读取这些变量或调用模型。`.env*` 被 Git 忽略，仅保留 `.env.example`；真实密钥不得提交。
