/**
 * 授渔 · 教学应用成效
 *
 * 只处理教师真实记录或导入的记录。没有记录时返回“尚未采集”，
 * 不预填、不模拟、不把试用记录包装成学校认证。
 */

export const IMPACT_SCHEMA = "shouyu.impact.v1";
export const IMPACT_EXPERT_RESULTS = ["未审核", "通过", "有条件通过", "退回修改"];

export function emptyImpactState() {
  return { schema: IMPACT_SCHEMA, records: [] };
}

function number(value, fallback = null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function text(value) {
  return String(value ?? "").trim();
}

export function validateImpactRecord(input = {}) {
  const errors = [];
  const teacherAlias = text(input.teacherAlias);
  const courseName = text(input.courseName);
  const trialDate = text(input.trialDate);
  const baselineMinutes = number(input.baselineMinutes);
  const assistedMinutes = number(input.assistedMinutes);
  const generatedResources = number(input.generatedResources, 0);
  const manualEditRatio = number(input.manualEditRatio);
  const teacherRating = number(input.teacherRating);
  const expertResult = IMPACT_EXPERT_RESULTS.includes(input.expertResult) ? input.expertResult : "未审核";
  if (!teacherAlias) errors.push("请填写教师匿名代号（不要填真实姓名）");
  if (!courseName) errors.push("请填写试用课程");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trialDate)) errors.push("试用日期格式应为 YYYY-MM-DD");
  if (!(baselineMinutes > 0)) errors.push("传统备课时间必须大于 0 分钟");
  if (!(assistedMinutes > 0)) errors.push("使用授渔后的备课时间必须大于 0 分钟");
  if (!(generatedResources >= 0)) errors.push("生成资源数量不能为负");
  if (!(manualEditRatio >= 0 && manualEditRatio <= 100)) errors.push("人工修改比例应在 0—100% 之间");
  if (!(teacherRating >= 1 && teacherRating <= 5)) errors.push("教师评价应在 1—5 分之间");
  return {
    ok: errors.length === 0,
    errors,
    record: {
      teacherAlias,
      courseId: text(input.courseId),
      courseName,
      trialDate,
      baselineMinutes: Math.round(baselineMinutes || 0),
      assistedMinutes: Math.round(assistedMinutes || 0),
      generatedResources: Math.round(generatedResources || 0),
      manualEditRatio: Math.round(manualEditRatio || 0),
      teacherRating: Math.round(teacherRating || 0),
      expertResult,
      expertReviewer: text(input.expertReviewer),
      notes: text(input.notes),
      measuredAt: text(input.measuredAt) || new Date().toISOString(),
      source: text(input.source) || "teacher_recorded",
      anonymized: Boolean(input.anonymized)
    }
  };
}

function average(values) {
  const list = values.filter((value) => Number.isFinite(value));
  return list.length ? Math.round(list.reduce((sum, value) => sum + value, 0) / list.length) : null;
}

export function aggregateImpact(records = []) {
  const list = Array.isArray(records) ? records.filter((record) => record && record.teacherAlias && record.courseName) : [];
  const validTimes = list.filter((record) => Number(record.baselineMinutes) > 0 && Number(record.assistedMinutes) > 0);
  const saved = validTimes.map((record) => Number(record.baselineMinutes) - Number(record.assistedMinutes));
  const rate = validTimes.map((record) => {
    const baseline = Number(record.baselineMinutes);
    return baseline > 0 ? ((baseline - Number(record.assistedMinutes)) / baseline) * 100 : 0;
  });
  const teachers = new Set(list.map((record) => text(record.teacherAlias).toLowerCase()).filter(Boolean));
  const courses = new Set(list.map((record) => text(record.courseId || record.courseName)).filter(Boolean));
  const approved = list.filter((record) => ["通过", "有条件通过"].includes(record.expertResult)).length;
  return {
    hasData: list.length > 0,
    recordCount: list.length,
    participants: teachers.size,
    courses: courses.size,
    resources: list.reduce((sum, record) => sum + (Number(record.generatedResources) || 0), 0),
    averageBaseline: average(validTimes.map((record) => Number(record.baselineMinutes))),
    averageAssisted: average(validTimes.map((record) => Number(record.assistedMinutes))),
    averageSaved: average(saved),
    averageSavedRate: average(rate),
    averageManualRatio: average(list.map((record) => Number(record.manualEditRatio))),
    averageRating: average(list.map((record) => Number(record.teacherRating))),
    expertApproved: approved,
    expertReviewed: list.filter((record) => record.expertResult && record.expertResult !== "未审核").length,
    latestMeasuredAt: list.map((record) => record.measuredAt).filter(Boolean).sort().slice(-1)[0] || ""
  };
}

/**
 * 匿名导出：不修改本机记录，只生成副本。
 * 教师代号替换为“教师01…”；备注与校名等自由文本清空，避免二次识别。
 */
export function anonymizeImpactRecords(records = []) {
  const aliases = new Map();
  return (Array.isArray(records) ? records : []).map((record, index) => {
    const key = text(record.teacherAlias).toLowerCase() || `record-${index}`;
    if (!aliases.has(key)) aliases.set(key, `教师${String(aliases.size + 1).padStart(2, "0")}`);
    return {
      ...record,
      teacherAlias: aliases.get(key),
      expertReviewer: "",
      notes: "",
      anonymized: true,
      source: "anonymized_export"
    };
  });
}

export function impactToCSV(records = [], { anonymize = false } = {}) {
  const list = anonymize ? anonymizeImpactRecords(records) : (Array.isArray(records) ? records : []);
  const headers = ["教师匿名代号", "课程", "试用日期", "传统备课（分钟）", "使用授渔后（分钟）", "节省时间（分钟）", "节省比例（%）", "生成资源数", "人工修改比例（%）", "教师评价（1-5）", "专家审核结果", "记录时间"];
  const rows = list.map((record) => {
    const baseline = Number(record.baselineMinutes) || 0;
    const assisted = Number(record.assistedMinutes) || 0;
    const saved = baseline && assisted ? baseline - assisted : "";
    const rate = baseline && assisted ? Math.round(((baseline - assisted) / baseline) * 100) : "";
    return [
      record.teacherAlias,
      record.courseName,
      record.trialDate,
      baseline || "",
      assisted || "",
      saved,
      rate,
      record.generatedResources ?? "",
      record.manualEditRatio ?? "",
      record.teacherRating ?? "",
      record.expertResult || "未审核",
      record.measuredAt || ""
    ];
  });
  const escape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  return [headers, ...rows].map((row) => row.map(escape).join(",")).join("\r\n");
}