/**
 * 授渔 V2 · 隐私模块测试
 *
 * 运行：node --test tests/privacy.test.mjs
 *
 * 说明：所有身份证号都由 999999 + 固定出生日期 + 序号 + 计算校验位合成，
 * 行政区域前缀故意使用非真实区划，避免使用任何真实个人身份证号。
 * 手机号、邮箱、地址、姓名等均为测试夹具，不对应真实学生或家长。
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  detectSensitive,
  maskSensitive,
  maskAll,
  reviewSummary,
  riskLevel,
  hasHighRisk,
  requiresConfirmation
} from "../js/privacy.js";

const REQUIRED_FINDING_FIELDS = [
  "type",
  "label",
  "start",
  "end",
  "value",
  "masked",
  "severity",
  "confidence",
  "reason"
];

const ID_WEIGHTS = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
const ID_CHECK_CODES = "10X98765432";

function idCheckDigit(prefix17) {
  let sum = 0;
  for (let i = 0; i < 17; i += 1) {
    sum += Number(prefix17[i]) * ID_WEIGHTS[i];
  }
  return ID_CHECK_CODES[sum % 11];
}

function syntheticId(prefix17) {
  return `${prefix17}${idCheckDigit(prefix17)}`;
}

const VALID_ID = syntheticId("99999920000101001");
const INVALID_DATE_ID = syntheticId("99999920001301001");

function assertFindingShape(finding) {
  for (const field of REQUIRED_FINDING_FIELDS) {
    assert.ok(Object.hasOwn(finding, field), `missing field: ${field}`);
  }
  assert.equal(typeof finding.type, "string");
  assert.equal(typeof finding.label, "string");
  assert.equal(typeof finding.start, "number");
  assert.equal(typeof finding.end, "number");
  assert.equal(typeof finding.value, "string");
  assert.equal(typeof finding.masked, "string");
  assert.ok(["high", "medium", "low"].includes(finding.severity));
  assert.ok(finding.confidence >= 0 && finding.confidence <= 1);
  assert.ok(finding.reason.length > 0);
}

test("空文本、空值与无敏感内容的文本不产生命中", () => {
  assert.deepEqual(detectSensitive(""), []);
  assert.deepEqual(detectSensitive(null), []);
  assert.deepEqual(detectSensitive("这是一份正常的工学一体化课程教案说明。"), []);
  assert.deepEqual(detectSensitive(undefined, { types: [] }), []);
});

test("合法校验位的合成身份证号被识别，字段与区间正确", () => {
  const text = `身份证号：${VALID_ID}。`;
  const findings = detectSensitive(text);
  assert.equal(findings.length, 1);
  const finding = findings[0];
  assertFindingShape(finding);
  assert.equal(finding.type, "cn_id");
  assert.equal(finding.start, text.indexOf(VALID_ID));
  assert.equal(finding.end, finding.start + VALID_ID.length);
  assert.equal(finding.value, VALID_ID);
  assert.match(finding.masked, /\*/);
  assert.ok(!finding.masked.includes(VALID_ID));
});

test("校验位错误的身份证号不被当作身份证命中", () => {
  const last = VALID_ID[17];
  const replacement = last === "0" ? "1" : "0";
  const invalid = `${VALID_ID.slice(0, 17)}${replacement}`;
  const findings = detectSensitive(`身份证号：${invalid}`);
  assert.equal(findings.filter((item) => item.type === "cn_id").length, 0);
});

test("出生日期非法的身份证号不被识别", () => {
  const findings = detectSensitive(`身份证号：${INVALID_DATE_ID}`);
  assert.equal(findings.filter((item) => item.type === "cn_id").length, 0);
});

