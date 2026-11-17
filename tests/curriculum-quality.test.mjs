import test from "node:test";
import assert from "node:assert/strict";

import { PROGRAM_DATA } from "../js/programs-data.js";
import { buildProgramCatalog } from "../js/programs-store.js";
import { CURRICULUM_PACKS } from "../js/curriculum-data.js";
import { buildTeachingBundle } from "../js/teaching-engine.js";
import { inspectBundle, applyAutoFixes, qualityMarkdown } from "../js/quality-engine.js";

const catalog = buildProgramCatalog();
const representative = CURRICULUM_PACKS[0];

function makeBundle(overrides = {}) {
  return buildTeachingBundle({
    courseId: "course-0010",
    chapterId: "CH-PLC-01",
    taskId: "TASK-PLC-01",
    learners: "36 人",
    hours: 4,
    conditions: "PLC 实训室",
    ...overrides
  }, catalog);
}

test("代表课程知识包结构完整且来源可追溯", () => {
  assert.equal(representative.courseId, "course-0010");
  assert.equal(representative.chapters.length, 4);
  assert.equal(representative.tasks.length, 5);
  const points = representative.chapters.flatMap((chapter) => chapter.knowledgePoints || []);
  assert.equal(points.length, 15);
  assert.ok(points.every((point) => point.sourceRefs.length > 0));
  assert.ok(representative.officialBasis.sourceIds.includes("S2"));
  assert.match(representative.disclaimer, /不是广州市技师学院正式课程标准/);
  assert.equal(representative.status, "pending");
});

test("教学引擎生成共享上下文的 10 类资源", () => {
  const bundle = makeBundle();
  assert.equal(bundle.artifact.docs.length, 10);
  assert.equal(bundle.artifact.scene, "studio");
  assert.ok(bundle.artifact.sources.length >= 8);
  for (const doc of bundle.artifact.docs) {
    assert.ok(doc.title);
    assert.ok(doc.sections.length > 0);
    assert.ok(doc.meta.some((item) => item.label === "课程"));
    assert.ok(doc.meta.some((item) => item.label === "典型工作任务"));
  }
  assert.equal(new Set(bundle.artifact.docs.map((doc) => doc.id)).size, 10);
  assert.match(bundle.artifact.intro, /10 类教学资源/);
});

test("资源包引用可以解析到现有知识库章节", () => {
  const bundle = makeBundle();
  const refs = new Set(bundle.artifact.sources.map((source) => source.ref));
  assert.ok(refs.has("PK-PLC-01 §01"));
  assert.ok(refs.has("PK-PLC-02 §01"));
  assert.ok(refs.has("S2"));
  for (const doc of bundle.artifact.docs) {
    for (const section of doc.sections) {
      for (const ref of section.refs || []) {
        assert.ok(bundle.artifact.sources.some((source) => source.ref === ref), `${doc.id} 引用了未知来源 ${ref}`);
      }
    }
  }
});

test("质检返回 10 个可解释维度、证据和人工审核边界", () => {
  const bundle = makeBundle();
  const report = inspectBundle(bundle);
  assert.equal(report.dimensions.length, 10);
  assert.equal(report.overall, Math.min(report.rawOverall, 84));
  assert.ok(report.overall <= 84);
  assert.ok(report.dimensions.every((item) => item.score >= 0 && item.score <= 100));
  assert.ok(report.dimensions.every((item) => Array.isArray(item.problems)));
  assert.ok(report.problems.some((problem) => /待审核|审核/.test(problem.message)));
  assert.ok(report.summary.humanReview >= 1);
  assert.match(qualityMarkdown(bundle, report), /教学质量检测报告/);
});

