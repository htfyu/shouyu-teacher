/**
 * 授渔 · 界面与交互
 * 纯前端、无构建步骤。对话与资料优先保存在本机 IndexedDB，localStorage 仅作兼容回退。
 */

import {
  KB_DOCS,
  KB_VERSION,
  SCENES,
  LESSON_TEMPLATES,
  EVAL_TEMPLATES,
  OBSERVATION_TEMPLATES,
  TASK_PRESETS,
  MAJORS,
  COURSE_FALLBACK,
  SPECIALTY_PACKS,
  getDoc,
  getSection,
  totalSections,
  docMarkdown,
  getKnowledgeCategories,
  registerCustomKnowledgeDocs,
  addOrUpdateCustomDoc,
  deleteCustomDoc,
  findDuplicateKnowledgeDoc,
  isBuiltinDoc
} from "./knowledge.js";

import {
  generate,
  chatReply,
  detectParamEdits,
  detectInputRisk,
  retrieve,
  searchKnowledge,
  knowledgeStats
} from "./engine.js";

import {
  copyText,
  downloadWord,
  downloadDOCX,
  downloadXLSX,
  downloadTXT,
  printArtifact,
  downloadMarkdown,
  downloadTextFile,
  artifactToText,
  docToText,
  sectionToText
} from "./export.js";

import {
  AI_CONSENT_VERSION,
  DEMO_PROVIDER,
  PROXY_PROVIDER,
  checkAIConnection,
  consentRecord,
  hasValidConsent,
  normalizeAISettings,
  providerLabel,
  streamAI
} from "./ai.js";

import {
  buildChatMessages,
  buildGenerationMessages
} from "./ai-prompts.js";

import {
  parseAIMarkdown
} from "./ai-artifacts.js";

import * as localDB from "./db.js";

import {
  detectSensitive,
  maskSensitive,
  reviewSummary,
  riskLevel
} from "./privacy.js";

import {
  parseFile,
  chunkDocument,
  FileParseError
} from "./files.js";

/* ==========================================================
   Icons
   ========================================================== */

const ICON_PATHS = {
  plus: '<path d="M8 3v10M3 8h10"/>',
  menu: '<path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11"/>',
  close: '<path d="M3.5 3.5l9 9M12.5 3.5l-9 9"/>',
  home: '<path d="M2.5 7.2L8 2.7l5.5 4.5v6.3H9.8V9.6H6.2v3.9H2.5V7.2z"/>',
  book: '<path d="M3 2.5h4.2c.7 0 1.2.5 1.2 1.2v9.8H4.2C3.5 13.5 3 13 3 12.3V2.5zM8.4 3.7c0-.7.5-1.2 1.2-1.2H13v10.8c0 .7-.5 1.2-1.2 1.2H8.4V3.7z"/>',
  grid: '<path d="M2.5 2.5h4v4h-4zM9.5 2.5h4v4h-4zM2.5 9.5h4v4h-4zM9.5 9.5h4v4h-4z"/>',
  layers: '<path d="M8 2.3l5.5 3L8 8.3l-5.5-3 5.5-3zM2.5 8L8 11l5.5-3M2.5 10.7L8 13.7l5.5-3"/>',
  clock: '<circle cx="8" cy="8" r="5.5"/><path d="M8 4.6V8l2.3 1.5"/>',
  help: '<circle cx="8" cy="8" r="5.7"/><path d="M6.1 6.1a2 2 0 013.8 1c0 1.3-1.9 1.4-1.9 2.6M8 11.7v.1"/>',
  arrowUp: '<path d="M8 13V3M4 7l4-4 4 4"/>',
  arrowUpRight: '<path d="M4 12L12 4M5.2 4H12v6.8"/>',
  arrowRight: '<path d="M2.5 8h11M9.5 4l4 4-4 4"/>',
  arrowLeft: '<path d="M13.5 8h-11M6.5 4l-4 4 4 4"/>',
  copy: '<rect x="5.5" y="5.5" width="7.5" height="8"/><path d="M10.5 5.5V2.5H3v8.5h2.5"/>',
  download: '<path d="M8 2.5v7.8M4.8 7.2L8 10.4l3.2-3.2M2.5 13.5h11"/>',
  printer: '<path d="M4.2 5.5V2.5h7.6v3M4.2 11H2.5V5.5h11V11h-1.7M4.2 8.5h7.6v5H4.2z"/>',
  search: '<circle cx="7" cy="7" r="4.3"/><path d="M10.2 10.2l3.3 3.3"/>',
  pin: '<path d="M6 2.5h4l-.7 3.3 2.2 2.1H8.8V14L8 11.5 7.2 14V7.9H4.5l2.2-2.1L6 2.5z"/>',
  trash: '<path d="M2.8 4.3h10.4M6 4.3V2.5h4v1.8M4 4.3l.6 9.2h6.8l.6-9.2M6.5 6.5v5M9.5 6.5v5"/>',
  sliders: '<path d="M3 4.5h6M11.5 4.5h1.5M3 11.5h1.5M7 11.5h6"/><circle cx="10" cy="4.5" r="1.4"/><circle cx="5" cy="11.5" r="1.4"/>',
  file: '<path d="M4 2.5h5l3 3v8H4v-11zM9 2.5v3h3M6 8h4M6 10.5h4"/>',
  shield: '<path d="M8 2.3l4.6 1.7v4.1c0 2.7-1.9 4.5-4.6 5.6-2.7-1.1-4.6-2.9-4.6-5.6V4L8 2.3z"/><path d="M5.9 8l1.5 1.5L10.3 6.6"/>',
  check: '<path d="M2.8 8.2l3.2 3.1 7.2-7.1"/>',
  alert: '<path d="M8 2.5l5.5 10.7h-11L8 2.5zM8 6v3.3M8 11.4v.1"/>',
  info: '<circle cx="8" cy="8" r="5.7"/><path d="M8 7v4M8 5v.1"/>',
  chevronRight: '<path d="M6 3.5L10.5 8 6 12.5"/>',
  chevronDown: '<path d="M3.5 6L8 10.5 12.5 6"/>',
  refresh: '<path d="M13.2 6.4A5.5 5.5 0 103 12.4M13.2 2.8v3.6H9.6"/>',
  external: '<path d="M9 3h4v4M13 3L7 9M11 10v3.5H2.5V5H6"/>',
  paperclip: '<path d="M10.7 6.2l-4 4a2.1 2.1 0 01-3-3l5-5a3 3 0 014.3 4.2l-5.1 5.1a3.8 3.8 0 01-5.4-5.4l4.2-4.2"/>',
  up: '<path d="M3.2 8.8L8 4l4.8 4.8M8 4v8.5"/>',
  down: '<path d="M3.2 7.2L8 12l4.8-4.8M8 3.5V12"/>',
  spark: '<path d="M8 2.2l1 3.4 3.4 1-3.4 1-1 3.4-1-3.4-3.4-1 3.4-1 1-3.4zM12.5 10.5l.5 1.5 1.5.5-1.5.5-.5 1.5-.5-1.5-1.5-.5 1.5-.5.5-1.5z"/>',
  flower: '<circle cx="8" cy="8" r="1.6"/><path d="M8 2.2a2 2 0 010 4M8 9.8a2 2 0 010 4M2.2 8a2 2 0 014 0M9.8 8a2 2 0 014 0"/>'
};

function icon(name, size = 15) {
  const path = ICON_PATHS[name] || ICON_PATHS.info;
  return `<svg width="${size}" height="${size}" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true">${path}</svg>`;
}

/* ==========================================================
   Utilities
   ========================================================== */

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/\n/g, "&#10;");
}

function uid(prefix = "id") {
  if (window.crypto?.randomUUID) return `${prefix}_${window.crypto.randomUUID().slice(0, 8)}`;
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatTime(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function formatDate(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}年${String(date.getMonth() + 1).padStart(2, "0")}月${String(date.getDate()).padStart(2, "0")}日`;
}

function formatRelative(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const sameDay = now.toDateString() === date.toDateString();
  if (sameDay) return formatTime(iso);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (yesterday.toDateString() === date.toDateString()) return "昨天";
  if (diff < 7 * 24 * 3600 * 1000) return `${Math.floor(diff / (24 * 3600 * 1000))} 天前`;
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function truncate(value, length) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > length ? `${text.slice(0, length)}…` : text;
}

function mdLite(text) {
  const escaped = escapeHtml(text);
  const lines = escaped.split("\n");
  const out = [];
  let paragraph = [];
  let list = null;

  const inline = (value) =>
    value
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/`([^`]+)`/g, "<code>$1</code>");

  function flushParagraph() {
    if (!paragraph.length) return;
    out.push(`<p>${inline(paragraph.join("<br>"))}</p>`);
    paragraph = [];
  }

  function flushList() {
    if (!list) return;
    const tag = list.ordered ? "ol" : "ul";
    out.push(`<${tag}>${list.items.map((item) => `<li>${inline(item)}</li>`).join("")}</${tag}>`);
    list = null;
  }

  lines.forEach((rawLine) => {
    const line = rawLine.trimEnd();
    if (!line.trim()) {
      flushParagraph();
      flushList();
      return;
    }
    if (/^[-•]\s+/.test(line)) {
      flushParagraph();
      if (!list || list.ordered) {
        flushList();
        list = { ordered: false, items: [] };
      }
      list.items.push(line.replace(/^[-•]\s+/, ""));
      return;
    }
    const ordered = line.match(/^(\d+)\.\s+(.*)$/);
    if (ordered) {
      flushParagraph();
      if (!list || !list.ordered) {
        flushList();
        list = { ordered: true, items: [] };
      }
      list.items.push(ordered[2]);
      return;
    }
    if (/^>\s?/.test(line)) {
      flushParagraph();
      flushList();
      out.push(`<blockquote>${inline(line.replace(/^>\s?/, ""))}</blockquote>`);
      return;
    }
    if (/^###\s+/.test(line)) {
      flushParagraph();
      flushList();
      out.push(`<p class="md-h">${inline(line.replace(/^###\s+/, ""))}</p>`);
      return;
    }
    if (/^##\s+/.test(line)) {
      flushParagraph();
      flushList();
      out.push(`<p class="md-h">${inline(line.replace(/^##\s+/, ""))}</p>`);
      return;
    }
    if (/^---+$/.test(line)) {
      flushParagraph();
      flushList();
      return;
    }
    if (list) {
      paragraph.push(line);
      return;
    }
    paragraph.push(line);
  });
  flushParagraph();
  flushList();
  return `<div class="markdown">${out.join("")}</div>`;
}

function refToLabel(ref, sources = []) {
  if (!ref) return "";
  const source = sources.find((item) => item.key === ref || item.sectionId === ref || item.ref === ref);
  if (source?.ref) return source.ref;
  const spaced = String(ref).match(/^(.+?)\s*§\s*(\d+)$/);
  if (spaced) return `${spaced[1]} §${String(Number(spaced[2])).padStart(2, "0")}`;
  const match = String(ref).match(/^(.*)-(\d+)$/);
  if (match) return `${match[1]} §${match[2].padStart(2, "0")}`;
  return String(ref);
}

function sourceKeyFromRef(ref) {
  const sourceMatch = String(ref).match(/^(.+?)\s*§\s*(\d+)$/);
  if (sourceMatch) return `${sourceMatch[1]}-${Number(sourceMatch[2])}`;
  return String(ref);
}

/* ==========================================================
   Local persistence
   ========================================================== */

const DB_KEY = "jiangbei.workspace.v2";
const DB_VERSION = 2;
const MAX_CONVERSATIONS = 36;

let memoryDB = null;

function blankDB() {
  return {
    version: DB_VERSION,
    createdAt: new Date().toISOString(),
    lastOpenedAt: new Date().toISOString(),
    conversations: []
  };
}

function sanitizeConversations(list) {
  let repaired = false;
  const conversations = (Array.isArray(list) ? list : [])
    .filter((conv) => conv && conv.id && Array.isArray(conv.messages))
    .map((conv) => {
      const interrupted = conv.messages.some((msg) => msg && (msg.kind === "pending" || msg.kind === "typing"));
      const messages = conv.messages.filter(
        (msg) => msg && msg.role && msg.kind && msg.kind !== "pending" && msg.kind !== "typing"
      );
      if (interrupted) {
        repaired = true;
        messages.push({
          id: uid("msg"),
          role: "assistant",
          kind: "chat",
          text: "上次生成在页面刷新或关闭时被中断了，没有产生结果。您的任务条件仍保留在这次对话里；可以重新填写参数后再生成。",
          sources: [],
          suggestions: [{ label: "重新填写参数", action: "scene", scene: conv.scene || "lesson" }],
          createdAt: new Date().toISOString()
        });
      }
      return {
        ...conv,
        pinned: Boolean(conv.pinned),
        messages,
        createdAt: conv.createdAt || new Date().toISOString(),
        updatedAt: interrupted ? new Date().toISOString() : conv.updatedAt || conv.createdAt || new Date().toISOString()
      };
    })
    .slice(0, MAX_CONVERSATIONS);
  return { conversations, repaired };
}

function loadDB() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) return blankDB();
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.conversations)) return blankDB();
    const { conversations, repaired } = sanitizeConversations(parsed.conversations);
    parsed.conversations = conversations;
    const cleaned = { ...blankDB(), ...parsed, version: DB_VERSION };
    if (repaired) {
      try {
        localStorage.setItem(DB_KEY, JSON.stringify(cleaned));
      } catch (error) {
        console.warn("无法保存中断状态修复。", error);
      }
    }
    return cleaned;
  } catch (error) {
    console.warn("无法读取本地记录，使用新工作区。", error);
    return blankDB();
  }
}

let db = loadDB();
memoryDB = db;
let idbReady = false;
let idbSaveTimer = null;
let idbSaveInFlight = false;
let idbSavePending = false;

function queueIndexedBSave() {
  if (!idbReady) return;
  idbSavePending = true;
  if (idbSaveTimer) clearTimeout(idbSaveTimer);
  idbSaveTimer = setTimeout(async () => {
    if (idbSaveInFlight) return;
    idbSaveInFlight = true;
    idbSavePending = false;
    try {
      await localDB.replaceConversations(db.conversations);
    } catch (error) {
      console.warn("IndexedDB 保存失败，仅保留浏览器兼容存储。", error);
      idbReady = false;
    } finally {
      idbSaveInFlight = false;
      if (idbSavePending && idbReady) queueIndexedBSave();
    }
  }, 320);
}

function saveDB() {
  try {
    db.lastOpenedAt = new Date().toISOString();
    const sorted = [...db.conversations].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return new Date(b.updatedAt) - new Date(a.updatedAt);
    });
    db.conversations = sorted.slice(0, MAX_CONVERSATIONS);
    let serialized = "";
    try {
      serialized = JSON.stringify(db);
      if (serialized.length < 4_200_000) localStorage.setItem(DB_KEY, serialized);
    } catch (error) {
      console.warn("localStorage 容量不足，完整记录仍会写入 IndexedDB。", error);
    }
    queueIndexedBSave();
    return true;
  } catch (error) {
    console.warn("本地保存失败", error);
    return false;
  }
}

function sortedConversations() {
  return [...db.conversations].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return new Date(b.updatedAt) - new Date(a.updatedAt);
  });
}

function findConversation(id) {
  return db.conversations.find((conv) => conv.id === id) || null;
}

/* ==========================================================
   App state
   ========================================================== */

const AI_LOCAL_KEY = "jiangbei.ai.v1";

function loadAISettings() {
  try {
    return normalizeAISettings(JSON.parse(localStorage.getItem(AI_LOCAL_KEY) || "{}"));
  } catch (error) {
    return normalizeAISettings();
  }
}

const state = {
  route: { name: "home" },
  activeId: null,
  sidebarOpen: false,
  railOpen: false,
  modal: null,
  draft: "",
  attachments: [],
  docTabs: {},
  kbQuery: "",
  kbCategory: "全部",
  historyQuery: "",
  historyCategory: "全部",
  historySelected: [],
  generating: false,
  chatBusy: false,
  lastFocused: null,
  pendingScroll: "auto",
  showAllSources: false,
  ai: loadAISettings(),
  aiStream: null,
  aiStreamingMessageId: "",
  consentCallback: null,
  privacyResolve: null,
  filePrivacyResolve: null,
  pendingOCRId: "",
  fileMaxMB: 25,
  editor: null,
  storageReady: false,
  files: [],
  customDocs: [],
  fileUploads: [],
  pendingFileBlobs: new Map(),
  activeFileId: "",
  kbManageMode: false,
  pendingEditor: null
};

function privacyFindingLabels(findings = []) {
  return Array.from(new Set(findings.map((finding) => finding.label))).filter(Boolean);
}

function aiModeActive() {
  return state.ai?.mode === "ai";
}

function aiReadyForSending() {
  return aiModeActive() && hasValidConsent(state.ai);
}

function saveAILocal() {
  try {
    const copy = { ...state.ai, proxyToken: "" };
    localStorage.setItem(AI_LOCAL_KEY, JSON.stringify(copy));
  } catch (error) {
    console.warn("无法保存 AI 设置", error);
  }
}

async function saveAISettings(settings, { persistToken = true } = {}) {
  state.ai = normalizeAISettings(settings);
  saveAILocal();
  try {
    // Access tokens remain session-scoped; they are never written to IndexedDB.
    await localDB.saveSetting("ai", { ...state.ai, proxyToken: "" });
  } catch (error) {
    console.warn("AI 设置写入 IndexedDB 失败", error);
  }
  return state.ai;
}

function openAIConsentModal(callback = null, provider = state.ai.provider) {
  state.consentCallback = typeof callback === "function" ? callback : null;
  const isDemo = provider === "demo";
  openModal({
    kind: "confirm",
    kicker: "AI DATA NOTICE / 数据传输说明",
    title: "使用 AI 增强前，请确认数据边界",
    sub: isDemo
      ? "体验通道会把你输入的任务条件与知识库片段发送给第三方公开推理服务。"
      : "安全代理会把任务条件与知识库片段发送到你配置的服务器，再由服务器调用模型服务。",
    narrow: false,
    body: `
      <div class="notice-stack">
        <div class="privacy-disclosure">
          <h3>会发送什么</h3>
          <ul>
            <li>专业、课程、工作任务、课型、学时、学情、设备与教师补充要求；</li>
            <li>从本地知识库检索出的章节片段，用于约束事实与引用；</li>
            <li>当前对话的必要上下文；不会发送整个浏览器历史或未选择的其他资料。</li>
          </ul>
        </div>
        <div class="privacy-disclosure">
          <h3>不会自动发送什么</h3>
          <ul>
            <li>不会主动发送学生姓名、学号、联系方式、家庭住址；</li>
            <li>不会发送 API Key。${isDemo ? "体验通道本身不含密钥，使用公开匿名模型。" : "模型密钥只存在服务端环境变量。"}</li>
            <li>不会把未选择的附件或整个资料库整体上传。</li>
          </ul>
        </div>
        <div class="privacy-disclosure">
          <h3>你需要做什么</h3>
          <ol>
            <li>确认输入不含未脱敏的敏感信息；系统会在发送前再次检查；</li>
            <li>知悉 AI 输出仅为草稿，正式使用前必须人工审核；</li>
            <li>${isDemo ? "体验通道可能受第三方服务可用性与隐私政策影响，敏感教学资料请改用本地模式或自建安全代理。" : "确认该代理服务符合学校数据管理规定。"}</li>
          </ol>
        </div>
        <div class="privacy-warning">
          ${isDemo ? "体验通道是公开服务，不适合涉密、未公开或可识别个人身份的数据。生产使用请部署 server/ 中的安全代理。" : "安全代理地址由你配置；请确认其 HTTPS、访问控制与日志策略符合学校要求。"}
        </div>
      </div>
    `,
    focusSelector: "[data-action='grant-ai-consent']",
    footer: `
      <button class="btn btn-ghost" type="button" data-action="close-modal">暂不使用 AI</button>
      <span class="spacer"></span>
      <button class="btn btn-solid" type="button" data-action="grant-ai-consent">我已知晓，同意使用</button>
    `
  });
}

const appEl = document.getElementById("app");
const sidebarEl = document.getElementById("sidebar");
const topbarEl = document.getElementById("topbar");
const viewEl = document.getElementById("view");
const overlayEl = document.getElementById("overlay-root");
const toastRoot = document.getElementById("toast-root");

/* ==========================================================
   Routing
   ========================================================== */

