import test from "node:test";
import assert from "node:assert/strict";
import worker from "../server/cloudflare-worker.js";

const ORIGIN = "https://htfyu.github.io";
const env = {
  AI_API_KEY: "test-only-key-not-real",
  AI_BASE_URL: "https://api.deepseek.com",
  AI_MODEL: "deepseek-chat",
  ALLOWED_ORIGINS: ORIGIN,
  ACCESS_TOKEN: ""
};

function request(path, options = {}) {
  return new Request(`https://worker.example${path}`, {
    ...options,
    headers: {
      Origin: ORIGIN,
      ...(options.headers || {})
    }
  });
}

function chatRequest(body, opts = {}) {
  return request("/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json", ...(opts.headers || {}) },
    body: JSON.stringify(body)
  });
}

test("health 不返回密钥；缺 Key 时 503", async () => {
  const noKey = await worker.fetch(request("/api/health"), { ...env, AI_API_KEY: "" });
  assert.equal(noKey.status, 503);
  const health = await noKey.json();
  assert.equal(health.ok, false);
  assert.equal(JSON.stringify(health).includes("test-only-key"), false);
  const okEnv = { ...env };
  const ok = await worker.fetch(request("/api/health"), okEnv);
  assert.equal(ok.status, 200);
  const body = await ok.json();
  assert.equal(body.ok, true);
  assert.equal(body.model, "deepseek-chat");
  assert.equal(JSON.stringify(body).includes("test-only-key"), false);
});

test("CORS 拒绝不在白名单的 Origin", async () => {
  const res = await worker.fetch(
    new Request("https://worker.example/api/health", { headers: { Origin: "https://evil.example" } }),
    env
  );
  assert.equal(res.status, 403);
});

test("OPTIONS 预检只对允许的 Origin 返回 CORS", async () => {
  const res = await worker.fetch(request("/api/chat", { method: "OPTIONS" }), env);
  assert.equal(res.status, 204);
  assert.equal(res.headers.get("access-control-allow-origin"), ORIGIN);
});

test("ACCESS_TOKEN 缺失时 401，提供后通过", async () => {
  const protectedEnv = { ...env, ACCESS_TOKEN: "test-access" };
  const denied = await worker.fetch(chatRequest({ messages: [{ role: "user", content: "hi" }] }), protectedEnv);
  assert.equal(denied.status, 401);
  globalThis.fetch = async () => new Response(JSON.stringify({ choices: [{ message: { content: "ok" }, finish_reason: "stop" }] }), {
    status: 200,
    headers: { "content-type": "application/json" }
  });
  const allowed = await worker.fetch(
    chatRequest({ messages: [{ role: "user", content: "hi" }], model: "client-model" }, { headers: { authorization: "Bearer test-access" } }),
    protectedEnv
  );
  assert.equal(allowed.status, 200);
});

test("模型由服务端固定，客户端不能覆盖", async () => {
  let upstreamBody = null;
  globalThis.fetch = async (url, options) => {
    upstreamBody = JSON.parse(options.body);
    return new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  };
  const res = await worker.fetch(
    chatRequest({ messages: [{ role: "user", content: "hi" }], model: "attacker-model" }),
    env
  );
  assert.equal(res.status, 200);
  assert.equal(upstreamBody.model, "deepseek-chat");
  assert.equal(upstreamBody.messages[0].content, "hi");
});

test("请求体超限返回 413，且不包含 Key", async () => {
  const huge = "x".repeat(256 * 1024 + 100);
  const res = await worker.fetch(chatRequest({ messages: [{ role: "user", content: huge }] }), env);
  assert.equal(res.status, 413);
  const text = await res.text();
  assert.equal(text.includes("test-only-key"), false);
});

test("非 JSON Content-Type 返回 415", async () => {
  const res = await worker.fetch(
    request("/api/chat", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "hello"
    }),
    env
  );
  assert.equal(res.status, 415);
});

test("SSE 流式转发保留 data 事件", async () => {
  globalThis.fetch = async () => new Response(
    new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"你"}}]}\n\n'));
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      }
    }),
    { status: 200, headers: { "content-type": "text/event-stream" } }
  );
  const res = await worker.fetch(chatRequest({ messages: [{ role: "user", content: "hi" }], stream: true }), env);
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type"), /text\/event-stream/);
  const text = await res.text();
  assert.match(text, /data:/);
  assert.match(text, /\[DONE\]/);
});