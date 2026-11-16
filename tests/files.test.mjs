/**
 * js/files.js browser tests.
 *
 * Run:
 *   cd tests
 *   PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install
 *   PLAYWRIGHT_CHANNEL=msedge npm test
 *
 * On Windows the default channel is msedge (already installed on this machine).
 * On Linux/macOS install a Playwright browser and set PLAYWRIGHT_CHANNEL if needed.
 *
 * The test server is a tiny local static server; no file contents are uploaded.
 */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require("playwright"));
} catch (error) {
  console.error("缺少 Playwright。请在 tests/ 下执行：PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install");
  console.error(error.message);
  process.exit(2);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const FIXTURES = path.join(__dirname, "fixtures");
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".bcmap": "application/octet-stream"
};

function createServer() {
  const requests = [];
  const server = http.createServer(async (req, res) => {
    requests.push({ method: req.method, url: req.url });
    try {
      if (req.method !== "GET" && req.method !== "HEAD") {
        res.writeHead(405, { "Content-Type": "text/plain" });
        res.end("Only GET is supported in tests");
        return;
      }
      const url = new URL(req.url, "http://127.0.0.1");
      if (url.pathname === "/__test.html") {
        res.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store"
        });
        res.end("<!doctype html><html lang=\"zh-CN\"><meta charset=\"utf-8\"><title>files.test</title><body><p>files.js test page</p></body></html>");
        return;
      }
      if (url.pathname === "/__empty-ocr.js") {
        // Deliberately returns 200 but does not define window.Tesseract.
        res.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "no-store" });
        res.end("/* empty OCR runtime fixture; intentionally defines no Tesseract global */");
        return;
      }
      if (url.pathname === "/favicon.ico") {
        res.writeHead(200, { "Content-Type": "image/svg+xml", "Cache-Control": "no-store" });
        res.end('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" fill="#111"/></svg>');
        return;
      }
      const relative = decodeURIComponent(url.pathname).replace(/^\/+/, "");
      const absolute = path.resolve(ROOT, relative);
      if (!absolute.startsWith(ROOT + path.sep) || !fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Not found");
        return;
      }
      const ext = path.extname(absolute).toLowerCase();
      res.writeHead(200, {
        "Content-Type": MIME[ext] || "application/octet-stream",
        "Cache-Control": "no-store"
      });
      if (req.method === "HEAD") res.end();
      else fs.createReadStream(absolute).pipe(res);
    } catch (error) {
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(error.message);
    }
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({ server, requests, base: `http://127.0.0.1:${port}` });
    });
  });
}

function parseOptions(options = {}) {
  return {
    maxFileMB: 25,
    enableOCR: false,
    ...options
  };
}

async function inPage(page, payload) {
  return page.evaluate(async (input) => {
    const { parseFile } = await import("/js/files.js");
    let bytes;
    if (input.fixture) {
      const response = await fetch(input.fixture);
      if (!response.ok) return { ok: false, error: { code: "TEST_FIXTURE_MISSING", message: input.fixture } };
      bytes = await response.arrayBuffer();
    } else if (input.base64) {
      const binary = atob(input.base64);
      const array = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) array[index] = binary.charCodeAt(index);
      bytes = array.buffer;
    } else {
      bytes = new TextEncoder().encode(input.text ?? "");
    }
    const file = new File([bytes], input.name, { type: input.type || "" });
    const progress = [];
    try {
      const result = await parseFile(file, {
        ...(input.options || {}),
        onProgress: (event) => progress.push(event)
      });
      return { ok: true, result, progress };
    } catch (error) {
      return {
        ok: false,
        progress,
        error: {
          name: error?.name,
          code: error?.code,
          message: error?.message,
          details: error?.details
        }
      };
    }
  }, payload);
}