function parseRoute() {
  const raw = location.hash.replace(/^#/, "") || "/";
  if (raw.startsWith("/chat/")) {
    const id = decodeURIComponent(raw.slice(6));
    const conv = findConversation(id);
    if (conv) return { name: "chat", id, conversation: conv };
    return { name: "notfound" };
  }
  if (raw === "/kb" || raw.startsWith("/kb")) return { name: "kb" };
  if (raw === "/files" || raw.startsWith("/files")) return { name: "files" };
  if (raw === "/templates" || raw.startsWith("/templates")) return { name: "templates" };
  if (raw === "/history" || raw.startsWith("/history")) return { name: "history" };
  if (raw === "/settings" || raw.startsWith("/settings")) return { name: "settings" };
  if (raw === "/guide" || raw.startsWith("/guide")) return { name: "guide" };
  return { name: "home" };
}

function routeIdentity(route) {
  return `${route?.name || "home"}:${route?.id || ""}`;
}

function navigate(path, options = {}) {
  const hash = path === "/" ? "#/" : `#${path}`;
  closeModal();
  state.sidebarOpen = false;
  state.railOpen = false;
  if (location.hash !== hash) {
    history.pushState(null, "", hash);
  }
  state.pendingScroll = options.scroll || "auto";
  handleRoute();
}

function handleRoute() {
  const route = parseRoute();
  const changed = routeIdentity(route) !== routeIdentity(state.route);
  if (route.name === "notfound") {
    history.replaceState(null, "", "#/");
    state.route = { name: "home" };
    state.activeId = null;
  } else {
    state.route = route;
    state.activeId = route.name === "chat" ? route.id : null;
  }
  if (changed) {
    // Do not leak an unsent draft or attachment into another page/conversation.
    state.draft = "";
    state.attachments = [];
    state.sidebarOpen = false;
    state.railOpen = false;
    state.showAllSources = false;
    state.historySelected = [];
    if (state.modal) closeModal();
  }
  if (route.name !== "chat") state.railOpen = false;
  if (route.name === "chat" && state.pendingScroll === "auto") {
    const conv = findConversation(route.id);
    state.pendingScroll = conv?.latestArtifact ? "result" : "bottom";
  }
  renderApp();
}

window.addEventListener("popstate", handleRoute);

/* ==========================================================
   Shell render
   ========================================================== */

function renderApp(options = {}) {
  const previousChatScroll = document.querySelector(".chat-scroll")?.scrollTop;
  const previousViewScroll = viewEl.scrollTop;
  const activeConv = state.activeId ? findConversation(state.activeId) : null;

  appEl.classList.toggle("sidebar-open", state.sidebarOpen);
  renderSidebar(activeConv);
  renderTopbar(activeConv);
  renderView(activeConv, options, previousChatScroll, previousViewScroll);

  document.querySelectorAll(".sidebar-scrim").forEach((el) => el.remove());
  if (state.sidebarOpen) {
    const scrim = document.createElement("div");
    scrim.className = "sidebar-scrim";
    scrim.dataset.action = "close-sidebar";
    scrim.setAttribute("aria-hidden", "true");
    appEl.appendChild(scrim);
  }

  const workspace = document.querySelector(".workspace");
  if (workspace) workspace.classList.toggle("rail-open", state.railOpen);
}

function renderSidebar(activeConv) {
  const route = state.route;
  const recent = sortedConversations().slice(0, 5);
  const activeId = activeConv?.id;
  const navItems = [
    { key: "home", path: "/", icon: "grid", label: "备课工作台" },
    { key: "kb", path: "/kb", icon: "book", label: "知识库", count: KB_DOCS.length },
    { key: "files", path: "/files", icon: "file", label: "资料中心", count: state.files.length },
    { key: "templates", path: "/templates", icon: "layers", label: "模板库", count: LESSON_TEMPLATES.length + EVAL_TEMPLATES.length + OBSERVATION_TEMPLATES.length },
    { key: "history", path: "/history", icon: "clock", label: "历史对话", count: db.conversations.length },
    { key: "settings", path: "/settings", icon: "sliders", label: "AI 与数据设置" },
    { key: "guide", path: "/guide", icon: "help", label: "使用说明" }
  ];
  sidebarEl.innerHTML = `
    <a class="brand" href="#/" data-action="nav" data-path="/" aria-label="授渔首页">
      <span class="brand-mark"><img src="./assets/brand/logo-mark-inverse.png" alt=""></span>
      <span class="brand-copy">
        <span class="brand-name">授渔</span>
        <span class="brand-sub">SHOUYU · TVET STUDIO</span>
      </span>
    </a>
    <div class="side-scroll">
      <button class="new-chat" type="button" data-action="new-chat">
        ${icon("plus", 14)}
        <span>新对话</span>
        <kbd>N</kbd>
      </button>
      <div class="side-label">WORKSPACE / 工作区</div>
      <nav class="side-nav" aria-label="工作区导航">
        ${navItems.map((item) => {
          const active = route.name === item.key;
          return `<button class="nav-item${active ? " is-active" : ""}" type="button" data-action="nav" data-path="${item.path}" ${active ? 'aria-current="page"' : ""}>
            ${icon(item.icon, 14)}
            <span>${item.label}</span>
            ${item.count != null ? `<span class="nav-count">${String(item.count).padStart(2, "0")}</span>` : ""}
          </button>`;
        }).join("")}
      </nav>
      <div class="side-label">RECENT / 最近</div>
      <div class="recent-list">
        ${recent.length ? recent.map((conv) => `
          <button class="recent-item${activeId === conv.id ? " is-active" : ""}" type="button" data-action="open-conv" data-id="${escapeAttr(conv.id)}">
            <span class="recent-title">${conv.pinned ? "◉ " : ""}${escapeHtml(conv.title || "未命名对话")}</span>
            <span class="recent-meta"><span>${escapeHtml(sceneShort(conv.scene))}</span><span>${escapeHtml(formatRelative(conv.updatedAt))}</span></span>
          </button>
        `).join("") : `<div class="recent-empty">还没有记录。<br>从一次真实的备课任务开始。</div>`}
      </div>
    </div>
    <div class="side-foot">
      <div class="side-foot-row"><span class="status-dot"></span><span>${aiModeActive() ? (hasValidConsent(state.ai) ? "AI MODE · 发送前隐私检查" : "AI MODE · 待授权") : "LOCAL-FIRST · 数据不出浏览器"}</span></div>
      <a href="#/settings" data-action="nav" data-path="/settings">AI 模式 · 数据与隐私 →</a>
    </div>
  `;
}

function sceneShort(scene) {
  return SCENES.find((item) => item.id === scene)?.short || "对话";
}

function renderTopbar(activeConv) {
  const route = state.route;
  const aiChip = `<button class="ai-mode-chip${aiModeActive() ? " is-ai" : ""}" type="button" data-action="toggle-ai-mode" aria-label="${aiModeActive() ? "切换到本地模式" : "启用 AI 增强模式"}">
    ${icon(aiModeActive() ? "spark" : "shield", 12)}
    <span>${aiModeActive() ? (hasValidConsent(state.ai) ? "AI 增强" : "AI 待授权") : "本地模式"}</span>
  </button>`;
  let kicker = "WORKBENCH / 教学工作台";
  let title = "工学一体化教师助手";
  let center = "“把每一节课，备成一件作品。”";
  let actions = `
    ${aiChip}
    <div class="topbar-status"><span class="status-dot"></span>知识库 ${KB_DOCS.length} 份 · 本地就绪</div>
    <button class="btn btn-ghost" type="button" data-action="nav" data-path="/kb" aria-label="打开知识库">${icon("book", 13)}<span class="topbar-action-label">知识库</span></button>
    <button class="btn" type="button" data-action="nav" data-path="/guide" aria-label="打开使用说明">${icon("help", 13)}<span class="topbar-action-label">使用说明</span></button>
  `;
  if (route.name === "chat" && activeConv) {
    kicker = "CONVERSATION / 已保存本机";
    title = activeConv.title || "教学对话";
    center = "知识库基线 · " + KB_VERSION;
    actions = `
      ${aiChip}
      ${activeConv.latestArtifact ? `<button class="btn btn-ghost" type="button" data-action="edit-params" aria-label="调整任务参数">${icon("sliders", 13)}<span class="topbar-action-label">调整参数</span></button>` : ""}
      <button class="btn btn-ghost rail-mobile-btn" type="button" data-action="toggle-rail" aria-label="打开依据与合规自检">${icon("shield", 13)}<span class="topbar-action-label">依据 · 自检</span></button>
      <button class="btn btn-solid" type="button" data-action="new-chat" aria-label="新建对话">${icon("plus", 13)}<span class="topbar-action-label">新对话</span></button>
    `;
  } else if (route.name === "kb") {
    kicker = "KNOWLEDGE BASE / 知识库";
    title = "有依据，才回答";
    center = "全部材料可检索 · 引用可回溯";
    actions = `${aiChip}<button class="btn" type="button" data-action="nav" data-path="/" aria-label="返回工作台">${icon("arrowLeft", 13)}<span class="topbar-action-label">返回工作台</span></button>`;
  } else if (route.name === "files") {
    kicker = "RESOURCE CENTER / 资料中心";
    title = "把资料变成可检索的知识";
    center = "本机解析 · 可控入库 · 不上传";
    actions = `${aiChip}<button class="btn" type="button" data-action="nav" data-path="/" aria-label="返回工作台">${icon("arrowLeft", 13)}<span class="topbar-action-label">返回工作台</span></button>`;
  } else if (route.name === "templates") {
    kicker = "TEMPLATE LIBRARY / 模板库";
    title = "把稳定性做进起点";
    center = "模板只是约束，不是答案";
    actions = `${aiChip}<button class="btn" type="button" data-action="nav" data-path="/" aria-label="返回工作台">${icon("arrowLeft", 13)}<span class="topbar-action-label">返回工作台</span></button>`;
  } else if (route.name === "history") {
    kicker = "ARCHIVE / 本机记录";
    title = "历史对话与使用小结";
    center = "IndexedDB 本机存储 · 可备份恢复";
    actions = `${aiChip}<button class="btn" type="button" data-action="nav" data-path="/" aria-label="返回工作台">${icon("arrowLeft", 13)}<span class="topbar-action-label">返回工作台</span></button>`;
  } else if (route.name === "settings") {
    kicker = "SETTINGS / AI 与数据";
    title = "引擎、密钥与数据边界";
    center = "模型密钥只在服务端 · 本地永远可回退";
    actions = `${aiChip}<button class="btn" type="button" data-action="nav" data-path="/" aria-label="返回工作台">${icon("arrowLeft", 13)}<span class="topbar-action-label">返回工作台</span></button>`;
  } else if (route.name === "guide") {
    kicker = "MANUAL / 使用说明";
    title = "能力、边界与扩展方式";
    center = "默认本地运行 · 人工审核是最后一道工序";
    actions = `${aiChip}<button class="btn" type="button" data-action="nav" data-path="/" aria-label="返回工作台">${icon("arrowLeft", 13)}<span class="topbar-action-label">返回工作台</span></button>`;
  }
  topbarEl.innerHTML = `
    <button class="mobile-menu" type="button" data-action="toggle-sidebar" aria-label="打开导航">${icon("menu", 16)}</button>
    <a class="mobile-brand" href="#/" data-action="nav" data-path="/" aria-label="授渔首页"><img src="./assets/brand/logo-mark-inverse.png" alt=""></a>
    <div class="topbar-left">
      <div class="topbar-heading">
        <div class="topbar-kicker">${escapeHtml(kicker)}</div>
        <h1 class="topbar-title">${escapeHtml(title)}</h1>
      </div>
    </div>
    <div class="topbar-center"><span class="topbar-quote">${escapeHtml(center)}</span></div>
    <div class="topbar-right">${actions}</div>
  `;
}

function renderView(activeConv, options, previousChatScroll, previousViewScroll) {
  const route = state.route;
  viewEl.removeAttribute("class");
  viewEl.className = "view";
  if (route.name === "chat" && activeConv) {
    viewEl.innerHTML = renderChatView(activeConv);
    const workspace = viewEl.querySelector(".workspace");
    if (workspace) workspace.classList.toggle("rail-open", state.railOpen);
    requestAnimationFrame(() => {
      const scroller = viewEl.querySelector(".chat-scroll");
      if (!scroller) return;
      scroller.style.scrollBehavior = "auto";
      if (options.preserveScroll && previousChatScroll != null) {
        scroller.scrollTop = previousChatScroll;
      } else if (state.pendingScroll === "result") {
        const cards = scroller.querySelectorAll(".result-card");
        const last = cards[cards.length - 1];
        if (last) {
          const top = last.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
          scroller.scrollTop = Math.max(0, top - 14);
        } else {
          scroller.scrollTop = scroller.scrollHeight;
        }
      } else if (state.pendingScroll === "top") {
        scroller.scrollTop = 0;
      } else {
        scroller.scrollTop = scroller.scrollHeight;
      }
      requestAnimationFrame(() => {
        scroller.style.scrollBehavior = "";
      });
      state.pendingScroll = "auto";
    });
    document.querySelectorAll("[data-role='composer-input']").forEach(autoResize);
    return;
  }
  viewEl.innerHTML = route.name === "kb"
    ? renderKnowledgePage()
    : route.name === "files"
      ? renderFilesPage()
      : route.name === "templates"
        ? renderTemplatesPage()
        : route.name === "history"
          ? renderHistoryPage()
          : route.name === "settings"
            ? renderSettingsPage()
            : route.name === "guide"
              ? renderGuidePage()
              : renderHomePage();
  viewEl.scrollTop = options.preserveScroll ? previousViewScroll || 0 : 0;
  state.pendingScroll = "auto";
  if (route.name === "settings") requestAnimationFrame(refreshStorageUsage);
  document.querySelectorAll("[data-role='composer-input']").forEach(autoResize);
}

/* ==========================================================
   Home
   ========================================================== */

function renderHomePage() {
  const stats = knowledgeStats();
  const sceneCards = SCENES.map((scene) => `
    <button class="scene-card" type="button" data-action="scene" data-scene="${scene.id}">
      <span class="scene-card-top">
        <span>${scene.no} / ${scene.short.toUpperCase()}</span>
        <span class="scene-card-arrow">${icon("arrowUpRight", 14)}</span>
      </span>
      <span class="scene-card-title">${escapeHtml(scene.label)}</span>
      <span class="scene-card-desc">${escapeHtml(scene.desc)}</span>
      <span class="scene-card-foot"><span class="scene-dot"></span>${escapeHtml(scene.output)}</span>
    </button>
  `).join("");

  return `
    <div class="home">
      <div class="home-top">
        <div class="home-top-left">FOR TVET TEACHERS / 工学一体化专用</div>
        <div class="home-top-right">
          <span>KB ${KB_VERSION}</span>
          <span class="cross-mark" aria-hidden="true"></span>
          <span>${aiModeActive() ? (hasValidConsent(state.ai) ? `AI · ${providerLabel(state.ai)}` : "AI · 待授权") : "LOCAL ENGINE"}</span>
        </div>
      </div>

      <section class="hero" aria-labelledby="hero-title">
        <div class="hero-eyebrow">
          <span>AI TEACHING WORKFLOW</span>
          <span>${aiModeActive() ? "大模型 + 知识库 + 人工审核" : "本地引擎 + 知识库 + 人工审核"}</span>
        </div>
        <h1 class="hero-title" id="hero-title">Hey，老师！</h1>
        <p class="hero-subtitle">今天我可以为您做点什么呢？</p>

        <div class="scope-note" aria-label="能力边界">
          <div class="scope-key">我能</div>
          <div class="scope-line">把<strong>专业 + 工作任务 + 学情</strong>变成教案、学习任务单、工作页和评价表；基于知识库回答电工 / PLC 实训安全；把脱敏听课记录整理成评课意见。</div>
          <div class="scope-key">我不做</div>
          <div class="scope-line">学生心理诊断、成绩预测与排名、人事财务法律判断，或处理涉密与未脱敏数据。超范围时我会明确说明，并建议您咨询对应部门。</div>
        </div>
      </section>

      <div class="composer-wrap">
        ${renderComposer(false)}
      </div>

      <section class="scenes" aria-labelledby="scene-title">
        <div class="section-row">
          <div>
            <div class="section-kicker">START WITH A SCENE / 场景入口</div>
            <h2 class="section-title" id="scene-title">不要从空白对话框开始。选一个真实任务。</h2>
          </div>
          <button class="btn-link" type="button" data-action="nav" data-path="/guide">怎么用 →</button>
        </div>
        <div class="scene-grid">${sceneCards}</div>
      </section>

      <div class="home-bottom">
        <div class="kb-strip-left">
          <div class="kb-stack" aria-hidden="true">
            ${KB_DOCS.slice(0, 4).map((doc) => `<i>${doc.id.slice(-2)}</i>`).join("")}
          </div>
          <div class="kb-strip-copy">
            <div class="kb-strip-title">知识库基线 · ${stats.docs} 份材料 / ${stats.sections} 个可检索片段</div>
            <div class="kb-strip-meta">课程标准 · 教案 · 任务单 · 工作页 · 安全规程 · 评价 · 合规 · ${stats.version}</div>
          </div>
        </div>
        <div class="home-legal">
          默认本地处理，不上传输入 · AI 输出仅供参考，正式使用前须人工审核<br>
          <a href="#/kb" data-action="nav" data-path="/kb">查看知识库与依据 →</a>
        </div>
      </div>
    </div>
  `;
}

/* ==========================================================
   Composer
   ========================================================== */

function renderComposer(compact = false) {
  const busy = state.generating || state.chatBusy;
  const attachments = state.attachments.map((file) => `
    <span class="attachment-pill">
      ${icon("file", 10)}
      <span title="${escapeAttr(file.name)}">${escapeHtml(file.name)}</span>
      <button type="button" data-action="remove-attachment" data-id="${escapeAttr(file.id)}" aria-label="移除 ${escapeAttr(file.name)}">${icon("close", 9)}</button>
    </span>
  `).join("");

  const placeholder = compact
    ? "继续追问，或直接说「把学时改成 6」…"
    : "描述您的备课任务，例如：为电气自动化专业生成「正反转控制线路」4 学时教案…";

  return `
    <form class="composer" data-role="composer" aria-label="输入教学任务">
      <textarea data-role="composer-input" rows="2" placeholder="${escapeAttr(placeholder)}" aria-label="输入消息" ${busy ? "disabled" : ""}>${escapeHtml(state.draft)}</textarea>
      ${attachments ? `<div class="attachment-row">${attachments}</div>` : ""}
      <div class="composer-foot">
        <button class="attach-btn" type="button" data-action="attach" ${busy ? "disabled" : ""}>
          ${icon("paperclip", 13)}<span>+ 参考资料</span>
        </button>
        <input type="file" data-role="file-input" accept="${FILE_ACCEPT}" multiple hidden>
        <span class="composer-hint">Enter 发送 · Shift + Enter 换行</span>
        <span class="composer-privacy">${aiModeActive()
          ? (hasValidConsent(state.ai) ? `${icon("spark", 10)} AI 增强 · 发送前隐私检查` : `${icon("shield", 10)} AI 待授权 · 本地处理`)
          : `${icon("shield", 10)} 本地处理 · 不上传`}</span>
        <button class="send-btn" type="submit" aria-label="发送" ${busy ? "disabled" : ""}>
          ${icon("arrowUp", 16)}
        </button>
      </div>
    </form>
  `;
}

/* ==========================================================
   Chat view
   ========================================================== */

function renderChatView(conv) {
  const messages = conv.messages || [];
  const lastResult = [...messages].reverse().find((msg) => msg.kind === "result");
  const lastSources = [...messages].reverse().find((msg) => msg.sources?.length)?.sources || [];
  const artifact = lastResult?.result?.artifact || conv.latestArtifact || null;
  const railData = {
    artifact,
    sources: artifact?.sources || lastSources,
    compliance: artifact?.compliance || lastResult?.result?.compliance || null,
    workflow: lastResult?.result?.workflow || artifact?.workflow || null,
    context: lastResult?.result?.context || conv.context || {}
  };

  return `
    <div class="workspace">
      <div class="rail-backdrop" data-action="close-rail" aria-hidden="true"></div>
      <div class="chat-column">
        <div class="chat-scroll" id="chat-scroll">
          <div class="chat-inner">
            <div class="chat-intro"><span>LOCAL WORKFLOW · 内容保存在此浏览器</span></div>
            ${messages.map((message, index) => renderMessage(message, conv, index)).join("")}
          </div>
        </div>
        <div class="chat-composer-wrap">
          ${renderComposer(true)}
        </div>
      </div>
      ${renderContextRail(railData, conv)}
    </div>
  `;
}

function renderMessage(message, conv, index) {
  if (message.role === "user") {
    const params = message.params ? renderParamChips(message.params, message.scene) : "";
    return `
      <article class="message message-user" data-message-id="${escapeAttr(message.id)}">
        <div class="msg-label"><span>YOU / 教师</span><time datetime="${escapeAttr(message.createdAt)}">${escapeHtml(formatTime(message.createdAt))}</time></div>
        <div class="user-bubble">${escapeHtml(message.text || "")}</div>
        ${params}
        ${message.attachments?.length ? `<div class="attachment-row" style="padding:6px 0 0;justify-content:flex-end">${message.attachments.map((name) => `<span class="attachment-pill">${icon("file", 9)}<span>${escapeHtml(name)}</span></span>`).join("")}</div>` : ""}
      </article>
    `;
  }

  if (message.role === "assistant") {
    if (message.kind === "ai-pending") {
      return `
        <article class="message message-assistant" data-message-id="${escapeAttr(message.id)}">
          ${renderAssistantHead(message)}
          ${message.ai?.kind === "generation" && message.workflow ? renderWorkflowProgress(message.workflow, message.stepIndex || 0) : ""}
          ${renderAIStreamPanel(message)}
        </article>
      `;
    }
    if (message.kind === "pending" || message.kind === "typing") {
      return `
        <article class="message message-assistant" data-message-id="${escapeAttr(message.id)}">
          ${renderAssistantHead(message)}
          ${message.kind === "typing" ? `<div class="assistant-body"><div class="typing"><i></i><i></i><i></i><span>检索知识库…</span></div></div>` : ""}
          ${message.workflow ? renderWorkflowProgress(message.workflow, message.stepIndex || 0) : ""}
        </article>
      `;
    }
    const sources = message.sources || [];
    const suggestions = message.suggestions || [];
    return `
      <article class="message message-assistant" data-message-id="${escapeAttr(message.id)}">
        ${renderAssistantHead(message)}
        ${message.aiError ? `
          <div class="ai-error-note">
            <strong>AI 增强未完成</strong>
            <span>${escapeHtml(message.aiError)}</span>
            ${message.kind === "result" ? `<button class="btn-link" type="button" data-action="retry-ai-generation">重试 AI 增强</button>` : ""}
          </div>
        ` : ""}
        <div class="assistant-body">${mdLite(message.text || "")}</div>
        ${renderAIMessageMeta(message)}
        ${sources.length ? `
          <div class="markdown-sources">
            <span class="markdown-sources-label">依据 / SOURCES</span>
            ${sources.slice(0, 6).map((source) => `<button class="source-chip" type="button" data-action="show-source" data-doc="${escapeAttr(source.docId)}" data-section="${escapeAttr(source.sectionId)}">${escapeHtml(source.ref || refToLabel(source.key, sources))}</button>`).join("")}
            ${sources.length > 6 ? `<button class="source-chip" type="button" data-action="toggle-rail">+${sources.length - 6} 处见右侧依据 →</button>` : ""}
          </div>
        ` : ""}
        ${message.kind === "clarify" ? `
          <div class="clarify-card">
            <strong>我会先问清关键参数，再开始生成。</strong><br>
            这样能避免输出一份“看起来完整、实际上不能用”的空泛模板。您可以直接在输入框补充，或打开参数表单。
          </div>
        ` : ""}
        ${suggestions.length ? `
          <div class="assistant-actions">
            ${suggestions.map((suggestion) => `<button class="suggestion-btn" type="button" data-action="${escapeAttr(suggestion.action || "hint")}" ${suggestion.scene ? `data-scene="${escapeAttr(suggestion.scene)}"` : ""} ${suggestion.payload ? `data-payload="${escapeAttr(suggestion.payload)}"` : ""}>${escapeHtml(suggestion.label)} <span>↗</span></button>`).join("")}
          </div>
        ` : ""}
        ${message.kind === "result" ? renderResultCard(message, conv) : ""}
      </article>
    `;
  }
  return "";
}

function renderAssistantHead(message) {
  const isAI = Boolean(message.ai?.used || message.kind === "ai-pending" || message.aiError);
  const badge = isAI ? "AI-ASSISTED" : message.kind === "result" ? "KNOWLEDGE-GROUNDED" : "SCOPE-GUARDED";
  return `
    <div class="assistant-head">
      <span class="assistant-mark" aria-hidden="true">授</span>
      <span class="assistant-name">授渔</span>
      <span class="assistant-badge${isAI ? " is-ai" : ""}">${badge}</span>
      <time class="assistant-time" datetime="${escapeAttr(message.createdAt)}">${escapeHtml(formatTime(message.createdAt))}</time>
    </div>
  `;
}

function renderAIMessageMeta(message) {
  if (!message.ai?.used) return "";
  const ai = message.ai;
  return `<div class="ai-message-meta">
    ${icon("spark", 10)}
    <span>AI 增强 · ${escapeHtml(ai.provider || "")} ${escapeHtml(ai.model || "")}</span>
    ${ai.duration ? `<span>${(ai.duration / 1000).toFixed(1)} 秒</span>` : ""}
    ${ai.truncated || ai.finishReason === "length" ? `<span class="ai-truncated">输出达到长度上限，可能未写完</span>` : ""}
    <span>人工审核后方可使用</span>
  </div>`;
}

function renderAIStreamPanel(message) {
  const ai = message.ai || {};
  const isChat = ai.kind === "chat";
  return `
    <div class="ai-stream-card" data-ai-stream="${escapeAttr(message.id)}" aria-live="polite">
      <div class="ai-stream-head">
        <span class="ai-live-dot" aria-hidden="true"></span>
        <strong>${isChat ? "AI 正在结合知识库回答" : "AI 正在深度改写教学成果"}</strong>
        <span class="ai-stream-model">${escapeHtml(ai.provider || "AI")} · ${escapeHtml(ai.model || "")}</span>
        <button class="btn btn-ghost ai-stop-btn" type="button" data-action="stop-ai-stream">停止</button>
      </div>
      <div class="ai-stream-sub">
        <span class="ai-stream-status">${ai.streamText ? "正在接收" : "正在连接"}</span>
        <span>已接收 <b class="ai-stream-count">${String((ai.streamText || "").length)}</b> 字</span>
        <span>流式输出 · 可随时停止</span>
      </div>
      <div class="ai-stream-text${isChat ? " is-chat" : ""}">${ai.streamText ? (isChat ? mdLite(ai.streamText) : escapeHtml(ai.streamText)) : `<span class="ai-stream-placeholder">正在连接模型并组织${isChat ? "回答" : "教学结构"}…</span>`}</div>
      <div class="ai-stream-foot">${isChat ? "回答由 AI 生成；知识库依据会在完成后显示。请人工核对。" : "完成后会自动解析为可编辑成果；若失败将回退本地引擎，不会丢失任务条件。"}</div>
    </div>
  `;
}

function renderParamChips(params, scene) {
  const fields = scene === "safety"
    ? [["场所", params.venue], ["操作", params.operation]]
    : scene === "observe"
      ? [["课程", params.course], ["任务", params.task], ["重点", params.focus]]
      : [["专业", params.major], ["任务", params.task], ["课型", params.lessonType], ["学时", params.hours ? `${params.hours} 学时` : ""], ["模板", params.templateName || params.template]];
  const chips = fields.filter(([, value]) => value);
  if (!chips.length) return "";
  return `<div class="user-params">${chips.map(([label, value]) => `<span class="param-chip">${escapeHtml(label)}<b>${escapeHtml(truncate(value, 34))}</b></span>`).join("")}</div>`;
}

function renderWorkflowProgress(workflow, currentIndex) {
  return `
    <div class="workflow-progress" aria-live="polite">
      <div class="wf-head"><strong>多步工作流正在运行</strong><span>${Math.min(currentIndex, workflow.length)} / ${workflow.length}</span></div>
      <ol class="wf-list">
        ${workflow.map((step, index) => {
          const status = index < currentIndex ? "is-done" : index === currentIndex ? "is-active" : "";
          return `<li class="wf-step ${status}" data-wf-index="${index}">
            <span class="wf-step-no">${String(step.index).padStart(2, "0")}</span>
            <span class="wf-step-mark"></span>
            <span>${escapeHtml(step.label)} <span class="wf-step-detail">${escapeHtml(step.detail || "")}</span></span>
          </li>`;
        }).join("")}
      </ol>
    </div>
  `;
}

function renderResultCard(message, conv) {
  const result = message.result;
  const artifact = result?.artifact;
  if (!artifact) return "";
  const activeDocId = state.docTabs[message.id] || artifact.docs[0]?.id;
  const doc = artifact.docs.find((item) => item.id === activeDocId) || artifact.docs[0];
  const feedback = message.feedback || "";
  return `
    <div class="result-card" data-result-id="${escapeAttr(message.id)}" style="scroll-margin-top:16px">
      <div class="result-head">
        <div class="result-kicker">
          <span>${escapeHtml(artifact.sceneLabel || "")}</span>
          <span class="sep"></span>
          <span>${escapeHtml(artifact.template || "")}</span>
          <span class="sep"></span>
          <span>${formatDate(artifact.generatedAt)}</span>
        </div>
        <h2 class="result-title">${escapeHtml(doc?.title || artifact.title || result.title)}</h2>
        <div class="result-sub">
          <span class="mini-tag">AI 辅助草稿</span>
          <span class="mini-tag">待人工审核</span>
          ${artifact.ai?.used ? `<span class="mini-tag mini-tag-ai">${icon("spark", 9)} AI 深度改写 · ${escapeHtml(artifact.ai.model || "")}</span>` : ""}
          <span class="mini-tag">${artifact.sources?.length || 0} 处知识库依据</span>
          ${result.metaSummary?.filter(Boolean).slice(0, 3).map((item) => `<span class="mini-tag">${escapeHtml(item)}</span>`).join("") || ""}
        </div>
      </div>

      <div class="result-toolbar">
        <button class="btn" type="button" data-action="copy-doc" data-message="${escapeAttr(message.id)}">${icon("copy", 12)}复制全文</button>
        <button class="btn" type="button" data-action="export-docx" data-message="${escapeAttr(message.id)}">${icon("download", 12)}导出 DOCX</button>
        <button class="btn" type="button" data-action="export-xlsx" data-message="${escapeAttr(message.id)}">${icon("grid", 12)}导出 Excel</button>
        <button class="btn btn-ghost" type="button" data-action="print-doc" data-message="${escapeAttr(message.id)}">${icon("printer", 12)}PDF / 打印</button>
        <button class="btn btn-ghost" type="button" data-action="download-txt" data-message="${escapeAttr(message.id)}">TXT</button>
        <button class="btn btn-ghost" type="button" data-action="download-md" data-message="${escapeAttr(message.id)}">Markdown</button>
        ${artifact.ai?.rawMarkdown ? `<button class="btn btn-ghost" type="button" data-action="view-ai-raw" data-message="${escapeAttr(message.id)}">${icon("spark", 12)}AI 原文</button>` : ""}
        <span class="spacer"></span>
        <button class="btn btn-ghost" type="button" data-action="edit-artifact" data-message="${escapeAttr(message.id)}">${icon("sliders", 12)}编辑成果</button>
        <button class="btn btn-ghost" type="button" data-action="edit-params">${icon("sliders", 12)}调整参数</button>
      </div>

      ${artifact.docs.length > 1 ? `
        <nav class="doc-tabs" aria-label="成果文档">
          ${artifact.docs.map((item) => `<button class="doc-tab${item.id === doc.id ? " is-active" : ""}" type="button" data-action="set-doc-tab" data-message="${escapeAttr(message.id)}" data-doc-id="${escapeAttr(item.id)}">${escapeHtml(item.label)}</button>`).join("")}
        </nav>
      ` : ""}

      ${doc ? `
        <div class="doc-meta-row">
          ${(doc.meta || []).map((item) => `<div class="doc-meta-item"><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(item.value)}</strong></div>`).join("")}
        </div>
        <div class="doc-body">
          ${doc.sections.map((section) => renderDocSection(section, artifact.sources, message.id, doc.id)).join("")}
        </div>
      ` : ""}

      <div class="result-footer">
        <button class="btn" type="button" data-action="copy-all" data-message="${escapeAttr(message.id)}">${icon("copy", 12)}复制全部文档</button>
        <button class="btn btn-ghost" type="button" data-action="toggle-rail">${icon("shield", 12)}依据与自检</button>
        <span class="feedback-label">这次结果有用吗？</span>
        <button class="feedback-btn${feedback === "up" ? " is-active" : ""}" type="button" data-action="feedback" data-value="up" data-message="${escapeAttr(message.id)}" aria-pressed="${feedback === "up"}">${icon("up", 10)}有用</button>
        <button class="feedback-btn${feedback === "down" ? " is-active" : ""}" type="button" data-action="feedback" data-value="down" data-message="${escapeAttr(message.id)}" aria-pressed="${feedback === "down"}">${icon("down", 10)}需改进</button>
      </div>
    </div>
    <div class="result-note">AI 辅助草稿 · 正式使用前请由教师逐项审核，尤其是设备参数、企业标准、评价权重与安全条款。反馈仅保存在本机。</div>
  `;
}

function renderDocSection(section, sources, messageId, docId) {
  const refs = (section.refs || []).map((ref) => {
    const label = refToLabel(ref, sources);
    const key = sourceKeyFromRef(ref);
    const source = sources.find((item) => item.key === ref || item.sectionId === ref || item.ref === ref);
    return `<button class="ref-chip" type="button" data-action="show-source" data-key="${escapeAttr(key)}" data-ref="${escapeAttr(ref)}" data-doc="${escapeAttr(source?.docId || "")}" data-section="${escapeAttr(source?.sectionId || "")}">${escapeHtml(label)}</button>`;
  }).join("");
  return `
    <section class="doc-section" data-section-id="${escapeAttr(section.id)}">
      <div class="doc-section-head">
        <span class="section-index">${escapeHtml(section.no)}</span>
        <h3 class="section-title-text">${escapeHtml(section.title)}</h3>
        ${section.aiEnhanced ? `<span class="section-ai-badge">${icon("spark", 8)} AI 改写 · 待审核</span>` : ""}
        <button class="section-copy" type="button" data-action="copy-section" data-message="${escapeAttr(messageId)}" data-doc="${escapeAttr(docId)}" data-section="${escapeAttr(section.id)}" title="复制本节" aria-label="复制本节 ${escapeAttr(section.title)}">${icon("copy", 10)}<span>复制</span></button>
      </div>
      <div class="doc-section-body">
        ${renderBlocks(section.blocks)}
      </div>
      ${refs ? `<div class="section-refs"><span class="refs-label">依据</span>${refs}</div>` : ""}
    </section>
  `;
}

function renderBlocks(blocks = []) {
  return blocks.map((block) => {
    if (block.type === "paragraph") {
      return `<p class="doc-paragraph">${escapeHtml(block.text)}</p>`;
    }
    if (block.type === "list") {
      const tag = block.ordered ? "ol" : "ul";
      return `<${tag} class="doc-list">${(block.items || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</${tag}>`;
    }
    if (block.type === "table") {
      return `
        <div class="table-wrap">
          <table class="doc-table">
            <thead><tr>${(block.headers || []).map((cell) => `<th>${escapeHtml(cell)}</th>`).join("")}</tr></thead>
            <tbody>${(block.rows || []).map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell).replace(/\n/g, "<br>")}</td>`).join("")}</tr>`).join("")}</tbody>
          </table>
        </div>
      `;
    }
    if (block.type === "callout") {
      return `
        <div class="doc-callout tone-${escapeAttr(block.tone || "info")}">
          <span class="doc-callout-label">${block.tone === "danger" ? "CAUTION / 安全边界" : block.tone === "warn" ? "CHECK / 需核对" : "NOTE / 说明"}</span>
          ${block.title ? `<span class="doc-callout-title">${escapeHtml(block.title)}</span>` : ""}
          <p>${escapeHtml(block.text)}</p>
        </div>
      `;
    }
    if (block.type === "checklist") {
      return `<div class="doc-check-list">${(block.items || []).map((item) => `<div class="doc-check"><span class="check-square" aria-hidden="true"></span><span>${escapeHtml(item)}</span></div>`).join("")}</div>`;
    }
    if (block.type === "lines") {
      return `<div class="doc-lines">${block.label ? `<div class="doc-lines-label">${escapeHtml(block.label)}</div>` : ""}${Array.from({ length: block.count || 3 }).map(() => `<div class="doc-line"></div>`).join("")}</div>`;
    }
    return "";
  }).join("");
}

function renderContextRail(railData, conv) {
  const { artifact, sources, compliance, workflow, context } = railData;
  const hasData = Boolean(artifact || sources?.length || compliance);
  const contextChips = buildContextChips(context);
  return `
    <aside class="context-rail" aria-label="依据与合规自检">
      <div class="rail-top">
        <div class="rail-kicker">
          <span>EVIDENCE / 本次依据</span>
          <button class="rail-close" type="button" data-action="close-rail" aria-label="关闭依据面板">${icon("close", 12)}</button>
        </div>
        <h2 class="rail-title">每一项，都可回溯</h2>
      </div>
      ${hasData ? `
        ${contextChips.length ? `
          <section class="rail-section">
            <div class="rail-section-head"><h3 class="rail-section-title">任务条件</h3><button class="btn-link" type="button" data-action="edit-params">调整</button></div>
            <div class="ctx-list">${contextChips.map(([label, value]) => `<span class="ctx-chip">${escapeHtml(label)}<b>${escapeHtml(truncate(value, 26))}</b></span>`).join("")}</div>
          </section>
        ` : ""}
        <section class="rail-section">
          <div class="rail-section-head"><h3 class="rail-section-title">引用来源</h3><span class="rail-count">${sources?.length || 0}</span></div>
          ${sources?.length ? `<div class="source-list">${(state.showAllSources ? sources : sources.slice(0, 6)).map((source) => `
            <button class="source-card" type="button" data-action="show-source" data-doc="${escapeAttr(source.docId)}" data-section="${escapeAttr(source.sectionId)}">
              <span class="source-card-top"><span class="source-ref">${escapeHtml(source.ref || refToLabel(source.key, sources))}</span><span class="source-score">${source.score ? `REL ${source.score}` : "DIRECT"}</span></span>
              <span class="source-title">${escapeHtml(source.docTitle)} · ${escapeHtml(source.sectionTitle)}</span>
              ${source.source || source.version ? `<span class="source-meta">${escapeHtml([source.source, source.version].filter(Boolean).join(" · "))}</span>` : ""}
              <span class="source-snippet">${escapeHtml(source.snippet)}</span>
            </button>
          `).join("")}${sources.length > 6 ? `<button class="btn btn-ghost" type="button" data-action="toggle-sources" style="width:100%;margin-top:2px">${state.showAllSources ? "收起引用" : `展开全部 ${sources.length} 处引用`}</button>` : ""}</div>` : `<p class="rail-note" style="padding:0">本次回答没有可引用片段。</p>`}
        </section>
        ${compliance ? `
          <section class="rail-section">
            <div class="rail-section-head"><h3 class="rail-section-title">合规自检</h3><span class="rail-count">${compliance.checks.filter((item) => item.status === "warn").length}</span></div>
            <div class="compliance-list">
              ${compliance.checks.map((item) => `
                <div class="compliance-item ${item.status === "warn" ? "is-warn" : "is-pass"}">
                  <span class="compliance-mark">${item.status === "warn" ? "!" : "✓"}</span>
                  <span class="compliance-copy"><span class="compliance-title">${escapeHtml(item.title)}</span><span class="compliance-detail">${escapeHtml(item.detail)}</span></span>
                </div>
              `).join("")}
            </div>
          </section>
        ` : ""}
        ${workflow ? `
          <section class="rail-section">
            <div class="rail-section-head"><h3 class="rail-section-title">工作流</h3><span class="rail-count">${workflow.length}</span></div>
            <ol class="wf-list">
              ${workflow.map((step) => `<li class="wf-step is-done"><span class="wf-step-no">${String(step.index).padStart(2, "0")}</span><span class="wf-step-mark"></span><span>${escapeHtml(step.label)}</span></li>`).join("")}
            </ol>
          </section>
        ` : ""}
        <div class="rail-note">
          依据来自本机知识库 ${KB_VERSION}。材料为可替换的校本示例，正式使用前请对照学院现行文件。AI 不替代教师判断，也不替代现场安全交底。
        </div>
      ` : `
        <div class="rail-empty">
          <div class="rail-empty-mark" aria-hidden="true"></div>
          <p>生成结果后，这里会显示本次引用的知识库片段、任务条件与合规自检项。</p>
        </div>
        <div class="rail-note">没有任何回答可以跳过人工审核。学生个人信息请不要输入。</div>
      `}
    </aside>
  `;
}

function buildContextChips(context) {
  if (!context) return [];
  const chips = [];
  if (context.scene === "safety") {
    if (context.venue) chips.push(["场所", context.venue]);
    if (context.operation) chips.push(["操作", context.operation]);
    if (context.audience) chips.push(["人员", context.audience]);
    if (context.focus) chips.push(["关注", context.focus]);
    return chips;
  }
  if (context.scene === "observe") {
    if (context.course && context.course !== "未填写课程") chips.push(["课程", context.course]);
    if (context.task && context.task !== "待明确学习任务") chips.push(["任务", context.task]);
    if (context.focus) chips.push(["关注", context.focus]);
    if (context.templateName) chips.push(["风格", context.templateName]);
    return chips;
  }
  if (context.major && context.major !== "未填写专业") chips.push(["专业", context.major]);
  if (context.course && context.course !== "未填写课程") chips.push(["课程", context.course]);
  if (context.task && context.task !== "待明确学习任务") chips.push(["任务", context.task]);
  if (context.lessonType) chips.push(["课型", context.lessonType]);
  if (context.hours) chips.push(["学时", `${context.hours} 学时`]);
  if (context.focus) chips.push(["关注", context.focus]);
  if (context.templateName) chips.push(["模板", context.templateName]);
  return chips.slice(0, 8);
}

/* ==========================================================
   Knowledge page
   ========================================================== */



function getKbResults() {
  let docs = KB_DOCS;
  if (state.kbCategory !== "全部") docs = docs.filter((doc) => doc.category === state.kbCategory);
  const query = state.kbQuery.trim();
  let matches = null;
  if (query) {
    matches = searchKnowledge(query, state.kbCategory === "全部" ? "" : state.kbCategory);
    const ids = Array.from(new Set(matches.map((item) => item.docId)));
    docs = docs.filter((doc) => ids.includes(doc.id)).sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
  }
  return { docs, matches };
}

function renderKnowledgePage() {
  const stats = knowledgeStats();
  const cats = Array.from(new Set(KB_DOCS.map((doc) => doc.category)));
  return `
    <div class="page">
      <div class="page-head">
        <div>
          <div class="page-kicker">KNOWLEDGE BASE / 真实性优先</div>
          <h1 class="page-title">有依据，才回答。</h1>
          <p class="page-intro">所有回答都从这里的材料检索。材料没有覆盖的问题，助手会明确说“不知道”，而不是编一个看起来很真的答案。当前收录 ${KB_DOCS.length} 份示例材料，覆盖 12 个专业方向；正式使用时请替换为学院现行文件。你可以新增、导入、编辑或删除自己的材料。</p>
        </div>
        <div class="page-head-side">
          <strong>知识库管理</strong>
          12 个专业包 · 关键词 + 概念扩展（本地混合检索）<br>
          自定义材料支持新增 / 导入 / 删除<br>
          <div class="page-head-actions">
            <button class="btn" type="button" data-action="toggle-kb-manage">${state.kbManageMode ? "退出管理" : "管理知识库"}</button>
            <button class="btn btn-ghost" type="button" data-action="new-kb-doc">+ 新增材料</button>
          </div>
        </div>
      </div>
      <div class="page-stats">
        <div class="stat"><div class="stat-value">${String(stats.docs).padStart(2, "0")}</div><div class="stat-label">DOCUMENTS / 材料</div></div>
        <div class="stat"><div class="stat-value">${String(stats.sections).padStart(2, "0")}</div><div class="stat-label">SECTIONS / 可检索片段</div></div>
        <div class="stat"><div class="stat-value">${String(cats.length).padStart(2, "0")}</div><div class="stat-label">CATEGORIES / 分类</div></div>
        <div class="stat"><div class="stat-value" style="font-size:15px;line-height:1.4">${escapeHtml(stats.version)}</div><div class="stat-label">LOCAL BASELINE / 当前基线</div></div>
      </div>
      <div class="kb-tools">
        <div class="search-field">
          ${icon("search", 13)}
          <input type="search" placeholder="搜索“互锁”“过程性评价”“上电前检查”…" value="${escapeAttr(state.kbQuery)}" data-role="kb-search" aria-label="搜索知识库">
        </div>
        <div class="filter-row" role="group" aria-label="知识库分类">
          ${getKnowledgeCategories().map((cat) => `<button class="filter-btn${state.kbCategory === cat ? " is-active" : ""}" type="button" data-action="set-kb-cat" data-cat="${escapeAttr(cat)}">${escapeHtml(cat)}</button>`).join("")}
        </div>
      </div>
      <div id="kb-grid">${renderKbGrid()}</div>
      ${state.kbManageMode ? renderKbManagePanel() : ""}
      <div class="kb-note">
        <strong>为什么仍标注示例？</strong> 12 个专业包是教学参考结构，不是学院正式制度，也没有伪造标准号。材料可由教师新增 / 导入 / 编辑，引用会自动回溯到章节。<br>
        操作级安全查询仍只提供电工 / PLC 专项规程；其他专业包提供教学安全提示，但不能替代现场规程、设备说明书和安全交底。
      </div>
    </div>
  `;
}

