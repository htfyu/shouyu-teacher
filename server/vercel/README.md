# 匠备 V2 · Vercel AI Proxy（备选）

这是 Cloudflare Worker 的 Vercel Node Serverless 兼容实现。安全策略、环境变量、限制和错误格式与 [`../README.md`](../README.md) 保持一致。

推荐正式代理优先使用 Cloudflare Worker；Vercel 适合已有 Vercel 项目或团队统一在 Vercel 管理时使用。

## 文件与路由

```text
server/vercel/
├─ api/
│  ├─ chat.js      POST /api/chat
│  └─ health.js    GET  /api/health
└─ README.md
```

`chat.js` 使用 CommonJS Node Serverless 导出形式，兼容 Vercel Node 20+。它依赖：

- 全局 `fetch`、`ReadableStream`、`AbortController`；
- Node 内置 `crypto` 做恒定时间口令比较。

## 部署

1. 在 Vercel 导入本仓库；
2. **Root Directory** 选择 `server/vercel`（不是仓库根目录）；
3. Framework Preset 选 **Other**，不需要构建命令；
4. 在 Project Settings → Environment Variables 配置：

| 变量 | 必需 | 默认值 | 说明 |
|---|---|---|---|
| `AI_API_KEY` | 是 | 无 | 上游模型 Key；只放环境变量，不要提交到 `.env`。 |
| `AI_BASE_URL` | 否 | `https://api.deepseek.com` | 不带 `/chat/completions` 的基础地址。 |
| `AI_MODEL` | 否 | `deepseek-chat` | 服务端固定模型；请求中的 `model` 被忽略。 |
| `ALLOWED_ORIGINS` | 生产必须 | 空 | 逗号分隔的精确来源，如 `https://htfyu.github.io`。 |
| `ACCESS_TOKEN` | 否 | 空 | 可选前端访问口令；不是模型 Key。 |
| `AI_TIMEOUT_MS` | 否 | `60000` | 上游请求总超时，5000–120000 ms。 |

生产环境在 Environment Variables 里选 **Production**，本地开发可以基于 `.env.example` 创建 `.env.local`（已被 `server/.gitignore` 排除）：

```bash
cd server/vercel
cp .env.example .env.local
# 填入真实值；Windows PowerShell 可用 Copy-Item .env.example .env.local
npx vercel dev
```

如果没有 `vercel` CLI：

```bash
npm i -g vercel
# 或 npx vercel
```

部署后：

```text
https://<project>.vercel.app/api/chat
https://<project>.vercel.app/api/health
```

把 `chat` 地址交给前端 `js/ai.js`。健康检查不会返回 Key；同样受 Origin 白名单约束。

> **注意：** `vercel dev` 如果不设置环境变量，`/api/health` 会返回 `ok:false`，`/api/chat` 会返回 `503 server_not_configured`。这是预期的安全失败方式。

## 请求 / 响应

与 Worker 完全一致，详见 [`../README.md#5-api-契约`](../README.md#5-api-契约)：

- `POST /api/chat`，`Content-Type: application/json`；
- `messages` 1–24 条；单条 ≤ 72,000 字符，正文总字符 ≤ 80,000；请求体 < 256 KiB；
- `stream: true` 时转发上游 SSE；
- 请求体里的 `model` 被忽略；
- 错误统一为 `{ "error": { "code": "...", "message": "..." } }`；
- `GET /api/health` 返回 `{ok, provider, model, streaming}`；配置完整为 `200`，缺 Key / URL 无效时返回同一结构但 HTTP 为 `503`。

Vercel 的 Node body 解析通常已把 JSON 放进 `req.body`。`chat.js` 同时兼容“已解析对象”和“原始流”两种形式，并再次按 256 KiB 校验。

## Vercel 限制与注意事项

- **函数时长**：Hobby 计划的函数执行时长、并发和流式响应支持会随套餐变化；长文档生成可能被平台提前终止。需要在 Vercel 项目设置/`vercel.json` 中按套餐调整 `maxDuration`，但不要超过账户允许的上限。
- **SSE 缓冲**：部分 Vercel 边缘/代理路径可能缓冲流式响应。`chat.js` 已设置 `Cache-Control: no-store, no-transform` 与 `X-Accel-Buffering: no`，但不能保证所有套餐的实时性。
- **Node 版本**：使用 Node 20 或更新版本；旧版 Node 没有稳定的全局 `fetch` / Web Streams。
- **密钥安全**：只在 Vercel Dashboard 环境变量中添加；不要创建含真实 Key 的 `.env`、README、截图或提交记录。
- **访问控制**：静态前端若注入 `ACCESS_TOKEN`，任何访问者都能看到它；它只是轻量访问门槛，不是正式身份认证。公开使用建议叠加 Vercel 的访问保护、Rate Limit 或在更前面加 Cloudflare。
- **日志**：函数代码不记录消息正文；但 Vercel 平台自身的请求日志/错误日志策略、以及上游模型服务的日志政策仍需按学校要求评估。
- **真实调用验证**：本目录只做了 Node 语法与 Mock 上游验证。部署后请用没有敏感数据的测试消息实际调用一次 `/api/chat` 和 `/api/health`，确认 Key、模型名、CORS、SSE 与套餐时长。

## 最小部署自检

```bash
# 1. 语法
node --check api/chat.js
node --check api/health.js

# 2. 健康检查（部署后）
curl -sS https://<project>.vercel.app/api/health

# 3. 非流式（设置了 ACCESS_TOKEN 时）
curl -sS https://<project>.vercel.app/api/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{"messages":[{"role":"user","content":"你好"}],"stream":false}'

# 4. 流式
curl -N https://<project>.vercel.app/api/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{"messages":[{"role":"user","content":"你好"}],"stream":true}'
```

不要用真实学生数据做 smoke test。