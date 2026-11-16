/**
 * 匠备 · 界面与交互
 * 纯前端、无构建步骤。所有对话默认保存在本机 localStorage。
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
  getDoc,
  getSection,
  totalSections,
  docMarkdown
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
  printArtifact,
  downloadMarkdown,
  downloadTextFile,
  artifactToText,
  docToText,
  sectionToText
} from "./export.js";

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
  const match = String(ref).match(/^(KB-\d{2})-(\d+)$/);
  if (match) return `${match[1]} §${match[2].padStart(2, "0")}`;
  return String(ref);
}

function sourceKeyFromRef(ref) {
  const match = String(ref).match(/^(KB-\d{2})-(\d+)$/);
  if (match) return `${match[1]}-${match[2]}`;
  const spaced = String(ref).match(/^(KB-\d{2}) §(\d+)$/);
  if (spaced) return `${spaced[1]}-${Number(spaced[2])}`;
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

function loadDB() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) return blankDB();
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.conversations)) return blankDB();
    let repaired = false;
    parsed.conversations = parsed.conversations
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

function saveDB() {
  try {
    db.lastOpenedAt = new Date().toISOString();
    const sorted = [...db.conversations].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return new Date(b.updatedAt) - new Date(a.updatedAt);
    });
    db.conversations = sorted.slice(0, MAX_CONVERSATIONS);
    localStorage.setItem(DB_KEY, JSON.stringify(db));
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
  generating: false,
  chatBusy: false,
  lastFocused: null,
  pendingScroll: "auto",
  showAllSources: false
};

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
  if (raw === "/templates" || raw.startsWith("/templates")) return { name: "templates" };
  if (raw === "/history" || raw.startsWith("/history")) return { name: "history" };
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
    { key: "templates", path: "/templates", icon: "layers", label: "模板库", count: LESSON_TEMPLATES.length + EVAL_TEMPLATES.length + OBSERVATION_TEMPLATES.length },
    { key: "history", path: "/history", icon: "clock", label: "历史对话", count: db.conversations.length },
    { key: "guide", path: "/guide", icon: "help", label: "使用说明" }
  ];
  sidebarEl.innerHTML = `
    <a class="brand" href="#/" data-action="nav" data-path="/" aria-label="匠备首页">
      <span class="brand-mark">匠</span>
      <span class="brand-copy">
        <span class="brand-name">匠备</span>
        <span class="brand-sub">JIANGBEI · TVET STUDIO</span>
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
      <div class="side-foot-row"><span class="status-dot"></span><span>LOCAL-FIRST · 数据不出浏览器</span></div>
      <a href="#/guide" data-action="nav" data-path="/guide">数据与能力边界 →</a>
    </div>
  `;
}

function sceneShort(scene) {
  return SCENES.find((item) => item.id === scene)?.short || "对话";
}

function renderTopbar(activeConv) {
  const route = state.route;
  let kicker = "WORKBENCH / 教学工作台";
  let title = "工学一体化教师助手";
  let center = "“把每一节课，备成一件作品。”";
  let actions = `
    <div class="topbar-status"><span class="status-dot"></span>知识库 ${KB_DOCS.length} 份 · 本地就绪</div>
    <button class="btn btn-ghost" type="button" data-action="nav" data-path="/kb" aria-label="打开知识库">${icon("book", 13)}<span class="topbar-action-label">知识库</span></button>
    <button class="btn" type="button" data-action="nav" data-path="/guide" aria-label="打开使用说明">${icon("help", 13)}<span class="topbar-action-label">使用说明</span></button>
  `;
  if (route.name === "chat" && activeConv) {
    kicker = "CONVERSATION / 已保存本机";
    title = activeConv.title || "教学对话";
    center = "知识库基线 · " + KB_VERSION;
    actions = `
      ${activeConv.latestArtifact ? `<button class="btn btn-ghost" type="button" data-action="edit-params" aria-label="调整任务参数">${icon("sliders", 13)}<span class="topbar-action-label">调整参数</span></button>` : ""}
      <button class="btn btn-ghost rail-mobile-btn" type="button" data-action="toggle-rail" aria-label="打开依据与合规自检">${icon("shield", 13)}<span class="topbar-action-label">依据 · 自检</span></button>
      <button class="btn btn-solid" type="button" data-action="new-chat" aria-label="新建对话">${icon("plus", 13)}<span class="topbar-action-label">新对话</span></button>
    `;
  } else if (route.name === "kb") {
    kicker = "KNOWLEDGE BASE / 知识库";
    title = "有依据，才回答";
    center = "全部材料可检索 · 引用可回溯";
    actions = `<button class="btn" type="button" data-action="nav" data-path="/" aria-label="返回工作台">${icon("arrowLeft", 13)}<span class="topbar-action-label">返回工作台</span></button>`;
  } else if (route.name === "templates") {
    kicker = "TEMPLATE LIBRARY / 模板库";
    title = "把稳定性做进起点";
    center = "模板只是约束，不是答案";
    actions = `<button class="btn" type="button" data-action="nav" data-path="/" aria-label="返回工作台">${icon("arrowLeft", 13)}<span class="topbar-action-label">返回工作台</span></button>`;
  } else if (route.name === "history") {
    kicker = "ARCHIVE / 本机记录";
    title = "历史对话与使用小结";
    center = "自动保存在当前浏览器 · 可随时删除";
    actions = `<button class="btn" type="button" data-action="nav" data-path="/" aria-label="返回工作台">${icon("arrowLeft", 13)}<span class="topbar-action-label">返回工作台</span></button>`;
  } else if (route.name === "guide") {
    kicker = "MANUAL / 使用说明";
    title = "能力、边界与扩展方式";
    center = "默认本地运行 · 人工审核是最后一道工序";
    actions = `<button class="btn" type="button" data-action="nav" data-path="/" aria-label="返回工作台">${icon("arrowLeft", 13)}<span class="topbar-action-label">返回工作台</span></button>`;
  }
  topbarEl.innerHTML = `
    <button class="mobile-menu" type="button" data-action="toggle-sidebar" aria-label="打开导航">${icon("menu", 16)}</button>
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
    : route.name === "templates"
      ? renderTemplatesPage()
      : route.name === "history"
        ? renderHistoryPage()
        : route.name === "guide"
          ? renderGuidePage()
          : renderHomePage();
  viewEl.scrollTop = options.preserveScroll ? previousViewScroll || 0 : 0;
  state.pendingScroll = "auto";
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
          <span>NO. 001</span>
        </div>
      </div>

      <section class="hero" aria-labelledby="hero-title">
        <div class="hero-eyebrow">
          <span>AI TEACHING WORKFLOW</span>
          <span>有依据 · 可落地 · 可审核</span>
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
        <input type="file" data-role="file-input" accept=".txt,.md,.markdown,.csv,.json" multiple hidden>
        <span class="composer-hint">Enter 发送 · Shift + Enter 换行</span>
        <span class="composer-privacy">${icon("shield", 10)} 本地处理 · 不上传</span>
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
        <div class="assistant-body">${mdLite(message.text || "")}</div>
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
  return `
    <div class="assistant-head">
      <span class="assistant-mark">匠</span>
      <span class="assistant-name">匠备</span>
      <span class="assistant-badge">${message.kind === "result" ? "KNOWLEDGE-GROUNDED" : "SCOPE-GUARDED"}</span>
      <time class="assistant-time" datetime="${escapeAttr(message.createdAt)}">${escapeHtml(formatTime(message.createdAt))}</time>
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
          <span class="mini-tag">${artifact.sources?.length || 0} 处知识库依据</span>
          ${result.metaSummary?.filter(Boolean).slice(0, 3).map((item) => `<span class="mini-tag">${escapeHtml(item)}</span>`).join("") || ""}
        </div>
      </div>

      <div class="result-toolbar">
        <button class="btn" type="button" data-action="copy-doc" data-message="${escapeAttr(message.id)}">${icon("copy", 12)}复制全文</button>
        <button class="btn" type="button" data-action="export-word" data-message="${escapeAttr(message.id)}">${icon("download", 12)}导出 Word</button>
        <button class="btn" type="button" data-action="print-doc" data-message="${escapeAttr(message.id)}">${icon("printer", 12)}打印 / PDF</button>
        <button class="btn btn-ghost" type="button" data-action="download-md" data-message="${escapeAttr(message.id)}">${icon("file", 12)}Markdown</button>
        <span class="spacer"></span>
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
    return `<button class="ref-chip" type="button" data-action="show-source" data-key="${escapeAttr(key)}" data-ref="${escapeAttr(ref)}">${escapeHtml(label)}</button>`;
  }).join("");
  return `
    <section class="doc-section" data-section-id="${escapeAttr(section.id)}">
      <div class="doc-section-head">
        <span class="section-index">${escapeHtml(section.no)}</span>
        <h3 class="section-title-text">${escapeHtml(section.title)}</h3>
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

const KB_CATEGORIES = ["全部", "课程与课标", "模板与样例", "实训安全", "评价与听评课", "合规与安全"];

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
          <p class="page-intro">所有回答都从这里的材料检索。材料没有覆盖的问题，助手会明确说“不知道”，而不是编一个看起来很真的答案。当前为演示用校本示例库，正式使用时请替换为学院现行文件。</p>
        </div>
        <div class="page-head-side">
          <strong>检索方式</strong>
          标题 / 标签 / 正文片段<br>
          引用细到章节，可展开原文<br>
          全部材料可单独下载
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
          ${KB_CATEGORIES.map((cat) => `<button class="filter-btn${state.kbCategory === cat ? " is-active" : ""}" type="button" data-action="set-kb-cat" data-cat="${escapeAttr(cat)}">${escapeHtml(cat)}</button>`).join("")}
        </div>
      </div>
      <div id="kb-grid">${renderKbGrid()}</div>
      <div class="kb-note">
        <strong>为什么是示例库？</strong> 为避免把虚构内容冒充学院正式制度，V1.0 明确标注为“校本示例”，结构与条款可审查、可替换。知识库文件位于 <code>js/knowledge.js</code>，替换后引用与检索会自动更新。<br>
        安全材料仅覆盖电工 / PLC 实训室；未收录的场所会明确提示咨询现场安全员。
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
        <div class="tag-row">${doc.tags.slice(0, 3).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>
        <div class="kb-card-foot">
          <span class="btn-link">阅读全文 →</span>
          <span class="meta">${doc.sections.length} 节 · ${escapeHtml(doc.updated)}</span>
        </div>
      </button>
    `;
  }).join("")}</div>`;
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

function renderHistoryPage() {
  const all = sortedConversations();
  const query = state.historyQuery.trim().toLowerCase();
  const filtered = query
    ? all.filter((conv) => `${conv.title} ${conv.scene || ""} ${conv.context?.task || ""} ${conv.context?.major || ""}`.toLowerCase().includes(query))
    : all;
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
          <p class="page-intro">每个生成结果都会自动保存在当前浏览器，不上传服务器。您可随时找回、置顶或删除。这里的使用统计只用于改进工具，不包含学生个人信息。</p>
        </div>
        <div class="page-head-side">
          <strong>数据边界</strong>
          存储位置：浏览器 localStorage<br>
          清除浏览器数据即删除<br>
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
          <input type="search" placeholder="搜索标题、专业或任务…" value="${escapeAttr(state.historyQuery)}" data-role="history-search" aria-label="搜索历史对话">
        </div>
        <button class="btn" type="button" data-action="nav" data-path="/">${icon("plus", 12)}新建对话</button>
      </div>
      <div id="history-list">${renderHistoryList(filtered)}</div>
      <div class="history-note">
        提示：反馈统计只累计本机点击，不支持远程收集；如需写“试用反馈”材料，请邀请同事如实使用后记录，不要编造数据。<br>
        清空全部记录会连同引用与反馈统计一起删除，请在浏览器设置中操作或逐条删除。
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
    return `
      <article class="history-card">
        <button class="history-main" type="button" data-action="open-conv" data-id="${escapeAttr(conv.id)}">
          <div class="history-kicker">
            <span>${escapeHtml(conv.scene ? sceneShort(conv.scene) : "对话")}</span>
            <span>·</span>
            <span>${escapeHtml(formatDate(conv.updatedAt))} ${escapeHtml(formatTime(conv.updatedAt))}</span>
            ${conv.pinned ? "<span>· 已置顶</span>" : ""}
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
          <button class="icon-btn${conv.pinned ? " is-pinned" : ""}" type="button" data-action="pin-conv" data-id="${escapeAttr(conv.id)}" title="${conv.pinned ? "取消置顶" : "置顶"}" aria-label="${conv.pinned ? "取消置顶" : "置顶"}">${icon("pin", 12)}</button>
          <button class="icon-btn" type="button" data-action="delete-conv" data-id="${escapeAttr(conv.id)}" title="删除" aria-label="删除对话">${icon("trash", 12)}</button>
        </div>
      </article>
    `;
  }).join("")}</div>`;
}

function refreshHistoryList() {
  const all = sortedConversations();
  const query = state.historyQuery.trim().toLowerCase();
  const filtered = query
    ? all.filter((conv) => `${conv.title} ${conv.scene || ""} ${conv.context?.task || ""} ${conv.context?.major || ""}`.toLowerCase().includes(query))
    : all;
  const list = document.getElementById("history-list");
  if (list) list.innerHTML = renderHistoryList(filtered);
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
          <p class="page-intro">匠备只服务一件事：把工学一体化备课从“写一份看起来完整的方案”，变成“拿到一份可以修改、可以上课、可以审核的教学成果”。默认本地运行，不依赖外部大模型，打开即用。</p>
        </div>
        <div class="page-head-side">
          <strong>当前版本</strong>
          V1.0 · ${escapeHtml(KB_VERSION.replace(" · 校本示例版", ""))} 基线<br>
          本地工作流 / 无后端<br>
          在线：<a href="https://htfyu.github.io/jiangbei-teacher/" target="_blank" rel="noopener">htfyu.github.io/jiangbei-teacher</a>
        </div>
      </div>

      <div class="guide-grid">
        <div class="guide-main">
          <section>
            <h2 class="guide-h2" data-no="01">这个助手做什么，不做什么</h2>
            <p class="guide-p"><strong>做：</strong>根据专业、课程、工作任务、课型、学时和学情，生成教案、学习任务单、六步工作页与评价表；检索电工 / PLC 实训安全规程；把脱敏听课记录整理成证据型评课意见。</p>
            <p class="guide-p"><strong>不做：</strong>不诊断学生心理，不预测成绩或给学生贴标签，不处理人事、财务、法律与医疗判断，不接收涉密或未脱敏数据。遇到超范围问题，助手会说明“不在我的知识范围内”，并给出咨询方向。</p>
            <div class="role-grid">
              <div class="role-card"><h4>先问清，再生成</h4><p>专业、任务、课型、学时、学情未齐时，先追问或弹出参数表单，避免一问就瞎答。</p></div>
              <div class="role-card"><h4>知识库没有就承认</h4><p>安全查询只返回知识库可支持的内容；未收录的场所会明确说“没有”，不编造规程。</p></div>
              <div class="role-card"><h4>固定结构，可拆可改</h4><p>成果按模块展示，每个模块单独复制；支持整篇 Word 导出、打印 / 另存 PDF。</p></div>
              <div class="role-card"><h4>人工审核是工序</h4><p>每份结果都带“待人工审核”标记和合规自检，不把 AI 草稿伪装成正式文件。</p></div>
            </div>
          </section>

          <section>
            <h2 class="guide-h2" data-no="02">能力地图与比赛要求</h2>
            <p class="guide-p">对应“5 类功能”的自检如下，均可现场演示：</p>
            <table class="mapping-table">
              <thead><tr><th>要求</th><th>作品中的落点</th><th>如何验证</th></tr></thead>
              <tbody>
                <tr><td>明确边界与角色</td><td>首页能力边界说明；角色限定为工学一体化备课；超范围规则</td><td>问“帮我预测谁能考过”“学生抑郁怎么办”</td></tr>
                <tr><td>有知识库，回答有依据</td><td>${KB_DOCS.length} 份材料 / ${totalSections()} 个片段；检索到章节；引用面板</td><td>查“电工实训室上电前要确认什么”并展开依据</td></tr>
                <tr><td>任务闭环，可落地成果</td><td>教案 + 任务单 + 工作页 + 评价表；复制 / Word / PDF</td><td>载入示例，生成后导出 Word</td></tr>
                <tr><td>会追问、会澄清</td><td>参数表单必填校验；对话缺参时追问；支持改学时 / 课型 / 模板</td><td>直接说“帮我写教案”，观察追问；生成后说“把学时改成 6”</td></tr>
                <tr><td>安全合规与人工审核</td><td>首页声明、表单隐私提示、合规自检、结果页审核标记、无服务器上传</td><td>查看右侧“合规自检”；在输入中放入手机号观察拦截</td></tr>
              </tbody>
            </table>
          </section>

          <section>
            <h2 class="guide-h2" data-no="03">工作流如何运行</h2>
            <p class="guide-p">每次生成不是“一次性写一段话”，而是按固定工序执行。当前公开版使用可审查的本地规则、知识检索与结构化模板；不调用外部大模型，因此没有密钥配置门槛，也没有把学校数据发出浏览器的风险。</p>
            <div class="arch-flow">
              <div class="arch-box">教师任务<small>专业 / 任务 / 学情</small></div>
              <div class="arch-arrow">→</div>
              <div class="arch-box">参数澄清<small>追问 / 表单校验</small></div>
              <div class="arch-arrow">→</div>
              <div class="arch-box">知识检索<small>章节级引用</small></div>
              <div class="arch-arrow">→</div>
              <div class="arch-box">结构化生成<small>教案 / 学生材料</small></div>
              <div class="arch-arrow">→</div>
              <div class="arch-box">合规自检<small>安全 / 隐私 / 审核</small></div>
              <div class="arch-arrow">→</div>
              <div class="arch-box">人工审核<small>教师最终确认</small></div>
            </div>
            <div class="role-grid">
              <div class="role-card"><h4>规范检索员</h4><p>按任务关键词与场景权重检索知识库，只挑与任务相关的章节。</p></div>
              <div class="role-card"><h4>教学设计员</h4><p>将目标、重难点、流程、评价与安全按模板组装为可执行结构。</p></div>
              <div class="role-card"><h4>学生材料员</h4><p>把教案转写为学生能读懂的任务单与六步工作页，保留记录与反思空间。</p></div>
              <div class="role-card"><h4>合规审核员</h4><p>检查个人信息、评分依据、安全边界与人工审核提示，不放过“看起来很像”的内容。</p></div>
            </div>
            <p class="guide-p" style="margin-top:10px">如果后续接入大模型，建议保留“检索片段 → 结构化模板 → 引用绑定 → 合规检查”这四道约束层；模型的自由生成只能发生在被约束的段落内，不能覆盖安全条款和引用关系。</p>
          </section>

          <section>
            <h2 class="guide-h2" data-no="04">使用步骤</h2>
            <ol class="guide-list">
              <li><strong>选场景：</strong>从首页选择“生成教案 / 任务单与工作页 / 评价表 / 查安全规程 / 听课评课”。</li>
              <li><strong>填参数：</strong>专业、课程、工作任务、课型、学时、学情等。学情只写班级层面的先修基础、常见困难与设备条件，不写姓名。</li>
              <li><strong>核对引用：</strong>生成后，右侧“引用来源”可展开每一条依据；每个文档模块都能单独复制。</li>
              <li><strong>修改与追问：</strong>直接说“把学时改成 6”“模板换成任务驱动简案”，或点“调整参数”；系统保留其他条件重新生成。</li>
              <li><strong>导出并人工审核：</strong>导出 Word 或打印 / 另存 PDF 后，由教师核对设备、企业标准、安全条款和评价权重，再正式使用。</li>
            </ol>
          </section>

          <section>
            <h2 class="guide-h2" data-no="05">数据怎么处理，边界在哪里</h2>
            <div class="principle-grid">
              <div class="principle"><div class="principle-num">01 / LOCAL</div><h3>默认不联网</h3><p>输入、生成结果、历史与反馈只保存在当前浏览器的 localStorage，不上传服务器。</p></div>
              <div class="principle"><div class="principle-num">02 / MINIMUM</div><h3>只收必需信息</h3><p>不要求填写学生姓名、学号、联系方式、家庭情况；学情使用班级级描述。</p></div>
              <div class="principle"><div class="principle-num">03 / GUARD</div><h3>主动识别敏感格式</h3><p>检测到疑似手机号、身份证号、邮箱或“姓名：”时提示删除或脱敏，不继续发送。</p></div>
              <div class="principle"><div class="principle-num">04 / REVIEW</div><h3>人工审核是最后工序</h3><p>AI 结果定位为辅助草稿；安全、评价、企业标准必须由具备职责的教师确认。</p></div>
            </div>
            <p class="guide-p" style="margin-top:10px">限制说明：浏览器本地存储意味着换设备、换浏览器不会同步；清理浏览器缓存会删除历史。请不要在公共电脑上保留含校内信息的记录。</p>
          </section>

          <section>
            <h2 class="guide-h2" data-no="06">如何替换知识库与扩展</h2>
            <p class="guide-p"><strong>替换知识库：</strong>编辑 <code>js/knowledge.js</code> 中的 <code>KB_DOCS</code>，保持 <code>id / title / category / sections</code> 结构；每个 section 的 <code>refs</code> 使用 <code>KB-xx-n</code> 即可被引用。页面统计、检索和引用面板会自动更新，无需改界面。</p>
            <p class="guide-p"><strong>新增模板：</strong>在 <code>LESSON_TEMPLATES / EVAL_TEMPLATES / OBSERVATION_TEMPLATES</code> 中追加模板对象；生成器会按模板选择结构与表达。</p>
            <p class="guide-p"><strong>接入学院系统：</strong>如需接入教务系统或大模型，建议增加一层后端代理与权限控制，学生数据先在服务端脱敏，不把密钥放在前端；本作品的前端结构与导出能力可以复用。</p>
            <div class="code-block">知识库文件：js/knowledge.js<br>生成工作流：js/engine.js<br>界面与交互：js/app.js<br>导出：js/export.js</div>
          </section>

          <section>
            <h2 class="guide-h2" data-no="07">试用反馈怎样留证据</h2>
            <p class="guide-p">不要编造“已有 100 位老师使用”。邀请 1—2 位同事真实使用，记录具体任务、耗时、修改点和是否愿意继续使用。下面的模板可以复制到文档里，自行填写并附截图。</p>
            <div class="feedback-template" id="trial-template">
              <strong>匠备 · 试用反馈记录（模板）</strong><br>
              试用日期：____年__月__日　　试用对象岗位：__________（可匿名）<br>
              使用场景：□教案　□任务单 / 工作页　□评价表　□安全查询　□听评课<br>
              原始任务：______________________________________________<br>
              完成用时：手工约____分钟　　使用匠备约____分钟<br>
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
              <li>知识库是演示用校本示例，不是学院正式文件；安全、评价、课程内容必须替换与复核。</li>
              <li>默认版本不调用大模型，长文本润色和开放式问答能力有限；它优先保证结构、依据与边界。</li>
              <li>部分典型任务画像覆盖电气、PLC、数控、汽车、机器人；其他专业使用通用结构，教师需补充任务细节。</li>
              <li>PDF 通过浏览器打印面板生成，不同浏览器的分页效果略有差异；复杂表格建议导出 Word 后微调。</li>
              <li>系统无法识别所有形式的个人信息；检测与人工检查必须同时使用。</li>
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
  state.modal = null;
  overlayEl.innerHTML = "";
  document.body.classList.remove("modal-open");
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
  const modal = state.modal;
  overlayEl.innerHTML = `
    <div class="modal-backdrop" data-modal-backdrop>
      <div class="modal${modal.narrow ? " is-narrow" : ""}" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div class="modal-head">
          <div>
            <div class="modal-kicker">${escapeHtml(modal.kicker || "JIANGBEI / DIALOG")}</div>
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
      </div>
      <h2 class="kb-doc-title">${escapeHtml(doc.title)}</h2>
      <p class="kb-doc-summary">${escapeHtml(doc.summary)}</p>
    </div>
    <div class="kb-doc-warning">演示用校本示例材料，不对应学院正式文件。正式使用前请由课程负责人替换、审核并留存版本记录。</div>
    ${doc.sections.map((section) => `
      <section class="kb-doc-section${section.id === sectionId ? " highlight-section" : ""}" id="kb-section-${escapeAttr(section.id)}">
        <h3><span>${escapeHtml(section.no)}</span>${escapeHtml(section.title)}</h3>
        <p>${escapeHtml(section.text)}</p>
        ${section.bullets.length ? `<ul>${section.bullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join("")}</ul>` : ""}
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
  const sceneId = state.modal?.sceneId;
  const mode = state.modal?.mode || "new";
  const convId = state.modal?.convId;
  const reuseConvId = state.modal?.reuseConvId;
  const params = collectFormParams(form);
  const combined = Object.values(params).map((value) => String(value || "")).join("\n");
  const risks = detectInputRisk(combined);
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
  conv.scene = sceneId;
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
  startGeneration(conv, sceneId, params);
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
  const combinedRisk = detectInputRisk(`${rawText}\n${attachmentContext}`);
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

  const assistantMessage = {
    id: uid("msg"),
    role: "assistant",
    kind: reply.type === "clarify" ? "clarify" : "chat",
    text: reply.text,
    sources: reply.sources || [],
    suggestions: reply.suggestions || [],
    tag: reply.tag || "",
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
    showToast("最多附带 3 份参考资料");
    return;
  }
  const allowed = /\.(txt|md|markdown|csv|json)$/i;
  for (const file of files) {
    if (!allowed.test(file.name)) {
      showToast(`暂不支持 ${file.name}，请使用 .txt / .md / .csv / .json`);
      continue;
    }
    if (file.size > 160 * 1024) {
      showToast(`${file.name} 超过 160KB，请先精简`);
      continue;
    }
    try {
      const text = await file.text();
      const risks = detectInputRisk(text);
      if (risks.length) {
        showToast(`${file.name} 中检测到${risks.join("、")}，请先脱敏再添加`);
        continue;
      }
      state.attachments.push({
        id: uid("file"),
        name: file.name,
        size: file.size,
        text: text.slice(0, 8000)
      });
    } catch (error) {
      showToast(`无法读取 ${file.name}`);
    }
  }
  if (state.attachments.length) {
    showToast("资料仅在本机读取，不会上传");
    renderApp({ preserveScroll: true });
  }
}

/* ==========================================================
   Actions
   ========================================================== */

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
    case "export-word": {
      const { message } = findMessage(el.dataset.message);
      const artifact = message?.result?.artifact;
      const doc = getActiveDoc(artifact, el.dataset.message);
      if (artifact) {
        downloadWord(artifact, doc?.id);
        showToast("Word 文件已开始下载，可直接用 Word / WPS 打开修改");
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
      let docId = el.dataset.doc || "";
      let sectionId = el.dataset.section || "";
      if (!docId) {
        const spaced = key.match(/^(KB-\d{2})\s*§\s*(\d+)$/);
        const idMatch = key.match(/^(KB-\d{2})-(\d+)$/);
        if (spaced) {
          docId = spaced[1];
          const doc = getDoc(docId);
          sectionId = doc?.sections.find((section) => section.no === spaced[2].padStart(2, "0"))?.id || "";
        } else if (idMatch) {
          docId = idMatch[1];
          sectionId = `${idMatch[1]}-${idMatch[2]}`;
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
  }
});

document.addEventListener("input", (event) => {
  const target = event.target;
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
  if (target.id === "task-preset") {
    applyTaskPreset(target.value);
  }
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
   Init
   ========================================================== */

function init() {
  if (!location.hash) history.replaceState(null, "", "#/");
  handleRoute();
  if (db.conversations.length && state.route.name === "home") {
    // A quiet, one-time hint that local history exists.
    setTimeout(() => {
      if (state.route.name === "home" && !state.modal) {
        // Do not interrupt the first paint; the sidebar already shows recent items.
      }
    }, 600);
  }
}

init();