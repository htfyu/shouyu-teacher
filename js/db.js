/**
 * 授渔 V2 · IndexedDB 数据层
 *
 * 设计：
 * - 数据主存储在 IndexedDB；localStorage 只作为旧版本迁移与轻量回退。
 * - 不在数据库中保存模型 API Key。
 * - 所有读写都返回明确的 Promise，调用方必须处理失败。
 */

const DB_NAME = "jiangbei_v2";
const DB_VERSION = 1;
const STORES = {
  conversations: "conversations",
  files: "files",
  knowledge: "knowledge",
  settings: "settings",
  meta: "meta"
};

let dbPromise = null;
let indexedDBAvailable = true;

function supportsIndexedDB() {
  return typeof indexedDB !== "undefined" && indexedDB !== null;
}

function openDB() {
  if (!supportsIndexedDB()) {
    indexedDBAvailable = false;
    return Promise.reject(new Error("当前浏览器不支持 IndexedDB"));
  }
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORES.conversations)) {
        database.createObjectStore(STORES.conversations, { keyPath: "id" });
      }
      if (!database.objectStoreNames.contains(STORES.files)) {
        database.createObjectStore(STORES.files, { keyPath: "id" });
      }
      if (!database.objectStoreNames.contains(STORES.knowledge)) {
        const store = database.createObjectStore(STORES.knowledge, { keyPath: "id" });
        store.createIndex("updated", "updated", { unique: false });
      }
      if (!database.objectStoreNames.contains(STORES.settings)) {
        database.createObjectStore(STORES.settings, { keyPath: "key" });
      }
      if (!database.objectStoreNames.contains(STORES.meta)) {
        database.createObjectStore(STORES.meta, { keyPath: "key" });
      }
    };
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => database.close();
      resolve(database);
    };
    request.onerror = () => {
      indexedDBAvailable = false;
      reject(request.error || new Error("无法打开 IndexedDB"));
    };
    request.onblocked = () => reject(new Error("IndexedDB 被其他标签页占用，请关闭旧页面后重试"));
  }).catch((error) => {
    dbPromise = null;
    throw error;
  });
  return dbPromise;
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB 操作失败"));
  });
}

function txDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("IndexedDB 事务失败"));
    transaction.onabort = () => reject(transaction.error || new Error("IndexedDB 事务被中止"));
  });
}

export async function getAll(storeName) {
  const database = await openDB();
  const transaction = database.transaction(storeName, "readonly");
  return requestToPromise(transaction.objectStore(storeName).getAll());
}

export async function getOne(storeName, key) {
  const database = await openDB();
  const transaction = database.transaction(storeName, "readonly");
  return requestToPromise(transaction.objectStore(storeName).get(key));
}

export async function putOne(storeName, value) {
  const database = await openDB();
  const transaction = database.transaction(storeName, "readwrite");
  transaction.objectStore(storeName).put(value);
  await txDone(transaction);
  return value;
}

export async function putMany(storeName, values) {
  if (!values?.length) return [];
  const database = await openDB();
  const transaction = database.transaction(storeName, "readwrite");
  const store = transaction.objectStore(storeName);
  values.forEach((value) => store.put(value));
  await txDone(transaction);
  return values;
}

export async function deleteOne(storeName, key) {
  const database = await openDB();
  const transaction = database.transaction(storeName, "readwrite");
  transaction.objectStore(storeName).delete(key);
  await txDone(transaction);
}

export async function clearStore(storeName) {
  const database = await openDB();
  const transaction = database.transaction(storeName, "readwrite");
  transaction.objectStore(storeName).clear();
  await txDone(transaction);
}

export async function replaceConversations(conversations) {
  const database = await openDB();
  const transaction = database.transaction(STORES.conversations, "readwrite");
  const store = transaction.objectStore(STORES.conversations);
  store.clear();
  conversations.forEach((conv) => store.put(conv));
  await txDone(transaction);
  return true;
}

export async function loadConversations() {
  const list = await getAll(STORES.conversations);
  return list.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
}

