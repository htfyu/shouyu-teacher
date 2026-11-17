/**
 * 授渔 · 教学成果库
 *
 * 保存工学一体化资源包、质检结果和审核状态。独立于专业库修订，
 * 避免把课程知识与教师成果混在一张表里。
 */

const DB_NAME = "shouyu_studio_v1";
const DB_VERSION = 1;
const STORE = "bundles";
const FALLBACK_KEY = "shouyu.studio.v1";

let dbPromise = null;
let loaded = false;
let loadPromise = null;
let mode = "indexeddb";
let lastError = "";
let bundles = [];

function clone(value) {
  return typeof structuredClone === "function" ? structuredClone(value) : JSON.parse(JSON.stringify(value));
}

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB open failed"));
    request.onblocked = () => reject(new Error("IndexedDB open blocked"));
  });
  return dbPromise;
}

function readFallback() {
  try {
    const raw = localStorage.getItem(FALLBACK_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function writeFallback(value) {
  try {
    localStorage.setItem(FALLBACK_KEY, JSON.stringify(value));
    return true;
  } catch (error) {
    return false;
  }
}

function sortBundles(list) {
  return [...list].sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
}

export async function loadStudioStore() {
  if (loaded) return bundles;
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    try {
      const db = await openDB();
      const list = await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readonly");
        const request = tx.objectStore(STORE).getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });
      bundles = sortBundles(list);
      mode = "indexeddb";
    } catch (error) {
      lastError = String(error?.message || error);
      bundles = sortBundles(readFallback());
      mode = "localstorage";
    }
    loaded = true;
    return bundles;
  })();
  return loadPromise;
}

function persist() {
  if (mode === "localstorage") {
    if (!writeFallback(bundles)) throw new Error("本机存储空间不足，教学成果未能保存");
    return Promise.resolve();
  }
  return openDB().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    store.clear();
    bundles.forEach((bundle) => store.put(bundle));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  })).catch((error) => {
    mode = "localstorage";
    lastError = String(error?.message || error);
    if (!writeFallback(bundles)) throw new Error("IndexedDB 写入失败，且本机兼容存储空间不足");
  });
}

export function getStudioBundles() {
  return bundles;
}

export function getStudioBundle(id) {
  return bundles.find((bundle) => bundle.id === id) || null;
}

export function getStudioBundleStats() {
  const now = Date.now();
  const quality = bundles.map((bundle) => bundle.quality?.overall).filter((value) => Number.isFinite(value));
  return {
    total: bundles.length,
    draft: bundles.filter((bundle) => bundle.status === "draft").length,
    pending: bundles.filter((bundle) => bundle.reviewStatus !== "已通过" && bundle.status !== "approved").length,
    approved: bundles.filter((bundle) => bundle.status === "approved" || bundle.reviewStatus === "已通过").length,
    averageQuality: quality.length ? Math.round(quality.reduce((sum, value) => sum + value, 0) / quality.length) : 0,
    demos: bundles.filter((bundle) => bundle.demo).length,
    thisWeek: bundles.filter((bundle) => now - new Date(bundle.updatedAt || bundle.createdAt || 0).getTime() < 7 * 86400000).length
  };
}

export async function saveStudioBundle(bundle) {
  if (!bundle?.id) throw new Error("成果缺少 id");
  const now = new Date().toISOString();
  const index = bundles.findIndex((item) => item.id === bundle.id);
  const next = {
    ...clone(bundle),
    createdAt: bundle.createdAt || now,
    updatedAt: now
  };
  if (index >= 0) {
    const previous = bundles[index];
    const history = Array.isArray(previous.history) ? [...previous.history] : [];
    if (bundle._contentChanged) {
      history.push({
        version: previous.version || 1,
        updatedAt: previous.updatedAt,
        artifact: previous.artifact,
        quality: previous.quality || null,
        reviewStatus: previous.reviewStatus || "待审核"
      });
    }
    next.history = history.slice(-4);
    next.version = Math.max(Number(previous.version) || 1, Number(bundle.version) || 1) + (bundle._contentChanged ? 1 : 0);
    delete next._contentChanged;
    bundles[index] = next;
  } else {
    next.version = Number(bundle.version) || 1;
    bundles.unshift(next);
  }
  bundles = sortBundles(bundles);
  await persist();
  return next;
}

export async function updateStudioBundle(id, patch = {}) {
  const index = bundles.findIndex((bundle) => bundle.id === id);
  if (index < 0) throw new Error("成果不存在");
  bundles[index] = { ...bundles[index], ...patch, updatedAt: new Date().toISOString() };
  await persist();
  return bundles[index];
}

export async function saveStudioQuality(id, report) {
  return updateStudioBundle(id, {
    quality: report,
    qualityUpdatedAt: new Date().toISOString()
  });
}

export async function setStudioReview(id, review = {}) {
  const reviewedAt = review.reviewedAt || new Date().toISOString();
  const expertStatus = review.status === "已通过" ? "approved" : review.status === "退回修改" ? "needs_revision" : "pending";
  return updateStudioBundle(id, {
    reviewStatus: review.status || "待审核",
    status: review.status === "已通过" ? "approved" : review.status === "退回修改" ? "needs_revision" : "draft",
    reviewedAt,
    reviewNote: review.note || "",
    reviewer: review.reviewer || "",
    expertReview: {
      status: expertStatus,
      reviewer: review.reviewer || "",
      reviewedAt,
      note: review.note || "",
      items: Array.isArray(review.items) ? review.items : [],
      source: "teacher_recorded"
    }
  });
}

export async function deleteStudioBundle(id) {
  bundles = bundles.filter((bundle) => bundle.id !== id);
  await persist();
}

export async function clearStudioStore() {
  bundles = [];
  loaded = true;
  await persist();
}

export function getStudioStorageMode() {
  return mode;
}

export function getStudioLastError() {
  return lastError;
}

export function exportStudioState() {
  return {
    schema: "shouyu.studio.export.v1",
    exportedAt: new Date().toISOString(),
    bundles: clone(bundles)
  };
}

export async function importStudioState(payload) {
  const list = Array.isArray(payload) ? payload : payload?.bundles;
  if (!Array.isArray(list)) throw new Error("成果备份格式不正确");
  bundles = sortBundles(list.filter((item) => item && item.id));
  loaded = true;
  await persist();
  return bundles;
}