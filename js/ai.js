/**
 * 授渔 · AI 适配层
 *
 * 设计约束：
 * 1. 浏览器中绝不保存 AI 服务商 API Key；
 * 2. 生产环境使用 server/ 中的安全代理（Key 在服务端环境变量）；
 * 3. 线上体验通道使用无密钥的公开推理服务，仅用于演示，且必须由用户显式同意；
 * 4. AI 不可用时由 app.js 回退到本地规则引擎。
 */

export const AI_CONSENT_VERSION = "2026-11-16.v1";

export const DEMO_PROVIDER = {
  id: "demo",
  name: "AI 体验通道",
  short: "体验通道",
  description: "公开无密钥推理服务，仅用于演示。数据会发送至第三方，不适合敏感资料。",
  endpoint: "https://text.pollinations.ai/openai",
  model: "openai-fast",
  editable: false
};

export const PROXY_PROVIDER = {
  id: "proxy",
  name: "学校 / 自建安全代理",
  short: "安全代理",
  description: "调用 server/ 中的 Cloudflare Worker 或 Vercel Function；模型密钥只存在服务端。",
  endpoint: "",
  model: "deepseek-chat",
  editable: true
};

/**
 * 浏览器直连的 OpenAI 兼容服务商预设。
 * 注意：直连会把 API Key 留在本机浏览器；生产环境优先使用安全代理。
 */
export const DIRECT_PRESETS = [
  {
    id: "deepseek",
    name: "DeepSeek",
    endpoint: "https://api.deepseek.com/chat/completions",
    model: "deepseek-chat",
    needsKey: true,
    note: "推荐；deepseek-chat 适合教学问答与长文改写。"
  },
  {
    id: "qwen",
    name: "阿里云百炼 / 通义",
    endpoint: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
    model: "qwen-plus",
    needsKey: true,
    note: "百炼兼容模式；模型名可按控制台改为 qwen-max 等。"
  },
  {
    id: "zhipu",
    name: "智谱 GLM",
    endpoint: "https://open.bigmodel.cn/api/paas/v4/chat/completions",
    model: "glm-4-flash",
    needsKey: true,
    note: "glm-4-flash 免费额度较大，适合先试用。"
  },
  {
    id: "openai",
    name: "OpenAI",
    endpoint: "https://api.openai.com/v1/chat/completions",
    model: "gpt-4o-mini",
    needsKey: true,
    note: "浏览器直连可能受 CORS 限制；失败请改用安全代理。"
  },
  {
    id: "moonshot",
    name: "Moonshot / Kimi",
    endpoint: "https://api.moonshot.cn/v1/chat/completions",
    model: "moonshot-v1-8k",
    needsKey: true,
    note: "适合中文长文本；模型名以控制台为准。"
  },
  {
    id: "siliconflow",
    name: "SiliconFlow",
    endpoint: "https://api.siliconflow.cn/v1/chat/completions",
    model: "Qwen/Qwen2.5-7B-Instruct",
    needsKey: true,
    note: "模型广场中的 OpenAI 兼容模型均可尝试。"
  },
  {
    id: "ollama",
    name: "本地 Ollama",
    endpoint: "http://127.0.0.1:11434/v1/chat/completions",
    model: "qwen2.5:7b",
    needsKey: false,
    note: "需先 ollama pull，并设置 OLLAMA_ORIGINS=* 允许浏览器访问。"
  },
  {
    id: "custom",
    name: "自定义 OpenAI 兼容接口",
    endpoint: "",
    model: "",
    needsKey: true,
    note: "填写完整的 /chat/completions 地址；服务需允许浏览器跨域。"
  }
];

export function getDirectPreset(id) {
  return DIRECT_PRESETS.find((item) => item.id === id) || DIRECT_PRESETS[0];
}

export const DEFAULT_AI_SETTINGS = {
  mode: "local", // local | ai
  provider: "demo",
  endpoint: DEMO_PROVIDER.endpoint,
  model: DEMO_PROVIDER.model,
  directPreset: "deepseek",
  apiKey: "", // 直连模式：只保存在本机 IndexedDB，不写入备份、不进入源码
  proxyToken: "", // 可选的服务访问口令，不是模型 API Key；仅 sessionStorage
  healthEndpoint: "",
  temperature: 0.35,
  maxTokens: 4096,
  consent: {
    granted: false,
    version: "",
    grantedAt: ""
  },
  reasonerVisible: false
};