function renderKbGrid() {
  const { docs, matches } = getKbResults();
  if (!docs.length) {
    return `
      <div class="empty-state">
        <div class="empty-mark"></div>
        <h2 class="empty-title">没有检索到匹配材料</h2>
        <p class="empty-copy">试试更短的关键词，如“评价”“互锁”“教案”；也可以清空搜索查看全部 ${KB_DOCS.length} 份材料。</p>
        <button class="btn" type="button" data-action="clear-kb-search">清空搜索</button>
      </div>
    `;
  }
  return `<div class="kb-grid">${docs.map((doc, index) => {
    const hit = matches?.find((item) => item.docId === doc.id);
    return `
      <button class="kb-card" type="button" data-action="open-doc" data-doc="${escapeAttr(doc.id)}" data-section="${escapeAttr(hit?.sectionId || "")}">
        <div class="kb-card-top">
          <span>${doc.id} / ${String(index + 1).padStart(2, "0")}</span>
          <span class="kb-card-cat">${escapeHtml(doc.category)}</span>
        </div>
        <h2 class="kb-card-title">${escapeHtml(doc.title)}</h2>
        <p class="kb-card-summary">${hit ? `命中「${escapeHtml(hit.sectionTitle)}」：${escapeHtml(hit.snippet)}` : escapeHtml(doc.summary)}</p>
        <div class="tag-row">${(doc.tags || []).slice(0, 3).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>
        <div class="kb-card-foot">
          <span class="btn-link">阅读全文 →</span>
          <span class="meta">${doc.sections.length} 节 · ${escapeHtml(doc.updated)}</span>
        </div>
      </button>
    `;
  }).join("")}</div>`;
}

function renderKbManagePanel() {
  const custom = KB_DOCS.filter((doc) => !doc.builtin);
  return `
    <section class="kb-manage-panel">
      <div class="kb-manage-head">
        <div>
          <div class="page-kicker" style="margin:0">MANAGE / 自定义材料</div>
          <h2>可编辑知识库</h2>
          <p>内置材料保持只读，避免演示数据被误改。你新增、导入或从内置材料复制出的内容，都在这里维护。</p>
        </div>
        <div class="kb-manage-actions">
          <button class="btn btn-solid" type="button" data-action="new-kb-doc">${icon("plus", 12)}新增材料</button>
          <button class="btn" type="button" data-action="import-kb-json">${icon("file", 12)}批量导入 JSON</button>
          <button class="btn btn-ghost" type="button" data-action="export-kb-json">${icon("download", 12)}导出自定义库</button>
          <input type="file" data-role="kb-import-file" accept=".json,application/json" hidden>
        </div>
      </div>
      ${custom.length ? `<div class="kb-manage-list">${custom.map((doc) => `
        <article class="kb-manage-row">
          <div class="kb-manage-row-main">
            <span class="kb-manage-id">${escapeHtml(doc.id)} · ${escapeHtml(doc.category || "未分类")}</span>
            <h3>${escapeHtml(doc.title)}</h3>
            <p>${doc.sections.length} 节 · ${escapeHtml(doc.version || "自定义 v1")} · ${escapeHtml(doc.updated || "")}${doc.versions?.length ? ` · ${doc.versions.length} 个历史版本` : ""}</p>
          </div>
          <div class="kb-manage-row-actions">
            <button class="btn btn-ghost" type="button" data-action="edit-kb-doc" data-id="${escapeAttr(doc.id)}">编辑</button>
            <button class="btn btn-ghost" type="button" data-action="delete-kb-doc" data-id="${escapeAttr(doc.id)}">${icon("trash", 11)}删除</button>
          </div>
        </article>
      `).join("")}</div>` : `<div class="kb-manage-empty">还没有自定义材料。新增一份，或从“阅读全文”里复制内置材料后修改。</div>`}
      <p class="settings-note">自定义材料保存在本机 IndexedDB；不会自动同步，也不会自动上传。加入 AI 上下文前仍会执行隐私检查。</p>
    </section>
  `;
}

function openKnowledgeDocForm(source = null, { copy = false } = {}) {
  const editing = Boolean(source && !copy && !source.builtin);
  const doc = source ? { ...source } : null;
  const categories = Array.from(new Set([...getKnowledgeCategories().filter((cat) => cat !== "全部"), "教师资料"]));
  const specialties = SPECIALTY_PACKS.map((pack) => pack.name);
  const content = doc?.sections?.map((section) => `## ${section.title}\n${section.text}${section.bullets?.length ? `\n${section.bullets.map((bullet) => `- ${bullet}`).join("\n")}` : ""}`).join("\n\n") || "";
  openModal({
    kind: "confirm",
    narrow: false,
    kicker: editing ? "EDIT / 知识材料" : copy ? "COPY / 复制内置材料" : "NEW / 新增知识材料",
    title: editing ? "编辑自定义材料" : copy ? "复制为可编辑材料" : "新增一份知识材料",
    sub: "来源、适用范围与版本必须如实填写。不要伪造国家标准、学校制度或企业数据。",
    body: `
      <form id="kb-doc-form" class="kb-doc-form" data-doc-id="${escapeAttr(doc?.id || "")}" data-editing="${editing ? "true" : "false"}">
        <div class="form-grid">
          <div class="field field-full"><label for="kb-title">资料名称 <span class="required-mark">必填</span></label><input id="kb-title" name="title" required value="${escapeAttr(doc ? (copy ? `${doc.title}（副本）` : doc.title) : "")}" placeholder="例如：数控实训室上电检查清单"></div>
          <div class="field"><label for="kb-category">分类</label><input id="kb-category" name="category" list="kb-category-list" value="${escapeAttr(doc?.category || "教师资料")}"><datalist id="kb-category-list">${categories.map((cat) => `<option value="${escapeAttr(cat)}"></option>`).join("")}</datalist></div>
          <div class="field"><label for="kb-specialty">所属专业</label><select id="kb-specialty" name="specialty"><option value="">通用 / 未指定</option>${specialties.map((name) => `<option value="${escapeAttr(name)}" ${doc?.specialty === name ? "selected" : ""}>${escapeHtml(name)}</option>`).join("")}</select></div>
          <div class="field"><label for="kb-course">所属课程</label><input id="kb-course" name="course" value="${escapeAttr(doc?.course || "")}" placeholder="可留空"></div>
          <div class="field"><label for="kb-source">资料来源</label><input id="kb-source" name="source" value="${escapeAttr(doc?.source || "教师自建 · 本机")}" placeholder="如：校本教学团队整理"></div>
          <div class="field"><label for="kb-author">作者 / 发布单位</label><input id="kb-author" name="author" value="${escapeAttr(doc?.author || "教师自建")}" placeholder="已知时填写"></div>
          <div class="field"><label for="kb-version">版本号</label><input id="kb-version" name="version" value="${escapeAttr(doc?.version || "教师自建 v1.0")}"></div>
          <div class="field"><label for="kb-published">发布时间</label><input id="kb-published" name="published" type="date" value="${escapeAttr(doc?.published || new Date().toISOString().slice(0, 10))}"></div>
          <div class="field field-full"><label for="kb-scope">适用范围与免责声明</label><textarea id="kb-scope" name="scope" rows="2">${escapeHtml(doc?.scope || "教师自建材料，未经学校审核，不作为正式制度或标准依据；使用前请核对原文。")}</textarea></div>
          <div class="field field-full"><label for="kb-summary">摘要</label><input id="kb-summary" name="summary" value="${escapeAttr(doc?.summary || "")}" placeholder="一句话说明这份材料解决什么问题"></div>
          <div class="field field-full"><label for="kb-tags">标签（逗号分隔）</label><input id="kb-tags" name="tags" value="${escapeAttr((doc?.tags || []).join("，"))}" placeholder="数控，对刀，安全"></div>
          <div class="field field-full"><label for="kb-content">正文 <span class="required-mark">必填</span></label><textarea id="kb-content" name="content" rows="14" required placeholder="用 ## 小节标题 组织内容；没有标题时会自动按语义分块。">${escapeHtml(content)}</textarea><span class="field-hint">每节会变成可检索、可引用的章节；保存前会做重复检测与隐私检查。</span></div>
        </div>
        <div class="settings-actions">
          <button class="btn btn-solid" type="submit" form="kb-doc-form">${editing ? "保存修改" : "保存材料"}</button>
          <span class="ai-test-result">${editing ? `旧版本会进入历史版本（最多保留 5 个）` : "内置材料仍保持只读"}</span>
        </div>
      </form>
    `,
    focusSelector: "#kb-title",
    footer: `<button class="btn btn-ghost" type="button" data-action="close-modal">取消</button><span class="spacer"></span><span class="settings-note">保存到本机 IndexedDB</span>`
  });
}

function sectionsFromKnowledgeContent(content, docId) {
  const text = String(content || "").trim();
  if (!text) return [];
  if (!/^##\s+/m.test(text)) {
    return chunkDocument(text, { maxChars: 1200, overlap: 100 }).map((chunk, index) => ({
      id: `${docId}-${index + 1}`,
      no: String(index + 1).padStart(2, "0"),
      title: `资料片段 ${String(index + 1).padStart(2, "0")}`,
      text: chunk.text,
      bullets: []
    }));
  }
  const lines = text.split("\n");
  const sections = [];
  let current = null;
  for (const line of lines) {
    if (/^##\s+/.test(line.trim())) {
      if (current && current.lines.join("\n").trim()) sections.push(current);
      current = { title: line.trim().replace(/^##\s+/, ""), lines: [] };
    } else if (current) {
      current.lines.push(line);
    } else {
      current = { title: "资料说明", lines: [line] };
    }
  }
  if (current) sections.push(current);
  return sections.filter((section) => section.lines.join("\n").trim()).map((section, index) => ({
    id: `${docId}-${index + 1}`,
    no: String(index + 1).padStart(2, "0"),
    title: section.title,
    text: section.lines.join("\n").trim(),
    bullets: []
  }));
}

async function saveKnowledgeDocForm(form) {
  const data = Object.fromEntries(new FormData(form).entries());
  const existing = KB_DOCS.find((doc) => doc.id === form.dataset.docId);
  const editing = form.dataset.editing === "true";
  if (!data.title?.trim() || !data.content?.trim()) {
    showToast("资料名称和正文不能为空");
    return;
  }
  const findings = detectSensitive([
    data.title,
    data.course,
    data.source,
    data.author,
    data.summary,
    data.tags,
    data.scope,
    data.content
  ].filter(Boolean).join("\n"));
  if (findings.length) {
    showToast(`材料中检测到 ${findings.length} 处可能的个人信息，请先脱敏再保存`);
    return;
  }
  const id = editing && existing ? existing.id : `USER-${Date.now().toString(36).toUpperCase()}`;
  const sections = sectionsFromKnowledgeContent(data.content, id);
  if (!sections.length) {
    showToast("正文没有可保存的内容");
    return;
  }
  const now = new Date().toISOString();
  const doc = {
    id,
    title: data.title.trim(),
    category: data.category?.trim() || "教师资料",
    specialty: data.specialty || "",
    course: data.course?.trim() || "",
    source: data.source?.trim() || "教师自建 · 本机",
    author: data.author?.trim() || "教师自建",
    published: data.published || now.slice(0, 10),
    version: data.version?.trim() || "教师自建 v1.0",
    updated: now,
    scope: data.scope?.trim() || "教师自建材料，未经学校审核。",
    summary: data.summary?.trim() || sections[0].text.slice(0, 120),
    tags: String(data.tags || "").split(/[,，]/).map((tag) => tag.trim()).filter(Boolean),
    sections,
    builtin: false,
    custom: true
  };
  const duplicate = findDuplicateKnowledgeDoc(doc);
  if (duplicate) {
    showToast(`检测到与《${duplicate.title}》内容重复，已取消保存`);
    return;
  }
  if (editing && existing) {
    doc.versions = [...(existing.versions || []), {
      savedAt: now,
      title: existing.title,
      version: existing.version,
      sections: existing.sections,
      summary: existing.summary
    }].slice(-5);
  }
  try {
    addOrUpdateCustomDoc(doc);
    state.customDocs = KB_DOCS.filter((item) => !item.builtin);
    registerCustomKnowledgeDocs(state.customDocs);
    await localDB.saveKnowledgeDoc(doc);
    closeModal();
    showToast(editing ? "知识材料已更新并保存版本" : "知识材料已加入可检索库");
    renderApp({ preserveScroll: true });
  } catch (error) {
    showToast(error.message || "知识材料保存失败");
  }
}

async function importKnowledgeJson(file) {
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const docs = Array.isArray(data) ? data : Array.isArray(data.docs) ? data.docs : [];
    if (!docs.length) throw new Error("文件中没有 docs 数组");
    let added = 0;
    let skipped = 0;
    let privacySkipped = 0;
    for (const raw of docs.slice(0, 100)) {
      if (!raw?.title || !Array.isArray(raw.sections) || !raw.sections.length) {
        skipped += 1;
        continue;
      }
      const rawText = `${raw.title}\n${raw.source || ""}\n${raw.author || ""}\n${raw.summary || ""}\n${(raw.sections || []).map((section) => `${section.title || ""} ${section.text || ""}`).join("\n")}`;
      if (detectSensitive(rawText).length) {
        privacySkipped += 1;
        skipped += 1;
        continue;
      }
      const id = `USER-${Date.now().toString(36).toUpperCase()}-${added + skipped + 1}`;
      const doc = {
        ...raw,
        id,
        builtin: false,
        custom: true,
        category: raw.category || "教师资料",
        source: raw.source || "教师导入 · 本机",
        author: raw.author || "教师导入",
        version: raw.version || "导入材料 v1",
        tags: Array.isArray(raw.tags) ? raw.tags : [],
        updated: new Date().toISOString(),
        sections: raw.sections.map((section, index) => ({
          id: `${id}-${index + 1}`,
          no: String(index + 1).padStart(2, "0"),
          title: section.title || `片段 ${index + 1}`,
          text: section.text || "",
          bullets: Array.isArray(section.bullets) ? section.bullets : []
        })).filter((section) => section.text)
      };
      if (!doc.sections.length || findDuplicateKnowledgeDoc(doc)) {
        skipped += 1;
        continue;
      }
      addOrUpdateCustomDoc(doc);
      await localDB.saveKnowledgeDoc(doc);
      added += 1;
    }
    state.customDocs = KB_DOCS.filter((item) => !item.builtin);
    registerCustomKnowledgeDocs(state.customDocs);
    showToast(`导入完成：新增 ${added} 份，跳过 ${skipped} 份（${privacySkipped} 份含疑似个人信息，未导入）`);
    renderApp({ preserveScroll: true });
  } catch (error) {
    showToast(`知识库导入失败：${error.message || "不是有效 JSON"}`);
  }
}

function refreshKbGrid() {
  const grid = document.getElementById("kb-grid");
  if (grid) grid.innerHTML = renderKbGrid();
  document.querySelectorAll("[data-action='set-kb-cat']").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.cat === state.kbCategory);
  });
}

/* ==========================================================
   Templates page
   ========================================================== */

function renderTemplatesPage() {
  const renderTemplateCards = (items, scene, type) => items.map((item, index) => `
    <button class="template-card" type="button" data-action="use-template" data-scene="${escapeAttr(scene)}" data-template-kind="${escapeAttr(type)}" data-template-id="${escapeAttr(item.id)}">
      <div class="template-top">
        <span class="template-tag">${escapeHtml(item.tag || "TEMPLATE")}</span>
        <span class="template-id">T-${String(index + 1).padStart(2, "0")}</span>
      </div>
      <h3 class="template-name">${escapeHtml(item.name)}</h3>
      <p class="template-desc">${escapeHtml(item.desc)}</p>
      <ol class="outline-list">
        ${(item.outline || ["参数确认", "知识检索", "结构化生成", "合规自检"]).map((line) => `<li>${escapeHtml(line)}</li>`).join("")}
      </ol>
      <span class="btn">使用此模板 ${icon("arrowRight", 12)}</span>
    </button>
  `).join("");

  return `
    <div class="page">
      <div class="page-head">
        <div>
          <div class="page-kicker">TEMPLATE LIBRARY / 可复用</div>
          <h1 class="page-title">把稳定性做进起点。</h1>
          <p class="page-intro">模板规定结构，不替教师做判断。选择一个模板后，系统仍会先问专业、任务、课型、学时与学情，再基于知识库生成内容。</p>
        </div>
        <div class="page-head-side">
          <strong>模板是可扩展的</strong>
          课型模板 / 评价量表 / 反馈风格<br>
          新增模板不需要改页面结构<br>
          生成结果仍可逐段修改、复制、导出
        </div>
      </div>

      <section class="template-section">
        <div class="template-section-head">
          <h2 class="template-section-title">教案结构 <small>${LESSON_TEMPLATES.length} TEMPLATES</small></h2>
          <span class="page-kicker" style="margin:0">LESSON</span>
        </div>
        <div class="template-grid">${renderTemplateCards(LESSON_TEMPLATES, "lesson", "lesson")}</div>
      </section>

      <section class="template-section">
        <div class="template-section-head">
          <h2 class="template-section-title">评价与听评课 <small>${EVAL_TEMPLATES.length + OBSERVATION_TEMPLATES.length} TEMPLATES</small></h2>
          <span class="page-kicker" style="margin:0">ASSESSMENT</span>
        </div>
        <div class="template-grid">
          ${renderTemplateCards(EVAL_TEMPLATES, "evaluate", "eval")}
          ${renderTemplateCards(OBSERVATION_TEMPLATES, "observe", "observe")}
        </div>
      </section>

      <div class="kb-note">
        <strong>如何新增模板？</strong> 在 <code>js/knowledge.js</code> 的 <code>LESSON_TEMPLATES</code>、<code>EVAL_TEMPLATES</code> 或 <code>OBSERVATION_TEMPLATES</code> 中增加一项，填写 id、名称、说明与结构预览即可。工作流会自动出现在此页，并可在表单中选择。模板只控制结构与表达，不改变引用与人工审核机制。
      </div>
    </div>
  `;
}

/* ==========================================================
   History page
   ========================================================== */

function conversationHasArtifact(conv) {
  return Boolean(conv.latestArtifact || conv.messages.some((msg) => msg.kind === "result"));
}

function feedbackOf(conv) {
  const messages = [...(conv.messages || [])].reverse();
  const withFeedback = messages.find((msg) => msg.feedback);
  return withFeedback?.feedback || "";
}

function conversationCategory(conv) {
  return conv?.category || (conv?.scene ? sceneShort(conv.scene) : "通用对话");
}

function filteredConversations() {
  const all = sortedConversations();
  const query = state.historyQuery.trim().toLowerCase();
  return all.filter((conv) => {
    if (state.historyCategory !== "全部" && conversationCategory(conv) !== state.historyCategory) return false;
    if (!query) return true;
    return `${conv.title} ${conv.category || ""} ${conv.scene || ""} ${conv.context?.task || ""} ${conv.context?.major || ""}`.toLowerCase().includes(query);
  });
}

function renderHistoryPage() {
  const all = sortedConversations();
  const filtered = filteredConversations();
  const categories = ["全部", ...Array.from(new Set(all.map(conversationCategory)))];
  const artifactCount = all.reduce((sum, conv) => sum + (conv.latestArtifact?.docs?.length || 0), 0);
  const sourceCount = all.reduce((sum, conv) => sum + (conv.latestArtifact?.sources?.length || 0), 0);
  const useful = all.filter((conv) => feedbackOf(conv) === "up").length;
  const bad = all.filter((conv) => feedbackOf(conv) === "down").length;

  return `
    <div class="page">
      <div class="page-head">
        <div>
          <div class="page-kicker">ARCHIVE / 自动保存在本机</div>
          <h1 class="page-title">历史对话与使用小结。</h1>
          <p class="page-intro">每个生成结果都会自动保存在当前浏览器，不上传服务器。您可随时找回、收藏、改名、批量删除或导出备份。这里的使用统计只用于改进工具，不包含学生个人信息。</p>
        </div>
        <div class="page-head-side">
          <strong>数据边界</strong>
          存储位置：浏览器 IndexedDB<br>
          可导出 JSON 备份 / 恢复<br>
          换设备不会自动同步
        </div>
      </div>
      <div class="page-stats">
        <div class="stat"><div class="stat-value">${String(all.length).padStart(2, "0")}</div><div class="stat-label">CONVERSATIONS / 对话</div></div>
        <div class="stat"><div class="stat-value">${String(artifactCount).padStart(2, "0")}</div><div class="stat-label">DELIVERABLES / 生成文档</div></div>
        <div class="stat"><div class="stat-value">${String(sourceCount).padStart(2, "0")}</div><div class="stat-label">CITATIONS / 引用依据</div></div>
        <div class="stat"><div class="stat-value">${useful}<span style="font-family:var(--mono);font-size:9px;color:var(--muted);margin-left:5px">/ ${bad}</span></div><div class="stat-label">HELPFUL / 有用 · 需改进</div></div>
      </div>
      <div class="history-tools">
        <div class="search-field">
          ${icon("search", 13)}
          <input type="search" placeholder="搜索标题、专业、任务或分类…" value="${escapeAttr(state.historyQuery)}" data-role="history-search" aria-label="搜索历史对话">
        </div>
        <button class="btn" type="button" data-action="nav" data-path="/">${icon("plus", 12)}新建对话</button>
      </div>
      <div class="history-categories" role="group" aria-label="对话分类">
        ${categories.map((cat) => `<button class="filter-btn${state.historyCategory === cat ? " is-active" : ""}" type="button" data-action="set-history-cat" data-cat="${escapeAttr(cat)}">${escapeHtml(cat)}</button>`).join("")}
      </div>
      <div class="history-batch-bar${state.historySelected.length ? " is-active" : ""}">
        <label class="history-select-all"><input type="checkbox" data-role="history-select-all" ${filtered.length && filtered.every((conv) => state.historySelected.includes(conv.id)) ? "checked" : ""}> 全选当前筛选</label>
        <span class="history-selected-count">已选 ${state.historySelected.length} 条</span>
        <span class="spacer"></span>
        <button class="btn btn-ghost" type="button" data-action="export-conversations">导出备份</button>
        <button class="btn btn-ghost" type="button" data-action="batch-delete-history" ${state.historySelected.length ? "" : "disabled"}>删除所选</button>
      </div>
      <div id="history-list">${renderHistoryList(filtered)}</div>
      <div class="history-note">
        提示：反馈统计只累计本机点击，不支持远程收集；如需写“试用反馈”材料，请邀请同事如实使用后记录，不要编造数据。<br>
        历史记录优先保存在 IndexedDB；可到“AI 与数据设置”导出或恢复备份。
      </div>
    </div>
  `;
}

function renderHistoryList(list) {
  if (!list.length) {
    return `
      <div class="empty-state">
        <div class="empty-mark"></div>
        <h2 class="empty-title">${state.historyQuery ? "没有匹配的记录" : "还没有历史记录"}</h2>
        <p class="empty-copy">${state.historyQuery ? "换一个关键词试试。" : "从一次真实的备课任务开始。生成的内容会自动保存在这里，方便下次继续修改。"}</p>
        <button class="btn" type="button" data-action="nav" data-path="/">去备课工作台</button>
      </div>
    `;
  }
  return `<div class="history-list">${list.map((conv) => {
    const lastResult = [...conv.messages].reverse().find((msg) => msg.kind === "result");
    const feedback = feedbackOf(conv);
    const selected = state.historySelected.includes(conv.id);
    return `
      <article class="history-card${selected ? " is-selected" : ""}">
        <label class="history-check" title="选择此对话">
          <input type="checkbox" data-role="history-select" data-id="${escapeAttr(conv.id)}" ${selected ? "checked" : ""} aria-label="选择对话 ${escapeAttr(conv.title || "未命名")}">
        </label>
        <button class="history-main" type="button" data-action="open-conv" data-id="${escapeAttr(conv.id)}">
          <div class="history-kicker">
            <span>${escapeHtml(conversationCategory(conv))}</span>
            <span>·</span>
            <span>${escapeHtml(formatDate(conv.updatedAt))} ${escapeHtml(formatTime(conv.updatedAt))}</span>
            ${conv.pinned ? "<span>· 已收藏</span>" : ""}
            ${feedback ? `<span class="history-feedback">${feedback === "up" ? "有用 ↑" : "需改进 ↓"}</span>` : ""}
          </div>
          <h2 class="history-title">${escapeHtml(conv.title || "未命名对话")}</h2>
          <div class="history-summary">
            ${conv.context?.major ? `<span>${escapeHtml(conv.context.major)}</span>` : ""}
            ${conv.context?.task ? `<span>${escapeHtml(truncate(conv.context.task, 34))}</span>` : ""}
            ${lastResult?.result?.artifact ? `<span>${lastResult.result.artifact.docs?.length || 0} 份文档</span><span>${lastResult.result.artifact.sources?.length || 0} 处依据</span>` : `<span>对话记录</span>`}
          </div>
        </button>
        <div class="history-actions">
          <button class="icon-btn" type="button" data-action="rename-conv" data-id="${escapeAttr(conv.id)}" title="修改标题" aria-label="修改对话标题">${icon("sliders", 12)}</button>
          <button class="icon-btn${conv.pinned ? " is-pinned" : ""}" type="button" data-action="pin-conv" data-id="${escapeAttr(conv.id)}" title="${conv.pinned ? "取消收藏" : "收藏"}" aria-label="${conv.pinned ? "取消收藏" : "收藏"}">${icon("pin", 12)}</button>
          <button class="icon-btn" type="button" data-action="delete-conv" data-id="${escapeAttr(conv.id)}" title="删除" aria-label="删除对话">${icon("trash", 12)}</button>
        </div>
      </article>
    `;
  }).join("")}</div>`;
}

function refreshHistoryList() {
  const filtered = filteredConversations();
  const list = document.getElementById("history-list");
  if (list) list.innerHTML = renderHistoryList(filtered);
  const count = document.querySelector(".history-selected-count");
  if (count) count.textContent = `已选 ${state.historySelected.length} 条`;
  document.querySelectorAll("[data-action='set-history-cat']").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.cat === state.historyCategory);
  });
  const batchButton = document.querySelector("[data-action='batch-delete-history']");
  if (batchButton) batchButton.disabled = !state.historySelected.length;
  const allCheck = document.querySelector("[data-role='history-select-all']");
  if (allCheck) allCheck.checked = filtered.length > 0 && filtered.every((conv) => state.historySelected.includes(conv.id));
  document.querySelector(".history-batch-bar")?.classList.toggle("is-active", state.historySelected.length > 0);
}

/* ==========================================================
   Guide page
   ========================================================== */

