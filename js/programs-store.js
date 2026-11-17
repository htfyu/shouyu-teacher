/**
 * 授渔 · 专业数据库本机修订层
 *
 * 基础数据来自 js/programs-data.js（由 Excel 生成，不改写）。
 * 教师对专业体系、课程资料的新增、编辑、隐藏与课程资源校订，
 * 保存在本机 IndexedDB 的独立数据库中，不回写原始数据。
 */

import { PROGRAM_DATA } from "./programs-data.js";

const DB_NAME = "shouyu_programs_v1";
const DB_VERSION = 1;
const STORE = "catalog";
const KEY = "revision";
const FALLBACK_KEY = "shouyu.programs.v1";

const TYPES = ["departments", "groups", "majors", "courses"];
const EDITABLE = {
  departments: ["name", "summary", "kind"],
  groups: ["name", "summary", "kind"],
  majors: [
    "name", "trainingGoal", "coreAbilities", "employment", "enrollment",
    "duration", "mainCoursesSummary", "dataYear", "status", "sourceNote"
  ],
  courses: ["name", "category", "phase", "intro", "dataYear", "sourceNote"]
};

const RESOURCE_FIELDS = [
  "status", "intro", "objectives", "content", "focus", "plan",
  "methods", "training", "assessment", "resources", "notes", "sourceNote"
];

function emptyState() {
  return {
    version: 1,
    updatedAt: "",
    overrides: {
      departments: {},
      groups: {},
      majors: {},
      courses: {}
    },
    custom: {
      departments: [],
      groups: [],
      majors: [],
      courses: []
    },
    hidden: {
      departments: [],
      groups: [],
      majors: [],
      courses: []
    },
    resources: {}
  };
}

let state = emptyState();
let loaded = false;
let loadPromise = null;
let dbPromise = null;
let storageMode = "indexeddb";
let lastError = "";

function clone(value) {
  return typeof structuredClone === "function"
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

function asText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeState(value) {
  const next = emptyState();
  if (!value || typeof value !== "object") return next;
  next.updatedAt = typeof value.updatedAt === "string" ? value.updatedAt : "";
  for (const type of TYPES) {
    const overrides = value.overrides?.[type];
    if (overrides && typeof overrides === "object" && !Array.isArray(overrides)) {
      for (const [id, patch] of Object.entries(overrides)) {
        if (!patch || typeof patch !== "object" || Array.isArray(patch)) continue;
        next.overrides[type][id] = { ...patch };
      }
    }
    const custom = value.custom?.[type];
    if (Array.isArray(custom)) {
      next.custom[type] = custom.filter((item) => item && typeof item === "object" && item.id).map((item) => ({ ...item }));
    }
    const hidden = value.hidden?.[type];
    if (Array.isArray(hidden)) {
      next.hidden[type] = Array.from(new Set(hidden.filter((id) => typeof id === "string")));
    }
  }
  if (value.resources && typeof value.resources === "object" && !Array.isArray(value.resources)) {
    for (const [id, resource] of Object.entries(value.resources)) {
      if (resource && typeof resource === "object" && !Array.isArray(resource)) {
        next.resources[id] = { ...resource };
      }
    }
  }
  return next;
}

function openDatabase() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
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
    return raw ? normalizeState(JSON.parse(raw)) : null;
  } catch (error) {
    return null;
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

export async function loadProgramStore() {
  if (loaded) return state;
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    try {
      const db = await openDatabase();
      const value = await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readonly");
        const request = tx.objectStore(STORE).get(KEY);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      state = normalizeState(value);
      storageMode = "indexeddb";
    } catch (error) {
      lastError = String(error?.message || error);
      const fallback = readFallback();
      state = fallback || emptyState();
      storageMode = "localstorage";
    }
    loaded = true;
    return state;
  })();
  return loadPromise;
}