const UNSAFE_RESPONSE_MESSAGES = {
  400: "AI 服务未接受这次请求，请检查任务描述或代理配置。",
  401: "AI 服务鉴权失败。请检查模型 API Key、安全代理访问口令或服务端环境变量。",
  403: "AI 服务拒绝了请求。请检查来源白名单或访问权限。",
  404: "AI 接口地址不存在。请检查设置中的端点路径。",
  408: "AI 服务响应超时，请重试；也可以切换回本地模式。",
  402: "AI 体验通道触发限流（同一时间只能处理一个请求）。请等待约 30 秒后重试，或使用本地模式。",
  413: "发送内容超过服务限制，请缩短资料或分段处理。",
  429: "AI 服务当前繁忙或额度不足，请稍后重试，或使用本地模式。",
  500: "AI 服务内部错误，请稍后重试。",
  502: "AI 安全代理无法连接上游模型服务。",
  503: "AI 服务暂时不可用，请回退本地模式。",
  504: "AI 服务响应超时，请重试。"
};

export function normalizeAISettings(raw = {}) {
  const merged = {
    ...DEFAULT_AI_SETTINGS,
    ...(raw || {}),
    consent: { ...DEFAULT_AI_SETTINGS.consent, ...((raw && raw.consent) || {}) }
  };
  if (!["local", "ai"].includes(merged.mode)) merged.mode = "local";
  if (!["demo", "proxy", "direct"].includes(merged.provider)) merged.provider = "demo";
  if (merged.provider === "demo") {
    merged.endpoint = DEMO_PROVIDER.endpoint;
    merged.model = DEMO_PROVIDER.model;
  }
  merged.endpoint = String(merged.endpoint || "").trim();
  merged.model = String(merged.model || "").trim();
  if (merged.provider === "direct") {
    merged.directPreset = getDirectPreset(merged.directPreset).id;
    const preset = getDirectPreset(merged.directPreset);
    // 从体验通道切换过来时，合并后的默认端点仍是体验通道地址，需要替换为预设端点。
    if (!merged.endpoint || merged.endpoint === DEMO_PROVIDER.endpoint) merged.endpoint = preset.endpoint;
    if (!merged.model || merged.model === DEMO_PROVIDER.model) merged.model = preset.model;
  }
  merged.apiKey = String(merged.apiKey || "").trim();
  merged.proxyToken = String(merged.proxyToken || "");
  merged.healthEndpoint = String(merged.healthEndpoint || "").trim();
  merged.temperature = Math.min(1.2, Math.max(0, Number(merged.temperature) || 0.35));
  merged.maxTokens = Math.min(8192, Math.max(256, Number.parseInt(merged.maxTokens, 10) || 4096));
  merged.consent.granted = Boolean(merged.consent.granted && merged.consent.version === AI_CONSENT_VERSION);
  return merged;
}

export function providerLabel(settings) {
  if (settings?.provider === "proxy") return settings.model ? `安全代理 · ${settings.model}` : "安全代理";
  if (settings?.provider === "direct") return settings.model ? `直连模型 · ${settings.model}` : "直连模型";
  return "AI 体验通道";
}

export function hasValidConsent(settings) {
  return Boolean(settings?.consent?.granted && settings?.consent?.version === AI_CONSENT_VERSION);
}

export function inferHealthEndpoint(settings) {
  if (settings?.healthEndpoint) return settings.healthEndpoint;
  if (settings?.provider !== "proxy") return "";
  try {
    const url = new URL(settings.endpoint);
    url.pathname = url.pathname.replace(/\/api\/chat\/?$/, "/api/health");
    return url.toString();
  } catch (error) {
    return "";
  }
}

function authHeaders(settings) {
  const headers = { "Content-Type": "application/json", Accept: "text/event-stream, application/json" };
  if (settings?.provider === "direct" && settings.apiKey) {
    headers.Authorization = `Bearer ${settings.apiKey}`;
  } else if (settings?.provider === "proxy" && settings.proxyToken) {
    headers.Authorization = `Bearer ${settings.proxyToken}`;
  }
  return headers;
}

function isLocalEndpoint(endpoint) {
  try {
    const url = new URL(endpoint);
    return ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname.toLowerCase());
  } catch (error) {
    return false;
  }
}

function extractDelta(value) {
  const choice = value?.choices?.[0];
  if (!choice) return { content: "", reasoning: "" };
  const delta = choice.delta || choice.message || {};
  const normalize = (part) => {
    if (typeof part === "string") return part;
    if (Array.isArray(part)) {
      return part.map((item) => (typeof item === "string" ? item : item?.text || "")).join("");
    }
    return "";
  };
  return {
    content: normalize(delta.content),
    reasoning: normalize(delta.reasoning || delta.reasoning_content)
  };
}

function looksIncomplete(text) {
  const value = String(text || "").trim();
  if (value.length < 500) return false;
  // Heuristic only: a long answer ending mid-sentence (no terminal punctuation
  // or closing quote) is likely cut off by an upstream token cap or disconnect.
  return !/[。！？.!?…；;：:）)\]】”’"'\n]$/.test(value);
}

