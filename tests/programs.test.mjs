import test from "node:test";
import assert from "node:assert/strict";

import { PROGRAM_DATA } from "../js/programs-data.js";
import { buildProgramCatalog } from "../js/programs-store.js";
import { buildCourseResource, detectDomain } from "../js/programs-content.js";

const catalog = buildProgramCatalog();

test("专业体系四层数据与原始表计数一致", () => {
  assert.equal(catalog.departments.length, 6);
  assert.equal(catalog.groups.length, 13);
  assert.equal(catalog.majors.length, 56);
  assert.equal(catalog.plans.length, 75);
  assert.equal(catalog.courses.length, 567);
  assert.equal(catalog.sources.length, 134);
  assert.equal(catalog.counts.uniqueCourseNames, 484);
  assert.equal(catalog.counts.officialCourseIntros, 13);
});

test("所有课程、招生计划和专业都保持父级关联", () => {
  const majorIds = new Set(catalog.majors.map((major) => major.id));
  const groupIds = new Set(catalog.groups.map((group) => group.id));
  const deptIds = new Set(catalog.departments.map((dept) => dept.id));
  for (const course of catalog.courses) {
    assert.ok(majorIds.has(course.majorId), `${course.id} 缺少专业`);
    assert.ok(groupIds.has(course.groupId), `${course.id} 缺少专业组`);
    assert.ok(deptIds.has(course.deptId), `${course.id} 缺少专业系`);
  }
  for (const plan of catalog.plans) assert.ok(majorIds.has(plan.majorId));
  for (const major of catalog.majors) {
    assert.ok(groupIds.has(major.groupId));
    assert.ok(deptIds.has(major.deptId));
  }
  assert.equal(catalog.majors.reduce((sum, major) => sum + major.courseIds.length, 0), 567);
  assert.equal(catalog.majors.reduce((sum, major) => sum + major.planIds.length, 0), 75);
});

test("原表来源编号均可在来源表中找到", () => {
  const sourceIds = new Set(catalog.sources.map((source) => source.id));
  for (const course of catalog.courses) {
    for (const id of course.sourceIds) assert.ok(sourceIds.has(id), `${course.id} 引用了不存在的 ${id}`);
  }
  for (const major of catalog.majors) {
    for (const id of major.sourceIds) assert.ok(sourceIds.has(id), `${major.id} 引用了不存在的 ${id}`);
  }
});

test("公共基础课程条与未归组记录均保留", () => {
  const publicMajors = catalog.majors.filter((major) => major.isPublicFoundation);
  assert.equal(publicMajors.length, 2);
  assert.ok(catalog.groups.some((group) => group.name.includes("未纳入现行专业群")));
  assert.ok(catalog.courses.some((course) => course.name === "电工技术"));
});

test("课程领域识别优先使用课程名而不是专业行业描述", () => {
  const course = catalog.courses.find((item) => item.name === "电工技术");
  const major = catalog.majors.find((item) => item.id === course.majorId);
  const group = catalog.groups.find((item) => item.id === course.groupId);
  const department = catalog.departments.find((item) => item.id === course.deptId);
  assert.equal(detectDomain(course, major, group, department), "electrical");

  const auto = catalog.courses.find((item) => item.name.includes("汽车检测"));
  if (auto) {
    const autoMajor = catalog.majors.find((item) => item.id === auto.majorId);
    const autoGroup = catalog.groups.find((item) => item.id === auto.groupId);
    const autoDept = catalog.departments.find((item) => item.id === auto.deptId);
    assert.equal(detectDomain(auto, autoMajor, autoGroup, autoDept), "automotive");
  }
});

test("课程资源包含明确的官方/参考/待完善分层", () => {
  const official = catalog.courses.find((course) => course.hasOfficialIntro);
  assert.ok(official);
  const officialView = buildCourseResource(official, catalog);
  assert.equal(officialView.officialIntro, official.intro);
  assert.equal(officialView.fields.length, 10);
  assert.ok(officialView.fields.some((field) => field.kind === "official"));
  assert.match(officialView.disclaimer, /不是广州市技师学院官方/);

  const pending = catalog.courses.find((course) => !course.hasOfficialIntro && course.recordType === "course");
  assert.ok(pending);
  const pendingView = buildCourseResource(pending, catalog);
  assert.ok(pendingView.fields.every((field) => !field.isOfficial));
  assert.ok(pendingView.fields[0].content);
});

test("课程资源校订覆盖生成内容并保留教师标记", () => {
  const course = catalog.courses.find((item) => item.name === "电工技术");
  const custom = {
    intro: "教师校订简介",
    status: "教师已校核"
  };
  const view = buildCourseResource(course, catalog, custom);
  assert.equal(view.status, "教师已校核");
  assert.equal(view.fields.find((field) => field.key === "intro").kind, "teacher");
  assert.equal(view.fields.find((field) => field.key === "intro").content, "教师校订简介");
});

test("全部 567 条课程记录都能生成 10 个资源模块", () => {
  for (const course of catalog.courses) {
    const view = buildCourseResource(course, catalog);
    assert.equal(view.fields.length, 10, `${course.id} 模块数不正确`);
    assert.ok(view.fields.every((field) => field.content), `${course.id} 存在空模块`);
    assert.ok(view.disclaimer.includes("不是广州市技师学院官方"));
  }
});

test("原始数据说明与统计口径被保留", () => {
  assert.ok(PROGRAM_DATA.notes.length >= 10);
  assert.ok(PROGRAM_DATA.notes.some((note) => /课程数据完整性/.test(note.title)));
  assert.equal(PROGRAM_DATA.meta.workbookSummary.majors, "54");
  assert.equal(PROGRAM_DATA.meta.counts.majors, 56);
});