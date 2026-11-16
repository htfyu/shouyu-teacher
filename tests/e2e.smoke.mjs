/**
 * 授渔 V2 · 浏览器端冒烟回归
 *
 * 运行：
 *   npm --prefix tests install
 *   npm run test:e2e
 *
 * 可选环境变量：
 *   PLAYWRIGHT_CHANNEL=msedge|chrome|chromium（默认 msedge）
 *   E2E_PORT=5599
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch (error) {
    const candidates = [
      process.env.PLAYWRIGHT_MODULE,
      path.join(ROOT, "tests", "node_modules", "playwright", "index.js"),
      path.join(ROOT, "node_modules", "playwright", "index.js")
    ].filter(Boolean);
    for (const candidate of candidates) {
      if (!fs.existsSync(candidate)) continue;
      return import(pathToFileURL(candidate).href);
    }
    throw new Error("未找到 Playwright。请运行 npm --prefix tests install，或设置 PLAYWRIGHT_MODULE 指向 playwright/index.js");
  }
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.E2E_PORT || 5599);
const CHANNEL = process.env.PLAYWRIGHT_CHANNEL || "msedge";
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
  ".wasm": "application/wasm",
  ".bcmap": "application/octet-stream",
  ".ttf": "font/ttf",
  ".woff2": "font/woff2"
};

function startServer() {
  const server = http.createServer((req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
      const requested = pathname === "/" ? "/index.html" : pathname;
      const resolved = path.resolve(ROOT, `.${requested}`);
      if (!resolved.startsWith(ROOT)) {
        res.writeHead(403);
        res.end("Forbidden");
        return;
      }
      if (!fs.existsSync(resolved) || fs.statSync(resolved).isDirectory()) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      res.writeHead(200, {
        "Content-Type": MIME[path.extname(resolved).toLowerCase()] || "application/octet-stream",
        "Cache-Control": "no-store"
      });
      fs.createReadStream(resolved).pipe(res);
    } catch (error) {
      res.writeHead(500);
      res.end("Server error");
    }
  });
  return new Promise((resolve) => server.listen(PORT, "127.0.0.1", () => resolve(server)));
}

const results = [];
function check(name, condition, detail = "") {
  results.push({ name, ok: Boolean(condition), detail });
  if (!condition) throw new Error(`${name}${detail ? `：${detail}` : ""}`);
}

async function main() {
  const playwrightModule = await loadPlaywright();
  const chromium = playwrightModule.chromium || playwrightModule.default?.chromium;
  if (!chromium) throw new Error("Playwright 已加载，但没有 chromium 启动入口");
  const server = await startServer();
  let browser;
  try {
    browser = await chromium.launch({ channel: CHANNEL, headless: true });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      locale: "zh-CN",
      acceptDownloads: true
    });
    const page = await context.newPage();
    const errors = [];
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
    const base = `http://127.0.0.1:${PORT}/`;
    await page.goto(base, { waitUntil: "networkidle" });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(350);
    check("首页启动", await page.locator(".hero-title").count() === 1);
    check("品牌名称", (await page.locator(".brand-name").innerText()) === "授渔");
    check("品牌标识加载", await page.locator(".brand-mark img").evaluate((img) => img.complete && img.naturalWidth > 0));
    check("favicon 已切换", await page.evaluate(() => document.querySelector('link[rel="icon"]')?.getAttribute("href") === "./assets/brand/favicon-64.png"));
    check("首页已精简", await page.locator(".home-top, .hero-eyebrow, .scope-note, .section-kicker").count() === 0);
    check("五个场景入口", await page.locator(".scene-card").count() === 5);
    check("侧栏导航", await page.locator(".nav-item").count() >= 7);
    await page.locator(".sidebar-collapse").click();
    await page.waitForTimeout(250);
    check("侧栏可折叠", (await page.locator(".sidebar").evaluate((el) => el.getBoundingClientRect().width)) < 100);
    await page.locator(".sidebar-collapse").click();
    await page.waitForTimeout(250);
    check("侧栏可展开", (await page.locator(".sidebar").evaluate((el) => el.getBoundingClientRect().width)) > 200);
    check("知识库统计 ≥33 份", Number(await page.locator(".nav-item[data-path='/kb'] .nav-count").textContent()) >= 33);

    for (const route of ["kb", "files", "templates", "history", "settings", "guide"]) {
      await page.goto(`${base}#/${route}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(180);
      check(`页面 ${route}`, Boolean(await page.locator(".page-title").count()));
    }

    await page.goto(`${base}#/templates`, { waitUntil: "networkidle" });
    await page.waitForTimeout(200);
    check("模板视觉标识", await page.locator(".template-glyph").count() >= 3);

    await page.goto(base, { waitUntil: "networkidle" });
    await page.waitForTimeout(200);
    await page.locator('.scene-card[data-scene="lesson"]').click();
    await page.getByRole("button", { name: "载入示例" }).click();
    await page.locator('#task-form button[type="submit"]').click();
    await page.waitForTimeout(3200);
    check("本地生成结果", await page.locator(".result-card").count() === 1);
    check("结果含来源", await page.locator(".markdown-sources .source-chip, .context-rail .source-card").count() > 0);

    await page.getByRole("button", { name: "编辑成果" }).click();
    await page.waitForTimeout(350);
    check("编辑器打开", await page.locator(".modal.is-editor").count() === 1);
    await page.locator("#editor-doc-title").fill("E2E 保存标题");
    await page.waitForTimeout(850);
    await page.getByRole("button", { name: "完成并返回" }).click();
    await page.waitForTimeout(450);
    check("编辑器自动保存", (await page.locator(".result-title").first().textContent()).includes("E2E 保存标题"));

    const docxPromise = page.waitForEvent("download", { timeout: 40000 });
    await page.getByRole("button", { name: "导出 DOCX" }).click();
    const docx = await docxPromise;
    check("DOCX 下载", docx.suggestedFilename().endsWith(".docx"));
    const xlsxPromise = page.waitForEvent("download", { timeout: 40000 });
    await page.getByRole("button", { name: "导出 Excel" }).click();
    const xlsx = await xlsxPromise;
    check("XLSX 下载", xlsx.suggestedFilename().endsWith(".xlsx"));

    await page.goto(`${base}#/files`, { waitUntil: "networkidle" });
    await page.waitForTimeout(300);
    check("资料上传分栏", await page.locator(".file-layout .file-upload-panel").count() === 1);
    check("资料侧栏说明", await page.locator(".file-aside .aside-card").count() >= 3);
    await page.locator('[data-role="file-center-input"]').setInputFiles(path.join(ROOT, "tests/fixtures/sample.docx"));
    await page.waitForTimeout(1400);
    check("DOCX 本机解析", await page.locator(".file-row").count() >= 1);
    check("文件隐私/上传说明", (await page.locator(".upload-privacy").innerText()).includes("本机"));

    await page.goto(`${base}#/history`, { waitUntil: "networkidle" });
    await page.waitForTimeout(300);
    check("历史记录存在", await page.locator(".history-card").count() >= 1);
    check("历史分类", await page.locator(".history-categories .filter-btn").count() >= 1);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(base, { waitUntil: "networkidle" });
    await page.waitForTimeout(300);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check("移动端无横向溢出", overflow === 0, `overflow=${overflow}`);
    await page.locator(".mobile-menu").click();
    await page.waitForTimeout(250);
    check("移动端侧栏可打开", await page.locator(".sidebar").evaluate((el) => getComputedStyle(el).transform !== "none" || getComputedStyle(el).visibility !== "hidden"));

    check("无控制台错误", errors.length === 0, errors.slice(0, 3).join(" / "));
    console.log(JSON.stringify({ ok: true, passed: results.length, results, errors }, null, 2));
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, passed: results.filter((item) => item.ok).length, results, error: error.message }, null, 2));
  process.exitCode = 1;
});