function safeError(status, rawText = "") {
  const base = UNSAFE_RESPONSE_MESSAGES[status] || (status >= 500 ? "AI 上游服务异常，请稍后重试。" : "AI 请求失败。");
  // 不回传上游正文，避免把可能包含用户数据或密钥的错误信息写入日志 / 界面。
  const detail = /invalid api key|unauthorized/i.test(rawText) ? "鉴权失败。" : "";
  return new Error(detail ? `${base} ${detail}` : base);
}

/**
 * 流式调用 AI。
 * @param {object} options
 * @param {Array<{role:string,content:string}>} options.messages
 * @param {object} options.settings normalizeAISettings() 后的设置
 * @param {AbortSignal} [options.signal]
 * @param {(delta:string, full:string)=>void} [options.onDelta]
 * @param {(reasoning:string)=>void} [options.onReasoning]
 * @param {(meta:object)=>void} [options.onMeta]
 * @returns {Promise<{text:string, reasoning:string, provider:string, model:string, duration:number}>}
 */
export async function streamAI({ messages, settings, signal, onDelta, onReasoning, onMeta }) {
  const config = normalizeAISettings(settings);
  if (!config.endpoint) throw new Error("尚未配置 AI 接口地址");
  if (!Array.isArray(messages) || !messages.length) throw new Error("没有可发送给 AI 的消息");
  if (config.provider === "demo" && !hasValidConsent(config)) {
    throw new Error("尚未确认第三方 AI 数据传输说明");
  }
  if (config.provider === "direct") {
    if (!config.apiKey && !isLocalEndpoint(config.endpoint)) {
      throw new Error("请先在设置中填写模型 API Key");
    }
    if (!hasValidConsent(config)) {
      throw new Error("尚未确认模型数据传输说明");
    }
  }

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 120000);
  const abortFromCaller = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener("abort", abortFromCaller, { once: true });
  }

  const body = {
    model: config.model,
    messages,
    stream: true,
    temperature: config.temperature,
    max_tokens: config.maxTokens
  };
  // The public demo model is a reasoning model. Lower reasoning effort keeps the
  // limited anonymous output budget available for actual teaching content.
  if (config.provider === "demo") body.reasoning_effort = "low";

  const startedAt = performance.now();
  let response;
  try {
    response = await fetch(config.endpoint, {
      method: "POST",
      headers: authHeaders(config),
      body: JSON.stringify(body),
      signal: controller.signal,
      cache: "no-store",
      credentials: "omit"
    });
  } catch (error) {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abortFromCaller);
    if (error?.name === "AbortError") {
      throw new Error(timedOut ? "AI 响应超时，请重试或回退本地模式。" : "已取消 AI 生成。");
    }
    throw new Error("无法连接 AI 服务。请检查网络、代理地址或回退本地模式。");
  }

  if (!response.ok) {
    const rawText = await response.text().catch(() => "");
    clearTimeout(timer);
    signal?.removeEventListener("abort", abortFromCaller);
    throw safeError(response.status, rawText);
  }

  onMeta?.({
    provider: config.provider,
    model: config.model,
    contentType: response.headers.get("content-type") || "",
    endpoint: config.endpoint
  });

  const contentType = response.headers.get("content-type") || "";
  let fullText = "";
  let fullReasoning = "";
  let finishReason = "";
  let usage = null;

  const emit = (content, reasoning) => {
    if (reasoning) {
      fullReasoning += reasoning;
      onReasoning?.(reasoning);
    }
    if (content) {
      fullText += content;
      onDelta?.(content, fullText);
    }
  };

  try {
    if (!contentType.includes("text/event-stream") || !response.body) {
      const data = await response.json();
      const choice = data?.choices?.[0];
      const content = choice?.message?.content || choice?.text || data?.content || "";
      const reasoning = choice?.message?.reasoning || "";
      finishReason = choice?.finish_reason || data?.finish_reason || "";
      usage = data?.usage || null;
      emit(typeof content === "string" ? content : "", typeof reasoning === "string" ? reasoning : "");
    } else {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let done = false;
      while (!done) {
        const { value, done: streamDone } = await reader.read();
        if (streamDone) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const payload = trimmed.slice(5).trim();
          if (!payload || payload === "[DONE]") {
            if (payload === "[DONE]") done = true;
            continue;
          }
          try {
            const parsed = JSON.parse(payload);
            if (parsed.usage) usage = parsed.usage;
            if (parsed.choices?.[0]?.finish_reason) finishReason = parsed.choices[0].finish_reason;
            const { content, reasoning } = extractDelta(parsed);
            emit(content, reasoning);
          } catch (error) {
            // Ignore keep-alive / non-JSON events.
          }
        }
      }
      if (buffer.trim().startsWith("data:")) {
        const payload = buffer.trim().slice(5).trim();
        if (payload && payload !== "[DONE]") {
          try {
            const { content, reasoning } = extractDelta(JSON.parse(payload));
            emit(content, reasoning);
          } catch (error) {
            // Ignore.
          }
        }
      }
    }
  } catch (error) {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abortFromCaller);
    if (error?.name === "AbortError") {
      throw new Error(timedOut ? "AI 响应超时，请重试或回退本地模式。" : "已取消 AI 生成。");
    }
    if (fullText) {
      // 已收到部分内容时保留，不把半个结果丢掉。
      return {
        text: fullText,
        reasoning: fullReasoning,
        provider: config.provider,
        model: config.model,
        duration: performance.now() - startedAt,
        finishReason,
        usage,
        partial: true,
        incomplete: looksIncomplete(fullText)
      };
    }
    throw new Error("AI 返回内容读取失败，请重试或回退本地模式。");
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abortFromCaller);
  }

  if (!fullText.trim()) {
    throw new Error("AI 未返回有效文本。请重试，或切回本地模式。");
  }

  return {
    text: fullText.trim(),
    reasoning: fullReasoning,
    provider: config.provider,
    model: config.model,
    duration: performance.now() - startedAt,
    finishReason,
    usage,
    incomplete: !finishReason && looksIncomplete(fullText)
  };
}

