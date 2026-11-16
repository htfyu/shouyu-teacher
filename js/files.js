/**
 * 授渔 V2 · 浏览器端多格式文件解析模块
 *
 * 设计原则：
 * - 纯前端、无后端；文件内容不离开浏览器，解析库按需加载。
 * - 所有解析结果只存在于内存，不写入 DOM；长文由调用方使用 chunkDocument() 分块。
 * - 依赖失败、格式不支持、OCR 不可用等均抛出带 code 的 FileParseError，不伪造内容。
 *
 * 对外 API：
 *   parseFile(file, { onProgress, maxFileMB, enableOCR, ...advanced }) -> Promise<ParseResult>
 *   chunkDocument(text, { maxChars, overlap, idPrefix }) -> Array<Chunk> & { stats }
 *   FileParseError
 *
 * 说明：本模块为浏览器 ES Module，不支持在 Node 中直接解析二进制格式；
 * 测试通过 Playwright 在真实浏览器中执行。
 */

export const PARSER_VERSION = "2.0.0";
export const DEFAULT_MAX_FILE_MB = 25;
export const DEFAULT_MAX_CHARS = 1000;
export const DEFAULT_CHUNK_OVERLAP = 120;
export const DEFAULT_OCR_LANG = "chi_sim+eng";
export const DEFAULT_OCR_MAX_PAGES = 3;

export const VENDOR_VERSIONS = Object.freeze({
  mammoth: "1.13.0",
  "pdfjs-dist": "3.11.174",
  xlsx: "0.18.5",
  jszip: "3.10.2",
  "tesseract.js": "5.1.1 (CDN, lazy)"
});

export const OCR_CDN = Object.freeze({
  version: "5.1.1",
  scriptUrl: "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js",
  license: "Apache-2.0"
});

export const SUPPORTED_EXTENSIONS = Object.freeze([
  "txt", "md", "markdown", "csv", "json", "docx", "pdf", "xlsx", "pptx"
]);

const VENDOR_BASE = new URL("../assets/vendor/", import.meta.url);

const MIME_BY_EXT = Object.freeze({
  txt: "text/plain",
  md: "text/markdown",
  markdown: "text/markdown",
  csv: "text/csv",
  json: "application/json",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation"
});

const TEXT_FORMATS = new Set(["txt", "md", "markdown", "csv", "json"]);
const XML_NS = Object.freeze({
  cp: "http://schemas.openxmlformats.org/package/2006/metadata/core-properties",
  dc: "http://purl.org/dc/elements/1.1/",
  dcterms: "http://purl.org/dc/terms/",
  drawingml: "http://schemas.openxmlformats.org/drawingml/2006/main"
});

/**
 * 带机器可读 code 的解析错误。
 */
export class FileParseError extends Error {
  /**
   * @param {string} code
   * @param {string} message 面向用户的中文说明
   * @param {{format?: string, fileName?: string, library?: string, url?: string, cause?: unknown, partial?: unknown}} [details]
   */
  constructor(code, message, details = {}) {
    super(message);
    this.name = "FileParseError";
    this.code = code;
    this.details = details;
  }
}

const dependencyPromises = new Map();

/* ==========================================================
   Small helpers
   ========================================================== */

function emitProgress(onProgress, payload) {
  if (typeof onProgress !== "function") return;
  try {
    const progress = Number.isFinite(payload.progress)
      ? Math.max(0, Math.min(1, payload.progress))
      : 0;
    onProgress({ ...payload, progress });
  } catch (error) {
    // A reporting callback must never break parsing.
    console.warn("文件解析进度回调抛出异常，已忽略。", error);
  }
}

function extensionOf(name = "") {
  const matched = String(name).toLowerCase().match(/\.([a-z0-9]+)$/);
  return matched ? matched[1] : "";
}

function resolveFormat(file) {
  const ext = extensionOf(file?.name || "");
  if (SUPPORTED_EXTENSIONS.includes(ext)) return ext === "markdown" ? "md" : ext;
  const mime = String(file?.type || "").toLowerCase().split(";")[0].trim();
  const byMime = Object.entries(MIME_BY_EXT).find(([, type]) => type === mime)?.[0];
  if (byMime) return byMime === "markdown" ? "md" : byMime;
  return ext;
}

function resolveMime(format, fileMime) {
  const normalized = String(fileMime || "").split(";")[0].trim().toLowerCase();
  if (normalized && normalized !== "application/octet-stream" && normalized.includes("/")) {
    return normalized;
  }
  return MIME_BY_EXT[format] || "application/octet-stream";
}

function baseName(name = "") {
  return String(name).replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
}