test("校验位为 X 的合成身份证号可被识别", () => {
  let xId = "";
  for (let i = 1; i < 1000; i += 1) {
    const prefix = `99999920000101${String(i).padStart(3, "0")}`;
    const candidate = syntheticId(prefix);
    if (candidate.endsWith("X")) {
      xId = candidate;
      break;
    }
  }
  assert.ok(xId, "应能构造出校验位为 X 的测试号");
  const findings = detectSensitive(`证件号码 ${xId}`);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].type, "cn_id");
  assert.ok(findings[0].masked.endsWith("X"));
});

test("中国大陆手机号识别与 138****8000 掩码", () => {
  const text = "联系电话：13800138000";
  const findings = detectSensitive(text);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].type, "phone");
  assert.equal(findings[0].masked, "138****8000");
  assert.equal(findings[0].severity, "high");
});

test("带 +86 前缀的手机号只掩码号码主体，保留前缀", () => {
  const masked = maskAll("联系：+86 13800138000");
  assert.ok(masked.includes("+86 138****8000"));
  assert.ok(!masked.includes("13800138000"));
});

test("电子邮箱识别且局部掩码，不遮挡域名", () => {
  const email = "zhangsan@example.com";
  const finding = detectSensitive(`邮箱：${email}`)[0];
  assert.equal(finding.type, "email");
  assert.match(finding.masked, /^z\*\*\*n@example\.com$/);
  assert.ok(!finding.masked.includes("zhangsan"));
});

test("学号上下文识别与掩码", () => {
  const findings = detectSensitive("学号：20230001，请核对。");
  assert.equal(findings.length, 1);
  assert.equal(findings[0].type, "student_id");
  assert.equal(findings[0].value, "20230001");
  assert.ok(findings[0].masked.startsWith("20"));
  assert.ok(findings[0].masked.endsWith("01"));
  assert.ok(!findings[0].masked.includes("20230001"));
});

test("显式姓名标签识别常见姓氏姓名", () => {
  const findings = detectSensitive("学生姓名：张三，联系电话：13800138000");
  const name = findings.find((item) => item.type === "name");
  assert.ok(name);
  assert.equal(name.value, "张三");
  assert.equal(name.masked, "张*");
});

test("学生/家长语境下的裸姓名可识别，且不误判常见词", () => {
  const positive = detectSensitive("学生王小明今天请假，家长李四已知悉。");
  assert.deepEqual(
    positive.filter((item) => item.type === "name").map((item) => item.value),
    ["王小明", "李四"]
  );

  const negative = detectSensitive("学生发展中心召开家长会，讨论学生成绩、名单和联系方式。");
  assert.equal(negative.filter((item) => item.type === "name").length, 0);
  assert.equal(detectSensitive("联系人方式见附件。").filter((item) => item.type === "name").length, 0);
});

test("复姓姓名可识别", () => {
  const finding = detectSensitive("家长：欧阳明")[0];
  assert.equal(finding.type, "name");
  assert.equal(finding.value, "欧阳明");
  assert.equal(finding.masked, "欧**");
});

test("家庭住址识别并隐藏门牌信息", () => {
  const address = "测试省样例市示例区样例路88号3栋201室";
  const finding = detectSensitive(`家庭住址：${address}。`)[0];
  assert.equal(finding.type, "address");
  assert.equal(finding.value, address);
  assert.ok(finding.masked.includes("***"));
  assert.ok(!finding.masked.includes("88号"));
});

test("“邮箱地址 / 服务器地址”不误判为家庭住址", () => {
  const emailText = "邮箱地址：test@example.com";
  const emailFindings = detectSensitive(emailText);
  assert.equal(emailFindings.filter((item) => item.type === "address").length, 0);
  assert.equal(emailFindings.filter((item) => item.type === "email").length, 1);

  const serverText = "服务器地址：192.168.1.10";
  assert.equal(detectSensitive(serverText).filter((item) => item.type === "address").length, 0);
});

test("家长联系方式分类为 parent_contact，而非普通手机号", () => {
  const findings = detectSensitive("家长联系方式：13800138000");
  assert.equal(findings.length, 1);
  assert.equal(findings[0].type, "parent_contact");
  assert.equal(findings[0].masked, "138****8000");
});

