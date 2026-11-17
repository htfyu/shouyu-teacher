/**
 * 授渔 · 可解释教学质量检测
 *
 * 原则：
 * 1. 分数来自规则、结构指标和可定位证据，不让大模型随口打分；
 * 2. 不能自动判断的专业内容标为“需人工审核”；
 * 3. 跨文档一致性检查与单文档完整性检查分开呈现；
 * 4. 自动修复只处理可确定的结构问题，专业内容修改仍由教师完成。
 */

export const DEFAULT_QUALITY_WEIGHTS = {
  objectives_completeness: 10,
  objectives_evaluable: 10,
  content_accuracy: 15,
  professional_match: 12,
  task_authenticity: 10,
  activity_reasonableness: 10,
  practical_completeness: 10,
  safety: 8,
  assessment_alignment: 8,
  resource_consistency: 7
};

const DIMENSION_LABELS = {
  objectives_completeness: "教学目标完整性",
  objectives_evaluable: "教学目标可评价性",
  content_accuracy: "教学内容准确性",
  professional_match: "专业知识匹配度",
  task_authenticity: "工作任务真实性",
  activity_reasonableness: "教学活动合理性",
  practical_completeness: "实训流程完整性",
  safety: "操作安全规范性",
  assessment_alignment: "教学评价匹配度",
  resource_consistency: "教学资源一致性"
};

const SEVERITY_LABEL = { high: "高", medium: "中", low: "低" };

function clone(value) {
  return typeof structuredClone === "function" ? structuredClone(value) : JSON.parse(JSON.stringify(value));
}

function text(value) {
  return String(value ?? "").trim();
}

function normalize(value) {
  return text(value).replace(/\s+/g, "");
}

function flattenBlock(block) {
  if (!block) return "";
  if (block.type === "paragraph" || block.type === "callout") return text(block.text);
  if (block.type === "list" || block.type === "checklist") return (block.items || []).join(" ");
  if (block.type === "table") return [...(block.headers || []), ...(block.rows || []).flat()].join(" ");
  if (block.type === "lines") return text(block.label);
  return "";
}

function docText(doc) {
  return (doc?.sections || []).map((section) => [section.title, ...(section.blocks || []).map(flattenBlock)].join(" ")).join(" ");
}

function allText(bundle) {
  return (bundle?.artifact?.docs || []).map(docText).join(" ");
}

function knowledgeOf(bundle) {
  return bundle?.knowledge || bundle?.context?.knowledge || null;
}

function titleTokens(value) {
  return text(value)
    .replace(/[（）()、，,。；;：:/／\-]/g, " ")
    .split(/\s+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2)
    .slice(0, 5);
}

function textHasKnowledgeTitle(textValue, title) {
  const haystack = normalize(textValue);
  const needle = normalize(title);
  if (!needle) return false;
  if (haystack.includes(needle)) return true;
  const tokens = titleTokens(title).map(normalize).filter(Boolean);
  if (!tokens.length) return false;
  const hits = tokens.filter((token) => haystack.includes(token)).length;
  return hits >= Math.min(2, tokens.length);
}

function extractParameters(value) {
  const matches = String(value || "").match(/(?<![A-Za-z0-9])-?\d+(?:\.\d+)?\s*(?:mm|cm|m|V|A|mA|MPa|bar|kg|N·m|N|Hz|ms|s|℃|°C|轴|工位|次)(?![A-Za-z0-9])/gi) || [];
  return Array.from(new Set(matches.map((item) => item.replace(/\s+/g, ""))));
}

function expertReviewOf(bundle) {
  const review = bundle?.expertReview || {};
  const status = review.status || (bundle?.reviewStatus === "已通过" && bundle?.reviewer ? "approved" : bundle?.reviewStatus === "退回修改" ? "needs_revision" : "not_submitted");
  const label = {
    approved: "教师/教研组已确认",
    needs_revision: "退回修改",
    not_submitted: "未提交教师专业审核",
    pending: "等待教师专业审核"
  }[status] || "未提交教师专业审核";
  return {
    status,
    label,
    reviewer: review.reviewer || bundle?.reviewer || "",
    reviewedAt: review.reviewedAt || bundle?.reviewedAt || "",
    note: review.note || bundle?.reviewNote || "",
    change: review.change || bundle?.expertReview?.change || "",
    approved: status === "approved",
    items: Array.isArray(review.items) ? review.items : []
  };
}

/**
 * 专业知识检测：只做“知识包中是否有对应知识点/任务步骤/设备/来源”的可定位比对。
 * 它不判断工程事实本身是否正确，参数一律列为待人工核对，绝不把来源数量当事实正确率。
 */
