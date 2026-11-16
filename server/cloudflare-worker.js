/**
 * 匠备 V2 · Cloudflare Worker AI Proxy
 *
 * Routes:
 *   POST /api/chat   OpenAI-compatible chat completion proxy (JSON or SSE)
 *   GET  /api/health Safe, non-secret health information
 *
 * The browser never receives the upstream API key. The request model is ignored;
 * env.AI_MODEL is always used.
 *
 * Required secrets / variables:
 *   AI_API_KEY       (secret) upstream OpenAI-compatible API key
 *   AI_BASE_URL      (var)    default https://api.deepseek.com
 *   AI_MODEL         (var)    default deepseek-chat
 *   ALLOWED_ORIGINS  (var)    comma-separated exact browser origins
 * Optional:
 *   ACCESS_TOKEN     (secret) Bearer access gate for the proxy (not the model key)
 *   AI_TIMEOUT_MS    (var)    total upstream timeout, 5000–120000 ms
 */

const DEFAULTS = Object.freeze({
  BASE_URL: "https://api.deepseek.com",
  MODEL: "deepseek-chat",
  TIMEOUT_MS: 60_000,
  MAX_TOKENS: 1_600,
  TEMPERATURE: 0.3
});

const LIMITS = Object.freeze({
  // The requirement is a body strictly smaller than 256 KiB.
  MAX_BODY_BYTES: 256 * 1024,
  MAX_MESSAGES: 24,
  // The frontend builds one generation prompt by clipping each field and source
  // block, so a single user message can legitimately be tens of thousands of
  // characters. The 256 KiB body cap remains the outer memory/size guard.
  MAX_MESSAGE_CHARS: 72_000,
  MAX_TOTAL_CHARS: 80_000,
  MIN_TIMEOUT_MS: 5_000,
  MAX_TIMEOUT_MS: 120_000,
  MIN_TOKENS: 1,
  MAX_OUTPUT_TOKENS: 8_192
});

const ALLOWED_ROLES = new Set(["system", "user", "assistant"]);
const BASE_SECURITY_HEADERS = Object.freeze({
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer"
});

class HttpError extends Error {
  constructor(status, code, message, extraHeaders = {}) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
    this.extraHeaders = extraHeaders;
  }
}

export default {
  /**
   * @param {Request} request
   * @param {Record<string, unknown>} env
   * @param {{waitUntil?: Function}} _ctx
   * @returns {Promise<Response>}
   */
  async fetch(request, env, _ctx) {
    const origin = (request.headers.get("Origin") || "").trim();
    const corsHeaders = buildCorsHeaders(origin, env);

    try {
      const url = new URL(request.url);
      const path = normalizePath(url.pathname);

      if (request.method === "OPTIONS") {
        assertKnownPath(path);
        assertOriginAllowed(origin, env);
        return new Response(null, {
          status: 204,
          headers: {
            ...BASE_SECURITY_HEADERS,
            ...corsHeaders,
            "access-control-allow-methods": path === "/api/health" ? "GET, OPTIONS" : "POST, OPTIONS",
            "access-control-allow-headers": "Authorization, Content-Type",
            "access-control-max-age": "86400"
          }
        });
      }

      if (path === "/api/health") {
        assertOriginAllowed(origin, env);
        if (request.method !== "GET") {
          throw new HttpError(405, "method_not_allowed", "Use GET for this endpoint.", {
            allow: "GET, OPTIONS"
          });
        }
        const health = getHealth(env);
        // 503 means the proxy process is reachable but not ready to serve model
        // traffic (missing key or invalid upstream URL). The body still has the
        // required {ok, provider, model, streaming} shape and never a secret.
        return jsonResponse(health.ok ? 200 : 503, health, {
          ...BASE_SECURITY_HEADERS,
          ...corsHeaders
        });
      }

      if (path !== "/api/chat") {
        throw new HttpError(404, "not_found", "Endpoint not found.");
      }

      // The origin gate applies before auth, body parsing and upstream calls.
      assertOriginAllowed(origin, env);
      if (request.method !== "POST") {
        throw new HttpError(405, "method_not_allowed", "Use POST for this endpoint.", {
          allow: "POST, OPTIONS"
        });
      }

      await requireAccessToken(request, env);

      const contentType = (request.headers.get("Content-Type") || "")
        .split(";", 1)[0]
        .trim()
        .toLowerCase();
      if (contentType !== "application/json") {
        throw new HttpError(415, "unsupported_media_type", "Content-Type must be application/json.");
      }

      const rawBody = await readBodyWithLimit(request, LIMITS.MAX_BODY_BYTES);
      let body;
      try {
        body = JSON.parse(rawBody);
      } catch {
        throw new HttpError(400, "invalid_json", "Request body must be valid JSON.");
      }

      const input = validateChatInput(body);
      const config = readConfig(env);
      return await chat(request, config, input, corsHeaders);
    } catch (error) {
      return errorResponse(error, corsHeaders);
    }
  }
};

