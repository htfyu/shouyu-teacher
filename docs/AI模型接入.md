# AI 模型接入说明

授渔提供三种 AI 通道。日常演示可用体验通道；需要明显提升回答质量时，使用“自定义大模型直连”或“安全代理”。

| 通道 | 适用场景 | 模型 Key 位置 | 限制 |
|---|---|---|---|
| AI 体验通道 | 公开演示、快速试用 | 无 Key | 匿名、限速、输出长度有限，回答质量一般 |
| 自定义大模型直连 | 个人电脑、受控设备、临时评审 | 本机浏览器 IndexedDB | 需要自备 Key；服务商需允许浏览器跨域 |
| 学校 / 自建安全代理 | 生产、多人使用、校内部署 | 服务端环境变量 | 需要部署 Cloudflare Worker 或 Vercel Function |

## 一、自定义大模型直连（推荐用于提升对话质量）

1. 打开“设置 → 模型接入”，AI 通道选择“自定义大模型（OpenAI 兼容直连）”。
2. 选择服务商预设，或选择“自定义 OpenAI 兼容接口”。
3. 填写完整的 `chat/completions` 地址、模型名和 API Key。
4. 阅读并同意数据传输说明。
5. 点“测试连接”，看到模型返回响应后再使用。
6. 保存设置。

### 预设

| 服务商 | 接口地址 | 默认模型 |
|---|---|---|
| DeepSeek | `https://api.deepseek.com/chat/completions` | `deepseek-chat` |
| 阿里云百炼 / 通义 | `https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions` | `qwen-plus` |
| 智谱 GLM | `https://open.bigmodel.cn/api/paas/v4/chat/completions` | `glm-4-flash` |
| OpenAI | `https://api.openai.com/v1/chat/completions` | `gpt-4o-mini` |
| Moonshot / Kimi | `https://api.moonshot.cn/v1/chat/completions` | `moonshot-v1-8k` |
| SiliconFlow | `https://api.siliconflow.cn/v1/chat/completions` | `Qwen/Qwen2.5-7B-Instruct` |
| 本地 Ollama | `http://127.0.0.1:11434/v1/chat/completions` | `qwen2.5:7b` |

接口地址必须是完整的 `/chat/completions` 地址；模型名以服务商控制台为准。

### Key 存在哪里

- 直连 Key 只写入本机 IndexedDB，**不写入 localStorage、源码、对话内容或 JSON 备份**。
- 换浏览器、换设备或清理站点数据后需要重新填写。
- 公共电脑、共用机房不要勾选/保存 Key；用完请在设置页点“清除已保存的 Key”。
- 直连请求会把 Key 作为 `Authorization: Bearer` 请求头发送给所选服务商，这是直连模式的必要行为。

## 二、本地 Ollama

```bash
ollama pull qwen2.5:7b
# Windows PowerShell
$env:OLLAMA_ORIGINS="*"
ollama serve
```

接口填 `http://127.0.0.1:11434/v1/chat/completions`，模型填 `qwen2.5:7b`，Key 可留空。若浏览器仍报跨域，请把授渔页面来源加入 `OLLAMA_ORIGINS`。

## 三、安全代理（生产推荐）

部署 `server/cloudflare-worker.js` 或 `server/vercel/`，设置：

```text
AI_API_KEY=你的模型 Key（服务端 secret）
AI_BASE_URL=https://api.deepseek.com
AI_MODEL=deepseek-chat
ALLOWED_ORIGINS=https://htfyu.github.io
```

前端选择“学校 / 自建安全代理”，填写代理 `/api/chat` 地址和可选访问口令。模型 Key 不会进入浏览器。

## 四、常见错误

| 现象 | 可能原因 | 处理 |
|---|---|---|
| 401 / 鉴权失败 | Key 错误、过期、余额不足 | 重新复制 Key，检查服务商控制台 |
| CORS / Failed to fetch | 服务商不允许浏览器直连 | 改用安全代理 |
| 404 | 接口地址不是完整 `/chat/completions` | 检查路径 |
| 429 | 限速或额度不足 | 稍后重试、换模型或换通道 |
| 返回被截断 | 最大输出长度不足 | 提高 `maxTokens`，或缩小问题范围 |
| Ollama 连接失败 | 未启动或未允许跨域 | 启动 `ollama serve`，设置 `OLLAMA_ORIGINS` |

## 五、安全边界

- 直连模式适合个人设备与受控电脑，不适合公共电脑长期保存 Key。
- 生产、多人使用、校内数据，优先使用安全代理，Key 只放服务端环境变量。
- AI 输出仍需教师审核；来源、参数、设备和安全条款不能由模型直接定稿。
- 不要把 Key 写进 `js/`、`README`、截图、演示视频或提交材料。
