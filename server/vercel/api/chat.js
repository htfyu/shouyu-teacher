"use strict";

/**
 * 匠备 V2 · Vercel Serverless Function AI Proxy
 *
 * Endpoint: POST /api/chat
 * Runtime:  Node.js 20+ (uses global fetch, Web Streams and AbortController).
 *
 * Required environment variables:
 *   AI_API_KEY       upstream OpenAI-compatible key (never expose to the browser)
 *   AI_BASE_URL      default https://api.deepseek.com
 *   AI_MODEL         default deepseek-chat
 *   ALLOWED_ORIGINS  comma-separated exact browser origins
 * Optional:
 *   ACCESS_TOKEN     Bearer access gate for the proxy (not the model key)
 *   AI_TIMEOUT_MS    total upstream timeout, 5000–120000 ms
 *
 * Security policy intentionally mirrors server/cloudflare-worker.js. Keep the
 * limits, CORS behaviour and error sanitisation in sync when changing either file.
 */

const nodeCrypto = require("node:crypto");

const DEFAULTS = Object.freeze({
  BASE_URL: "https://api.deepseek.com",
  MODEL: "deepseek-chat",
  TIMEOUT_MS: 60_000,
  MAX_TOKENS: 1_600,
  TEMPERATURE: 0.3
});

const LIMITS = Object.freeze({
  MAX_BODY_BYTES: 256 * 1024,
  MAX_MESSAGES: 24,
  // Keep parity with the Worker. The frontend clips fields and source blocks,
  // but its assembled generation prompt can be tens of thousands of characters.
  MAX_MESSAGE_CHARS: 72_000,
  MAX_TOTAL_CHARS: 80_000,
  MIN_TIMEOUT_MS: 5_000,
  MAX_TIMEOUT_MS: 120_000,
  MIN_TOKENS: 1,
  MAX_OUTPUT_TOKENS: 8_192
});