function firstNonEmptyLine(text = "", maxLength = 160) {
  for (const line of String(text).split(/\r?\n/)) {
    const cleaned = line
      .replace(/^\s{0,3}#{1,6}\s+/, "")
      .replace(/^\s{0,3}>\s?/, "")
      .replace(/^\s*[-*+]\s+/, "")
      .trim();
    if (cleaned) return cleaned.slice(0, maxLength);
  }
  return "";
}

function stripMarkdownInline(text = "") {
  return String(text)
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_~`]{1,3}/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeNewlines(text = "") {
  return String(text).replace(/\r\n?/g, "\n");
}

function normalizeWhitespace(text = "") {
  return String(text).replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").trim();
}

function usableTitle(value) {
  if (typeof value !== "string") return "";
  const title = value.replace(/\s+/g, " ").trim();
  if (!title) return "";
  if (/^(about:blank|untitled|无标题|未命名|microsoft word|powerpoint presentation|document\d*)$/i.test(title)) return "";
  return title.slice(0, 300);
}

function uniqueStrings(values = []) {
  const seen = new Set();
  const output = [];
  values.forEach((value) => {
    const text = String(value ?? "").trim();
    if (text && !seen.has(text)) {
      seen.add(text);
      output.push(text);
    }
  });
  return output;
}

function normalizeCell(value) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value).replace(/\r\n?/g, "\n").trim();
}

function padRow(row = [], width = 0) {
  const cells = Array.from({ length: width }, (_, index) => normalizeCell(row[index]));
  return cells;
}

function rowIsEmpty(row = []) {
  return !row.some((cell) => String(cell ?? "").trim());
}

function trimTrailingEmptyRows(rows = []) {
  const copy = rows.slice();
  while (copy.length && rowIsEmpty(copy[copy.length - 1])) copy.pop();
  return copy;
}

function decodeTextBuffer(buffer) {
  const bytes = new Uint8Array(buffer);
  const warnings = [];
  if (!bytes.length) return { text: "", warnings };

  const decoder = (encoding, fatal = false, ignoreBOM = false) => {
    try {
      // TextDecoder strips a leading BOM by default; when we explicitly check
      // BOM bytes we keep it in the output and slice exactly one code point.
      return new TextDecoder(encoding, { fatal, ignoreBOM }).decode(bytes);
    } catch (error) {
      return null;
    }
  };

  // BOM 优先，避免把 UTF-16 当作 UTF-8 读取。
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return { text: normalizeNewlines(decoder("utf-8", false, true)?.slice(1) || ""), warnings };
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return { text: normalizeNewlines(decoder("utf-16le", false, true)?.slice(1) || ""), warnings };
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    const decoded = decoder("utf-16be", false, true);
    if (decoded) return { text: normalizeNewlines(decoded.slice(1)), warnings };
  }

  const strictUtf8 = decoder("utf-8", true);
  if (strictUtf8 !== null) return { text: normalizeNewlines(strictUtf8), warnings };

  // 很多学校老文件仍是 GBK/GB18030；浏览器原生 TextDecoder 支持时回退。
  const gb = decoder("gb18030", false);
  if (gb !== null) {
    warnings.push("文件不是严格 UTF-8，已按 GB18030 兼容解码；请核对生僻字与特殊符号。");
    return { text: normalizeNewlines(gb), warnings };
  }

  const lenient = decoder("utf-8", false) || "";
  warnings.push("文件编码无法确定，已使用宽松 UTF-8 解码；可能出现替换字符。");
  return { text: normalizeNewlines(lenient), warnings };
}

/* ==========================================================
   Dependency loaders (all local except explicitly opted-in OCR)
   ========================================================== */

function validateBrowserEnvironment(library) {
  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new FileParseError(
      "DEPENDENCY_UNAVAILABLE",
      `解析 ${library} 需要浏览器环境。请不要在 Node 中直接调用 parseFile()，请用 Playwright。`,
      { library }
    );
  }
}

function vendorUrl(relativePath) {
  return new URL(relativePath, VENDOR_BASE).href;
}

function loadScript(url, { timeoutMs = 20000, library = "", crossOrigin = false } = {}) {
  validateBrowserEnvironment(library || "脚本");
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    let settled = false;
    const timer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      script.remove();
      reject(new FileParseError(
        "DEPENDENCY_UNAVAILABLE",
        `${library || "解析依赖"}加载超时（${Math.round(timeoutMs / 1000)} 秒）。请检查本地 vendor 文件或网络。`,
        { library, url }
      ));
    }, timeoutMs);

    script.src = url;
    script.async = true;
    if (crossOrigin) script.crossOrigin = "anonymous";
    script.onload = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve();
    };
    script.onerror = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      script.remove();
      reject(new FileParseError(
        "DEPENDENCY_UNAVAILABLE",
        `${library || "解析依赖"}加载失败。请确认 ${url} 可访问。`,
        { library, url }
      ));
    };
    document.head.appendChild(script);
  });
}

async function loadUmdDependency({ key, globalName, relativePath, timeoutMs = 20000 }) {
  if (dependencyPromises.has(key)) return dependencyPromises.get(key);
  const url = vendorUrl(relativePath);
  const promise = (async () => {
    // Do not trust an arbitrary pre-existing global from the host page; load our pinned local build.
    await loadScript(url, { library: globalName, timeoutMs });
    const library = window[globalName];
    if (!library) {
      throw new FileParseError(
        "DEPENDENCY_UNAVAILABLE",
        `${globalName} 已下载但未正确初始化。`,
        { library: globalName, url }
      );
    }
    return library;
  })();
  dependencyPromises.set(key, promise);
  try {
    return await promise;
  } catch (error) {
    dependencyPromises.delete(key);
    throw error;
  }
}

async function loadMammoth() {
  return loadUmdDependency({
    key: "mammoth",
    globalName: "mammoth",
    relativePath: "mammoth/mammoth.browser.min.js"
  });
}

async function loadJSZip() {
  return loadUmdDependency({
    key: "jszip",
    globalName: "JSZip",
    relativePath: "jszip/jszip.min.js"
  });
}

async function loadXLSX() {
  return loadUmdDependency({
    key: "xlsx",
    globalName: "XLSX",
    relativePath: "xlsx/xlsx.full.min.js"
  });
}

async function loadPdfJs() {
  const library = await loadUmdDependency({
    key: "pdfjs",
    globalName: "pdfjsLib",
    relativePath: "pdfjs/pdf.min.js",
    timeoutMs: 25000
  });
  const workerUrl = vendorUrl("pdfjs/pdf.worker.min.js");
  if (library.GlobalWorkerOptions) library.GlobalWorkerOptions.workerSrc = workerUrl;
  return library;
}

async function loadTesseract({ scriptUrl = OCR_CDN.scriptUrl, timeoutMs = 60000 } = {}) {
  if (dependencyPromises.has(`tesseract:${scriptUrl}`)) {
    return dependencyPromises.get(`tesseract:${scriptUrl}`);
  }
  const promise = (async () => {
    validateBrowserEnvironment("Tesseract.js");
    // enableOCR=true is the explicit consent to fetch this optional CDN runtime.
    await loadScript(scriptUrl, {
      library: "Tesseract.js OCR（CDN）",
      timeoutMs,
      crossOrigin: true
    });
    const Tesseract = window.Tesseract;
    if (!Tesseract || typeof Tesseract.recognize !== "function") {
      throw new FileParseError(
        "OCR_UNAVAILABLE",
        "Tesseract.js 已下载，但 OCR API 初始化失败。",
        { library: "tesseract.js", url: scriptUrl }
      );
    }
    return Tesseract;
  })();
  dependencyPromises.set(`tesseract:${scriptUrl}`, promise);
  try {
    return await promise;
  } catch (error) {
    dependencyPromises.delete(`tesseract:${scriptUrl}`);
    throw error;
  }
}

/* ==========================================================
   chunkDocument()
   ========================================================== */

function isHighSurrogate(code) {
  return code >= 0xd800 && code <= 0xdbff;
}

function isLowSurrogate(code) {
  return code >= 0xdc00 && code <= 0xdfff;
}

function safeCodeUnitBoundary(text, index) {
  if (index <= 0) return 0;
  if (index >= text.length) return text.length;
  if (isLowSurrogate(text.charCodeAt(index)) && isHighSurrogate(text.charCodeAt(index - 1))) {
    return index - 1;
  }
  return index;
}

function lastBoundaryEnd(windowText, regex, minimumEnd) {
  regex.lastIndex = 0;
  let match;
  let end = 0;
  while ((match = regex.exec(windowText)) !== null) {
    const candidate = match.index + match[0].length;
    if (candidate >= minimumEnd) end = candidate;
    if (match[0].length === 0) regex.lastIndex += 1;
  }
  return end;
}

function chooseBoundaryEnd(text, start, hardEnd) {
  if (hardEnd >= text.length) return text.length;
  const windowText = text.slice(start, hardEnd);
  const minimumEnd = Math.max(1, Math.floor(windowText.length * 0.55));

  // 优先级：段落 > 标题/行 > 句末 > 分句 > 空白 > 硬切。
  const tierRegexes = [
    /\n[ \t]*\n+/g,
    /\n/g,
    /[。！？!?；;]+|[.!?](?=\s|$)/g,
    /[，,、：:]+/g,
    /\s+/g
  ];
  for (const regex of tierRegexes) {
    const end = lastBoundaryEnd(windowText, regex, minimumEnd);
    if (end > 0) return safeCodeUnitBoundary(text, start + end);
  }
  return safeCodeUnitBoundary(text, hardEnd);
}

function chooseOverlapStart(text, start, end, overlap) {
  if (!overlap || overlap <= 0) return end;
  let candidate = Math.max(start + 1, end - overlap);
  candidate = safeCodeUnitBoundary(text, candidate);
  if (candidate >= end) return end;

  // Snap to the next natural boundary inside the overlap region when possible.
  for (let index = candidate; index < end; index += 1) {
    const previous = text[index - 1];
    if (previous === "\n" || /[。！？!?；;，,、：:]/.test(previous || "") || /\s/.test(previous || "")) {
      let next = index;
      while (next < end && /\s/.test(text[next] || "")) next += 1;
      if (next > start && next < end) return next;
    }
  }
  return candidate > start && candidate < end ? candidate : end;
}

/**
 * 将长文本切分为不丢字的块。
 *
 * - 优先在标题 / 段落 / 换行 / 句末 / 分句 / 空白处断开；
 * - 单个不可断长串（例如无标点的连续中文或 base64）会按字符硬切，但所有字符仍保留；
 * - chunks[i].text === 原文本.slice(charStart, charEnd)；
 * - 返回值是数组，并带 stats 属性，便于调用方直接展示完整字符统计。
 *
 * @param {string} text
 * @param {{maxChars?: number, overlap?: number, idPrefix?: string}} [options]
 * @returns {Array<{id:string,text:string,order:number,charStart:number,charEnd:number}> & {stats: object}}
 */
export function chunkDocument(text, options = {}) {
  const source = String(text ?? "");
  const maxChars = options.maxChars == null ? DEFAULT_MAX_CHARS : Number(options.maxChars);
  const overlap = options.overlap == null ? DEFAULT_CHUNK_OVERLAP : Number(options.overlap);
  const idPrefix = String(options.idPrefix || "chunk").replace(/[^a-zA-Z0-9_-]/g, "-") || "chunk";

  if (!Number.isInteger(maxChars) || maxChars < 1) {
    throw new RangeError("maxChars 必须是大于 0 的整数");
  }
  if (!Number.isInteger(overlap) || overlap < 0 || overlap >= maxChars) {
    throw new RangeError("overlap 必须是大于等于 0 且小于 maxChars 的整数");
  }

  const chunks = [];
  let start = 0;
  let guard = 0;
  const guardLimit = Math.max(100, source.length * 2 + 10);

  while (start < source.length && guard < guardLimit) {
    guard += 1;
    const hardEnd = Math.min(source.length, start + maxChars);
    let end = hardEnd >= source.length ? source.length : chooseBoundaryEnd(source, start, hardEnd);
    end = safeCodeUnitBoundary(source, end);
    if (end <= start) {
      let fallbackEnd = Math.min(source.length, start + maxChars);
      if (fallbackEnd < source.length
        && isLowSurrogate(source.charCodeAt(fallbackEnd))
        && isHighSurrogate(source.charCodeAt(fallbackEnd - 1))) {
        fallbackEnd += 1;
      }
      end = safeCodeUnitBoundary(source, fallbackEnd);
    }
    if (end <= start) end = Math.min(source.length, start + 1);

    chunks.push({
      id: `${idPrefix}-${String(chunks.length + 1).padStart(4, "0")}`,
      text: source.slice(start, end),
      order: chunks.length,
      charStart: start,
      charEnd: end
    });

    if (end >= source.length) break;
    start = chooseOverlapStart(source, start, end, overlap);
    if (start <= chunks[chunks.length - 1].charStart) start = end;
  }

  if (guard >= guardLimit && start < source.length) {
    throw new Error("chunkDocument 未能完整覆盖文本，请检查组块参数");
  }

  const totalChars = source.length;
  const coveredRanges = chunks.map((chunk) => [chunk.charStart, chunk.charEnd]);
  let coveredChars = 0;
  let cursor = 0;
  for (const [rangeStart, rangeEnd] of coveredRanges) {
    if (rangeStart > cursor) break;
    if (rangeEnd > cursor) {
      coveredChars += rangeEnd - cursor;
      cursor = rangeEnd;
    }
  }
  const complete = totalChars === 0
    ? chunks.length === 0
    : chunks.length > 0 && chunks[0].charStart === 0 && cursor === totalChars;
  const sizes = chunks.map((chunk) => chunk.text.length);
  const sumChars = sizes.reduce((sum, size) => sum + size, 0);
  const stats = Object.freeze({
    totalChars,
    totalCodePoints: Array.from(source).length,
    chunkCount: chunks.length,
    maxChars,
    overlap,
    overlapChars: Math.max(0, sumChars - totalChars),
    coveredChars,
    coverageRatio: totalChars === 0 ? 1 : coveredChars / totalChars,
    complete,
    firstChunkChars: sizes[0] || 0,
    longestChunk: sizes.length ? Math.max(...sizes) : 0,
    shortestChunk: sizes.length ? Math.min(...sizes) : 0,
    averageChunk: sizes.length ? Math.round((sumChars / sizes.length) * 10) / 10 : 0,
    range: { from: 0, to: totalChars }
  });

  chunks.stats = stats;
  return chunks;
}

/* ==========================================================
   TXT / MD / CSV / JSON
   ========================================================== */

function splitParagraphBlocks(text) {
  const blocks = [];
  const separator = /\n{2,}/g;
  let cursor = 0;
  let match;
  const pushPart = (part, base) => {
    const value = part.trim();
    if (!value) return;
    const localStart = part.indexOf(value);
    blocks.push({
      type: "paragraph",
      text: value,
      charStart: base + Math.max(0, localStart),
      charEnd: base + Math.max(0, localStart) + value.length
    });
  };
  while ((match = separator.exec(text)) !== null) {
    pushPart(text.slice(cursor, match.index), cursor);
    cursor = separator.lastIndex;
  }
  pushPart(text.slice(cursor), cursor);
  return blocks;
}

function parseTxt(buffer, file) {
  const { text, warnings } = decodeTextBuffer(buffer);
  const paragraphs = splitParagraphBlocks(text);
  const blocks = paragraphs.length
    ? paragraphs
    : text.trim()
      ? [{ type: "paragraph", text: text.trim() }]
      : [];
  return {
    title: firstNonEmptyLine(text) || baseName(file.name),
    text,
    blocks,
    pages: [],
    sheets: [],
    slides: [],
    metadata: {
      format: "txt",
      lineCount: text ? text.split("\n").length : 0,
      paragraphCount: blocks.length
    },
    warnings
  };
}

function parseMarkdown(buffer, file) {
  const { text, warnings } = decodeTextBuffer(buffer);
  const lines = text.split("\n");
  const blocks = [];
  let paragraph = [];
  let code = null;
  let headingCount = 0;
  let title = "";
  const outline = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    const value = paragraph.join("\n").trim();
    if (value) blocks.push({ type: "paragraph", text: value });
    paragraph = [];
  };

  lines.forEach((line, index) => {
    const fence = line.match(/^```/);
    if (fence) {
      if (code !== null) {
        blocks.push({ type: "code", text: code.join("\n"), language: "" });
        code = null;
      } else {
        flushParagraph();
        code = [];
      }
      return;
    }
    if (code !== null) {
      code.push(line);
      return;
    }

    const heading = line.match(/^(#{1,6})[ \t]+(.+?)[ \t]*#*[ \t]*$/);
    if (heading) {
      flushParagraph();
      const level = heading[1].length;
      const headingText = stripMarkdownInline(heading[2]);
      if (headingText) {
        headingCount += 1;
        blocks.push({ type: "heading", level, text: headingText, line: index + 1 });
        outline.push({ level, text: headingText });
        if (!title && level === 1) title = headingText;
      }
      return;
    }

    if (!line.trim()) {
      flushParagraph();
      return;
    }

    const listItem = line.match(/^[ \t]*(?:[-*+]|\d+[.)])[ \t]+(.+)$/);
    if (listItem) {
      flushParagraph();
      const value = stripMarkdownInline(listItem[1]);
      if (value) blocks.push({ type: "list-item", text: value, line: index + 1 });
      return;
    }

    if (/^[ \t]*>/.test(line)) {
      flushParagraph();
      const value = stripMarkdownInline(line.replace(/^[ \t]*>\s?/, ""));
      if (value) blocks.push({ type: "blockquote", text: value, line: index + 1 });
      return;
    }

    if (/^[ \t]*(?:---|\*\*\*|___)[ \t]*$/.test(line)) {
      flushParagraph();
      return;
    }

    paragraph.push(line);
  });

  flushParagraph();
  if (code !== null) {
    blocks.push({ type: "code", text: code.join("\n"), language: "" });
  }
  if (!title) {
    const firstHeading = blocks.find((block) => block.type === "heading");
    title = firstHeading?.text || firstNonEmptyLine(text) || baseName(file.name);
  }
  return {
    title,
    text,
    blocks,
    pages: [],
    sheets: [],
    slides: [],
    metadata: {
      format: "md",
      lineCount: lines.length,
      headingCount,
      headingOutline: outline
    },
    warnings
  };
}