export function analyzeKnowledge(bundle) {
  const knowledge = knowledgeOf(bundle);
  const points = Array.isArray(knowledge?.knowledgePoints) ? knowledge.knowledgePoints : [];
  const textAll = allText(bundle);
  const coveredPoints = points.filter((point) => textHasKnowledgeTitle(textAll, point.title));
  const missingPoints = points.filter((point) => !textHasKnowledgeTitle(textAll, point.title));
  const unsourcedPoints = points.filter((point) => !(point.sourceRefs || []).length);
  const equipment = Array.isArray(knowledge?.taskEquipment) ? knowledge.taskEquipment : [];
  const missingEquipment = equipment.filter((name) => {
    const tokens = titleTokens(name);
    return tokens.length && !tokens.some((token) => normalize(textAll).includes(normalize(token)));
  });
  const steps = Array.isArray(knowledge?.taskSteps) ? knowledge.taskSteps : [];
  const coveredSteps = steps.filter((step) => textHasKnowledgeTitle(textAll, step));
  const parameters = extractParameters(textAll).slice(0, 12);
  const reviewItems = [];
  for (const point of points) {
    reviewItems.push({
      id: `point-${point.id}`,
      type: "知识点",
      label: `核对知识点「${point.title}」与资源表述`,
      location: "课程知识包 / 本章知识点",
      sourceRefs: point.sourceRefs || [],
      reason: "知识点需要教师确认与教材、设备说明书和本班学情一致。",
      required: true
    });
  }
  for (const point of unsourcedPoints) {
    reviewItems.push({
      id: `source-${point.id}`,
      type: "来源",
      label: `知识点「${point.title}」缺少来源引用`,
      location: "课程知识包 / 知识点",
      sourceRefs: [],
      reason: "没有可追溯来源的知识点不能作为专业事实依据。",
      required: true
    });
  }
  for (const point of missingPoints) {
    reviewItems.push({
      id: `cover-${point.id}`,
      type: "覆盖",
      label: `知识点「${point.title}」未在资源正文中明确体现`,
      location: "资源包 / 10 类资源",
      sourceRefs: point.sourceRefs || [],
      reason: "知识点在知识包中存在，但生成资源没有明确对应位置。",
      required: true
    });
  }
  for (const name of missingEquipment) {
    reviewItems.push({
      id: `equipment-${name}`,
      type: "设备",
      label: `任务设备「${name}」未在实训/信息页中核对`,
      location: "实训操作指导书 / 设备清单",
      sourceRefs: knowledge?.sourceRefs || [],
      reason: "设备名称或型号可能影响实训准备，需教师核对。",
      required: true
    });
  }
  for (const parameter of parameters) {
    reviewItems.push({
      id: `parameter-${parameter}`,
      type: "参数",
      label: `正文出现参数「${parameter}」，知识包未提供逐项来源`,
      location: "资源包 / 正文参数",
      sourceRefs: [],
      reason: "参数可能来自设备、工艺或生成模板，必须核对设备说明书。",
      required: true
    });
  }
  if (points.length && knowledge?.reviewStatus !== "approved") {
    reviewItems.push({
      id: "pack-review",
      type: "审核",
      label: `课程知识包「${knowledge.packId || bundle.curriculumId || ""}」${knowledge.reviewStatusLabel || "待教研组审核"}`,
      location: "课程知识包 / 审核状态",
      sourceRefs: knowledge.sourceRefs || [],
      reason: "未经教研组审核的知识包，不能显示为专家认证或学校审核通过。",
      required: true
    });
  }
  return {
    packId: knowledge?.packId || bundle.curriculumId || "",
    packVersion: knowledge?.packVersion || "",
    packUpdatedAt: knowledge?.packUpdatedAt || "",
    reviewer: knowledge?.reviewer || "",
    reviewStatus: knowledge?.reviewStatus || bundle.curriculumStatus || "pending",
    reviewStatusLabel: knowledge?.reviewStatusLabel || bundle.context?.reviewStatus || "待教研组审核",
    pointCount: points.length,
    packPointCount: Number(knowledge?.packKnowledgePointCount) || points.length,
    packTaskCount: Number(knowledge?.packTaskCount) || 0,
    coveredPoints: coveredPoints.length,
    missingPoints: missingPoints.map((point) => ({ id: point.id, title: point.title, sourceRefs: point.sourceRefs || [] })),
    unsourcedPoints: unsourcedPoints.map((point) => ({ id: point.id, title: point.title })),
    sourceCoverage: points.length ? Math.round(((points.length - unsourcedPoints.length) / points.length) * 100) : 0,
    pointCoverage: points.length ? Math.round((coveredPoints.length / points.length) * 100) : 0,
    equipmentCount: equipment.length,
    missingEquipment,
    stepCount: steps.length,
    coveredSteps: coveredSteps.length,
    parameters,
    reviewItems: reviewItems.slice(0, 12),
    checked: points.length > 0,
    note: points.length ? "" : "资源包没有携带课程知识点，无法进行专业知识比对；只能做结构规则检测。"
  };
}

function findDoc(bundle, id) {
  return (bundle?.artifact?.docs || []).find((doc) => doc.id === id);
}

function findSection(doc, titlePattern) {
  return (doc?.sections || []).find((section) => titlePattern.test(section.title));
}

function blockTables(doc) {
  return (doc?.sections || []).flatMap((section) => (section.blocks || [])
    .filter((block) => block.type === "table")
    .map((block) => ({ section, block })));
}

function findTable(doc, headerPattern) {
  return blockTables(doc).find(({ block }) => (block.headers || []).some((header) => headerPattern.test(header))) || null;
}

function percent(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(100, Math.round(number))) : 0;
}

function finding(severity, message, location, suggestion, basis = "") {
  return {
    severity,
    severityLabel: SEVERITY_LABEL[severity] || "中",
    message,
    location: location || "资源包",
    suggestion: suggestion || "",
    basis: basis || "授渔质检规则"
  };
}

function dimension(id, score, evidence, problems = [], options = {}) {
  return {
    id,
    label: DIMENSION_LABELS[id],
    score: percent(score),
    evidence,
    problems,
    needsHuman: Boolean(options.needsHuman),
    pass: percent(score) >= 80 && !problems.some((problem) => problem.severity === "high")
  };
}

