"use strict";

/**
 * 授渔 V2 · Vercel health endpoint
 * GET /api/health — never returns the upstream key.
 *
 * Reuses the configuration check from chat.js so Worker and Vercel report the
 * same provider/model shape. The proxy access token, when configured, is NOT
 * required for health; it contains no secrets and is useful for uptime checks.
 */

const { getProviderConfigStatus } = require("./chat");

const SECURITY_HEADERS = Object.freeze({
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer"
});

function normalizeOrigin(value) {
  return String(value || "").trim().replace(/\/+$/, "").toLowerCase();
}

function getAllowedOrigins(env) {
  return String(env.ALLOWED_ORIGINS || "")
    .split(",")
    .map(normalizeOrigin)
    .filter(Boolean);
}

function corsHeaders(origin, env) {
  const headers = { Vary: "Origin" };
  if (origin && getAllowedOrigins(env).includes(normalizeOrigin(origin))) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Methods"] = "GET, OPTIONS";
    headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type";
    headers["Access-Control-Max-Age"] = "86400";
  }
  return headers;
}

function applyHeaders(res, headers) {
  for (const [name, value] of Object.entries(headers)) {
    if (value !== undefined && value !== null) res.setHeader(name, value);
  }
}

function send(res, status, payload, headers) {
  applyHeaders(res, {
    ...SECURITY_HEADERS,
    ...headers,
    "Content-Type": "application/json; charset=utf-8"
  });
  res.statusCode = status;
  res.end(JSON.stringify(payload));
}

module.exports = async function handler(req, res) {
  const origin = String(req.headers?.origin || "").trim();
  const cors = corsHeaders(origin, process.env);
  const originAllowed = !origin || getAllowedOrigins(process.env).includes(normalizeOrigin(origin));

  if (!originAllowed) {
    send(
      res,
      403,
      { error: { code: "origin_not_allowed", message: "This browser origin is not allowed." } },
      cors
    );
    return;
  }

  if (req.method === "OPTIONS") {
    applyHeaders(res, {
      ...SECURITY_HEADERS,
      ...cors
    });
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== "GET") {
    send(
      res,
      405,
      { error: { code: "method_not_allowed", message: "Use GET for this endpoint." } },
      { ...cors, Allow: "GET, OPTIONS" }
    );
    return;
  }

  try {
    const health = getProviderConfigStatus(process.env);
    // Reachable but not ready (missing key / invalid base URL) is a 503. This
    // prevents clients that only check res.ok from treating it as healthy.
    send(res, health.ok ? 200 : 503, health, cors);
  } catch {
    send(
      res,
      500,
      { error: { code: "server_error", message: "Unexpected health check error." } },
      cors
    );
  }
};