function detectDelimiter(text) {
  const firstLine = text.split("\n").find((line) => line.trim()) || "";
  let inQuotes = false;
  const counts = new Map([[",", 0], [";", 0], ["\t", 0]]);
  for (let index = 0; index < firstLine.length; index += 1) {
    const char = firstLine[index];
    if (char === '"') {
      if (inQuotes && firstLine[index + 1] === '"') index += 1;
      else inQuotes = !inQuotes;
    } else if (!inQuotes && counts.has(char)) {
      counts.set(char, counts.get(char) + 1);
    }
  }
  let delimiter = ",";
  let best = 0;
  for (const [candidate, count] of counts) {
    if (count > best) {
      best = count;
      delimiter = candidate;
    }
  }
  return delimiter;
}

function parseDelimitedRows(text, delimiter) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  row.push(field);
  if (row.length > 1 || row[0] !== "") rows.push(row);
  return trimTrailingEmptyRows(rows);
}

function parseCsv(buffer, file) {
  const { text, warnings } = decodeTextBuffer(buffer);
  if (!text.trim()) {
    return {
      title: baseName(file.name),
      text: "",
      blocks: [],
      pages: [],
      sheets: [],
      slides: [],
      metadata: { format: "csv", rowCount: 0, columnCount: 0, delimiter: "," },
      warnings: [...warnings, "CSV 文件为空。"]
    };
  }
  const delimiter = detectDelimiter(text);
  const delimiterName = delimiter === "\t" ? "tab" : delimiter;
  const rows = parseDelimitedRows(text, delimiter);
  const columnCount = rows.reduce((max, row) => Math.max(max, row.length), 0);
  const normalizedRows = rows.map((row) => padRow(row, columnCount));
  const headers = normalizedRows[0] || [];
  const dataRows = normalizedRows.slice(1);
  const fullText = headers.length
    ? [`表头：${headers.join(" | ")}`, ...dataRows.map((row, index) => `第 ${index + 1} 行：${row.join(" | ")}`)].join("\n")
    : "";
  return {
    title: baseName(file.name) || "CSV 表格",
    text: fullText,
    blocks: fullText
      ? [{ type: "table", source: "csv", headers, rowCount: dataRows.length, columnCount, text: fullText }]
      : [],
    pages: [],
    sheets: [],
    slides: [],
    metadata: {
      format: "csv",
      rowCount: dataRows.length,
      columnCount,
      totalRows: normalizedRows.length,
      delimiter: delimiterName,
      headers
    },
    warnings
  };
}

