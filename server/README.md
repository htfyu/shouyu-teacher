# 授渔 V2 · AI Proxy（安全代理）

站点本身部署在 GitHub Pages，是纯静态前端。**模型 API Key 绝不能放进浏览器代码。** 本目录提供两个可部署的 OpenAI-compatible 代理：

- **Cloudflare Worker（推荐）**：`cloudflare-worker.js`
- **Vercel Serverless Function（备选）**：`vercel/api/chat.js`

前端 `js/ai.js` 只需要配置代理地址，不需要也不应该拿到 `AI_API_KEY`。

> **不部署代理，就没有生产级 AI。** 前端仍可使用本地知识库 / 结构化工作流模式；代理只是可选的在线生成增强层。

---

## 1. 架构

```text
GitHub Pages 前端 (js/ai.js)
        │  POST /api/chat  (CORS + 可选 Bearer access token)
        ▼
Cloudflare Worker / Vercel Function
        │  Authorization: Bearer <AI_API_KEY>   ← 只在服务端
        ▼
OpenAI-compatible provider (DeepSeek / OpenAI / 兼容网关)
```

- `AI_API_KEY` 只保存在 Worker / Vercel 的加密环境变量中。
- 代理**不记录消息正文**，不做持久化；`console` 中也不打印 prompt。
- 请求中的 `model` 字段会被忽略，始终使用部署环境里的 `AI_MODEL`。
- 非流式请求原样返回上游 JSON；流式请求转发 OpenAI-compatible SSE。

## 2. 文件

```text
server/
├─ cloudflare-worker.js       # Cloudflare Worker（ES module）
├─ wrangler.toml              # Worker 名称 / 变量 / 运行配置
├─ .dev.vars.example          # 本地开发变量样例（无真实密钥）
├─ .gitignore                 # 排除 .dev.vars / .env 等
├─ vercel/
│  ├─ .env.example            # Vercel 本地开发变量样例（无真实密钥）
│  ├─ api/chat.js             # Vercel Node 运行时聊天代理
│  ├─ api/health.js           # Vercel 健康检查（与 Worker 同形）
│  └─ README.md               # Vercel 部署说明
└─ README.md                  # 本文件
```

## 3. Cloudflare Worker 部署（推荐）

在 `server/` 目录执行：

```bash
npx wrangler login
npx wrangler secret put AI_API_KEY
# 可选：启用前端访问口令
npx wrangler secret put ACCESS_TOKEN
npx wrangler deploy
```

`AI_BASE_URL`、`AI_MODEL`、`AI_TIMEOUT_MS`、`ALLOWED_ORIGINS` 在 `wrangler.toml` 的 `[vars]` 中配置。部署前至少修改 `ALLOWED_ORIGINS`。

部署后会得到类似地址：

```text
https://jiangbei-ai-proxy.<your-subdomain>.workers.dev
```

前端填写的 endpoint：

```text
https://jiangbei-ai-proxy.<your-subdomain>.workers.dev/api/chat
```

健康检查：

```text
https://jiangbei-ai-proxy.<your-subdomain>.workers.dev/api/health
```

### 本地开发

```bash
cd server
# Windows PowerShell:
Copy-Item .dev.vars.example .dev.vars
# macOS / Linux:
# cp .dev.vars.example .dev.vars

# 编辑 .dev.vars，填入真实上游 Key；该文件已被 server/.gitignore 排除
npx wrangler dev --port 8787
```

本地地址为 `http://localhost:8787/api/chat`。如果浏览器从 `http://localhost:5598` 调用，`ALLOWED_ORIGINS` 中需要包含 `http://localhost:5598`。

## 4. 环境变量

| 变量 | 必需 | 默认值 | 说明 |
|---|---|---|---|
| `AI_API_KEY` | 是 | 无 | 上游 OpenAI-compatible 模型的密钥。**只放 secret**。 |
| `AI_BASE_URL` | 否 | `https://api.deepseek.com` | 上游基础地址，代码自动拼接 `/chat/completions`。OpenAI 官方可设为 `https://api.openai.com/v1`。必须使用 HTTPS（仅 localhost 允许 HTTP）；不要带 `/chat/completions`、查询串或片段。 |
| `AI_MODEL` | 否 | `deepseek-chat` | 服务端固定模型名；请求体中的 `model` 会被忽略。 |
| `ALLOWED_ORIGINS` | 生产环境必须 | 空 | 逗号分隔的精确浏览器 Origin，例如 `https://htfyu.github.io`。支持多个，不支持 `*` 通配符。不要带路径或结尾斜杠。 |
| `ACCESS_TOKEN` | 否 | 空 | 可选的前端访问口令。设置后，`POST /api/chat` 必须带 `Authorization: Bearer <token>`。**它不是模型 Key**。 |
| `AI_TIMEOUT_MS` | 否 | `60000` | 上游请求总超时（含流式读取），代码会限制到 5000–120000 ms。 |

