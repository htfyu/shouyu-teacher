import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
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
const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1440, height: 1000 }, locale: "zh-CN" });
const page = await context.newPage();
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });

let backupPath = "";
try {
  // 1. A real teaching record, entered through the UI.
  await page.goto(`${BASE}#/course/course-0159`, { waitUntil: "networkidle" });
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "授课记录" }).click();
  await page.waitForTimeout(200);
  await page.getByRole("button", { name: /记录第一次授课/ }).click();
  await page.waitForTimeout(200);
  await page.locator("input[name=className]").fill("24网络1班");
  await page.locator("input[name=hours]").fill("4");
  await page.locator("textarea[name=summary]").fill("备份恢复测试：学生完成双绞线端接和通断测试。");
  await page.locator("textarea[name=reflection]").fill("下一次补做线序对照练习。");
  await page.getByRole("button", { name: "保存记录" }).click();
  await page.waitForTimeout(500);
  assert.equal(await page.locator(".teaching-record").count(), 1, "teaching record was not created");

  // 2. Export a real full backup and inspect the payload.
  await page.goto(`${BASE}#/settings`, { waitUntil: "networkidle" });
  await page.waitForTimeout(300);
  const downloadPromise = page.waitForEvent("download", { timeout: 15000 });
  await page.locator('[data-action="export-backup"]').click();
  const download = await downloadPromise;
  backupPath = path.join(os.tmpdir(), `shouyu-backup-${Date.now()}.json`);
  await download.saveAs(backupPath);
  const payload = JSON.parse(fs.readFileSync(backupPath, "utf8"));
  assert.equal(payload.teaching?.records?.length, 1, "backup did not include teaching records");
  assert.equal(payload.teaching.records[0].className, "24网络1班");
  assert.match(payload.teaching.records[0].summary, /备份恢复测试/);

  // 3. Clear local data, then confirm the teaching record is gone.
  await page.locator('[data-action="clear-local-data"]').click();
  await page.waitForTimeout(250);
  await page.locator('[data-action="confirm-clear-data"]').click();
  await page.waitForTimeout(1200);
  await page.goto(`${BASE}#/course/course-0159`, { waitUntil: "networkidle" });
  await page.waitForTimeout(250);
  await page.getByRole("button", { name: "授课记录" }).click();
  await page.waitForTimeout(250);
  assert.equal(await page.locator(".teaching-record").count(), 0, "clear did not remove teaching record");

  // 4. Import the same backup and restore the record.
  await page.goto(`${BASE}#/settings`, { waitUntil: "networkidle" });
  await page.waitForTimeout(300);
  const chooserPromise = page.waitForEvent("filechooser", { timeout: 10000 });
  await page.locator('[data-action="import-backup"]').click();
  const chooser = await chooserPromise;
  await chooser.setFiles(backupPath);
  await page.waitForSelector('[data-action="confirm-restore"]', { timeout: 10000 });
  await page.locator('[data-action="confirm-restore"]').click();
  await page.waitForTimeout(1600);
  await page.goto(`${BASE}#/course/course-0159`, { waitUntil: "networkidle" });
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "授课记录" }).click();
  await page.waitForTimeout(300);
  assert.equal(await page.locator(".teaching-record").count(), 1, "restore did not bring teaching record back");
  assert.match(await page.locator(".teaching-record-summary").innerText(), /备份恢复测试/);

  assert.deepEqual(errors, [], `console/page errors: ${errors.join(" | ")}`);
  console.log(JSON.stringify({ ok: true, backupBytes: fs.statSync(backupPath).size, teachingRecords: 1, errors }));
} catch (error) {
  console.error(JSON.stringify({ ok: false, error: error.message, errors }, null, 2));
  process.exitCode = 1;
} finally {
  if (backupPath) fs.rmSync(backupPath, { force: true });
  await browser.close();
}