function renderGuidePage() {
  return `
    <div class="page">
      <div class="page-head">
        <div>
          <div class="page-kicker">MANUAL / 作品说明</div>
          <h1 class="page-title">先说边界，再谈智能。</h1>
          <p class="page-intro">授渔只服务一件事：把工学一体化备课从“写一份看起来完整的方案”，变成“拿到一份可以修改、可以上课、可以审核的教学成果”。V2 提供本地与 AI 增强双引擎：本地模式永远可用；AI 模式需要明确授权，可流式生成，并在失败时自动回退。</p>
        </div>
        <div class="page-head-side">
          <strong>当前版本</strong>
          V2.0 · ${escapeHtml(KB_VERSION)}<br>
          本地引擎 + 可选 AI 安全代理<br>
          在线：<a href="https://htfyu.github.io/jiangbei-teacher/" target="_blank" rel="noopener">htfyu.github.io/jiangbei-teacher</a>
        </div>
      </div>

      <div class="guide-grid">
        <div class="guide-main">
          <section>
            <h2 class="guide-h2" data-no="01">这个助手做什么，不做什么</h2>
            <p class="guide-p"><strong>做：</strong>根据专业、课程、工作任务、课型、学时和学情，生成 / 改写教案、学习任务单、六步工作页与评价表；检索 12 个专业方向的课程与教学材料；检索电工 / PLC 操作级安全规程；把脱敏听课记录整理成证据型评课意见；解析 DOCX / PDF / XLSX / PPTX 等资料并在本机建立知识库。</p>
            <p class="guide-p"><strong>不做：</strong>不诊断学生心理，不预测成绩或给学生贴标签，不处理人事、财务、法律与医疗判断，不接收涉密或未脱敏数据。遇到超范围问题，助手会说明“不在我的知识范围内”，并给出咨询方向。</p>
            <div class="role-grid">
              <div class="role-card"><h4>先问清，再生成</h4><p>专业、任务、课型、学时、学情未齐时，先追问或弹出参数表单，避免一问就瞎答。</p></div>
              <div class="role-card"><h4>知识库没有就承认</h4><p>安全查询只返回知识库可支持的内容；未收录的场所会明确说“没有”，不编造规程。</p></div>
              <div class="role-card"><h4>可编辑、可导出</h4><p>成果支持分栏编辑、模块拖动排序、撤销恢复与自动保存；可导出 DOCX、XLSX、TXT、Markdown，PDF 通过浏览器打印另存。</p></div>
              <div class="role-card"><h4>人工审核是工序</h4><p>每份结果都带“待人工审核”标记和合规自检；AI 只改写关键模块，失败自动回退本地，不把草稿伪装成正式文件。</p></div>
            </div>
          </section>

          <section>
            <h2 class="guide-h2" data-no="02">能力地图与比赛要求</h2>
            <p class="guide-p">对应“5 类功能”的自检如下，均可现场演示：</p>
            <table class="mapping-table">
              <thead><tr><th>要求</th><th>作品中的落点</th><th>如何验证</th></tr></thead>
              <tbody>
                <tr><td>明确边界与角色</td><td>首页能力边界说明；角色限定为工学一体化备课；超范围规则</td><td>问“帮我预测谁能考过”“学生抑郁怎么办”</td></tr>
                <tr><td>有知识库，回答有依据</td><td>${KB_DOCS.length} 份材料 / ${totalSections()} 个片段；12 个专业包；关键词 + 概念扩展检索；章节级引用</td><td>查“数车主轴对刀要注意什么”并展开依据；在知识库搜索“互锁”</td></tr>
                <tr><td>任务闭环，可落地成果</td><td>教案 + 任务单 + 工作页 + 评价表；可编辑；DOCX / XLSX / TXT / Markdown / PDF</td><td>载入示例，生成后编辑并导出 DOCX / Excel</td></tr>
                <tr><td>会追问、会澄清</td><td>参数表单必填校验；对话缺参时追问；支持改学时 / 课型 / 模板；历史可改名、分类、批量删除</td><td>直接说“帮我写教案”，观察追问；生成后说“把学时改成 6”</td></tr>
                <tr><td>安全合规与人工审核</td><td>双引擎；AI 发送前隐私网关；敏感信息自动脱敏；合规自检；结果页审核标记</td><td>在资料中心上传含手机号的资料，观察隐私确认；在设置中查看授权与撤回</td></tr>
                <tr><td>真实 AI 与安全架构</td><td>AI 体验通道（无密钥、需授权）+ 自建安全代理（Key 在服务端）；断网自动回退</td><td>设置中测试连接；关网后生成，观察回退本地结果</td></tr>
              </tbody>
            </table>
          </section>

          <section>
            <h2 class="guide-h2" data-no="03">工作流如何运行</h2>
            <p class="guide-p">每次生成不是“一次性写一段话”，而是按固定工序执行。V2 是双引擎：<strong>本地模式</strong>使用可审查的规则、知识检索与结构化模板，数据不出浏览器；<strong>AI 增强模式</strong>经用户授权后，把必要上下文与检索片段发送给模型，再由模型改写关键模块并合并回本地完整结构。AI 失败时保留本地成果；安全类查询仍固定由本地知识库回答。</p>
            <div class="arch-flow">
              <div class="arch-box">教师任务<small>专业 / 任务 / 学情</small></div>
              <div class="arch-arrow">→</div>
              <div class="arch-box">参数澄清<small>追问 / 表单校验</small></div>
              <div class="arch-arrow">→</div>
              <div class="arch-box">知识检索<small>章节级引用</small></div>
              <div class="arch-arrow">→</div>
              <div class="arch-box">结构化生成<small>本地完整底稿</small></div>
              <div class="arch-arrow">→</div>
              <div class="arch-box">AI 改写<small>可选 · 流式 · 关键模块</small></div>
              <div class="arch-arrow">→</div>
              <div class="arch-box">合并与自检<small>引用 / 隐私 / 安全</small></div>
              <div class="arch-arrow">→</div>
              <div class="arch-box">人工审核<small>教师最终确认</small></div>
            </div>
            <div class="role-grid">
              <div class="role-card"><h4>规范检索员</h4><p>按任务关键词、场景权重与领域概念扩展检索知识库，只挑与任务相关的章节。</p></div>
              <div class="role-card"><h4>教学设计员</h4><p>先把目标、重难点、流程、评价与安全组装成完整可审核结构，避免 AI 截断导致半成品。</p></div>
              <div class="role-card"><h4>AI 改写员</h4><p>在授权范围内改写关键模块；输出被截断、解析失败或无网络时自动回退，不丢任务条件。</p></div>
              <div class="role-card"><h4>合规审核员</h4><p>检查个人信息、评分依据、安全边界与人工审核提示，不放过“看起来很像”的内容。</p></div>
            </div>
            <p class="guide-p" style="margin-top:10px">模型的自由生成只能发生在被约束的段落内，不能覆盖安全条款和引用关系。AI 体验通道是公开第三方服务，仅用于演示；生产部署请切换到 <code>server/</code> 中的安全代理，密钥只放服务端环境变量。</p>
          </section>

          <section>
            <h2 class="guide-h2" data-no="04">使用步骤</h2>
            <ol class="guide-list">
              <li><strong>选场景：</strong>从首页选择“生成教案 / 任务单与工作页 / 评价表 / 查安全规程 / 听课评课”。</li>
              <li><strong>填参数：</strong>专业、课程、工作任务、课型、学时、学情等。学情只写班级层面的先修基础、常见困难与设备条件，不写姓名。</li>
              <li><strong>核对引用：</strong>生成后，右侧“引用来源”可展开每一条依据；每个文档模块都能单独复制。</li>
              <li><strong>修改与追问：</strong>直接说“把学时改成 6”“模板换成任务驱动简案”，或点“调整参数”；系统保留其他条件重新生成。</li>
              <li><strong>编辑与导出：</strong>点“编辑成果”可分栏编辑、拖动模块排序、撤销恢复；支持 DOCX、XLSX、TXT、Markdown；PDF 通过浏览器打印另存。</li>
              <li><strong>人工审核：</strong>逐项核对设备、企业标准、安全条款和评价权重，再正式使用。</li>
            </ol>
          </section>

          <section>
            <h2 class="guide-h2" data-no="05">数据怎么处理，边界在哪里</h2>
            <div class="principle-grid">
              <div class="principle"><div class="principle-num">01 / LOCAL-FIRST</div><h3>默认不联网</h3><p>本地模式下，输入、成果、历史与反馈只保存在当前浏览器的 IndexedDB（localStorage 仅作兼容回退），不上传服务器。</p></div>
              <div class="principle"><div class="principle-num">02 / MINIMUM</div><h3>只收必需信息</h3><p>不要求填写学生姓名、学号、联系方式、家庭情况；学情使用班级级描述。</p></div>
              <div class="principle"><div class="principle-num">03 / GUARD</div><h3>发送前隐私网关</h3><p>AI 请求前检测身份证、手机、邮箱、学号、姓名上下文与地址；可掩码显示、人工确认或自动脱敏后再发送，也可直接取消。</p></div>
              <div class="principle"><div class="principle-num">04 / REVIEW</div><h3>人工审核是最后工序</h3><p>AI 结果定位为辅助草稿；安全、评价、企业标准必须由具备职责的教师确认。</p></div>
            </div>
            <p class="guide-p" style="margin-top:10px">限制说明：IndexedDB 是本机存储，换设备、换浏览器不会同步；清理浏览器数据会删除历史。AI 模式会把必要上下文发送给你选择的模型服务（体验通道为公开第三方；生产请用自建安全代理）。请不要在公共电脑上保留含校内信息的记录。</p>
          </section>

          <section>
            <h2 class="guide-h2" data-no="06">如何替换知识库与扩展</h2>
            <p class="guide-p"><strong>知识库：</strong>内置材料位于 <code>js/knowledge.js</code> 与 <code>js/knowledge-packs.js</code>（12 个专业包）；教师可在知识库页面新增、导入 JSON、编辑、删除自定义材料，保存在 IndexedDB。内置材料只读，可“复制为自定义”后修改。</p>
            <p class="guide-p"><strong>资料中心：</strong>支持 TXT / MD / CSV / JSON / DOCX / PDF / XLSX / PPTX，本地解析、隐私检查、分块预览、加入知识库；扫描 PDF 可选 OCR（会联网加载 Tesseract 资源）。</p>
            <p class="guide-p"><strong>接入学院系统 / 大模型：</strong>前端通过 <code>js/ai.js</code> 调用模型；生产环境部署 <code>server/cloudflare-worker.js</code> 或 <code>server/vercel/</code>，把 <code>AI_API_KEY</code> 放在服务端环境变量，前端只填代理地址。不要在前端写模型 Key。</p>
            <div class="code-block">知识库：js/knowledge.js + js/knowledge-packs.js<br>检索与生成：js/engine.js<br>AI 适配：js/ai.js / ai-prompts.js / ai-artifacts.js<br>资料解析：js/files.js + assets/vendor<br>存储：js/db.js<br>隐私：js/privacy.js<br>编辑器 / 导出：js/app.js + js/export.js<br>安全代理：server/</div>
          </section>

          <section>
            <h2 class="guide-h2" data-no="07">试用反馈怎样留证据</h2>
            <p class="guide-p">不要编造“已有 100 位老师使用”。邀请 1—2 位同事真实使用，记录具体任务、耗时、修改点和是否愿意继续使用。下面的模板可以复制到文档里，自行填写并附截图。</p>
            <div class="feedback-template" id="trial-template">
              <strong>授渔 · 试用反馈记录（模板）</strong><br>
              试用日期：____年__月__日　　试用对象岗位：__________（可匿名）<br>
              使用场景：□教案　□任务单 / 工作页　□评价表　□安全查询　□听评课<br>
              原始任务：______________________________________________<br>
              完成用时：手工约____分钟　　使用授渔约____分钟<br>
              可直接采用的部分：______________________________________<br>
              需要修改的部分：________________________________________<br>
              发现的问题 / 改进建议：_________________________________<br>
              是否愿意继续使用：□是　□不确定　□否　　试用者签名（可选）：________
            </div>
            <div class="btn-row" style="margin-top:9px">
              <button class="btn" type="button" data-action="copy-trial-template" aria-label="复制试用反馈模板">${icon("copy", 12)}复制反馈模板</button>
              <button class="btn btn-ghost" type="button" data-action="nav" data-path="/history">查看本机使用统计</button>
            </div>
          </section>

          <section>
            <h2 class="guide-h2" data-no="08">已知限制</h2>
            <ul class="guide-list">
              <li>知识库是演示用校本示例 + 12 个专业包，不是学院正式文件；安全、评价、课程内容必须替换与复核。</li>
              <li>AI 体验通道使用公开第三方推理服务，有速率与长度限制，可能截断或不可用；生产请部署安全代理并配置真实模型密钥。</li>
              <li>AI 只改写关键模块并合并回本地完整结构，不是“整篇一次性生成”；安全类查询仍固定由本地知识库回答。</li>
              <li>PDF 通过浏览器打印面板另存，不同浏览器分页略异；复杂表格建议导出 DOCX / XLSX 后微调。</li>
              <li>系统无法识别所有形式的个人信息；规则检测与人工检查必须同时使用。扫描 PDF 的中文 OCR 准确率取决于扫描质量，必须人工校对。</li>
              <li>部分典型任务画像仍集中在少数专业；新增专业包提供结构与教学提示，具体设备参数与企业任务需教师补充。</li>
            </ul>
          </section>
        </div>

        <aside class="guide-aside">
          <div class="guide-aside-box">
            <span class="guide-tag">ONE-SENTENCE</span>
            <h3>它不是“什么都能问”。</h3>
            <p>它只把工学一体化备课做深：有边界、有依据、有固定产出、有追问，也有明确的人工审核提示。</p>
            <ul>
              <li>默认本地处理，不上传输入</li>
              <li>引用细到知识库章节</li>
              <li>学情、姓名、联系方式不进入输入</li>
              <li>安全条款以现场规程为准</li>
            </ul>
            <button class="btn btn-solid" style="margin-top:12px;width:100%" type="button" data-action="nav" data-path="/">开始一次备课 ${icon("arrowRight", 12)}</button>
          </div>
        </aside>
      </div>
    </div>
  `;
}

/* ==========================================================
   AI & data settings
   ========================================================== */

function formatBytes(bytes) {
  if (!bytes || Number.isNaN(bytes)) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = Number(bytes);
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function renderSettingsPage() {
  const consent = hasValidConsent(state.ai);
  const docsCount = KB_DOCS.length;
  return `
    <div class="page">
      <div class="page-head">
        <div>
          <div class="page-kicker">SETTINGS / AI 与数据</div>
          <h1 class="page-title">把引擎的选择权交给教师。</h1>
          <p class="page-intro">本地引擎保证可用与隐私；AI 增强模式提供真实大模型能力。AI 服务密钥只应存在安全代理的服务端环境变量；浏览器不保存模型 API Key。每次 AI 发送前仍会执行隐私检查。</p>
        </div>
        <div class="page-head-side">
          <strong>当前状态</strong>
          引擎：${aiModeActive() ? "AI 增强" : "本地引擎"}<br>
          授权：${consent ? "已同意数据传输说明" : "尚未同意"}<br>
          存储：${state.storageReady ? "IndexedDB + 兼容回退" : "正在初始化"}
        </div>
      </div>

      <div class="page-stats">
        <div class="stat"><div class="stat-value">${aiModeActive() ? "AI" : "LOCAL"}</div><div class="stat-label">CURRENT ENGINE / 当前引擎</div></div>
        <div class="stat"><div class="stat-value">${String(db.conversations.length).padStart(2, "0")}</div><div class="stat-label">CONVERSATIONS / 本机记录</div></div>
        <div class="stat"><div class="stat-value">${String(docsCount).padStart(2, "0")}</div><div class="stat-label">KNOWLEDGE DOCS / 知识材料</div></div>
        <div class="stat"><div class="stat-value" id="storage-usage">—</div><div class="stat-label">LOCAL STORAGE / 本机占用</div></div>
      </div>

      <div class="settings-layout">
        <div class="settings-main">
          <section class="settings-panel">
            <div class="settings-panel-head">
              <div>
                <div class="page-kicker" style="margin:0">ENGINE / 双引擎</div>
                <h2>选择生成引擎</h2>
              </div>
              <div class="ai-mode-chip${aiModeActive() ? " is-ai" : ""}">
                ${icon(aiModeActive() ? "spark" : "shield", 12)}
                <span>${aiModeActive() ? "AI 增强" : "本地模式"}</span>
              </div>
            </div>
            <div class="engine-cards">
              <button class="engine-card${!aiModeActive() ? " is-active" : ""}" type="button" data-action="set-engine-mode" data-mode="local">
                <span class="engine-card-top">LOCAL ENGINE ${!aiModeActive() ? "<i>当前</i>" : ""}</span>
                <strong>本地规则 + 知识库</strong>
                <p>不联网，使用内置知识与结构化模板。稳定、可审计，适合涉密或断网场景。</p>
                <span class="engine-card-foot">始终可用 · 数据不出浏览器</span>
              </button>
              <button class="engine-card${aiModeActive() ? " is-ai is-active" : ""}" type="button" data-action="set-engine-mode" data-mode="ai">
                <span class="engine-card-top">AI ENHANCED ${aiModeActive() ? "<i>当前</i>" : ""}</span>
                <strong>大模型 + 知识库 + 人工审核</strong>
                <p>调用真实大模型深度理解任务并改写成果。需要明确同意数据传输；不可用时自动回退本地。</p>
                <span class="engine-card-foot">流式输出 · 可取消 · 可重试</span>
              </button>
            </div>
            <p class="settings-note">安全查询、超范围问题、隐私请求和参数澄清固定由本地边界层处理，不交给生成模型。AI 主要参与需要理解与改写的教学任务。</p>
          </section>

          <section class="settings-panel">
            <div class="settings-panel-head">
              <div>
                <div class="page-kicker" style="margin:0">MODEL / 模型接入</div>
                <h2>服务商与端点</h2>
              </div>
            </div>
            <form id="ai-settings-form">
              <div class="form-grid">
                <div class="field field-full">
                  <label for="ai-provider">AI 通道 <span class="required-mark">必选</span></label>
                  <select id="ai-provider" name="provider">
                    <option value="demo" ${state.ai.provider === "demo" ? "selected" : ""}>AI 体验通道（公开无密钥，仅演示）</option>
                    <option value="proxy" ${state.ai.provider === "proxy" ? "selected" : ""}>学校 / 自建安全代理（生产推荐）</option>
                  </select>
                  <span class="field-hint">体验通道不包含 API Key，但会把必要内容发送至第三方公开服务。生产使用必须切换到安全代理。</span>
                </div>

                <div class="provider-fields field-full" data-provider-panel="demo" ${state.ai.provider === "demo" ? "" : "hidden"}>
                  <div class="form-banner">
                    <div><strong>体验通道：${escapeHtml(DEMO_PROVIDER.model)}</strong><br>${escapeHtml(DEMO_PROVIDER.description)}</div>
                  </div>
                </div>

                <div class="provider-fields field-full" data-provider-panel="proxy" ${state.ai.provider === "proxy" ? "" : "hidden"}>
                  <div class="form-banner">
                    <div><strong>模型密钥不会进入浏览器。</strong> 你填写的是安全代理的访问地址；代理服务端从环境变量读取模型 Key。可选用服务访问口令保护代理，但它不是模型 Key。</div>
                  </div>
                  <div class="form-grid" style="margin-top:10px">
                    <div class="field field-full">
                      <label for="ai-endpoint">代理接口地址</label>
                      <input id="ai-endpoint" name="endpoint" type="url" value="${escapeAttr(state.ai.provider === "proxy" ? state.ai.endpoint : "")}" placeholder="https://your-worker.workers.dev/api/chat">
                      <span class="field-hint">必须是以 /api/chat 结尾的 HTTPS 地址；对应 server/cloudflare-worker.js。</span>
                    </div>
                    <div class="field">
                      <label for="ai-model">模型名称</label>
                      <input id="ai-model" name="model" type="text" value="${escapeAttr(state.ai.provider === "proxy" ? state.ai.model : "")}" placeholder="deepseek-chat">
                    </div>
                    <div class="field">
                      <label for="ai-proxy-token">服务访问口令（可选）</label>
                      <input id="ai-proxy-token" name="proxyToken" type="password" value="${escapeAttr(state.ai.proxyToken || "")}" autocomplete="off" placeholder="不是模型 API Key">
                      <span class="field-hint">只保存在当前标签页会话；关闭标签页即清除。</span>
                    </div>
                    <div class="field field-full">
                      <label for="ai-health-endpoint">健康检查地址（可选）</label>
                      <input id="ai-health-endpoint" name="healthEndpoint" type="url" value="${escapeAttr(state.ai.healthEndpoint || "")}" placeholder="自动从 /api/health 推断">
                    </div>
                  </div>
                </div>

                <div class="field">
                  <label for="ai-temperature">生成温度</label>
                  <input id="ai-temperature" name="temperature" type="number" min="0" max="1.2" step="0.05" value="${escapeAttr(state.ai.temperature)}">
                  <span class="field-hint">0 更稳定，0.7 更开放；教学成果建议 0.2—0.5。</span>
                </div>
                <div class="field">
                  <label for="ai-max-tokens">最大输出长度</label>
                  <input id="ai-max-tokens" name="maxTokens" type="number" min="256" max="8192" step="128" value="${escapeAttr(state.ai.maxTokens)}">
                  <span class="field-hint">请求上限；实际输出受服务端与体验通道长度限制，教案建议 4096。</span>
                </div>

                <div class="field field-full">
                  <label>数据传输授权</label>
                  <div class="consent-status${consent ? " is-ok" : ""}">
                    ${consent
                      ? `<span class="consent-dot"></span><span>已于 ${escapeHtml(new Date(state.ai.consent.grantedAt).toLocaleString("zh-CN"))} 同意版本 ${escapeHtml(AI_CONSENT_VERSION)}</span><button class="btn-link" type="button" data-action="revoke-ai-consent">撤回</button>`
                      : `<span class="consent-dot"></span><span>尚未同意第三方 / 远程数据传输说明。</span><button class="btn-link" type="button" data-action="show-ai-consent">查看并同意</button>`}
                  </div>
                </div>
              </div>
              <div class="settings-actions">
                <button class="btn btn-solid" type="submit">保存设置 ${icon("check", 12)}</button>
                <button class="btn" type="button" data-action="test-ai-connection">测试连接</button>
                <button class="btn btn-ghost" type="button" data-action="nav" data-path="/guide">查看安全说明</button>
                <span class="ai-test-result" id="ai-test-result" role="status"></span>
              </div>
            </form>
          </section>

          <section class="settings-panel">
            <div class="settings-panel-head">
              <div>
                <div class="page-kicker" style="margin:0">DATA / 本机数据</div>
                <h2>备份、恢复与删除</h2>
              </div>
              <span class="settings-badge">IndexedDB</span>
            </div>
            <p class="settings-note">历史、自定义知识与资料优先保存在本机 IndexedDB；localStorage 只作轻量兼容。换设备不会自动同步。备份文件可能含教学内容，请存放在学校批准的位置。</p>
            <div class="field" style="max-width:320px">
              <label for="file-max-mb">单个资料文件上限（MB）</label>
              <input id="file-max-mb" type="number" min="1" max="100" step="1" value="${escapeAttr(state.fileMaxMB)}">
              <span class="field-hint">默认 25MB。只影响浏览器本机解析，不会改变服务器限制。</span>
            </div>
            <div class="data-actions">
              <button class="btn" type="button" data-action="export-backup">${icon("download", 12)}导出完整备份 (JSON)</button>
              <button class="btn btn-ghost" type="button" data-action="export-conversations">${icon("download", 12)}仅导出对话</button>
              <button class="btn" type="button" data-action="import-backup">${icon("file", 12)}导入备份</button>
              <input type="file" data-role="backup-file" accept=".json,application/json" hidden>
              <button class="btn btn-ghost" type="button" data-action="refresh-usage">刷新占用</button>
              <button class="btn btn-danger-ghost" type="button" data-action="clear-local-data">${icon("trash", 12)}删除本机数据</button>
            </div>
            <div class="data-summary">
              <span>对话 ${db.conversations.length} 条</span>
              <span>自定义知识 ${state.customDocs.length} 份</span>
              <span>资料文件 ${state.files.length} 份</span>
              <span id="storage-detail">存储占用计算中…</span>
            </div>
          </section>
        </div>

        <aside class="settings-aside">
          <div class="guide-aside-box">
            <span class="guide-tag">SECURITY</span>
            <h3>密钥不进入前端</h3>
            <p>GitHub Pages 是纯静态托管，无法安全保管模型密钥。因此：</p>
            <ul>
              <li>体验通道无密钥，但需同意第三方传输；</li>
              <li>生产使用 <code>server/</code> 的 Cloudflare Worker / Vercel Function；</li>
              <li>Key 写在服务端环境变量 <code>AI_API_KEY</code>；</li>
              <li>浏览器设置中没有模型 Key 字段。</li>
            </ul>
          </div>
          <div class="guide-aside-box" style="margin-top:10px">
            <span class="guide-tag">PRIVACY</span>
            <h3>发送前检查</h3>
            <p>AI 请求前会检测身份证、手机、邮箱、学号、姓名上下文、地址等敏感信息，并允许先脱敏；未经确认不会把检测到的敏感内容发送到 AI。</p>
            <button class="btn" type="button" data-action="nav" data-path="/guide" style="margin-top:8px">查看数据边界</button>
          </div>
          <div class="guide-aside-box" style="margin-top:10px">
            <span class="guide-tag">ACCOUNT / CLOUD</span>
            <h3>账号与云同步：未启用</h3>
            <p>当前没有账号系统、云端同步或多用户权限。本地存储不是跨设备同步。P3 阶段需后端、认证与学校级权限后才能实现。</p>
          </div>
        </aside>
      </div>
    </div>
  `;
}

function readAISettingsForm() {
  const form = document.getElementById("ai-settings-form");
  if (!form) return normalizeAISettings(state.ai);
  const provider = form.querySelector("#ai-provider")?.value || "demo";
  const endpoint = provider === "demo" ? DEMO_PROVIDER.endpoint : form.querySelector("#ai-endpoint")?.value.trim() || "";
  const model = provider === "demo" ? DEMO_PROVIDER.model : form.querySelector("#ai-model")?.value.trim() || "";
  return normalizeAISettings({
    ...state.ai,
    provider,
    endpoint,
    model,
    proxyToken: form.querySelector("#ai-proxy-token")?.value || "",
    healthEndpoint: form.querySelector("#ai-health-endpoint")?.value.trim() || "",
    temperature: form.querySelector("#ai-temperature")?.value,
    maxTokens: form.querySelector("#ai-max-tokens")?.value,
    mode: aiModeActive() ? "ai" : "local"
  });
}

async function refreshStorageUsage() {
  const estimate = await localDB.getStorageEstimate().catch(() => null);
  const usageEl = document.getElementById("storage-usage");
  const detailEl = document.getElementById("storage-detail");
  if (!estimate) {
    if (usageEl) usageEl.textContent = "—";
    if (detailEl) detailEl.textContent = "浏览器不提供占用信息";
    return;
  }
  if (usageEl) {
    usageEl.textContent = formatBytes(estimate.usage);
    usageEl.style.fontSize = "17px";
    usageEl.style.lineHeight = "1.5";
  }
  if (detailEl) detailEl.textContent = `约 ${formatBytes(estimate.usage)} / 配额 ${formatBytes(estimate.quota)}`;
}

async function exportBackup({ conversationsOnly = false } = {}) {
  try {
    const settings = {
      ai: { ...state.ai, proxyToken: "" },
      fileMaxMB: state.fileMaxMB,
      ui: { version: 2 }
    };
    const backup = await localDB.buildBackup({
      conversations: db.conversations,
      knowledge: conversationsOnly ? [] : state.customDocs,
      files: conversationsOnly ? [] : state.files,
      settings
    });
    backup.exportedAt = new Date().toISOString();
    const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 16);
    downloadTextFile(`授渔_${conversationsOnly ? "对话" : "完整备份"}_${stamp}.json`, JSON.stringify(backup, null, 2), "application/json;charset=utf-8");
    showToast("备份文件已开始下载，请存放在学校批准的位置");
  } catch (error) {
    showToast(error.message || "备份导出失败");
  }
}

function triggerBackupImport() {
  document.querySelector("[data-role='backup-file']")?.click();
}

async function handleBackupFile(file) {
  if (!file) return;
  if (file.size > 30 * 1024 * 1024) {
    showToast("备份文件超过 30MB，请拆分后导入");
    return;
  }
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    const validation = localDB.validateBackup(data);
    if (!validation.ok) {
      showToast(`无法导入：${validation.errors.join("；")}`);
      return;
    }
    state.pendingRestore = data;
    openModal({
      kind: "confirm",
      narrow: false,
      kicker: "RESTORE / 备份恢复",
      title: "用这份备份覆盖本机数据？",
      sub: "恢复会替换当前本机对话、自定义知识和资料记录。建议先导出当前数据。",
      body: `
        <div class="notice-stack">
          <div class="privacy-disclosure">
            <h3>备份内容</h3>
            <ul>
              <li>对话记录：${Array.isArray(data.conversations) ? data.conversations.length : 0} 条</li>
              <li>自定义知识：${Array.isArray(data.knowledge) ? data.knowledge.length : 0} 份</li>
              <li>资料文件：${Array.isArray(data.files) ? data.files.length : 0} 份</li>
              <li>导出时间：${escapeHtml(data.exportedAt || "未知")}</li>
            </ul>
          </div>
          <div class="privacy-warning">恢复后当前数据会被覆盖，且无法自动撤销。请确认备份来源可信；恢复完成后页面会重新加载。</div>
        </div>
      `,
      focusSelector: "[data-action='confirm-restore']",
      footer: `
        <button class="btn btn-ghost" type="button" data-action="close-modal">取消</button>
        <span class="spacer"></span>
        <button class="btn btn-solid" type="button" data-action="confirm-restore">确认覆盖并恢复</button>
      `
    });
  } catch (error) {
    showToast(`备份解析失败：${error.message || "不是有效 JSON"}`);
  }
}

async function applyEngineMode(mode) {
  if (mode === "ai" && !hasValidConsent(state.ai)) {
    openAIConsentModal(async () => {
      state.ai.mode = "ai";
      await saveAISettings(state.ai);
      showToast("已切换到 AI 增强模式，发送前仍会检查敏感信息");
      renderApp({ preserveScroll: true });
    }, state.ai.provider);
    return;
  }
  state.ai.mode = mode === "ai" ? "ai" : "local";
  await saveAISettings(state.ai);
  showToast(state.ai.mode === "ai" ? "已切换到 AI 增强模式" : "已切换到本地模式");
  renderApp({ preserveScroll: true });
}

async function testAISettings() {
  const resultEl = document.getElementById("ai-test-result");
  if (resultEl) {
    resultEl.className = "ai-test-result is-testing";
    resultEl.textContent = "正在测试连接…";
  }
  const settings = readAISettingsForm();
  if (settings.provider === "demo" && !hasValidConsent(settings)) {
    if (resultEl) {
      resultEl.className = "ai-test-result is-error";
      resultEl.textContent = "请先同意数据传输说明";
    }
    return;
  }
  const result = await checkAIConnection(settings);
  if (resultEl) {
    resultEl.className = `ai-test-result ${result.ok ? "is-ok" : "is-error"}`;
    resultEl.textContent = result.message;
  }
  showToast(result.ok ? "AI 连接测试成功" : `连接失败：${result.message}`);
}

/* ==========================================================
   Files page (basic shell; expanded by js/files.js integration)
   ========================================================== */

function renderFilesPage() {
  return `
    <div class="page">
      <div class="page-head">
        <div>
          <div class="page-kicker">RESOURCE CENTER / 资料中心</div>
          <h1 class="page-title">长文档，也能被真正读懂。</h1>
          <p class="page-intro">上传教学资料、设备说明、课程标准或听课记录。文件只在浏览器本机解析，不上传服务器；解析后可预览、分块、检查隐私，再决定是否加入知识库。</p>
        </div>
        <div class="page-head-side">
          <strong>支持格式</strong>
          TXT · MD · CSV · JSON · DOCX · PDF · XLSX · PPTX<br>
          单个文件上限可配置<br>
          扫描 PDF 可选用 OCR
        </div>
      </div>
      <div class="page-stats">
        <div class="stat"><div class="stat-value">${String(state.files.length).padStart(2, "0")}</div><div class="stat-label">FILES / 本机资料</div></div>
        <div class="stat"><div class="stat-value">${String(state.customDocs.length).padStart(2, "0")}</div><div class="stat-label">CUSTOM KB / 自定义知识</div></div>
        <div class="stat"><div class="stat-value">0</div><div class="stat-label">UPLOADED TO SERVER / 上传服务器</div></div>
        <div class="stat"><div class="stat-value">LOCAL</div><div class="stat-label">PARSING / 本机解析</div></div>
      </div>
      <div id="file-upload-progress" class="file-upload-progress" aria-live="polite"></div>
      <div class="file-center">
        <div class="upload-zone" data-action="open-file-picker" role="button" tabindex="0">
          <div class="upload-mark">${icon("file", 22)}</div>
          <h2>把资料拖到这里，或选择文件</h2>
          <p>支持多文件；解析过程显示进度；长文档按语义段落分块，不会简单截断。</p>
          <button class="btn btn-solid" type="button" data-action="open-file-picker">选择资料文件</button>
          <input type="file" id="file-center-input" data-role="file-center-input" multiple accept=".txt,.md,.markdown,.csv,.json,.docx,.pdf,.xlsx,.pptx" hidden>
          <p class="upload-privacy">${icon("shield", 11)} 默认只在本机读取；加入知识库前会先做隐私检查。</p>
        </div>
        <div class="file-help">
          <h3>解析能力</h3>
          <ul>
            <li><strong>DOCX</strong>：段落 + 表格文本</li>
            <li><strong>PDF</strong>：逐页文本提取，扫描页可选 OCR</li>
            <li><strong>XLSX</strong>：工作表逐行转文本</li>
            <li><strong>PPTX</strong>：幻灯片文本</li>
            <li><strong>TXT / MD / CSV / JSON</strong>：原生解析</li>
          </ul>
          <p class="settings-note">超长资料会分块并保留全文索引，不使用“截断前若干字”的方式冒充解析完成。</p>
        </div>
      </div>
      <div id="file-list" class="file-list">
        ${state.files.length ? state.files.map((file) => `
          <article class="file-row">
            <div class="file-row-icon">${icon("file", 16)}</div>
            <div class="file-row-main">
              <h3>${escapeHtml(file.name || file.title || "未命名资料")}</h3>
              <p>${escapeHtml(file.status || "已解析")} · ${file.chunks?.length || 0} 个片段 · ${file.charCount || 0} 字 · ${escapeHtml(file.type || "")}${file.privacyMasked ? " · 已脱敏" : ""}${file.needsOCR ? " · 需 OCR" : ""}</p>
            </div>
            <div class="file-row-actions">
              ${file.needsOCR ? `<button class="btn btn-ghost" type="button" data-action="ocr-file" data-id="${escapeAttr(file.id)}">OCR 识别</button>` : ""}
              ${file.inKnowledge ? `<span class="mini-tag">已入知识库</span>` : `<button class="btn" type="button" data-action="file-to-kb" data-id="${escapeAttr(file.id)}">加入知识库</button>`}
              <button class="btn btn-ghost" type="button" data-action="preview-file" data-id="${escapeAttr(file.id)}">预览</button>
              <button class="btn btn-ghost" type="button" data-action="delete-file" data-id="${escapeAttr(file.id)}" aria-label="删除 ${escapeAttr(file.name || "资料")}">${icon("trash", 11)}</button>
            </div>
          </article>
        `).join("") : `<div class="empty-state">
          <div class="empty-mark"></div>
          <h2 class="empty-title">还没有资料</h2>
          <p class="empty-copy">从一份真实的课程标准、设备说明或听课记录开始。解析后可以选择加入知识库，也可以移除。</p>
        </div>`}
      </div>
    </div>
  `;
}

/* ==========================================================
   File center & parsers
   ========================================================== */

const FILE_ACCEPT = ".txt,.md,.markdown,.csv,.json,.docx,.pdf,.xlsx,.pptx";
const FILE_MAX_BATCH = 10;

function renderFileUploadQueue() {
  const root = document.getElementById("file-upload-progress");
  if (!root) return;
  if (!state.fileUploads.length) {
    root.innerHTML = "";
    return;
  }
  root.innerHTML = state.fileUploads.map((upload) => `
    <div class="upload-progress-row ${upload.status === "error" ? "is-error" : upload.status === "done" ? "is-done" : ""}">
      <div class="upload-progress-head">
        <strong>${escapeHtml(upload.name)}</strong>
        <span>${escapeHtml(upload.message || upload.phase || "")}${upload.status === "running" ? ` · ${Math.round((upload.progress || 0) * 100)}%` : ""}</span>
      </div>
      <div class="upload-progress-track"><i style="width:${Math.max(2, Math.round((upload.progress || 0) * 100))}%"></i></div>
      ${upload.status === "error" ? `<p class="upload-progress-error">${escapeHtml(upload.error || "解析失败")}</p>` : ""}
    </div>
  `).join("");
}

function updateFileUpload(id, patch) {
  const item = state.fileUploads.find((upload) => upload.id === id);
  if (!item) return;
  Object.assign(item, patch);
  renderFileUploadQueue();
}

