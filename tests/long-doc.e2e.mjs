import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const playwright = await import(
  process.env.PLAYWRIGHT_MODULE
    ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href
    : "playwright"
);
const chromium = playwright.chromium || playwright.default?.chromium;
const BASE = process.env.SHOUYU_BASE || "http://127.0.0.1:5598/";
const errors = [];
const browser = await chromium.launch({ channel: "msedge", headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "zh-CN" });
const page = await context.newPage();
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });

try {
  await page.goto(`${BASE}#/course/course-0159`, { waitUntil: "networkidle" });
  await page.waitForTimeout(250);
  await page.locator('.work-context-actions [data-action="course-start-prep"]').click();
  await page.waitForTimeout(220);
  await page.locator('[data-action="studio-wizard-next"]').click();
  await page.waitForTimeout(150);
  await page.locator('[data-action="studio-wizard-next"]').click();
  await page.waitForTimeout(150);
  await page.locator('[data-action="studio-wizard-generate"]').click();
  await page.waitForTimeout(2000);

  await page.locator('[data-action="studio-open-editor"]').first().click();
  await page.waitForTimeout(350);
  assert.equal(await page.locator(".modal.is-editor").count(), 1, "editor did not open");

  const longText = Array.from({ length: 80 }, (_, index) =>
    `第${index + 1}段：本段用于验证长文档在真实编辑器中的换行、滚动和阅读宽度。学生完成双绞线端接后，教师需要逐项核对线序、压接质量、通断测试和工位整理，并记录需要返工的原因。`
  ).join("\n\n");
  const textarea = page.locator('textarea[data-editor-field="block-text"]').first();
  assert.ok(await textarea.count(), "no editable paragraph");
  await textarea.fill(longText);
  await page.waitForTimeout(1400);
  await page.getByRole("button", { name: "完成并返回" }).click();
  await page.waitForTimeout(600);
  await page.goto(`${BASE}#/studio`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);

  const metrics = await page.evaluate(() => {
    const body = document.querySelector(".studio-doc-body");
    const main = document.querySelector(".studio-doc-main");
    const paragraph = body?.querySelector(".doc-paragraph, p");
    const text = body?.innerText || "";
    return {
      textLength: text.length,
      bodyWidth: body?.getBoundingClientRect().width || 0,
      bodyScrollWidth: body?.scrollWidth || 0,
      mainClientWidth: main?.clientWidth || 0,
      mainScrollWidth: main?.scrollWidth || 0,
      mainClientHeight: main?.clientHeight || 0,
      mainScrollHeight: main?.scrollHeight || 0,
      fontSize: paragraph ? getComputedStyle(paragraph).fontSize : "",
      lineHeight: paragraph ? getComputedStyle(paragraph).lineHeight : "",
      pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
    };
  });
  assert.ok(metrics.textLength > 4000, `long text was not saved (length ${metrics.textLength})`);
  assert.equal(metrics.pageOverflow, 0, "long document caused horizontal overflow");
  assert.ok(metrics.bodyScrollWidth <= Math.ceil(metrics.bodyWidth) + 1, "document content overflows its column");
  assert.ok(metrics.mainScrollHeight > metrics.mainClientHeight, "long document did not become scrollable");
  assert.match(metrics.fontSize, /13\.5px|14px/);
  assert.deepEqual(errors, [], `console/page errors: ${errors.join(" | ")}`);
  console.log(JSON.stringify({ ok: true, ...metrics, errors }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, error: error.message, errors }, null, 2));
  process.exitCode = 1;
} finally {
  await browser.close();
}