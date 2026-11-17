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
    check("核心导航四项", await page.locator(".side-nav:not(.side-nav-more) .nav-item").count() === 4);
    check("更多功能入口", await page.locator('[data-action="toggle-nav-more"]').count() === 1);
    await page.locator('[data-action="toggle-nav-more"]').click();
    await page.waitForTimeout(200);
    check("更多功能可展开", await page.locator(".side-nav-more").count() === 1);
    check("专业数据库入口", await page.locator(".nav-item[data-path='/programs']").count() === 1);
    await page.locator(".sidebar-collapse").click();
    await page.waitForTimeout(250);
    check("侧栏可折叠", (await page.locator(".sidebar").evaluate((el) => el.getBoundingClientRect().width)) < 100);
    await page.locator(".sidebar-collapse").click();
    await page.waitForTimeout(250);
    check("侧栏可展开", (await page.locator(".sidebar").evaluate((el) => el.getBoundingClientRect().width)) > 200);
    check("知识库统计 ≥33 份", Number(await page.locator(".nav-item[data-path='/kb'] .nav-count").textContent()) >= 33);
    await page.locator(".new-chat").click();
    await page.waitForTimeout(350);
    check("开始备课进入第 1 步", (await page.locator(".studio-step.is-current").innerText()).includes("选专业课程"));
    check("新建备课不预选 PLC", await page.locator(".studio-picked-course").count() === 0);
    await page.goto(base, { waitUntil: "networkidle" });
    await page.waitForTimeout(250);

    for (const route of ["kb", "files", "templates", "history", "settings", "guide"]) {
      await page.goto(`${base}#/${route}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(180);
      check(`页面 ${route}`, Boolean(await page.locator(".page-title").count()));
    }

    await page.goto(`${base}#/templates`, { waitUntil: "networkidle" });
    await page.waitForTimeout(200);
    check("模板视觉标识", await page.locator(".template-glyph").count() >= 3);

    await page.goto(`${base}#/programs`, { waitUntil: "networkidle" });
    await page.waitForTimeout(350);
    check("专业数据库页面", (await page.locator(".page-title").innerText()).includes("专业与课程"));
    check("专业统计四项", await page.locator(".page-stats .stat").count() === 4);
    check("专业系卡片六个", await page.locator(".programs-dept-card").count() === 6);
    check("原始数据表可下载", await page.locator('a[href*="gzgj-professional-system.xlsx"]').count() >= 1);
    await page.locator(".programs-dept-card").first().click();
    await page.waitForTimeout(250);
    check("专业组层级", await page.locator(".programs-group-card").count() >= 2);
    await page.locator(".programs-group-card").first().click();
    await page.waitForTimeout(250);
    check("专业层级", await page.locator(".programs-major-card").count() >= 1);
    await page.locator(".programs-major-card").first().click();
    await page.waitForTimeout(250);
    check("课程层级", await page.locator(".programs-course-card").count() >= 1);
    await page.locator('[data-role="program-search"]').fill("电工技术");
    await page.waitForTimeout(350);
    check("专业库关键词检索", await page.locator(".programs-course-card").count() >= 1);
    await page.locator(".programs-course-card").first().click();
    await page.waitForTimeout(350);
    check("课程资源十个模块", await page.locator(".programs-resource-section").count() === 10);
    check("课程资源含来源", await page.locator(".modal .programs-source").count() >= 1);
    await page.locator(".modal-close").click();
    await page.waitForTimeout(200);

    await page.goto(`${base}#/courses`, { waitUntil: "networkidle" });
    await page.waitForTimeout(350);
    check("我的课程页", (await page.locator(".page-title").innerText()).includes("我的课程"));
    check("完整知识包课程", await page.locator(".course-row.is-complete").count() === 3);
    await page.locator(".course-row.is-complete").first().click();
    await page.waitForTimeout(350);
    check("课程工作空间", await page.locator(".course-tabs button").count() === 6);
    await page.locator('.work-context-actions [data-action="course-start-prep"]').click();
    await page.waitForTimeout(350);
    check("课程上下文进入备课", (await page.locator(".studio-step.is-current").innerText()).includes("定章节任务"));
    await page.locator('[data-action="studio-wizard-next"]').click();
    await page.waitForTimeout(250);
    await page.locator('[data-action="studio-wizard-next"]').click();
    await page.waitForTimeout(250);
    await page.locator('[data-action="studio-wizard-generate"]').click();
    await page.waitForTimeout(1500);
    check("生成 10 类资源", await page.locator(".studio-doc-tab").count() === 10);
    check("项目工作区", await page.locator(".studio-project").count() === 1);
    check("资源包质检得分", Number(await page.locator(".studio-score strong").innerText()) > 0);
    check("质检维度 10 项", await page.locator(".studio-quality-bar").count() === 10);
    await page.goto(`${base}#/quality`, { waitUntil: "networkidle" });
    await page.waitForTimeout(300);
    check("质量检测中心报告", await page.locator(".quality-report-card").count() >= 1);
    await page.goto(`${base}#/portfolio`, { waitUntil: "networkidle" });
    await page.waitForTimeout(300);
    check("成果管理中心", await page.locator(".portfolio-card").count() >= 1);
    await page.goto(`${base}#/graph`, { waitUntil: "networkidle" });
    await page.waitForTimeout(300);
    check("知识图谱节点", await page.locator(".graph-node").count() >= 20);
    await page.goto(`${base}#/demo`, { waitUntil: "networkidle" });
    await page.waitForTimeout(250);
    check("竞赛演示步骤", await page.locator(".demo-step").count() >= 5);
    await page.locator('[data-action="demo-start"]').click();
    await page.waitForTimeout(1700);
    check("演示一键生成", await page.locator(".studio-result").count() === 1);
    check("演示三层质检", await page.locator(".studio-quality-layers").count() === 1);
    await page.goto(`${base}#/demo`, { waitUntil: "networkidle" });
    await page.waitForTimeout(250);
    check("演示状态可恢复", (await page.locator(".demo-run-status").innerText()).includes("上次运行成功"));

    await page.goto(`${base}#/impact`, { waitUntil: "networkidle" });
    await page.waitForTimeout(300);
    check("应用成效未采集态", (await page.locator(".impact-empty").innerText()).includes("还没有真实应用数据"));
    await page.locator('[data-action="impact-add"]').first().click();
    await page.waitForTimeout(250);
    await page.locator("#impact-alias").fill("E2E-教师A");
    await page.locator("#impact-course").fill("PLC技术及应用");
    await page.locator("#impact-baseline").fill("240");
    await page.locator("#impact-assisted").fill("90");
    await page.locator("#impact-resources").fill("10");
    await page.locator("#impact-manual").fill("30");
    await page.locator("#impact-rating").fill("4");
    await page.locator('input[name="isRealData"]').check();
    await page.locator('button[form="impact-form"]').click();
    await page.waitForTimeout(700);
    check("真实成效记录", await page.locator(".impact-record").count() === 1);
    check("成效对比图", await page.locator(".impact-bars").count() === 1);

    // Full backup + clear + restore replay: verify studio and impact survive.
    fs.mkdirSync(path.join(ROOT, "资料"), { recursive: true });
    const backupFile = path.join(ROOT, "资料", "e2e-restore.json");
    await page.goto(`${base}#/settings`, { waitUntil: "networkidle" });
    await page.waitForTimeout(300);
    const backupDownload = page.waitForEvent("download");
    await page.locator('[data-action="export-backup"]').click();
    await (await backupDownload).saveAs(backupFile);
    check("完整备份包含成果与应用成效", fs.readFileSync(backupFile, "utf8").includes("impact") && fs.readFileSync(backupFile, "utf8").includes("studio"));
    await page.locator('[data-action="clear-local-data"]').click();
    await page.waitForTimeout(250);
    await page.locator('[data-action="confirm-clear-data"]').click();
    await page.waitForTimeout(1400);
    await page.goto(`${base}#/settings`, { waitUntil: "networkidle" });
    await page.waitForTimeout(350);
    await page.locator('[data-role="backup-file"]').setInputFiles(backupFile);
    await page.waitForTimeout(450);
    await page.locator('[data-action="confirm-restore"]').click();
    await page.waitForTimeout(1800);
    await page.goto(`${base}#/portfolio`, { waitUntil: "networkidle" });
    await page.waitForTimeout(350);
    check("备份恢复成果库", await page.locator(".portfolio-card").count() >= 1);
    await page.goto(`${base}#/impact`, { waitUntil: "networkidle" });
    await page.waitForTimeout(350);
    check("备份恢复应用成效", await page.locator(".impact-record").count() >= 1);

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
    await page.goto(`${base}#/programs`, { waitUntil: "networkidle" });
    await page.waitForTimeout(300);
    check("移动端专业库无横向溢出", await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth) === 0);
    check("移动端专业库筛选", await page.locator(".programs-mobile-filters").isVisible());
    await page.goto(`${base}#/studio`, { waitUntil: "networkidle" });
    await page.waitForTimeout(300);
    check("移动端智能备课无横向溢出", await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth) === 0);
    check("移动端备课工作室", await page.locator(".studio-project").count() === 1);
    check("移动端文档编辑区", await page.locator(".studio-doc-main").isVisible());
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