/* -------------------------------------------------------------------------- */
/* Configuration / CORS                                                        */
/* -------------------------------------------------------------------------- */

function normalizePath(pathname) {
  const cleaned = String(pathname || "/").replace(/\/+$/, "");
  return cleaned || "/";
}

function normalizeOrigin(value) {
  return String(value || "").trim().replace(/\/+$/, "").toLowerCase();
}

function getAllowedOrigins(env) {
  return String(env.ALLOWED_ORIGINS || "")
    .split(",")
    .map(normalizeOrigin)
    .filter(Boolean);
}

function isOriginAllowed(origin, env) {
  if (!origin) return true; // Non-browser / same-origin server call.
  const normalized = normalizeOrigin(origin);
  if (!normalized) return true;
  return getAllowedOrigins(env).includes(normalized);
}

function buildCorsHeaders(origin, env) {
  const headers = {
    vary: "Origin"
  };
  if (origin && isOriginAllowed(origin, env)) {
    headers["access-control-allow-origin"] = origin;
    headers["access-control-allow-methods"] = "GET, POST, OPTIONS";
    headers["access-control-allow-headers"] = "Authorization, Content-Type";
    headers["access-control-max-age"] = "86400";
  }
  return headers;
}

function assertOriginAllowed(origin, env) {
  if (!isOriginAllowed(origin, env)) {
    throw new HttpError(403, "origin_not_allowed", "This browser origin is not allowed.");
  }
}

function assertKnownPath(path) {
  if (path !== "/api/chat" && path !== "/api/health") {
    throw new HttpError(404, "not_found", "Endpoint not found.");
  }
}

function readConfig(env) {
  const baseUrlRaw = String(env.AI_BASE_URL || DEFAULTS.BASE_URL).trim();
  const model = String(env.AI_MODEL || DEFAULTS.MODEL).trim();
  const apiKey = String(env.AI_API_KEY || "").trim();
  const timeoutCandidate = Number.parseInt(String(env.AI_TIMEOUT_MS || DEFAULTS.TIMEOUT_MS), 10);
  const timeoutMs = Number.isFinite(timeoutCandidate)
    ? Math.min(Math.max(timeoutCandidate, LIMITS.MIN_TIMEOUT_MS), LIMITS.MAX_TIMEOUT_MS)
    : DEFAULTS.TIMEOUT_MS;

  let baseUrl;
  try {
    baseUrl = buildUpstreamUrl(baseUrlRaw);
  } catch {
    throw new HttpError(503, "server_not_configured", "AI upstream URL is not configured correctly.");
  }

  if (!apiKey) {
    throw new HttpError(503, "server_not_configured", "AI upstream key is not configured.");
  }
  if (!model) {
    throw new HttpError(503, "server_not_configured", "AI model is not configured.");
  }

  return { baseUrl, model, apiKey, timeoutMs };
}

function buildUpstreamUrl(baseUrlRaw) {
  const raw = String(baseUrlRaw || "").trim();
  if (!raw) throw new Error("Missing base URL");
  const parsed = new URL(raw);
  const isLocalHttp =
    parsed.protocol === "http:" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname.toLowerCase());
  if (parsed.protocol !== "https:" && !isLocalHttp) {
    throw new Error("Upstream must use HTTPS");
  }
  if (!parsed.hostname) throw new Error("Missing upstream host");
  if (parsed.username || parsed.password) throw new Error("Credentials are not allowed in URL");
  if (parsed.search || parsed.hash) throw new Error("Query/hash are not allowed in base URL");

  const pathname = parsed.pathname.replace(/\/+$/, "");
  if (pathname.toLowerCase().endsWith("/chat/completions")) {
    throw new Error("AI_BASE_URL must not include /chat/completions");
  }
  parsed.pathname = `${pathname}/chat/completions`;
  return parsed.toString();
}

function getHealth(env) {
  const model = String(env.AI_MODEL || DEFAULTS.MODEL).trim() || DEFAULTS.MODEL;
  const keyConfigured = Boolean(String(env.AI_API_KEY || "").trim());
  let baseConfigured = false;
  try {
    buildUpstreamUrl(String(env.AI_BASE_URL || DEFAULTS.BASE_URL).trim());
    baseConfigured = true;
  } catch {
    baseConfigured = false;
  }
  return {
    ok: keyConfigured && baseConfigured,
    provider: "openai-compatible",
    model,
    streaming: true
  };
}