async function persist() {
  state.updatedAt = new Date().toISOString();
  if (storageMode === "localstorage") {
    if (!writeFallback(state)) throw new Error("本机存储空间不足，修订未能保存");
    return;
  }
  try {
    const db = await openDatabase();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(state, KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch (error) {
    storageMode = "localstorage";
    lastError = String(error?.message || error);
    if (!writeFallback(state)) throw new Error("IndexedDB 写入失败，且本机兼容存储空间不足");
  }
}

export function getProgramState() {
  return state;
}

export function getProgramStorageMode() {
  return storageMode;
}

export function getProgramLastError() {
  return lastError;
}

export function isBaseProgramEntity(type, id) {
  const collection = PROGRAM_DATA[type] || [];
  return collection.some((item) => item.id === id);
}

function baseCollection(type) {
  return PROGRAM_DATA[type] || [];
}

function isHidden(type, id) {
  return state.hidden[type]?.includes(id);
}

function applyOverride(type, item) {
  const patch = state.overrides[type]?.[item.id];
  if (!patch) return { ...item, base: true };
  const merged = { ...item, ...patch, base: true, isLocallyEdited: true };
  if (type === "courses" && patch.intro !== undefined) {
    // A locally changed introduction is no longer the original school text.
    merged.hasOfficialIntro = false;
    merged.introLocallyEdited = true;
  }
  return merged;
}

function allItems(type) {
  const base = baseCollection(type).filter((item) => !isHidden(type, item.id)).map((item) => applyOverride(type, item));
  const custom = (state.custom[type] || []).map((item) => ({ ...item, base: false }));
  return [...base, ...custom];
}

/**
 * Merge immutable base data, overrides, custom entities and hidden markers
 * into one read-only catalogue for the UI.
 */
export function buildProgramCatalog() {
  const departments = allItems("departments");
  const deptMap = new Map(departments.map((item) => [item.id, item]));
  const groups = allItems("groups").map((group) => {
    const dept = deptMap.get(group.deptId);
    return dept ? group : null;
  }).filter(Boolean);
  const groupMap = new Map(groups.map((item) => [item.id, item]));
  const majors = allItems("majors").map((major) => {
    const group = groupMap.get(major.groupId);
    const dept = group ? deptMap.get(group.deptId) : null;
    return group && dept ? { ...major, deptId: dept.id } : null;
  }).filter(Boolean);
  const majorMap = new Map(majors.map((item) => [item.id, item]));
  const courses = allItems("courses").map((course) => {
    const major = majorMap.get(course.majorId);
    if (!major) return null;
    const group = groupMap.get(major.groupId);
    return { ...course, groupId: group.id, deptId: group.deptId };
  }).filter(Boolean);

  const plans = PROGRAM_DATA.plans
    .filter((plan) => majorMap.has(plan.majorId) && !isHidden("majors", plan.majorId))
    .map((plan) => ({ ...plan, base: true }));

  const groupIdsByDept = new Map();
  const majorIdsByGroup = new Map();
  const courseIdsByMajor = new Map();
  for (const group of groups) {
    if (!groupIdsByDept.has(group.deptId)) groupIdsByDept.set(group.deptId, []);
    groupIdsByDept.get(group.deptId).push(group.id);
  }
  for (const major of majors) {
    if (!majorIdsByGroup.has(major.groupId)) majorIdsByGroup.set(major.groupId, []);
    majorIdsByGroup.get(major.groupId).push(major.id);
  }
  for (const course of courses) {
    if (!courseIdsByMajor.has(course.majorId)) courseIdsByMajor.set(course.majorId, []);
    courseIdsByMajor.get(course.majorId).push(course.id);
  }

  const finalDepartments = departments.map((dept) => ({
    ...dept,
    groupIds: groupIdsByDept.get(dept.id) || [],
    majorIds: groups.filter((group) => group.deptId === dept.id).flatMap((group) => majorIdsByGroup.get(group.id) || [])
  }));
  const finalGroups = groups.map((group) => ({
    ...group,
    majorIds: majorIdsByGroup.get(group.id) || []
  }));
  const finalMajors = majors.map((major) => ({
    ...major,
    courseIds: courseIdsByMajor.get(major.id) || [],
    planIds: plans.filter((plan) => plan.majorId === major.id).map((plan) => plan.id)
  }));
  const sourceMap = new Map(PROGRAM_DATA.sources.map((source) => [source.id, source]));
  const sources = PROGRAM_DATA.sources.map((source) => ({ ...source }));
  return {
    meta: PROGRAM_DATA.meta,
    notes: PROGRAM_DATA.notes,
    departments: finalDepartments,
    groups: finalGroups,
    majors: finalMajors,
    plans,
    courses,
    sources,
    sourceMap,
    counts: {
      departments: finalDepartments.length,
      groups: finalGroups.length,
      majors: finalMajors.length,
      plans: plans.length,
      courses: courses.length,
      uniqueCourseNames: new Set(courses.map((course) => course.name).filter(Boolean)).size,
      officialCourseIntros: courses.filter((course) => course.hasOfficialIntro).length,
      sources: sources.length
    }
  };
}

export function getProgramCounts() {
  return buildProgramCatalog().counts;
}

export function getProgramEntity(type, id) {
  return allItems(type).find((item) => item.id === id) || null;
}

export function getCourseResource(courseId) {
  return state.resources[courseId] || null;
}

export function listCourseResources() {
  return { ...state.resources };
}

function normalizePatch(type, patch) {
  const output = {};
  for (const key of EDITABLE[type] || []) {
    if (patch[key] === undefined) continue;
    output[key] = String(patch[key] ?? "").trim();
  }
  return output;
}

function customId(type) {
  return `custom-${type.slice(0, -1)}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function assertParent(type, parentId) {
  if (type === "departments") return null;
  const parentType = type === "groups" ? "departments" : type === "majors" ? "groups" : "majors";
  const parent = getProgramEntity(parentType, parentId);
  if (!parent) throw new Error("上级节点不存在或已被隐藏");
  return parent;
}

export async function addProgramEntity(type, parentId, payload = {}) {
  if (!TYPES.includes(type)) throw new Error("未知的数据类型");
  const parent = assertParent(type, parentId);
  const name = asText(payload.name);
  if (!name) throw new Error("名称为必填项");
  const id = customId(type);
  const base = {
    id,
    base: false,
    name,
    ...normalizePatch(type, payload)
  };
  if (type === "departments") {
    Object.assign(base, { kind: "自定义教学单位", groupIds: [], majorIds: [], sourceIds: [] });
    state.custom.departments.push(base);
  } else if (type === "groups") {
    Object.assign(base, { deptId: parent.id, kind: payload.kind || "自定义专业组", majorIds: [], sourceIds: [] });
    state.custom.groups.push(base);
  } else if (type === "majors") {
    Object.assign(base, {
      deptId: parent.deptId,
      groupId: parent.id,
      enrollment: "",
      duration: "",
      dataYear: new Date().getFullYear().toString(),
      status: "教师自建",
      sourceIds: [],
      sourceRaw: "",
      planIds: [],
      courseIds: [],
      isPublicFoundation: name.startsWith("公共基础课程")
    });
    state.custom.majors.push(base);
  } else {
    const parentMajor = parent;
    Object.assign(base, {
      deptId: parentMajor.deptId,
      groupId: parentMajor.groupId,
      majorId: parentMajor.id,
      displayName: name,
      category: payload.category || "教师自建课程",
      phase: payload.phase || "教师自建",
      intro: payload.intro || "",
      // A locally created course is teacher-authored, never an official
      // school course description, even when it has an introduction.
      hasOfficialIntro: false,
      dataYear: payload.dataYear || new Date().getFullYear().toString(),
      sourceIds: [],
      sourceRaw: "",
      recordType: "course",
      needsWork: !payload.intro
    });
    state.custom.courses.push(base);
  }
  await persist();
  return base;
}

export async function updateProgramEntity(type, id, patch) {
  if (!TYPES.includes(type)) throw new Error("未知的数据类型");
  const cleanPatch = normalizePatch(type, patch);
  const custom = state.custom[type].find((item) => item.id === id);
  if (custom) {
    Object.assign(custom, cleanPatch);
    if (type === "courses" && cleanPatch.name) custom.displayName = cleanPatch.name;
  } else if (isBaseProgramEntity(type, id)) {
    state.overrides[type][id] = { ...(state.overrides[type][id] || {}), ...cleanPatch };
  } else {
    throw new Error("记录不存在");
  }
  await persist();
  return getProgramEntity(type, id);
}

function directChildren(type, id) {
  const catalog = buildProgramCatalog();
  if (type === "departments") return { type: "groups", items: catalog.groups.filter((item) => item.deptId === id) };
  if (type === "groups") return { type: "majors", items: catalog.majors.filter((item) => item.groupId === id) };
  if (type === "majors") return { type: "courses", items: catalog.courses.filter((item) => item.majorId === id) };
  return { type: "", items: [] };
}

export async function deleteProgramEntity(type, id) {
  if (!TYPES.includes(type)) throw new Error("未知的数据类型");
  const entity = getProgramEntity(type, id);
  if (!entity) throw new Error("记录不存在");
  const children = directChildren(type, id);
  if (children.items.length) {
    const error = new Error(`该${type === "departments" ? "专业系" : type === "groups" ? "专业组" : "专业"}下还有 ${children.items.length} 条子记录，请先处理子记录`);
    error.code = "HAS_CHILDREN";
    throw error;
  }
  const customIndex = state.custom[type].findIndex((item) => item.id === id);
  if (customIndex >= 0) {
    state.custom[type].splice(customIndex, 1);
  } else {
    state.hidden[type] = Array.from(new Set([...(state.hidden[type] || []), id]));
  }
  await persist();
}

export async function restoreProgramEntity(type, id) {
  if (!TYPES.includes(type)) throw new Error("未知的数据类型");
  state.hidden[type] = (state.hidden[type] || []).filter((item) => item !== id);
  await persist();
}

export async function saveCourseResource(courseId, patch = {}) {
  const course = getProgramEntity("courses", courseId);
  if (!course) throw new Error("课程不存在");
  const clean = {};
  for (const key of RESOURCE_FIELDS) {
    if (patch[key] === undefined) continue;
    clean[key] = String(patch[key] ?? "").trim();
  }
  clean.updatedAt = new Date().toISOString();
  state.resources[courseId] = { ...(state.resources[courseId] || {}), ...clean };
  await persist();
  return state.resources[courseId];
}

export async function resetCourseResource(courseId) {
  delete state.resources[courseId];
  await persist();
}

export function exportProgramState() {
  return {
    schema: "shouyu.programs.v1",
    exportedAt: new Date().toISOString(),
    source: PROGRAM_DATA.meta.sourceFile,
    state: clone(state)
  };
}

export async function clearProgramStore() {
  state = emptyState();
  loaded = true;
  await persist();
  return state;
}

export async function importProgramState(payload) {
  const candidate = payload?.state || payload;
  if (!candidate || typeof candidate !== "object") throw new Error("备份格式不正确");
  state = normalizeState(candidate);
  loaded = true;
  await persist();
  return state;
}

export { PROGRAM_DATA };