async function chunkTest(page) {
  return page.evaluate(async () => {
    const { chunkDocument } = await import("/js/files.js");
    const text = [
      "# 课程标题",
      "",
      "第一段内容。".repeat(70),
      "",
      "- 列表项甲",
      "- 列表项乙",
      "",
      "X".repeat(2500),
      "",
      "结束段落。"
    ].join("\n");
    const chunks = chunkDocument(text, { maxChars: 180, overlap: 24 });
    const exact = chunks.every((chunk) => chunk.text === text.slice(chunk.charStart, chunk.charEnd));
    const covered = new Uint8Array(text.length);
    for (const chunk of chunks) covered.fill(1, chunk.charStart, chunk.charEnd);
    const allCovered = covered.every((value) => value === 1);
    const tooLong = chunks.filter((chunk) => chunk.text.length > 180).map((chunk) => chunk.order);
    const ordered = chunks.every((chunk, index) => chunk.order === index);
    const overlapObserved = chunks.length > 1 && chunks[1].charStart < chunks[0].charEnd;
    const empty = chunkDocument("", { maxChars: 180, overlap: 24 });
    const tiny = chunkDocument("😀😀😀😀", { maxChars: 1, overlap: 0 });
    const tinyExact = tiny.every((chunk) => chunk.text === "😀😀😀😀".slice(chunk.charStart, chunk.charEnd));
    const sentenceText = "第一句。第二句！第三句？".repeat(25);
    const sentenceChunks = chunkDocument(sentenceText, { maxChars: 50, overlap: 8 });
    const sentenceEndsOnBoundary = sentenceChunks.every((chunk) => /[。！？!?\n]$/.test(chunk.text));
    const sentenceStartsOnBoundary = sentenceChunks.slice(1).every(
      (chunk) => /[。！？!?，,、：:\s]/.test(sentenceText[chunk.charStart - 1] || "")
    );
    return {
      textLength: text.length,
      chunkCount: chunks.length,
      stats: chunks.stats,
      exact,
      allCovered,
      tooLong,
      ordered,
      overlapObserved,
      emptyStats: empty.stats,
      tinyTexts: tiny.map((chunk) => chunk.text),
      tinyExact,
      sentenceEndsOnBoundary,
      sentenceStartsOnBoundary,
      firstText: chunks[0].text.slice(0, 40),
      lastEnd: chunks.at(-1)?.charEnd
    };
  });
}

const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}

test("chunkDocument: full coverage, overlap, boundaries, stats, empty and emoji", async ({ page }) => {
  const data = await chunkTest(page);
  assert.equal(data.textLength, data.stats.totalChars);
  assert.ok(data.chunkCount > 0);
  assert.equal(data.stats.chunkCount, data.chunkCount);
  assert.equal(data.stats.complete, true);
  assert.equal(data.stats.coveredChars, data.textLength);
  assert.equal(data.stats.coverageRatio, 1);
  assert.equal(data.firstText.startsWith("# 课程标题"), true);
  assert.equal(data.lastEnd, data.textLength);
  assert.equal(data.exact, true);
  assert.equal(data.allCovered, true);
  assert.deepEqual(data.tooLong, []);
  assert.equal(data.ordered, true);
  assert.equal(data.overlapObserved, true);
  assert.equal(data.stats.longestChunk <= 180, true);
  assert.equal(data.emptyStats.chunkCount, 0);
  assert.equal(data.emptyStats.complete, true);
  assert.equal(data.emptyStats.totalChars, 0);
  assert.equal(data.tinyExact, true);
  assert.deepEqual(data.tinyTexts, ["😀", "😀", "😀", "😀"]);
  assert.equal(data.sentenceEndsOnBoundary, true);
  assert.equal(data.sentenceStartsOnBoundary, true);
});

test("TXT: native text, title, blocks, progress and no vendor load", async ({ page }) => {
  const data = await inPage(page, {
    name: "教师备课本.txt",
    type: "text/plain",
    text: "控制线路检查\n\n第一段：断电、验电。\n\n第二段：填写记录。\n"
  });
  assert.equal(data.ok, true, data.error?.message);
  assert.equal(data.result.title, "控制线路检查");
  assert.equal(data.result.metadata.format, "txt");
  assert.equal(data.result.text.includes("第一段"), true);
  assert.ok(data.result.blocks.length >= 2);
  assert.equal(data.result.needsOCR, false);
  assert.deepEqual(data.result.pages, []);
  assert.equal(data.result.charCount, data.result.text.length);
  assert.ok(data.progress.some((event) => event.phase === "done"));
  assert.equal(data.progress.at(-1).progress, 1);
  const lazy = await page.evaluate(() => ({
    mammoth: typeof window.mammoth,
    xlsx: typeof window.XLSX,
    jszip: typeof window.JSZip,
    pdfjs: typeof window.pdfjsLib
  }));
  assert.deepEqual(lazy, { mammoth: "undefined", xlsx: "undefined", jszip: "undefined", pdfjs: "undefined" });
});