test("跨文档一致性检查能定位任务名称不一致", () => {
  const bundle = makeBundle();
  const lesson = bundle.artifact.docs.find((doc) => doc.id === "lesson");
  lesson.title = "错误标题 · 另一个任务";
  lesson.meta = lesson.meta.map((item) => item.label === "典型工作任务" ? { ...item, value: "另一个任务" } : item);
  const report = inspectBundle(bundle);
  const consistency = report.dimensions.find((item) => item.id === "resource_consistency");
  assert.ok(consistency.score < 100);
  assert.ok(consistency.problems.some((problem) => /任务名称/.test(problem.message)));
});

test("评价权重异常时可以自动修复到 100 分", () => {
  const bundle = makeBundle();
  const evaluation = bundle.artifact.docs.find((doc) => doc.id === "evaluation");
  for (const section of evaluation.sections) {
    for (const block of section.blocks) {
      if (block.type !== "table") continue;
      for (const row of block.rows || []) {
        const index = row.findIndex((cell) => /%/.test(cell));
        if (index >= 0) row[index] = "10%";
      }
    }
  }
  const report = inspectBundle(bundle);
  assert.ok(report.dimensions.find((item) => item.id === "assessment_alignment").problems.length > 0);
  const fixed = applyAutoFixes(bundle, report);
  assert.ok(fixed.applied.some((item) => /权重/.test(item)));
  const after = inspectBundle(fixed.bundle);
  const afterRows = fixed.bundle.artifact.docs.find((doc) => doc.id === "evaluation").sections
    .flatMap((section) => section.blocks)
    .filter((block) => block.type === "table")
    .flatMap((block) => block.rows || [])
    .map((row) => (row.find((cell) => /%/.test(cell)) || "").replace(/[^\d.]/g, ""))
    .filter(Boolean)
    .map(Number);
  assert.equal(afterRows.reduce((sum, value) => sum + value, 0), 100);
  assert.equal(after.dimensions.find((item) => item.id === "assessment_alignment").score, 100);
});

test("没有课程知识包时降级为行业参考并限制评分", () => {
  const course = catalog.courses.find((item) => item.id === "course-0001");
  assert.ok(course);
  const bundle = buildTeachingBundle({
    courseId: course.id,
    learners: "40 人",
    hours: 4,
    conditions: "普通实训室"
  }, catalog);
  assert.equal(bundle.artifact.docs.length, 10);
  assert.equal(bundle.curriculumStatus, "reference");
  const report = inspectBundle(bundle);
  assert.ok(report.overall <= 72);
  assert.ok(bundle.artifact.intro.includes("10 类教学资源"));
});

test("原表来源编号错配被保留但不进入代表知识包", () => {
  const course = PROGRAM_DATA.courses.find((item) => item.id === "course-0010");
  const major = PROGRAM_DATA.majors.find((item) => item.id === course.majorId);
  const mismatched = course.sourceIds
    .map((id) => PROGRAM_DATA.sources.find((source) => source.id === id))
    .filter((source) => source && source.major && source.major !== major.name);
  assert.ok(mismatched.length > 0);
  assert.ok(mismatched.some((source) => source.id === "S20" || source.id === "S27"));
  assert.deepEqual(representative.officialBasis.sourceIds, ["S2", "S3"]);
  assert.equal(representative.officialBasis.sourceIds.includes("S20"), false);
  assert.equal(representative.officialBasis.sourceIds.includes("S27"), false);
});

test("默认质检权重合计为 100", async () => {
  const { DEFAULT_QUALITY_WEIGHTS } = await import("../js/quality-engine.js");
  assert.equal(Object.values(DEFAULT_QUALITY_WEIGHTS).reduce((sum, value) => sum + value, 0), 100);
});

test("原始表课程记录与代表课程来自同一专业库", () => {
  const course = PROGRAM_DATA.courses.find((item) => item.id === "course-0010");
  assert.ok(course);
  assert.equal(course.name, "PLC技术及应用");
  assert.equal(course.majorId, representative.majorId);
  assert.equal(course.sourceIds.includes("S2"), false); // S2/S3 are official major sources, not course-row refs
  assert.ok(representative.officialBasis.sourceIds.includes("S2"));
});