async function reviewFilePrivacy(findings, fileName) {
  const masked = findings
    .filter((finding, index, all) => all.findIndex((item) => item.type === finding.type && item.masked === finding.masked) === index)
    .slice(0, 12)
    .map((finding) => `<li><strong>${escapeHtml(finding.label)}</strong><span class="privacy-finding-mask">${escapeHtml(finding.masked)}</span><span class="privacy-finding-reason">${escapeHtml(finding.reason || "")}</span></li>`)
    .join("");
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      state.filePrivacyResolve = null;
      resolve(value);
    };
    state.filePrivacyResolve = finish;
    openModal({
      kind: "confirm",
      narrow: false,
      kicker: "UPLOAD PRIVACY / 上传前检查",
      title: "资料里可能有个人信息",
      sub: `《${fileName}》检测到 ${findings.length} 处可能的个人身份信息。资料尚未保存，也不会自动上传。`,
      body: `
        <div class="notice-stack">
          <div class="privacy-warning">教学资料通常只需要保留班级、组别或化名。保存前建议删除学生姓名、学号、电话和住址。</div>
          <div class="privacy-disclosure">
            <h3>检测结果（已掩码显示）</h3>
            <ul class="privacy-finding-list">${masked}</ul>
            <p class="settings-note">规则检测可能漏检或误报；确认前请人工检查。</p>
          </div>
          <div class="privacy-disclosure">
            <h3>你将有两个选择</h3>
            <ul>
              <li>取消导入，回到原文件处理；</li>
              <li>自动脱敏后保存，只保存脱敏后的文本与分块，不保存原文件。</li>
            </ul>
          </div>
        </div>
      `,
      focusSelector: "[data-action='file-privacy-mask']",
      footer: `
        <button class="btn btn-ghost" type="button" data-action="file-privacy-cancel">取消导入</button>
        <span class="spacer"></span>
        <button class="btn btn-solid" type="button" data-action="file-privacy-mask">自动脱敏并保存</button>
      `
    });
    // If the modal is closed by backdrop/Escape, closeModal resolves the pending promise with false.
  });
}

async function handleFileCenterFiles(fileList) {
  const files = Array.from(fileList || []);
  if (!files.length) return;
  if (files.length > FILE_MAX_BATCH) {
    showToast(`一次最多处理 ${FILE_MAX_BATCH} 份资料，请分批上传`);
    return;
  }
  for (const file of files) {
    await processFileUpload(file);
  }
}

function maskDeep(value) {
  if (typeof value === "string") {
    const findings = detectSensitive(value);
    return findings.length ? maskSensitive(value, findings) : value;
  }
  if (Array.isArray(value)) return value.map(maskDeep);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, maskDeep(item)]));
  }
  return value;
}

async function processFileUpload(file) {
  const queueId = uid("upload");
  const upload = { id: queueId, name: file.name, status: "running", progress: 0, phase: "reading", message: "读取文件" };
  state.fileUploads.push(upload);
  renderFileUploadQueue();
  if (file.size > state.fileMaxMB * 1024 * 1024) {
    updateFileUpload(queueId, { status: "error", progress: 1, message: "文件过大", error: `超过 ${state.fileMaxMB}MB 上限，请拆分或压缩后再导入。` });
    showToast(`${file.name} 超过 ${state.fileMaxMB}MB 上限`);
    return;
  }
  try {
    const parsed = await parseFile(file, {
      maxFileMB: state.fileMaxMB,
      enableOCR: false,
      onProgress: (event) => {
        updateFileUpload(queueId, {
          progress: Math.max(0.02, Math.min(0.98, Number(event.progress) || 0)),
          phase: event.phase || "parsing",
          message: event.message || "解析中"
        });
      }
    });

    let text = parsed.text || "";
    let privacyMasked = false;
    const textFindings = detectSensitive(text);
    const nameFindings = detectSensitive(file.name);
    const titleFindings = detectSensitive(parsed.title || "");
    const metadataFindings = detectSensitive(JSON.stringify(parsed.metadata || {}));
    const findings = [...textFindings, ...nameFindings, ...titleFindings, ...metadataFindings];
    if (findings.length) {
      upload.status = "running";
      upload.message = "等待隐私确认";
      renderFileUploadQueue();
      const approved = await reviewFilePrivacy(findings, maskDeep(file.name));
      if (!approved) {
        updateFileUpload(queueId, { status: "error", progress: 1, message: "已取消", error: "检测到个人信息，教师取消了导入。" });
        return;
      }
      text = maskSensitive(text, textFindings);
      privacyMasked = true;
    }

    const chunks = chunkDocument(text, { maxChars: 1000, overlap: 120 });
    const countOf = (value) => Array.isArray(value) ? value.length : Number(value) || 0;
    const record = {
      id: uid("file"),
      name: maskDeep(file.name),
      title: maskDeep(parsed.title || file.name.replace(/\.[^.]+$/, "")),
      type: file.name.split(".").pop()?.toLowerCase() || "",
      mime: file.type || "",
      size: file.size,
      text,
      chunks,
      charCount: text.length,
      blockCount: parsed.blockCount || 0,
      pages: countOf(parsed.pages),
      sheets: countOf(parsed.sheets),
      slides: countOf(parsed.slides),
      metadata: maskDeep(parsed.metadata || {}),
      warnings: parsed.warnings || [],
      needsOCR: Boolean(parsed.needsOCR),
      privacyMasked,
      privacyFindings: findings.length,
      inKnowledge: false,
      knowledgeId: "",
      status: parsed.needsOCR ? "扫描件，需 OCR" : privacyMasked ? "已解析 · 已脱敏" : "已解析",
      createdAt: new Date().toISOString()
    };
    await localDB.saveFileRecord(record);
    state.files.unshift(record);
    if (record.needsOCR && file instanceof File) state.pendingFileBlobs.set(record.id, file);
    updateFileUpload(queueId, { status: "done", progress: 1, message: record.needsOCR ? "解析完成，建议 OCR" : "解析完成", error: "" });
    showToast(record.needsOCR ? `${file.name} 是扫描件，可启用 OCR` : `${file.name} 已在本机解析`);
    setTimeout(() => {
      state.fileUploads = state.fileUploads.filter((item) => item.id !== queueId);
      renderFileUploadQueue();
    }, 2200);
    if (state.route.name === "files") renderApp({ preserveScroll: true });
  } catch (error) {
    const message = error instanceof FileParseError ? error.message : error.message || "解析失败";
    updateFileUpload(queueId, { status: "error", progress: 1, message: "解析失败", error: message });
    showToast(`${file.name}：${message}`);
  }
}

function openFilePreview(record) {
  if (!record) return;
  const chunks = record.chunks || [];
  const previewText = chunks.slice(0, 6).map((chunk) => `【片段 ${String(chunk.order + 1).padStart(2, "0")}】\n${chunk.text}`).join("\n\n");
  openModal({
    kind: "confirm",
    narrow: false,
    kicker: "FILE PREVIEW / 本机解析结果",
    title: record.title || record.name,
    sub: `${record.name} · ${formatBytes(record.size)} · ${record.charCount} 字 · ${chunks.length} 个片段`,
    body: `
      <div class="notice-stack">
        <div class="file-preview-meta">
          <span>${escapeHtml(record.type?.toUpperCase() || "FILE")}</span>
          ${[
            record.pages ? `${record.pages} 页` : "",
            record.sheets ? `${record.sheets} 个工作表` : "",
            record.slides ? `${record.slides} 页幻灯片` : ""
          ].filter(Boolean).map((label) => `<span>${escapeHtml(label)}</span>`).join("")}
          <span>${record.privacyMasked ? "已脱敏保存" : "未检测到需脱敏内容"}</span>
          ${record.needsOCR ? "<span>扫描件 · 尚未 OCR</span>" : ""}
        </div>
        ${record.warnings?.length ? `<div class="privacy-warning">${record.warnings.map((warning) => escapeHtml(warning)).join("<br>")}</div>` : ""}
        ${record.needsOCR ? `<div class="privacy-disclosure"><h3>这份 PDF 文本很少</h3><p>它可能是扫描件。可以启用 OCR（联网加载外部识别引擎，需明确同意）；失败时不会伪造文本。</p></div>` : ""}
        <div class="privacy-disclosure">
          <h3>提取内容预览</h3>
          <p class="settings-note">只显示前 6 个片段，完整内容已保存在本机 IndexedDB；长文档不会被截断。</p>
          ${previewText ? `<pre class="file-preview-text">${escapeHtml(previewText)}</pre>` : `<div class="empty-state" style="padding:20px"><p class="empty-copy">没有可显示文本。${record.needsOCR ? "请启用 OCR。" : "请检查文件内容。"}</p></div>`}
        </div>
      </div>
    `,
    focusSelector: "[data-action='close-modal']",
    footer: `
      <button class="btn btn-ghost" type="button" data-action="delete-file" data-id="${escapeAttr(record.id)}">删除资料</button>
      <button class="btn btn-ghost" type="button" data-action="copy-file-text" data-id="${escapeAttr(record.id)}">复制全文</button>
      ${record.needsOCR ? `<button class="btn" type="button" data-action="ocr-file" data-id="${escapeAttr(record.id)}">OCR 识别</button>` : ""}
      <span class="spacer"></span>
      ${record.inKnowledge ? `<span class="mini-tag">已加入知识库</span>` : `<button class="btn btn-solid" type="button" data-action="file-to-kb" data-id="${escapeAttr(record.id)}">加入知识库</button>`}
      <button class="btn" type="button" data-action="close-modal">关闭</button>
    `
  });
}

function inferFileToKnowledge(record) {
  if (!record?.text) return null;
  const chunks = record.chunks?.length ? record.chunks : chunkDocument(record.text, { maxChars: 1000, overlap: 120 });
  const sections = chunks.map((chunk, index) => {
    const firstLine = String(chunk.text || "").split("\n").map((line) => line.trim()).find(Boolean) || "";
    const title = firstLine.length <= 32 && !/[。！？.!?]$/.test(firstLine) ? firstLine : `资料片段 ${String(index + 1).padStart(2, "0")}`;
    return {
      id: `USER-${record.id}-${index + 1}`,
      no: String(index + 1).padStart(2, "0"),
      title,
      text: chunk.text,
      bullets: []
    };
  });
  return {
    id: `USER-FILE-${record.id}`,
    title: record.title || record.name,
    category: "教师资料",
    specialty: "",
    course: String(record.metadata?.course || record.metadata?.title || ""),
    source: `教师上传 · ${record.name}`,
    author: "教师上传（本机）",
    published: record.createdAt?.slice(0, 10) || new Date().toISOString().slice(0, 10),
    version: "本机资料 v1",
    updated: new Date().toISOString(),
    scope: "教师自行导入的本地资料。未经学校审核，不作为正式制度或标准依据；引用前请核对原文。",
    summary: (record.text || "").replace(/\s+/g, " ").slice(0, 160),
    tags: [record.name, record.type?.toUpperCase() || "FILE", "教师资料", record.privacyMasked ? "已脱敏" : "本地导入"].filter(Boolean),
    sections
  };
}

async function addFileToKnowledge(record) {
  if (!record) return;
  if (!record.text || record.needsOCR) {
    showToast("这份资料还没有可检索文本，请先 OCR 或重新上传");
    return;
  }
  const doc = inferFileToKnowledge(record);
  if (!doc) return;
  const duplicate = findDuplicateKnowledgeDoc(doc);
  if (duplicate) {
    showToast(`检测到可能重复的材料：${duplicate.title}。请先核对知识库`);
    return;
  }
  try {
    addOrUpdateCustomDoc(doc);
    record.inKnowledge = true;
    record.knowledgeId = doc.id;
    state.customDocs = state.customDocs.filter((item) => item.id !== doc.id);
    state.customDocs.push(doc);
    await localDB.saveKnowledgeDoc(doc);
    await localDB.saveFileRecord(record);
    registerCustomKnowledgeDocs(state.customDocs);
    closeModal();
    showToast("资料已加入知识库；所有片段可被检索与引用");
    if (state.route.name === "kb" || state.route.name === "files") renderApp({ preserveScroll: true });
  } catch (error) {
    showToast(error.message || "加入知识库失败");
  }
}

function openOCRConsent(record) {
  if (!record) return;
  state.pendingOCRId = record.id;
  openModal({
    kind: "confirm",
    narrow: false,
    kicker: "OCR / 扫描件识别",
    title: "启用 OCR 识别？",
    sub: "OCR 需要从 jsDelivr 加载 Tesseract.js、worker 和语言包；这是本工具唯一会访问外部 CDN 的解析步骤。",
    body: `
      <div class="notice-stack">
        <div class="privacy-disclosure">
          <h3>会发生什么</h3>
          <ul>
            <li>扫描页会先在本机渲染，再交给本机运行的 OCR worker；</li>
            <li>OCR 引擎与语言数据从公开 CDN 下载；原始文件不会上传；</li>
            <li>默认只处理前 3 个低文本页，最多 20 页；失败会给出明确原因。</li>
          </ul>
        </div>
        <div class="privacy-warning">中文 OCR 的准确率取决于扫描质量与版式；识别结果必须人工校对。若学校网络不允许外部 CDN，请把 Tesseract 资源改为校内托管。</div>
      </div>
    `,
    focusSelector: "[data-action='confirm-ocr']",
    footer: `<button class="btn btn-ghost" type="button" data-action="close-modal">取消</button><span class="spacer"></span><button class="btn btn-solid" type="button" data-action="confirm-ocr">同意并启用 OCR</button>`
  });
}

async function runOCR(recordId) {
  const record = state.files.find((item) => item.id === recordId);
  const blob = state.pendingFileBlobs.get(recordId);
  if (!record) return;
  if (!(blob instanceof File)) {
    showToast("原文件已不在当前会话，请重新上传后 OCR");
    return;
  }
  closeModal();
  const uploadId = uid("ocr");
  state.fileUploads.push({ id: uploadId, name: record.name, status: "running", progress: 0, message: "OCR 识别" });
  renderFileUploadQueue();
  try {
    const parsed = await parseFile(blob, {
      maxFileMB: state.fileMaxMB,
      enableOCR: true,
      onProgress: (event) => {
        updateFileUpload(uploadId, {
          progress: Math.max(0.02, Math.min(0.98, Number(event.progress) || 0)),
          message: event.message || "OCR 识别中"
        });
      }
    });
    let text = parsed.text || "";
    let privacyMasked = record.privacyMasked;
    const findings = detectSensitive(text);
    if (findings.length) {
      const approved = await reviewFilePrivacy(findings, record.name);
      if (!approved) {
        updateFileUpload(uploadId, { status: "error", progress: 1, message: "已取消", error: "OCR 结果含个人信息，取消保存。" });
        return;
      }
      text = maskSensitive(text, findings);
      privacyMasked = true;
    }
    record.text = text;
    record.chunks = chunkDocument(text, { maxChars: 1000, overlap: 120 });
    record.charCount = text.length;
    record.needsOCR = Boolean(parsed.needsOCR);
    record.privacyMasked = privacyMasked;
    record.warnings = parsed.warnings || [];
    record.status = record.needsOCR ? "OCR 未完成" : "已 OCR";
    await localDB.saveFileRecord(record);
    updateFileUpload(uploadId, { status: "done", progress: 1, message: "OCR 完成" });
    showToast("OCR 已完成；请人工校对识别结果");
    if (state.route.name === "files") renderApp({ preserveScroll: true });
  } catch (error) {
    updateFileUpload(uploadId, { status: "error", progress: 1, message: "OCR 失败", error: error.message || "OCR 不可用" });
    showToast(error.message || "OCR 失败");
  }
}

async function deleteFileRecord(recordId) {
  const record = state.files.find((file) => file.id === recordId);
  if (!record) return;
  await localDB.removeFileRecord(recordId).catch(() => null);
  if (record.knowledgeId) {
    deleteCustomDoc(record.knowledgeId);
    state.customDocs = state.customDocs.filter((doc) => doc.id !== record.knowledgeId);
    await localDB.removeKnowledgeDoc(record.knowledgeId).catch(() => null);
    registerCustomKnowledgeDocs(state.customDocs);
  }
  state.files = state.files.filter((file) => file.id !== recordId);
  state.pendingFileBlobs.delete(recordId);
  closeModal();
  showToast("资料已删除");
  renderApp({ preserveScroll: true });
}

/* ==========================================================
   Modal system
   ========================================================== */

function openModal(config) {
  state.lastFocused = document.activeElement;
  state.modal = config;
  renderModal();
  document.body.classList.add("modal-open");
  requestAnimationFrame(() => {
    if (state.modal?.kind === "form" && window.innerWidth < 720) return;
    const selector = state.modal?.focusSelector || ".modal-close, button, input, select, textarea";
    const target = overlayEl.querySelector(selector);
    target?.focus({ preventScroll: true });
  });
}

function closeModal() {
  if (!state.modal) return;
  if (state.modal.kind === "editor") flushEditorSave({ silent: true });
  if (state.privacyResolve) {
    const pending = state.privacyResolve;
    state.privacyResolve = null;
    pending.reject(new Error("已取消 AI 请求：发送前隐私检查未确认"));
  }
  if (state.filePrivacyResolve) {
    const pending = state.filePrivacyResolve;
    state.filePrivacyResolve = null;
    pending(false);
  }
  if (state.consentCallback) state.consentCallback = null;
  const wasEditor = state.modal.kind === "editor";
  state.modal = null;
  if (wasEditor) state.editor = null;
  overlayEl.innerHTML = "";
  document.body.classList.remove("modal-open");
  if (wasEditor) setTimeout(() => { if (!state.modal) renderApp({ preserveScroll: true }); }, 0);
  if (state.lastFocused?.isConnected) {
    try {
      state.lastFocused.focus({ preventScroll: true });
    } catch (error) {
      // Ignore focus restoration failures.
    }
  }
  state.lastFocused = null;
}

function renderModal() {
  if (!state.modal) {
    overlayEl.innerHTML = "";
    return;
  }
  if (state.modal.kind === "form") {
    renderFormModal();
    return;
  }
  if (state.modal.kind === "editor") {
    renderEditorModal();
    return;
  }
  const modal = state.modal;
  overlayEl.innerHTML = `
    <div class="modal-backdrop" data-modal-backdrop>
      <div class="modal${modal.narrow ? " is-narrow" : ""}" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div class="modal-head">
          <div>
            <div class="modal-kicker">${escapeHtml(modal.kicker || "SHOUYU / DIALOG")}</div>
            <h2 class="modal-title" id="modal-title">${escapeHtml(modal.title || "")}</h2>
            ${modal.sub ? `<p class="modal-sub">${escapeHtml(modal.sub)}</p>` : ""}
          </div>
          <button class="modal-close" type="button" data-action="close-modal" aria-label="关闭">${icon("close", 13)}</button>
        </div>
        <div class="modal-body">${modal.body || ""}</div>
        ${modal.footer ? `<div class="modal-foot">${modal.footer}</div>` : ""}
      </div>
    </div>
  `;
}

/* ==========================================================
   Artifact editor
   ========================================================== */

function cloneForEditor(value) {
  return JSON.parse(JSON.stringify(value));
}

function openArtifactEditor(messageId) {
  const { conv, message } = findMessage(messageId);
  const artifact = message?.result?.artifact;
  if (!conv || !artifact) {
    showToast("没有可编辑的成果");
    return;
  }
  const doc = getActiveDoc(artifact, messageId) || artifact.docs[0];
  state.editor = {
    convId: conv.id,
    messageId,
    artifact: cloneForEditor(artifact),
    docId: doc?.id || "",
    sectionId: doc?.sections?.[0]?.id || "",
    history: [cloneForEditor(artifact)],
    historyIndex: 0,
    lastHistoryAt: 0,
    saveTimer: null,
    status: "已载入",
    dirty: false
  };
  openModal({
    kind: "editor",
    kicker: "EDITOR / 成果编辑器",
    title: "编辑与预览",
    focusSelector: "[data-editor-field='doc-title']"
  });
}

function currentEditorDoc() {
  if (!state.editor) return null;
  const doc = state.editor.artifact.docs.find((item) => item.id === state.editor.docId);
  return doc || state.editor.artifact.docs[0];
}

function currentEditorSection() {
  const doc = currentEditorDoc();
  if (!doc) return null;
  return doc.sections.find((section) => section.id === state.editor.sectionId) || doc.sections[0];
}

function editorSnapshot() {
  return cloneForEditor(state.editor.artifact);
}

function editorPushHistory() {
  if (!state.editor) return;
  const now = Date.now();
  if (now - state.editor.lastHistoryAt < 650) return;
  state.editor.lastHistoryAt = now;
  state.editor.history = state.editor.history.slice(0, state.editor.historyIndex + 1);
  state.editor.history.push(editorSnapshot());
  if (state.editor.history.length > 40) state.editor.history.shift();
  state.editor.historyIndex = state.editor.history.length - 1;
}

function refreshEditorHistoryButtons() {
  if (!state.editor) return;
  const undo = document.querySelector("[data-action='editor-undo']");
  const redo = document.querySelector("[data-action='editor-redo']");
  if (undo) undo.disabled = state.editor.historyIndex <= 0;
  if (redo) redo.disabled = state.editor.historyIndex >= state.editor.history.length - 1;
}

function updateEditorFromInput(target) {
  if (!state.editor) return;
  const doc = currentEditorDoc();
  const section = currentEditorSection();
  if (!doc) return;
  const field = target.dataset.editorField;
  const blockIndex = Number(target.dataset.blockIndex);
  const block = Number.isInteger(blockIndex) ? section?.blocks?.[blockIndex] : null;
  if (!field && !block) return;
  editorPushHistory();
  if (field === "doc-title") {
    doc.title = target.value;
    doc.filename = target.value;
  } else if (field === "section-title") {
    if (section) section.title = target.value;
  } else if (field === "block-title" && block) {
    block.title = target.value;
  } else if (field === "block-text" && block) {
    block.text = target.value;
  } else if (field === "block-items" && block) {
    block.items = target.value.split("\n").map((line) => line.trim()).filter(Boolean);
  } else if (field === "table-header" && block) {
    block.headers[Number(target.dataset.col)] = target.value;
  } else if (field === "table-cell" && block) {
    const row = Number(target.dataset.row);
    const col = Number(target.dataset.col);
    if (!block.rows[row]) block.rows[row] = [];
    block.rows[row][col] = target.value;
  } else if (field === "line-label" && block) {
    block.label = target.value;
  }
  state.editor.dirty = true;
  refreshEditorPreview();
  refreshEditorHistoryButtons();
  scheduleEditorSave();
}

function refreshEditorPreview() {
  const preview = document.getElementById("editor-preview-body");
  const doc = currentEditorDoc();
  if (!preview || !doc) return;
  const section = currentEditorSection();
  preview.innerHTML = `
    <div class="editor-preview-title">${escapeHtml(doc.title)}</div>
    <div class="editor-preview-meta">${(doc.meta || []).map((item) => `<span>${escapeHtml(item.label)}：${escapeHtml(item.value)}</span>`).join("")}</div>
    ${doc.sections.map((item) => `
      <section class="editor-preview-section${item.id === section?.id ? " is-selected" : ""}" data-preview-section="${escapeAttr(item.id)}">
        <div class="editor-preview-section-head">
          <span>${escapeHtml(item.no)}</span>
          <h3>${escapeHtml(item.title)}</h3>
          ${item.aiEnhanced ? `<span class="section-ai-badge">${icon("spark", 8)} AI 改写</span>` : ""}
        </div>
        ${renderBlocks(item.blocks)}
      </section>
    `).join("")}
  `;
}

function renderEditorBlockFields(block, index) {
  if (!block) return "";
  if (block.type === "paragraph") {
    return `<div class="editor-block"><label class="editor-block-label">段落 ${index + 1}</label><textarea data-editor-field="block-text" data-block-index="${index}" rows="4">${escapeHtml(block.text || "")}</textarea><button class="editor-block-remove" type="button" data-action="editor-remove-block" data-block-index="${index}">删除此段</button></div>`;
  }
  if (block.type === "callout") {
    return `<div class="editor-block"><label class="editor-block-label">提示框 ${index + 1}</label><input data-editor-field="block-title" data-block-index="${index}" value="${escapeAttr(block.title || "")}" placeholder="提示标题"><textarea data-editor-field="block-text" data-block-index="${index}" rows="3">${escapeHtml(block.text || "")}</textarea><button class="editor-block-remove" type="button" data-action="editor-remove-block" data-block-index="${index}">删除此块</button></div>`;
  }
  if (block.type === "list" || block.type === "checklist") {
    return `<div class="editor-block"><label class="editor-block-label">${block.type === "checklist" ? "核对清单" : "列表"} ${index + 1} <span>每行一条</span></label><textarea data-editor-field="block-items" data-block-index="${index}" rows="${Math.max(4, (block.items || []).length + 1)}">${escapeHtml((block.items || []).join("\n"))}</textarea><button class="editor-block-remove" type="button" data-action="editor-remove-block" data-block-index="${index}">删除此块</button></div>`;
  }
  if (block.type === "table") {
    return `<div class="editor-block"><label class="editor-block-label">表格 ${index + 1} <span>可直接编辑单元格</span></label>
      <div class="editor-table-wrap"><table class="editor-table"><thead><tr>${(block.headers || []).map((cell, col) => `<th><input data-editor-field="table-header" data-block-index="${index}" data-col="${col}" value="${escapeAttr(cell)}"></th>`).join("")}</tr></thead>
      <tbody>${(block.rows || []).map((row, rowIndex) => `<tr>${(block.headers || []).map((_, col) => `<td><input data-editor-field="table-cell" data-block-index="${index}" data-row="${rowIndex}" data-col="${col}" value="${escapeAttr(row[col] || "")}"></td>`).join("")}</tr>`).join("")}</tbody></table></div>
      <button class="editor-block-remove" type="button" data-action="editor-remove-block" data-block-index="${index}">删除此表</button></div>`;
  }
  if (block.type === "lines") {
    return `<div class="editor-block"><label class="editor-block-label">书写行 ${index + 1}</label><input data-editor-field="line-label" data-block-index="${index}" value="${escapeAttr(block.label || "")}" placeholder="书写区标签"><p class="settings-note">${block.count || 3} 条书写线；在导出文档中保留。</p></div>`;
  }
  return "";
}

function renderEditorModal() {
  const modal = state.modal;
  const editor = state.editor;
  if (!editor) {
    overlayEl.innerHTML = "";
    return;
  }
  const doc = currentEditorDoc();
  const section = currentEditorSection();
  if (!doc) {
    overlayEl.innerHTML = "";
    return;
  }
  const docTabs = editor.artifact.docs.length > 1 ? `<nav class="doc-tabs editor-doc-tabs">${editor.artifact.docs.map((item) => `<button class="doc-tab${item.id === doc.id ? " is-active" : ""}" type="button" data-action="editor-doc" data-id="${escapeAttr(item.id)}">${escapeHtml(item.label)}</button>`).join("")}</nav>` : "";
  overlayEl.innerHTML = `
    <div class="modal-backdrop" data-modal-backdrop>
      <div class="modal is-editor" role="dialog" aria-modal="true" aria-labelledby="editor-heading">
        <div class="editor-top">
          <div>
            <div class="modal-kicker">EDITOR / 成果编辑器 · 自动保存</div>
            <h2 class="modal-title" id="editor-heading">${escapeHtml(doc.title)}</h2>
            <p class="modal-sub">左边选择模块，中间编辑，右边实时预览。保存发生在本机 IndexedDB；正式使用前仍须人工审核。</p>
          </div>
          <div class="editor-top-actions">
            <span class="editor-save-status" id="editor-save-status">${escapeHtml(editor.status)}</span>
            <button class="btn btn-ghost" type="button" data-action="editor-undo" ${editor.historyIndex <= 0 ? "disabled" : ""}>撤销</button>
            <button class="btn btn-ghost" type="button" data-action="editor-redo" ${editor.historyIndex >= editor.history.length - 1 ? "disabled" : ""}>恢复</button>
            <button class="modal-close" type="button" data-action="close-modal" aria-label="关闭编辑器">${icon("close", 13)}</button>
          </div>
        </div>
        ${docTabs}
        <div class="editor-layout">
          <aside class="editor-outline">
            <div class="editor-outline-head"><span>模块</span><button class="btn-link" type="button" data-action="editor-add-section">+ 新模块</button></div>
            <div class="editor-outline-list">
              ${doc.sections.map((item, index) => `
                <div class="editor-outline-item${item.id === section?.id ? " is-active" : ""}" draggable="true" data-section-id="${escapeAttr(item.id)}" data-action="editor-select-section" tabindex="0">
                  <span class="editor-drag" aria-hidden="true">⋮⋮</span>
                  <span class="editor-outline-no">${escapeHtml(item.no)}</span>
                  <span class="editor-outline-title">${escapeHtml(item.title)}</span>
                  ${item.aiEnhanced ? `<span class="editor-ai-dot" title="AI 改写"></span>` : ""}
                  <span class="editor-outline-order">
                    <button type="button" data-action="editor-move-section" data-dir="-1" data-id="${escapeAttr(item.id)}" aria-label="上移">↑</button>
                    <button type="button" data-action="editor-move-section" data-dir="1" data-id="${escapeAttr(item.id)}" aria-label="下移">↓</button>
                  </span>
                </div>
              `).join("")}
            </div>
            <p class="editor-tip">拖动模块排序；↑↓ 也支持键盘操作。AI 改写的模块会显示圆点。</p>
          </aside>
          <section class="editor-form">
            <div class="field"><label for="editor-doc-title">文档标题</label><input id="editor-doc-title" data-editor-field="doc-title" value="${escapeAttr(doc.title)}"></div>
            ${section ? `
              <div class="field"><label for="editor-section-title">模块标题</label><input id="editor-section-title" data-editor-field="section-title" value="${escapeAttr(section.title)}"></div>
              <div class="editor-blocks">
                ${(section.blocks || []).map((block, index) => renderEditorBlockFields(block, index)).join("")}
              </div>
              <div class="editor-add-block-row">
                <button class="btn btn-ghost" type="button" data-action="editor-add-block" data-type="paragraph">+ 段落</button>
                <button class="btn btn-ghost" type="button" data-action="editor-add-block" data-type="list">+ 列表</button>
                <button class="btn btn-ghost" type="button" data-action="editor-add-block" data-type="checklist">+ 清单</button>
              </div>
            ` : `<div class="empty-state" style="padding:20px"><p class="empty-copy">这份成果还没有模块。</p></div>`}
          </section>
          <section class="editor-preview">
            <div class="editor-preview-head">
              <span>实时预览 / PREVIEW</span>
              <span>${(section?.refs || []).length} 处依据</span>
            </div>
            <div class="editor-preview-body" id="editor-preview-body"></div>
          </section>
        </div>
        <div class="editor-foot">
          <button class="btn" type="button" data-action="editor-copy">${icon("copy", 12)}复制全文</button>
          <button class="btn" type="button" data-action="editor-docx">${icon("download", 12)}导出 DOCX</button>
          <button class="btn btn-ghost" type="button" data-action="editor-pdf">${icon("printer", 12)}PDF / 打印</button>
          <button class="btn btn-ghost" type="button" data-action="editor-xlsx">${icon("grid", 12)}Excel</button>
          <span class="spacer"></span>
          <button class="btn btn-ghost" type="button" data-action="editor-regenerate">重新生成</button>
          <button class="btn btn-solid" type="button" data-action="close-modal">完成并返回</button>
        </div>
      </div>
    </div>
  `;
  refreshEditorPreview();
}

function scheduleEditorSave() {
  if (!state.editor) return;
  state.editor.status = "正在自动保存…";
  const statusEl = document.getElementById("editor-save-status");
  if (statusEl) statusEl.textContent = state.editor.status;
  clearTimeout(state.editor.saveTimer);
  state.editor.saveTimer = setTimeout(() => flushEditorSave(), 650);
}

function flushEditorSave({ silent = false } = {}) {
  const editor = state.editor;
  if (!editor) return;
  clearTimeout(editor.saveTimer);
  const conv = findConversation(editor.convId);
  const message = conv?.messages.find((item) => item.id === editor.messageId);
  if (!conv || !message || !message.result) return;
  message.result.artifact = cloneForEditor(editor.artifact);
  message.result.sources = editor.artifact.sources;
  conv.latestArtifact = editor.artifact;
  conv.updatedAt = new Date().toISOString();
  saveDB();
  editor.dirty = false;
  editor.status = "已自动保存";
  const statusEl = document.getElementById("editor-save-status");
  if (statusEl) statusEl.textContent = "已自动保存";
}

function moveEditorSection(sectionId, offset) {
  const doc = currentEditorDoc();
  if (!doc) return;
  const index = doc.sections.findIndex((section) => section.id === sectionId);
  const target = index + offset;
  if (index < 0 || target < 0 || target >= doc.sections.length) return;
  editorPushHistory();
  const [section] = doc.sections.splice(index, 1);
  doc.sections.splice(target, 0, section);
  state.editor.sectionId = section.id;
  state.editor.dirty = true;
  scheduleEditorSave();
  renderEditorModal();
}

