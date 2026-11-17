/**
 * 授渔 · 课程知识装配
 *
 * 已审核/待审核的课程知识包优先；没有课程包时，回退为明确标注的
 * “行业通用参考”骨架，绝不伪装成学校课程标准。
 */

import { DOMAIN_PROFILES, detectDomain, buildCourseResource } from "./programs-content.js";
import { sourceForRef } from "./engine.js";
import { CURRICULUM_PACKS, getCurriculumPack } from "./curriculum-data.js";

function clean(value) {
  return String(value ?? "").trim();
}

function uniqueBy(items, key) {
  const seen = new Set();
  return items.filter((item) => {
    const value = key(item);
    if (!value || seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

function dynamicProfile(course, catalog) {
  const major = catalog.majors.find((item) => item.id === course.majorId) || null;
  const group = catalog.groups.find((item) => item.id === course.groupId) || null;
  const department = catalog.departments.find((item) => item.id === course.deptId) || null;
  const domain = detectDomain(course, major, group, department);
  return {
    domain,
    profile: DOMAIN_PROFILES[domain] || DOMAIN_PROFILES.general,
    major,
    group,
    department
  };
}

/**
 * Generate a transparent, reviewed=false curriculum skeleton for any course.
 */
export function createCurriculumSkeleton(course, catalog) {
  const { profile, major, group, department } = dynamicProfile(course, catalog);
  const resource = buildCourseResource(course, catalog);
  const chapters = (profile.modules || []).map(([title, points], index) => ({
    id: `CH-GEN-${course.id}-${index + 1}`,
    no: String(index + 1).padStart(2, "0"),
    title,
    summary: `按“${title}”组织的行业通用教学参考，需课程负责人校核。`,
    knowledgePoints: (points || []).map((point, pointIndex) => ({
      id: `KP-GEN-${course.id}-${index + 1}-${pointIndex + 1}`,
      title: point,
      statement: `围绕“${point}”组织教学时，应结合课程标准和真实设备条件补充定义、示例、操作要点与评价证据。当前为行业通用参考，不是学院官方知识点。`,
      sourceRefs: [],
      sourceType: "D",
      reviewStatus: "pending"
    }))
  }));
  const taskTitle = `${course.name || "本课程"}综合任务`;
  return {
    id: `CUR-GEN-${course.id}`,
    courseId: course.id,
    majorId: course.majorId,
    title: course.name || "未命名课程",
    subtitle: `${profile.label} · 行业通用参考`,
    version: "rule-reference-v1",
    status: "reference",
    statusLabel: "行业通用参考 · 待课程负责人审核",
    demo: false,
    generated: true,
    officialBasis: {
      sourceIds: course.sourceIds || [],
      note: course.hasOfficialIntro
        ? "课程简介来自原表官方原文；章节、知识点和任务为规则生成的行业通用参考。"
        : "原表没有本课程官方简介；章节、知识点和任务为规则生成的行业通用参考，不能作为学院课程标准。",
      sourceType: course.hasOfficialIntro ? "A" : "D"
    },
    contentProvenance: {
      sourceType: "D",
      label: "行业通用参考",
      note: "由课程名称、专业、专业组和领域模板生成；不包含学校未公开的课程标准、学时学分、教材版本或设备参数。"
    },
    summary: resource.fields.find((field) => field.key === "intro")?.content || profile.position,
    objectives: {
      knowledge: profile.knowledge || [],
      skills: profile.skills || [],
      attitude: profile.attitude || []
    },
    keyPoints: (profile.focus || "").split(/[；;]/).filter(Boolean).slice(0, 4),
    difficulties: [
      "把课程通用方法迁移到真实设备、真实任务和学校现行标准",
      "用可观察证据证明技能目标达成，而不是只完成书面练习"
    ],
    chapters,
    tasks: [{
      id: `TASK-GEN-${course.id}`,
      title: taskTitle,
      situation: `在 ${major?.name || "本专业"} 的真实或仿真教学情境中，完成“${course.name || "本课程"}”对应的工作任务，并保留过程记录与成果。`,
      deliverable: "任务成果、过程记录、自检记录、反思与改进说明",
      knowledgePointIds: chapters.flatMap((chapter) => chapter.knowledgePoints.map((point) => point.id)),
      steps: (profile.training?.[1] || ["明确任务与标准", "收集资料并制定方案", "实施并记录", "检查与评价", "复盘改进"]),
      equipment: ["按学院实训室实际设备与工具准备", "工作任务书、工艺/操作文件", "安全防护用品"],
      safety: [profile.training?.[3] || "按实训室安全规程和教师要求执行；涉及设备、用电、化学品或高处作业时，必须先完成安全交底。"],
      sourceRefs: []
    }],
    abilities: [...(profile.skills || []), ...(profile.attitude || [])].slice(0, 8),
    equipment: [
      { name: "学院现行实训设备", note: "型号、台套数和参数以现场设备及教学计划为准" },
      { name: "课程教材/工作页", note: "版本待课程负责人确认" },
      { name: "安全防护用品", note: "按实训室规程配备" }
    ],
    safety: [profile.training?.[3] || "按实训室安全规程和教师要求执行。"],
    assessment: profile.assessment.map(([dimension, weight, evidence]) => ({ dimension, weight: Number(weight) || 0, evidence })),
    sourceRefs: [],
    disclaimer: "本课程尚未建立经教研组审核的结构化知识包。本页内容为规则生成的行业通用参考，不是学院正式课程标准；设备、学时、教材和安全要求必须以学院现行文件和现场条件为准。"
  };
}

export function resolveCurriculum(course, catalog) {
  if (!course) return null;
  const reviewed = getCurriculumPack(course.id);
  if (reviewed) return reviewed;
  return createCurriculumSkeleton(course, catalog);
}

export function listReviewedPacks() {
  return CURRICULUM_PACKS.map((pack) => ({
    id: pack.id,
    courseId: pack.courseId,
    title: pack.title,
    subtitle: pack.subtitle,
    status: pack.status,
    statusLabel: pack.statusLabel
  }));
}

export function buildCurriculumSources(pack, catalog) {
  const sources = [];
  const seen = new Set();
  const add = (source) => {
    if (!source) return;
    const key = source.key || source.ref;
    if (!key || seen.has(key)) return;
    seen.add(key);
    sources.push({ ...source, ref: source.ref || key });
  };
  for (const ref of pack?.sourceRefs || []) add(sourceForRef(ref));
  for (const sourceId of pack?.officialBasis?.sourceIds || []) {
    const row = catalog.sources.find((source) => source.id === sourceId);
    if (!row) continue;
    add({
      key: row.id,
      ref: row.id,
      docTitle: row.title,
      sectionTitle: "官方来源 / 专业数据库",
      source: "广州市技师学院专业数据库",
      published: row.published,
      version: "2026.11",
      snippet: row.info || "",
      url: row.url
    });
  }
  return uniqueBy(sources, (source) => source.ref);
}

export function getPackChapterKPs(pack, chapterId) {
  const chapter = pack?.chapters?.find((item) => item.id === chapterId);
  return chapter?.knowledgePoints || [];
}

export function getPackTaskKPs(pack, taskId) {
  const task = pack?.tasks?.find((item) => item.id === taskId);
  if (!task) return [];
  const ids = new Set(task.knowledgePointIds || []);
  return (pack.chapters || []).flatMap((chapter) => chapter.knowledgePoints || []).filter((point) => ids.has(point.id));
}

export function curriculumCoverage(pack) {
  const points = (pack?.chapters || []).flatMap((chapter) => chapter.knowledgePoints || []);
  const cited = points.filter((point) => (point.sourceRefs || []).length).length;
  return {
    chapters: pack?.chapters?.length || 0,
    knowledgePoints: points.length,
    tasks: pack?.tasks?.length || 0,
    cited,
    citeRate: points.length ? Math.round((cited / points.length) * 100) : 0,
    reviewed: pack?.status === "approved"
  };
}

export { clean };