function prettyJson(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch (error) {
    return String(value);
  }
}

function parseJson(buffer, file) {
  const { text: rawText, warnings } = decodeTextBuffer(buffer);
  let value;
  try {
    value = JSON.parse(rawText);
  } catch (error) {
    throw new FileParseError(
      "PARSE_ERROR",
      `JSON 语法无效：${error.message}`,
      { format: "json", fileName: file.name, cause: error }
    );
  }
  const text = prettyJson(value);
  const metadata = { format: "json", rootType: Array.isArray(value) ? "array" : value === null ? "null" : typeof value };
  let title = baseName(file.name);
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const candidate = value.title ?? value.name ?? value.course ?? value.courseName;
    if (typeof candidate === "string" && candidate.trim()) title = candidate.trim();
    for (const key of ["author", "description", "subject", "version", "created", "updated"]) {
      if (typeof value[key] === "string") metadata[key] = value[key];
    }
    metadata.topLevelKeys = Object.keys(value);
  } else if (Array.isArray(value)) {
    metadata.itemCount = value.length;
  }
  return {
    title,
    text,
    blocks: text ? [{ type: "json", text }] : [],
    pages: [],
    sheets: [],
    slides: [],
    metadata,
    warnings
  };
}

/* ==========================================================
   OOXML helpers
   ========================================================== */

function parseXmlDocument(xml, context = "XML") {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const parserError = doc.getElementsByTagName("parsererror")[0];
  if (parserError) {
    throw new FileParseError("PARSE_ERROR", `${context} 内容不是有效 XML。`, {
      cause: parserError.textContent?.slice(0, 300)
    });
  }
  return doc;
}

function xmlTextByNS(doc, namespace, localName) {
  const node = doc.getElementsByTagNameNS(namespace, localName)[0];
  return node?.textContent?.trim() || "";
}

function readCoreProperties(xml) {
  if (!xml) return {};
  const doc = parseXmlDocument(xml, "核心属性");
  const props = {
    title: xmlTextByNS(doc, XML_NS.dc, "title"),
    subject: xmlTextByNS(doc, XML_NS.dc, "subject"),
    creator: xmlTextByNS(doc, XML_NS.dc, "creator"),
    keywords: xmlTextByNS(doc, XML_NS.cp, "keywords"),
    description: xmlTextByNS(doc, XML_NS.dc, "description"),
    lastModifiedBy: xmlTextByNS(doc, XML_NS.cp, "lastModifiedBy"),
    created: xmlTextByNS(doc, XML_NS.dcterms, "created"),
    modified: xmlTextByNS(doc, XML_NS.dcterms, "modified"),
    category: xmlTextByNS(doc, XML_NS.cp, "category"),
    contentStatus: xmlTextByNS(doc, XML_NS.cp, "contentStatus"),
    revision: xmlTextByNS(doc, XML_NS.cp, "revision")
  };
  return Object.fromEntries(Object.entries(props).filter(([, value]) => value));
}

async function readOfficeZipMetadata(zip) {
  const props = {};
  const warnings = [];
  const coreFile = zip?.file("docProps/core.xml");
  if (coreFile) {
    try {
      Object.assign(props, readCoreProperties(await coreFile.async("string")));
    } catch (error) {
      warnings.push(`核心属性读取失败：${error.message}`);
    }
  }
  const appFile = zip?.file("docProps/app.xml");
  if (appFile) {
    try {
      const doc = parseXmlDocument(await appFile.async("string"), "应用属性");
      const application = xmlTextByNS(doc, "http://schemas.openxmlformats.org/officeDocument/2006/extended-properties", "Application");
      if (application) props.application = application;
      const appVersion = xmlTextByNS(doc, "http://schemas.openxmlformats.org/officeDocument/2006/extended-properties", "AppVersion");
      if (appVersion) props.appVersion = appVersion;
    } catch (error) {
      warnings.push(`应用属性读取失败：${error.message}`);
    }
  }
  return { props, warnings };
}

function textContentClean(node) {
  if (!node) return "";
  const clone = node.cloneNode(true);
  clone.querySelectorAll?.("br").forEach((br) => br.replaceWith("\n"));
  return normalizeWhitespace(clone.textContent || "");
}