/* ==========================================================
   Documents / forms
   ========================================================== */

function openDocModal(docId, sectionId = "") {
  const doc = getDoc(docId);
  if (!doc) {
    showToast("没有找到这份材料");
    return;
  }
  const body = `
    <div class="kb-doc-head">
      <div class="kb-doc-meta">
        <span>${escapeHtml(doc.id)}</span>
        <span>${escapeHtml(doc.category)}</span>
        <span>${escapeHtml(doc.version)}</span>
        <span>更新 ${escapeHtml(doc.updated)}</span>
        <span>${doc.sections.length} 个可检索片段</span>
        ${doc.builtin ? "<span>内置只读</span>" : "<span>自定义可编辑</span>"}
      </div>
      <h2 class="kb-doc-title">${escapeHtml(doc.title)}</h2>
      <p class="kb-doc-summary">${escapeHtml(doc.summary)}</p>
      <div class="kb-doc-extra">
        ${doc.specialty ? `<span>专业：${escapeHtml(doc.specialty)}</span>` : ""}
        ${doc.course ? `<span>课程：${escapeHtml(doc.course)}</span>` : ""}
        ${doc.source ? `<span>来源：${escapeHtml(doc.source)}</span>` : ""}
        ${doc.author ? `<span>作者 / 单位：${escapeHtml(doc.author)}</span>` : ""}
        ${doc.published ? `<span>发布：${escapeHtml(doc.published)}</span>` : ""}
      </div>
    </div>
    <div class="kb-doc-warning">${doc.builtin ? "演示用校本示例材料，不对应学院正式文件。正式使用前请由课程负责人替换、审核并留存版本记录。" : "教师自建 / 导入材料，未经学校审核。引用前请核对原文；正式制度仍以学院现行文件为准。"}</div>
    ${doc.scope ? `<div class="kb-doc-scope"><strong>适用范围：</strong>${escapeHtml(doc.scope)}</div>` : ""}
    ${doc.sections.map((section) => `
      <section class="kb-doc-section${section.id === sectionId ? " highlight-section" : ""}" id="kb-section-${escapeAttr(section.id)}">
        <h3><span>${escapeHtml(section.no)}</span>${escapeHtml(section.title)}</h3>
        <p>${escapeHtml(section.text)}</p>
        ${(section.bullets || []).length ? `<ul>${section.bullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join("")}</ul>` : ""}
      </section>
    `).join("")}
  `;
  openModal({
    kind: "doc",
    kicker: `${doc.id} / KNOWLEDGE DOCUMENT`,
    title: doc.title,
    body,
    focusSelector: ".modal-close",
    footer: `
      <button class="btn" type="button" data-action="copy-kb" data-doc="${escapeAttr(doc.id)}">${icon("copy", 12)}复制全文</button>
      <button class="btn btn-ghost" type="button" data-action="download-kb" data-doc="${escapeAttr(doc.id)}">${icon("download", 12)}下载 Markdown</button>
      ${doc.builtin
        ? `<button class="btn btn-ghost" type="button" data-action="copy-kb-doc" data-id="${escapeAttr(doc.id)}">${icon("copy", 12)}复制为自定义</button>`
        : `<button class="btn btn-ghost" type="button" data-action="edit-kb-doc" data-id="${escapeAttr(doc.id)}">${icon("sliders", 12)}编辑</button>
           <button class="btn btn-ghost" type="button" data-action="delete-kb-doc" data-id="${escapeAttr(doc.id)}">${icon("trash", 12)}删除</button>`}
      <span class="spacer"></span>
      <span class="modal-foot-note">引用格式：${escapeHtml(doc.id)} §章节号</span>
      <button class="btn btn-solid" type="button" data-action="close-modal">关闭</button>
    `
  });
  requestAnimationFrame(() => {
    if (!sectionId) return;
    const target = overlayEl.querySelector(`#kb-section-${CSS.escape(sectionId)}`);
    target?.scrollIntoView({ block: "center" });
  });
}

/* ==========================================================
   Task form
   ========================================================== */

function openSceneForm(sceneId, options = {}) {
  if (state.generating || state.chatBusy) {
    showToast("当前任务还在运行，请稍候");
    return;
  }
  const scene = SCENES.find((item) => item.id === sceneId);
  if (!scene) return;
  const active = findConversation(state.activeId);
  let prefill = { ...(options.prefill || {}) };
  if (options.fromActive && active?.context) prefill = { ...active.context, ...prefill };
  if (options.mode === "regenerate" && active?.context) prefill = { ...active.context };
  // Do not carry engine placeholders or a previous scene's template into a new form.
  if (/^未填写/.test(prefill.major || "")) delete prefill.major;
  if (/^未填写/.test(prefill.course || "")) delete prefill.course;
  if ((sceneId === "lesson" || sceneId === "materials" || sceneId === "evaluate") && (prefill.task === prefill.venue || /^听课记录/.test(prefill.task || ""))) {
    delete prefill.task;
  }
  if (sceneId === "lesson") {
    const picked = options.templateId || prefill.template || prefill.templateId;
    prefill.template = LESSON_TEMPLATES.some((item) => item.id === picked) ? picked : "standard";
  } else {
    delete prefill.template;
  }
  if (sceneId === "evaluate" && options.templateId) prefill.evalTemplate = options.templateId;
  if (sceneId === "observe" && options.templateId) prefill.observationTemplate = options.templateId;
  if (sceneId === "lesson" || sceneId === "materials") {
    if (!prefill.lessonType) prefill.lessonType = "一体化";
    if (!prefill.hours) prefill.hours = "4";
  }
  if (sceneId === "evaluate" && !prefill.evalTemplate) prefill.evalTemplate = "process";
  if (sceneId === "observe" && !prefill.observationTemplate) prefill.observationTemplate = "evidence";
  if (sceneId === "materials" && !prefill.materialsOutput) prefill.materialsOutput = "both";
  if (sceneId === "safety" && !prefill.audience) prefill.audience = "学生";
  if (sceneId === "safety" && !prefill.focus) prefill.focus = "上电与接线安全";
  if (sceneId === "observe" && !prefill.focus) prefill.focus = "综合诊断";
  const mode = options.mode === "regenerate" && active ? "regenerate" : "new";
  const reuseConvId = mode === "regenerate"
    ? active.id
    : options.fromActive && active
      ? active.id
      : "";
  state.modal = {
    kind: "form",
    sceneId,
    mode,
    convId: mode === "regenerate" ? active.id : "",
    reuseConvId,
    prefill
  };
  renderModal();
  document.body.classList.add("modal-open");
  requestAnimationFrame(() => {
    if (window.innerWidth >= 720) {
      document.querySelector("#task-form input[name='major'], #task-form textarea[name='observation'], #task-form select[name='venue']")?.focus({ preventScroll: true });
    }
  });
}

function renderFormModal() {
  const modal = state.modal;
  const scene = SCENES.find((item) => item.id === modal.sceneId);
  if (!scene) return;
  const prefill = modal.prefill || {};
  const isEdit = modal.mode === "regenerate";
  const fieldHtml = buildFormFields(modal.sceneId, prefill);
  const submitText = modal.sceneId === "safety" ? "检索规程" : "开始生成";
  overlayEl.innerHTML = `
    <div class="modal-backdrop" data-modal-backdrop>
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div class="modal-head">
          <div>
            <div class="modal-kicker">PARAMETERS / ${escapeHtml(scene.no)} ${isEdit ? "· 重新生成" : "· 先问清再生成"}</div>
            <h2 class="modal-title" id="modal-title">${isEdit ? "调整任务条件" : `配置任务 · ${escapeHtml(scene.label)}`}</h2>
            <p class="modal-sub">${isEdit ? "保留本对话记录与已生成内容，按新条件再生成一份。其余参数会保留。" : state.modal.reuseConvId ? "继续当前对话，把新成果追加在同一任务记录中；专业、课程、任务等条件会带入。" : escapeHtml(scene.long)}</p>
          </div>
          <button class="modal-close" type="button" data-action="close-modal" aria-label="关闭">${icon("close", 13)}</button>
        </div>
        <form id="task-form" data-scene="${escapeAttr(modal.sceneId)}" novalidate>
          <div class="modal-body">
            <div class="form-banner">
              <div><strong>生成前先确认关键条件。</strong> 没填学情、课型或设备，结果就会变成泛化模板。带 <span class="required-mark">必填</span> 的字段会先校验。</div>
              <button class="btn-link" type="button" data-action="fill-example">载入示例</button>
            </div>
            ${state.attachments.length ? `<div class="form-banner"><div><strong>已附带 ${state.attachments.length} 份本地资料。</strong> 本次生成会把资料摘要作为任务参考，不会上传。请先确认资料已脱敏。</div></div>` : ""}
            ${fieldHtml}
            <div class="form-privacy">${icon("shield", 11)} <span>所有输入仅在本机浏览器处理，不上传服务器。请勿填写学生姓名、学号、联系方式、家庭信息；正式使用前由教师人工审核。</span></div>
          </div>
          <div class="modal-foot">
            <button class="btn btn-ghost" type="button" data-action="close-modal">取消</button>
            <span class="spacer"></span>
            <span class="modal-foot-note">本地工作流 · 生成约 2 秒</span>
            <button class="btn btn-solid" type="submit">${escapeHtml(submitText)} ${icon("arrowUpRight", 12)}</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

function fieldMarkup({ name, label, type = "text", value = "", required = false, placeholder = "", hint = "", options = null, rows = 3, full = false, list = "", max, min, autocomplete = "off" }) {
  const safeValue = String(value ?? "");
  let control = "";
  if (type === "select") {
    const values = [...(options || [])];
    if (safeValue && !values.some((option) => (typeof option === "string" ? option : option.value) === safeValue)) {
      values.unshift({ value: safeValue, label: safeValue });
    }
    control = `<select id="field-${escapeAttr(name)}" name="${escapeAttr(name)}" ${required ? `data-required="true" aria-required="true"` : ""}>
      ${values.map((option) => {
        const optionValue = typeof option === "string" ? option : option.value;
        const optionLabel = typeof option === "string" ? option : option.label;
        return `<option value="${escapeAttr(optionValue)}" ${optionValue === safeValue ? "selected" : ""}>${escapeHtml(optionLabel)}</option>`;
      }).join("")}
    </select>`;
  } else if (type === "textarea") {
    control = `<textarea id="field-${escapeAttr(name)}" name="${escapeAttr(name)}" rows="${rows}" placeholder="${escapeAttr(placeholder)}" ${required ? `data-required="true" aria-required="true"` : ""}>${escapeHtml(safeValue)}</textarea>`;
  } else {
    control = `<input id="field-${escapeAttr(name)}" name="${escapeAttr(name)}" type="${escapeAttr(type)}" value="${escapeAttr(safeValue)}" placeholder="${escapeAttr(placeholder)}" ${list ? `list="${escapeAttr(list)}"` : ""} ${max != null ? `max="${escapeAttr(max)}"` : ""} ${min != null ? `min="${escapeAttr(min)}"` : ""} autocomplete="${escapeAttr(autocomplete)}" ${required ? `data-required="true" aria-required="true"` : ""}>`;
  }
  return `
    <div class="field${full ? " field-full" : ""}" data-field="${escapeAttr(name)}">
      <label for="field-${escapeAttr(name)}">${escapeHtml(label)}${required ? '<span class="required-mark">必填</span>' : '<span class="required-mark">选填</span>'}</label>
      ${control}
      ${hint ? `<span class="field-hint">${escapeHtml(hint)}</span>` : ""}
      <span class="field-error">请${type === "select" ? "选择" : "填写"}${escapeHtml(label.replace(/（.*?）/g, ""))}</span>
    </div>
  `;
}

function buildFormFields(sceneId, p) {
  const majorOptions = MAJORS.map((major) => `<option value="${escapeAttr(major)}"></option>`).join("");
  const courseValues = Array.from(new Set([...TASK_PRESETS.map((item) => item.course), ...Object.values(COURSE_FALLBACK)]));
  const courseOptions = courseValues.map((course) => `<option value="${escapeAttr(course)}"></option>`).join("");
  const taskOptions = TASK_PRESETS.map((item) => `<option value="${escapeAttr(item.label)}"></option>`).join("");
  const datalists = `
    <datalist id="major-options">${majorOptions}</datalist>
    <datalist id="course-options">${courseOptions}</datalist>
    <datalist id="task-options">${taskOptions}</datalist>
  `;
  const presetField = `
    <div class="field field-full">
      <label for="task-preset">从典型任务画像开始 <span class="required-mark">可选</span></label>
      <select id="task-preset">
        <option value="">自定义任务 / 手动填写</option>
        ${TASK_PRESETS.map((item) => `<option value="${escapeAttr(item.id)}">${escapeHtml(item.label)}</option>`).join("")}
      </select>
      <span class="field-hint">选择典型任务可带入专业、课程、设备与安全画像；带入后仍可逐项修改。</span>
    </div>
  `;
  const commonBase = `
    ${presetField}
    ${fieldMarkup({ name: "major", label: "专业", value: p.major || "", required: true, placeholder: "如：电气自动化设备安装与维修", list: "major-options" })}
    ${fieldMarkup({ name: "course", label: "课程", value: p.course || "", required: true, placeholder: "如：电动机控制线路安装与调试", list: "course-options" })}
    ${fieldMarkup({ name: "task", label: "工作任务", value: p.task || "", required: true, placeholder: "如：三相异步电动机正反转控制线路安装与调试", list: "task-options", full: true })}
  `;
  if (sceneId === "lesson" || sceneId === "materials") {
    return `${datalists}
      <div class="form-section-title">任务条件</div>
      <div class="form-grid">
        ${commonBase}
        ${fieldMarkup({ name: "lessonType", label: "课型", value: p.lessonType || "一体化", required: true, type: "select", options: [
          { value: "一体化", label: "一体化（理论 + 实践）" },
          { value: "实训", label: "实训课" },
          { value: "理论", label: "理论课" }
        ] })}
        ${fieldMarkup({ name: "hours", label: "总学时", value: p.hours || "4", required: true, type: "select", options: ["2", "3", "4", "6", "8", "12"].map((hours) => ({ value: hours, label: `${hours} 学时` })) })}
        ${fieldMarkup({ name: "learners", label: "学情", value: p.learners || "", required: true, type: "textarea", rows: 3, full: true, placeholder: "班级人数、已学先修内容、常见困难、设备台套数等（不写姓名）", hint: "只写班级层面信息。示例：36 人，已学安全用电与电工工具；接线工艺和互锁原理不熟；8 台实训台，4 人一组轮换。" })}
        ${sceneId === "materials" ? fieldMarkup({ name: "materialsOutput", label: "输出内容", value: p.materialsOutput || "both", required: true, type: "select", options: [
          { value: "both", label: "学习任务单 + 六步工作页" },
          { value: "tasksheet", label: "仅学习任务单" },
          { value: "workpage", label: "仅六步工作页" }
        ] }) : fieldMarkup({ name: "template", label: "教案模板", value: p.template || p.templateId || "standard", required: true, type: "select", options: LESSON_TEMPLATES.map((item) => ({ value: item.id, label: `${item.name} · ${item.tag}` })) })}
        ${fieldMarkup({ name: "resources", label: "教学条件 / 设备", value: p.resources || "", type: "textarea", rows: 3, full: true, placeholder: "设备、工量具、耗材、软件、场地；如“电工实训台 8 台，万用表、剥线钳、接触器若干”", hint: "设备数量会影响分组与轮换设计，建议填写。" })}
        ${fieldMarkup({ name: "notes", label: "特别要求", value: p.notes || "", type: "textarea", rows: 2, full: true, placeholder: "如：强调断电验电；融入安全规范；为下一轮公开课准备展示点。", hint: "可写教学重点、课程思政、展示要求；不要填写学生个人情况。" })}
      </div>
      <div class="form-section-title">生成边界</div>
      <div class="form-banner" style="margin-bottom:0"><div><strong>输出的是可修改草稿。</strong> 学习目标、设备参数、安全条款和评价权重仍需教师逐项审核；模板不会替你确认企业标准。</div></div>
    `;
  }
  if (sceneId === "evaluate") {
    return `${datalists}
      <div class="form-section-title">评价任务</div>
      <div class="form-grid">
        ${commonBase}
        ${fieldMarkup({ name: "evalTemplate", label: "评价模板", value: p.evalTemplate || "process", required: true, type: "select", options: EVAL_TEMPLATES.map((item) => ({ value: item.id, label: `${item.name} · ${item.tag}` })) })}
        ${fieldMarkup({ name: "learners", label: "学情 / 评价背景", value: p.learners || "", type: "textarea", rows: 3, full: true, placeholder: "班级规模、已完成的训练、评价痛点（如“互评容易走过场”）", hint: "用于调整评价组织与反馈建议，不写姓名。" })}
        ${fieldMarkup({ name: "notes", label: "特别要求", value: p.notes || "", type: "textarea", rows: 2, full: true, placeholder: "如：过程性 60% + 成果 40%；需要有安全一票否决；评分描述要可观察。" })}
      </div>
      <div class="form-section-title">生成边界</div>
      <div class="form-banner" style="margin-bottom:0"><div><strong>不代替正式评价制度。</strong> 权重、补做规则与一票否决条款须与学院现行文件一致；AI 不参与学生排名或标签判断。</div></div>
    `;
  }
  if (sceneId === "safety") {
    return `${datalists}
      <div class="form-section-title">查询条件</div>
      <div class="form-grid">
        ${fieldMarkup({ name: "venue", label: "实训场所", value: p.venue || "", required: true, type: "select", options: [
          { value: "", label: "请选择实训场所" },
          { value: "电工实训室", label: "电工实训室（知识库已覆盖）" },
          { value: "PLC 实训室", label: "PLC 实训室（知识库已覆盖）" },
          { value: "数控实训室", label: "数控实训室（未收录专项规程）" },
          { value: "汽车实训室", label: "汽车实训室（未收录专项规程）" },
          { value: "工业机器人实训室", label: "工业机器人实训室（未收录专项规程）" },
          { value: "其他实训场所", label: "其他 / 校外场所（未收录）" }
        ], hint: "目前知识库仅覆盖电工与 PLC 实训室；选择其他场所时，助手会明确说明未收录，不会编造。" })}
        ${fieldMarkup({ name: "audience", label: "人员", value: p.audience || "学生", type: "select", options: ["学生", "新进教师", "参观人员", "维修人员"] })}
        ${fieldMarkup({ name: "operation", label: "具体操作 / 设备", value: p.operation || "", type: "text", placeholder: "如：正反转控制线路接线后的上电调试", full: true, hint: "越具体，检索越准确；但请不要填写涉密设备信息。" })}
        ${fieldMarkup({ name: "focus", label: "重点关注", value: p.focus || "上电与接线安全", type: "select", options: ["上电与接线安全", "准入与个人防护", "异常与应急处置", "PLC 调试", "综合核查"] })}
        ${fieldMarkup({ name: "notes", label: "补充条件", value: p.notes || "", type: "textarea", rows: 2, full: true, placeholder: "如：需要一张学生上电前自检清单；只查知识库有依据的条款。" })}
      </div>
      <div class="form-section-title">安全边界</div>
      <div class="form-banner" style="margin-bottom:0"><div><strong>只回答知识库可支持的内容。</strong> 本工具不替代现场安全交底、设备操作票或有资质人员判断；未收录的场所会建议咨询实训中心安全员。</div></div>
    `;
  }
  return `${datalists}
    <div class="form-section-title">听课记录</div>
    <div class="form-grid">
      ${fieldMarkup({ name: "observation", label: "听课记录（请先脱敏）", value: p.observation || "", required: true, type: "textarea", rows: 8, full: true, placeholder: "按时间或环节记录：教师做了什么、学生做了什么、有什么证据、你的即时思考。请删除姓名、班级、联系方式。", hint: "没有记录的内容，助手会标注“待确认”，不会编造课堂事实。" })}
      ${fieldMarkup({ name: "course", label: "课程", value: p.course || "", type: "text", placeholder: "如：电动机控制线路安装与调试", list: "course-options" })}
      ${fieldMarkup({ name: "task", label: "学习任务", value: p.task || "", type: "text", placeholder: "如：正反转控制线路安装与调试", list: "task-options" })}
      ${fieldMarkup({ name: "focus", label: "观察重点", value: p.focus || "综合诊断", type: "select", options: ["综合诊断", "目标达成与学生参与", "评价反馈", "安全与规范", "教师指导"] })}
      ${fieldMarkup({ name: "observationTemplate", label: "反馈风格", value: p.observationTemplate || "evidence", type: "select", options: OBSERVATION_TEMPLATES.map((item) => ({ value: item.id, label: `${item.name} · ${item.tag}` })) })}
      ${fieldMarkup({ name: "notes", label: "补充要求", value: p.notes || "", type: "textarea", rows: 2, full: true, placeholder: "如：只写有证据的意见；聚焦一个可以下节课改进的动作。" })}
    </div>
    <div class="form-section-title">评价边界</div>
    <div class="form-banner" style="margin-bottom:0"><div><strong>证据不足就不给分。</strong> 如果记录无法支持某个维度，助手会明确写“未观察到”，而不是生成虚假的精确评分。</div></div>
  `;
}

function fillFormExample() {
  const form = document.getElementById("task-form");
  if (!form) return;
  const sceneId = state.modal?.sceneId;
  const preset = TASK_PRESETS[0];
  const setValue = (name, value) => {
    const field = form.elements.namedItem(name);
    if (!field) return;
    if (field instanceof RadioNodeList) return;
    if (field.tagName === "SELECT" && ![...field.options].some((option) => option.value === value)) {
      field.add(new Option(value, value));
    }
    field.value = value;
  };
  if (sceneId === "lesson" || sceneId === "materials" || sceneId === "evaluate") {
    setValue("major", preset.major);
    setValue("course", preset.course);
    setValue("task", preset.label);
    setValue("lessonType", "一体化");
    setValue("hours", "4");
    setValue("learners", "班级 36 人，已完成安全用电与常用电工工具训练；能识读简单主电路图，但接线工艺和互锁原理不熟；实训台 8 台套，建议 4 人一组轮换。");
    setValue("resources", "电工实训台 8 台；三相异步电动机 8 台；交流接触器、热继电器、按钮盒、熔断器、导线、万用表、剥线钳、螺钉旋具。");
    setValue("notes", "强调断电验电与通电前互检；融入安全规范和团队协作；流程需体现完整工作过程。");
    if (sceneId === "lesson") setValue("template", "standard");
    if (sceneId === "materials") setValue("materialsOutput", "both");
    if (sceneId === "evaluate") setValue("evalTemplate", "process");
    const presetSelect = form.querySelector("#task-preset");
    if (presetSelect) presetSelect.value = preset.id;
  } else if (sceneId === "safety") {
    setValue("venue", "电工实训室");
    setValue("operation", "正反转控制线路接线完成后的上电检查与调试");
    setValue("audience", "学生");
    setValue("focus", "上电与接线安全");
    setValue("notes", "重点核对断电验电、教师上电确认、一人操作一人监护，以及异常处置。");
  } else if (sceneId === "observe") {
    setValue("course", "电动机控制线路安装与调试");
    setValue("task", "正反转控制线路安装与调试");
    setValue("focus", "综合诊断");
    setValue("observationTemplate", "evidence");
    setValue("observation", "导入环节，教师用输送机正反转视频引出任务，约 4 分钟，学生能说出正反转的用途。任务实施前，教师集中示范剥线和接触器接线，约 12 分钟，全班观看。随后学生 4 人一组接线，教师在 3 个工位停留指导。第 2 组出现按钮互锁接错，教师让学生对照原理图自查后修正。第 5 组一名学生未断电就想改线，被同伴提醒，教师随即叫停全班并复述断电验电流程。评价环节时间较紧，教师口头点评了 2 组，未使用评分表，学生未开展互评。收尾时部分工位工具未归位。");
    setValue("notes", "只写记录中有证据的内容；聚焦一个下节课可执行的改进动作。");
  }
  form.querySelectorAll(".field.has-error").forEach((field) => field.classList.remove("has-error"));
  showToast("示例参数已填入，请按真实情况修改后生成");
}

function applyTaskPreset(presetId) {
  const form = document.getElementById("task-form");
  const preset = TASK_PRESETS.find((item) => item.id === presetId);
  if (!form || !preset) return;
  const sceneId = state.modal?.sceneId;
  const setIf = (name, value, overwrite = true) => {
    const field = form.elements.namedItem(name);
    if (!field || field instanceof RadioNodeList) return;
    if (overwrite || !field.value.trim()) field.value = value;
  };
  setIf("major", preset.major);
  setIf("course", preset.course);
  setIf("task", preset.label);
  setIf("resources", preset.equipment.join("；"), false);
  if (sceneId !== "observe" && sceneId !== "safety") {
    setIf("learners", "班级约 36 人，已完成相关先修训练；动手意愿较强，但工艺规范与故障排查需要支持；实训台 8 台套，建议 4 人一组轮换。", false);
  }
  form.querySelectorAll(".field.has-error").forEach((field) => field.classList.remove("has-error"));
}

function validateTaskForm(form) {
  let firstInvalid = null;
  const required = Array.from(form.querySelectorAll("[data-required='true']"));
  required.forEach((control) => {
    const field = control.closest(".field");
    const value = control.value.trim();
    const tooShortObservation = control.name === "observation" && value.length > 0 && value.length < 20;
    if (!value || tooShortObservation) {
      field?.classList.add("has-error");
      const error = field?.querySelector(".field-error");
      if (error) {
        error.textContent = tooShortObservation
          ? "听课记录太短，请至少提供 20 个字的课堂事实（请先脱敏）"
          : `请${control.tagName === "SELECT" ? "选择" : "填写"}${field?.querySelector("label")?.textContent.replace(/必填|选填/g, "").trim() || "该字段"}`;
      }
      control.setAttribute("aria-invalid", "true");
      if (!firstInvalid) firstInvalid = control;
    } else {
      field?.classList.remove("has-error");
      control.removeAttribute("aria-invalid");
    }
  });
  if (firstInvalid) {
    firstInvalid.focus({ preventScroll: false });
    firstInvalid.scrollIntoView({ block: "center", behavior: "smooth" });
    showToast("还有必填条件未完成，请先补充");
    return false;
  }
  return true;
}

function collectFormParams(form) {
  const entries = Object.fromEntries(new FormData(form).entries());
  delete entries.taskPreset;
  if (state.modal?.sceneId === "lesson") entries.template = form.querySelector("[name='template']")?.value || "standard";
  if (state.modal?.sceneId === "evaluate") entries.evalTemplate = form.querySelector("[name='evalTemplate']")?.value || "process";
  if (state.modal?.sceneId === "observe") entries.observationTemplate = form.querySelector("[name='observationTemplate']")?.value || "evidence";
  if (state.attachments.length) {
    const excerpt = state.attachments
      .map((file) => `《${file.name}》摘录：\n${file.text.slice(0, 1100)}`)
      .join("\n\n");
    if (state.modal?.sceneId === "observe") {
      entries.observation = `${entries.observation || ""}\n\n【本机参考资料（未上传）】\n${excerpt}`;
    } else {
      entries.notes = `${entries.notes || ""}\n\n【本机参考资料（未上传）】\n${excerpt}`.trim();
    }
  }
  return entries;
}

function buildSceneUserMessage(sceneId, params) {
  if (sceneId === "safety") {
    return {
      text: `查询安全规程：${params.venue || "未指定场所"}${params.operation ? ` · ${params.operation}` : ""}`,
      summary: `检索 ${params.venue || "实训场所"} 的安全要求`
    };
  }
  if (sceneId === "observe") {
    return {
      text: "整理这份听课记录，生成证据型评课意见。",
      summary: `${params.course || "课程"} · ${params.task || "听课记录"}`
    };
  }
  if (sceneId === "evaluate") {
    return {
      text: `生成评价表：${params.task || params.course || "教学任务"}`,
      summary: params.task || params.course || "教学任务"
    };
  }
  const labels = { lesson: "生成教案", materials: "生成任务单与工作页", evaluate: "生成评价表" };
  return {
    text: `${labels[sceneId] || "生成教学成果"}：${params.task || params.course || "教学任务"}`,
    summary: params.task || params.course || "教学任务"
  };
}

function conversationTitle(sceneId, params) {
  const scene = SCENES.find((item) => item.id === sceneId);
  const subject = sceneId === "safety"
    ? params.venue || "实训安全"
    : sceneId === "observe"
      ? params.task || params.course || "听课记录"
      : params.task || params.course || "教学任务";
  return truncate(`${scene?.label || "教学对话"} · ${subject}`, 38);
}

function submitTaskForm(form) {
  if (!validateTaskForm(form)) return;
  if (aiModeActive() && !hasValidConsent(state.ai)) {
    openAIConsentModal(() => submitTaskForm(form), state.ai.provider);
    return;
  }
  const sceneId = state.modal?.sceneId;
  const mode = state.modal?.mode || "new";
  const convId = state.modal?.convId;
  const reuseConvId = state.modal?.reuseConvId;
  const params = collectFormParams(form);
  const combined = Object.values(params).map((value) => String(value || "")).join("\n");
  const privacyFindings = detectSensitive(combined);
  const risks = Array.from(new Set([...detectInputRisk(combined), ...privacyFindingLabels(privacyFindings)]));
  if (risks.length) {
    showToast(`检测到${risks.join("、")}，请先删除或脱敏后再生成`);
    return;
  }
  let conv = mode === "regenerate" && convId
    ? findConversation(convId)
    : reuseConvId
      ? findConversation(reuseConvId)
      : null;
  const continuedConversation = Boolean(conv);
  const previousScene = conv?.scene || "";
  if (!conv) conv = createConversation();
  const sceneLabel = SCENES.find((item) => item.id === sceneId)?.label || "教学任务";
  conv.scene = sceneId;
  if (!conv.category || conv.category === "通用对话") conv.category = sceneLabel;
  else if (previousScene && previousScene !== sceneId) conv.category = "多成果任务";
  if (!continuedConversation || !conv.title) {
    conv.title = conversationTitle(sceneId, params);
  } else if (previousScene && previousScene !== sceneId) {
    conv.title = `教学任务 · ${truncate(params.task || params.course || params.venue || "多成果任务", 30)}`;
  }
  const userMessage = {
    id: uid("msg"),
    role: "user",
    kind: "params",
    scene: sceneId,
    text: buildSceneUserMessage(sceneId, params).text,
    params: { ...params },
    attachments: state.attachments.map((file) => file.name),
    createdAt: new Date().toISOString()
  };
  conv.messages.push(userMessage);
  conv.context = { ...params, scene: sceneId };
  conv.updatedAt = new Date().toISOString();
  saveDB();
  state.attachments = [];
  closeModal();
  state.activeId = conv.id;
  state.pendingScroll = "result";
  const hash = `#/chat/${conv.id}`;
  if (location.hash !== hash) history.pushState(null, "", hash);
  handleRoute();
  const proxyMissing = aiModeActive() && state.ai.provider === "proxy" && !state.ai.endpoint;
  const useAI = aiModeActive() && hasValidConsent(state.ai) && sceneId !== "safety" && !proxyMissing;
  if (aiModeActive() && sceneId === "safety") {
    showToast("安全查询固定使用本地知识库原文，不交给生成模型");
  } else if (proxyMissing) {
    showToast("安全代理尚未配置，本次已使用本地引擎");
  }
  if (useAI) {
    startAIGeneration(conv, sceneId, params);
  } else {
    startGeneration(conv, sceneId, params);
  }
}

/* ==========================================================
   Conversation & generation
   ========================================================== */

function createConversation() {
  const now = new Date().toISOString();
  const conv = {
    id: uid("conv"),
    title: "新的备课对话",
    scene: "",
    category: "通用对话",
    createdAt: now,
    updatedAt: now,
    pinned: false,
    messages: [],
    context: {},
    latestArtifact: null
  };
  db.conversations.unshift(conv);
  return conv;
}

function appendMessage(conv, message) {
  conv.messages.push(message);
  conv.updatedAt = new Date().toISOString();
}

