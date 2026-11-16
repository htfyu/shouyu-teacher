/**
 * 匠备 · 本地教学工作流引擎
 * 职责：知识检索、结构化成果生成、边界判断、多轮参数更新。
 * 说明：默认不联网、不上传数据。所有生成内容均为教学辅助草稿，须人工审核。
 */

import {
  KB_DOCS,
  KB_VERSION,
  SCENES,
  TASK_PRESETS,
  LESSON_TEMPLATES,
  EVAL_TEMPLATES,
  OBSERVATION_TEMPLATES,
  getDoc,
  getSection,
  totalSections
} from "./knowledge.js";

const CJK_STOP = new Set(["的", "了", "和", "与", "在", "是", "为", "及", "或", "对", "把", "被", "能", "会", "请", "帮", "我", "您", "你", "他", "她", "它", "这", "那", "有", "无", "一个", "一份", "什么", "怎么", "如何", "可以", "需要", "应该"]);

const SCENE_DOC_BOOST = {
  lesson: { "KB-01": 8, "KB-02": 9, "KB-05": 3, "KB-08": 2 },
  materials: { "KB-03": 9, "KB-04": 9, "KB-01": 3, "KB-05": 2 },
  evaluate: { "KB-06": 7, "KB-08": 8, "KB-02": 2 },
  safety: { "KB-05": 14, "KB-09": 3 },
  observe: { "KB-07": 9, "KB-06": 5, "KB-09": 2 }
};

const DOMAIN_WORDS = [
  "课", "教学", "教案", "任务", "工作页", "任务单", "评价", "评分", "实训", "安全", "规程", "专业",
  "学生", "教师", "老师", "听课", "评课", "设备", "班级", "目标", "课程", "电工", "PLC", "数控",
  "汽车", "机器人", "加工", "编程", "考试", "作业", "教研", "培养", "技能", "知识点", "教材",
  "教具", "课堂", "讲授", "学习", "学情", "备课", "工学一体化", "教学流程", "课件", "思政",
  "制动", "电机", "电动机", "接线", "调试", "故障", "工位", "量具", "工艺"
];