> **重要安全边界：** 前端是公开静态页面。如果把 `ACCESS_TOKEN` 写进浏览器可见的 `js/ai.js`，任何人都能看到它。这个口令只能防止“随手调用”，不能当作真正的用户认证。公开生产环境建议再叠加 Cloudflare Rate Limiting / Turnstile / WAF，或使用登录态 + 服务端 session。

## 5. API 契约

### `POST /api/chat`

请求头：

```http
Content-Type: application/json
Authorization: Bearer <ACCESS_TOKEN>   # 仅当服务端配置了 ACCESS_TOKEN
```

请求体：

```json
{
  "messages": [
    { "role": "system", "content": "你是工学一体化教学助手。" },
    { "role": "user", "content": "请根据任务生成教案。" }
  ],
  "stream": true,
  "temperature": 0.3,
  "max_tokens": 1600,
  "model": "会被忽略"
}
```

| 字段 | 规则 |
|---|---|
| `messages` | 1–24 条；`role` 只能是 `system` / `user` / `assistant`；`content` 必须是字符串；至少一条非空 user 消息。 |
| 单条 content | 最多 72,000 字符。 |
| 全部 content | 最多 80,000 字符。 |
| `stream` | 可选布尔值；默认 `false`。 |
| `temperature` | 可选 0–2；默认 `0.3`。 |
| `max_tokens` | 可选整数 1–8192；默认 `1600`。 |
| `model` | **被忽略**。服务端只用 `AI_MODEL`。 |

请求体必须**严格小于 256 KiB**。内容包括 JSON 外层，按实际字节数计算。

成功（非流式）：直接返回上游 OpenAI-compatible JSON，`Content-Type: application/json`。

成功（流式）：`Content-Type: text/event-stream`；转发上游 SSE（包括前端通常需要的 `data: [DONE]`）。代理不修改正常 chunk。

SSE 中途异常：HTTP 200 已发送后无法改状态码，代理会发送一条脱敏事件后关闭流：

```text
data: {"error":{"code":"upstream_stream_interrupted","message":"AI stream interrupted."}}
```

错误统一为：

```json
{
  "error": {
    "code": "origin_not_allowed",
    "message": "This browser origin is not allowed."
  }
}
```

常见状态码：`400` 参数错误、`401` 访问口令错误、`403` Origin 不在白名单、`413` 超过体积/消息限制、`415` Content-Type 错误、`429` 上游限流、`502` 上游失败、`504` 上游超时、`503` 服务端变量未配置。

### `GET /api/health`

无需 `ACCESS_TOKEN`（但同样受 Origin 白名单约束）：

```json
{
  "ok": true,
  "provider": "openai-compatible",
  "model": "deepseek-chat",
  "streaming": true
}
```

`ok` 只表示服务端 Key 与上游 URL 已配置，**不会返回密钥、上游 URL 或任何凭据**。配置完整时 HTTP 状态为 `200`；Key 缺失或 URL 无效时仍返回上述对象，但 HTTP 状态为 `503`，便于前端/监控识别“已部署但未就绪”。

### `OPTIONS`

对允许的 Origin 返回 CORS 预检响应，允许：

```text
/api/chat   → Access-Control-Allow-Methods: POST, OPTIONS
/api/health → Access-Control-Allow-Methods: GET, OPTIONS
两者共同    → Access-Control-Allow-Headers: Authorization, Content-Type
```

不允许的 Origin 返回 `403`，且不会得到 `Access-Control-Allow-Origin`。

## 6. 前端接入

当前任务不修改前端文件。`js/ai.js` 应按以下方式配置：

```js
const AI_ENDPOINT = "https://jiangbei-ai-proxy.<your-subdomain>.workers.dev/api/chat";
const AI_HEALTH = "https://jiangbei-ai-proxy.<your-subdomain>.workers.dev/api/health";

const response = await fetch(AI_ENDPOINT, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    // 仅当配置了 ACCESS_TOKEN：
    // "Authorization": "Bearer <public-access-token>"
  },
  body: JSON.stringify({
    messages,
    stream: true,
    temperature: 0.3,
    max_tokens: 1600
  })
});
```

- 非流式：`await response.json()`。
- 流式：检查 `response.ok` 后读取 `response.body`，按 SSE 的 `data:` 行解析；代理会转发上游的 `[DONE]`。
- 在设置 `ACCESS_TOKEN` 时，预检允许 `Authorization` 头，前端必须带对应 Bearer。
- `ALLOWED_ORIGINS` 必须包含 GitHub Pages 的实际 Origin：`https://htfyu.github.io`。它只匹配 Origin，不包含 `/jiangbei-teacher/` 路径。
- 请求中的 `model` 只是展示值，代理不会用它切换模型；真正的模型以 `AI_MODEL` 为准。
- 健康检查客户端应同时检查 HTTP 200 和响应体 `ok:true`；代理在 Key/URL 未配置时会返回 `503`，因此只检查 `res.ok` 的客户端也不会误判为可用。
- 当前 `js/ai.js` 默认最多发送 8,192 输出 token，代理上限同为 8,192；代理默认 1,600 仅在调用方省略 `max_tokens` 时使用。