async function startGeneration(conv, sceneId, params) {
  if (state.generating) {
    showToast("当前还有生成任务在运行，请稍候");
    return;
  }
  state.generating = true;
  let result;
  try {
    result = generate(sceneId, params);
  } catch (error) {
    console.error("生成失败", error);
    state.generating = false;
    showToast("生成失败，请检查参数后重试");
    return;
  }

  const pending = {
    id: uid("msg"),
    role: "assistant",
    kind: "pending",
    createdAt: new Date().toISOString(),
    workflow: result.workflow,
    stepIndex: 0
  };
  conv.scene = sceneId;
  conv.context = { ...params, scene: sceneId };
  conv.updatedAt = new Date().toISOString();
  if (!conv.title || conv.title === "新的备课对话") {
    conv.title = conversationTitle(sceneId, params);
  }
  appendMessage(conv, pending);
  saveDB();

  if (state.route.name === "chat" && state.route.id === conv.id) {
    state.pendingScroll = "bottom";
    renderApp();
  }

  for (let index = 0; index < result.workflow.length; index += 1) {
    await sleep(index === 0 ? 220 : 240);
    pending.stepIndex = index + 1;
    updateWorkflowDom(pending.id, index + 1, result.workflow.length);
  }
  await sleep(230);

  const messageIndex = conv.messages.findIndex((message) => message.id === pending.id);
  if (messageIndex === -1) {
    state.generating = false;
    return;
  }
  const finalMessage = {
    ...pending,
    kind: "result",
    text: result.intro,
    result,
    sources: result.sources,
    suggestions: result.suggestions,
    feedback: ""
  };
  conv.messages[messageIndex] = finalMessage;
  conv.latestArtifact = result.artifact;
  conv.latestResultMessageId = finalMessage.id;
  conv.context = result.context;
  conv.updatedAt = new Date().toISOString();
  saveDB();
  state.generating = false;

  if (state.route.name === "chat" && state.route.id === conv.id) {
    state.pendingScroll = "result";
    renderApp();
  }
  const sourceCount = result.sources?.length || 0;
  showToast(`已生成 ${result.artifact.docs?.length || 1} 份文档 · 引用 ${sourceCount} 处依据`);
}

function aiProviderMeta(settings) {
  return {
    provider: settings.provider === "proxy" ? "安全代理" : "AI 体验通道",
    providerId: settings.provider,
    model: settings.model || (settings.provider === "demo" ? DEMO_PROVIDER.model : "自定义模型"),
    endpoint: settings.endpoint
  };
}

function isActiveChat(conv) {
  return state.route.name === "chat" && state.route.id === conv.id;
}

function updateAIStreamDom(message, phase = "") {
  if (!message) return;
  const card = document.querySelector(`[data-message-id="${CSS.escape(message.id)}"]`);
  if (!card) return;
  const textNode = card.querySelector(".ai-stream-text");
  if (textNode) {
    const full = message.ai?.streamText || "";
    if (message.ai?.kind === "chat") {
      textNode.innerHTML = full ? mdLite(full) : `<span class="ai-stream-placeholder">正在连接模型并组织回答…</span>`;
    } else {
      textNode.textContent = full || "正在连接模型…";
    }
  }
  const count = card.querySelector(".ai-stream-count");
  if (count) count.textContent = String((message.ai?.streamText || "").length);
  const status = card.querySelector(".ai-stream-status");
  if (status) status.textContent = phase || (message.ai?.streamText ? "正在接收" : "正在连接");
  const scroller = document.querySelector(".chat-scroll");
  if (scroller) {
    const nearBottom = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 260;
    if (nearBottom) scroller.scrollTop = scroller.scrollHeight;
  }
}

function aiFallbackResult(localResult, error, cancelled = false) {
  const reason = cancelled
    ? "已停止 AI 流式生成，未采用 AI 已接收的部分内容。"
    : `AI 增强未完成：${error}`;
  const artifact = {
    ...localResult.artifact,
    compliance: {
      ...(localResult.artifact.compliance || {}),
      checks: [
        ...((localResult.artifact.compliance && localResult.artifact.compliance.checks) || []),
        { status: "warn", title: "AI 回退", detail: `${reason} 下面是本地规则引擎生成的可审核草稿，事实边界仍以知识库为准。` }
      ]
    }
  };
  return {
    ...localResult,
    artifact,
    aiError: reason,
    intro: `${reason}\n\n已自动回退到本地引擎，下面这份成果仍可正常编辑、导出和人工审核。你可以重试 AI 增强，或继续使用本地结果。`,
    suggestions: [
      { label: "重试 AI 增强", action: "retry-ai-generation" },
      ...(localResult.suggestions || [])
    ]
  };
}

async function startAIGeneration(conv, sceneId, params) {
  if (state.generating) {
    showToast("当前还有生成任务在运行，请稍候");
    return;
  }
  const settings = normalizeAISettings(state.ai);
  if (!hasValidConsent(settings)) {
    openAIConsentModal(() => startAIGeneration(conv, sceneId, params), settings.provider);
    return;
  }
  state.generating = true;
  let localResult;
  try {
    localResult = generate(sceneId, params);
  } catch (error) {
    console.error("本地生成失败", error);
    state.generating = false;
    showToast("生成失败，请检查参数后重试");
    return;
  }

  const meta = aiProviderMeta(settings);
  const pendingId = uid("msg");
  const workflow = [
    ...(localResult.workflow || []),
    { index: (localResult.workflow?.length || 0) + 1, label: "AI 深度改写", detail: `${meta.model} · 流式`, status: "active" }
  ];
  const pending = {
    id: pendingId,
    role: "assistant",
    kind: "ai-pending",
    createdAt: new Date().toISOString(),
    workflow,
    stepIndex: workflow.length - 1,
    sources: localResult.sources || [],
    ai: {
      used: true,
      kind: "generation",
      ...meta,
      startedAt: new Date().toISOString(),
      streamText: "",
      phase: "connecting"
    }
  };
  conv.scene = sceneId;
  conv.context = { ...params, scene: sceneId };
  conv.updatedAt = new Date().toISOString();
  appendMessage(conv, pending);
  saveDB();
  if (isActiveChat(conv)) {
    state.pendingScroll = "bottom";
    renderApp();
  }

  const controller = new AbortController();
  state.aiStream = { convId: conv.id, messageId: pendingId, controller, kind: "generation", cancelled: false };
  let lastPaint = 0;
  try {
    const messages = buildGenerationMessages({ scene: sceneId, params, localResult, sources: localResult.sources || [] });
    const safeMessages = await prepareAIPayload(messages);
    const response = await streamAI({
      messages: safeMessages,
      settings,
      signal: controller.signal,
      onMeta: () => {
        pending.ai.phase = "connected";
        updateAIStreamDom(pending, "已连接，等待模型输出");
      },
      onDelta: (delta, full) => {
        pending.ai.streamText = full;
        pending.ai.phase = "streaming";
        const now = performance.now();
        if (now - lastPaint > 70) {
          lastPaint = now;
          updateAIStreamDom(pending, "正在接收");
        }
      },
      onReasoning: () => {}
    });
    pending.ai.streamText = response.text;
    pending.ai.duration = response.duration;
    pending.ai.finishReason = response.finishReason || "";
    pending.ai.usage = response.usage || null;
    updateAIStreamDom(pending, "正在解析结构");

    const parsed = parseAIMarkdown({
      markdown: response.text,
      localResult,
      params,
      scene: sceneId,
      provider: { ...meta, duration: response.duration, finishReason: response.finishReason || (response.partial ? "length" : ""), usage: response.usage }
    });
    const finalMessage = {
      ...pending,
      kind: "result",
      text: parsed.result.intro,
      result: parsed.result,
      sources: parsed.result.sources,
      suggestions: parsed.result.suggestions,
      feedback: "",
      ai: parsed.result.ai
    };
    const index = conv.messages.findIndex((message) => message.id === pendingId);
    if (index === -1) {
      state.generating = false;
      return;
    }
    conv.messages[index] = finalMessage;
    conv.latestArtifact = parsed.result.artifact;
    conv.latestResultMessageId = finalMessage.id;
    conv.context = parsed.result.context || { ...params, scene: sceneId };
    conv.updatedAt = new Date().toISOString();
    saveDB();
    state.generating = false;
    state.aiStream = null;
    if (isActiveChat(conv)) {
      state.pendingScroll = "result";
      renderApp();
    }
    showToast(`AI 已生成 ${parsed.result.artifact.docs.length} 份文档 · 引用 ${parsed.result.sources.length} 处依据`);
  } catch (error) {
    const cancelled = Boolean(state.aiStream?.cancelled);
    const fallback = aiFallbackResult(localResult, error.message || "AI 服务不可用", cancelled);
    const finalMessage = {
      ...pending,
      kind: "result",
      text: fallback.intro,
      result: fallback,
      sources: fallback.sources || [],
      suggestions: fallback.suggestions,
      feedback: "",
      aiError: fallback.aiError
    };
    const index = conv.messages.findIndex((message) => message.id === pendingId);
    if (index !== -1) conv.messages[index] = finalMessage;
    conv.latestArtifact = fallback.artifact;
    conv.latestResultMessageId = finalMessage.id;
    conv.context = fallback.context || { ...params, scene: sceneId };
    conv.updatedAt = new Date().toISOString();
    saveDB();
    state.generating = false;
    state.aiStream = null;
    if (isActiveChat(conv)) {
      state.pendingScroll = "result";
      renderApp();
    }
    showToast(cancelled ? "已停止 AI，保留本地可审核草稿" : "AI 不可用，已自动回退本地引擎");
  }
}

async function startAIChat(conv, rawText, localReply, attachmentContext = "") {
  const settings = normalizeAISettings(state.ai);
  if (!hasValidConsent(settings)) {
    openAIConsentModal(() => startAIChat(conv, rawText, localReply, attachmentContext), settings.provider);
    return;
  }
  const meta = aiProviderMeta(settings);
  const pending = {
    id: uid("msg"),
    role: "assistant",
    kind: "ai-pending",
    createdAt: new Date().toISOString(),
    sources: localReply.sources || [],
    ai: {
      used: true,
      kind: "chat",
      ...meta,
      startedAt: new Date().toISOString(),
      streamText: "",
      phase: "connecting"
    }
  };
  appendMessage(conv, pending);
  conv.updatedAt = new Date().toISOString();
  saveDB();
  if (isActiveChat(conv)) {
    state.pendingScroll = "bottom";
    renderApp();
  }
  const controller = new AbortController();
  state.aiStream = { convId: conv.id, messageId: pending.id, controller, kind: "chat", cancelled: false };
  let lastPaint = 0;
  const history = conv.messages
    .filter((message) => message.id !== pending.id && (message.role === "user" || message.role === "assistant"))
    .map((message) => ({ role: message.role, text: message.text || "" }));
  try {
    const question = `${rawText}${attachmentContext ? `\n\n【教师附带的本机参考资料摘录（已在本地读取，未上传原文件）】\n${attachmentContext}` : ""}`;
    const messages = buildChatMessages({
      question,
      sources: localReply.sources || [],
      context: conv.context || {},
      history,
      latestArtifact: conv.latestArtifact || null
    });
    const safeMessages = await prepareAIPayload(messages);
    const response = await streamAI({
      messages: safeMessages,
      settings,
      signal: controller.signal,
      onMeta: () => {
        pending.ai.phase = "connected";
        updateAIStreamDom(pending, "已连接，等待模型输出");
      },
      onDelta: (delta, full) => {
        pending.ai.streamText = full;
        pending.ai.phase = "streaming";
        const now = performance.now();
        if (now - lastPaint > 55) {
          lastPaint = now;
          updateAIStreamDom(pending, "正在生成回答");
        }
      },
      onReasoning: () => {}
    });
    pending.ai.streamText = response.text;
    updateAIStreamDom(pending, "完成");
    const truncated = response.finishReason === "length" || Boolean(response.partial) || Boolean(response.incomplete);
    const finalMessage = {
      id: pending.id,
      role: "assistant",
      kind: "chat",
      text: truncated ? `${response.text}\n\n> **提示**：AI 输出达到模型长度上限，内容可能没有写完。请缩小问题范围、继续追问，或切回本地知识库查看完整条款。` : response.text,
      sources: localReply.sources || [],
      suggestions: localReply.suggestions || [],
      tag: "AI 增强回答",
      createdAt: pending.createdAt,
      ai: {
        used: true,
        provider: meta.provider,
        providerId: meta.providerId,
        model: meta.model,
        duration: response.duration,
        finishReason: response.finishReason || "",
        truncated,
        generatedAt: new Date().toISOString()
      }
    };
    const index = conv.messages.findIndex((message) => message.id === pending.id);
    if (index !== -1) conv.messages[index] = finalMessage;
    conv.updatedAt = new Date().toISOString();
    saveDB();
    state.chatBusy = false;
    state.aiStream = null;
    if (isActiveChat(conv)) {
      state.pendingScroll = "bottom";
      renderApp();
    }
  } catch (error) {
    const cancelled = Boolean(state.aiStream?.cancelled);
    const fallbackMessage = {
      id: pending.id,
      role: "assistant",
      kind: localReply.type === "clarify" ? "clarify" : "chat",
      text: `${cancelled ? "已停止 AI 回答。" : `AI 增强回答失败：${error.message}`}\n\n已回退到本地知识库回答：\n\n${localReply.text}`,
      sources: localReply.sources || [],
      suggestions: localReply.suggestions || [],
      tag: cancelled ? "AI 已停止" : "AI 回退",
      createdAt: pending.createdAt,
      aiError: error.message || "AI 不可用"
    };
    const index = conv.messages.findIndex((message) => message.id === pending.id);
    if (index !== -1) conv.messages[index] = fallbackMessage;
    conv.updatedAt = new Date().toISOString();
    saveDB();
    state.chatBusy = false;
    state.aiStream = null;
    if (isActiveChat(conv)) {
      state.pendingScroll = "bottom";
      renderApp();
    }
    showToast(cancelled ? "已停止 AI 回答" : "AI 不可用，已回退本地知识库");
  }
}

function updateWorkflowDom(messageId, currentIndex, total) {
  const card = document.querySelector(`[data-message-id="${CSS.escape(messageId)}"]`);
  if (!card) return;
  const headCount = card.querySelector(".wf-head span");
  if (headCount) headCount.textContent = `${Math.min(currentIndex, total)} / ${total}`;
  card.querySelectorAll(".wf-step").forEach((step, index) => {
    step.classList.toggle("is-done", index < currentIndex);
    step.classList.toggle("is-active", index === currentIndex);
  });
}

async function submitChat(text) {
  if (state.generating || state.chatBusy) {
    showToast("当前任务还在运行，请稍候");
    return;
  }
  const attachments = [...state.attachments];
  const attachmentContext = attachments
    .map((file) => `【本机参考资料《${file.name}》（未上传）】\n${file.text.slice(0, 4200)}`)
    .join("\n\n");
  const rawText = text.trim() || (attachments.length ? "请阅读我附加的参考资料，并回答其中与教学相关的要点。" : "");
  if (!rawText) {
    showToast("先输入一个问题，或选择一个场景");
    return;
  }
  const privacyFindings = detectSensitive(`${rawText}\n${attachmentContext}`);
  const combinedRisk = Array.from(new Set([...detectInputRisk(`${rawText}\n${attachmentContext}`), ...privacyFindingLabels(privacyFindings)]));
  if (combinedRisk.length) {
    showToast(`检测到${combinedRisk.join("、")}，请先删除或脱敏`);
    return;
  }

  let conv = state.route.name === "chat" ? findConversation(state.route.id) : null;
  if (!conv) conv = createConversation();
  const firstMessage = conv.messages.length === 0;
  if (firstMessage) conv.title = truncate(rawText.replace(/\s+/g, " "), 34);
  const userMessage = {
    id: uid("msg"),
    role: "user",
    kind: "text",
    text: rawText,
    attachments: attachments.map((file) => file.name),
    createdAt: new Date().toISOString()
  };
  appendMessage(conv, userMessage);
  saveDB();
  state.draft = "";
  state.attachments = [];
  state.activeId = conv.id;
  state.chatBusy = true;
  const hash = `#/chat/${conv.id}`;
  if (location.hash !== hash) history.pushState(null, "", hash);
  state.pendingScroll = "bottom";
  handleRoute();

  const wantsObservation = attachments.length > 0 && /(听课|评课|课堂观察|课堂记录)/.test(rawText);
  if (wantsObservation) {
    const fileNames = attachments.map((file) => `《${file.name}》`).join("、");
    const notice = {
      id: uid("msg"),
      role: "assistant",
      kind: "chat",
      text: `已在本机读取 ${fileNames}，不会上传。课程名称和观察重点还没有提供，我先按「综合诊断」整理为证据型评课意见；生成后可以点“调整参数”补充课程与关注点。`,
      sources: [],
      createdAt: new Date().toISOString()
    };
    appendMessage(conv, notice);
    conv.updatedAt = new Date().toISOString();
    saveDB();
    state.chatBusy = false;
    state.pendingScroll = "bottom";
    renderApp();
    await sleep(320);
    startGeneration(conv, "observe", {
      course: "",
      task: "听课记录（附件）",
      observation: attachments.map((file) => file.text).join("\n\n"),
      focus: "综合诊断",
      observationTemplate: "evidence",
      notes: rawText
    });
    return;
  }

  const typing = {
    id: uid("msg"),
    role: "assistant",
    kind: "typing",
    createdAt: new Date().toISOString()
  };
  appendMessage(conv, typing);
  if (state.route.name === "chat" && state.route.id === conv.id) {
    state.pendingScroll = "bottom";
    renderApp();
  }
  await sleep(280);

  let reply;
  try {
    reply = chatReply(`${rawText}\n\n${attachmentContext}`, {
      context: conv.context || {},
      latestArtifact: conv.latestArtifact || null
    });
  } catch (error) {
    console.error("对话失败", error);
    reply = {
      type: "chat",
      text: "处理这个问题时出现了错误。请换一种说法，或尝试使用参数表单重新开始。您的内容仍保存在本机。",
      sources: []
    };
  }
  conv.messages = conv.messages.filter((message) => message.id !== typing.id);

  if (reply.type === "param-update") {
    const notice = {
      id: uid("msg"),
      role: "assistant",
      kind: "chat",
      text: reply.text,
      sources: [],
      createdAt: new Date().toISOString()
    };
    appendMessage(conv, notice);
    saveDB();
    state.chatBusy = false;
    if (state.route.name === "chat" && state.route.id === conv.id) {
      state.pendingScroll = "bottom";
      renderApp();
    }
    await sleep(250);
    const nextParams = { ...conv.context, ...reply.changes, scene: conv.scene };
    if (!conv.scene) {
      showToast("当前对话还没有可重新生成的结果");
      return;
    }
    startGeneration(conv, conv.scene, nextParams);
    return;
  }

  const aiEligible = aiModeActive()
    && hasValidConsent(state.ai)
    && reply.tag === "知识库检索"
    && !/(安全|上电|触电|急停|防护|应急|规程)/.test(rawText)
    && !(state.ai.provider === "proxy" && !state.ai.endpoint);
  if (aiEligible) {
    await startAIChat(conv, rawText, reply, attachmentContext);
    return;
  }

  const assistantMessage = {
    id: uid("msg"),
    role: "assistant",
    kind: reply.type === "clarify" ? "clarify" : "chat",
    text: reply.text,
    sources: reply.sources || [],
    suggestions: reply.suggestions || [],
    tag: reply.tag || "",
    aiSkipped: aiModeActive() && reply.tag === "知识库检索" ? "安全类问题固定使用本地知识库" : "",
    createdAt: new Date().toISOString()
  };
  appendMessage(conv, assistantMessage);
  conv.updatedAt = new Date().toISOString();
  saveDB();
  state.chatBusy = false;
  if (state.route.name === "chat" && state.route.id === conv.id) {
    state.pendingScroll = "bottom";
    renderApp();
  }
}

function openConversation(id) {
  const conv = findConversation(id);
  if (!conv) {
    showToast("没有找到这条对话");
    return;
  }
  state.activeId = id;
  state.railOpen = false;
  state.showAllSources = false;
  navigate(`/chat/${id}`, { scroll: conv.latestArtifact ? "result" : "bottom" });
}

function adjustParams() {
  const conv = state.activeId ? findConversation(state.activeId) : null;
  if (!conv?.latestArtifact) {
    showToast("先生成一份结果，再调整参数");
    return;
  }
  openSceneForm(conv.scene, { mode: "regenerate" });
}

/* ==========================================================
   Attachments
   ========================================================== */

async function handleFiles(fileList) {
  const files = Array.from(fileList || []);
  if (!files.length) return;
  if (state.attachments.length + files.length > 3) {
    showToast("一次对话最多附带 3 份参考资料");
    return;
  }
  for (const file of files) {
    if (file.size > state.fileMaxMB * 1024 * 1024) {
      showToast(`${file.name} 超过 ${state.fileMaxMB}MB，请使用资料中心拆分处理`);
      continue;
    }
    showToast(`正在本机解析 ${file.name}…`);
    try {
      const parsed = await parseFile(file, { maxFileMB: state.fileMaxMB, enableOCR: false });
      if (parsed.needsOCR) {
        showToast(`${file.name} 可能是扫描件，请到资料中心启用 OCR`);
        continue;
      }
      let text = parsed.text || "";
      let findings = detectSensitive(text);
      if (findings.length) {
        const approved = await reviewFilePrivacy(findings, file.name);
        if (!approved) continue;
        text = maskSensitive(text, findings);
      }
      state.attachments.push({
        id: uid("file"),
        name: maskDeep(file.name),
        size: file.size,
        text,
        charCount: text.length,
        privacyMasked: findings.length > 0
      });
    } catch (error) {
      showToast(`${file.name}：${error.message || "无法解析"}`);
    }
  }
  if (state.attachments.length) {
    showToast("资料仅在本机读取，不会上传；已按上下文预算截取提示词摘录");
    renderApp({ preserveScroll: true });
  }
}

/* ==========================================================
   Actions
   ========================================================== */

/**
 * AI 发送前隐私网关。
 * 不修改本机原文；只对将要发送给模型的副本做脱敏。
 * 检测到任何 medium/high 或低置信命中时，必须由教师确认。
 */