const ALLOWED_ROLES = new Set(["system", "user", "assistant"]);
const BASE_SECURITY_HEADERS = Object.freeze({
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer"
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

module.exports = async function handler(req, res) {
  const origin = String(req.headers?.origin || "").trim();
  const corsHeaders = buildCorsHeaders(origin, process.env);

  try {
    let pathname;
    try {
      pathname = normalizePath(new URL(req.url || "/", "http://localhost").pathname);
    } catch {
      pathname = "/";
    }
    if (pathname !== "/api/chat") {
      throw new HttpError(404, "not_found", "Endpoint not found.");
    }

    if (req.method === "OPTIONS") {
      assertOriginAllowed(origin, process.env);
      applyHeaders(res, {
        ...BASE_SECURITY_HEADERS,
        ...corsHeaders,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
        "Access-Control-Max-Age": "86400"
      });
      res.statusCode = 204;
      res.end();
      return;
    }

    // Origin first, so a disallowed browser gets the CORS boundary rather than
    // learning endpoint details from a 405.
    assertOriginAllowed(origin, process.env);

    if (req.method !== "POST") {
      throw new HttpError(405, "method_not_allowed", "Use POST for this endpoint.", {
        Allow: "POST, OPTIONS"
      });
    }

    requireAccessToken(req, process.env);

    const contentType = String(req.headers["content-type"] || "")
      .split(";", 1)[0]
      .trim()
      .toLowerCase();
    if (contentType !== "application/json") {
      throw new HttpError(415, "unsupported_media_type", "Content-Type must be application/json.");
    }

    const body = await readJsonBody(req);
    const input = validateChatInput(body);
    const config = readConfig(process.env);
    await chat(req, res, config, input, corsHeaders);
  } catch (error) {
    if (res.headersSent || res.writableEnded) {
      try {
        if (!res.writableEnded) res.end();
      } catch {
        // Socket is already gone.
      }
      return;
    }
    sendError(res, error, corsHeaders);
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
  if (!origin) return true;
  const normalized = normalizeOrigin(origin);
  if (!normalized) return true;
  return getAllowedOrigins(env).includes(normalized);
}

function buildCorsHeaders(origin, env) {
  const headers = { Vary: "Origin" };
  if (origin && isOriginAllowed(origin, env)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Methods"] = "POST, OPTIONS";
    headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type";
    headers["Access-Control-Max-Age"] = "86400";
  }
  return headers;
}

function assertOriginAllowed(origin, env) {
  if (!isOriginAllowed(origin, env)) {
    throw new HttpError(403, "origin_not_allowed", "This browser origin is not allowed.");
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
  if (parsed.protocol !== "https:" && !isLocalHttp) throw new Error("Upstream must use HTTPS");
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

function getProviderConfigStatus(env) {
  const model = String(env.AI_MODEL || DEFAULTS.MODEL).trim() || DEFAULTS.MODEL;
  let baseConfigured = false;
  try {
    buildUpstreamUrl(String(env.AI_BASE_URL || DEFAULTS.BASE_URL).trim());
    baseConfigured = true;
  } catch {
    baseConfigured = false;
  }
  return {
    ok: Boolean(String(env.AI_API_KEY || "").trim()) && baseConfigured,
    provider: "openai-compatible",
    model,
    streaming: true
  };
}

/* -------------------------------------------------------------------------- */
/* Authentication                                                              */
/* -------------------------------------------------------------------------- */

function requireAccessToken(req, env) {
  const expected = String(env.ACCESS_TOKEN || "").trim();
  if (!expected) return;
  const header = String(req.headers.authorization || "");
  const match = header.match(/^Bearer\s+(.+)$/i);
  const supplied = match ? match[1].trim() : "";
  if (!supplied || !timingSafeEqualText(supplied, expected)) {
    throw new HttpError(401, "unauthorized", "A valid access token is required.", {
      "WWW-Authenticate": "Bearer"
    });
  }
}

function timingSafeEqualText(a, b) {
  const aHash = nodeCrypto.createHash("sha256").update(String(a)).digest();
  const bHash = nodeCrypto.createHash("sha256").update(String(b)).digest();
  return nodeCrypto.timingSafeEqual(aHash, bHash);
}

/* -------------------------------------------------------------------------- */
/* Request validation                                                          */
/* -------------------------------------------------------------------------- */

async function readJsonBody(req) {
  const declared = Number(req.headers["content-length"]);
  if (Number.isFinite(declared) && declared >= LIMITS.MAX_BODY_BYTES) {
    throw new HttpError(413, "payload_too_large", "Request body must be smaller than 256 KiB.");
  }

  let raw;
  if (req.body !== undefined && req.body !== null) {
    if (Buffer.isBuffer(req.body)) raw = req.body;
    else if (typeof req.body === "string") raw = Buffer.from(req.body, "utf8");
    else if (typeof req.body === "object") raw = Buffer.from(JSON.stringify(req.body), "utf8");
    else throw new HttpError(400, "invalid_json", "Request body must be valid JSON.");
  } else {
    raw = await readStreamLimited(req, LIMITS.MAX_BODY_BYTES);
  }

  if (raw.byteLength >= LIMITS.MAX_BODY_BYTES) {
    throw new HttpError(413, "payload_too_large", "Request body must be smaller than 256 KiB.");
  }
  if (raw.byteLength === 0) {
    throw new HttpError(400, "empty_body", "Request body is required.");
  }
  try {
    return JSON.parse(raw.toString("utf8"));
  } catch {
    throw new HttpError(400, "invalid_json", "Request body must be valid JSON.");
  }
}

function readStreamLimited(req, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    let settled = false;

    const cleanup = () => {
      req.removeListener("data", onData);
      req.removeListener("end", onEnd);
      req.removeListener("error", onError);
    };

    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) reject(error);
      else resolve(value);
    };

    const onData = (chunk) => {
      if (settled) return;
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      total += buffer.byteLength;
      if (total >= maxBytes) {
        finish(new HttpError(413, "payload_too_large", "Request body must be smaller than 256 KiB."));
        return;
      }
      chunks.push(buffer);
    };
    const onEnd = () => finish(null, Buffer.concat(chunks));
    const onError = () => finish(new HttpError(400, "invalid_json", "Could not read request body."));

    req.on("data", onData);
    req.on("end", onEnd);
    req.on("error", onError);
  });
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

  return { messages, stream: body.stream === true, temperature, maxTokens };
}

/* -------------------------------------------------------------------------- */
/* Chat proxy                                                                  */
/* -------------------------------------------------------------------------- */

async function chat(_req, res, config, input, corsHeaders) {
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
        // Never trust a client-provided model; the deployment's env model wins.
        model: config.model,
        messages: input.messages,
        stream: input.stream,
        temperature: input.temperature,
        max_tokens: input.maxTokens
      }),
      signal: abortController.signal,
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
      // Ignore; provider body must never be forwarded.
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
      sendJson(res, 200, payload, { ...BASE_SECURITY_HEADERS, ...corsHeaders });
      return;
    } catch (error) {
      if (error instanceof HttpError) throw error;
      if (timedOut) throw new HttpError(504, "upstream_timeout", "AI provider timed out.");
      throw new HttpError(502, "upstream_error", "AI provider request failed.");
    } finally {
      clearTimeout(timer);
    }
  }

  const upstreamType = String(upstream.headers.get("content-type") || "").toLowerCase();
  if (!upstream.body || !upstreamType.includes("text/event-stream")) {
    try {
      await upstream.body?.cancel();
    } catch {
      // Ignore.
    }
    clearTimeout(timer);
    throw new HttpError(502, "upstream_error", "AI provider did not return an SSE stream.");
  }

  let clientClosed = false;
  let finished = false;
  const reader = upstream.body.getReader();

  const onClose = () => {
    if (finished) return;
    clientClosed = true;
    finished = true;
    clearTimeout(timer);
    abortController.abort();
    reader.cancel().catch(() => {});
  };
  res.on("close", onClose);

  applyHeaders(res, {
    ...BASE_SECURITY_HEADERS,
    ...corsHeaders,
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-store, no-transform",
    "X-Accel-Buffering": "no"
  });
  res.statusCode = 200;
  if (typeof res.flushHeaders === "function") res.flushHeaders();

  try {
    while (!finished) {
      const { done, value } = await reader.read();
      if (done) {
        if (!finished) {
          finished = true;
          clearTimeout(timer);
          if (!res.writableEnded) res.end();
        }
        break;
      }
      if (clientClosed || res.writableEnded) break;
      const canContinue = res.write(Buffer.from(value));
      if (!canContinue) {
        await new Promise((resolve) => {
          const doneDrain = () => {
            res.removeListener("drain", doneDrain);
            res.removeListener("close", doneDrain);
            resolve();
          };
          res.once("drain", doneDrain);
          res.once("close", doneDrain);
        });
      }
    }
  } catch {
    clearTimeout(timer);
    if (!finished) finished = true;
    if (!clientClosed && !res.writableEnded) {
      try {
        res.write(
          `data: ${JSON.stringify({
            error: {
              code: timedOut ? "upstream_timeout" : "upstream_stream_interrupted",
              message: timedOut ? "AI provider timed out." : "AI stream interrupted."
            }
          })}\n\n`
        );
      } catch {
        // Client disconnected while writing the sanitized error.
      }
      try {
        res.end();
      } catch {
        // Socket already gone.
      }
    }
  } finally {
    clearTimeout(timer);
    res.removeListener("close", onClose);
    if (!reader.closed) {
      try {
        reader.cancel().catch(() => {});
      } catch {
        // Ignore.
      }
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Responses                                                                   */
/* -------------------------------------------------------------------------- */

function applyHeaders(res, headers) {
  for (const [name, value] of Object.entries(headers)) {
    if (value !== undefined && value !== null) res.setHeader(name, value);
  }
}

function sendJson(res, status, payload, headers = {}) {
  applyHeaders(res, {
    ...BASE_SECURITY_HEADERS,
    ...headers,
    "Content-Type": "application/json; charset=utf-8"
  });
  res.statusCode = status;
  res.end(JSON.stringify(payload));
}

function sendError(res, error, corsHeaders) {
  if (error instanceof HttpError) {
    sendJson(
      res,
      error.status,
      { error: { code: error.code, message: error.message } },
      { ...corsHeaders, ...error.extraHeaders }
    );
    return;
  }
  sendJson(
    res,
    500,
    { error: { code: "server_error", message: "Unexpected proxy error." } },
    corsHeaders
  );
}

// Exported for deployment-time health checks in api/health.js. Vercel still treats
// the default export as the HTTP handler.
module.exports.getProviderConfigStatus = getProviderConfigStatus;