function blockText(blocks = []) {
  return blocks
    .map((block) => block.text || "")
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

function extractTableBlock(table) {
  const rows = [];
  Array.from(table.querySelectorAll("tr")).forEach((tr) => {
    const cells = Array.from(tr.children).map((cell) => textContentClean(cell));
    if (!rowIsEmpty(cells)) rows.push(cells);
  });
  if (!rows.length) return null;
  const width = rows.reduce((max, row) => Math.max(max, row.length), 0);
  const normalized = rows.map((row) => padRow(row, width));
  const hasHeaderCells = Boolean(table.querySelector("th"));
  const headers = hasHeaderCells ? normalized[0] : [];
  const dataRows = hasHeaderCells ? normalized.slice(1) : normalized;
  const rendered = [
    ...(headers.length ? [`表头：${headers.join(" | ")}`] : []),
    ...dataRows.map((row, index) => `第 ${index + 1} 行：${row.join(" | ")}`)
  ].join("\n");
  return {
    type: "table",
    source: "docx",
    headers,
    rowCount: dataRows.length,
    columnCount: width,
    text: rendered
  };
}

function docxHtmlToBlocks(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const blocks = [];
  const walk = (elements) => {
    Array.from(elements || []).forEach((element) => {
      const tag = element.tagName.toLowerCase();
      if (/^h[1-6]$/.test(tag)) {
        const text = textContentClean(element);
        if (text) blocks.push({ type: "heading", level: Number(tag.slice(1)), text });
        return;
      }
      if (tag === "p") {
        const text = textContentClean(element);
        if (text) blocks.push({ type: "paragraph", text });
        return;
      }
      if (tag === "table") {
        const block = extractTableBlock(element);
        if (block) blocks.push(block);
        return;
      }
      if (tag === "ul" || tag === "ol") {
        Array.from(element.children).forEach((child) => {
          if (child.tagName.toLowerCase() !== "li") return;
          const text = textContentClean(child);
          if (text) blocks.push({ type: "list-item", ordered: tag === "ol", text });
        });
        return;
      }
      if (tag === "blockquote") {
        const text = textContentClean(element);
        if (text) blocks.push({ type: "blockquote", text });
        return;
      }
      if (tag === "pre") {
        const text = element.textContent || "";
        if (text.trim()) blocks.push({ type: "code", text: text.trim() });
        return;
      }
      if (tag === "img") {
        const alt = textContentClean(element.getAttribute("alt") || "");
        if (alt) blocks.push({ type: "image-alt", text: alt });
        return;
      }
      // Mammoth can emit wrapper divs; recurse without creating a block.
      if (["div", "section", "article", "main", "body"].includes(tag)) {
        walk(element.children);
      }
    });
  };
  walk(doc.body.children);
  return blocks;
}

/* ==========================================================
   DOCX — mammoth + local JSZip for core properties
   ========================================================== */

async function parseDocx(buffer, file, context) {
  const warnings = [...(context.warnings || [])];
  const { emit, progressStart = 0.12, progressEnd = 0.9 } = context;
  emit("dependency", progressStart, "加载本地 DOCX 解析库（mammoth）");
  const mammothPromise = loadMammoth();
  const zipPromise = loadJSZip().catch((error) => {
    warnings.push(`DOCX 核心属性依赖不可用，标题将回退到正文首行：${error.message}`);
    return null;
  });
  const [mammoth, JSZip] = await Promise.all([mammothPromise, zipPromise]);

  let core = {};
  let coreWarnings = [];
  if (JSZip) {
    try {
      const zip = await JSZip.loadAsync(buffer);
      const metadata = await readOfficeZipMetadata(zip);
      core = metadata.props;
      coreWarnings = metadata.warnings;
      warnings.push(...coreWarnings);
    } catch (error) {
      warnings.push(`DOCX 包属性读取失败：${error.message}`);
    }
  }

  emit("parse", progressStart + (progressEnd - progressStart) * 0.25, "解析 DOCX 段落与表格");
  let conversion;
  try {
    conversion = await mammoth.convertToHtml({ arrayBuffer: buffer }, {
      ignoreEmptyParagraphs: true
    });
  } catch (error) {
    throw new FileParseError(
      "PARSE_ERROR",
      `DOCX 解析失败：${error.message}`,
      { format: "docx", fileName: file.name, cause: error }
    );
  }

  const mammothWarnings = (conversion.messages || [])
    .filter((message) => message && (message.type === "warning" || message.type === "error"))
    .map((message) => `DOCX 兼容性提示：${message.message}`);
  warnings.push(...mammothWarnings);

  const blocks = docxHtmlToBlocks(conversion.value || "");
  const text = blockText(blocks);
  const headingOutline = blocks.filter((block) => block.type === "heading").map((block) => ({
    level: block.level,
    text: block.text
  }));
  const title = usableTitle(core.title)
    || blocks.find((block) => block.type === "heading" && block.level === 1)?.text
    || blocks.find((block) => block.type === "heading")?.text
    || blocks.find((block) => block.type === "paragraph")?.text
    || baseName(file.name);

  if (!text) warnings.push("DOCX 中没有提取到可见文本；可能只有图片或受保护内容。");

  return {
    title: usableTitle(title) || baseName(file.name),
    text,
    blocks,
    pages: [],
    sheets: [],
    slides: [],
    metadata: {
      format: "docx",
      ...core,
      paragraphCount: blocks.filter((block) => block.type === "paragraph").length,
      tableCount: blocks.filter((block) => block.type === "table").length,
      headingOutline,
      library: { mammoth: VENDOR_VERSIONS.mammoth }
    },
    warnings
  };
}

/* ==========================================================
   XLSX — SheetJS
   ========================================================== */

function workbookPropsToMetadata(props = {}) {
  const wanted = [
    "Title", "Subject", "Author", "LastAuthor", "Company", "Manager", "Category",
    "Keywords", "Comments", "CreatedDate", "ModifiedDate", "Application", "AppVersion"
  ];
  return Object.fromEntries(
    wanted
      .filter((key) => props[key] !== undefined && props[key] !== null && props[key] !== "")
      .map((key) => [key, props[key] instanceof Date ? props[key].toISOString() : String(props[key])])
  );
}

async function parseXlsx(buffer, file, context) {
  const { emit, progressStart = 0.12, progressEnd = 0.9, warnings: inputWarnings = [] } = context;
  const warnings = [...inputWarnings];
  emit("dependency", progressStart, "加载本地 XLSX 解析库（SheetJS）");
  const XLSX = await loadXLSX();
  emit("parse", progressStart + 0.08, "读取工作簿");

  let workbook;
  try {
    workbook = XLSX.read(new Uint8Array(buffer), {
      type: "array",
      cellDates: true,
      cellText: true,
      cellNF: false
    });
  } catch (error) {
    throw new FileParseError(
      "PARSE_ERROR",
      `XLSX 解析失败：${error.message}`,
      { format: "xlsx", fileName: file.name, cause: error }
    );
  }

  const sheetNames = Array.isArray(workbook.SheetNames) ? workbook.SheetNames : [];
  if (!sheetNames.length) warnings.push("工作簿中没有工作表。");

  const sheets = [];
  const blocks = [];
  for (let index = 0; index < sheetNames.length; index += 1) {
    const name = sheetNames[index];
    const worksheet = workbook.Sheets?.[name];
    if (!worksheet) {
      warnings.push(`工作表「${name}」不存在或无法读取，已跳过。`);
      continue;
    }
    let rows;
    try {
      rows = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: "",
        blankrows: false,
        raw: false
      });
    } catch (error) {
      warnings.push(`工作表「${name}」读取失败：${error.message}`);
      continue;
    }
    rows = trimTrailingEmptyRows(rows);
    let columnCount = rows.reduce((max, row) => Math.max(max, Array.isArray(row) ? row.length : 0), 0);
    while (columnCount > 0 && rows.every((row) => !normalizeCell(row[columnCount - 1]))) {
      columnCount -= 1;
    }
    const normalizedRows = rows.map((row) => padRow(row, columnCount));
    if (!normalizedRows.length) {
      warnings.push(`工作表「${name}」没有可提取的内容。`);
      sheets.push({ name, index, headers: [], rowCount: 0, columnCount: 0, text: "" });
      blocks.push({ type: "sheet", name, index, text: "", rowCount: 0, columnCount: 0, headers: [] });
      continue;
    }
    const headers = normalizedRows[0];
    const dataRows = normalizedRows.slice(1);
    const sheetText = [
      `工作表：${name}`,
      ...(headers.length ? [`表头：${headers.join(" | ")}`] : []),
      ...dataRows.map((row, rowIndex) => `第 ${rowIndex + 1} 行：${row.join(" | ")}`)
    ].join("\n");
    sheets.push({
      name,
      index,
      headers,
      rowCount: dataRows.length,
      columnCount,
      text: sheetText
    });
    blocks.push({
      type: "sheet",
      name,
      index,
      headers,
      rowCount: dataRows.length,
      columnCount,
      text: sheetText
    });
    const p = sheetNames.length ? (index + 1) / sheetNames.length : 1;
    emit("parse", progressStart + 0.08 + (progressEnd - progressStart - 0.08) * p, `读取工作表 ${index + 1}/${sheetNames.length}：${name}`);
  }

  const text = sheets.map((sheet) => sheet.text).filter(Boolean).join("\n\n");
  const workbookProps = workbookPropsToMetadata(workbook.Props || {});
  const title = usableTitle(workbookProps.Title) || sheetNames[0] || baseName(file.name);
  return {
    title: usableTitle(title) || baseName(file.name),
    text,
    blocks,
    pages: [],
    sheets,
    slides: [],
    metadata: {
      format: "xlsx",
      ...workbookProps,
      sheetNames,
      sheetCount: sheetNames.length,
      library: { "sheetjs": VENDOR_VERSIONS.xlsx }
    },
    warnings
  };
}

/* ==========================================================
   PPTX — JSZip + DrawingML text extraction
   ========================================================== */