test("“家长会联系电话”不被误判为家长联系方式", () => {
  const findings = detectSensitive("家长会联系电话：13800138000");
  assert.equal(findings.length, 1);
  assert.equal(findings[0].type, "phone");
});

test("家长邮箱可归入家长联系方式并正确掩码", () => {
  const findings = detectSensitive("家长邮箱：parent@example.com");
  assert.equal(findings.length, 1);
  assert.equal(findings[0].type, "parent_contact");
  assert.match(findings[0].masked, /@example\.com$/);
  assert.ok(!findings[0].masked.includes("parent"));
});

test("QQ 号、微信号识别与掩码", () => {
  const qq = detectSensitive("QQ：12345678")[0];
  assert.equal(qq.type, "qq");
  assert.equal(qq.masked, "12***78");

  const wechat = detectSensitive("微信号：wxid_abc123")[0];
  assert.equal(wechat.type, "wechat");
  assert.ok(wechat.masked.includes("***"));
  assert.ok(!wechat.masked.includes("wxid_abc123"));
});

test("银行卡号上下文识别，可用选项关闭", () => {
  const text = "银行卡号：9999 9999 9999 9999";
  const findings = detectSensitive(text);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].type, "bank_card");
  assert.ok(!findings[0].masked.includes("9999999999999999"));

  assert.equal(detectSensitive(text, { includeBankCard: false }).length, 0);
});

test("其他证件号（护照）启发式识别与掩码", () => {
  const finding = detectSensitive("护照号：E12345678")[0];
  assert.equal(finding.type, "other_id");
  assert.equal(finding.severity, "high");
  assert.ok(finding.masked.startsWith("E1"));
  assert.ok(!finding.masked.includes("12345678"));
});

test("混合文本多命中、按 start 排序且区间不重叠", () => {
  const text =
    "学生姓名：张三，手机：13800138000，邮箱：zhangsan@example.com，学号：20230001，家庭住址：测试省样例市示例区样例路88号。";
  const findings = detectSensitive(text);
  const types = findings.map((item) => item.type);
  for (const expected of ["name", "phone", "email", "student_id", "address"]) {
    assert.ok(types.includes(expected), `missing type: ${expected}`);
  }
  for (let i = 1; i < findings.length; i += 1) {
    assert.ok(findings[i - 1].start <= findings[i].start);
  }
  for (let i = 0; i < findings.length; i += 1) {
    for (let j = i + 1; j < findings.length; j += 1) {
      const overlap = findings[i].start < findings[j].end && findings[j].start < findings[i].end;
      assert.equal(overlap, false);
    }
  }
});

test("maskAll 同时脱敏混合文本，且保留普通说明文字", () => {
  const text =
    "学生姓名：张三，手机：13800138000，邮箱：zhangsan@example.com，学号：20230001，家庭住址：测试省样例市示例区样例路88号。";
  const masked = maskAll(text);
  assert.ok(masked.includes("学生姓名："));
  assert.ok(masked.includes("手机："));
  assert.ok(masked.includes("138****8000"));
  assert.ok(masked.includes("z***n@example.com"));
  assert.ok(!masked.includes("13800138000"));
  assert.ok(!masked.includes("zhangsan@example.com"));
  assert.ok(!masked.includes("20230001"));
  assert.ok(!masked.includes("张三"));
  assert.ok(!masked.includes("88号"));
});

test("maskSensitive 可接受手工 findings，并拒绝越界区间", () => {
  const text = "电话 13800138000";
  const findings = [
    { type: "phone", start: 3, end: 14 },
    { type: "phone", start: 999, end: 1000 }
  ];
  assert.equal(maskSensitive(text, findings), "电话 138****8000");
  assert.equal(maskSensitive(text, []), text);
});