/* -------------------------------------------------------------------------- */
/* Authentication                                                              */
/* -------------------------------------------------------------------------- */

async function requireAccessToken(request, env) {
  const expected = String(env.ACCESS_TOKEN || "").trim();
  if (!expected) return;

  const header = request.headers.get("Authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  const supplied = match ? match[1].trim() : "";
  const valid = supplied ? await timingSafeEqualText(supplied, expected) : false;
  if (!valid) {
    throw new HttpError(401, "unauthorized", "A valid access token is required.", {
      "www-authenticate": "Bearer"
    });
  }
}

async function timingSafeEqualText(a, b) {
  const encoder = new TextEncoder();
  const [aHash, bHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(a)),
    crypto.subtle.digest("SHA-256", encoder.encode(b))
  ]);
  const aBytes = new Uint8Array(aHash);
  const bBytes = new Uint8Array(bHash);
  let difference = 0;
  for (let index = 0; index < aBytes.length; index += 1) {
    difference |= aBytes[index] ^ bBytes[index];
  }
  return difference === 0;
}

/* -------------------------------------------------------------------------- */
/* Request validation                                                          */
/* -------------------------------------------------------------------------- */

async function readBodyWithLimit(request, maxBytes) {
  const declared = Number(request.headers.get("Content-Length"));
  if (Number.isFinite(declared) && declared >= maxBytes) {
    throw new HttpError(413, "payload_too_large", "Request body must be smaller than 256 KiB.");
  }
  if (!request.body) {
    throw new HttpError(400, "empty_body", "Request body is required.");
  }

  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total >= maxBytes) {
      try {
        await reader.cancel("body_too_large");
      } catch {
        // Best effort; the response is already determined.
      }
      throw new HttpError(413, "payload_too_large", "Request body must be smaller than 256 KiB.");
    }
    chunks.push(value);
  }

  if (total === 0) {
    throw new HttpError(400, "empty_body", "Request body is required.");
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(merged);
}

function validateChatInput(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new HttpError(400, "invalid_request", "Request body must be a JSON object.");
  }
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    throw new HttpError(400, "invalid_messages", "messages must be a non-empty array.");
  }
  if (body.messages.length > LIMITS.MAX_MESSAGES) {
    throw new HttpError(413, "messages_too_large", `At most ${LIMITS.MAX_MESSAGES} messages are allowed.`);
  }

  const messages = [];
  let totalChars = 0;
  let hasUserMessage = false;

  for (const message of body.messages) {
    if (!message || typeof message !== "object" || Array.isArray(message)) {
      throw new HttpError(400, "invalid_messages", "Each message must be an object.");
    }
    if (!ALLOWED_ROLES.has(message.role)) {
      throw new HttpError(400, "invalid_messages", "Message role must be system, user or assistant.");
    }
    if (typeof message.content !== "string") {
      throw new HttpError(400, "invalid_messages", "Message content must be a string.");
    }
    if (message.content.length > LIMITS.MAX_MESSAGE_CHARS) {
      throw new HttpError(413, "messages_too_large", "A single message is too long.");
    }
    totalChars += message.content.length;
    if (totalChars > LIMITS.MAX_TOTAL_CHARS) {
      throw new HttpError(413, "messages_too_large", "Total message text is too long.");
    }
    if (message.role === "user" && message.content.trim()) hasUserMessage = true;
    messages.push({ role: message.role, content: message.content });
  }

  if (!hasUserMessage) {
    throw new HttpError(400, "invalid_messages", "At least one non-empty user message is required.");
  }

  if (body.stream !== undefined && typeof body.stream !== "boolean") {
    throw new HttpError(400, "invalid_request", "stream must be a boolean.");
  }

  let temperature = DEFAULTS.TEMPERATURE;
  if (body.temperature !== undefined) {
    if (typeof body.temperature !== "number" || !Number.isFinite(body.temperature)) {
      throw new HttpError(400, "invalid_request", "temperature must be a finite number.");
    }
    if (body.temperature < 0 || body.temperature > 2) {
      throw new HttpError(400, "invalid_request", "temperature must be between 0 and 2.");
    }
    temperature = body.temperature;
  }

  let maxTokens = DEFAULTS.MAX_TOKENS;
  if (body.max_tokens !== undefined) {
    if (
      typeof body.max_tokens !== "number" ||
      !Number.isInteger(body.max_tokens) ||
      body.max_tokens < LIMITS.MIN_TOKENS ||
      body.max_tokens > LIMITS.MAX_OUTPUT_TOKENS
    ) {
      throw new HttpError(
        400,
        "invalid_request",
        `max_tokens must be an integer between ${LIMITS.MIN_TOKENS} and ${LIMITS.MAX_OUTPUT_TOKENS}.`
      );
    }
    maxTokens = body.max_tokens;
  }

  return {
    messages,
    stream: body.stream === true,
    temperature,
    maxTokens
  };
}

