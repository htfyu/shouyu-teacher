/**
 * 授课记录：只保存教师真实录入的课堂事实。
 * 不保存学生姓名、学号、联系方式；没有数据时返回空数组。
 */

export const TEACHING_STORE_KEY = "shouyu.teaching.v1";

function storage() {
  try {
    return globalThis.localStorage || null;
  } catch (error) {
    return null;
  }
}

function readAll() {
  const store = storage();
  if (!store) return [];
  try {
    const parsed = JSON.parse(store.getItem(TEACHING_STORE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter(isRecordLike) : [];
  } catch (error) {
    return [];
  }
}

function writeAll(records) {
  const store = storage();
  if (!store) return false;
  try {
    store.setItem(TEACHING_STORE_KEY, JSON.stringify(records));
    return true;
  } catch (error) {
    return false;
  }
}

function isRecordLike(record) {
  return Boolean(record && typeof record === "object" && record.id && record.courseId);
}

function text(value, max = 4000) {
  return String(value == null ? "" : value).trim().slice(0, max);
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function normalize(input, previous = null) {
  const now = new Date().toISOString();
  return {
    id: previous?.id || `teach-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    courseId: text(input.courseId, 160),
    courseTitle: text(input.courseTitle, 200),
    chapterId: text(input.chapterId, 160),
    chapterTitle: text(input.chapterTitle, 200),
    taskId: text(input.taskId, 160),
    taskTitle: text(input.taskTitle, 200),
    projectId: text(input.projectId, 160),
    projectTitle: text(input.projectTitle, 240),
    projectVersion: text(input.projectVersion, 40),
    date: text(input.date, 20) || now.slice(0, 10),
    className: text(input.className, 80),
    learners: numberOrNull(input.learners),
    hours: numberOrNull(input.hours),
    resourceVersion: text(input.resourceVersion, 80),
    summary: text(input.summary, 4000),
    reflection: text(input.reflection, 4000),
    createdAt: previous?.createdAt || now,
    updatedAt: now
  };
}

export function getTeachingRecords() {
  return readAll().sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")) || String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
}

export function getTeachingRecord(id) {
  return readAll().find((record) => record.id === id) || null;
}

export function teachingRecordsForCourse(courseId) {
  return getTeachingRecords().filter((record) => record.courseId === courseId);
}

export function upsertTeachingRecord(input) {
  if (!input?.courseId) throw new Error("授课记录必须关联课程");
  const records = readAll();
  const previous = input.id ? records.find((record) => record.id === input.id) : null;
  const record = normalize(input, previous);
  const next = previous
    ? records.map((item) => (item.id === previous.id ? record : item))
    : [record, ...records];
  if (!writeAll(next)) throw new Error("无法写入本机授课记录");
  return record;
}

export function deleteTeachingRecord(id) {
  const records = readAll();
  const next = records.filter((record) => record.id !== id);
  if (next.length === records.length) return false;
  return writeAll(next);
}

export function exportTeachingState() {
  return {
    version: 1,
    records: getTeachingRecords()
  };
}

export function importTeachingState(state) {
  const records = Array.isArray(state?.records) ? state.records.filter(isRecordLike) : [];
  return writeAll(records);
}

export function clearTeachingStore() {
  return writeAll([]);
}

export function teachingRecordStats(courseId) {
  const records = teachingRecordsForCourse(courseId);
  return {
    total: records.length,
    latestDate: records[0]?.date || "",
    totalHours: records.reduce((sum, record) => sum + (Number(record.hours) || 0), 0)
  };
}