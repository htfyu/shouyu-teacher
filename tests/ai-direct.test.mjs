import test from "node:test";
import assert from "node:assert/strict";
import {
  AI_CONSENT_VERSION,
  DIRECT_PRESETS,
  getDirectPreset,
  normalizeAISettings,
  providerLabel
} from "../js/ai.js";

test("direct provider fills DeepSeek preset by default", () => {
  const settings = normalizeAISettings({ provider: "direct", directPreset: "deepseek" });
  assert.equal(settings.provider, "direct");
  assert.equal(settings.endpoint, "https://api.deepseek.com/chat/completions");
  assert.equal(settings.model, "deepseek-chat");
});

test("direct provider preserves an explicit custom endpoint and model", () => {
  const settings = normalizeAISettings({
    provider: "direct",
    directPreset: "custom",
    endpoint: "https://example.test/v1/chat/completions",
    model: "example-model",
    apiKey: "local-test-key"
  });
  assert.equal(settings.endpoint, "https://example.test/v1/chat/completions");
  assert.equal(settings.model, "example-model");
  assert.equal(settings.apiKey, "local-test-key");
});

test("direct provider label names the selected model", () => {
  assert.equal(providerLabel({ provider: "direct", model: "deepseek-chat" }), "直连模型 · deepseek-chat");
});

test("direct presets are OpenAI-compatible and include local Ollama", () => {
  assert.ok(DIRECT_PRESETS.length >= 5);
  for (const preset of DIRECT_PRESETS) {
    if (preset.id === "ollama") {
      assert.equal(preset.needsKey, false);
      assert.match(preset.endpoint, /^http:\/\/127\.0\.0\.1/);
    } else if (preset.id !== "custom") {
      assert.match(preset.endpoint, /\/chat\/completions$/);
      assert.equal(preset.needsKey, true);
    }
  }
  assert.equal(getDirectPreset("missing").id, "deepseek");
});

test("consent requires the current version", () => {
  const valid = normalizeAISettings({ consent: { granted: true, version: AI_CONSENT_VERSION } });
  assert.equal(valid.consent.granted, true);
  const expired = normalizeAISettings({ consent: { granted: true, version: "old" } });
  assert.equal(expired.consent.granted, false);
});