test("TXT: UTF-8 BOM 不会吞掉第一个汉字", async ({ page }) => {
  const base64 = Buffer.from("\uFEFF学生张伟，学号2023001。\n第二行。", "utf8").toString("base64");
  const data = await inPage(page, {
    name: "带BOM的听课记录.txt",
    type: "text/plain",
    base64
  });
  assert.equal(data.ok, true, data.error?.message);
  assert.equal(data.result.text.startsWith("学生张伟"), true, JSON.stringify(data.result.text.slice(0, 12)));
  assert.equal(data.result.text.includes("学号2023001"), true);
  assert.equal(data.result.charCount, data.result.text.length);
});

test("MD: heading hierarchy and title", async ({ page }) => {
  const data = await inPage(page, {
    name: "任务书.md",
    type: "text/markdown",
    text: "# 智能设备基础\n\n## 任务一：线路检查\n\n操作前断电。\n\n- 验电\n- 记录\n\n## 任务二：通电试车\n\n教师确认后通电。"
  });
  assert.equal(data.ok, true, data.error?.message);
  assert.equal(data.result.title, "智能设备基础");
  assert.deepEqual(
    data.result.blocks.filter((block) => block.type === "heading").map((block) => [block.level, block.text]),
    [[1, "智能设备基础"], [2, "任务一：线路检查"], [2, "任务二：通电试车"]]
  );
  assert.equal(data.result.metadata.headingCount, 3);
  assert.equal(data.result.text.includes("## 任务一"), true);
});

test("CSV: quotes, embedded newline, header and row text", async ({ page }) => {
  const data = await inPage(page, {
    name: "课程表.csv",
    type: "text/csv",
    text: '课程,模块,学时\n"电工,基础",安全用电,16\n"PLC\n调试",联机,8\n'
  });
  assert.equal(data.ok, true, data.error?.message);
  assert.equal(data.result.metadata.format, "csv");
  assert.equal(data.result.metadata.rowCount, 2);
  assert.equal(data.result.metadata.columnCount, 3);
  assert.equal(data.result.sheets.length, 0);
  assert.equal(data.result.blocks[0].type, "table");
  assert.equal(data.result.text.includes("电工,基础"), true);
  assert.equal(data.result.text.includes("PLC"), true);
  assert.equal(data.result.text.includes("调试"), true);
  assert.equal(data.result.title, "课程表");
});

test("JSON: parse tree, readable text and metadata", async ({ page }) => {
  const data = await inPage(page, {
    name: "course.json",
    type: "application/json",
    text: JSON.stringify({
      title: "智能设备基础",
      author: "匠备测试",
      modules: [{ name: "控制线路", hours: 4 }, { name: "PLC 调试", hours: 6 }],
      active: true
    }, null, 2)
  });
  assert.equal(data.ok, true, data.error?.message);
  assert.equal(data.result.title, "智能设备基础");
  assert.equal(data.result.metadata.rootType, "object");
  assert.equal(data.result.metadata.author, "匠备测试");
  assert.equal(data.result.text.includes('"modules"'), true);
  assert.equal(data.result.text.includes("控制线路"), true);
  assert.equal(data.result.blocks[0].type, "json");
});

test("JSON: syntax error has explicit PARSE_ERROR", async ({ page }) => {
  const data = await inPage(page, {
    name: "broken.json",
    type: "application/json",
    text: "{ not json "
  });
  assert.equal(data.ok, false);
  assert.equal(data.error.code, "PARSE_ERROR");
  assert.match(data.error.message, /JSON 语法无效/);
});

test("DOCX: mammoth paragraphs/table, core title, metadata and warnings", async ({ page }) => {
  const data = await inPage(page, {
    name: "sample.docx",
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    fixture: "/tests/fixtures/sample.docx"
  });
  assert.equal(data.ok, true, data.error?.message);
  assert.equal(data.result.metadata.format, "docx");
  assert.equal(data.result.title, "智能设备基础 · 文件解析测试");
  assert.equal(data.result.metadata.creator, "匠备测试");
  assert.equal(data.result.text.includes("任务一：控制线路检查"), true);
  assert.equal(data.result.text.includes("安全确认"), true);
  assert.equal(data.result.blocks.some((block) => block.type === "heading"), true);
  assert.equal(data.result.blocks.some((block) => block.type === "table"), true);
  assert.equal(data.result.needsOCR, false);
  assert.ok(data.progress.some((event) => event.phase === "dependency"));
});

