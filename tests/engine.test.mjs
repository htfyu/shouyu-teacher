import test from "node:test";
import assert from "node:assert/strict";
import {
  generate,
  chatReply,
  retrieve
} from "../js/engine.js";
import {
  KB_DOCS,
  MAJORS,
  SPECIALTY_PACKS,
  getKnowledgeCategories,
  totalSections
} from "../js/knowledge.js";

const lessonParams = {
  major: "电气自动化设备安装与维修",
  course: "电动机控制线路安装与调试",
  task: "三相异步电动机正反转控制线路安装与调试",
  lessonType: "一体化",
  hours: "4",
  learners: "学生已学习安全用电与基本接线，但对接线工艺和互锁逻辑不熟；40 人，8 组，8 台套。",
  resources: "电工实训台 8 台，三相异步电动机 8 台，交流接触器、热继电器、按钮盒、熔断器、导线、万用表。",
  notes: "按工作任务组织教学，突出接线工艺、互锁验证和安全规范。",
  template: "standard"
};

test("12 个专业包已注册，知识库不少于 33 份 / 147 节", () => {
  assert.equal(SPECIALTY_PACKS.length, 12);
  assert.ok(KB_DOCS.length >= 33);
  assert.ok(totalSections() >= 147);
  assert.ok(MAJORS.includes("PLC 技术"));
  const cats = getKnowledgeCategories();
  for (const name of ["电气自动化", "PLC 技术", "数控技术", "汽车维修", "工业机器人", "机械加工", "焊接技术", "电子技术", "计算机技术", "建筑工程", "化工技术", "新能源技术"]) {
    assert.ok(cats.some((category) => category.includes(name)), `缺少专业分类 ${name}`);
  }
});

test("五个本地场景均可生成结构化成果", () => {
  const cases = [
    ["lesson", { ...lessonParams }],
    ["materials", { ...lessonParams, materialsOutput: "both" }],
    ["evaluate", { ...lessonParams, evalTemplate: "process" }],
    ["safety", { venue: "电工实训室", operation: "上电前检查", audience: "学生", focus: "上电与接线安全" }],
    ["observe", {
      course: "电动机控制线路安装与调试",
      task: "听课记录",
      observation: "教师用视频导入约五分钟，学生分组接线，教师巡视两次，最后口头点评两组，未使用评分表，工具未归位。",
      focus: "评价反馈",
      observationTemplate: "evidence"
    }]
  ];
  for (const [scene, params] of cases) {
    const result = generate(scene, params);
    assert.ok(result.artifact.docs.length >= 1, `${scene} 没有文档`);
    assert.ok(result.artifact.docs.every((doc) => doc.sections.length >= 4), `${scene} 模块过少`);
    assert.ok(result.sources.length >= 0);
    assert.ok(result.feedbackPrompt || result.suggestions || result.workflow);
  }
});

test("任务驱动简案与标准教案存在结构差异", () => {
  const standard = generate("lesson", { ...lessonParams, template: "standard" });
  const compact = generate("lesson", { ...lessonParams, template: "task-driven" });
  assert.ok(standard.artifact.docs[0].sections.length > compact.artifact.docs[0].sections.length);
  assert.match(compact.artifact.template, /简案/);
});

test("安全查询明确区分电工 / PLC 与其他场所", () => {
  const supported = chatReply("电工实训室上电前要确认什么？", {});
  assert.ok(supported.sources.length > 0);
  const unsupported = chatReply("数控实训室上电前要检查什么？", {});
  assert.equal(unsupported.tag, "知识库未覆盖");
  assert.match(unsupported.text, /没有收录|操作级/);
});

test("超范围问题不会返回无关知识库片段", () => {
  for (const question of [
    "帮我预测哪个学生考不上",
    "学生上课总睡觉，怎么管？",
    "帮我批改作业",
    "帮我出一套期末试卷",
    "帮我排课程表",
    "帮我做一份班会 PPT",
    "帮我分析这次考试成绩"
  ]) {
    const reply = chatReply(question, {});
    assert.ok(reply.tag, `${question} 缺少边界标签`);
    assert.equal(reply.sources.length, 0, `${question} 不应带知识库来源`);
  }
});

test("检索覆盖 12 个专业方向的关键概念", () => {
  const probes = ["数控对刀", "机器人示教", "焊接防护", "光伏组件巡检", "化工溶液配制", "建筑施工测量", "PLC 顺序控制", "汽车制动检修"];
  for (const query of probes) {
    const result = retrieve(query, { limit: 3 });
    assert.ok(result.results.length >= 1, `${query} 无检索结果`);
    assert.ok(result.results[0].ref.startsWith("PK-"), `${query} 未命中专业包`);
  }
});

test("引用格式与来源字段完整", () => {
  const result = generate("lesson", lessonParams);
  for (const source of result.sources) {
    assert.match(source.ref, /^(KB-\d{2}|PK-[A-Z]+-\d{2}) §\d{2}$/);
    assert.ok(source.docTitle && source.sectionTitle && source.snippet);
    assert.ok(source.key);
  }
  for (const doc of result.artifact.docs) {
    for (const section of doc.sections) {
      assert.match(section.no, /^\d{2}$/);
      assert.ok(Array.isArray(section.refs));
      assert.ok(Array.isArray(section.blocks));
    }
  }
});