function checkObjectives(bundle) {
  const design = findDoc(bundle, "design");
  const table = findTable(design, /目标/);
  const rows = table?.block?.rows || [];
  const dimensions = rows.map((row) => text(row[0]));
  const missing = ["知识", "技能", "职业素养"].filter((label) => !dimensions.some((item) => item.includes(label)));
  const problems = [];
  if (!rows.length) problems.push(finding("high", "未找到教学目标表", "教学设计方案 / 教学目标", "补充知识、技能、职业素养三维目标。", "教学目标完整性规则"));
  else if (missing.length) problems.push(finding("high", `教学目标缺少维度：${missing.join("、")}`, "教学设计方案 / 教学目标", "补齐缺失维度，避免只写知识目标。", "教学目标完整性规则"));
  return dimension("objectives_completeness", rows.length && !missing.length ? 100 : rows.length ? 65 : 0, rows.length ? `检测到 ${rows.length} 个目标维度` : "未检测到目标表", problems);
}

function checkEvaluable(bundle) {
  const design = findDoc(bundle, "design");
  const table = findTable(design, /目标/);
  const textAll = (table?.block?.rows || []).flat().join(" ");
  const measurable = /(能|会|说明|解释|识读|编写|完成|验证|分析|执行|使用|识别|测量|排查|记录|制定|评价)/.test(textAll);
  const hasEvidence = /(证据|评价|验收|标准|观察|记录)/.test(textAll);
  const problems = [];
  if (!measurable) problems.push(finding("high", "目标表述缺少可观察/可评价的行为动词", "教学设计方案 / 教学目标", "将“了解/熟悉”改写为“能说明/能完成/能验证”等可观察行为。", "目标可评价性规则"));
  if (!hasEvidence) problems.push(finding("medium", "目标未说明评价证据", "教学设计方案 / 教学目标", "在评价表中为目标逐项对应证据。", "目标可评价性规则"));
  return dimension("objectives_evaluable", measurable && hasEvidence ? 100 : measurable ? 70 : 30, measurable ? "包含可观察行为动词" : "未检测到可观察行为动词", problems);
}

function checkAccuracy(bundle, knowledgeReport) {
  const sections = (bundle?.artifact?.docs || []).flatMap((doc) => doc.sections || []);
  const sourced = sections.filter((section) => (section.refs || []).length > 0).length;
  const total = Math.max(1, sections.length);
  const rate = Math.round((sourced / total) * 100);
  const problems = [];
  if (!bundle?.artifact?.sources?.length) problems.push(finding("high", "资源包没有来源记录", "资源包 / 来源", "至少关联课程知识包或官方来源，不能只给生成文本。", "内容准确性规则"));
  if (knowledgeReport.unsourcedPoints.length) {
    problems.push(finding("high", `${knowledgeReport.unsourcedPoints.length} 个知识点没有来源引用`, "课程知识包 / 知识点", "逐条补充可核验来源，未补来源的内容标为“需人工审核”。", "知识来源规则"));
  }
  if (knowledgeReport.missingPoints.length) {
    problems.push(finding("medium", `${knowledgeReport.missingPoints.length} 个知识点未在资源正文中明确体现`, "资源包 / 10 类资源", "检查信息页、教案、课件大纲是否覆盖该知识点，或在知识包中说明取舍。", "知识覆盖规则"));
  }
  if (rate < 60) problems.push(finding("high", `仅 ${rate}% 的章节有来源引用`, "资源包 / 章节引用", "为每个知识点/任务补充来源，或明确标注“行业通用参考/待完善”。", "内容准确性规则"));
  else if (rate < 85) problems.push(finding("medium", `章节来源覆盖率为 ${rate}%`, "资源包 / 章节引用", "补全未引用章节，避免无依据内容混入。", "内容准确性规则"));
  const score = knowledgeReport.checked
    ? Math.round(knowledgeReport.sourceCoverage * 0.5 + knowledgeReport.pointCoverage * 0.4 + rate * 0.1)
    : Math.min(100, rate + (bundle?.artifact?.sources?.length ? 10 : 0));
  return dimension("content_accuracy", score, `知识点来源 ${knowledgeReport.pointCount - knowledgeReport.unsourcedPoints.length}/${knowledgeReport.pointCount}；正文覆盖 ${knowledgeReport.coveredPoints}/${knowledgeReport.pointCount}；章节引用 ${sourced}/${sections.length}`, problems, { needsHuman: knowledgeReport.reviewItems.length > 0 });
}

function checkProfessionalMatch(bundle, knowledgeReport) {
  const context = bundle?.context || {};
  const course = context.course;
  const major = context.major;
  const task = context.task;
  const textAll = allText(bundle);
  const courseMatch = course && normalize(textAll).includes(normalize(course));
  const taskMatch = task && normalize(textAll).includes(normalize(task));
  const problems = [];
  if (!courseMatch) problems.push(finding("high", "资源包正文未体现课程名称", "资源包 / 共享上下文", "检查课程选择与生成上下文字段。", "专业匹配规则"));
  if (!taskMatch) problems.push(finding("high", "资源包正文未体现典型工作任务", "资源包 / 共享上下文", "检查任务选择与生成上下文字段。", "专业匹配规则"));
  if (!knowledgeReport.checked) {
    problems.push(finding("medium", "资源包没有携带课程知识点，无法做专业内容比对", "课程知识包", "为该课程建立知识包，或把没有知识包的内容标为行业参考并人工审核。", "专业知识检测规则"));
  } else if (knowledgeReport.missingEquipment.length) {
    problems.push(finding("medium", `${knowledgeReport.missingEquipment.length} 项任务设备未在实训/信息页中核对`, "实训操作指导书 / 设备清单", "核对设备名称、型号与来源，不能只写通用设备类别。", "专业知识检测规则"));
  }
  if (bundle.curriculumStatus !== "approved") {
    problems.push(finding("medium", `课程知识包状态为“${context.reviewStatus || "待审核"}”`, "课程知识包", "提交课程负责人/教研组审核后再作为正式教学依据；系统不会显示为专家已认证。", "知识包审核规则"));
  }
  const base = courseMatch && taskMatch ? (knowledgeReport.checked ? 60 + knowledgeReport.pointCoverage * 0.2 + (knowledgeReport.missingEquipment.length ? 0 : 10) : 62) : 35;
  const score = Math.min(100, Math.round(base + (bundle.curriculumStatus === "approved" ? 10 : 0)));
  return dimension("professional_match", score, `课程：${course || "未注明"}；任务：${task || "未注明"}；知识点覆盖 ${knowledgeReport.coveredPoints}/${knowledgeReport.pointCount}；专业：${major || "未注明"}`, problems, { needsHuman: bundle.curriculumStatus !== "approved" || knowledgeReport.reviewItems.length > 0 });
}