test("XLSX: all sheets, headers, rows and workbook metadata", async ({ page }) => {
  const data = await inPage(page, {
    name: "sample.xlsx",
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    fixture: "/tests/fixtures/sample.xlsx"
  });
  assert.equal(data.ok, true, data.error?.message);
  assert.equal(data.result.metadata.format, "xlsx");
  assert.equal(data.result.title, "教学任务数据");
  assert.equal(data.result.metadata.Author, "匠备测试");
  assert.equal(data.result.sheets.length, 2);
  assert.deepEqual(data.result.sheets.map((sheet) => sheet.name), ["任务清单", "分组建议"]);
  assert.deepEqual(data.result.sheets[0].headers, ["序号", "任务名称", "建议学时"]);
  assert.equal(data.result.sheets[0].rowCount, 2);
  assert.equal(data.result.text.includes("PLC 联机调试"), true);
  assert.equal(data.result.needsOCR, false);
});

test("PPTX: slide order, text, title and core metadata", async ({ page }) => {
  const data = await inPage(page, {
    name: "sample.pptx",
    type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    fixture: "/tests/fixtures/sample.pptx"
  });
  assert.equal(data.ok, true, data.error?.message);
  assert.equal(data.result.metadata.format, "pptx");
  assert.equal(data.result.title, "智能设备基础课件");
  assert.equal(data.result.metadata.slideCount, 2);
  assert.deepEqual(data.result.slides.map((slide) => slide.number), [1, 2]);
  assert.equal(data.result.text.includes("智能设备基础"), true);
  assert.equal(data.result.text.includes("评价"), true);
  assert.equal(data.result.needsOCR, false);
});

test("PDF (text): per-page extraction, local worker and metadata", async ({ page }) => {
  const data = await inPage(page, {
    name: "sample-text.pdf",
    type: "application/pdf",
    fixture: "/tests/fixtures/sample-text.pdf"
  });
  assert.equal(data.ok, true, data.error?.message);
  assert.equal(data.result.metadata.format, "pdf");
  assert.equal(data.result.pages.length, 2);
  assert.equal(data.result.pages[0].number, 1);
  assert.equal(data.result.pages[1].number, 2);
  assert.equal(data.result.text.includes("PDF 文本抽取测试"), true);
  assert.equal(data.result.text.includes("JIANG_BEI_PDF_TEXT_OK"), true);
  assert.equal(data.result.needsOCR, false);
  assert.equal(data.result.metadata.pageCount, 2);
  assert.equal(data.result.title.includes("PDF 文本抽取测试"), true);
});

test("PDF (raster): needsOCR true and no fabricated text", async ({ page }) => {
  const data = await inPage(page, {
    name: "sample-raster.pdf",
    type: "application/pdf",
    fixture: "/tests/fixtures/sample-raster.pdf"
  });
  assert.equal(data.ok, true, data.error?.message);
  assert.equal(data.result.pages.length, 1);
  assert.equal(data.result.needsOCR, true);
  assert.equal(data.result.pages[0].needsOCR, true);
  assert.equal(data.result.pages[0].text, "");
  assert.equal(data.result.text, "## 第 1 页");
  assert.equal(data.result.warnings.some((warning) => warning.includes("未启用 OCR")), true);
});

test("OCR disabled by default; explicitly enabled OCR failure is clear", async ({ page }) => {
  const data = await inPage(page, {
    name: "sample-raster.pdf",
    type: "application/pdf",
    fixture: "/tests/fixtures/sample-raster.pdf",
    options: {
      enableOCR: true,
      ocrCdn: "/__empty-ocr.js",
      ocrMaxPages: 1
    }
  });
  assert.equal(data.ok, false, "OCR dependency failure must reject, not fabricate text");
  assert.equal(data.error.code, "OCR_UNAVAILABLE");
  assert.match(data.error.message, /OCR|Tesseract/);
  assert.equal(data.error.details.url, "/__empty-ocr.js");
  assert.ok(data.progress.some((event) => event.phase === "ocr"));
});