/* -------------------------------------------------------------------------- */
/* Chat proxy                                                                  */
/* -------------------------------------------------------------------------- */

async function chat(_request, config, input, corsHeaders) {
  const abortController = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    abortController.abort();
  }, config.timeoutMs);

  let upstream;
  try {
    upstream = await fetch(config.baseUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        Accept: input.stream ? "text/event-stream" : "application/json"
      },
      body: JSON.stringify({
        // Deliberately ignore any client-supplied model. The server model wins.
        model: config.model,
        messages: input.messages,
        stream: input.stream,
        temperature: input.temperature,
        max_tokens: input.maxTokens
      }),
      signal: abortController.signal,
      // Do not follow upstream redirects: they can leak credentials or turn
      // a provider outage into an unexpected HTML/JSON response.
      redirect: "error"
    });
  } catch {
    clearTimeout(timer);
    if (timedOut) {
      throw new HttpError(504, "upstream_timeout", "AI provider timed out.");
    }
    throw new HttpError(502, "upstream_unreachable", "AI provider is unreachable.");
  }

  if (!upstream.ok) {
    try {
      await upstream.body?.cancel();
    } catch {
      // Ignore cancellation errors; never forward the provider body.
    }
    clearTimeout(timer);
    if (upstream.status === 429) {
      throw new HttpError(429, "upstream_rate_limited", "AI provider rate limit reached. Retry later.");
    }
    throw new HttpError(502, "upstream_error", "AI provider request failed.");
  }

  if (!input.stream) {
    try {
      const raw = await upstream.text();
      let payload;
      try {
        payload = JSON.parse(raw);
      } catch {
        throw new HttpError(502, "upstream_invalid_response", "AI provider returned an invalid response.");
      }
      return jsonResponse(200, payload, {
        ...BASE_SECURITY_HEADERS,
        ...corsHeaders
      });
    } catch (error) {
      if (error instanceof HttpError) throw error;
      if (timedOut) throw new HttpError(504, "upstream_timeout", "AI provider timed out.");
      throw new HttpError(502, "upstream_error", "AI provider request failed.");
    } finally {
      clearTimeout(timer);
    }
  }

  const upstreamType = (upstream.headers.get("Content-Type") || "").toLowerCase();
  if (!upstream.body || !upstreamType.includes("text/event-stream")) {
    try {
      await upstream.body?.cancel();
    } catch {
      // Ignore cancellation errors.
    }
    clearTimeout(timer);
    throw new HttpError(502, "upstream_error", "AI provider did not return an SSE stream.");
  }

  const reader = upstream.body.getReader();
  const encoder = new TextEncoder();
  let finished = false;

  const stream = new ReadableStream({
    async pull(controller) {
      if (finished) return;
      try {
        const { done, value } = await reader.read();
        if (done) {
          finished = true;
          clearTimeout(timer);
          controller.close();
          return;
        }
        controller.enqueue(value);
      } catch {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        // Status 200 was already sent. Emit a sanitized SSE error instead of
        // forwarding a provider stack trace or partial diagnostic.
        const event = encoder.encode(
          `data: ${JSON.stringify({
            error: {
              code: timedOut ? "upstream_timeout" : "upstream_stream_interrupted",
              message: timedOut ? "AI provider timed out." : "AI stream interrupted."
            }
          })}\n\n`
        );
        try {
          controller.enqueue(event);
        } catch {
          // The client may have disconnected.
        }
        try {
          controller.close();
        } catch {
          // Already closed.
        }
      }
    },
    cancel(reason) {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      abortController.abort();
      reader.cancel(reason).catch(() => {});
    }
  });

  return new Response(stream, {
    status: 200,
    headers: {
      ...BASE_SECURITY_HEADERS,
      ...corsHeaders,
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-store, no-transform",
      "x-accel-buffering": "no"
    }
  });
}

/* -------------------------------------------------------------------------- */
/* Responses                                                                   */
/* -------------------------------------------------------------------------- */

function jsonResponse(status, payload, headers = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...BASE_SECURITY_HEADERS,
      ...headers,
      "content-type": "application/json; charset=utf-8"
    }
  });
}

function errorResponse(error, corsHeaders) {
  if (error instanceof HttpError) {
    return jsonResponse(
      error.status,
      { error: { code: error.code, message: error.message } },
      { ...corsHeaders, ...error.extraHeaders }
    );
  }
  // Never return stack traces, provider bodies, env values or tokens.
  return jsonResponse(
    500,
    { error: { code: "server_error", message: "Unexpected proxy error." } },
    corsHeaders
  );
}