function extractPptxSlideText(xml, slideNumber, warnings) {
  let doc;
  try {
    doc = parseXmlDocument(xml, `幻灯片 ${slideNumber}`);
  } catch (error) {
    warnings.push(`幻灯片 ${slideNumber} 的 XML 无法解析，已跳过。`);
    return { text: "", lines: [] };
  }
  const paragraphs = Array.from(doc.getElementsByTagNameNS(XML_NS.drawingml, "p"));
  const lines = [];
  paragraphs.forEach((paragraph) => {
    const runs = Array.from(paragraph.getElementsByTagNameNS(XML_NS.drawingml, "t"));
    const value = runs.map((run) => run.textContent || "").join("").replace(/\u00a0/g, " ").trim();
    if (value) lines.push(value);
  });
  if (!lines.length) {
    const allText = Array.from(doc.getElementsByTagNameNS(XML_NS.drawingml, "t"))
      .map((node) => node.textContent || "")
      .join("")
      .trim();
    if (allText) lines.push(allText);
  }
  return { text: lines.join("\n"), lines };
}

async function parsePptx(buffer, file, context) {
  const { emit, progressStart = 0.12, progressEnd = 0.9, warnings: inputWarnings = [] } = context;
  const warnings = [...inputWarnings];
  emit("dependency", progressStart, "加载本地 PPTX 解析库（JSZip）");
  const JSZip = await loadJSZip();
  let zip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch (error) {
    throw new FileParseError(
      "PARSE_ERROR",
      `PPTX 压缩包读取失败：${error.message}`,
      { format: "pptx", fileName: file.name, cause: error }
    );
  }

  const { props: core, warnings: coreWarnings } = await readOfficeZipMetadata(zip);
  warnings.push(...coreWarnings);

  const slideFiles = Object.keys(zip.files)
    .map((path) => ({ path, matched: path.match(/^ppt\/slides\/slide(\d+)\.xml$/i) }))
    .filter((item) => item.matched && !zip.files[item.path].dir)
    .sort((a, b) => Number(a.matched[1]) - Number(b.matched[1]));

  if (!slideFiles.length) {
    warnings.push("PPTX 中没有找到 ppt/slides/slide*.xml，可能不是有效的演示文稿。");
  }

  const slides = [];
  const blocks = [];
  for (let index = 0; index < slideFiles.length; index += 1) {
    const item = slideFiles[index];
    const number = Number(item.matched[1]);
    let slideText = "";
    try {
      const xml = await zip.file(item.path).async("string");
      slideText = extractPptxSlideText(xml, number, warnings).text;
    } catch (error) {
      warnings.push(`幻灯片 ${number} 读取失败：${error.message}`);
    }
    const firstLine = firstNonEmptyLine(slideText, 180);
    slides.push({
      number,
      title: firstLine,
      text: slideText,
      charCount: slideText.replace(/\s/g, "").length
    });
    blocks.push({
      type: "slide",
      number,
      title: firstLine,
      text: slideText
    });
    if (!slideText.trim()) warnings.push(`幻灯片 ${number} 没有提取到文本。`);
    const p = slideFiles.length ? (index + 1) / slideFiles.length : 1;
    emit("parse", progressStart + 0.08 + (progressEnd - progressStart - 0.08) * p, `读取幻灯片 ${index + 1}/${slideFiles.length}`);
  }

  const text = slides
    .map((slide) => [slide.text ? `## 幻灯片 ${slide.number}` : "", slide.text].filter(Boolean).join("\n"))
    .filter(Boolean)
    .join("\n\n");
  const firstSlideLine = slides.find((slide) => slide.text)?.title || "";
  const title = usableTitle(core.title) || firstSlideLine || baseName(file.name);
  return {
    title: usableTitle(title) || baseName(file.name),
    text,
    blocks,
    pages: [],
    sheets: [],
    slides,
    metadata: {
      format: "pptx",
      ...core,
      slideCount: slides.length,
      library: { jszip: VENDOR_VERSIONS.jszip }
    },
    warnings
  };
}

/* ==========================================================
   PDF — pdf.js text extraction + optional Tesseract OCR
   ========================================================== */

const OCR_PAGE_TEXT_THRESHOLD = 20;
const OCR_MAX_CANVAS_PIXELS = 16_000_000;

function pdfTextFromContent(content) {
  if (!content || !Array.isArray(content.items)) return "";
  let output = "";
  for (const item of content.items) {
    if (typeof item.str !== "string") continue;
    output += item.str;
    if (item.hasEOL) output += "\n";
    else if (item.str) output += " ";
  }
  return output
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function pageNeedsOCR(text) {
  return String(text || "").replace(/\s/g, "").length < OCR_PAGE_TEXT_THRESHOLD;
}

function buildPdfText(pages) {
  return pages
    .map((page) => `## 第 ${page.number} 页\n${page.text || ""}`.trim())
    .join("\n\n")
    .trim();
}

function pdfMetadataFromInfo(info = {}, pageCount = 0) {
  const metadata = { format: "pdf", pageCount };
  const allowed = [
    "Title", "Author", "Subject", "Keywords", "Creator", "Producer",
    "CreationDate", "ModDate", "PDFFormatVersion", "IsLinearized", "IsAcroFormPresent", "IsXFAPresent"
  ];
  allowed.forEach((key) => {
    if (info[key] !== undefined && info[key] !== null && info[key] !== "") {
      metadata[key] = info[key];
    }
  });
  return metadata;
}

async function renderPdfPageToBlob(page) {
  if (typeof document === "undefined" || typeof document.createElement !== "function") {
    throw new FileParseError("OCR_UNAVAILABLE", "当前环境无法创建 canvas，无法执行 PDF OCR。", {
      library: "PDF.js"
    });
  }
  const baseViewport = page.getViewport({ scale: 1 });
  let scale = 2;
  if (baseViewport.width * baseViewport.height * scale * scale > OCR_MAX_CANVAS_PIXELS) {
    scale = Math.max(0.8, Math.sqrt(OCR_MAX_CANVAS_PIXELS / (baseViewport.width * baseViewport.height)));
  }
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) {
    canvas.width = 0;
    canvas.height = 0;
    throw new FileParseError("OCR_UNAVAILABLE", "浏览器无法创建 2D canvas，无法执行 PDF OCR。");
  }
  await page.render({ canvasContext: context, viewport }).promise;
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  canvas.width = 0;
  canvas.height = 0;
  if (!blob) {
    throw new FileParseError("OCR_FAILED", "PDF 页面渲染后无法生成图像，OCR 已中止。", {
      library: "PDF.js"
    });
  }
  return blob;
}

