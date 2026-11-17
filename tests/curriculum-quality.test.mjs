import test from "node:test";
import assert from "node:assert/strict";

import { PROGRAM_DATA } from "../js/programs-data.js";
import { buildProgramCatalog } from "../js/programs-store.js";
import { CURRICULUM_PACKS, SOURCE_CORRECTIONS } from "../js/curriculum-data.js";
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

test("三个不同专业方向的标杆课程包均有章节、知识点、任务和来源", () => {
  assert.equal(CURRICULUM_PACKS.length, 3);
  for (const pack of CURRICULUM_PACKS) {
    assert.ok(pack.chapters.length >= 4, `${pack.id} 章节不足`);
    assert.equal(pack.tasks.length, 5, `${pack.id} 任务数`);
    const points = pack.chapters.flatMap((chapter) => chapter.knowledgePoints || []);
    assert.ok(points.length >= 15, `${pack.id} 知识点不足`);
    assert.ok(points.every((point) => point.sourceRefs.length > 0), `${pack.id} 存在无来源知识点`);
    assert.ok(pack.officialBasis.sourceIds.length > 0);
    assert.ok(pack.reviewStatus);
    assert.ok(pack.version);
    assert.ok(pack.updatedAt);
    assert.match(pack.disclaimer, /不是广州市技师学院正式课程标准/);
  }
  assert.ok(new Set(CURRICULUM_PACKS.map((pack) => pack.majorId)).size >= 2);
});

test("来源核验记录保留原值并给出修订依据", () => {
  assert.equal(SOURCE_CORRECTIONS.length, 3);
  const robot = SOURCE_CORRECTIONS.find((item) => item.courseId === "course-0035");
  assert.deepEqual(robot.original, ["S1", "S24", "S27"]);
  assert.deepEqual(robot.corrected, ["S1", "S6", "S7", "S8"]);
  assert.equal(robot.status, "recommended");
  const nev = SOURCE_CORRECTIONS.find((item) => item.courseId === "course-0111");
  assert.deepEqual(nev.corrected, ["S1", "S20", "S21", "S22"]);
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
assert.equal(report.layers.structural.id, "structural");
assert.equal(report.layers.knowledge.id, "knowledge");
assert.equal(report.layers.expert.approved, false);
assert.equal(report.metrics.factVerified, false);
assert.ok(report.layers.knowledge.reviewItems.length > 0);
assert.match(qualityMarkdown(bundle, report), /来源覆盖率.*不代表事实正确率/);
});

test("教师专家审核与知识包审核共同决定事实认证状态", () => {
  const bundle = makeBundle();
  bundle.curriculumStatus = "approved";
  bundle.context.reviewStatus = "已审核";
  bundle.expertReview = { status: "approved", reviewer: "机电教研组", reviewedAt: "2026-11-17", items: [] };
  const report = inspectBundle(bundle);
  assert.equal(report.layers.expert.approved, true);
  assert.equal(report.metrics.factVerified, true);
  assert.equal(report.reviewCap, 100);
  assert.equal(report.statusLabel, "待最终确认");

  const pending = makeBundle();
  pending.expertReview = { status: "approved", reviewer: "机电教研组", items: [] };
  const pendingReport = inspectBundle(pending);
  assert.equal(pendingReport.metrics.factVerified, false);
  assert.equal(pendingReport.reviewCap, 84);
  assert.equal(pendingReport.statusLabel, "知识包待教研组审核");
  assert.notEqual(pendingReport.statusLabel, "已通过专家认证");
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

test("专业参数缺少来源时进入教师审核项而不是自动判对", () => {
  const bundle = makeBundle();
  const info = bundle.artifact.docs.find((doc) => doc.id === "infopage");
  info.sections[0].blocks.push({ type: "paragraph", text: "现场设备额定电压 24V，参数以铭牌为准。" });
  const report = inspectBundle(bundle);
  const parameterItem = report.layers.knowledge.reviewItems.find((item) => item.type === "参数");
  assert.ok(parameterItem);
  assert.match(parameterItem.label, /24V/);
  assert.equal(report.metrics.factVerified, false);
});

test("知识点缺少来源时知识点来源覆盖下降并列入审核", () => {
  const bundle = makeBundle();
  bundle.knowledge.knowledgePoints[0].sourceRefs = [];
  const report = inspectBundle(bundle);
  assert.ok(report.layers.knowledge.sourceCoverage < 100);
  assert.ok(report.layers.knowledge.reviewItems.some((item) => item.type === "来源"));
});

test("跨文档时间冲突能定位到教案阶段分钟", () => {
  const bundle = makeBundle();
  const lesson = bundle.artifact.docs.find((doc) => doc.id === "lesson");
  for (const section of lesson.sections) {
    for (const block of section.blocks) {
      if (block.type !== "table") continue;
      for (const row of block.rows || []) {
        if (/分钟/.test(String(row[1] || ""))) row[1] = "10 分钟";
      }
    }
  }
  const report = inspectBundle(bundle);
  const consistency = report.dimensions.find((item) => item.id === "resource_consistency");
  assert.ok(consistency.problems.some((problem) => /阶段时间合计/.test(problem.message)));
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

test("演示成果带 demo 标记，行业参考不会伪装成真实成果", () => {
  const demo = makeBundle();
  assert.equal(demo.demo, true);
  assert.equal(demo.sourceLabel, "教师教学资料 / 校本示例");
  const generic = buildTeachingBundle({ courseId: "course-0001", learners: "36 人", hours: 4 }, catalog);
  assert.equal(generic.demo, false);
  assert.equal(generic.curriculumStatus, "reference");
  assert.match(generic.sourceLabel, /行业通用参考/);
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