function checkTask(bundle) {
  const workpage = findDoc(bundle, "workpage");
  const taskbook = findDoc(bundle, "taskbook");
  const hasSituation = /任务情境|情境/.test(docText(workpage)) && /任务情境|情境/.test(docText(taskbook));
  const hasDeliverable = /交付物|成果/.test(docText(workpage)) && /交付物|成果/.test(docText(taskbook));
  const hasSteps = (workpage?.sections || []).some((section) => section.blocks.some((block) => block.type === "list" || (block.type === "paragraph" && /^\d+\./.test(block.text))));
  const problems = [];
  if (!hasSituation) problems.push(finding("high", "工作页/任务书缺少任务情境", "工作页或任务书", "补充真实工作情境、角色和交付要求。", "任务真实性规则"));
  if (!hasDeliverable) problems.push(finding("high", "缺少明确的交付物", "工作页或任务书", "写明成果形式、质量要求和提交方式。", "任务真实性规则"));
  if (!hasSteps) problems.push(finding("medium", "任务步骤呈现不完整", "工作页", "把任务拆成可执行步骤，并保留记录位置。", "任务真实性规则"));
  return dimension("task_authenticity", [hasSituation, hasDeliverable, hasSteps].filter(Boolean).length * 33 + 1, `情境:${hasSituation ? "有" : "缺"}；交付物:${hasDeliverable ? "有" : "缺"}；步骤:${hasSteps ? "有" : "缺"}`, problems);
}

function checkActivity(bundle) {
  const lesson = findDoc(bundle, "lesson");
  const activity = findDoc(bundle, "activity");
  const lessonTable = findTable(lesson, /教师活动/);
  const rows = lessonTable?.block?.rows || [];
  const complete = rows.filter((row) => row.length >= 5 && row[2] && row[3] && row[4]).length;
  const activitySection = findSection(activity, /活动/);
  const problems = [];
  if (!rows.length) problems.push(finding("high", "教案缺少教学过程表", "教案 / 教学过程", "按阶段列出教师活动、学生活动和证据。", "教学活动规则"));
  else if (complete < rows.length) problems.push(finding("medium", `有 ${rows.length - complete} 个教学阶段缺少教师/学生/证据`, "教案 / 教学过程", "补齐每个阶段的活动和证据。", "教学活动规则"));
  if (!activitySection) problems.push(finding("medium", "缺少教学活动策划", "教学活动策划", "补充活动序列、资源与证据。", "教学活动规则"));
  return dimension("activity_reasonableness", rows.length ? Math.round((complete / rows.length) * 100) : 0, `${complete}/${rows.length} 个阶段包含教师活动、学生活动和证据`, problems);
}

function checkPractical(bundle) {
  const practical = findDoc(bundle, "practical");
  const titles = (practical?.sections || []).map((section) => section.title).join(" ");
  const equipment = /设备|工具|材料/.test(titles);
  const safety = /安全|边界/.test(titles);
  const steps = /操作步骤/.test(titles);
  const acceptance = /验收|质量/.test(titles);
  const problems = [];
  if (!practical) problems.push(finding("high", "缺少实训操作指导书", "资源包", "生成独立实训指导书，不能只给教案。", "实训流程规则"));
  if (practical && !equipment) problems.push(finding("medium", "实训指导书缺少设备/工具清单", "实训操作指导书", "补充设备、工具与材料要求。", "实训流程规则"));
  if (practical && !safety) problems.push(finding("high", "实训指导书缺少安全边界", "实训操作指导书", "补充安全前提、禁止事项和应急要求。", "实训流程规则"));
  if (practical && !steps) problems.push(finding("high", "实训指导书缺少操作步骤", "实训操作指导书", "按任务顺序列出可执行步骤。", "实训流程规则"));
  if (practical && !acceptance) problems.push(finding("medium", "实训指导书缺少质量验收", "实训操作指导书", "补充验收项、标准和记录方式。", "实训流程规则"));
  const score = [equipment, safety, steps, acceptance].filter(Boolean).length * 25;
  return dimension("practical_completeness", score, `设备:${equipment ? "有" : "缺"}；安全:${safety ? "有" : "缺"}；步骤:${steps ? "有" : "缺"}；验收:${acceptance ? "有" : "缺"}`, problems);
}