test("多个电话号码全部脱敏，不误伤中间文字", () => {
  const text = "家长电话 13800138000，备用 13900139000。";
  const masked = maskAll(text);
  assert.ok(masked.includes("138****8000"));
  assert.ok(masked.includes("139****9000"));
  assert.ok(!masked.includes("13800138000"));
  assert.ok(!masked.includes("13900139000"));
  assert.ok(masked.includes("备用"));
});

test("reviewSummary 只输出 type/count/severity，不泄漏值或位置", () => {
  const text = "学生姓名：张三，手机：13800138000，邮箱：zhangsan@example.com";
  const summary = reviewSummary(detectSensitive(text));
  assert.ok(Array.isArray(summary));
  assert.ok(summary.length >= 3);
  for (const item of summary) {
    assert.deepEqual(Object.keys(item).sort(), ["count", "severity", "type"]);
    assert.ok(Number.isInteger(item.count) && item.count > 0);
  }
  const serialized = JSON.stringify(summary);
  assert.ok(!serialized.includes("13800138000"));
  assert.ok(!serialized.includes("zhangsan"));
  assert.ok(!serialized.includes("张三"));
});

test("reviewSummary 对同类型多个命中做计数汇总", () => {
  const summary = reviewSummary(detectSensitive("13800138000 和 13900139000"));
  const phone = summary.find((item) => item.type === "phone");
  assert.ok(phone);
  assert.equal(phone.count, 2);
  assert.equal(phone.severity, "high");
});

test("风险级别、高危判断与人工确认标志", () => {
  const high = detectSensitive("手机号 13800138000");
  assert.equal(riskLevel(high), "high");
  assert.equal(hasHighRisk(high), true);
  assert.equal(requiresConfirmation(high), true);

  const medium = detectSensitive("邮箱 test@example.com");
  assert.equal(riskLevel(medium), "medium");
  assert.equal(hasHighRisk(medium), false);
  assert.equal(requiresConfirmation(medium), true);

  assert.equal(riskLevel([]), "none");
  assert.equal(hasHighRisk([]), false);
  assert.equal(requiresConfirmation([]), false);
});

test("options.types 可限定检测类型，空数组关闭全部检测", () => {
  const text = "学生姓名：张三，手机：13800138000，邮箱：zhangsan@example.com";
  const onlyPhone = detectSensitive(text, { types: ["phone"] });
  assert.equal(onlyPhone.length, 1);
  assert.equal(onlyPhone[0].type, "phone");

  const none = detectSensitive(text, { types: [] });
  assert.deepEqual(none, []);
});

test("minConfidence 可过滤低置信姓名候选", () => {
  const bare = "家长李四";
  assert.equal(detectSensitive(bare, { minConfidence: 0.9 }).length, 0);
  const explicit = "家长姓名：李四";
  assert.equal(detectSensitive(explicit, { minConfidence: 0.9 }).length, 1);
});

test("长数字串中的 11 位片段不被误判为手机号", () => {
  assert.equal(detectSensitive("编号：12313800138000").filter((item) => item.type === "phone").length, 0);
  assert.equal(detectSensitive("138001380001").filter((item) => item.type === "phone").length, 0);
});

test("同一位置重叠命中会去重，特定上下文优先于泛化类型", () => {
  const findings = detectSensitive("学号：13800138000");
  const sameStart = findings.filter((item) => item.start === findings[0].start);
  assert.equal(sameStart.length, 1);
  assert.equal(sameStart[0].type, "student_id");
});

test("无效或过短的学生编号不被识别", () => {
  assert.equal(detectSensitive("学号：12").filter((item) => item.type === "student_id").length, 0);
  assert.equal(detectSensitive("学号：abcd").filter((item) => item.type === "student_id").length, 0);
});

test("QQ 邮箱中的数字不被误判为 QQ 号", () => {
  const findings = detectSensitive("QQ邮箱：12345@qq.com");
  assert.equal(findings.filter((item) => item.type === "qq").length, 0);
  assert.equal(findings.filter((item) => item.type === "email").length, 1);
});