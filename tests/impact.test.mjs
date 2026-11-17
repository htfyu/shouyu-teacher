import test from "node:test";
import assert from "node:assert/strict";

import {
  aggregateImpact,
  anonymizeImpactRecords,
  impactToCSV,
  validateImpactRecord
} from "../js/impact-engine.js";

function record(overrides = {}) {
  return {
    id: "impact-1",
    teacherAlias: "机电-教师A",
    courseName: "PLC技术及应用",
    trialDate: "2026-11-17",
    baselineMinutes: 240,
    assistedMinutes: 90,
    generatedResources: 10,
    manualEditRatio: 35,
    teacherRating: 4,
    expertResult: "有条件通过",
    expertReviewer: "机电教研组",
    notes: "含教师张三，仅本机",
    measuredAt: "2026-11-17T10:00:00.000Z",
    ...overrides
  };
}

test("真实成效记录校验拒绝缺失/越界数据", () => {
  assert.equal(validateImpactRecord(record()).ok, true);
  const bad = validateImpactRecord({ ...record(), baselineMinutes: 0, manualEditRatio: 120, teacherRating: 9 });
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.some((message) => /传统备课时间/.test(message)));
  assert.ok(bad.errors.some((message) => /人工修改比例/.test(message)));
  assert.ok(bad.errors.some((message) => /教师评价/.test(message)));
});

test("没有数据时聚合显示未采集，而不是 0 或模拟值", () => {
  const empty = aggregateImpact([]);
  assert.equal(empty.hasData, false);
  assert.equal(empty.averageBaseline, null);
  assert.equal(empty.averageSaved, null);
  assert.equal(empty.participants, 0);
});

test("聚合只统计真实记录并计算节省时间/比例", () => {
  const aggregate = aggregateImpact([
    record(),
    record({ id: "impact-2", teacherAlias: "交通-教师B", courseName: "新能源汽车底盘与维修", baselineMinutes: 300, assistedMinutes: 120, manualEditRatio: 40, teacherRating: 5, generatedResources: 10, expertResult: "通过" })
  ]);
  assert.equal(aggregate.hasData, true);
  assert.equal(aggregate.recordCount, 2);
  assert.equal(aggregate.participants, 2);
  assert.equal(aggregate.courses, 2);
  assert.equal(aggregate.resources, 20);
  assert.equal(aggregate.averageBaseline, 270);
  assert.equal(aggregate.averageAssisted, 105);
  assert.equal(aggregate.averageSaved, 165);
  assert.equal(aggregate.averageSavedRate, 61);
  assert.equal(aggregate.averageManualRatio, 38);
  assert.equal(aggregate.averageRating, 5);
  assert.equal(aggregate.expertApproved, 2);
});

test("匿名导出替换教师代号并清空备注/审核人，不改原始记录", () => {
  const source = [record(), record({ id: "impact-2", teacherAlias: "交通-教师B" })];
  const before = JSON.stringify(source);
  const anonymous = anonymizeImpactRecords(source);
  assert.equal(anonymous[0].teacherAlias, "教师01");
  assert.equal(anonymous[1].teacherAlias, "教师02");
  assert.equal(anonymous[0].notes, "");
  assert.equal(anonymous[0].expertReviewer, "");
  assert.equal(anonymous[0].anonymized, true);
  assert.equal(JSON.stringify(source), before);
});

test("CSV 导出包含真实字段和中文表头", () => {
  const csv = impactToCSV([record()]);
  const lines = csv.split("\r\n");
  assert.match(lines[0], /教师匿名代号/);
  assert.match(lines[0], /传统备课（分钟）/);
  assert.match(lines[1], /机电-教师A/);
  assert.match(lines[1], /PLC技术及应用/);
  assert.match(lines[1], /2026-11-17/);
  const empty = impactToCSV([]);
  assert.equal(empty.split("\r\n").length, 1);
});