/**
 * 带一次自动重试的流式调用。
 * 仅在尚未收到任何文本时重试，避免界面出现重复片段。
 */
export async function streamAIWithRetry(options, { attempts = 2, backoffMs = 900 } = {}) {
  let received = false;
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    received = false;
    try {
      return await streamAI({
        ...options,
        onDelta: (delta, full) => {
          if (delta) received = true;
          options.onDelta?.(delta, full);
        }
      });
    } catch (error) {
      lastError = error;
      const message = String(error?.message || "");
      const aborted = /取消|cancelled|AbortError/i.test(message);
      if (aborted || received || attempt >= attempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, backoffMs * attempt));
    }
  }
  throw lastError || new Error("AI 请求失败");
}

/**
 * 连接检查：不发送教学正文，只检查服务可达性与鉴权。
 */
export async function checkAIConnection(settings, { signal } = {}) {
  const config = normalizeAISettings(settings);
  if (config.provider === "demo") {
    try {
      const res = await fetch("https://text.pollinations.ai/models", { signal, cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const models = await res.json();
      const ok = Array.isArray(models) && models.length > 0;
      return { ok, message: ok ? `体验通道可用（${models[0]?.name || config.model}）` : "体验通道没有返回可用模型" };
    } catch (error) {
      return { ok: false, message: "体验通道当前不可达。可稍后重试，或使用本地模式。" };
    }
  }
  if (config.provider === "direct") {
    if (!config.endpoint) return { ok: false, message: "请先填写模型接口地址" };
    if (!config.apiKey && !isLocalEndpoint(config.endpoint)) return { ok: false, message: "请先填写模型 API Key" };
    if (!hasValidConsent(config)) return { ok: false, message: "请先确认数据传输说明" };
    try {
      const response = await streamAI({
        messages: [{ role: "user", content: "只回复 OK 两个字母。" }],
        settings: { ...config, maxTokens: 128 },
        signal
      });
      return { ok: true, message: `${config.model || "模型"} 已返回响应` };
    } catch (error) {
      return { ok: false, message: error.message };
    }
  }
  if (!config.endpoint) return { ok: false, message: "请先填写安全代理地址" };
  if (!hasValidConsent(config)) return { ok: false, message: "请先确认数据传输说明" };
  const health = inferHealthEndpoint(config);
  if (health) {
    try {
      const res = await fetch(health, {
        signal,
        headers: config.proxyToken ? { Authorization: `Bearer ${config.proxyToken}` } : {},
        cache: "no-store"
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        return { ok: true, message: `安全代理可用${data.model ? `（${data.model}）` : ""}` };
      }
      if (res.status !== 404) return { ok: false, message: `代理健康检查失败（HTTP ${res.status}）` };
    } catch (error) {
      // Fall through to a minimal completion check.
    }
  }
  try {
    const response = await streamAI({
      messages: [{ role: "user", content: "只回复 OK 两个字母。" }],
      settings: { ...config, maxTokens: 512 },
      signal
    });
    return { ok: Boolean(response.text), message: "代理已返回模型响应" };
  } catch (error) {
    return { ok: false, message: error.message };
  }
}

export function consentRecord() {
  return {
    granted: true,
    version: AI_CONSENT_VERSION,
    grantedAt: new Date().toISOString()
  };
}