test("limits and unsupported type have explicit error codes", async ({ page }) => {
  const tooLarge = await inPage(page, {
    name: "big.txt",
    type: "text/plain",
    text: "中".repeat(2000),
    options: { maxFileMB: 0.0001 }
  });
  assert.equal(tooLarge.ok, false);
  assert.equal(tooLarge.error.code, "FILE_TOO_LARGE");

  const unsupported = await inPage(page, {
    name: "picture.png",
    type: "image/png",
    text: "not really a png"
  });
  assert.equal(unsupported.ok, false);
  assert.equal(unsupported.error.code, "UNSUPPORTED_TYPE");

  const badLimit = await inPage(page, {
    name: "small.txt",
    type: "text/plain",
    text: "hello",
    options: { maxFileMB: -1 }
  });
  assert.equal(badLimit.ok, false);
  assert.equal(badLimit.error.code, "INVALID_OPTION");
});

test("progress is monotonic for native, office and PDF formats", async ({ page }) => {
  const cases = [
    { name: "p.txt", type: "text/plain", text: "标题\n\n内容。" },
    { name: "p.md", type: "text/markdown", text: "# 标题\n\n内容。" },
    { name: "sample.xlsx", type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fixture: "/tests/fixtures/sample.xlsx" },
    { name: "sample-text.pdf", type: "application/pdf", fixture: "/tests/fixtures/sample-text.pdf" }
  ];
  for (const item of cases) {
    const data = await inPage(page, item);
    assert.equal(data.ok, true, `${item.name}: ${data.error?.message}`);
    const values = data.progress.map((event) => event.progress);
    assert.ok(values.length > 0, `${item.name}: no progress events`);
    for (let index = 1; index < values.length; index += 1) {
      assert.ok(values[index] >= values[index - 1], `${item.name}: progress should be monotonic (${values.join(", ")})`);
    }
    assert.equal(values.at(-1), 1, `${item.name}: final progress should be 1`);
  }
});

test("test server saw only local GET requests (no upload)", async ({ requests }) => {
  assert.ok(requests.length > 0);
  assert.equal(requests.every((request) => request.method === "GET" || request.method === "HEAD"), true);
  assert.equal(requests.some((request) => /upload|post|put/i.test(request.url)), false);
});

test("normal parsing loads no runtime CDN (all HTTP requests are same-origin)", async ({ pageRequests, base }) => {
  const expectedOrigin = new URL(base).origin;
  const httpRequests = pageRequests.filter((url) => /^https?:/i.test(url));
  assert.ok(httpRequests.length > 0);
  const external = httpRequests.filter((url) => new URL(url).origin !== expectedOrigin);
  assert.deepEqual(external, []);
});

async function run() {
  const { server, requests, base } = await createServer();
  const launchOptions = { headless: true };
  if (process.env.PLAYWRIGHT_CHANNEL) launchOptions.channel = process.env.PLAYWRIGHT_CHANNEL;
  else if (process.platform === "win32") launchOptions.channel = "msedge";
  const browser = await chromium.launch(launchOptions);
  const context = await browser.newContext({ viewport: { width: 1200, height: 900 }, locale: "zh-CN" });
  const page = await context.newPage();
  const pageErrors = [];
  const pageRequests = [];
  page.on("request", (request) => pageRequests.push(request.url()));
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") pageErrors.push(`console: ${message.text()}`);
  });
  await page.goto(`${base}/__test.html`, { waitUntil: "networkidle" });
  await page.waitForTimeout(100);

  let passed = 0;
  let failed = 0;
  const failures = [];
  for (const item of tests) {
    try {
      await item.fn({ page, requests, pageRequests, base });
      passed += 1;
      console.log(`PASS  ${item.name}`);
    } catch (error) {
      failed += 1;
      failures.push({ name: item.name, error });
      console.log(`FAIL  ${item.name}`);
      console.log(`      ${error.message}`);
    }
  }

  if (pageErrors.length) {
    failed += 1;
    console.log(`FAIL  page errors: ${pageErrors.join(" | ")}`);
  } else {
    passed += 1;
    console.log("PASS  no page errors");
  }

  console.log(`\nRESULT ${passed} passed, ${failed} failed`);
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
  if (failed) {
    console.error("\nFailures:");
    for (const failure of failures) console.error(`- ${failure.name}: ${failure.error.stack || failure.error.message}`);
    process.exitCode = 1;
  }
}

run().catch(async (error) => {
  console.error(error);
  process.exitCode = 1;
});