function checkSafety(bundle) {
  const textAll = allText(bundle);
  const contextSafety = (bundle?.context?.safety || []).join(" ");
  const safetyMentions = /(急停|断电|验电|隔离|防护|安全|风险|应急)/.test(textAll + contextSafety);
  const lesson = findDoc(bundle, "lesson");
  const practical = findDoc(bundle, "practical");
  const lessonSafety = /安全|应急/.test(docText(lesson));
  const practicalSafety = /安全|边界/.test(docText(practical));
  const problems = [];
  if (!safetyMentions) problems.push(finding("high", "资源包缺少安全内容", "教案/实训指导书", "补充安全交底、风险与应急要求；不得用通用提醒代替现场规程。", "安全规范规则"));
  if (!lessonSafety) problems.push(finding("medium", "教案未单列安全与应急", "教案", "增加安全与应急环节，并在实施前确认。", "安全规范规则"));
  if (!practicalSafety) problems.push(finding("medium", "实训指导书未单列安全边界", "实训操作指导书", "增加安全前提和禁止事项。", "安全规范规则"));
  return dimension("safety", safetyMentions && lessonSafety && practicalSafety ? 100 : safetyMentions ? 65 : 20, `安全关键词：${safetyMentions ? "有" : "无"}；教案：${lessonSafety ? "有" : "无"}；实训：${practicalSafety ? "有" : "无"}`, problems);
}

function assessmentWeights(bundle) {
  const evaluation = findDoc(bundle, "evaluation");
  const rows = [];
  for (const { block } of blockTables(evaluation)) {
    for (const row of block.rows || []) {
      const weight = row.find((cell) => /%/.test(cell));
      if (weight) rows.push({ dimension: row[0], weight: Number(weight.replace(/[^\d.]/g, "")) || 0, evidence: row[row.length - 1] });
    }
  }
  return rows;
}

function checkAssessment(bundle) {
  const rows = assessmentWeights(bundle);
  const total = rows.reduce((sum, row) => sum + row.weight, 0);
  const problems = [];
  if (!rows.length) problems.push(finding("high", "未找到评价权重", "学生评价表", "补充维度、权重、标准和证据。", "评价匹配规则"));
  if (rows.length && Math.abs(total - 100) > 0.01) problems.push(finding("medium", `评价权重合计为 ${total} 分，不是 100 分`, "学生评价表 / 评价量规", "调整权重使合计为 100，或注明学院现行权重。", "评价匹配规则"));
  const objectiveCount = (bundle?.context?.objectives?.knowledge?.length || 0) + (bundle?.context?.objectives?.skills?.length || 0) + (bundle?.context?.objectives?.attitude?.length || 0);
  if (objectiveCount && rows.length < 3) problems.push(finding("medium", "评价维度少于 3 个，难以覆盖多维目标", "学生评价表", "至少覆盖过程、成果和素养证据。", "评价匹配规则"));
  const score = rows.length ? Math.max(20, 100 - Math.abs(100 - total) * 2 - (rows.length < 3 ? 15 : 0)) : 0;
  return dimension("assessment_alignment", score, `${rows.length} 个维度，权重合计 ${total}`, problems);
}