### 用 curl 测试

```bash
# 健康（允许来源之外用 curl 时不带 Origin 也可以；生产建议同时加 Origin 测试 CORS）
curl -sS https://<worker>/api/health

# 非流式（如果有 ACCESS_TOKEN）
curl -sS https://<worker>/api/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{"messages":[{"role":"user","content":"你好"}],"stream":false}'

# SSE 流式
curl -N https://<worker>/api/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{"messages":[{"role":"user","content":"你好"}],"stream":true}'
```

> 不要把真实 Key 放入 curl 命令历史或聊天记录。上面的 `ACCESS_TOKEN` 是代理口令，不是模型 Key。

## 7. Vercel 部署（备选）

详见 [`vercel/README.md`](./vercel/README.md)。简单步骤：

1. 在 Vercel 导入本仓库，**Root Directory 设为 `server/vercel`**；
2. 在 Project Settings → Environment Variables 配置同一套变量（不要提交 `.env`）；
3. 部署后使用 `https://<project>.vercel.app/api/chat` 和 `/api/health`；
4. Vercel Hobby 的函数时长、SSE 缓冲和并发限制可能影响长生成；Cloudflare Worker 更适合作为正式代理。

## 8. 安全策略与限制

**已实现：**

- 模型 Key 只在服务端变量中，响应体、Health、错误中均不返回；
- 请求体 < 256 KiB，消息 1–24 条、单条 72,000 字符、总计 80,000 字符；
- `temperature` / `max_tokens` 校验，输出上限 8,192 tokens；
- Origin 精确白名单 + CORS + OPTIONS；
- 可选 Bearer 访问口令；
- 上游与非流式总超时，流式读取总超时；
- 上游错误不转发原始 body / stack / URL；
- 不记录消息正文；不做持久化；
- 不支持客户端覆盖模型；不转发 tools/function-calling 等额外字段。

**未实现 / 必须由部署方补齐：**

- 真正的用户登录、按用户配额、计费；
- 分布式速率限制（建议 Cloudflare Rate Limiting / WAF / Turnstile）；
- 内容审核、模型合规策略与审计留存（若学校制度要求，应另行设计）；
- 代理内存中的 prompt 仍会发送给上游模型服务，受该服务商隐私政策约束；不要在 prompt 中放学生姓名、证件号、联系方式、未脱敏成绩等敏感信息；
- CORS 不是认证：它只限制浏览器读取。公开 Worker 仍可能被脚本、curl 或伪造环境访问，生产必须配合速率限制和预算告警；
- 静态前端中写死的 `ACCESS_TOKEN` 对任何访问者可见，只能作为轻度门槛；
- 非流式健康检查需要实际配置 Key/URL 才 `ok:true`，但本目录的语法测试不会调用真实模型。

**数据安全建议：**

- 为代理单独申请一个可撤销、可设置预算的模型 Key；
- 在 Cloudflare/Vercel 设置用量告警；
- 前端只发送完成任务所需的最少文本，不上传原始学生数据；
- 正式教学使用前仍由教师人工审核。

## 9. 本地语法检查

```bash
node --check server/cloudflare-worker.js
node --check server/vercel/api/chat.js
node --check server/vercel/api/health.js
```

本目录提交前还会用 Mock 上游验证：CORS、OPTIONS、访问口令、体积/消息限制、模型固定、非流式 JSON 转发、SSE 流式转发、错误脱敏和 Health 不泄露密钥。真实上游调用需要你自行配置合法 Key；不要在测试文件中写真实 Key。

## 10. 故障排查

| 现象 | 检查 |
|---|---|
| 浏览器报 CORS / 403 | `ALLOWED_ORIGINS` 是否精确等于 `https://htfyu.github.io`（不是带路径的 URL）；是否已重新部署。 |
| `503 server_not_configured` | 是否执行了 `wrangler secret put AI_API_KEY`；`AI_BASE_URL` 是否合法。 |
| `502 upstream_error` | 上游 Key、模型名、Base URL 或服务状态；代理不会返回上游原始错误，请查看服务商控制台。 |
| `504 upstream_timeout` | 调大 `AI_TIMEOUT_MS`（≤120000），或检查网络/上游延迟。 |
| `/api/health` 的 `ok:false` | 缺少 `AI_API_KEY` 或 `AI_BASE_URL` 配置无效。 |
| SSE 一次性到达 / 被截断 | 反向代理缓冲、Vercel 函数时长或网络限制；Cloudflare Worker 通常更稳定。 |
| 前端能看到 Access Token | 这是静态前端的固有限制；不要把它当真正的用户身份校验。 |

---

**一句话：** 这个目录负责把“浏览器调用模型”改成“服务端代理调用模型”，并把 Key、CORS、输入上限、超时和错误信息边界关在服务端。不部署它，前端继续使用本地模式；部署后，仍需人工审核所有 AI 输出。