import test from "node:test";
import assert from "node:assert/strict";
import { generate } from "../js/engine.js";
import { buildGenerationMessages, buildChatMessages } from "../js/ai-prompts.js";
import { parseAIMarkdown } from "../js/ai-artifacts.js";

const params = {
  major: "电气自动化设备安装与维修",
  course: "电动机控制线路安装与调试",
  task: "三相异步电动机正反转控制线路安装与调试",
  lessonType: "一体化",
  hours: "4",
  learners: "学生已学习安全用电，但接线不熟练；40 人，8 组，8 台套。",
  resources: "电工实训台 8 台，电动机 8 台。",
  notes: "突出互锁验证与安全。",
  template: "standard"
};

const filler = "本模块用于验证 AI 输出合并、引用校验与长度截断处理，内容应当足够长并包含可执行的教学活动、评价证据和教师支持策略。".repeat(3);

function markdown() {
  return `# AI 改写教案
> 本成果适用于电气自动化专业。

## 01 学习目标
### 知识目标
| 目标 | 证据 |
| --- | --- |
| 说明互锁作用 [KB-01 §03] | 提问 |
| 识别主电路路径 | 方案说明 |

### 技能目标
1. 按图完成接线 [KB-02 §01]
2. 使用万用表完成断电自检
${filler}

## 02 教学流程
| 阶段 | 时间 | 教师活动 | 学生活动 | 证据 |
| --- | --- | --- | --- | --- |
| 导入 | 10 | 情境导入 | 观察 | 任务单 |
| 实施 | 120 | 巡回指导 | 接线 | 作品 |
${filler}

## 03 评价设计与评分标准
| 维度 | 权重 | 标准 |
| --- | --- | --- |
| 接线工艺 | 40 | 规范 |
| 安全 | 30 | 零违规 |
${filler}

## 04 安全与应急
- 断电验电 [KB-05 §04]
- 异常立即停机并报告
${filler}
`;
}

test("AI Markdown 合并进本地完整教案，而不是替换成半成品", () => {
  const local = generate("lesson", params);
  const parsed = parseAIMarkdown({
    markdown: markdown(),
    localResult: local,
    params,
    scene: "lesson",
    provider: { provider: "测试模型", model: "test-1", duration: 1000, finishReason: "stop" }
  });
  const doc = parsed.artifact.docs[0];
  assert.equal(doc.sections.length, local.artifact.docs[0].sections.length);
  assert.ok(parsed.artifact.ai.changedSectionCount >= 3);
  assert.ok(doc.sections.filter((section) => section.aiEnhanced).length >= 3);
  assert.ok(parsed.artifact.sources.length >= local.sources.length);
  assert.ok(parsed.artifact.ai.citations.length >= 1);
  assert.equal(parsed.artifact.ai.truncated, false);
});

test("未知引用不会进入成果来源", () => {
  const local = generate("lesson", params);
  const text = markdown().replace("## 04 安全与应急", "## 04 安全与应急\n> 伪造依据 [KB-99 §99] 不应保留。\n");
  const parsed = parseAIMarkdown({
    markdown: text,
    localResult: local,
    params,
    scene: "lesson",
    provider: { provider: "测试", model: "test", duration: 1, finishReason: "stop" }
  });
  assert.ok(!parsed.artifact.sources.some((source) => source.ref === "KB-99 §99"));
  assert.ok(parsed.warnings.some((warning) => warning.includes("KB-99")));
});

test("finish_reason=length 会提示输出截断", () => {
  const local = generate("lesson", params);
  const parsed = parseAIMarkdown({
    markdown: markdown(),
    localResult: local,
    params,
    scene: "lesson",
    provider: { provider: "测试", model: "test", duration: 1, finishReason: "length" }
  });
  assert.equal(parsed.artifact.ai.truncated, true);
  assert.ok(parsed.warnings.some((warning) => warning.includes("长度上限")));
});

test("专业包引用 PK-… §… 可被识别并保留来源", () => {
  const cncParams = {
    major: "数控技术",
    course: "数控车削编程与加工",
    task: "阶梯轴数控车削加工",
    lessonType: "一体化",
    hours: "4",
    learners: "学生已学基本编程。",
    resources: "数控车床 8 台。",
    notes: "",
    template: "standard"
  };
  const local = generate("lesson", cncParams);
  const packSource = local.sources.find((source) => source.docId.startsWith("PK-"));
  assert.ok(packSource, "本地成果应接入专业包来源");
  const text = `# 教案\n> 摘要\n## 学习目标\n- 能说明对刀步骤 [${packSource.ref}]\n${filler}\n## 教学流程\n| 阶段 | 活动 |\n| --- | --- |\n| 导入 | 情境 |\n${filler}`;
  const parsed = parseAIMarkdown({
    markdown: text,
    localResult: local,
    params: cncParams,
    scene: "lesson",
    provider: { provider: "测试", model: "test", finishReason: "stop" }
  });
  assert.ok(parsed.artifact.ai.citations.includes(packSource.ref));
  assert.ok(parsed.artifact.sources.some((source) => source.ref === packSource.ref));
});

test("无法匹配任何本地模块时明确抛错，调用方可回退", () => {
  const local = generate("lesson", params);
  assert.throws(() => parseAIMarkdown({
    markdown: "# 完全无关\n## 某个不存在的模块\n短内容。",
    localResult: local,
    params,
    scene: "lesson",
    provider: { provider: "测试", model: "test" }
  }));
});

test("生成提示词只要求关键模块，并包含真实条件与引用白名单", () => {
  const local = generate("lesson", params);
  const messages = buildGenerationMessages({ scene: "lesson", params, localResult: local, sources: local.sources });
  const text = messages.map((message) => message.content).join("\n");
  assert.match(text, /只输出这些模块/);
  assert.match(text, /学习目标/);
  assert.match(text, /教学流程/);
  assert.match(text, /KB-01 §0/);
  assert.match(text, /不得编造|待教师核验/);
  assert.match(text, /900—1400/);
});

test("对话提示词包含边界、来源和历史，并禁止编造", () => {
  const local = generate("lesson", params);
  const messages = buildChatMessages({
    question: "学习目标怎么写？",
    sources: local.sources,
    context: local.context,
    history: [{ role: "user", text: "我要写一份教案" }, { role: "assistant", text: "请提供专业和任务。" }]
  });
  const text = messages.map((message) => message.content).join("\n");
  assert.match(text, /不编造/);
  assert.match(text, /KB-02 §0/);
  assert.match(text, /我要写一份教案/);
  assert.match(text, /不提供学生心理诊断/);
});