function checkConsistency(bundle, knowledgeReport) {
  const docs = bundle?.artifact?.docs || [];
  const context = bundle?.context || {};
  const expectedTask = normalize(context.task);
  const expectedCourse = normalize(context.course);
  const expectedHours = normalize(context.hours ? `${context.hours}学时` : "");
  const missingTask = docs.filter((doc) => expectedTask && !normalize([doc.title, ...(doc.meta || []).map((item) => `${item.label}${item.value}`)].join(" ")).includes(expectedTask));
  const missingCourse = docs.filter((doc) => expectedCourse && !normalize([doc.title, ...(doc.meta || []).map((item) => `${item.label}${item.value}`)].join(" ")).includes(expectedCourse));
  const docsWithHours = docs.filter((doc) => (doc.meta || []).some((item) => /学时/.test(item.label) && normalize(item.value).includes(expectedHours)));
  const assessment = assessmentWeights(bundle);
  const problems = [];
  if (missingTask.length) problems.push(finding("high", `${missingTask.length} 份资源未体现同一任务名称`, `${missingTask.map((doc) => doc.label).join("、")}`, "统一任务标题并重新生成相关资源。", "跨文档一致性规则"));
  if (missingCourse.length) problems.push(finding("high", `${missingCourse.length} 份资源未体现课程名称`, `${missingCourse.map((doc) => doc.label).join("、")}`, "统一课程元数据。", "跨文档一致性规则"));
  if (docs.length && docsWithHours.length < docs.length) problems.push(finding("medium", "部分资源未体现统一学时", "资源包 / 元数据", "补齐共享学时元数据。", "跨文档一致性规则"));
  if (!assessment.length) problems.push(finding("high", "评价表缺少可解析的权重", "学生评价表", "使用“维度 / 权重 / 证据”结构。", "跨文档一致性规则"));

  const lesson = findDoc(bundle, "lesson");
  const practical = findDoc(bundle, "practical");
  const workpage = findDoc(bundle, "workpage");
  const taskbook = findDoc(bundle, "taskbook");
  const slides = findDoc(bundle, "slides");
  const evaluation = findDoc(bundle, "evaluation");
  const design = findDoc(bundle, "design");
  const lessonText = docText(lesson);
  const designTargetTable = findTable(design, /目标/);
  const lessonTargetTable = findTable(lesson, /目标/);
  if (designTargetTable && lessonTargetTable) {
    const designTargets = (designTargetTable.block.rows || []).flat().map(normalize).join("|");
    const lessonTargets = (lessonTargetTable.block.rows || []).flat().map(normalize).join("|");
    if (designTargets && lessonTargets && designTargets !== lessonTargets) {
      problems.push(finding("high", "教学设计方案与教案的教学目标表不一致", "教学设计方案/教学目标；教案/教学目标", "以同一套目标为准，修改后重新同步两份文档。", "教学目标一致性规则"));
    }
  }
  const practicalText = docText(practical);
  const workpageText = docText(workpage);
  const taskbookText = docText(taskbook);
  const slidesText = docText(slides);
  const evaluationText = docText(evaluation);

  const stageMinutes = Array.from(lessonText.matchAll(/(\d+)\s*分钟/g)).map((match) => Number(match[1]));
  const stageTotal = stageMinutes.reduce((sum, value) => sum + value, 0);
  const expectedMinutes = Number(context.hours) * 45;
  if (stageMinutes.length && expectedMinutes && Math.abs(stageTotal - expectedMinutes) > 5) {
    problems.push(finding("high", `教案阶段时间合计 ${stageTotal} 分钟，与 ${context.hours} 学时（按 45 分钟/学时）的 ${expectedMinutes} 分钟不一致`, "教案 / 教学过程", "核对阶段时长，保证各阶段合计与总学时一致；不要把分钟直接当学时。", "时间一致性规则"));
  }

  const knowledgeSteps = knowledgeReport && knowledgeOf(bundle)?.taskSteps?.length ? knowledgeOf(bundle).taskSteps : [];
  const practicalSteps = knowledgeSteps.filter((step) => textHasKnowledgeTitle(practicalText, step));
  if (knowledgeSteps.length && practicalSteps.length < Math.ceil(knowledgeSteps.length * 0.6)) {
    problems.push(finding("medium", `实训指导书仅覆盖 ${practicalSteps.length}/${knowledgeSteps.length} 个任务步骤`, "实训操作指导书 / 操作步骤", "逐条对照任务步骤，补全缺失操作；不要只写概括性流程。", "操作流程一致性规则"));
  }

  const stepItems = (doc) => {
    const target = (doc?.sections || []).find((section) => /步骤|任务实施|实施流程|工作过程/.test(section.title));
    return target ? (target.blocks || []).filter((block) => block.type === "list" || block.type === "checklist").flatMap((block) => block.items || []) : [];
  };
  const workpageSteps = stepItems(workpage);
  const taskbookSteps = stepItems(taskbook);
  if (workpageSteps.length && taskbookSteps.length && Math.abs(workpageSteps.length - taskbookSteps.length) > 1) {
    problems.push(finding("medium", `工作页实施步骤 ${workpageSteps.length} 条，任务书步骤 ${taskbookSteps.length} 条，数量不一致`, "工作页 / 任务书", "统一任务步骤数量与顺序，避免学生拿到两套流程。", "任务上下文一致性规则"));
  }

  const keyPointTitles = (knowledgeReport && knowledgeOf(bundle)?.knowledgePoints) || [];
  const slidesCovered = keyPointTitles.filter((point) => textHasKnowledgeTitle(slidesText, point.title)).length;
  if (keyPointTitles.length && slidesCovered < Math.ceil(keyPointTitles.length * 0.6)) {
    problems.push(finding("medium", `课件大纲仅覆盖 ${slidesCovered}/${keyPointTitles.length} 个知识点`, "课件内容大纲", "补齐重点知识点页面；大纲不是已经生成的 PPT 文件。", "课件覆盖规则"));
  }

  if (workpageText && !/(安全|风险|防护|急停|断电)/.test(workpageText)) {
    problems.push(finding("medium", "工作页没有安全与风险提示", "工作页", "在任务步骤旁增加安全确认点，不能只在教案里写安全。", "安全贯穿规则"));
  }
  if (practicalText && !/(质量|验收|自检|互检)/.test(practicalText)) {
    problems.push(finding("medium", "实训指导书没有质量验收/自检要求", "实训操作指导书", "补充验收项和记录方式。", "实训评价规则"));
  }

  const evaluationDimensions = (assessment || []).length;
  const objectiveCategories = (findTable(design, /目标/)?.block?.rows || []).length;
  if (objectiveCategories >= 3 && evaluationDimensions && evaluationDimensions < 3) {
    problems.push(finding("medium", "评价维度少于教学目标维度，目标—评价覆盖不足", "学生评价表 / 评价维度", "为知识、技能和职业素养分别建立评价证据。", "目标—评价一致性规则"));
  }

  const score = Math.max(0, 100 - missingTask.length * 12 - missingCourse.length * 12 - (docsWithHours.length < docs.length ? 10 : 0) - (assessment.length ? 0 : 20) - (stageMinutes.length && Math.abs(stageTotal - expectedMinutes) > 5 ? 15 : 0) - (knowledgeSteps.length && practicalSteps.length < Math.ceil(knowledgeSteps.length * 0.6) ? 10 : 0) - (workpageSteps.length && taskbookSteps.length && Math.abs(workpageSteps.length - taskbookSteps.length) > 1 ? 8 : 0) - (keyPointTitles.length && slidesCovered < Math.ceil(keyPointTitles.length * 0.6) ? 8 : 0) - (workpageText && !/(安全|风险|防护|急停|断电)/.test(workpageText) ? 6 : 0));
  return dimension("resource_consistency", score, `${docs.length} 份资源；任务缺失 ${missingTask.length}；课程缺失 ${missingCourse.length}；学时不完整 ${Math.max(0, docs.length - docsWithHours.length)}；阶段分钟 ${stageTotal}/${expectedMinutes}；实训步骤覆盖 ${practicalSteps.length}/${knowledgeSteps.length}`, problems, { needsHuman: true });
}

