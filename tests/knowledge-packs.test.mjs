import test from "node:test";
import assert from "node:assert/strict";
import {
  SPECIALTY_PACKS,
  PACK_DOCS,
  getPackDocsBySpecialty
} from "../js/knowledge-packs.js";

const SPECIALTIES = [
  "电气自动化",
  "PLC 技术",
  "数控技术",
  "汽车维修",
  "工业机器人",
  "机械加工",
  "焊接技术",
  "电子技术",
  "计算机技术",
  "建筑工程",
  "化工技术",
  "新能源技术"
];

const REQUIRED_DOC_FIELDS = [
  "id",
  "title",
  "specialty",
  "category",
  "course",
  "summary",
  "tags",
  "source",
  "author",
  "published",
  "version",
  "updated",
  "scope",
  "sections"
];

function cjkCount(value) {
  return (String(value ?? "").match(/[\u3400-\u9fff]/g) || []).length;
}

function docCjkCount(doc) {
  const values = [
    doc.title,
    doc.course,
    doc.summary,
    doc.scope,
    ...doc.tags,
    ...doc.sections.flatMap((section) => [
      section.title,
      section.text,
      ...section.bullets
    ])
  ];
  return values.reduce((sum, value) => sum + cjkCount(value), 0);
}

test("模块可以被 Node 直接 import，且基础导出存在", () => {
  assert.ok(Array.isArray(SPECIALTY_PACKS));
  assert.ok(Array.isArray(PACK_DOCS));
  assert.equal(typeof getPackDocsBySpecialty, "function");
});

test("覆盖 12 个专业，每包至少 2 份文档，总数为 24—30", () => {
  assert.equal(SPECIALTY_PACKS.length, 12);
  assert.deepEqual(
    SPECIALTY_PACKS.map((pack) => pack.name),
    SPECIALTIES
  );
  assert.ok(PACK_DOCS.length >= 24 && PACK_DOCS.length <= 30);
  assert.equal(PACK_DOCS.length, SPECIALTY_PACKS.reduce((sum, pack) => sum + pack.docs.length, 0));

  for (const pack of SPECIALTY_PACKS) {
    assert.ok(pack.id && typeof pack.id === "string", `${pack.name} 缺少 pack.id`);
    assert.ok(pack.description && pack.description.length >= 20, `${pack.name} 描述过短`);
    assert.ok(pack.docs.length >= 2, `${pack.name} 少于 2 份文档`);
  }
});

