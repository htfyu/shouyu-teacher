/**
 * 授渔 · 教学应用成效存储
 * 独立 IndexedDB；未采集时保持空，不生成任何模拟记录。
 */

import { emptyImpactState, IMPACT_SCHEMA, validateImpactRecord } from "./impact-engine.js";

const DB_NAME = "shouyu_impact_v1";
const DB_VERSION = 1;
const STORE = "records";
const FALLBACK_KEY = "shouyu.impact.v1";

let dbPromise = null;
let loaded = false;
let loadPromise = null;
let mode = "indexeddb";
let lastError = "";
let records = [];

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
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB open failed"));
    request.onblocked = () => reject(new Error("IndexedDB open blocked"));
  });
  return dbPromise;
}

function readFallback() {
  try {
    const parsed = JSON.parse(localStorage.getItem(FALLBACK_KEY) || "null");
    if (Array.isArray(parsed)) return parsed;
    if (Array.isArray(parsed?.records)) return parsed.records;
    return [];
  } catch (error) {
    return [];
  }
}

function writeFallback(value) {
  try {
    localStorage.setItem(FALLBACK_KEY, JSON.stringify({ schema: IMPACT_SCHEMA, records: value }));
    return true;
  } catch (error) {
    return false;
  }
}

function sortRecords(list) {
  return [...list].sort((a, b) => new Date(b.trialDate || b.measuredAt || 0) - new Date(a.trialDate || a.measuredAt || 0));
}

export async function loadImpactStore() {
  if (loaded) return records;
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
      records = sortRecords(list);
      mode = "indexeddb";
    } catch (error) {
      lastError = String(error?.message || error);
      records = sortRecords(readFallback());
      mode = "localstorage";
    }
    loaded = true;
    return records;
  })();
  return loadPromise;
}

function persist() {
  if (mode === "localstorage") {
    if (!writeFallback(records)) throw new Error("本机存储空间不足，应用成效记录未能保存");
    return Promise.resolve();
  }
  return openDB().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    store.clear();
    records.forEach((record) => store.put(record));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  })).catch((error) => {
    mode = "localstorage";
    lastError = String(error?.message || error);
    if (!writeFallback(records)) throw new Error("IndexedDB 写入失败，且本机兼容存储空间不足");
  });
}

export function getImpactRecords() {
  return records;
}

export function getImpactStats() {
  const teachers = new Set(records.map((record) => String(record.teacherAlias || "").toLowerCase()).filter(Boolean));
  return {
    total: records.length,
    participants: teachers.size,
    courses: new Set(records.map((record) => record.courseId || record.courseName).filter(Boolean)).size,
    resources: records.reduce((sum, record) => sum + (Number(record.generatedResources) || 0), 0)
  };
}

export async function addImpactRecord(input) {
  const validation = validateImpactRecord(input);
  if (!validation.ok) throw new Error(validation.errors.join("；"));
  const now = new Date().toISOString();
  const record = {
    ...validation.record,
    id: `impact_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    createdAt: now,
    updatedAt: now
  };
  records = sortRecords([record, ...records]);
  await persist();
  return record;
}

export async function updateImpactRecord(id, input) {
  const index = records.findIndex((record) => record.id === id);
  if (index < 0) throw new Error("记录不存在");
  const validation = validateImpactRecord({ ...records[index], ...input });
  if (!validation.ok) throw new Error(validation.errors.join("；"));
  const next = { ...records[index], ...validation.record, updatedAt: new Date().toISOString() };
  records[index] = next;
  records = sortRecords(records);
  await persist();
  return next;
}

export async function deleteImpactRecord(id) {
  records = records.filter((record) => record.id !== id);
  await persist();
}

export async function clearImpactStore() {
  records = [];
  loaded = true;
  await persist();
}

export function getImpactStorageMode() {
  return mode;
}

export function getImpactLastError() {
  return lastError;
}

export function exportImpactState() {
  return { schema: IMPACT_SCHEMA, records: clone(records), exportedAt: new Date().toISOString(), note: "真实教师记录；未采集时为空。不要填入模拟数据。" };
}

export async function importImpactState(payload, { replace = true } = {}) {
  const list = Array.isArray(payload) ? payload : payload?.records;
  if (!Array.isArray(list)) throw new Error("应用成效数据格式无效：缺少 records 数组");
  const valid = [];
  for (const item of list) {
    const validation = validateImpactRecord(item);
    if (!validation.ok) throw new Error(`记录 ${item?.teacherAlias || item?.id || "未命名"} 无效：${validation.errors.join("；")}`);
    valid.push({
      ...validation.record,
      id: item.id || `impact_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      createdAt: item.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }
  records = replace ? sortRecords(valid) : sortRecords([...records, ...valid]);
  await persist();
  return records;
}

export function getImpactEmptyState() {
  return emptyImpactState();
}