async function prepareAIPayload(messages) {
  const findings = [];
  messages.forEach((message) => {
    const detected = detectSensitive(String(message.content || ""));
    if (detected.length) findings.push(...detected);
  });
  if (!findings.length) return messages;
  const summary = reviewSummary(findings);
  const level = riskLevel(findings);
  const levelLabel = { high: "高", medium: "中", low: "低", none: "无" }[level] || level;
  const seen = new Set();
  const rows = findings
    .filter((finding) => {
      const key = `${finding.type}:${finding.masked}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 12)
    .map((finding) => `<li><strong>${escapeHtml(finding.label)}</strong><span class="privacy-finding-mask">${escapeHtml(finding.masked)}</span><span class="privacy-finding-reason">${escapeHtml(finding.reason || "")}</span></li>`)
    .join("");

  const maskedMessages = messages.map((message) => {
    const content = String(message.content || "");
    const messageFindings = detectSensitive(content);
    return { ...message, content: messageFindings.length ? maskSensitive(content, messageFindings) : content };
  });

  return new Promise((resolve, reject) => {
    state.privacyResolve = { resolve, reject, maskedMessages };
    openModal({
      kind: "confirm",
      narrow: false,
      kicker: "PRIVACY GATE / 发送前隐私检查",
      title: "发送前发现可能的个人信息",
      sub: `本次 AI 请求检测到 ${findings.length} 处可能的个人身份信息，风险等级：${levelLabel}。AI 请求尚未发送。`,
      body: `
        <div class="notice-stack">
          <div class="privacy-warning">不要直接发送学生姓名、学号、电话、住址等个人信息。你可以选择“自动脱敏后继续”；系统只修改发送给 AI 的副本，本机原文不变。</div>
          <div class="privacy-disclosure">
            <h3>检测结果（已掩码显示）</h3>
            <ul class="privacy-finding-list">${rows}</ul>
            <p class="settings-note">共 ${summary.map((item) => `${escapeHtml(item.type)} ${item.count}`).join(" · ")}。检测基于规则与上下文，可能漏检或误报；确认前请人工检查。</p>
          </div>
          <div class="privacy-disclosure">
            <h3>脱敏不会改变什么</h3>
            <ul>
              <li>本机对话、任务参数和知识库原文不会被改写；</li>
              <li>只对即将发送给 AI 的这份副本执行掩码；</li>
              <li>AI 输出仍必须人工审核，不能作为事实依据。</li>
            </ul>
          </div>
        </div>
      `,
      focusSelector: "[data-action='privacy-mask-continue']",
      footer: `
        <button class="btn btn-ghost" type="button" data-action="privacy-cancel">取消发送</button>
        <span class="spacer"></span>
        <button class="btn btn-solid" type="button" data-action="privacy-mask-continue">自动脱敏后继续</button>
      `
    });
  });
}

function resolvePrivacyGate(useMasked) {
  const pending = state.privacyResolve;
  if (!pending) return;
  state.privacyResolve = null;
  closeModal();
  if (!useMasked) {
    pending.reject(new Error("已取消 AI 请求：发送前隐私检查未确认"));
    return;
  }
  pending.resolve(pending.maskedMessages);
  showToast("已对发送给 AI 的副本脱敏，本机原文未改变");
}

function showToast(message, mark = "✓") {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.innerHTML = `<span class="toast-mark">${escapeHtml(mark)}</span><span>${escapeHtml(message)}</span>`;
  // Replace the previous transient message instead of stacking over the evidence panel.
  toastRoot.replaceChildren(toast);
  setTimeout(() => {
    toast.classList.add("is-out");
    setTimeout(() => toast.remove(), 220);
  }, 3000);
}

async function copyWithFeedback(text, message = "已复制到剪贴板") {
  try {
    await copyText(text);
    showToast(message);
  } catch (error) {
    showToast(error.message || "复制失败，请手动选择文本");
  }
}

function findMessage(messageId) {
  const conv = state.activeId ? findConversation(state.activeId) : null;
  if (!conv) return { conv: null, message: null };
  return { conv, message: conv.messages.find((item) => item.id === messageId) || null };
}

function getActiveDoc(artifact, messageId) {
  if (!artifact) return null;
  const id = state.docTabs[messageId] || artifact.docs[0]?.id;
  return artifact.docs.find((doc) => doc.id === id) || artifact.docs[0];
}

function handleAction(action, el, event) {
  switch (action) {
    case "nav": {
      navigate(el.dataset.path || "/");
      break;
    }
    case "new-chat": {
      state.draft = "";
      state.attachments = [];
      navigate("/");
      break;
    }
    case "toggle-ai-mode": {
      applyEngineMode(aiModeActive() ? "local" : "ai");
      break;
    }
    case "set-engine-mode": {
      applyEngineMode(el.dataset.mode === "ai" ? "ai" : "local");
      break;
    }
    case "show-ai-consent": {
      const provider = document.getElementById("ai-provider")?.value || state.ai.provider;
      openAIConsentModal(null, provider);
      break;
    }
    case "privacy-mask-continue": {
      resolvePrivacyGate(true);
      break;
    }
    case "privacy-cancel": {
      resolvePrivacyGate(false);
      break;
    }
    case "stop-ai-stream": {
      if (state.aiStream) {
        state.aiStream.cancelled = true;
        state.aiStream.controller.abort();
        showToast("正在停止 AI 流式生成…");
      }
      break;
    }
    case "retry-ai-generation": {
      const conv = findConversation(state.activeId);
      if (!conv?.scene || conv.scene === "safety") {
        showToast("当前结果没有可重试的 AI 场景");
        break;
      }
      if (!conv.context) {
        showToast("任务条件已丢失，请重新填写参数");
        break;
      }
      startAIGeneration(conv, conv.scene, { ...conv.context, scene: conv.scene });
      break;
    }
    case "edit-artifact": {
      openArtifactEditor(el.dataset.message);
      break;
    }
    case "editor-select-section": {
      if (!state.editor) break;
      state.editor.sectionId = el.dataset.sectionId;
      renderEditorModal();
      break;
    }
    case "editor-doc": {
      if (!state.editor) break;
      state.editor.docId = el.dataset.id;
      state.editor.sectionId = currentEditorDoc()?.sections?.[0]?.id || "";
      renderEditorModal();
      break;
    }
    case "editor-move-section": {
      if (!state.editor) break;
      moveEditorSection(el.dataset.id, Number(el.dataset.dir));
      break;
    }
    case "editor-add-section": {
      if (!state.editor) break;
      const doc = currentEditorDoc();
      if (!doc) break;
      editorPushHistory();
      const id = uid("sec");
      doc.sections.push({
        id,
        no: String(doc.sections.length + 1).padStart(2, "0"),
        title: "新模块",
        blocks: [{ type: "paragraph", text: "" }],
        refs: []
      });
      state.editor.sectionId = id;
      scheduleEditorSave();
      renderEditorModal();
      break;
    }
    case "editor-add-block": {
      if (!state.editor) break;
      const section = currentEditorSection();
      if (!section) break;
      editorPushHistory();
      const type = el.dataset.type;
      section.blocks.push(type === "list" ? { type: "list", items: [], ordered: false } : type === "checklist" ? { type: "checklist", items: [] } : { type: "paragraph", text: "" });
      scheduleEditorSave();
      renderEditorModal();
      break;
    }
    case "editor-remove-block": {
      if (!state.editor) break;
      const section = currentEditorSection();
      if (!section) break;
      editorPushHistory();
      section.blocks.splice(Number(el.dataset.blockIndex), 1);
      scheduleEditorSave();
      renderEditorModal();
      break;
    }
    case "editor-undo": {
      if (!state.editor || state.editor.historyIndex <= 0) break;
      state.editor.historyIndex -= 1;
      state.editor.artifact = cloneForEditor(state.editor.history[state.editor.historyIndex]);
      const doc = currentEditorDoc();
      if (!doc?.sections.some((section) => section.id === state.editor.sectionId)) state.editor.sectionId = doc?.sections?.[0]?.id || "";
      flushEditorSave();
      renderEditorModal();
      break;
    }
    case "editor-redo": {
      if (!state.editor || state.editor.historyIndex >= state.editor.history.length - 1) break;
      state.editor.historyIndex += 1;
      state.editor.artifact = cloneForEditor(state.editor.history[state.editor.historyIndex]);
      const doc = currentEditorDoc();
      if (!doc?.sections.some((section) => section.id === state.editor.sectionId)) state.editor.sectionId = doc?.sections?.[0]?.id || "";
      flushEditorSave();
      renderEditorModal();
      break;
    }
    case "editor-copy": {
      if (!state.editor) break;
      flushEditorSave();
      copyWithFeedback(artifactToText(state.editor.artifact), "编辑后的全部文档已复制");
      break;
    }
    case "editor-docx": {
      if (!state.editor) break;
      flushEditorSave();
      downloadDOCX(state.editor.artifact).then(() => showToast("DOCX 已下载")).catch((error) => showToast(error.message || "DOCX 导出失败"));
      break;
    }
    case "editor-pdf": {
      if (!state.editor) break;
      flushEditorSave();
      printArtifact(state.editor.artifact, state.editor.docId);
      showToast("已打开打印面板，可选择“另存为 PDF”");
      break;
    }
    case "editor-xlsx": {
      if (!state.editor) break;
      flushEditorSave();
      downloadXLSX(state.editor.artifact).then(() => showToast("Excel 已下载")).catch((error) => showToast(error.message || "Excel 导出失败"));
      break;
    }
    case "editor-regenerate": {
      if (!state.editor) break;
      const conv = findConversation(state.editor.convId);
      const scene = conv?.scene;
      const params = { ...(conv?.context || {}) };
      flushEditorSave();
      closeModal();
      if (!conv || !scene) break;
      if (aiModeActive() && hasValidConsent(state.ai) && scene !== "safety" && !(state.ai.provider === "proxy" && !state.ai.endpoint)) {
        startAIGeneration(conv, scene, params);
      } else {
        startGeneration(conv, scene, params);
      }
      break;
    }
    case "view-ai-raw": {
      const { message } = findMessage(el.dataset.message);
      const raw = message?.result?.artifact?.ai?.rawMarkdown || message?.result?.ai?.rawMarkdown;
      if (!raw) {
        showToast("这份成果没有保存 AI 原始文本");
        break;
      }
      openModal({
        kicker: "AI RAW OUTPUT / 透明性",
        title: "AI 原始输出（未编辑）",
        sub: "下面是模型直接返回的 Markdown，保留用于核对与审计。正式成果已经解析为结构化模块。",
        narrow: false,
        body: `<pre class="ai-raw-pre">${escapeHtml(raw)}</pre>`,
        footer: `<span class="spacer"></span><button class="btn" type="button" data-action="close-modal">关闭</button>`
      });
      break;
    }
    case "grant-ai-consent": {
      state.ai.consent = consentRecord();
      saveAISettings(state.ai).then(() => {
        const callback = state.consentCallback;
        state.consentCallback = null;
        closeModal();
        showToast("已记录授权；发送前仍会检查敏感信息");
        if (typeof callback === "function") callback();
        else renderApp({ preserveScroll: true });
      });
      break;
    }
    case "revoke-ai-consent": {
      openModal({
        kind: "confirm",
        kicker: "PRIVACY / 撤回授权",
        title: "撤回 AI 数据传输授权？",
        sub: "撤回后会立即切回本地模式；已生成的成果不会删除。",
        body: `<div class="notice-stack"><div class="privacy-warning">下次使用 AI 前需要重新阅读并同意数据传输说明。</div></div>`,
        focusSelector: "[data-action='confirm-revoke-consent']",
        footer: `<button class="btn btn-ghost" type="button" data-action="close-modal">取消</button><span class="spacer"></span><button class="btn btn-solid" type="button" data-action="confirm-revoke-consent">确认撤回</button>`
      });
      break;
    }
    case "confirm-revoke-consent": {
      state.ai.consent = { granted: false, version: "", grantedAt: "" };
      state.ai.mode = "local";
      saveAISettings(state.ai).then(() => {
        closeModal();
        showToast("已撤回 AI 授权并切回本地模式");
        renderApp({ preserveScroll: true });
      });
      break;
    }
    case "test-ai-connection": {
      testAISettings();
      break;
    }
    case "refresh-usage": {
      refreshStorageUsage();
      showToast("已刷新本机存储占用");
      break;
    }
    case "export-backup": {
      exportBackup();
      break;
    }
    case "export-conversations": {
      exportBackup({ conversationsOnly: true });
      break;
    }
    case "import-backup": {
      triggerBackupImport();
      break;
    }
    case "confirm-restore": {
      if (!state.pendingRestore) {
        closeModal();
        break;
      }
      localDB.restoreBackup(state.pendingRestore).then(() => {
        try {
          localStorage.setItem(DB_KEY, JSON.stringify({ ...blankDB(), conversations: state.pendingRestore.conversations || [] }));
        } catch (error) {
          console.warn("兼容存储写入失败", error);
        }
        closeModal();
        showToast("备份已恢复，页面即将重新加载");
        setTimeout(() => location.reload(), 500);
      }).catch((error) => {
        showToast(error.message || "备份恢复失败");
      });
      break;
    }
    case "clear-local-data": {
      openModal({
        kind: "confirm",
        kicker: "DELETE / 本机数据",
        title: "删除本机全部数据？",
        sub: "包括对话、自定义知识、资料解析结果与 AI 授权。该操作不能自动撤销。",
        body: `<div class="notice-stack"><div class="privacy-warning">建议先导出备份。服务器端不会保留这些浏览器数据；如果你配置了安全代理，模型服务端可能按其日志政策处理过历史请求，本操作无法删除第三方日志。</div></div>`,
        focusSelector: "[data-action='confirm-clear-data']",
        footer: `<button class="btn btn-ghost" type="button" data-action="close-modal">取消</button><span class="spacer"></span><button class="btn btn-solid" type="button" data-action="confirm-clear-data">确认删除</button>`
      });
      break;
    }
    case "confirm-clear-data": {
      Promise.all([
        localDB.clearAllData().catch(() => null),
        new Promise((resolve) => {
          try {
            localStorage.removeItem(DB_KEY);
            localStorage.removeItem(AI_LOCAL_KEY);
            sessionStorage.removeItem("jiangbei.proxyToken");
          } catch (error) {
            console.warn("清理浏览器存储失败", error);
          }
          resolve();
        })
      ]).then(() => {
        closeModal();
        showToast("本机数据已删除，即将重新加载");
        setTimeout(() => location.reload(), 450);
      });
      break;
    }
    case "open-file-picker": {
      document.querySelector("[data-role='file-center-input']")?.click();
      break;
    }
    case "preview-file": {
      const record = state.files.find((file) => file.id === el.dataset.id);
      if (record) openFilePreview(record);
      break;
    }
    case "file-privacy-mask": {
      const pending = state.filePrivacyResolve;
      state.filePrivacyResolve = null;
      closeModal();
      pending?.(true);
      break;
    }
    case "file-privacy-cancel": {
      const pending = state.filePrivacyResolve;
      state.filePrivacyResolve = null;
      closeModal();
      pending?.(false);
      break;
    }
    case "file-to-kb": {
      const record = state.files.find((file) => file.id === el.dataset.id);
      addFileToKnowledge(record);
      break;
    }
    case "ocr-file": {
      const record = state.files.find((file) => file.id === el.dataset.id);
      openOCRConsent(record);
      break;
    }
    case "confirm-ocr": {
      runOCR(state.pendingOCRId);
      break;
    }
    case "delete-file": {
      const record = state.files.find((file) => file.id === el.dataset.id);
      if (!record) break;
      openModal({
        kind: "confirm",
        narrow: true,
        kicker: "DELETE / 本机资料",
        title: "删除这份资料？",
        sub: "解析文本与分块会从本机移除；如果它已加入知识库，对应材料也会删除。",
        body: `<p class="confirm-copy"><strong>${escapeHtml(record.name)}</strong></p><div class="confirm-warning">原始文件从未上传服务器；此操作只影响本机记录，无法撤销。</div>`,
        focusSelector: "[data-action='confirm-delete-file']",
        footer: `<button class="btn btn-ghost" type="button" data-action="close-modal">取消</button><span class="spacer"></span><button class="btn btn-solid" type="button" data-action="confirm-delete-file" data-id="${escapeAttr(record.id)}">确认删除</button>`
      });
      break;
    }
    case "confirm-delete-file": {
      deleteFileRecord(el.dataset.id);
      break;
    }
    case "copy-file-text": {
      const record = state.files.find((file) => file.id === el.dataset.id);
      if (record?.text) copyWithFeedback(record.text, "资料全文已复制");
      else showToast("没有可复制的文本");
      break;
    }
    case "open-conv": {
      openConversation(el.dataset.id);
      break;
    }
    case "scene": {
      const sceneId = el.dataset.scene;
      const active = findConversation(state.activeId);
      const fromConversation = Boolean(el.closest(".assistant-actions") || el.closest(".result-footer"));
      if (fromConversation && active?.context) {
        openSceneForm(sceneId, { fromActive: true });
      } else {
        openSceneForm(sceneId);
      }
      break;
    }
    case "use-template": {
      openSceneForm(el.dataset.scene, { templateId: el.dataset.templateId });
      break;
    }
    case "edit-params": {
      adjustParams();
      break;
    }
    case "toggle-sidebar": {
      state.sidebarOpen = !state.sidebarOpen;
      renderApp({ preserveScroll: true });
      break;
    }
    case "close-sidebar": {
      state.sidebarOpen = false;
      renderApp({ preserveScroll: true });
      break;
    }
    case "toggle-rail": {
      if (window.matchMedia("(max-width: 960px)").matches) {
        state.railOpen = !state.railOpen;
        const workspace = document.querySelector(".workspace");
        if (workspace) workspace.classList.toggle("rail-open", state.railOpen);
      } else {
        const rail = document.querySelector(".context-rail");
        if (rail) {
          rail.scrollTo({ top: 0, behavior: "smooth" });
          rail.classList.remove("rail-focus");
          void rail.offsetWidth;
          rail.classList.add("rail-focus");
          setTimeout(() => rail.classList.remove("rail-focus"), 1100);
        }
      }
      break;
    }
    case "toggle-sources": {
      state.showAllSources = !state.showAllSources;
      renderApp({ preserveScroll: true });
      break;
    }
    case "close-rail": {
      state.railOpen = false;
      document.querySelector(".workspace")?.classList.remove("rail-open");
      break;
    }
    case "attach": {
      document.querySelector("[data-role='file-input']")?.click();
      break;
    }
    case "remove-attachment": {
      state.attachments = state.attachments.filter((file) => file.id !== el.dataset.id);
      renderApp({ preserveScroll: true });
      break;
    }
    case "fill-example": {
      fillFormExample();
      break;
    }
    case "close-modal": {
      closeModal();
      break;
    }
    case "set-doc-tab": {
      const messageId = el.dataset.message;
      state.docTabs[messageId] = el.dataset.docId;
      state.pendingScroll = "auto";
      renderApp({ preserveScroll: true });
      break;
    }
    case "copy-section": {
      const { message } = findMessage(el.dataset.message);
      const artifact = message?.result?.artifact;
      const doc = artifact?.docs.find((item) => item.id === el.dataset.doc);
      const section = doc?.sections.find((item) => item.id === el.dataset.section);
      if (section) copyWithFeedback(sectionToText(section), "本节已复制");
      break;
    }
    case "copy-doc": {
      const { message } = findMessage(el.dataset.message);
      const artifact = message?.result?.artifact;
      const doc = getActiveDoc(artifact, el.dataset.message);
      if (doc) copyWithFeedback(docToText(doc), "当前文档已复制");
      break;
    }
    case "copy-all": {
      const { message } = findMessage(el.dataset.message);
      if (message?.result?.artifact) copyWithFeedback(artifactToText(message.result.artifact), "全部文档已复制");
      break;
    }
    case "export-docx": {
      const { message } = findMessage(el.dataset.message);
      const artifact = message?.result?.artifact;
      const doc = getActiveDoc(artifact, el.dataset.message);
      if (!artifact) break;
      showToast("正在生成 DOCX…");
      downloadDOCX(artifact, { title: doc?.title || artifact.docs?.[0]?.title }).then(() => {
        showToast("DOCX 已下载，含标题、表格与页码");
      }).catch((error) => {
        console.warn("DOCX 导出失败", error);
        downloadWord(artifact, doc?.id);
        showToast("DOCX 组件不可用，已回退为 Word 兼容格式");
      });
      break;
    }
    case "export-xlsx": {
      const { message } = findMessage(el.dataset.message);
      const artifact = message?.result?.artifact;
      const doc = getActiveDoc(artifact, el.dataset.message);
      if (!artifact) break;
      showToast("正在生成 Excel…");
      downloadXLSX(artifact, { title: doc?.title || artifact.docs?.[0]?.title }).then(() => {
        showToast("Excel 已下载：正文、表格与引用来源分表");
      }).catch((error) => {
        showToast(`Excel 导出失败：${error.message || "组件不可用"}`);
      });
      break;
    }
    case "download-txt": {
      const { message } = findMessage(el.dataset.message);
      const artifact = message?.result?.artifact;
      if (!artifact) break;
      try {
        downloadTXT(artifact);
        showToast("TXT 已开始下载");
      } catch (error) {
        showToast(error.message || "TXT 导出失败");
      }
      break;
    }
    case "export-word": {
      const { message } = findMessage(el.dataset.message);
      const artifact = message?.result?.artifact;
      const doc = getActiveDoc(artifact, el.dataset.message);
      if (artifact) {
        downloadWord(artifact, doc?.id);
        showToast("Word 文件已开始下载（兼容格式）");
      }
      break;
    }
    case "print-doc": {
      const { message } = findMessage(el.dataset.message);
      const artifact = message?.result?.artifact;
      const doc = getActiveDoc(artifact, el.dataset.message);
      if (artifact) {
        printArtifact(artifact, doc?.id);
        showToast("已打开打印面板，可选择“另存为 PDF”");
      }
      break;
    }
    case "download-md": {
      const { message } = findMessage(el.dataset.message);
      if (message?.result?.artifact) {
        downloadMarkdown(message.result.artifact);
        showToast("Markdown 文件已开始下载");
      }
      break;
    }
    case "feedback": {
      const { conv, message } = findMessage(el.dataset.message);
      if (!conv || !message) return;
      const value = el.dataset.value;
      message.feedback = message.feedback === value ? "" : value;
      conv.feedback = message.feedback ? { value: message.feedback, at: new Date().toISOString() } : null;
      conv.updatedAt = new Date().toISOString();
      saveDB();
      state.pendingScroll = "auto";
      renderApp({ preserveScroll: true });
      showToast(message.feedback === "up" ? "感谢反馈：这条结果有用" : message.feedback === "down" ? "已记录：需要改进，感谢指出" : "已取消反馈");
      break;
    }
    case "show-source": {
      const key = el.dataset.key || el.dataset.ref || "";
      const ref = el.dataset.ref || key;
      let docId = el.dataset.doc || "";
      let sectionId = el.dataset.section || "";
      const locate = (id, no) => {
        const doc = getDoc(id);
        return doc?.sections.find((section) => section.no === String(Number(no)).padStart(2, "0") || section.id === ref)?.id || "";
      };
      if (!docId) {
        const spaced = ref.match(/^(.+?)\s*§\s*(\d+)$/);
        const idMatch = ref.match(/^(.*)-(\d+)$/);
        if (spaced) {
          docId = spaced[1];
          sectionId = locate(docId, spaced[2]);
        } else if (idMatch) {
          docId = idMatch[1];
          sectionId = locate(docId, idMatch[2]) || `${docId}-${idMatch[2]}`;
        }
      }
      if (docId) openDocModal(docId, sectionId);
      break;
    }
    case "open-doc": {
      openDocModal(el.dataset.doc, el.dataset.section || "");
      break;
    }
    case "download-kb": {
      const doc = getDoc(el.dataset.doc);
      if (doc) {
        downloadTextFile(`${doc.id}_${doc.title}.md`, docMarkdown(doc), "text/markdown;charset=utf-8");
        showToast("知识库材料已下载");
      }
      break;
    }
    case "copy-kb": {
      const doc = getDoc(el.dataset.doc);
      if (doc) copyWithFeedback(docMarkdown(doc), "知识库材料已复制");
      break;
    }
    case "set-kb-cat": {
      state.kbCategory = el.dataset.cat || "全部";
      refreshKbGrid();
      break;
    }
    case "clear-kb-search": {
      state.kbQuery = "";
      state.kbCategory = "全部";
      renderApp({ preserveScroll: true });
      break;
    }
    case "toggle-kb-manage": {
      state.kbManageMode = !state.kbManageMode;
      renderApp({ preserveScroll: true });
      break;
    }
    case "new-kb-doc": {
      openKnowledgeDocForm(null);
      break;
    }
    case "edit-kb-doc": {
      const doc = KB_DOCS.find((item) => item.id === el.dataset.id && !item.builtin);
      if (doc) openKnowledgeDocForm(doc);
      break;
    }
    case "copy-kb-doc": {
      const doc = KB_DOCS.find((item) => item.id === el.dataset.id);
      if (doc) {
        closeModal();
        openKnowledgeDocForm(doc, { copy: true });
      }
      break;
    }
    case "delete-kb-doc": {
      const doc = KB_DOCS.find((item) => item.id === el.dataset.id && !item.builtin);
      if (!doc) break;
      openModal({
        kind: "confirm",
        narrow: true,
        kicker: "DELETE / 自定义知识",
        title: "删除这份自定义材料？",
        sub: "材料会从检索、来源与 AI 上下文中移除。历史对话里的引用记录不会自动清理。",
        body: `<p class="confirm-copy"><strong>${escapeHtml(doc.title)}</strong></p><div class="confirm-warning">该操作只影响本机自定义知识，不会删除内置材料。</div>`,
        focusSelector: "[data-action='confirm-delete-kb-doc']",
        footer: `<button class="btn btn-ghost" type="button" data-action="close-modal">取消</button><span class="spacer"></span><button class="btn btn-solid" type="button" data-action="confirm-delete-kb-doc" data-id="${escapeAttr(doc.id)}">确认删除</button>`
      });
      break;
    }
    case "confirm-delete-kb-doc": {
      const id = el.dataset.id;
      deleteCustomDoc(id);
      state.customDocs = state.customDocs.filter((doc) => doc.id !== id);
      localDB.removeKnowledgeDoc(id).catch(() => null);
      registerCustomKnowledgeDocs(state.customDocs);
      closeModal();
      showToast("自定义知识材料已删除");
      renderApp({ preserveScroll: true });
      break;
    }
    case "import-kb-json": {
      document.querySelector("[data-role='kb-import-file']")?.click();
      break;
    }
    case "export-kb-json": {
      const docs = KB_DOCS.filter((doc) => !doc.builtin);
      if (!docs.length) {
        showToast("还没有自定义材料可导出");
        break;
      }
      downloadTextFile("授渔_自定义知识库.json", JSON.stringify({ schema: "jiangbei.knowledge.v1", exportedAt: new Date().toISOString(), docs }, null, 2), "application/json;charset=utf-8");
      showToast(`已导出 ${docs.length} 份自定义材料`);
      break;
    }
    case "set-history-cat": {
      state.historyCategory = el.dataset.cat || "全部";
      state.historySelected = [];
      renderApp({ preserveScroll: true });
      break;
    }
    case "rename-conv": {
      const conv = findConversation(el.dataset.id);
      if (!conv) break;
      openModal({
        kind: "confirm",
        narrow: true,
        kicker: "RENAME / 修改标题",
        title: "给这次对话换一个标题",
        sub: "标题只保存在本机，便于检索。不会改变已有成果内容。",
        body: `
          <div class="field">
            <label for="rename-conv-input">对话标题</label>
            <input id="rename-conv-input" value="${escapeAttr(conv.title || "")}" maxlength="80" autocomplete="off">
            <span class="field-hint">建议包含课程或任务名，最多 80 个字符。</span>
          </div>
          <div class="field" style="margin-top:10px">
            <label for="rename-conv-category">对话分类</label>
            <input id="rename-conv-category" list="history-cat-options" value="${escapeAttr(conversationCategory(conv))}" maxlength="24">
            <datalist id="history-cat-options">${["通用对话", "教案", "任务单与工作页", "评价表", "安全查询", "听课评课", "多成果任务"].map((cat) => `<option value="${escapeAttr(cat)}"></option>`).join("")}</datalist>
            <span class="field-hint">分类只保存在本机，用于筛选；可自定义。</span>
          </div>
        `,
        focusSelector: "#rename-conv-input",
        footer: `<button class="btn btn-ghost" type="button" data-action="close-modal">取消</button><span class="spacer"></span><button class="btn btn-solid" type="button" data-action="save-history-title" data-id="${escapeAttr(conv.id)}">保存标题</button>`
      });
      break;
    }
    case "save-history-title": {
      const conv = findConversation(el.dataset.id);
      const value = document.getElementById("rename-conv-input")?.value.trim();
      if (!conv) break;
      if (!value) {
        showToast("标题不能为空");
        break;
      }
      conv.title = truncate(value, 80);
      conv.category = truncate(document.getElementById("rename-conv-category")?.value.trim() || conversationCategory(conv), 24);
      conv.updatedAt = new Date().toISOString();
      saveDB();
      closeModal();
      showToast("对话标题已更新");
      renderApp({ preserveScroll: true });
      break;
    }
    case "batch-delete-history": {
      if (!state.historySelected.length) break;
      openModal({
        kind: "confirm",
        narrow: true,
        kicker: "DELETE / 批量删除",
        title: `删除所选的 ${state.historySelected.length} 条对话？`,
        sub: "只影响当前浏览器中的记录；删除后无法自动恢复。建议先导出备份。",
        body: `<div class="confirm-warning">已选对话中的成果、引用与反馈会一并删除。</div>`,
        focusSelector: "[data-action='confirm-batch-delete']",
        footer: `<button class="btn btn-ghost" type="button" data-action="close-modal">取消</button><span class="spacer"></span><button class="btn btn-solid" type="button" data-action="confirm-batch-delete">确认删除</button>`
      });
      break;
    }
    case "confirm-batch-delete": {
      const ids = new Set(state.historySelected);
      db.conversations = db.conversations.filter((conv) => !ids.has(conv.id));
      if (ids.has(state.activeId)) state.activeId = null;
      state.historySelected = [];
      saveDB();
      closeModal();
      showToast(`已删除 ${ids.size} 条对话`);
      renderApp({ preserveScroll: true });
      break;
    }
    case "pin-conv": {
      const conv = findConversation(el.dataset.id);
      if (!conv) return;
      conv.pinned = !conv.pinned;
      conv.updatedAt = new Date().toISOString();
      saveDB();
      renderApp({ preserveScroll: true });
      showToast(conv.pinned ? "已置顶" : "已取消置顶");
      break;
    }
    case "delete-conv": {
      const conv = findConversation(el.dataset.id);
      if (!conv) return;
      openModal({
        kind: "confirm",
        narrow: true,
        kicker: "DELETE / 本机记录",
        title: "删除这条对话？",
        sub: "删除后无法恢复，引用与本机反馈会一并移除。",
        body: `<p class="confirm-copy">将删除：<strong>${escapeHtml(conv.title || "未命名对话")}</strong></p><div class="confirm-warning">此操作只影响当前浏览器中的记录，不会通知任何人，也不会恢复已删除的内容。</div>`,
        focusSelector: "[data-action='confirm-delete']",
        footer: `
          <span class="spacer"></span>
          <button class="btn btn-ghost" type="button" data-action="close-modal">取消</button>
          <button class="btn btn-solid" type="button" data-action="confirm-delete" data-id="${escapeAttr(conv.id)}">确认删除</button>
        `
      });
      break;
    }
    case "confirm-delete": {
      const conv = findConversation(el.dataset.id);
      if (conv) {
        db.conversations = db.conversations.filter((item) => item.id !== conv.id);
        state.historySelected = state.historySelected.filter((id) => id !== conv.id);
        if (state.activeId === conv.id) state.activeId = null;
        saveDB();
      }
      closeModal();
      if (state.route.name === "chat") navigate("/");
      else renderApp({ preserveScroll: true });
      showToast("对话已删除");
      break;
    }
    case "copy-trial-template": {
      const node = document.getElementById("trial-template");
      if (node) copyWithFeedback(node.innerText, "试用反馈模板已复制");
      break;
    }
    case "requirements": {
      showToast("需要：专业、课程、具体工作任务、课型、学时、学情");
      break;
    }
    case "hint": {
      showToast("请在当前对话继续补充条件");
      break;
    }
    case "kb": {
      openDocModal(el.dataset.payload || "KB-01");
      break;
    }
    default:
      break;
  }
}

/* ==========================================================
   Event wiring
   ========================================================== */

document.addEventListener("click", (event) => {
  const backdrop = event.target.closest("[data-modal-backdrop]");
  if (backdrop && event.target === backdrop) {
    closeModal();
    return;
  }
  const actionEl = event.target.closest("[data-action]");
  if (!actionEl) return;
  if (actionEl.tagName === "A" && !actionEl.dataset.action) return;
  if (actionEl.closest("a[href]") && actionEl.matches("a[href]")) {
    const href = actionEl.getAttribute("href");
    if (href?.startsWith("#/")) {
      event.preventDefault();
    }
  }
  event.preventDefault();
  handleAction(actionEl.dataset.action, actionEl, event);
});

document.addEventListener("submit", (event) => {
  const form = event.target;
  if (form.matches("[data-role='composer']")) {
    event.preventDefault();
    const textarea = form.querySelector("[data-role='composer-input']");
    submitChat(textarea?.value || "");
    return;
  }
  if (form.id === "task-form") {
    event.preventDefault();
    submitTaskForm(form);
    return;
  }
  if (form.id === "kb-doc-form") {
    event.preventDefault();
    saveKnowledgeDocForm(form);
    return;
  }
  if (form.id === "ai-settings-form") {
    event.preventDefault();
    const settings = readAISettingsForm();
    if (settings.provider === "proxy" && !settings.endpoint) {
      showToast("请填写安全代理接口地址");
      document.getElementById("ai-endpoint")?.focus();
      return;
    }
    if (settings.provider === "proxy" && !/^https:\/\//i.test(settings.endpoint) && !/^http:\/\/127\.0\.0\.1/i.test(settings.endpoint)) {
      showToast("安全代理必须使用 HTTPS（本机开发可用 127.0.0.1）");
      return;
    }
    const fileLimit = Math.min(100, Math.max(1, Number(document.getElementById("file-max-mb")?.value) || 25));
    state.fileMaxMB = fileLimit;
    localDB.saveSetting("fileMaxMB", fileLimit).catch(() => null);
    saveAISettings(settings).then(() => {
      try {
        if (settings.proxyToken) sessionStorage.setItem("jiangbei.proxyToken", settings.proxyToken);
        else sessionStorage.removeItem("jiangbei.proxyToken");
      } catch (error) {
        // Ignore storage restrictions.
      }
      showToast("设置已保存");
      renderApp({ preserveScroll: true });
    });
  }
});

document.addEventListener("input", (event) => {
  const target = event.target;
  if (target.closest("[data-editor-field]") && state.editor) {
    updateEditorFromInput(target);
    return;
  }
  if (target.matches("[data-role='composer-input']")) {
    state.draft = target.value;
    autoResize(target);
    const form = target.closest("form");
    const send = form?.querySelector(".send-btn");
    if (send) send.disabled = !target.value.trim() && state.attachments.length === 0;
    return;
  }
  if (target.matches("[data-role='kb-search']")) {
    state.kbQuery = target.value;
    refreshKbGrid();
    return;
  }
  if (target.matches("[data-role='history-search']")) {
    state.historyQuery = target.value;
    refreshHistoryList();
    return;
  }
  if (target.closest("#task-form")) {
    const field = target.closest(".field");
    if (field && target.value.trim()) {
      field.classList.remove("has-error");
      target.removeAttribute("aria-invalid");
    }
  }
});

document.addEventListener("change", (event) => {
  const target = event.target;
  if (target.matches("[data-role='file-input']")) {
    handleFiles(target.files);
    target.value = "";
    return;
  }
  if (target.matches("[data-role='file-center-input']")) {
    handleFileCenterFiles(target.files);
    target.value = "";
    return;
  }
  if (target.matches("[data-role='backup-file']")) {
    handleBackupFile(target.files?.[0]);
    target.value = "";
    return;
  }
  if (target.matches("[data-role='kb-import-file']")) {
    importKnowledgeJson(target.files?.[0]);
    target.value = "";
    return;
  }
  if (target.id === "task-preset") {
    applyTaskPreset(target.value);
  }
  if (target.id === "ai-provider") {
    document.querySelectorAll("[data-provider-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.providerPanel !== target.value;
    });
  }
  if (target.matches("[data-role='history-select']")) {
    const id = target.dataset.id;
    state.historySelected = target.checked
      ? Array.from(new Set([...state.historySelected, id]))
      : state.historySelected.filter((item) => item !== id);
    refreshHistoryList();
    return;
  }
  if (target.matches("[data-role='history-select-all']")) {
    const filtered = filteredConversations();
    if (target.checked) {
      state.historySelected = Array.from(new Set([...state.historySelected, ...filtered.map((conv) => conv.id)]));
    } else {
      const visible = new Set(filtered.map((conv) => conv.id));
      state.historySelected = state.historySelected.filter((id) => !visible.has(id));
    }
    refreshHistoryList();
    return;
  }
});

let editorDragSectionId = "";

document.addEventListener("dragstart", (event) => {
  const item = event.target.closest?.(".editor-outline-item[data-section-id]");
  if (!item) return;
  editorDragSectionId = item.dataset.sectionId;
  event.dataTransfer.effectAllowed = "move";
  try { event.dataTransfer.setData("text/plain", editorDragSectionId); } catch (error) { /* Ignore. */ }
  item.classList.add("is-dragging");
});

document.addEventListener("dragend", (event) => {
  event.target.closest?.(".editor-outline-item")?.classList.remove("is-dragging");
  document.querySelectorAll(".editor-outline-item.is-drag-over").forEach((item) => item.classList.remove("is-drag-over"));
  editorDragSectionId = "";
});

document.addEventListener("dragover", (event) => {
  const outlineItem = event.target.closest?.(".editor-outline-item[data-section-id]");
  if (outlineItem && editorDragSectionId) {
    event.preventDefault();
    document.querySelectorAll(".editor-outline-item.is-drag-over").forEach((item) => item.classList.remove("is-drag-over"));
    outlineItem.classList.add("is-drag-over");
    return;
  }
  const zone = event.target.closest?.(".upload-zone");
  if (!zone) return;
  event.preventDefault();
  zone.classList.add("is-drag");
});

document.addEventListener("dragleave", (event) => {
  const zone = event.target.closest?.(".upload-zone");
  if (zone && !zone.contains(event.relatedTarget)) zone.classList.remove("is-drag");
});

document.addEventListener("drop", (event) => {
  const outlineTarget = event.target.closest?.(".editor-outline-item[data-section-id]");
  if (outlineTarget && state.editor && editorDragSectionId) {
    event.preventDefault();
    const doc = currentEditorDoc();
    if (doc) {
      const from = doc.sections.findIndex((section) => section.id === editorDragSectionId);
      const to = doc.sections.findIndex((section) => section.id === outlineTarget.dataset.sectionId);
      if (from >= 0 && to >= 0 && from !== to) {
        editorPushHistory();
        const [section] = doc.sections.splice(from, 1);
        doc.sections.splice(to, 0, section);
        state.editor.dirty = true;
        scheduleEditorSave();
      }
    }
    editorDragSectionId = "";
    renderEditorModal();
    return;
  }
  const zone = event.target.closest?.(".upload-zone");
  if (!zone) return;
  event.preventDefault();
  zone.classList.remove("is-drag");
  handleFileCenterFiles(event.dataTransfer?.files);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (state.modal) {
      closeModal();
      return;
    }
    if (state.railOpen) {
      state.railOpen = false;
      document.querySelector(".workspace")?.classList.remove("rail-open");
      return;
    }
    if (state.sidebarOpen) {
      state.sidebarOpen = false;
      renderApp({ preserveScroll: true });
      return;
    }
  }

  if (event.key === "Tab" && state.modal) {
    const modal = overlayEl.querySelector(".modal");
    if (!modal) return;
    const focusable = Array.from(modal.querySelectorAll("button:not([disabled]), [href], input:not([disabled]):not([type='hidden']), select:not([disabled]), textarea:not([disabled]), [tabindex='0']")).filter((el) => el.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  const target = event.target;
  if ((event.key === "Enter" || event.key === " ") && target.matches?.("[data-action='open-file-picker']")) {
    event.preventDefault();
    document.querySelector("[data-role='file-center-input']")?.click();
    return;
  }
  if (target.matches("[data-role='composer-input']") && event.key === "Enter" && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    target.closest("form")?.requestSubmit();
    return;
  }
  if (state.modal || target.matches("input, textarea, select") || target.isContentEditable) return;
  if (event.key === "/") {
    const input = document.querySelector("[data-role='composer-input']");
    if (input) {
      event.preventDefault();
      input.focus();
    }
  }
  if (event.key.toLowerCase() === "n" && !event.metaKey && !event.ctrlKey && !event.altKey) {
    state.draft = "";
    state.attachments = [];
    navigate("/");
  }
});

function autoResize(textarea) {
  if (!textarea) return;
  textarea.style.height = "auto";
  const max = textarea.closest(".chat-composer-wrap") ? 130 : 190;
  textarea.style.height = `${Math.min(textarea.scrollHeight, max)}px`;
}

window.addEventListener("resize", () => {
  document.querySelectorAll("[data-role='composer-input']").forEach(autoResize);
});

/* ==========================================================
   Init / IndexedDB bootstrap
   ========================================================== */

async function hydrateFromIndexedDB() {
  try {
    const [storedConversations, storedSettings, storedFiles, storedDocs] = await Promise.all([
      localDB.loadConversations().catch(() => []),
      localDB.loadAllSettings().catch(() => ({})),
      localDB.loadFileRecords().catch(() => []),
      localDB.loadKnowledgeDocs().catch(() => [])
    ]);

    // Merge local fallback and IndexedDB; newest copy of each conversation wins.
    const merged = new Map();
    [...db.conversations, ...storedConversations].forEach((conv) => {
      if (!conv?.id) return;
      const existing = merged.get(conv.id);
      if (!existing || new Date(conv.updatedAt || 0) >= new Date(existing.updatedAt || 0)) {
        merged.set(conv.id, conv);
      }
    });
    const { conversations } = sanitizeConversations([...merged.values()]);
    if (conversations.length) {
      db.conversations = conversations;
      saveDB();
      await localDB.replaceConversations(conversations).catch(() => null);
    }

    if (storedSettings.fileMaxMB) {
      state.fileMaxMB = Math.min(100, Math.max(1, Number(storedSettings.fileMaxMB) || 25));
    }
    
    if (storedSettings.ai) {
      state.ai = normalizeAISettings(storedSettings.ai);
      // Access tokens are intentionally session-scoped, never persisted with the rest of settings.
      try {
        const sessionToken = sessionStorage.getItem("jiangbei.proxyToken") || "";
        if (sessionToken) state.ai.proxyToken = sessionToken;
      } catch (error) {
        // sessionStorage may be unavailable in hardened browsers.
      }
    }
    if (storedFiles.length) state.files = storedFiles;
    if (storedDocs.length) {
      state.customDocs = storedDocs;
      registerCustomKnowledgeDocs(storedDocs);
    }
    idbReady = true;
    state.storageReady = true;
  } catch (error) {
    console.warn("IndexedDB 初始化失败，使用 localStorage 兼容模式。", error);
    state.storageReady = true;
  }
}

async function bootstrapApp() {
  if (!location.hash) history.replaceState(null, "", "#/");
  await hydrateFromIndexedDB();
  handleRoute();
}

bootstrapApp();