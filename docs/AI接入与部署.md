# AI 接入与安全部署

## 1. 双引擎边界

| 模式 | 实现 | 是否联网 | 适合 |
|---|---|---|---|
| 本地模式 | `js/engine.js` 规则、检索、模板 | 否 | 涉密 / 断网 / 稳定演示 |
| AI 体验通道 | 浏览器请求 `text.pollinations.ai` 公开匿名模型 | 是，第三方 | 在线演示、非敏感内容 |
| 安全代理 | 浏览器请求自建 Worker / Vercel，服务端调模型 | 是，学校/自建 | 生产、真实教学资料 |

前端**没有模型 API Key 字段**。`server/` 的 `AI_API_KEY` 只存在服务端环境变量。

## 2. 体验通道（默认，无需配置）

```text
浏览器 → https://text.pollinations.ai/openai (openai-fast)
```

- 首次使用必须阅读并同意数据传输说明；
- 匿名、限速、输出长度有限（约 1500 completion tokens），可能排队或不可用；
- 数据会发送给第三方，**不要输入敏感资料**；
- 输出过长时界面提示“输出达到长度上限”；生成任务只改写关键模块，其余保留本地结构；
- 失败自动回退本地，不丢任务条件。

## 3. 自建安全代理

### 3.1 目录

```text
server/
├─ cloudflare-worker.js      # 推荐
├─ wrangler.toml
├─ .dev.vars.example
├─ vercel/api/chat.js
├─ vercel/api/health.js
└─ README.md
```

### 3.2 环境变量

| 变量 | 必填 | 说明 |
|---|---|---|
| `AI_API_KEY` | 是 | 上游 OpenAI-compatible 模型 Key，secret |
| `AI_BASE_URL` | 是 | 如 `https://api.deepseek.com`；代码会追加 `/chat/completions` |
| `AI_MODEL` | 是 | 如 `deepseek-chat`；客户端不能覆盖 |
| `ALLOWED_ORIGINS` | 是 | 逗号分隔的精确 Origin，不支持 `*` |
| `ACCESS_TOKEN` | 否 | 代理访问口令；前端可见，只作轻量门槛，不是正式认证 |
| `AI_TIMEOUT_MS` | 否 | 上游超时，默认 60000 |

### 3.3 Cloudflare Worker

```bash
cd server
npm install -g wrangler
wrangler login
wrangler secret put AI_API_KEY
wrangler secret put ACCESS_TOKEN    # 可选
# 编辑 wrangler.toml 中的 AI_BASE_URL / AI_MODEL / ALLOWED_ORIGINS
wrangler deploy
```

部署后：

```text
POST https://<worker>.workers.dev/api/chat
GET  https://<worker>.workers.dev/api/health
```

前端：「AI 与数据设置」→ 通道选「学校 / 自建安全代理」→ 填 `/api/chat` 地址、模型显示名、可选口令。

### 3.4 Vercel（备选）

- Root Directory 设为 `server/vercel`；
- 在项目 Environment Variables 中配置上述变量；
- 部署后 endpoint 为 `https://<project>.vercel.app/api/chat`；
- 注意 Vercel 的函数时长与 SSE 缓冲，需在真实环境验证。

### 3.5 安全策略

- CORS 精确白名单；
- 请求体 < 256 KiB；最多 24 条消息；总文本 < 80,000 字符；
- 服务端固定模型，忽略客户端 `model`；
- 超时与上游重定向拒绝；
- 错误信息脱敏，不返回上游正文、URL 或 Key；
- 不记录消息正文；
- 可选 Bearer 访问口令（常量时间比较）。

## 4. 前端适配逻辑

`js/ai.js`：

- `streamAI()`：SSE 解析 `choices[0].delta.content` / `reasoning`；支持取消、120 秒超时、错误映射；
- `checkAIConnection()`：体验通道检查 `/models`；代理检查 `/api/health`；
- 体验通道额外发送 `reasoning_effort: "low"` 以保留输出预算；
- 代理请求可带 `Authorization: Bearer <access token>`；
- 不存储模型 Key。

`js/app.js`：

- AI 发送前调用 `prepareAIPayload()`：检测、掩码展示、用户确认；
- 生成采用“本地完整底稿 → AI 改写关键模块 → 合并回本地结构”；
- AI 输出被截断 / 解析失败 / 断网 / 隐私未确认时回退本地；
- 安全类问题固定走本地知识库。

## 5. 测试与限制

已做：体验通道真实流式调用、不可达代理回退、Markdown 合并与引用校验、代理 Mock 契约测试。

未做：真实 Cloudflare / Vercel 部署、真实模型 Key 调用、生产限流 / 登录 / 计费 / 审计。生产上线前必须补齐。

## 6. 不要把 Key 写进前端

不要在 `js/*.js`、`index.html`、`docs/`、`server/` 任何文件中写入真实 `sk-...`。`.gitignore` 已忽略 `.env`、`.dev.vars` 等；提交前请再执行一次密钥扫描。