const OUT_OF_SCOPE_RULES = [
  {
    test: /(抑郁|焦虑|自残|自杀|心理|情绪障碍|家庭暴力|家庭情况|家访|贫困|资助)/,
    reply: "这个问题涉及学生心理、家庭或资助等敏感信息，**不在我的能力范围内**。我不能做心理诊断，也不能处理学生个人与家庭数据。\n\n建议：请联系班主任、学院心理健康中心或学生工作部门，由具备相应职责的老师介入；请勿在对话中提供学生姓名、联系方式或家庭细节。",
    tag: "学生心理与个人事务"
  },
  {
    test: /(哪个学生|哪些学生).*(考不上|不行|差|淘汰|放弃|排名)|(预测|推测).*(成绩|分数|升学|就业)|学生.*(智商|能力).*(排名|打分)/,
    reply: "我不能预测学生成绩、给学生贴标签或做淘汰性排序。这类判断会放大偏差，也不符合教育评价的育人导向。\n\n如果要做学情分析，建议只使用**聚合、脱敏后的学习证据**（如某知识点的班级正确率），并由教师结合课堂观察做人工判断。我可以帮您设计分层练习或评价表。",
    tag: "学生预测与标签"
  },
  {
    test: /(工资|薪酬|绩效|人事|招聘|劳动合同|仲裁|法律意见|财务报销|采购|预算|审计)/,
    reply: "人事、财务、法律与采购事项**不在我的知识范围内**。我无法提供有依据的判断。\n\n建议咨询学院人事部门、财务部门或法务/采购归口部门，以正式制度与书面答复为准。",
    tag: "人事财务与法律"
  },
  {
    test: /(病历|诊断|开药|处方|用药|急救|受伤了|流血|骨折|中毒|触电了|烧伤)/,
    reply: "我不能做医疗判断、开药或替代急救指导。涉及人身伤害请立即按现场应急预案处理并呼叫急救。\n\n教学场景的安全规程可以在知识库范围内查询，但现场处置必须由具备资质的急救人员、安全员和医护人员负责。",
    tag: "医疗与急救判断"
  },
  {
    test: /(泄露|偷看|查一下).*(成绩|信息|隐私)|(学生|家长).*(身份证|手机号|住址|家庭信息)|(爬取|导出).*学生.*(数据|信息)/,
    reply: "这类请求涉及学生个人信息与隐私，我不能协助查询、导出或处理。\n\n请遵守学院数据安全规定：只使用经批准、脱敏、最小化的数据；学生姓名、证件号、联系方式、家庭信息不应进入本工具或任何第三方模型。",
    tag: "隐私与敏感数据"
  }
];

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalize(text) {
  return String(text ?? "")
    .toLowerCase()
    .replace(/[，。！？；：、“”‘’（）【】《》〈〉,.!?;:'"()[\]{}<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cjkTokens(text) {
  const value = normalize(text);
  const tokens = new Set();
  const ascii = value.match(/[a-z0-9][a-z0-9+._-]{1,}/g) || [];
  ascii.forEach((word) => tokens.add(word));
  const cjkRuns = value.match(/[\u4e00-\u9fa5]{2,}/g) || [];
  cjkRuns.forEach((run) => {
    const chars = Array.from(run);
    for (let i = 0; i < chars.length - 1; i += 1) {
      const bigram = chars[i] + chars[i + 1];
      if (!CJK_STOP.has(bigram)) tokens.add(bigram);
    }
    for (let i = 0; i < chars.length - 2; i += 1) {
      const trigram = chars[i] + chars[i + 1] + chars[i + 2];
      if (!CJK_STOP.has(trigram)) tokens.add(trigram);
    }
    if (chars.length <= 6 && !CJK_STOP.has(run)) tokens.add(run);
  });
  return Array.from(tokens).slice(0, 90);
}

function sectionHaystack(doc, section) {
  return normalize(
    [doc.title, doc.category, doc.tags.join(" "), section.title, section.text, section.bullets.join(" ")]
      .join(" ")
  );
}

function makeSnippet(text, terms, max = 132) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const parts = clean.split(/(?<=[。；！？])/);
  let best = parts[0];
  let bestScore = -1;
  parts.forEach((part) => {
    const normalized = normalize(part);
    const score = terms.reduce((sum, term) => sum + (normalized.includes(term) ? term.length : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      best = part;
    }
  });
  if (best.length > max) return `${best.slice(0, max)}…`;
  return best;
}

function toSource(doc, section, score, terms, reason = "") {
  return {
    key: section.id,
    docId: doc.id,
    sectionId: section.id,
    docTitle: doc.title,
    sectionNo: section.no,
    sectionTitle: section.title,
    version: doc.version,
    category: doc.category,
    snippet: makeSnippet(section.text || section.bullets.join("；"), terms),
    score: Math.round(score * 10) / 10,
    reason,
    ref: `${doc.id} §${section.no}`
  };
}

/**
 * 检索知识库片段。
 * @returns {{results: Array, terms: string[], coverage: number}}
 */
export function retrieve(query, options = {}) {
  const { scene = "", limit = 6, category = "", minScore = 0 } = options;
  const terms = cjkTokens(query);
  if (!terms.length && !category) return { results: [], terms, coverage: 0 };
  const boosts = SCENE_DOC_BOOST[scene] || {};
  const scored = [];

  KB_DOCS.forEach((doc) => {
    if (category && doc.category !== category) return;
    doc.sections.forEach((section) => {
      const hay = sectionHaystack(doc, section);
      let score = boosts[doc.id] || 0;
      let matched = 0;
      terms.forEach((term) => {
        if (hay.includes(term)) {
          matched += 1;
          score += term.length >= 3 ? 2.2 : term.length === 2 ? 1.15 : 0.6;
          if (normalize(section.title).includes(term)) score += 1.4;
          if (normalize(doc.tags.join(" ")).includes(term)) score += 0.8;
        }
      });
      if (matched === 0) return;
      const coverage = matched / Math.max(terms.length, 1);
      score += coverage * 3;
      score += Math.min(matched, 6) * 0.15;
      if (score >= minScore) scored.push({ doc, section, score, terms, matched });
    });
  });

  scored.sort((a, b) => b.score - a.score || a.doc.id.localeCompare(b.doc.id));
  const seen = new Set();
  const results = [];
  scored.forEach((item) => {
    if (seen.has(item.section.id)) return;
    seen.add(item.section.id);
    results.push(toSource(item.doc, item.section, item.score, terms, `命中 ${item.matched} 个检索词`));
  });
  const top = results.slice(0, limit);
  const coverage = top.length ? clamp(top[0].score / Math.max(4, terms.length * 1.2), 0, 1) : 0;
  return { results: top, terms, coverage };
}

export function searchKnowledge(query, category = "") {
  if (!query.trim()) {
    const all = [];
    KB_DOCS.forEach((doc) => {
      if (category && doc.category !== category) return;
      doc.sections.forEach((section) => {
        all.push({
          docId: doc.id,
          docTitle: doc.title,
          category: doc.category,
          version: doc.version,
          sectionId: section.id,
          sectionNo: section.no,
          sectionTitle: section.title,
          snippet: makeSnippet(section.text, [])
        });
      });
    });
    return all;
  }
  return retrieve(query, { limit: 24, category }).results;
}

export function knowledgeStats() {
  return {
    docs: KB_DOCS.length,
    sections: totalSections(),
    version: KB_VERSION
  };
}

function getSource(ref, reason = "") {
  const value = String(ref || "").trim();
  let docId = "";
  let rawNo = "";
  if (value.includes(" §")) {
    [docId, rawNo] = value.split(" §");
  } else {
    const match = value.match(/^(KB-\d{2})-(\d+)$/);
    if (match) {
      docId = match[1];
      rawNo = match[2];
    }
  }
  const doc = getDoc(docId);
  if (!doc) return null;
  const padded = String(rawNo).padStart(2, "0");
  const section = doc.sections.find(
    (item) => item.id === value || item.id === rawNo || item.no === rawNo || item.no === padded
  );
  if (!section) return null;
  return { ...toSource(doc, section, 10, [], reason), reason: reason || "生成任务引用的固定依据" };
}

function sourceSet(refs) {
  const map = new Map();
  refs.forEach((ref) => {
    const source = getSource(ref);
    if (source && !map.has(source.key)) map.set(source.key, source);
  });
  return map;
}

function refsFromSources(sources) {
  return sources.map((source) => source.ref);
}

function p(text) {
  return { type: "paragraph", text };
}
function ul(items) {
  return { type: "list", items };
}
function ol(items) {
  return { type: "list", items, ordered: true };
}
function table(headers, rows) {
  return { type: "table", headers, rows };
}
function callout(tone, title, text) {
  return { type: "callout", tone, title, text };
}
function lines(count, label = "") {
  return { type: "lines", count, label };
}
function checklist(items) {
  return { type: "checklist", items };
}

export function findTaskPreset(task, major = "") {
  const value = String(task || "").trim();
  if (!value) return null;
  let best = null;
  let bestScore = 0;
  TASK_PRESETS.forEach((preset) => {
    let score = 0;
    if (preset.label === value) score += 100;
    else if (preset.label.includes(value) && value.length >= 5) score += 60;
    else if (value.includes(preset.label)) score += 60;
    else {
      const hits = preset.keywords.filter((keyword) => value.toLowerCase().includes(keyword.toLowerCase()));
      score += hits.length * 12;
      if (major && preset.major === major) score += 6;
      if (hits.length < 2) score = 0;
    }
    if (score > bestScore) {
      bestScore = score;
      best = preset;
    }
  });
  return bestScore >= 24 ? best : null;
}

export function normalizeContext(scene, raw = {}) {
  const usesLessonShape = scene === "lesson" || scene === "materials";
  const usesEvaluationShape = scene === "evaluate";
  const hoursNumber = Number.parseInt(raw.hours, 10);
  const hours = usesLessonShape
    ? Number.isFinite(hoursNumber) ? clamp(hoursNumber, 1, 24) : 4
    : null;
  const lessonType = usesLessonShape ? raw.lessonType || "一体化" : "";
  let template = null;
  if (scene === "lesson") {
    template = LESSON_TEMPLATES.find((item) => item.id === (raw.template || "standard")) || LESSON_TEMPLATES[0];
  } else if (usesEvaluationShape) {
    template = EVAL_TEMPLATES.find((item) => item.id === (raw.evalTemplate || "process")) || EVAL_TEMPLATES[0];
  } else if (scene === "observe") {
    template = OBSERVATION_TEMPLATES.find((item) => item.id === (raw.observationTemplate || "evidence")) || OBSERVATION_TEMPLATES[0];
  }
  const templateName = scene === "lesson"
    ? template?.name || "标准一体化教案"
    : scene === "materials"
      ? "任务单 / 工作页"
      : usesEvaluationShape
        ? template?.name || "过程性评价"
        : scene === "observe"
          ? template?.name || "证据型评课"
          : scene === "safety"
            ? "安全核查清单"
            : "标准工作流";
  return {
    scene,
    major: String(raw.major || "").trim() || "未填写专业",
    course: String(raw.course || "").trim() || "未填写课程",
    task: String(raw.task || raw.venue || "待明确学习任务").trim(),
    lessonType,
    hours,
    learners: String(raw.learners || "").trim(),
    resources: String(raw.resources || "").trim(),
    notes: String(raw.notes || "").trim(),
    templateId: template?.id || "",
    templateName,
    venue: String(raw.venue || "").trim(),
    operation: String(raw.operation || "").trim(),
    audience: String(raw.audience || "").trim(),
    focus: String(raw.focus || "").trim(),
    observation: String(raw.observation || "").trim(),
    evalTemplate: raw.evalTemplate || "process",
    observationTemplate: raw.observationTemplate || "evidence",
    preset: findTaskPreset(raw.task, raw.major),
    materialsOutput: raw.materialsOutput || "both"
  };
}

function totalMinutes(hours) {
  return clamp(hours, 1, 24) * 45;
}

function fmtMinutes(minutes) {
  if (minutes < 60) return `${minutes} 分钟`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} 小时 ${m} 分钟` : `${h} 小时`;
}

function allocateMinutes(total, ratios) {
  const values = ratios.map((ratio) => Math.floor((total * ratio) / 100));
  let used = values.reduce((sum, value) => sum + value, 0);
  let i = 0;
  while (used < total) {
    values[i % values.length] += 1;
    used += 1;
    i += 1;
  }
  return values;
}

function genericObjectives(ctx) {
  const theory = ctx.lessonType === "理论";
  return {
    knowledge: [
      `能说明「${ctx.task}」的工作流程、关键要求与质量标准，并解释关键步骤的依据`,
      "能识读与任务相关的图纸、工艺卡、任务书或资料，指出其中的关键信息"
    ],
    skills: theory
      ? [
          `能围绕「${ctx.task}」完成任务分析、方案编制与案例说明，形成可复核的书面成果`,
          "能依据给定标准自检方案，找出至少 1 处不足并说明修改理由"
        ]
      : [
          `能按任务书和规范完成「${ctx.task}」的准备、实施与自检，形成可交付成果`,
          "能正确使用规定的工量具、设备或软件，记录关键数据与操作结果",
          "能依据现象排查至少 1 类常见异常，并在教师指导下修正"
        ],
    qualities: [
      "执行安全、质量与 5S 要求，做到关键动作前确认、工具归位、记录真实",
      "能与小组成员分工协作，依据证据说明自己的判断并接受同伴质疑"
    ]
  };
}

function presetObjectives(preset) {
  if (!preset) return null;
  return {
    knowledge: preset.knowledge,
    skills: preset.skills,
    qualities: preset.qualities
  };
}

function lessonTemplateIntro(ctx) {
  if (ctx.templateId === "task-driven") {
    return "本方案采用任务驱动简案结构，突出「任务链—关键步骤—评价证据」，适合 2—4 学时连续教学。";
  }
  if (ctx.templateId === "showcase") {
    return "本方案在标准结构上增加设计意图与展示说明，便于公开课、教研展示或比赛路演；展示时请只使用脱敏素材。";
  }
  return "本方案采用标准工学一体化教案结构，覆盖情境、目标、流程、评价、安全与反思，可直接替换为学院教案模板。";
}

function scalesForCriterion(dimension, criterion) {
  const excellent = criterion.includes("完整") || criterion.includes("规范")
    ? `${criterion}；过程记录完整，能说明关键判断依据`
    : `${criterion}；达到标准且过程可追溯`;
  return [
    `${excellent}，并在小组中主动承担职责。`,
    `基本做到：${criterion}；存在少量遗漏但已在下课前修正。`,
    `未能稳定做到：${criterion}；需教师提示或补做，存在质量/安全风险。`
  ];
}

function buildLesson(ctx) {
  const preset = ctx.preset;
  const objectives = presetObjectives(preset) || genericObjectives(ctx);
  const keyPoints = preset
    ? preset.keyPoints
    : [`「${ctx.task}」的核心工作流程与关键要求`, "任务成果的质量标准与自检方法"];
  const difficulties = preset
    ? preset.difficulties
    : ["将任务要求转化为可执行步骤，并在过程中做出有依据的判断", "异常情况的识别、记录与规范处置"];
  const strategies = preset
    ? preset.strategies
    : [
        "用「任务书—流程图—检查表」三件套外化工作过程，降低认知负荷",
        "设置可比较的正误案例，让学生先判断再操作",
        "执行「学生自检—同伴互检—教师确认」三步检查，关键步骤不跳步"
      ];
  const deliverables = preset ? preset.deliverables : ["任务成果 1 份", "过程记录 1 份", "自检/互评表 1 份"];
  const equipment = ctx.resources
    ? ctx.resources.split(/[、,，;\n]/).map((item) => item.trim()).filter(Boolean)
    : preset?.equipment || ["按课程实施方案核验设备、工量具与耗材", "安全防护用品", "任务书、工艺文件与评价表"];
  const safetyItems = [...(preset?.safety || []),
    "操作前完成风险确认，高风险动作须由教师或指定监护人确认",
    "发现异常立即停止并按现场规程处置，不擅自复位或重新上电",
    "收尾执行断电/停机、工具归位、现场清理并填写记录"
  ];
  const safetyUnique = Array.from(new Set(safetyItems));
  const flowRatios = ctx.lessonType === "理论" ? [12, 22, 12, 38, 11, 5] : [10, 20, 10, 45, 10, 5];
  const minutes = allocateMinutes(totalMinutes(ctx.hours), flowRatios);
  const total = minutes.reduce((sum, value) => sum + value, 0);
  const lessonTypeText = ctx.lessonType === "理论"
    ? "以案例分析、方案编制和证据推理为主，设备操作按课程条件选做。"
    : ctx.lessonType === "实训"
      ? "以学生动手实践为主，教师示范、监护与巡回指导贯穿全过程。"
      : "采用「做中学」的一体化组织方式，理论讲解嵌入任务实施。";
  const objectivesEvidence = [
    ...objectives.knowledge.map((item, index) => ({
      target: `知识目标 ${index + 1}`,
      evidence: "提问、识图/工艺文件、方案说明、阶段小测"
    })),
    ...objectives.skills.map((item, index) => ({
      target: `技能目标 ${index + 1}`,
      evidence: "操作过程、任务成果、自检记录、故障排查记录"
    })),
    ...objectives.qualities.map((item, index) => ({
      target: `素养目标 ${index + 1}`,
      evidence: "安全确认单、5S 检查、协作观察、工作页记录"
    }))
  ];
  const assessmentRows = (preset?.assessment || [
    ["任务准备与理解", "10", "资料齐全，能复述任务要求、交付物和验收标准"],
    ["实施过程与规范", "30", "按规范完成关键步骤，操作正确，记录及时完整"],
    ["成果质量与自检", "25", "成果达到给定标准，自检项目完整，能发现并修正问题"],
    ["安全与职业素养", "20", "执行安全确认与防护要求，无违规，5S 到位"],
    ["协作与表达", "15", "分工明确，能依据证据说明方案与结论"]
  ]).map(([name, weight, criterion]) => [name, weight, criterion]);

  const metaRows = [
    ["专业", ctx.major],
    ["课程", ctx.course],
    ["学习任务", ctx.task],
    ["课型 / 学时", `${ctx.lessonType} · ${ctx.hours} 学时（${totalMinutes(ctx.hours)} 分钟）`],
    ["授课对象", "本学期授课班级（班级/组别，不填写学生姓名）"],
    ["场地 / 设备", equipment.slice(0, 5).join("；")],
    ["教案模板", ctx.templateName],
    ["交付物", deliverables.join("；")]
  ];

  const sections = [];
  if (ctx.templateId === "showcase") {
    sections.push({
      id: "design-notes",
      no: "00",
      title: "设计说明与展示提示",
      blocks: [
        p(lessonTemplateIntro(ctx)),
        ul([
          "设计主线：以完整工作任务为载体，让学生经历「明确任务—制订计划—做出决策—实施—检查—评价」全过程。",
          "可展示证据：学生计划表、关键步骤自检单、成果对比、评价量规与改进记录。",
          "展示注意：课堂照片、名单、企业资料须脱敏或获授权；不展示真实学生成绩与个人信息。"
        ]),
        callout("warn", "展示前需核对", "公开课展示的亮点表述应有课堂证据支持；不要把“设计意图”当成“已经达成的效果”。")
      ],
      refs: ["KB-01-5", "KB-09-3"]
    });
  }

  sections.push({
    id: "context",
    no: "01",
    title: "任务情境与基本信息",
    blocks: [
      table(["项目", "内容"], metaRows),
      p(preset?.context || `在「${ctx.course}」课程中，围绕「${ctx.task}」组织一次${ctx.lessonType}学习。学生需依据任务书和课程资料，完成可交付成果并通过自检与教师确认。本方案不虚构企业名称、生产数据或岗位标准；具体企业情境请教师按真实任务替换。`),
      callout("info", "任务交付物", deliverables.join("；")),
      ...(preset ? [callout("note", "情境说明", "以上为通用教学情境示例，不对应真实企业或生产数据。请按实际任务书替换企业背景、设备型号、技术参数与验收标准。")] : []),
      ...(ctx.notes ? [callout("note", "教师补充要求", ctx.notes)] : []),
      ...(preset ? [] : [callout("warn", "待教师核验", "该任务不在内置任务画像中，工作情境、设备清单与质量标准为通用结构，请结合课程标准和真实任务书补齐后再使用。")])
    ],
    refs: ["KB-02-1", "KB-01-2"]
  });

  sections.push({
    id: "objectives",
    no: "02",
    title: "学习目标",
    blocks: [
      p(`完成本任务后，学生能够（${ctx.hours} 学时）：`),
      ul([
        ...objectives.knowledge.map((item, i) => `【知识 ${i + 1}】${item}`),
        ...objectives.skills.map((item, i) => `【技能 ${i + 1}】${item}`),
        ...objectives.qualities.map((item, i) => `【素养 ${i + 1}】${item}`)
      ]),
      callout("note", "目标—证据对应", "每条目标都应在教学流程中对应至少一项学习证据，并在评价标准中可被观察。详见本教案第 07 节。")
    ],
    refs: ["KB-01-3", "KB-01-6"]
  });

  sections.push({
    id: "keypoints",
    no: "03",
    title: "教学重点、难点与突破策略",
    blocks: [
      table(["类型", "内容", "确认方式"], [
        ...keyPoints.map((item, i) => [`重点 ${i + 1}`, item, "示范后提问 + 关键步骤检查"]),
        ...difficulties.map((item, i) => [`难点 ${i + 1}`, item, "支架材料 + 分层任务 + 同伴互检"])
      ]),
      p("突破策略："),
      ul(strategies),
      callout("info", "教学策略定位", lessonTypeText)
    ],
    refs: ["KB-02-2", "KB-01-5"]
  });

  sections.push({
    id: "learners",
    no: "04",
    title: "学情分析与支持策略",
    blocks: [
      callout("info", "教师提供的学情", ctx.learners || "未填写。请补充先修课程、班级规模、技能起点、设备台套数与差异支持需求。"),
      p("据此，本设计默认采用以下支持策略，教师可按实际学情调整："),
      ul([
        "起点诊断：用 3—5 个问题或一次短任务检测先修知识，避免把“学过”当成“会做”。",
        "差异支持：为基础薄弱学生提供图文步骤卡与同伴互检；为学优学生提供故障拓展或小老师任务。",
        "工位组织：设备不足时采用轮换，等待组完成观察记录、工艺编制或成果互评等等效任务。",
        "隐私边界：学情只用班级/组别聚合信息，不记录姓名、家庭情况或联系方式。"
      ]),
      ...(!ctx.learners ? [callout("warn", "需要教师补充", "学情信息为空，本方案中的分层与轮换仅为通用建议，正式使用前必须结合真实学情核对。")] : [])
    ],
    refs: ["KB-01-4"]
  });

  sections.push({
    id: "preparation",
    no: "05",
    title: "教学准备",
    blocks: [
      table(["类别", "准备清单"], [
        ["学习资料", "任务书、工艺文件/图纸、工作页、评价表、资料索引"],
        ["工量具", equipment.slice(0, 5).join("；")],
        ["设备与耗材", equipment.slice(5).join("；") || "按任务实际补齐，检查设备状态与安全防护"],
        ["安全防护", "防护用品、急停位置确认、应急联系人、异常处置流程"],
        ["分组与工位", "建议 2—4 人/组，设操作、监护、记录角色并轮换；按设备台套数安排轮换"]
      ]),
      callout("warn", "课前核对", "工量具数量、设备完好状态与安全装置必须逐项确认；不能用“应该没问题”替代检查。")
    ],
    refs: ["KB-02-3"]
  });

  sections.push({
    id: "flow",
    no: "06",
    title: "教学流程",
    blocks: [
      table(["阶段", "时间", "教师活动", "学生活动", "学习证据"], [
        [
          "情境导入与任务确认",
          `${minutes[0]} 分钟`,
          "呈现任务情境、交付物和验收标准；说明安全边界与评价方式；用 2 个问题激活先修知识。",
          "阅读任务单，圈出交付物与标准；提出疑问；完成起点诊断。",
          "任务理解记录 / 起点诊断"
        ],
        [
          "资讯与计划",
          `${minutes[1]} 分钟`,
          "发放资料索引；示范识图、查资料或工艺分析方法；巡视检查计划完整性。",
          "查找资料；小组编制步骤、分工、时间与工量具清单。",
          "小组计划表 / 资料笔记"
        ],
        [
          "决策与安全确认",
          `${minutes[2]} 分钟`,
          "组织方案对比；用错误案例提问；逐组确认方案与风险控制点。",
          "说明方案与依据；完成风险确认；根据反馈修改计划。",
          "方案决策记录 / 安全确认单"
        ],
        [
          "任务实施",
          `${minutes[3]} 分钟`,
          ctx.lessonType === "理论"
            ? "组织案例分析、方案编制与小组研讨；设置关键追问；对共性错误即时反馈。"
            : "分步示范关键操作；设置检查点；巡回指导并分层支持；记录共性错误与安全行为。",
          ctx.lessonType === "理论"
            ? "完成任务分析或方案；记录依据；参与同伴质疑与修订。"
            : "按计划实施；执行自检与互检；记录关键数据、异常与处置。",
          ctx.lessonType === "理论" ? "分析稿 / 方案 / 论证记录" : "任务成果 / 过程记录"
        ],
        [
          "检查与评价",
          `${minutes[4]} 分钟`,
          "组织成果展示；按评价表评分；追问判断依据；收集共性问题。",
          "对照标准自评互评；展示说明成果；记录改进点。",
          "评分表 / 互评单 / 改进记录"
        ],
        [
          "总结与 5S",
          `${minutes[5]} 分钟`,
          "总结共性错误与关键规范；布置改进任务；检查设备复位与工位。",
          "复盘学习过程；完成工位 5S；提交材料。",
          "反思单 / 工位检查记录"
        ]
      ]),
      callout("info", "时间合计", `${ctx.hours} 学时 × 45 分钟 = ${total} 分钟。若学院课长不同，请按比例调整并重新核对合计。`),
      p("组织提示：每个关键阶段都要有学生产出；教师的“讲”应服务于学生的“做”。安全确认点不得因赶进度而省略。")
    ],
    refs: ["KB-02-4", "KB-01-5"]
  });

  sections.push({
    id: "assessment",
    no: "07",
    title: "评价设计与评分标准",
    blocks: [
      table(["评价维度", "权重", "可观察标准"], assessmentRows),
      p("成绩构成建议：过程性评价 60% + 终结性成果 40%。过程性证据来自计划表、操作记录、自检互检表与阶段成果；终结性评价围绕综合任务或成果检测。"),
      ul([
        "评价主体：教师评价 60%、学生自评 15%、同伴互评 15%、企业导师 10%（如有，可按课程调整）。",
        "评价时点：任务开始公开标准；实施中记录证据；结束时对照量表评分并给出具体改进建议。",
        "安全条款：发现带电作业、短接急停/防护、擅自进入危险区域等严重违规，应立即终止操作并按学校规定处理。",
        "评价目的：用于诊断与改进，不公开排名，不给学生贴标签。"
      ]),
      table(["目标", "对应评价证据"], objectivesEvidence.map((row) => [row.target, row.evidence])),
      callout("warn", "人工复核重点", "权重、评分描述和安全一票否决条款须与学院现行教学管理制度对齐；本表为示例，不替代正式评价文件。")
    ],
    refs: ["KB-08-2", "KB-02-5", "KB-08-4"]
  });

  sections.push({
    id: "safety",
    no: "08",
    title: "安全与应急",
    blocks: [
      p("本任务涉及的关键安全提醒（须按现场规程逐项交底）："),
      checklist(safetyUnique),
      callout("danger", "不可替代现场交底", "以上为教学提醒，不构成设备操作规程。设备型号相关的防护用品、断电/停机流程和应急处置，请以实训中心现行规程、设备说明书及现场教师交底为准。")
    ],
    refs: ["KB-05-1", preset?.keywords?.some((k) => /PLC/.test(k)) ? "KB-05-5" : "KB-05-4"]
  });

  sections.push({
    id: "reflection",
    no: "09",
    title: "课后反思与改进",
    blocks: [
      p("建议课后 24 小时内完成 3 个反思问题，并作为下一轮教学调整依据："),
      ol([
        "哪个学习目标达成度最低？证据是什么（成果、记录、提问或观察）？",
        "学生在哪一步最容易卡住？是资料、示范、工位还是时间安排导致的？",
        "下一轮只改一个高杠杆动作，具体改什么，如何判断有效？"
      ]),
      lines(3, "反思记录（课后填写）"),
      callout("note", "教学改进留痕", "将本轮证据与改进动作写入教研记录；如用于公开分享，请删除学生与教师个人信息。")
    ],
    refs: ["KB-02-6", "KB-09-3"]
  });

  return {
    docs: [{
      id: "lesson-plan",
      label: "教案",
      title: `${ctx.task} · 教学设计`,
      filename: `教案_${ctx.task}`,
      meta: [
        { label: "专业", value: ctx.major },
        { label: "课程", value: ctx.course },
        { label: "学时", value: `${ctx.hours} 学时` },
        { label: "模板", value: ctx.templateName }
      ],
      sections
    }],
    meta: {
      major: ctx.major,
      course: ctx.course,
      task: ctx.task,
      lessonType: ctx.lessonType,
      hours: ctx.hours,
      template: ctx.templateName
    }
  };
}

function buildMaterials(ctx) {
  const preset = ctx.preset;
  const objectives = presetObjectives(preset) || genericObjectives(ctx);
  const deliverables = preset?.deliverables || ["任务成果 1 份", "过程记录 1 份", "自检记录 1 份"];
  const steps = preset?.workSteps || [
    "接受任务，明确交付物与验收标准",
    "查找资料，编制实施计划与分工",
    "确认方案与风险控制点",
    "按规范实施并记录关键数据",
    "自检、互检并修正问题",
    "展示成果、评价与现场整理"
  ];
  const safety = Array.from(new Set([
    ...(preset?.safety || []),
    "操作前完成风险确认，高风险动作经教师或监护人确认",
    "发现异常立即停止并报告，不擅自处置或重新启动"
  ]));
  const questions = [
    `本任务的交付物是什么？验收标准有哪些？请用自己的话复述。`,
    `完成「${ctx.task}」的关键步骤有哪几步？每一步的依据是什么？`,
    "你们计划如何分工？谁操作、谁监护、谁记录？",
    "本任务最大的风险点是什么？你们准备如何控制？",
    "如果出现异常，你们的下一步动作是什么？"
  ];
  const taskSheetSections = [
    {
      id: "ts-info",
      no: "01",
      title: "任务信息",
      blocks: [
        table(["项目", "内容"], [
          ["专业", ctx.major],
          ["课程", ctx.course],
          ["学习任务", ctx.task],
          ["课时", `${ctx.hours} 学时（${totalMinutes(ctx.hours)} 分钟）`],
          ["组别", "第 ____ 组（请勿填写姓名）"],
          ["指导教师", "____________"]
        ])
      ],
      refs: ["KB-03-1"]
    },
    {
      id: "ts-context",
      no: "02",
      title: "任务情境与交付物",
      blocks: [
        p(preset?.context || `本次任务围绕「${ctx.task}」展开。请依据任务书和课程资料完成成果，并提交过程记录。具体企业情境以教师发布的任务书为准。`),
        p(`交付物：${deliverables.join("；")}`),
        p("验收标准：成果完整、符合给定规范、过程记录真实可追溯，并通过自检与教师确认。"),
        callout("note", "情境说明", "以上为通用教学情境示例，不对应真实企业或生产数据。正式使用前请替换为教师发布的任务书。"),
        callout("warn", "先读再问", "先独立阅读任务要求，把不理解的地方写下来；提问前先说明你已经查了什么。")
      ],
      refs: ["KB-03-2"]
    },
    {
      id: "ts-goals",
      no: "03",
      title: "学习目标（学生版）",
      blocks: [
        ul([
          ...objectives.knowledge.slice(0, 2).map((item) => `我能说明：${item}`),
          ...objectives.skills.slice(0, 3).map((item) => `我能做到：${item}`),
          ...objectives.qualities.slice(0, 2).map((item) => `我会坚持：${item}`)
        ]),
        p("完成本任务后，请对照上面的目标做一次自评：做到了什么？证据在哪里？")
      ],
      refs: ["KB-03-3", "KB-01-3"]
    },
    {
      id: "ts-prepare",
      no: "04",
      title: "课前准备",
      blocks: [
        checklist([
          "已阅读任务书，圈出交付物、验收标准和截止时间",
          "已复习与任务相关的先修知识，列出至少 2 个疑问",
          "已确认工量具、设备与防护用品状态",
          "已完成分组与角色分工（操作 / 监护 / 记录）"
        ]),
        table(["工量具 / 材料", "数量", "状态确认"], [
          ["", "", "□ 完好  □ 需更换"],
          ["", "", "□ 完好  □ 需更换"],
          ["", "", "□ 完好  □ 需更换"]
        ])
      ],
      refs: ["KB-03-4"]
    },
    {
      id: "ts-steps",
      no: "05",
      title: "实施步骤与记录",
      blocks: [
        table(["步骤", "要做什么 / 依据", "我的记录"], steps.map((step, index) => [`${index + 1}`, step, ""])),
        callout("note", "记录要求", "记录关键参数、异常现象、处理动作和结果。不要事后补编；不确定的地方标注“待确认”。")
      ],
      refs: ["KB-03-4", "KB-04-2"]
    },
    {
      id: "ts-questions",
      no: "06",
      title: "关键问题链",
      blocks: [
        ol(questions),
        lines(3, "我的回答与依据")
      ],
      refs: ["KB-04-3"]
    },
    {
      id: "ts-safety",
      no: "07",
      title: "安全确认",
      blocks: [
        callout("danger", "每次操作前确认", "以下项目须逐项确认，不能以一次签名代替每一次高风险动作前的确认。"),
        checklist(safety),
        table(["确认人", "确认时间", "教师确认"], [["操作人：______", "____:____", "签字：________"], ["监护人：______", "____:____", "签字：________"]])
      ],
      refs: ["KB-05-1", "KB-05-4"]
    },
    {
      id: "ts-eval",
      no: "08",
      title: "自评与互评",
      blocks: [
        table(["评价项", "自评（1—5）", "互评（1—5）", "证据 / 说明"], [
          ["任务理解与计划", "", "", ""],
          ["操作规范与成果质量", "", "", ""],
          ["安全与 5S", "", "", ""],
          ["协作与沟通", "", "", ""],
          ["记录真实性", "", "", ""]
        ]),
        p("自评不是打分游戏：每一项都要写出证据。互评要指出“哪一步、什么表现、如何改进”。")
      ],
      refs: ["KB-03-5", "KB-08-3"]
    },
    {
      id: "ts-reflect",
      no: "09",
      title: "反思与提问",
      blocks: [
        ol([
          "本任务最难的一步是什么？你用了什么方法解决？",
          "你发现的一个错误或风险是什么？如何修正或避免？",
          "如果再做一次，你会优先改进哪一个动作？"
        ]),
        lines(4, "我的反思")
      ],
      refs: ["KB-03-5"]
    }
  ];

  const workPageSections = [
    {
      id: "wp-overview",
      no: "01",
      title: "工作页使用说明",
      blocks: [
        table(["项目", "内容"], [
          ["任务", ctx.task],
          ["专业 / 课程", `${ctx.major} / ${ctx.course}`],
          ["建议课时", `${ctx.hours} 学时`],
          ["版本", "课堂使用版 v1.0（教师发放前核对）"],
          ["组别", "第 ____ 组"]
        ]),
        p("本工作页按「资讯—计划—决策—实施—检查—评价」六步组织。每一步都要留下你的思考或操作证据；空白不是问题，编造答案才是问题。"),
        callout("warn", "安全先行", "进入工位前完成教师的安全交底与准入确认。工作页中的安全提示不能替代现场交底。")
      ],
      refs: ["KB-04-1", "KB-04-2"]
    },
    {
      id: "wp-info",
      no: "02",
      title: "资讯页：先弄清任务",
      blocks: [
        p(`任务情境：${preset?.context || `请依据教师发布的任务书，明确「${ctx.task}」的工作背景、交付物和验收标准。`}`),
        p("说明：本页情境为通用教学示例，不对应真实企业或生产数据；教师发放前请替换为实际任务书。"),
        p(`交付物：${deliverables.join("；")}`),
        ul([
          "需要查阅哪些资料？资料在哪里获取？",
          "本任务涉及哪些关键原理、规范或参数？",
          "哪些信息还不确定？准备向谁确认？"
        ]),
        lines(5, "资讯记录（资料名称 + 关键信息 + 来源）")
      ],
      refs: ["KB-04-2", "KB-04-3"]
    },
    {
      id: "wp-plan",
      no: "03",
      title: "计划页：把任务拆成步骤",
      blocks: [
        table(["序号", "工作步骤", "依据 / 关键要求", "负责人", "预计时间", "完成"], [
          ["1", "", "", "", "", "□"],
          ["2", "", "", "", "", "□"],
          ["3", "", "", "", "", "□"],
          ["4", "", "", "", "", "□"],
          ["5", "", "", "", "", "□"],
          ["6", "", "", "", "", "□"]
        ]),
        table(["工量具 / 材料", "规格", "数量", "检查结果"], [["", "", "", "□ 完好  □ 需更换"], ["", "", "", "□ 完好  □ 需更换"], ["", "", "", "□ 完好  □ 需更换"]]),
        p("计划完成后先做一次“反方审阅”：哪一步最可能出错？有没有备用方案？")
      ],
      refs: ["KB-04-2"]
    },
    {
      id: "wp-decide",
      no: "04",
      title: "决策页：选择方案并确认风险",
      blocks: [
        table(["比较项", "方案 A", "方案 B", "选择理由"], [
          ["步骤 / 工艺", "", "", ""],
          ["质量风险", "", "", ""],
          ["安全风险", "", "", ""],
          ["时间 / 设备", "", "", ""]
        ]),
        p("我们选择：方案 ____。理由是：________________________________________。"),
        checklist([
          "已复述本任务最高风险点及控制措施",
          "已确认防护用品、设备状态与急停位置",
          "已明确操作人、监护人和异常处置口令",
          "方案已提交教师确认，未确认不实施"
        ]),
        table(["学生确认", "同伴互检", "教师确认"], [["签字/时间", "签字/时间", "签字/时间"]])
      ],
      refs: ["KB-04-2", "KB-05-4"]
    },
    {
      id: "wp-do",
      no: "05",
      title: "实施页：按计划做并记录",
      blocks: [
        table(["关键步骤", "操作要点", "实际参数 / 现象", "异常与处理"], [
          ["", "", "", ""],
          ["", "", "", ""],
          ["", "", "", ""],
          ["", "", "", ""]
        ]),
        callout("danger", "停一下", "每个高风险动作前执行「停—看—确认」：停止操作，查看周边与设备状态，向监护人口述确认后再动作。"),
        p("本次实施中出现的错误 / 偏差："),
        lines(3, "记录")
      ],
      refs: ["KB-04-2", "KB-04-4"]
    },
    {
      id: "wp-check",
      no: "06",
      title: "检查页：用标准验收自己的成果",
      blocks: [
        table(["检查项", "标准 / 要求", "自检结果", "互检结果", "修正动作"], [
          ["任务完整性", "交付物齐全、信息完整", "□ 是 □ 否", "□ 是 □ 否", ""],
          ["规范性", "符合给定工艺 / 操作规范", "□ 是 □ 否", "□ 是 □ 否", ""],
          ["质量指标", "达到给定标准", "□ 是 □ 否", "□ 是 □ 否", ""],
          ["安全与 5S", "无违规，工位整洁", "□ 是 □ 否", "□ 是 □ 否", ""],
          ["记录", "真实、完整、可追溯", "□ 是 □ 否", "□ 是 □ 否", ""]
        ]),
        p("如果自检不通过，先判断是“标准理解错误”“操作偏差”还是“资料/设备问题”，再决定修正路径。"),
        p("是否存在无法自行解决的问题？写下你已尝试的办法和需要谁支持。"),
        lines(3, "问题记录")
      ],
      refs: ["KB-04-5", "KB-01-6"]
    },
    {
      id: "wp-evaluate",
      no: "07",
      title: "评价页：证据、反思与改进",
      blocks: [
        table(["维度", "自评", "互评", "教师评", "证据"], [
          ["准备与计划（10）", "", "", "", ""],
          ["实施规范（30）", "", "", "", ""],
          ["成果质量（25）", "", "", "", ""],
          ["安全与 5S（20）", "", "", "", ""],
          ["协作与表达（15）", "", "", "", ""]
        ]),
        ol([
          "这次任务我最有把握的一步是什么？证据是什么？",
          "最需要改进的一步是什么？下一次的具体动作是什么？",
          "我从同伴或教师那里学到了什么可迁移的方法？"
        ]),
        lines(4, "反思记录"),
        p("小组自评签名（组号）：________    日期：____年__月__日")
      ],
      refs: ["KB-04-4", "KB-08-3"]
    }
  ];

  const docs = [];
  if (ctx.materialsOutput !== "workpage") {
    docs.push({
      id: "task-sheet",
      label: "学习任务单",
      title: `${ctx.task} · 学习任务单`,
      filename: `学习任务单_${ctx.task}`,
      meta: [
        { label: "专业", value: ctx.major },
        { label: "课程", value: ctx.course },
        { label: "学时", value: `${ctx.hours} 学时` },
        { label: "用途", value: "学生用" }
      ],
      sections: taskSheetSections
    });
  }
  if (ctx.materialsOutput !== "tasksheet") {
    docs.push({
      id: "work-page",
      label: "工作页",
      title: `${ctx.task} · 六步工作页`,
      filename: `工作页_${ctx.task}`,
      meta: [
        { label: "专业", value: ctx.major },
        { label: "课程", value: ctx.course },
        { label: "版本", value: "课堂使用版 v1.0" },
        { label: "用途", value: "学生用" }
      ],
      sections: workPageSections
    });
  }
  return {
    docs,
    meta: {
      major: ctx.major,
      course: ctx.course,
      task: ctx.task,
      lessonType: ctx.lessonType,
      hours: ctx.hours,
      template: ctx.templateName
    }
  };
}

function buildEvaluation(ctx) {
  const preset = ctx.preset;
  const isClassroom = ctx.evalTemplate === "classroom";
  const isOutcome = ctx.evalTemplate === "outcome";
  const template = EVAL_TEMPLATES.find((item) => item.id === ctx.evalTemplate);
  const baseDims = preset?.assessment || [
    ["任务准备与理解", "10", "资料齐全，能复述任务要求、交付物和验收标准"],
    ["实施过程与规范", "30", "按规范完成关键步骤，操作正确，记录及时完整"],
    ["成果质量与自检", "25", "成果达到给定标准，自检项目完整，能发现并修正问题"],
    ["安全与职业素养", "20", "执行安全确认与防护要求，无违规，5S 到位"],
    ["协作与表达", "15", "分工明确，能依据证据说明方案与结论"]
  ];
  const dims = isClassroom
    ? [
        ["教学设计", "20", "目标可测、任务真实完整、重难点准确、评价前置"],
        ["教学实施", "35", "任务驱动、示范规范、巡回指导、分层支持、时间合理"],
        ["学生参与", "20", "全员参与、协作有效、操作规范、能解决问题"],
        ["评价反馈", "15", "标准明确、证据充分、自评互评有效、反馈可改"],
        ["安全规范", "10", "安全交底、防护到位、风险预控、5S 落实"]
      ]
    : baseDims;
  const title = isClassroom
    ? `${ctx.task} · 课堂观察评价表`
    : isOutcome
      ? `${ctx.task} · 成果评价表`
      : `${ctx.task} · 学业评价表`;
  const objectives = presetObjectives(preset) || genericObjectives(ctx);
  const evidenceMap = [
    ...objectives.knowledge.map((item, i) => [`知识目标 ${i + 1}`, item, "提问 / 识图 / 方案说明"]),
    ...objectives.skills.map((item, i) => [`技能目标 ${i + 1}`, item, "操作观察 / 成果检测 / 排故记录"]),
    ...objectives.qualities.map((item, i) => [`素养目标 ${i + 1}`, item, "安全确认 / 5S / 协作观察"])
  ];

  const sections = [
    {
      id: "eval-info",
      no: "01",
      title: "评价说明与基本信息",
      blocks: [
        table(["项目", "内容"], [
          ["专业 / 课程", `${ctx.major} / ${ctx.course}`],
          ["学习任务", ctx.task],
          ["评价类型", template?.name || "过程性评价"],
          ["适用对象", "本学期授课班级（班级/组号，不写学生姓名）"],
          ["评价目的", "诊断学习证据、改进教学，不作为公开排名依据"],
          ["满分 / 等级", "100 分；优秀 90—100 / 良好 80—89 / 合格 60—79 / 待改进 <60"]
        ]),
        callout("warn", "使用边界", "本表为教学辅助示例。正式执行前请对齐学院现行评价制度、课程实施方案与安全规定，并由任课教师审核。"),
        ...(isClassroom ? [p("课堂观察评分必须附课堂证据。未观察到的指标写“未观察到/待确认”，不要凭印象给分。")] : [])
      ],
      refs: isClassroom ? ["KB-06-1"] : ["KB-08-1", "KB-02-5"]
    },
    {
      id: "eval-goals",
      no: "02",
      title: "评价目标与证据对应",
      blocks: [
        p("评价必须覆盖学习目标；每个目标至少对应一种可收集证据。"),
        table(["目标", "具体描述", "建议证据来源"], evidenceMap)
      ],
      refs: ["KB-01-6", "KB-02-5"]
    },
    {
      id: "eval-weight",
      no: "03",
      title: "评价维度与权重",
      blocks: [
        table(["维度", "权重", "核心观察点"], dims),
        p(`合计：${dims.reduce((sum, row) => sum + Number(row[1]), 0)} 分。`),
        ...(isClassroom
          ? [p("建议记录每个维度的观察事实与时间点，评语引用事实而不评价人格。")]
          : [p("成绩构成建议：过程性评价 60%，终结性评价 40%。权重如需调整，应提前向学生公布。")]),
        callout("note", "先定标准再评价", "评分前确认学生知道标准；评分时先记录证据，再给分；评分后给出至少一条可执行的改进建议。")
      ],
      refs: isClassroom ? ["KB-06-2", "KB-06-3", "KB-06-4", "KB-06-5", "KB-06-6"] : ["KB-08-2"]
    },
    {
      id: "eval-rubric",
      no: "04",
      title: "评分细则（三级行为描述）",
      blocks: [
        table(["维度 / 权重", "优秀（90—100）", "合格（60—89）", "待改进（<60）"], dims.map(([name, weight, criterion]) => {
          const [excellent, pass, fail] = scalesForCriterion(name, criterion);
          return [`${name} / ${weight}`, excellent, pass, fail];
        }))
      ],
      refs: ["KB-08-4", "KB-06-7"]
    },
    {
      id: "eval-subjects",
      no: "05",
      title: "评价主体与记录",
      blocks: [
        table(["评价主体", "建议权重", "职责"], [
          ["教师评价", "60%", "对照标准评分，核实证据，给出改进建议"],
          ["学生自评", "15%", "对照标准写出证据与不足，不随意打分"],
          ["同伴互评", "15%", "基于可观察行为给出具体反馈，避免人情分"],
          ["企业导师（如有）", "10%", "按岗位标准评价，须完成教学与保密培训"]
        ]),
        table(["评价对象（组号）", "教师评", "自评", "互评", "综合得分", "关键证据 / 备注"], [
          ["第 ____ 组", "", "", "", "", ""],
          ["第 ____ 组", "", "", "", "", ""],
          ["第 ____ 组", "", "", "", "", ""]
        ]),
        p("备注中只记录与目标相关的证据，不记录学生家庭情况、健康隐私或与教学无关的评价。")
      ],
      refs: ["KB-08-3"]
    },
    {
      id: "eval-safety",
      no: "06",
      title: "安全一票否决与补做规则",
      blocks: [
        checklist([
          "发现带电作业、短接急停/防护、擅自进入危险区域等严重违规：立即终止操作并按规定处理",
          "未完成安全交底或防护确认：不得开始高风险操作",
          "未达到关键目标：针对未达标目标安排补做，而不是简单重考原题",
          "成绩复核：抽样复核不少于 10%，检查评分尺度一致性"
        ]),
        callout("danger", "人工确认", "一票否决与补做条款必须与学院现行制度一致；本表不能替代正式处理决定。")
      ],
      refs: ["KB-08-5", "KB-05-1"]
    },
    {
      id: "eval-feedback",
      no: "07",
      title: "反馈话术与改进建议",
      blocks: [
        p("反馈采用「事实—标准—影响—下一步」："),
        ul([
          "事实：在____环节，观察到____（次数/时间/成果）。",
          "标准：对照评分项____，要求是____。",
          "影响：这会影响____（质量/安全/效率/学习）。",
          "下一步：下次先做____，用____判断是否改进。"
        ]),
        lines(3, "本次评价的共性改进点"),
        p("评价完成后，建议在下一节课安排 5—10 分钟针对一个共性问题做跟进，并收集新的证据。")
      ],
      refs: ["KB-06-7", "KB-07-4"]
    }
  ];
  return {
    docs: [{
      id: "evaluation",
      label: isClassroom ? "观察表" : "评价表",
      title,
      filename: title,
      meta: [
        { label: "专业", value: ctx.major },
        { label: "课程", value: ctx.course },
        { label: "类型", value: template?.name || "过程性评价" },
        { label: "满分", value: "100 分" }
      ],
      sections
    }],
    meta: {
      major: ctx.major,
      course: ctx.course,
      task: ctx.task,
      template: template?.name || "评价表",
      evalTemplate: ctx.evalTemplate
    }
  };
}

function buildSafety(ctx) {
  const venue = ctx.venue || "未指定实训场所";
  const operation = ctx.operation || "";
  const supported = /电工|PLC|电气|电机|控制线路/i.test(venue);
  const query = `${venue} ${operation} 安全 规程 上电 接线 调试 准入 防护 应急`;
  const retrieval = retrieve(query, { scene: "safety", limit: 12 });
  const relevant = retrieval.results.filter((source) => source.docId === "KB-05" || source.docId === "KB-09");
  const template = [];

  if (!supported) {
    const boundary = getSource("KB-05 §01");
    const compliance = getSource("KB-09 §03");
    template.push({
      id: "safety-miss",
      no: "01",
      title: "查询结果：知识库未收录该场所专项规程",
      blocks: [
        callout("danger", "请勿把本回答当作操作依据", `知识库目前只收录「电工与 PLC 实训室」安全规程，未收录「${venue}」的专项规程。我不能编造该场地的准入、防护或应急处置要求。`),
        p("建议按以下路径获取有依据的答案："),
        ol([
          "查阅该实训室现场上墙的安全制度、设备操作规程和应急预案。",
          "咨询实训中心安全员、设备管理员或该课程负责人，并记录确认人。",
          "核对设备说明书中与本次操作相关的防护、锁定/挂牌和异常处置条款。",
          "在专项规程补齐前，不开展缺乏依据的高风险操作。"
        ]),
        p(`如需查询电工或 PLC 实训室的安全规程，可把场所切换为“电工实训室 / PLC 实训室”。当前操作描述：${operation || "未填写"}。`)
      ],
      refs: [boundary?.ref, compliance?.ref].filter(Boolean)
    });
    template.push({
      id: "safety-boundary",
      no: "02",
      title: "可确认的边界",
      blocks: [
        p(boundary?.snippet || "本知识库仅适用于校内电工、PLC 实训室的示例性教学安全参考。"),
        p("这条边界本身可以作为答复：没有专项依据时，正确做法是停下来、查正式文件、找责任人确认，而不是让 AI 猜一条规程。")
      ],
      refs: [boundary?.ref].filter(Boolean)
    });
    return {
      docs: [{
        id: "safety",
        label: "核查清单",
        title: `${venue} · 安全规程查询`,
        filename: `安全查询_${venue}`,
        meta: [
          { label: "场所", value: venue },
          { label: "操作", value: operation || "未指定" },
          { label: "结果", value: "知识库未覆盖" },
          { label: "建议", value: "咨询安全员" }
        ],
        sections: template
      }],
      meta: { venue, operation, supported: false },
      sourcesOverride: [boundary, compliance].filter(Boolean)
    };
  }

  const emphasis = /上电|通电|调试|接线|PLC/i.test(operation);
  const emergency = /应急|触电|异常|冒烟|起火|伤害/i.test(operation);
  template.push({
    id: "safety-summary",
    no: "01",
    title: "先看结论与适用边界",
    blocks: [
      callout("danger", "不是设备操作票", `以下是知识库《电工与 PLC 实训室安全规程》中的教学提醒，适用于「${venue}」，不能替代现场安全交底、设备说明书和学校应急预案。`),
      p(`你的查询：${operation || "未指定具体操作"}。在知识库范围内，最需要先确认的是：断电/停机与验电确认、上电前教师检查、操作监护以及异常时的立即断电与报告。`),
      p("请先核对：本次操作是否属于教学允许范围？设备状态是否完好？现场是否有具备资质的教师监护？三项任一不满足，应停止操作并报告。")
    ],
    refs: ["KB-05-1", "KB-05-3"]
  });
  template.push({
    id: "safety-pre",
    no: "02",
    title: "准入与作业前核查",
    blocks: [
      checklist([
        "已完成安全教育和准入考核，身体状态适合操作",
        "着装符合要求，长发束起，不佩戴可能引起短路或卷入的饰品",
        "已确认设备状态、导线绝缘、插头、接地、急停与防护装置",
        "已确认总电源、急救箱、灭火器位置和现场应急联系人",
        "小组已明确操作人、监护人、记录人，并完成分工"
      ]),
      callout("warn", "发现异常先停用", "设备故障、导线破损、插头松动时立即停用并报告，不得带故障运行。")
    ],
    refs: ["KB-05-2", "KB-05-3"]
  });
  template.push({
    id: "safety-electrical",
    no: "03",
    title: "用电与接线安全",
    blocks: [
      p("在知识库明确收录的电工/PLC 教学场景中，应执行以下要求："),
      checklist([
        "接线、改线、拆线前必须断电、验电并挂牌确认",
        "严禁带电接线或带电改线",
        "上电前必须经教师检查确认，并按现场口令完成",
        "不得湿手操作电气设备，不得私拉乱接",
        "上电调试设置监护，异常时立即按下急停或断开总电源"
      ]),
      callout("warn", "具体动作以现场规程为准", "断电顺序、验电器使用、挂牌方式和防护用品要求，须按设备说明书与实训中心现行规程执行。")
    ],
    refs: ["KB-05-4"]
  });
  if (/PLC|程序|调试|I\/O/i.test(`${venue} ${operation}`) || !emphasis) {
    template.push({
      id: "safety-plc",
      no: "04",
      title: "PLC 调试补充要求",
      blocks: [
        checklist([
          "程序下载前确认输出负载状态，检查接线与机械动作范围",
          "强制 I/O 必须登记、复核并有人监护",
          "不得短接急停、安全门或互锁装置",
          "机械动作前确认人员离开危险区域，并发出警示口令",
          "修改程序或参数后重新验证，保留版本记录"
        ])
      ],
      refs: ["KB-05-5"]
    });
  }
  template.push({
    id: "safety-emergency",
    no: "05",
    title: "异常与应急处置",
    blocks: [
      p("如出现焦味、冒烟、异常发热、漏电或人员触电，知识库要求："),
      ol([
        "立即切断电源并呼救报告。",
        "人员触电时，在确保自身安全的前提下使其脱离电源，再按急救程序处理。",
        "不直接用手拉拽触电者，不使用金属或潮湿物品施救。",
        "不擅自复位跳闸或重新上电，保护现场并等待专业人员检查。"
      ]),
      callout("danger", "不要凭 AI 处置现场", "具体报警电话、集合点、急救流程以学校现场公示与应急预案为准。涉及人身伤害时优先呼救与报警。")
    ],
    refs: ["KB-05-6"]
  });
  template.push({
    id: "safety-close",
    no: "06",
    title: "收尾与现场确认",
    blocks: [
      checklist([
        "作业结束后断电、验电，按设备要求放电",
        "整理工位、清点工具、关闭电源和气源",
        "填写设备使用记录，执行 5S",
        "经教师确认后方可离开实训室"
      ]),
      table(["确认项目", "操作人", "监护人", "教师"], [
        ["断电/停机并验电", "____", "____", "____"],
        ["工具清点与工位 5S", "____", "____", "____"],
        ["设备记录填写", "____", "____", "____"]
      ])
    ],
    refs: ["KB-05-7"]
  });
  template.push({
    id: "safety-unknown",
    no: "07",
    title: "本回答没有覆盖的内容",
    blocks: [
      p("以下事项不在知识库范围内，必须由现场责任人确认，AI 不应替您作出判断："),
      ul([
        "该具体设备型号的防护用品标准、锁定/挂牌步骤和绝缘检测周期",
        "本次操作是否已办理学校要求的审批或许可",
        "现场应急电话、集合点、急救箱位置与最近的医疗机构",
        "学生个体健康状况是否适合操作（涉及个人隐私与医疗判断）",
        "企业现场或校外实训场所的专项安全制度"
      ]),
      callout("warn", "人工审核提示", "正式用于教学前，请由具备资质的教师或安全员逐项核对，并保留确认记录。")
    ],
    refs: ["KB-05-1", "KB-09-3"]
  });
  return {
    docs: [{
      id: "safety",
      label: "安全核查清单",
      title: `${venue} · ${operation || "实训安全"}核查清单`,
      filename: `安全核查_${venue}`,
      meta: [
        { label: "场所", value: venue },
        { label: "操作", value: operation || "通用" },
        { label: "人员", value: ctx.audience || "学生" },
        { label: "依据", value: "KB-05 电工与 PLC 实训室安全规程" }
      ],
      sections: template
    }],
    meta: { venue, operation, supported: true },
    sourcesOverride: relevant
  };
}

function extractEvidence(text) {
  const segments = String(text || "")
    .split(/[。；！？\n]/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 6)
    .slice(0, 40);
  return segments;
}

function pickEvidence(segments, regex, limit = 2) {
  const hits = segments.filter((segment) => regex.test(segment));
  return hits.slice(0, limit);
}

function buildObservation(ctx) {
  const raw = ctx.observation.trim();
  const segments = extractEvidence(raw);
  const groups = {
    goals: pickEvidence(segments, /(目标|达成|学会|能|完成|正确|成果|检测)/),
    participation: pickEvidence(segments, /(学生|小组|讨论|操作|参与|举手|汇报|展示|互评)/),
    teaching: pickEvidence(segments, /(教师|老师|示范|讲解|提问|巡视|指导|追问|点评)/),
    assessment: pickEvidence(segments, /(评价|反馈|评分|量表|自评|互评|纠错|标准)/),
    safety: pickEvidence(segments, /(安全|防护|断电|验电|急停|5S|规范|违规)/)
  };
  const has = (key) => groups[key].length > 0;
  const evidenceRows = [
    ["目标达成", groups.goals.length ? groups.goals.join("；") : "记录中未见直接描述", "有证据 / 待确认"],
    ["学生参与", groups.participation.length ? groups.participation.join("；") : "记录中未见直接描述", "有证据 / 待确认"],
    ["教师指导", groups.teaching.length ? groups.teaching.join("；") : "记录中未见直接描述", "有证据 / 待确认"],
    ["评价反馈", groups.assessment.length ? groups.assessment.join("；") : "记录中未见直接描述", "有证据 / 待确认"],
    ["安全规范", groups.safety.length ? groups.safety.join("；") : "记录中未见直接描述", "有证据 / 待确认"]
  ];
  const strengthEvidence = [
    ...groups.participation.slice(0, 1),
    ...groups.teaching.slice(0, 1),
    ...groups.goals.slice(0, 1)
  ];
  const missing = Object.entries(groups).filter(([, value]) => !value.length);
  const focus = ctx.focus || "目标达成、学生参与、评价反馈、安全规范";
  const template = OBSERVATION_TEMPLATES.find((item) => item.id === ctx.observationTemplate);
  const strengths = strengthEvidence.length
    ? strengthEvidence.map((sentence, index) => `证据 ${index + 1}：${sentence}。评课时可把它作为事实陈述，并补充它对应哪一条学习目标。`)
    : ["当前记录中可提取的课堂事实较少，暂不生成“亮点”，以免无依据拔高。建议先补充 2—3 个具体片段（时间、人物角色、行为、结果）。"];
  const gaps = missing.length
    ? missing.map(([key]) => {
        const label = { goals: "目标达成", participation: "学生参与", teaching: "教师指导", assessment: "评价反馈", safety: "安全规范" }[key];
        return `记录中缺少「${label}」的直接证据。`;
      })
    : ["五类观察点均有记录片段，但仍需核对证据是否足以支持评分。"];
  const recommendations = [];
  if (!has("assessment")) recommendations.push("补记评价证据：在哪个环节、用什么标准、学生如何自评互评、教师如何反馈。没有这部分，很难判断“目标是否真正达成”。");
  if (!has("safety")) recommendations.push("补记安全观察：安全交底、防护穿戴、风险确认、教师监护与收尾 5S，至少记录 2 个时间点。");
  if (!has("participation")) recommendations.push("记录学生实际行为：参与人数、分工、操作与提问，而不只记录教师讲授内容。");
  recommendations.push("把评课意见压缩成「2 条亮点证据 + 2 条问题 + 1 个高杠杆改进动作」，并说明如何验证改进有效。");
  recommendations.push("正式分享前删除姓名、班级、联系方式等身份信息；录音录像须告知并获得授权。");

  const sections = [
    {
      id: "obs-boundary",
      no: "01",
      title: "记录边界与观察信息",
      blocks: [
        table(["项目", "内容"], [
          ["课程 / 任务", `${ctx.course} · ${ctx.task}`],
          ["观察重点", focus],
          ["反馈风格", template?.name || "证据型评课"],
          ["记录字数", `${raw.length} 字`],
          ["基本原则", "只基于提供的记录作判断；未观察到就标注“待确认”，不虚构课堂事实"]
        ]),
        callout("warn", "请先确认脱敏", "如果您提供的记录中包含教师或学生姓名、班级、联系方式，请先删除后再用于评课或分享。本工具不会上传内容，但仍建议遵守最小化原则。"),
        p("以下整理不替代现场听课与教研讨论。没有证据支撑的指标，不给出分数。")
      ],
      refs: ["KB-07-1", "KB-09-1"]
    },
    {
      id: "obs-evidence",
      no: "02",
      title: "课堂证据提取",
      blocks: [
        table(["观察维度", "记录中的事实片段", "证据状态"], evidenceRows),
        p("注意：表中的“有证据”仅表示记录里出现了相关描述，不代表该维度已经达成标准；判断达成度还需对照学习目标与成果。")
      ],
      refs: ["KB-07-2"]
    },
    {
      id: "obs-strength",
      no: "03",
      title: "可用的亮点证据",
      blocks: [
        ...(strengthEvidence.length ? [ul(strengths)] : [callout("note", "暂不生成亮点", strengths[0])]),
        p("评课表达建议：先陈述事实，再说明它对应的评价指标，最后说明可能的学习影响。不要用“气氛好”“很精彩”替代证据。")
      ],
      refs: ["KB-07-3"]
    },
    {
      id: "obs-gaps",
      no: "04",
      title: "证据缺口与待确认问题",
      blocks: [
        ul(gaps),
        p("以下问题建议在评课前向授课教师或学生确认，而不是直接下结论："),
        ol([
          "本节课的核心目标是什么？哪个成果可以作为达成证据？",
          "哪些学生出现了困难？教师提供了什么支持？",
          "评价标准是否课前公开？学生的自评互评如何发生？",
          "安全交底和监护由谁负责？是否有异常处置记录？"
        ]),
        callout("warn", "不做评分", "当前记录不足以支撑 100 分制评分。请补齐证据后再使用课堂评价表；把“证据不足”如实写出来，比给出虚假的精确分数更专业。")
      ],
      refs: ["KB-07-3", "KB-06-1"]
    },
    {
      id: "obs-improve",
      no: "05",
      title: "改进建议（按优先级）",
      blocks: [
        ol(recommendations),
        p("建议只选一个改进点作为下一轮教研跟进，并在课后收集新证据验证。"),
        table(["改进动作", "责任人", "完成时间", "验证证据"], [
          ["补齐课堂证据记录", "", "", ""],
          ["选择一个高杠杆改进点", "", "", ""],
          ["下一次听课验证", "", "", ""]
        ])
      ],
      refs: ["KB-07-4"]
    },
    {
      id: "obs-comment",
      no: "06",
      title: "评课意见草稿",
      blocks: [
        p(`【总体印象】本节课围绕「${ctx.task}」展开，记录中可见的教学事实包括：${segments.slice(0, 3).join("；") || "记录信息较少，建议补充具体片段"}。由于部分维度证据不足，本次仅提出改进建议，不给出评分。`),
        p(`【亮点】${strengthEvidence.length ? strengthEvidence.map((item) => `“${item}”`).join("；") : "待补充课堂证据后确认"}。`),
        p(`【主要问题】${gaps.join(" ")}`),
        p(`【改进建议】${recommendations.slice(0, 2).join(" ")}`),
        p("【安全合规】评课材料须脱敏；涉及教师个人信息的内容仅在校内教研范围内使用。")
      ],
      refs: ["KB-06-7", "KB-07-3", "KB-09-1"]
    }
  ];
  return {
    docs: [{
      id: "observation",
      label: "评课意见",
      title: `${ctx.task} · 听评课意见`,
      filename: `听评课意见_${ctx.task}`,
      meta: [
        { label: "课程", value: ctx.course },
        { label: "观察重点", value: focus },
        { label: "反馈风格", value: template?.name || "证据型评课" },
        { label: "评分", value: "证据不足，暂不评分" }
      ],
      sections
    }],
    meta: {
      course: ctx.course,
      task: ctx.task,
      focus,
      observationTemplate: template?.name || "证据型评课"
    }
  };
}

function detectSensitiveInput(text) {
  const value = String(text || "");
  const findings = [];
  if (/(?<!\d)1[3-9]\d{9}(?!\d)/.test(value)) findings.push("疑似手机号");
  if (/(?<!\d)\d{17}[\dXx](?!\d)/.test(value)) findings.push("疑似身份证号");
  if (/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(value)) findings.push("疑似邮箱");
  if (/(姓名|学生姓名|家长姓名)\s*[：:]\s*[\u4e00-\u9fa5]{2,4}/.test(value)) findings.push("疑似姓名");
  if (/(学号)\s*[：:]?\s*\d{6,}/.test(value)) findings.push("疑似学号");
  return findings;
}

function buildCompliance(ctx, inputText, extraWarnings = []) {
  const risk = detectSensitiveInput(inputText);
  const checks = [
    {
      status: "pass",
      title: "默认本地处理",
      detail: "本工具默认不向服务器发送输入；生成记录只保存在当前浏览器。"
    },
    {
      status: risk.length ? "warn" : "pass",
      title: risk.length ? "发现疑似个人信息" : "未发现明显个人信息",
      detail: risk.length
        ? `检测到：${risk.join("、")}。请立即删除或脱敏后再导出、分享。`
        : "未检测到手机号、身份证号、邮箱或“姓名：”等明显格式；仍请人工确认文本中是否包含可识别信息。"
    },
    {
      status: "warn",
      title: "必须人工审核",
      detail: "学习目标、设备参数、安全条款、评价权重和企业标准须由教师逐项核对后使用。"
    },
    {
      status: "warn",
      title: "安全内容不替代现场交底",
      detail: "涉及实训安全时，以实训中心现行规程、设备说明书和现场教师确认为准。"
    }
  ];
  extraWarnings.forEach((warning) => checks.push({ status: "warn", title: warning.title, detail: warning.detail }));
  return {
    status: checks.some((item) => item.status === "warn") ? "review" : "pass",
    checks,
    risk
  };
}

function workflowFor(scene, ctx) {
  const docs = KB_DOCS.length;
  const map = {
    lesson: [
      ["读取任务与学情约束", `${ctx.major} · ${ctx.lessonType} · ${ctx.hours} 学时`],
      ["检索课程与教案依据", `匹配 ${docs} 份知识库材料`],
      ["对齐学习目标与评价证据", "检查目标—活动—评价一致性"],
      ["生成教学流程与评价表", `按 ${ctx.templateName} 组装`],
      ["安全与合规自检", "标记需人工核验的字段"]
    ],
    materials: [
      ["解析任务与交付物", `${ctx.task}`],
      ["检索任务单 / 工作页规范", "六步结构与问题链规则"],
      ["生成学生版目标与步骤", "保留记录与自检留白"],
      ["嵌入安全确认", "高风险动作前置检查"],
      ["隐私与格式自检", "检查姓名、学号等字段"]
    ],
    evaluate: [
      ["对齐课程目标", `${ctx.course} · ${ctx.task}`],
      ["检索评价制度与量表", "过程性 60% + 终结性 40%"],
      ["生成维度与权重", "合计 100 分"],
      ["编写可观察评分细则", "优秀 / 合格 / 待改进"],
      ["合规与公平性自检", "检查排名、标签与隐私风险"]
    ],
    safety: [
      ["识别场所与操作", `${ctx.venue || "未指定场所"}`],
      ["检索安全规程", "只返回知识库原文可支持的内容"],
      ["核对适用边界", "未收录场景明确说明"],
      ["生成核查清单", "附应急处置与人工确认项"],
      ["安全合规自检", "不替代现场交底"]
    ],
    observe: [
      ["清理与检查记录", "识别可用的课堂事实"],
      ["提取五维证据", "目标 / 参与 / 指导 / 评价 / 安全"],
      ["区分事实与判断", "证据不足处标注待确认"],
      ["生成评课意见", "亮点、问题与改进建议"],
      ["隐私与评分自检", "拒绝无依据评分"]
    ]
  };
  return (map[scene] || map.lesson).map(([label, detail], index) => ({ index: index + 1, label, detail, status: "waiting" }));
}

/**
 * 生成结构化成果。
 */
export function generate(scene, rawParams) {
  const ctx = normalizeContext(scene, rawParams);
  let built;
  let sourcesOverride = null;
  if (scene === "lesson") built = buildLesson(ctx);
  else if (scene === "materials") built = buildMaterials(ctx);
  else if (scene === "evaluate") built = buildEvaluation(ctx);
  else if (scene === "safety") {
    built = buildSafety(ctx);
    sourcesOverride = built.sourcesOverride || null;
  } else if (scene === "observe") built = buildObservation(ctx);
  else built = buildLesson(ctx);

  const allRefs = [];
  built.docs.forEach((doc) => doc.sections.forEach((section) => (section.refs || []).forEach((ref) => allRefs.push(ref))));
  let sourceMap;
  if (sourcesOverride && sourcesOverride.length) {
    sourceMap = new Map();
    sourcesOverride.forEach((source) => {
      if (source && !sourceMap.has(source.key)) sourceMap.set(source.key, source);
    });
    allRefs.forEach((ref) => {
      const source = getSource(ref);
      if (source && !sourceMap.has(source.key)) sourceMap.set(source.key, source);
    });
  } else {
    sourceMap = sourceSet(allRefs);
  }
  const sources = Array.from(sourceMap.values());
  const rawAll = [
    ctx.major, ctx.course, ctx.task, ctx.learners, ctx.resources, ctx.notes,
    ctx.operation, ctx.audience, ctx.focus, ctx.observation
  ].join("\n");
  const compliance = buildCompliance(ctx, rawAll, built.warnings || []);

  const sceneInfo = SCENES.find((item) => item.id === scene);
  const label = sceneInfo?.label || "教学工作流";
  const docNames = built.docs.map((doc) => doc.label).join(" / ");
  const introMap = {
    lesson: `已按「${ctx.templateName}」生成《${ctx.task}》教学设计，共 ${built.docs[0].sections.length} 个模块。结构和流程可直接修改，但我不能替您确认设备参数、企业标准与安全条款——这三类内容请重点人工核对。`,
    materials: `已生成 ${docNames}，按六步工作过程组织，并保留学生记录、自检与安全确认空间。任务情境与设备清单请按真实教学条件替换；学生姓名、学号等信息不要写入。`,
    evaluate: `已生成《${built.docs[0].title}》，权重合计 100 分，附三级评分细则和证据来源。正式使用前请对齐学院现行评价制度，并确认评分尺度一致。`,
    safety: built.meta.supported
      ? `已基于知识库《电工与 PLC 实训室安全规程》整理安全核查清单。每一条都可以展开查看原文依据；超出知识库范围的事项已单独列出，请咨询现场安全员，不要让我猜。`
      : `知识库没有收录「${ctx.venue}」的专项规程，所以我不编造答案。以下是明确的能力边界和获取依据的路径。`,
    observe: `已把您提供的听课记录整理为证据型评课意见。记录中没有出现的课堂事实，我标注为“待确认”，没有给出无依据的分数。`
  };
  const suggestionsMap = {
    lesson: [
      { label: "配套生成任务单与工作页", scene: "materials", action: "scene" },
      { label: "生成评价表", scene: "evaluate", action: "scene" },
      { label: "调整参数后重生成", action: "edit-params" }
    ],
    materials: [
      { label: "配套生成教案", scene: "lesson", action: "scene" },
      { label: "生成评价表", scene: "evaluate", action: "scene" },
      { label: "调整参数后重生成", action: "edit-params" }
    ],
    evaluate: [
      { label: "查看课堂评价依据", action: "kb", payload: "KB-06" },
      { label: "配套生成教案", scene: "lesson", action: "scene" },
      { label: "调整参数后重生成", action: "edit-params" }
    ],
    safety: [
      { label: "查看安全规程原文", action: "kb", payload: "KB-05" },
      { label: "换一个场所查询", scene: "safety", action: "scene" },
      { label: "生成配套教案", scene: "lesson", action: "scene" }
    ],
    observe: [
      { label: "查看评课框架", action: "kb", payload: "KB-07" },
      { label: "换一份记录", scene: "observe", action: "scene" },
      { label: "生成课堂评价表", scene: "evaluate", action: "scene" }
    ]
  };

  const generatedAt = new Date();
  const templateLabel = scene === "safety"
    ? "安全核查清单"
    : scene === "materials"
      ? ctx.materialsOutput === "workpage" ? "六步工作页" : ctx.materialsOutput === "tasksheet" ? "学习任务单" : "任务单 / 工作页"
      : ctx.templateName;
  const metaSummary = scene === "safety"
    ? [ctx.venue, ctx.audience, ctx.focus]
    : scene === "observe"
      ? [ctx.course !== "未填写课程" ? ctx.course : "", ctx.focus, templateLabel]
      : scene === "evaluate"
        ? [ctx.major !== "未填写专业" ? ctx.major : "", ctx.course !== "未填写课程" ? ctx.course : "", templateLabel]
        : [
            ctx.major !== "未填写专业" ? ctx.major : "",
            ctx.course !== "未填写课程" ? ctx.course : "",
            ctx.hours ? `${ctx.hours} 学时` : "",
            templateLabel
          ];
  return {
    id: `gen_${generatedAt.getTime().toString(36)}`,
    scene,
    sceneLabel: label,
    title: built.docs[0]?.title || `${ctx.task} · ${label}`,
    intro: introMap[scene] || `已生成 ${docNames}。`,
    context: ctx,
    artifact: {
      ...built,
      generatedAt: generatedAt.toISOString(),
      template: templateLabel,
      sources,
      compliance,
      scene,
      sceneLabel: label
    },
    sources,
    compliance,
    workflow: workflowFor(scene, ctx),
    suggestions: suggestionsMap[scene] || [],
    metaSummary: metaSummary.filter(Boolean),
    isLocal: true
  };
}

function capabilityReply() {
  return {
    type: "chat",
    text: "我是**匠备**，只做工学一体化备课与实训教学这一件事。\n\n**我能做：**\n- 根据「专业 + 工作任务 + 学情」生成教案、学习任务单、工作页和评价表；\n- 从实训安全规程知识库中检索有依据的条款；\n- 把脱敏后的听课记录整理成结构化评课意见；\n- 记住本次对话的条件，支持中途改学时、课型、模板等参数。\n\n**我不做：**\n- 学生心理诊断、成绩预测、排名或标签化；\n- 人事、财务、法律、医疗判断；\n- 处理涉密、未脱敏的校内数据；\n- 替代教师做最终教学决定。\n\n超出范围时我会明确说“不在我的知识范围内”，并建议咨询对应部门。",
    sources: []
  };
}

function scopeReply(text) {
  for (const rule of OUT_OF_SCOPE_RULES) {
    if (rule.test.test(text)) {
      return { type: "chat", text: rule.reply, sources: [], tag: rule.tag };
    }
  }
  const hasDomain = DOMAIN_WORDS.some((word) => text.includes(word));
  if (!hasDomain) {
    return {
      type: "chat",
      text: "这个问题**不在我的知识范围内**。我只服务工学一体化课程备课、学习任务设计、评价与实训安全查询。\n\n如果它属于学生事务，建议咨询班主任或学生工作部门；属于人事/财务/法务，建议咨询对应职能部门。\n\n您可以换一种方式问我，例如：\n- “帮我生成一份正反转控制线路的教案”\n- “电工实训室上电前要确认什么？”\n- “把这段听课记录整理成评课意见”",
      sources: []
    };
  }
  return null;
}

function generationMissingReply(text) {
  if (!/(生成|写|做|出|帮我).*(教案|任务单|工作页|评价表|评课|安全)/.test(text)) return null;
  const isSafety = /安全|规程/.test(text);
  const isObserve = /听课|评课/.test(text);
  if (isObserve) {
    return {
      type: "clarify",
      text: "可以。为了不让评课意见变成泛泛而谈，我需要先看您的听课记录，并确认一个观察重点。\n\n请提供（已脱敏）：\n1. 课程 / 学习任务是什么？\n2. 您记录到的 2—3 个具体课堂片段；\n3. 本次最关注：目标达成、学生参与、评价反馈，还是安全规范？\n\n您也可以直接打开参数表单，我会按字段逐步询问。",
      scene: "observe",
      sources: [],
      suggestions: [{ label: "打开听课评课表单", scene: "observe", action: "scene" }]
    };
  }
  if (isSafety) {
    return {
      type: "clarify",
      text: "可以。安全类问题我只会回答知识库里有的内容。请告诉我：\n1. 哪个实训场所（目前知识库覆盖电工 / PLC 实训室）；\n2. 具体操作或设备；\n3. 面向学生还是新教师。\n\n如果场所没有收录，我会直接说明，并建议您咨询安全员，不会编造规程。",
      scene: "safety",
      sources: [],
      suggestions: [{ label: "打开安全查询表单", scene: "safety", action: "scene" }]
    };
  }
  if (/教案|任务单|工作页|评价表/.test(text)) {
    return {
      type: "clarify",
      text: "可以，但在生成前我需要确认 4 个关键条件，避免给您一份“看起来完整、实际上不能用”的模板：\n\n1. **专业 / 课程**是什么？\n2. **具体工作任务**是什么？\n3. **课型与学时**（理论 / 实训 / 一体化；几学时）？\n4. **学情**：学生已学过什么、常见困难、设备台套数？\n\n您可以直接在对话里补充，例如：“电气自动化，正反转控制线路，一体化，4 学时，学生已学安全用电但接线不熟”。也可以打开参数表单，一次填完。",
      scene: /任务单|工作页/.test(text) ? "materials" : /评价表/.test(text) ? "evaluate" : "lesson",
      sources: [],
      suggestions: [
        { label: "打开参数表单", scene: /任务单|工作页/.test(text) ? "materials" : /评价表/.test(text) ? "evaluate" : "lesson", action: "scene" },
        { label: "看我需要哪些参数", action: "requirements" }
      ]
    };
  }
  return null;
}

function unsupportedSafetyReply(text) {
  const safetyIntent = /(安全|规程|上电|通电|接线|调试|防护|急停|触电|应急|准入)/.test(text);
  if (!safetyIntent) return null;
  const supported = /(电工|PLC|电气|电动机|电机|控制线路)/i.test(text);
  const unsupportedVenues = [
    ["数控", "数控实训室"],
    ["汽车", "汽车实训室"],
    ["机器人", "工业机器人实训室"],
    ["烹饪", "烹饪实训室"],
    ["焊接", "焊接实训室"],
    ["化工", "化工实训室"],
    ["建筑", "建筑实训场所"],
    ["校外", "校外实训场所"],
    ["企业", "企业生产现场"]
  ];
  const venue = unsupportedVenues.find(([keyword]) => text.includes(keyword));
  if (!venue || supported) return null;
  const boundary = getSource("KB-05 §01");
  const review = getSource("KB-09 §03");
  return {
    type: "chat",
    text: `知识库里**没有收录「${venue[1]}」的专项安全规程**，我不会把电工 / PLC 的要求直接套到该场所。\n\n可以确认的边界：\n> 本知识库仅适用于电工、PLC 实训室的示例性教学安全参考，不覆盖数控、汽车、工业机器人、化工等场所；实际执行必须以现场上墙制度、设备说明书和指导教师交底为准。\n\n建议按以下路径获取有依据的答案：\n1. 查阅该场所的安全制度、设备操作规程和应急预案；\n2. 咨询实训中心安全员或设备管理员，并记录确认人；\n3. 核对设备说明书中与本次操作相关的防护、锁定 / 挂牌和异常处置条款；\n4. 在专项规程补齐前，不开展缺乏依据的高风险操作。\n\n如果您要查电工或 PLC 实训室，我可以继续检索知识库。`,
    sources: [boundary, review].filter(Boolean),
    tag: "知识库未覆盖"
  };
}

function kbAnswer(text) {
  const query = `${text} 教学 知识库`;
  const { results } = retrieve(query, { limit: 4 });
  const strong = results.filter((item) => item.score >= 3);
  const selected = (strong.length ? strong : results).slice(0, 3);
  if (!selected.length) {
    return {
      type: "chat",
      text: "我在知识库里**没有找到能支持这个问题的依据**，所以不编造答案。\n\n当前知识库覆盖：课程标准与教案结构、任务单/工作页、课堂与学业评价、电工/PLC 实训安全、听课评课、数据合规。若问题涉及具体设备型号、企业标准或未收录的实训场所，建议查阅设备说明书或咨询实训中心 / 教务处。",
      sources: []
    };
  }
  const blocks = selected.map((item, index) => {
    const bullets = [];
    const section = getSection(item.docId, item.sectionId);
    if (section?.bullets?.length) bullets.push(...section.bullets.slice(0, 2));
    return `**${index + 1}. ${item.docTitle} · 第 ${item.sectionNo} 节「${item.sectionTitle}」**\n> ${item.snippet}${bullets.length ? `\n${bullets.map((bullet) => `- ${bullet}`).join("\n")}` : ""}`;
  });
  const safetyNote = /安全|触电|上电|应急|防护|规程/.test(text)
    ? "\n\n**边界提醒：** 这里只整理知识库已有条款；具体设备型号、现场应急电话和审批要求必须由具备资质的教师或安全员确认，不能把这段回答当作操作票。"
    : "";
  return {
    type: "chat",
    text: `我在知识库里找到了 ${selected.length} 处直接依据，按相关度整理如下：\n\n${blocks.join("\n\n")}${safetyNote}\n\n以上只覆盖知识库收录范围；没有引用的内容我不会补写。`,
    sources: selected,
    tag: "知识库检索"
  };
}

export function detectInputRisk(text) {
  return detectSensitiveInput(text);
}

/**
 * 检测用户是否在修改已有参数。
 */
export function detectParamEdits(text, context = {}) {
  const changes = {};
  const labels = [];
  let hoursMatch = text.match(/(\d{1,2})\s*(?:个)?学时/);
  if (!hoursMatch) hoursMatch = text.match(/(?:学时|课时)[^0-9]{0,8}(\d{1,2})/);
  if (hoursMatch && /(改|换|调整|变成|设为|改为|改成|用)/.test(text)) {
    const hours = clamp(Number.parseInt(hoursMatch[1], 10), 1, 24);
    if (hours !== context.hours) {
      changes.hours = String(hours);
      labels.push(`学时 → ${hours}`);
    }
  }
  if (/(课型|类型)/.test(text) && /(改|换|调整|变成|设为|改为|改成)/.test(text)) {
    const type = ["一体化", "实训", "理论"].find((item) => text.includes(item));
    if (type && type !== context.lessonType) {
      changes.lessonType = type;
      labels.push(`课型 → ${type}`);
    }
  }
  if (/(模板|样式)/.test(text) && /(改|换|调整|变成|设为|用)/.test(text)) {
    const template = LESSON_TEMPLATES.find((item) => text.includes(item.name) || (item.id === "standard" && text.includes("标准")) || (item.id === "task-driven" && text.includes("任务驱动")) || (item.id === "showcase" && /公开课|展示/.test(text)));
    if (template && template.id !== context.templateId) {
      changes.template = template.id;
      labels.push(`模板 → ${template.name}`);
    }
  }
  const majorMatch = text.match(/专业\s*(?:改成|改为|换成|调整为|设为)\s*[：: ]?([^\n，。；]{2,30})/);
  if (majorMatch) {
    changes.major = majorMatch[1].trim();
    labels.push(`专业 → ${changes.major}`);
  }
  const courseMatch = text.match(/课程\s*(?:改成|改为|换成|调整为|设为)\s*[：: ]?([^\n，。；]{2,40})/);
  if (courseMatch) {
    changes.course = courseMatch[1].trim();
    labels.push(`课程 → ${changes.course}`);
  }
  const taskMatch = text.match(/(?:工作任务|学习任务|任务)\s*(?:改成|改为|换成|调整为|设为)\s*[：: ]?([^\n，。；]{3,60})/);
  if (taskMatch) {
    changes.task = taskMatch[1].trim();
    labels.push(`工作任务 → ${changes.task}`);
  }
  if (/(补充|加入|增加|加上|注意)/.test(text) && /(要求|安全|思政|注意|强调|不能)/.test(text) && text.length < 260) {
    const note = text.replace(/^(补充|加入|增加|加上)[:：，,\s]*/, "").trim();
    if (note.length >= 4) {
      changes.notes = [context.notes, note].filter(Boolean).join("；");
      labels.push("补充要求已加入");
    }
  }
  return { changes, labels };
}

/**
 * 对话回复：边界判断、追问、知识库问答、结果解释。
 */
export function chatReply(text, conversation = {}) {
  const input = String(text || "").trim();
  if (!input) return { type: "chat", text: "请先输入问题。", sources: [] };
  const risk = detectSensitiveInput(input);
  if (risk.length) {
    return {
      type: "chat",
      text: `我检测到输入中可能包含**${risk.join("、")}**。为了数据安全，我不会把它发送到任何地方，也建议您立即删除或替换为组号/化名。\n\n请脱敏后重新发送问题；如果只是生成教案，不需要学生个人身份信息。`,
      sources: [],
      tag: "隐私保护"
    };
  }
  if (/^(你好|您好|hi|hello|hey|在吗|早上好|下午好|晚上好)[！!。.\s]*$/i.test(input)) {
    return {
      type: "chat",
      text: "Hey，老师！我在。\n\n我可以帮您把工作任务变成教案、任务单、工作页或评价表，也可以查电工 / PLC 实训安全规程、整理听课记录。\n\n您想从哪一件开始？如果不确定，点下方场景入口，我会先问清专业、任务、学时和学情，再开始生成。",
      sources: []
    };
  }
  if (/(你是谁|能做什么|会做什么|有什么功能|怎么用(这个|你|匠备|本工具|系统)|使用说明|能力边界|不能做什么|服务范围)/.test(input)) {
    return capabilityReply();
  }
  if (/(导出|下载|word|pdf|打印|复制)/i.test(input)) {
    return {
      type: "chat",
      text: "结果生成后，您可以在文档工具栏使用：\n\n- **复制当前模块**：每个小节右上角有“复制”按钮；\n- **复制全文**：复制当前文档；\n- **导出 Word**：导出 `.doc` 文件，可直接用 Word 打开修改；\n- **打印 / PDF**：打开打印面板，选择“另存为 PDF”。\n\n历史对话会自动保存在本机浏览器，可在左侧“历史对话”找回。导出前请再次检查是否含姓名、学号等个人信息。",
      sources: []
    };
  }
  if (/(知识库|材料|依据|资料来源|几份)/.test(input)) {
    return {
      type: "chat",
      text: `当前使用的是「匠备 · ${KB_VERSION}」示例知识库，共 **${KB_DOCS.length} 份材料、${totalSections()} 个可检索片段**，覆盖：\n\n- 课程与课标：KB-01；\n- 教案 / 任务单 / 工作页：KB-02—KB-04；\n- 实训安全：KB-05（仅电工 / PLC 实训室）；\n- 课堂与学业评价：KB-06—KB-08；\n- 听课评课：KB-07；\n- 数据合规与 AI 边界：KB-09。\n\n每个回答的来源会显示在消息下方；点击可查看原文片段。知识库是示例版，正式使用需替换为学院现行文件。`,
      sources: []
    };
  }
  const missing = generationMissingReply(input);
  if (missing) return missing;

  const contextScene = conversation.context?.scene;
  const hasArtifact = conversation.latestArtifact;
  if (hasArtifact && /(这个|刚才|上面|结果|方案|教案|评价表|任务单|工作页|安全|哪|为什么|怎么改|改成|调整|换成|补充|增加|加入)/.test(input) && input.length < 220) {
    const edits = detectParamEdits(input, conversation.context || {});
    if (edits.labels.length) {
      return {
        type: "param-update",
        text: `收到，我会把以下条件更新到本次任务：**${edits.labels.join("；")}**。其余条件保持不变，然后按新参数重新生成。`,
        changes: edits.changes,
        labels: edits.labels,
        sources: []
      };
    }
  }

  const scoped = scopeReply(input);
  if (scoped) return scoped;

  const unsupportedSafety = unsupportedSafetyReply(input);
  if (unsupportedSafety) return unsupportedSafety;

  if (/(这个|刚才|上面).*(怎么样|好不好|行不行|评价)|帮我检查|自检/.test(input) && hasArtifact) {
    return {
      type: "chat",
      text: "我建议按以下顺序检查本次成果：\n\n1. **目标—评价一致性**：每条学习目标是否都有对应评价证据？\n2. **时间与工位**：流程时间合计是否等于总学时？设备台套数能否支撑分组？\n3. **安全边界**：安全条款是否逐条对齐实训中心规程和设备说明书？\n4. **数据合规**：是否出现学生姓名、学号、企业未公开信息？\n5. **可执行性**：没到现场的教师能否按这份方案上课？\n\n右侧“合规自检”已列出通用检查项。请注意，它不能替代您的专业判断。",
      sources: retrieve("教学评价 目标 一致性 安全 人工审核", { limit: 3 }).results
    };
  }

  if (contextScene && /(再|重新|换|改|调整)/.test(input) && input.length > 40) {
    return {
      type: "chat",
      text: "如果要调整已生成的内容，您可以直接说“把学时改成 6”“课型换成实训”“模板换成任务驱动简案”，我会保留其他条件并重新生成；也可以点结果下方的“调整参数”逐项修改。",
      sources: []
    };
  }

  return kbAnswer(input);
}

export function getContextSummary(context = {}) {
  return [
    context.major,
    context.course,
    context.task,
    context.lessonType,
    context.hours ? `${context.hours} 学时` : "",
    context.venue
  ].filter(Boolean).join(" · ");
}

export { KB_DOCS, KB_VERSION, SCENES, LESSON_TEMPLATES, EVAL_TEMPLATES, OBSERVATION_TEMPLATES };