async function performPdfOcr({ pdf, pages, targets, options, emit, warnings, ocrStart, ocrEnd }) {
  const ocrLang = options.ocrLang || DEFAULT_OCR_LANG;
  const maxPages = Number.isFinite(Number(options.ocrMaxPages))
    ? Math.max(1, Math.min(20, Math.floor(Number(options.ocrMaxPages))))
    : DEFAULT_OCR_MAX_PAGES;
  const pageNumbers = targets.slice(0, maxPages).map((page) => page.number);
  if (!pageNumbers.length) return;

  warnings.push(
    `已启用 OCR：将从 ${OCR_CDN.scriptUrl} 加载 Tesseract.js ${OCR_CDN.version} 及语言数据（${ocrLang}）。这是唯一会联网的解析步骤。`
  );
  emit("ocr", ocrStart, `加载 Tesseract.js OCR（CDN，显式启用）`);
  let Tesseract;
  try {
    Tesseract = await loadTesseract({
      scriptUrl: options.ocrCdn || OCR_CDN.scriptUrl,
      timeoutMs: Number(options.ocrTimeoutMs) > 0 ? Number(options.ocrTimeoutMs) : 60000
    });
  } catch (error) {
    const message = error instanceof FileParseError
      ? error.message
      : `OCR 依赖加载失败：${error?.message || "未知错误"}`;
    throw new FileParseError(
      "OCR_UNAVAILABLE",
      `${message} 未对 PDF 生成或编造任何 OCR 文本。`,
      {
        format: "pdf",
        library: "tesseract.js",
        url: options.ocrCdn || OCR_CDN.scriptUrl,
        cause: error,
        partial: { pageCount: pages.length, textChars: pages.reduce((sum, page) => sum + page.text.length, 0) }
      }
    );
  }

  const processed = [];
  for (let index = 0; index < pageNumbers.length; index += 1) {
    const pageNumber = pageNumbers[index];
    const pageRecord = pages.find((page) => page.number === pageNumber);
    if (!pageRecord) continue;
    emit("ocr", ocrStart + ((ocrEnd - ocrStart) * index) / pageNumbers.length, `渲染 PDF 第 ${pageNumber} 页用于 OCR`, { page: pageNumber });
    let blob;
    let page;
    try {
      page = await pdf.getPage(pageNumber);
      blob = await renderPdfPageToBlob(page);
    } catch (error) {
      if (error instanceof FileParseError) throw error;
      throw new FileParseError(
        "OCR_FAILED",
        `PDF 第 ${pageNumber} 页渲染失败，OCR 已中止：${error.message}`,
        { format: "pdf", page: pageNumber, cause: error }
      );
    }

    let recognized;
    try {
      recognized = await Tesseract.recognize(blob, ocrLang, {
        logger: (message) => {
          const fraction = Number.isFinite(message?.progress) ? message.progress : 0;
          const pageBase = ocrStart + ((ocrEnd - ocrStart) * index) / pageNumbers.length;
          const perPage = (ocrEnd - ocrStart) / pageNumbers.length;
          emit(
            "ocr",
            pageBase + perPage * fraction,
            `OCR 第 ${pageNumber} 页：${message?.status || "识别中"}`,
            { page: pageNumber, status: message?.status || "" }
          );
        }
      });
    } catch (error) {
      throw new FileParseError(
        "OCR_FAILED",
        `PDF 第 ${pageNumber} 页 OCR 失败，未写入任何虚构文本：${error.message}`,
        { format: "pdf", page: pageNumber, cause: error }
      );
    }

    const text = normalizeWhitespace(recognized?.data?.text || "");
    pageRecord.text = text;
    pageRecord.charCount = text.replace(/\s/g, "").length;
    pageRecord.ocr = true;
    pageRecord.needsOCR = pageNeedsOCR(text);
    processed.push(pageNumber);
    if (!text) {
      warnings.push(`第 ${pageNumber} 页 OCR 未识别出文本；该页仍标记为需要人工核对或 OCR。`);
    }
    emit(
      "ocr",
      ocrStart + ((ocrEnd - ocrStart) * (index + 1)) / pageNumbers.length,
      `OCR 完成：${index + 1}/${pageNumbers.length}`,
      { page: pageNumber }
    );
    try {
      page.cleanup();
    } catch (error) {
      // Page cleanup is best effort only.
    }
  }

  const remaining = pages.filter((page) => pageNeedsOCR(page.text)).map((page) => page.number);
  if (remaining.length) {
    warnings.push(
      `OCR 只处理了前 ${processed.length} 个低文本页，仍有页面未识别：第 ${remaining.join("、")} 页。可提高 ocrMaxPages 后重试。`
    );
  }
  return {
    applied: true,
    engine: "Tesseract.js",
    version: OCR_CDN.version,
    language: ocrLang,
    pagesProcessed: processed,
    remainingLowTextPages: remaining,
    loadedFrom: options.ocrCdn || OCR_CDN.scriptUrl
  };
}

async function parsePdf(buffer, file, context) {
  const {
    emit,
    enableOCR = false,
    options = {},
    warnings: inputWarnings = [],
    progressStart = 0.12,
    progressEnd = 0.95
  } = context;
  const warnings = [...inputWarnings];
  emit("dependency", progressStart, "加载本地 PDF.js 与 Worker");
  const pdfjsLib = await loadPdfJs();

  let pdf;
  let loadingTask;
  try {
    loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
      cMapUrl: vendorUrl("pdfjs/cmaps/"),
      cMapPacked: true,
      verbosity: 0,
      isEvalSupported: false
    });
    pdf = await loadingTask.promise;
  } catch (error) {
    try {
      await loadingTask?.destroy();
    } catch (destroyError) {
      // Best effort only.
    }
    const name = error?.name || "";
    if (name === "PasswordException" || /password/i.test(error?.message || "")) {
      throw new FileParseError(
        "ENCRYPTED_PDF",
        "该 PDF 已加密或有打开密码，当前模块无法自动解密；请先解除密码后再解析。",
        { format: "pdf", fileName: file.name, cause: error }
      );
    }
    throw new FileParseError(
      "PARSE_ERROR",
      `PDF 打开失败：${error.message || "文件可能损坏或不是有效 PDF"}`,
      { format: "pdf", fileName: file.name, cause: error }
    );
  }

  try {
    let rawInfo = {};
    try {
      const meta = await pdf.getMetadata();
      rawInfo = meta?.info || {};
    } catch (error) {
      warnings.push(`PDF 元数据读取失败：${error.message}`);
    }

    const pages = [];
    const pageCount = pdf.numPages || 0;
    if (!pageCount) warnings.push("PDF 没有可读取的页面。");

    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      const p = pageCount ? (pageNumber - 1) / pageCount : 0;
      emit(
        "parse",
        progressStart + (progressEnd - progressStart) * 0.72 * p,
        `提取 PDF 第 ${pageNumber}/${pageCount} 页文本`,
        { page: pageNumber, pageCount }
      );
      let page;
      try {
        page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();
        const text = pdfTextFromContent(content);
        pages.push({
          number: pageNumber,
          text,
          charCount: text.replace(/\s/g, "").length,
          needsOCR: pageNeedsOCR(text),
          ocr: false
        });
      } catch (error) {
        throw new FileParseError(
          "PARSE_ERROR",
          `PDF 第 ${pageNumber} 页文本提取失败：${error.message}`,
          { format: "pdf", page: pageNumber, cause: error }
        );
      } finally {
        try {
          page?.cleanup();
        } catch (error) {
          // Best effort cleanup.
        }
      }
    }

    let needsOCR = pages.some((page) => page.needsOCR);
    let ocrMeta = null;
    if (needsOCR && enableOCR) {
      const targets = pages.filter((page) => page.needsOCR);
      try {
        ocrMeta = await performPdfOcr({
          pdf,
          pages,
          targets,
          options,
          emit,
          warnings,
          ocrStart: progressStart + (progressEnd - progressStart) * 0.74,
          ocrEnd: progressEnd
        });
      } catch (error) {
        if (error instanceof FileParseError) {
          if (!error.details?.fileName) error.details = { ...(error.details || {}), fileName: file.name };
          throw error;
        }
        throw new FileParseError("OCR_FAILED", `OCR 执行失败：${error.message}`, {
          format: "pdf", fileName: file.name, cause: error
        });
      }
      needsOCR = pages.some((page) => page.needsOCR);
    } else if (needsOCR && !enableOCR) {
      const lowPages = pages.filter((page) => page.needsOCR).map((page) => page.number);
      warnings.push(
        `PDF 第 ${lowPages.join("、")} 页几乎没有可提取文本，可能是扫描件或图片页。未启用 OCR，因此未生成推测文本；可在明确同意联网后使用 enableOCR:true（默认只识别前 ${DEFAULT_OCR_MAX_PAGES} 个低文本页）。`
      );
    }

    const text = buildPdfText(pages);
    const blocks = pages.map((page) => ({
      type: "page",
      number: page.number,
      page: page.number,
      text: page.text,
      charCount: page.charCount,
      needsOCR: page.needsOCR,
      ocr: page.ocr
    }));
    const firstPageLine = pages.length ? firstNonEmptyLine(pages[0].text, 180) : "";
    const title = usableTitle(rawInfo.Title) || firstPageLine || baseName(file.name);
    const metadata = pdfMetadataFromInfo(rawInfo, pages.length);
    metadata.library = { "pdfjs-dist": VENDOR_VERSIONS["pdfjs-dist"] };
    if (ocrMeta) metadata.ocr = ocrMeta;
    else metadata.ocr = { applied: false, reason: enableOCR ? "no-low-text-pages" : "disabled" };

    if (!text.trim()) {
      warnings.push("PDF 中没有提取到文本。若为扫描件，请征得同意后启用 OCR，或使用人工录入。");
    }
    return {
      title: usableTitle(title) || baseName(file.name),
      text,
      blocks,
      pages,
      sheets: [],
      slides: [],
      metadata,
      warnings,
      needsOCR
    };
  } finally {
    try {
      await pdf?.destroy();
    } catch (error) {
      // Ignore PDF destroy failures.
    }
  }
}