export async function saveSetting(key, value) {
  return putOne(STORES.settings, { key, value, updatedAt: new Date().toISOString() });
}

export async function loadSetting(key, fallback = null) {
  const record = await getOne(STORES.settings, key);
  return record ? record.value : fallback;
}

export async function loadAllSettings() {
  const records = await getAll(STORES.settings);
  return Object.fromEntries(records.map((item) => [item.key, item.value]));
}

export async function saveKnowledgeDoc(doc) {
  return putOne(STORES.knowledge, { ...doc, updated: doc.updated || new Date().toISOString() });
}

export async function loadKnowledgeDocs() {
  return getAll(STORES.knowledge);
}

export async function removeKnowledgeDoc(id) {
  return deleteOne(STORES.knowledge, id);
}

export async function saveFileRecord(file) {
  return putOne(STORES.files, file);
}

export async function loadFileRecords() {
  const list = await getAll(STORES.files);
  return list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

export async function removeFileRecord(id) {
  return deleteOne(STORES.files, id);
}

export async function getStorageEstimate() {
  try {
    if (!navigator.storage?.estimate) return null;
    const estimate = await navigator.storage.estimate();
    return {
      usage: estimate.usage || 0,
      quota: estimate.quota || 0,
      percent: estimate.quota ? (estimate.usage / estimate.quota) * 100 : 0
    };
  } catch (error) {
    return null;
  }
}

export async function buildBackup({ conversations, knowledge, files, settings }) {
  return {
    app: "授渔 SHOUYU",
    schema: "jiangbei.backup.v2",
    version: 2,
    exportedAt: new Date().toISOString(),
    conversations: conversations || [],
    knowledge: knowledge || [],
    files: files || [],
    settings: settings || {},
    note: "备份可能包含教师输入的教学内容。请存放在学校批准的位置，不要上传到未授权平台。"
  };
}

export function validateBackup(data) {
  if (!data || typeof data !== "object") return { ok: false, errors: ["备份不是有效 JSON 对象"] };
  const errors = [];
  if (data.schema !== "jiangbei.backup.v2" && data.schema !== "jiangbei.workspace.v2") {
    errors.push("不支持的备份格式，需要 jiangbei.backup.v2");
  }
  if (data.conversations != null && !Array.isArray(data.conversations)) errors.push("conversations 必须是数组");
  if (data.knowledge != null && !Array.isArray(data.knowledge)) errors.push("knowledge 必须是数组");
  if (data.files != null && !Array.isArray(data.files)) errors.push("files 必须是数组");
  return { ok: errors.length === 0, errors };
}

export async function restoreBackup(data) {
  const validation = validateBackup(data);
  if (!validation.ok) throw new Error(validation.errors.join("；"));
  const database = await openDB();
  const stores = [];
  if (Array.isArray(data.conversations)) stores.push([STORES.conversations, data.conversations]);
  if (Array.isArray(data.knowledge)) stores.push([STORES.knowledge, data.knowledge]);
  if (Array.isArray(data.files)) stores.push([STORES.files, data.files]);
  const transaction = database.transaction(stores.map(([name]) => name), "readwrite");
  stores.forEach(([name, values]) => {
    const store = transaction.objectStore(name);
    store.clear();
    values.forEach((value) => store.put(value));
  });
  if (data.settings && typeof data.settings === "object") {
    // Settings are restored in a separate transaction to keep this method simple.
  }
  await txDone(transaction);
  if (data.settings && typeof data.settings === "object") {
    await Promise.all(Object.entries(data.settings).map(([key, value]) => saveSetting(key, value)));
  }
  return true;
}

export async function clearAllData() {
  const database = await openDB();
  const names = [STORES.conversations, STORES.files, STORES.knowledge, STORES.settings, STORES.meta];
  const transaction = database.transaction(names, "readwrite");
  names.forEach((name) => transaction.objectStore(name).clear());
  await txDone(transaction);
  return true;
}

export function isIndexedDBAvailable() {
  return supportsIndexedDB() && indexedDBAvailable;
}

export { STORES };