const RULES = [
  checkObjectives,
  checkEvaluable,
  checkAccuracy,
  checkProfessionalMatch,
  checkTask,
  checkActivity,
  checkPractical,
  checkSafety,
  checkAssessment,
  checkConsistency
];

export function inspectBundle(bundle, { weights = DEFAULT_QUALITY_WEIGHTS } = {}) {
  if (!bundle?.artifact?.docs?.length) throw new Error("资源包为空，无法质检");
  const normalizedWeights = {};
  for (const key of Object.keys(DEFAULT_QUALITY_WEIGHTS)) {
    normalizedWeights[key] = Number(weights[key] ?? DEFAULT_QUALITY_WEIGHTS[key]);
  }
  const totalWeight = Object.values(normalizedWeights).reduce((sum, value) => sum + value, 0) || 1;
  const knowledgeReport = analyzeKnowledge(bundle);
  const dimensions = RULES.map((rule) => rule(bundle, knowledgeReport));
  const rawOverall = Math.round(dimensions.reduce((sum, item) => sum + item.score * normalizedWeights[item.id], 0) / totalWeight);
  const expert = expertReviewOf(bundle);
  // A pending/reference curriculum cannot receive an A-level score: the
  // professional content itself has not passed the required human review.
  const curriculumCap = bundle.curriculumStatus === "approved" ? 100 : bundle.curriculumStatus === "reference" ? 72 : 84;
  const expertCap = expert.approved ? 100 : 84;
  const reviewCap = Math.min(curriculumCap, expertCap);
  const overall = Math.min(rawOverall, reviewCap);
  const problems = dimensions.flatMap((item) => item.problems.map((problem) => ({ ...problem, dimension: item.label, dimensionId: item.id })));
  const high = problems.filter((problem) => problem.severity === "high").length;
  const medium = problems.filter((problem) => problem.severity === "medium").length;
  const low = problems.filter((problem) => problem.severity === "low").length;
  const humanReview = dimensions.filter((item) => item.needsHuman).length + problems.filter((problem) => /待审核|人工/.test(problem.message)).length;
  const structuralIds = ["objectives_completeness", "objectives_evaluable", "activity_reasonableness", "practical_completeness", "assessment_alignment", "resource_consistency"];
  const knowledgeIds = ["content_accuracy", "professional_match", "task_authenticity", "safety"];
  const average = (ids) => Math.round(ids.reduce((sum, id) => sum + (dimensions.find((item) => item.id === id)?.score || 0), 0) / Math.max(1, ids.length));
  const layers = {
    structural: {
      id: "structural",
      label: "A. 结构规则检测",
      score: average(structuralIds),
      dimensionIds: structuralIds,
      note: "检查目标、流程、任务、实训、评价和跨文档结构；不能证明专业事实正确。"
    },
    knowledge: {
      id: "knowledge",
      label: "B. 专业知识检测",
      score: average(knowledgeIds),
      dimensionIds: knowledgeIds,
      checked: knowledgeReport.checked,
      pointCount: knowledgeReport.pointCount,
      packPointCount: knowledgeReport.packPointCount,
      coveredPoints: knowledgeReport.coveredPoints,
      sourceCoverage: knowledgeReport.sourceCoverage,
      pointCoverage: knowledgeReport.pointCoverage,
      missingPoints: knowledgeReport.missingPoints,
      unsourcedPoints: knowledgeReport.unsourcedPoints,
      missingEquipment: knowledgeReport.missingEquipment,
      parameters: knowledgeReport.parameters,
      reviewItems: knowledgeReport.reviewItems,
      note: knowledgeReport.note || "与课程知识包逐点比对；无法自动判断的参数和事实列入教师审核。"
    },
    expert: {
      id: "expert",
      label: "C. 教师专家审核",
      status: expert.status,
      statusLabel: expert.label,
      reviewer: expert.reviewer,
      reviewedAt: expert.reviewedAt,
      note: expert.note,
      change: expert.change,
      approved: expert.approved,
      itemCount: expert.items.length,
      checkedItems: expert.items.filter((item) => item.checked).length,
      required: true
    }
  };
  const status = high > 0 ? "fail" : "review";
  const statusLabel = high > 0
    ? "存在问题，需修改"
    : !expert.approved
      ? "可进入教师专业审核"
      : bundle.curriculumStatus === "approved"
        ? "待最终确认"
        : "知识包待教研组审核";
  return {
    schema: "shouyu.quality.v2",
    overall,
    rawOverall,
    reviewCap,
    curriculumCap,
    expertCap,
    level: overall >= 90 ? "A" : overall >= 80 ? "B" : overall >= 70 ? "C" : "D",
    status,
    statusLabel,
    dimensions,
    layers,
    expertReview: expert,
    metrics: {
      structureCompleteness: layers.structural.score,
      sourceCoverage: knowledgeReport.sourceCoverage,
      professionalMatch: dimensions.find((item) => item.id === "professional_match")?.score || 0,
      crossResourceConsistency: dimensions.find((item) => item.id === "resource_consistency")?.score || 0,
      practicalSafety: dimensions.find((item) => item.id === "safety")?.score || 0,
      expertReviewStatus: expert.status,
      expertReviewLabel: expert.label,
      factVerified: expert.approved && bundle.curriculumStatus === "approved",
      note: "结构完整度、来源覆盖率、专业匹配、一致性、实训安全来自规则执行；专家审核状态来自真实教师记录，未提交时不得显示为已认证。"
    },
    problems,
    summary: {
      high,
      medium,
      low,
      passedDimensions: dimensions.filter((item) => item.pass).length,
      totalDimensions: dimensions.length,
      humanReview,
      sourceCount: bundle.artifact.sources?.length || 0,
      docCount: bundle.artifact.docs.length,
      knowledgePointCount: knowledgeReport.pointCount,
      coveredPoints: knowledgeReport.coveredPoints,
      sourceCoverage: knowledgeReport.sourceCoverage,
      reviewed: bundle.curriculumStatus === "approved",
      expertApproved: expert.approved,
      factVerified: expert.approved && bundle.curriculumStatus === "approved"
    },
    weights: normalizedWeights,
    generatedAt: new Date().toISOString(),
    disclaimer: "本分数由授渔规则引擎依据结构、来源、知识点覆盖、任务、评价和一致性指标计算，不是大模型主观评分，不代表学校官方认定。来源数量不等于事实正确率；参数、设备、操作逻辑和无法自动判断的专业内容必须由教师/教研组审核。未提交专家审核或知识包待审核时，系统不会显示“已通过专家认证”。"
  };
}