/* ==========================================================
   parseFile()
   ========================================================== */

function validateFile(file) {
  if (!file || typeof file !== "object") {
    throw new FileParseError("INVALID_FILE", "请选择一个文件。");
  }
  if (typeof file.arrayBuffer !== "function") {
    throw new FileParseError("INVALID_FILE", "文件对象不可读取（缺少 arrayBuffer）。请使用浏览器 File / Blob。");
  }
  if (!file.name || typeof file.name !== "string") {
    throw new FileParseError("INVALID_FILE", "文件缺少名称，无法判断格式。");
  }
  if (!Number.isFinite(file.size) || file.size < 0) {
    throw new FileParseError("INVALID_FILE", "文件大小无效。");
  }
}

function validateMaxFileMB(value) {
  if (value === Infinity) return Infinity;
  const limit = Number(value);
  if (!Number.isFinite(limit) || limit <= 0) {
    throw new FileParseError(
      "INVALID_OPTION",
      "maxFileMB 必须是大于 0 的数字（或 Infinity 表示不限制）。",
      { maxFileMB: value }
    );
  }
  return limit;
}

function parserFor(format) {
  switch (format) {
    case "txt":
      return parseTxt;
    case "md":
      return parseMarkdown;
    case "csv":
      return parseCsv;
    case "json":
      return parseJson;
    case "docx":
      return parseDocx;
    case "xlsx":
      return parseXlsx;
    case "pptx":
      return parsePptx;
    case "pdf":
      return parsePdf;
    default:
      return null;
  }
}

/**
 * 解析浏览器 File 对象。
 *
 * @param {File} file
 * @param {{
 *   onProgress?: (event: {phase:string, progress:number, message:string, [key:string]:unknown}) => void,
 *   maxFileMB?: number,
 *   enableOCR?: boolean,
 *   ocrLang?: string,
 *   ocrMaxPages?: number,
 *   ocrCdn?: string,
 *   ocrTimeoutMs?: number
 * }} [options]
 * @returns {Promise<{
 *   name:string, size:number, type:string, title:string, text:string,
 *   blocks:Array, pages:Array, sheets:Array, slides:Array, metadata:Object,
 *   warnings:string[], needsOCR:boolean, charCount:number, blockCount:number
 * }>}
 */
export async function parseFile(file, options = {}) {
  const opts = options && typeof options === "object" ? options : {};
  const { onProgress, maxFileMB = DEFAULT_MAX_FILE_MB, enableOCR = false, ...advanced } = opts;
  const emit = (phase, progress, message, detail = {}) => {
    emitProgress(onProgress, { phase, progress, message, ...detail });
  };

  validateFile(file);
  const format = resolveFormat(file);
  const parser = parserFor(format);
  if (!format || !parser) {
    throw new FileParseError(
      "UNSUPPORTED_TYPE",
      `暂不支持该文件格式（.${format || "未知"}）。当前支持：${SUPPORTED_EXTENSIONS.join(" / ")}。`,
      { fileName: file.name, format: format || "", supported: [...SUPPORTED_EXTENSIONS] }
    );
  }
  const limitMB = validateMaxFileMB(maxFileMB);
  const fileMB = file.size / (1024 * 1024);
  if (limitMB !== Infinity && fileMB > limitMB) {
    throw new FileParseError(
      "FILE_TOO_LARGE",
      `文件 ${file.name} 为 ${fileMB.toFixed(2)} MB，超过本次限制 ${limitMB} MB。请拆分文件或提高 maxFileMB（需评估浏览器内存）。`,
      { fileName: file.name, size: file.size, maxFileMB: limitMB, fileMB }
    );
  }

  emit("validate", 0.01, `校验文件：${file.name}`, { format });
  let buffer;
  try {
    emit("read", 0.04, "读取文件字节（仅在本机内存中）", { format });
    buffer = await file.arrayBuffer();
    if (!(buffer instanceof ArrayBuffer)) {
      throw new Error("arrayBuffer() 未返回 ArrayBuffer");
    }
    emit("read", 0.1, `读取完成：${file.size} 字节`, { format });
  } catch (error) {
    if (error instanceof FileParseError) throw error;
    throw new FileParseError(
      "READ_ERROR",
      `文件读取失败：${error.message || "浏览器未提供读取能力"}`,
      { fileName: file.name, format, cause: error }
    );
  }

  let parsed;
  try {
    if (TEXT_FORMATS.has(format)) {
      emit("parse", 0.42, `解析 ${format.toUpperCase()} 文本`, { format });
      parsed = parser(buffer, file);
    } else if (format === "docx") {
      parsed = await parseDocx(buffer, file, {
        emit,
        enableOCR,
        options: advanced,
        progressStart: 0.12,
        progressEnd: 0.92
      });
    } else if (format === "xlsx") {
      parsed = await parseXlsx(buffer, file, {
        emit,
        enableOCR,
        options: advanced,
        progressStart: 0.12,
        progressEnd: 0.92
      });
    } else if (format === "pptx") {
      parsed = await parsePptx(buffer, file, {
        emit,
        enableOCR,
        options: advanced,
        progressStart: 0.12,
        progressEnd: 0.92
      });
    } else if (format === "pdf") {
      parsed = await parsePdf(buffer, file, {
        emit,
        enableOCR: Boolean(enableOCR),
        options: advanced,
        progressStart: 0.14,
        progressEnd: 0.96
      });
    } else {
      throw new FileParseError("UNSUPPORTED_TYPE", `未注册 ${format} 的解析器。`, {
        format,
        fileName: file.name
      });
    }
  } catch (error) {
    if (error instanceof FileParseError) throw error;
    throw new FileParseError(
      "PARSE_ERROR",
      `${format.toUpperCase()} 解析失败：${error.message || "未知错误"}`,
      { fileName: file.name, format, cause: error }
    );
  }

  emit("finalize", 0.97, "整理文本、元数据与字符统计", { format });
  const text = typeof parsed?.text === "string" ? parsed.text : "";
  const warnings = uniqueStrings(parsed?.warnings || []);
  if (enableOCR && format !== "pdf") {
    warnings.push("enableOCR 仅对 PDF 生效；本格式已按原生文本解析，未加载 OCR 运行时。");
  }
  const metadata = {
    format,
    mimeType: resolveMime(format, file.type),
    fileName: file.name,
    byteLength: file.size,
    charCount: text.length,
    parserVersion: PARSER_VERSION,
    ...(parsed?.metadata && typeof parsed.metadata === "object" ? parsed.metadata : {})
  };
  const result = {
    name: file.name,
    size: file.size,
    type: resolveMime(format, file.type),
    title: usableTitle(parsed?.title) || baseName(file.name) || "未命名文件",
    text,
    blocks: Array.isArray(parsed?.blocks) ? parsed.blocks : [],
    pages: Array.isArray(parsed?.pages) ? parsed.pages : [],
    sheets: Array.isArray(parsed?.sheets) ? parsed.sheets : [],
    slides: Array.isArray(parsed?.slides) ? parsed.slides : [],
    metadata,
    warnings,
    needsOCR: Boolean(parsed?.needsOCR),
    charCount: text.length,
    blockCount: Array.isArray(parsed?.blocks) ? parsed.blocks.length : 0
  };

  emit("done", 1, "解析完成", {
    format,
    charCount: result.charCount,
    blockCount: result.blockCount,
    needsOCR: result.needsOCR
  });
  return result;
}

// Optional cleanup hook for long-lived pages. Scripts and PDF workers are cached by design;
// this clears dependency promises so a subsequent call can reload from vendor if the host
// removed the script tags. It does not terminate an in-flight parser.
export function disposeParser() {
  dependencyPromises.clear();
}

export default { parseFile, chunkDocument, FileParseError, PARSER_VERSION, VENDOR_VERSIONS };