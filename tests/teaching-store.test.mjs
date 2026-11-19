import test from "node:test";
import assert from "node:assert/strict";

const memory = new Map();
globalThis.localStorage = {
  getItem(key) {
    return memory.has(key) ? memory.get(key) : null;
  },
  setItem(key, value) {
    memory.set(key, String(value));
  },
  removeItem(key) {
    memory.delete(key);
  }
};

const {
  clearTeachingStore,
  deleteTeachingRecord,
  exportTeachingState,
  getTeachingRecord,
  getTeachingRecords,
  importTeachingState,
  teachingRecordStats,
  teachingRecordsForCourse,
  upsertTeachingRecord
} = await import("../js/teaching-store.js");

test("teaching records: empty store is honest", () => {
  assert.deepEqual(getTeachingRecords(), []);
  assert.equal(teachingRecordStats("course-x").total, 0);
});

test("teaching records: create, filter and aggregate", () => {
  const record = upsertTeachingRecord({
    courseId: "course-x",
    courseTitle: "测试课程",
    chapterTitle: "第一章",
    taskTitle: "任务一",
    date: "2026-11-19",
    className: "24 测试班",
    learners: "36",
    hours: "4",
    summary: "学生完成断电验电和基础接线，第二组出现互锁错误。",
    reflection: "下次增加互锁原理的对照练习。"
  });
  assert.ok(record.id.startsWith("teach-"));
  assert.equal(record.learners, 36);
  assert.equal(getTeachingRecords().length, 1);
  assert.equal(teachingRecordsForCourse("course-x").length, 1);
  assert.equal(teachingRecordsForCourse("course-y").length, 0);
  assert.equal(teachingRecordStats("course-x").totalHours, 4);
});

test("teaching records: update preserves identity and delete removes only one", () => {
  const first = getTeachingRecords()[0];
  const updated = upsertTeachingRecord({
    ...first,
    summary: "补充：第三组完成线序测试，记录异常并返工。"
  });
  assert.equal(updated.id, first.id);
  assert.equal(updated.createdAt, first.createdAt);
  assert.match(getTeachingRecord(first.id).summary, /线序测试/);

  const second = upsertTeachingRecord({
    courseId: "course-x",
    date: "2026-11-20",
    className: "24 测试班",
    summary: "第二次课堂记录。"
  });
  assert.equal(getTeachingRecords().length, 2);
  assert.equal(deleteTeachingRecord(second.id), true);
  assert.equal(getTeachingRecords().length, 1);
  assert.equal(deleteTeachingRecord("missing"), false);
});

test("teaching records: export/import and clear stay compatible", () => {
  const exported = exportTeachingState();
  assert.equal(exported.version, 1);
  assert.equal(exported.records.length, 1);

  clearTeachingStore();
  assert.equal(getTeachingRecords().length, 0);

  importTeachingState(exported);
  assert.equal(getTeachingRecords().length, 1);
  assert.match(getTeachingRecords()[0].summary, /线序测试/);

  importTeachingState({ records: [{ bad: true }] });
  assert.equal(getTeachingRecords().length, 0);
});

test("teaching records: storage failure is actionable", () => {
  const original = globalThis.localStorage.setItem;
  globalThis.localStorage.setItem = () => { throw new Error("quota"); };
  try {
    assert.throws(
      () => upsertTeachingRecord({ courseId: "course-x", summary: "写入失败测试。" }),
      /授课记录未能写入/
    );
  } finally {
    globalThis.localStorage.setItem = original;
  }
});

test("teaching records: rejects records without a course", () => {
  assert.throws(() => upsertTeachingRecord({ summary: "无课程" }), /关联课程/);
});