export function qualityMarkdown(bundle, report) {
  const lines = [
    `# 教学质量检测报告`,
    "",
    `- 资源包：${bundle.title}`,
    `- 课程：${bundle.context.course}`,
    `- 任务：${bundle.context.task}`,
    `- 综合得分：${report.overall} / 100（${report.level}）`,
    `- 状态：${report.statusLabel}`,
    `- 检测时间：${report.generatedAt}`,
    "",
    "## 三层检测",
    `- A. 结构规则检测：${report.layers.structural.score}`,
    `- B. 专业知识检测：${report.layers.knowledge.score}（知识点覆盖 ${report.layers.knowledge.coveredPoints}/${report.layers.knowledge.pointCount}；来源覆盖 ${report.layers.knowledge.sourceCoverage}%）`,
    `- C. 教师专家审核：${report.layers.expert.statusLabel}${report.layers.expert.reviewer ? `（${report.layers.expert.reviewer}）` : ""}${report.layers.expert.change ? `；修改记录：${report.layers.expert.change}` : ""}`,
    "",
    "## 关键指标",
    `- 内容结构完整度：${report.metrics.structureCompleteness}`,
    `- 来源覆盖率：${report.metrics.sourceCoverage}%（不代表事实正确率）`,
    `- 专业知识匹配度：${report.metrics.professionalMatch}`,
    `- 跨资源一致性：${report.metrics.crossResourceConsistency}`,
    `- 实训安全检查：${report.metrics.practicalSafety}`,
    `- 人工专家审核：${report.metrics.expertReviewLabel}`,
    "",
    "## 维度得分",
    ...report.dimensions.map((item) => `- ${item.label}：${item.score}（${item.problems.length ? `${item.problems.length} 个问题` : "通过"}）`),
    "",
    "## 待教师审核项",
    ...(report.layers.knowledge.reviewItems.length ? report.layers.knowledge.reviewItems.map((item) => `- [${item.type}] ${item.label}（${item.location}）`) : ["- 无自动识别的待审核项；仍需教师确认专业内容。"]),
    "",
    "## 问题与建议",
    ...(report.problems.length ? report.problems.map((item, index) => [
      `${index + 1}. [${item.severityLabel}] ${item.message}`,
      `   - 位置：${item.location}`,
      `   - 建议：${item.suggestion}`,
      `   - 依据：${item.basis}`
    ].join("\n")) : ["未发现规则可识别的问题；仍需人工审核专业内容。"]),
    "",
    "> " + report.disclaimer
  ];
  return lines.join("\n");
}

/**
 * Apply only deterministic structural fixes. Professional content remains a
 * teacher decision and is left in the report for manual review.
 */
export function applyAutoFixes(bundle, report) {
  const next = clone(bundle);
  const applied = [];
  const remaining = [];
  const evaluation = findDoc(next, "evaluation");
  const weights = assessmentWeights(next);
  const total = weights.reduce((sum, item) => sum + item.weight, 0);
  if (evaluation && weights.length && Math.abs(total - 100) > 0.01) {
    const scale = 100 / Math.max(total, 1);
    for (const { block } of blockTables(evaluation)) {
      for (const row of block.rows || []) {
        const index = row.findIndex((cell) => /%/.test(cell));
        if (index >= 0) row[index] = `${Math.round((Number(row[index].replace(/[^\d.]/g, "")) || 0) * scale)}%`;
      }
    }
    applied.push("已将评价权重按比例调整为合计 100 分");
  }
  for (const id of ["lesson", "practical"]) {
    const doc = findDoc(next, id);
    if (!doc) continue;
    const hasSafety = (doc.sections || []).some((section) => /安全|应急/.test(section.title));
    if (!hasSafety && next.context?.safety?.length) {
      doc.sections.push({
        id: `${id}-safety-auto`,
        no: String(doc.sections.length + 1).padStart(2, "0"),
        title: "安全与应急（自动补全，待审核）",
        blocks: [
          { type: "paragraph", text: "以下内容由课程知识包安全条目自动补入，必须由教师结合现场规程审核。" },
          { type: "checklist", items: next.context.safety }
        ],
        refs: []
      });
      applied.push(`已在${doc.label}补入安全与应急章节`);
    }
  }
  for (const problem of report.problems) {
    if (!applied.some((item) => problem.message.includes(item) || item.includes(problem.message))) {
      remaining.push(problem);
    }
  }
  return { bundle: next, applied, remaining };
}

export { DIMENSION_LABELS, SEVERITY_LABEL };