test("每份文档字段完整，课程、标签和适用范围可检索", () => {
  for (const doc of PACK_DOCS) {
    for (const field of REQUIRED_DOC_FIELDS) {
      assert.ok(field in doc, `${doc.id || "未知文档"} 缺少字段 ${field}`);
    }
    assert.match(doc.id, /^PK-[A-Z]+-\d{2}$/);
    assert.ok(SPECIALTIES.includes(doc.specialty), `${doc.id} specialty 不合法`);
    assert.equal(doc.category, `专业·${doc.specialty}`);
    assert.ok(doc.title.length >= 6, `${doc.id} 标题过短`);
    assert.ok(doc.course.length >= 4, `${doc.id} 课程过短`);
    assert.ok(doc.summary.length >= 20, `${doc.id} 摘要过短`);
    assert.ok(Array.isArray(doc.tags) && doc.tags.length >= 3, `${doc.id} 标签不足`);
    assert.ok(doc.tags.every((tag) => typeof tag === "string" && tag.trim()), `${doc.id} 标签需为非空字符串`);
    assert.equal(doc.source, "校本示例 · 教学团队整理");
    assert.equal(doc.author, "授渔教研示例");
    assert.match(doc.published, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(doc.updated, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(doc.version, "校本示例 v1.0");
    assert.match(doc.scope, /适用于/);
    assert.match(doc.scope, /(为准|不替代)/);
  }
});

test("文档和章节 ID 全局唯一，章节结构可兼容 KB_DOCS", () => {
  const docIds = new Set();
  const sectionIds = new Set();

  for (const doc of PACK_DOCS) {
    assert.ok(!docIds.has(doc.id), `重复 doc.id：${doc.id}`);
    docIds.add(doc.id);

    assert.ok(doc.sections.length >= 3 && doc.sections.length <= 4, `${doc.id} 章节数应为 3—4`);
    const sectionNos = new Set();

    for (const section of doc.sections) {
      assert.ok(section.id, `${doc.id} 存在无 id 的章节`);
      assert.ok(!sectionIds.has(section.id), `重复 section.id：${section.id}`);
      sectionIds.add(section.id);
      assert.ok(section.id.startsWith(`${doc.id}-`), `${section.id} 与 doc.id 不匹配`);
      assert.ok(!sectionNos.has(section.no), `${doc.id} 存在重复章节号 ${section.no}`);
      sectionNos.add(section.no);
      assert.match(section.no, /^\d{2}$/);
      assert.ok(section.title.length >= 4, `${section.id} 章节标题过短`);
      assert.ok(typeof section.text === "string" && cjkCount(section.text) >= 50, `${section.id} 正文过短`);
      assert.ok(Array.isArray(section.bullets) && section.bullets.length >= 2, `${section.id} 缺少 bullets`);
      for (const bullet of section.bullets) {
        assert.ok(typeof bullet === "string" && cjkCount(bullet) >= 8, `${section.id} 存在过短的 bullet`);
      }
    }
  }

  assert.equal(docIds.size, PACK_DOCS.length);
  assert.equal(sectionIds.size, PACK_DOCS.reduce((sum, doc) => sum + doc.sections.length, 0));
});

test("每份文档约 400—900 个汉字，并包含教学支持、安全或评价内容", () => {
  for (const doc of PACK_DOCS) {
    const count = docCjkCount(doc);
    assert.ok(count >= 400 && count <= 900, `${doc.id} 汉字数为 ${count}，超出 400—900`);

    const allText = doc.sections.map((section) => `${section.title}\n${section.text}\n${section.bullets.join("\n")}`).join("\n");
    assert.match(allText, /(任务|流程|工作页|教案|教学|操作|编程|巡检|砌筑|配制)/, `${doc.id} 缺少教学任务线索`);
    assert.match(allText, /(安全|防护|应急|隔离|合规|评价|证据|验收|记录)/, `${doc.id} 缺少安全或评价线索`);

    const safetySections = doc.sections.filter((section) =>
      /(安全|防护|应急|隔离|合规)/.test(`${section.title}\n${section.text}`)
    );
    assert.ok(safetySections.length >= 1, `${doc.id} 缺少安全/合规章节`);
    const supportedSafetySections = safetySections.filter((section) => {
      const safetyText = `${section.text}\n${section.bullets.join("\n")}`;
      return /(规程|制度|说明书|手册|预案|许可)/.test(safetyText)
        && /(为准|执行|遵守|报告)/.test(safetyText);
    });
    assert.ok(supportedSafetySections.length >= 1, `${doc.id} 的安全内容未清楚指向现场依据与执行要求`);
  }
});

test("没有编造的标准号或官方文件号", () => {
  const bannedPatterns = [
    /\bGB\s*\/?\s*T?\s*\d+/i,
    /\bAQ\s*\d+/i,
    /\bISO\s*\d+/i,
    /\bIEC\s*\d+/i,
    /\b(?:JB|HG|JGJ|JTG|TSG|DL|SY)\s*\d+/i,
    /〔\d{4}〕\s*\d+\s*号/,
    /(?:国家标准|行业标准|企业标准)\s*(?:编号|号)\s*[:：]?\s*\d+/i
  ];

  for (const doc of PACK_DOCS) {
    const text = JSON.stringify(doc);
    for (const pattern of bannedPatterns) {
      assert.doesNotMatch(text, pattern, `${doc.id} 出现疑似编造标准号：${pattern}`);
    }
    assert.doesNotMatch(text, /官方文件号\s*[:：]?\s*\d+/, `${doc.id} 出现官方文件号`);
  }
});

test("getPackDocsBySpecialty 能按专业查询，也能安全处理未知专业", () => {
  for (const name of SPECIALTIES) {
    const docs = getPackDocsBySpecialty(name);
    assert.equal(docs.length, 2, `${name} 查询结果不正确`);
    assert.ok(docs.every((doc) => doc.specialty === name));
  }

  assert.deepEqual(getPackDocsBySpecialty("不存在的专业"), []);
  assert.deepEqual(getPackDocsBySpecialty(""), []);
  assert.deepEqual(getPackDocsBySpecialty(null), []);
});

test("PACK_DOCS 是各专业包的扁平文档集合", () => {
  const expected = SPECIALTY_PACKS.flatMap((pack) => pack.docs);
  assert.equal(PACK_DOCS.length, expected.length);
  assert.deepEqual(
    PACK_DOCS.map((doc) => doc.id),
    expected.map((doc) => doc.id)
  );
});