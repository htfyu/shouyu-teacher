/**
 * 授渔 · 工学一体化教学资源开发引擎
 *
 * 设计原则：
 * 1. 先装配专业课程知识，再生成 10 类资源；
 * 2. 所有资源共享课程、章节、任务、学时、版本和来源；
 * 3. 每类资源有不同教学功能，不复制同一段文字；
 * 4. 没有课程知识包时，明确降级为“行业通用参考”，不伪造官方标准；
 * 5. 评分与质量检测不在本文件伪造，交给 quality-engine 的规则引擎。
 */

import { resolveCurriculum, buildCurriculumSources } from "./curriculum.js";
import { sourceForRef } from "./engine.js";

function text(value) {
  return String(value ?? "").trim();
}

function paragraph(value) {
  return { type: "paragraph", text: text(value) };
}

function list(items, ordered = false) {
  return { type: "list", ordered, items: (items || []).map(text).filter(Boolean) };
}

function table(headers, rows) {
  return { type: "table", headers: (headers || []).map(text), rows: (rows || []).map((row) => row.map(text)) };
}

function callout(title, value, tone = "note") {
  return { type: "callout", tone, title: text(title), text: text(value) };
}

function checklist(items) {
  return { type: "checklist", items: (items || []).map(text).filter(Boolean) };
}

function lines(count, label = "") {
  return { type: "lines", count, label: text(label) };
}

function section(id, no, title, blocks, refs = []) {
  return { id, no, title, blocks, refs: Array.from(new Set(refs.filter(Boolean))) };
}

function doc(id, label, title, meta, sections) {
  return { id, label, title, meta, sections };
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

function fmtHours(hours) {
  const value = Number(hours);
  return Number.isFinite(value) && value > 0 ? value : 4;
}

function allocate(total, ratios) {
  const values = ratios.map((ratio) => Math.max(1, Math.round(total * ratio)));
  const diff = total - values.reduce((sum, value) => sum + value, 0);
  values[values.length - 1] += diff;
  return values;
}

function taskSteps(task, profile) {
  return task?.steps?.length ? task.steps : (profile?.training?.[1] || ["明确任务与标准", "收集资料并制定方案", "实施并记录", "检查与评价", "复盘改进"]);
}

function knowledgeRefs(pack, task, chapter) {
  const taskKPs = task?.knowledgePointIds || [];
  const points = (pack?.chapters || []).flatMap((item) => item.knowledgePoints || [])
    .filter((point) => !taskKPs.length || taskKPs.includes(point.id) || chapter?.knowledgePoints?.some((kp) => kp.id === point.id));
  return uniqueBy(points.flatMap((point) => point.sourceRefs || []), (ref) => ref);
}

function buildContext(course, catalog, pack, chapter, task, input) {
  const major = catalog.majors.find((item) => item.id === course.majorId) || null;
  const group = catalog.groups.find((item) => item.id === course.groupId) || null;
  const department = catalog.departments.find((item) => item.id === course.deptId) || null;
  const hours = fmtHours(input.hours);
  const context = {
    course,
    major,
    group,
    department,
    pack,
    chapter,
    task,
    learners: text(input.learners) || "本专业教学班（人数、基础与学习特征待教师补充）",
    hours,
    conditions: text(input.conditions) || "学院现有 PLC 实训室与物料分拣教学工作站；设备型号、台套数和软件版本以现场为准。",
    objectiveExtra: text(input.objectiveExtra),
    lessonType: "工学一体化（理实一体）",
    template: "工学一体化资源包 v1",
    version: pack.version,
    curriculumId: pack.id,
    curriculumStatus: pack.status,
    reviewStatus: pack.statusLabel,
    demo: Boolean(pack.demo),
    sourceLabel: pack.contentProvenance?.label || "行业通用参考",
    sourceType: pack.contentProvenance?.sourceType || "D",
    objectives: {
      knowledge: pack.objectives.knowledge || [],
      skills: pack.objectives.skills || [],
      attitude: pack.objectives.attitude || []
    },
    keyPoints: pack.keyPoints || [],
    difficulties: pack.difficulties || [],
    safety: pack.safety || [],
    equipment: pack.equipment || [],
    assessment: pack.assessment || [],
    abilities: pack.abilities || [],
    sourceRefs: pack.sourceRefs || [],
    taskSteps: taskSteps(task, pack),
    taskKPs: task?.knowledgePointIds || []
  };
  if (context.objectiveExtra) {
    context.objectives.skills.push(`教师补充目标：${context.objectiveExtra}`);
  }
  return context;
}

function metaFor(ctx) {
  return [
    { label: "专业", value: ctx.major?.name || "未关联" },
    { label: "课程", value: ctx.course.name || "未命名课程" },
    { label: "章节", value: ctx.chapter?.title || "未选择" },
    { label: "典型工作任务", value: ctx.task?.title || "未选择" },
    { label: "教学对象", value: ctx.learners },
    { label: "建议学时", value: `${ctx.hours} 学时` },
    { label: "资源版本", value: `${ctx.version} / 包版本 1` },
    { label: "知识包状态", value: ctx.reviewStatus }
  ];
}

function objectivesTable(ctx) {
  return table(["目标维度", "目标表述（可评价）"], [
    ["知识", ctx.objectives.knowledge.join("；")],
    ["技能", ctx.objectives.skills.join("；")],
    ["职业素养", ctx.objectives.attitude.join("；")]
  ]);
}

function buildDesignDoc(ctx, refs) {
  const total = ctx.hours * 45;
  const phases = allocate(total, [0.08, 0.12, 0.12, 0.14, 0.28, 0.14, 0.12]);
  const phaseNames = ["情境导入", "任务呈现", "资讯", "计划/决策", "实施", "检查", "评价/总结"];
  return doc("design", "01 教学设计方案", `${ctx.course.name} · ${ctx.task.title} · 教学设计方案`, metaFor(ctx), [
    section("design-01", "01", "课程与任务定位", [
      paragraph(`本资源包以「${ctx.course.name}」中的典型工作任务「${ctx.task.title}」为载体，面向${ctx.major?.name || "本专业"}学生，按工学一体化思路组织“工作任务—学习任务—学习成果”的学习过程。`),
      paragraph(ctx.task.situation),
      table(["项目", "内容"], [
        ["课程性质", `${ctx.course.category || "未注明"} / ${ctx.course.phase || "阶段未注明"}`],
        ["课程知识包", `${ctx.pack.title}（${ctx.reviewStatus}）`],
        ["任务成果", ctx.task.deliverable],
        ["教学条件", ctx.conditions]
      ])
    ], refs),
    section("design-02", "02", "学情分析与教学策略", [
      paragraph(`教学对象：${ctx.learners}。`),
      list([
        "以真实工作任务导入，先让学生明确“做什么、做到什么程度、凭什么验收”。",
        "采用资讯—计划—决策—实施—检查—评价的工作过程，教师从讲授者转为任务设计者、巡回指导者和证据审核者。",
        "将安全确认、记录留痕和版本管理嵌入任务过程，而不是最后附加。",
        "对基础较弱的学生提供流程图、检查表和示范；对学有余力的学生增加排故或优化任务。"
      ]),
      callout("知识包边界", ctx.pack.disclaimer)
    ], refs),
    section("design-03", "03", "教学目标", [
      paragraph("目标按知识、技能、职业素养三个维度表述，并在评价表中对应证据。"),
      objectivesTable(ctx)
    ], refs),
    section("design-04", "04", "教学重点、难点与突破", [
      table(["项目", "内容", "突破策略"], [
        ["重点", ctx.keyPoints.join("；"), "用任务书、流程图、单步验证和检查表把关键动作显性化。"],
        ["难点", ctx.difficulties.join("；"), "提供故障案例、信号链排查表和教师示范，安排同伴互检。"],
        ["安全", ctx.safety.slice(0, 3).join("；"), "安全交底、断电验电、教师确认和过程记录四步前置。"]
      ])
    ], refs),
    section("design-05", "05", "教学流程总览", [
      paragraph(`建议总学时 ${ctx.hours}（按每学时 45 分钟估算，实际以学院教学计划为准）。以下时间为教学组织建议，可根据校历、设备和班级情况调整。`),
      table(["阶段", "建议时间", "主要活动", "学习证据"], phaseNames.map((name, index) => [
        name,
        `${phases[index]} 分钟`,
        index === 0 ? "用真实任务情境和成果样例建立任务意识" :
          index === 1 ? "明确任务、交付物、验收标准与安全边界" :
            index === 2 ? "查阅图纸、说明书、知识包和评价标准" :
              index === 3 ? "分组制定流程、分工和风险控制方案" :
                index === 4 ? "按任务步骤实施，教师巡回指导，记录关键节点" :
                  index === 5 ? "自检、互检、功能/质量验证与异常处理" :
                    "展示成果、证据答辩、评价与反思",
        index === 4 ? "过程记录、关键节点照片/数据、异常处理" : "任务单、流程图、检查表或评价记录"
      ]))
    ], refs),
    section("design-06", "06", "评价设计与资源", [
      table(["评价维度", "建议权重", "主要证据"], ctx.assessment.map((item) => [item.dimension, `${item.weight}%`, item.evidence])),
      paragraph("评价采用过程性评价与成果评价结合；权重为教学参考，正式使用前按学院现行评价制度调整。"),
      list(ctx.equipment.map((item) => `${item.name}：${item.note}`))
    ], refs)
  ]);
}

function buildLessonDoc(ctx, refs) {
  const total = ctx.hours * 45;
  const phases = allocate(total, [0.06, 0.08, 0.12, 0.12, 0.30, 0.14, 0.10, 0.08]);
  const rows = [
    ["情境导入", `${phases[0]} 分钟`, "呈现分拣站任务与成果样例，提出驱动问题。", "观察、提问，明确学习对象。", "任务书、成果样例"],
    ["任务呈现", `${phases[1]} 分钟`, "下发任务书，解释交付物、验收条件、安全与时间。", "阅读任务，标记疑问。", "任务书、评价表"],
    ["资讯", `${phases[2]} 分钟`, "引导查阅图纸、I/O 清单、知识包和安全规程；示范关键操作。", "查阅资料，完成资讯问题，识别风险。", "资讯记录、风险清单"],
    ["计划/决策", `${phases[3]} 分钟`, "组织分组讨论，审核流程、分工与安全方案。", "制定步骤、分工和检查点，进行方案说明。", "流程图、分工表"],
    ["实施", `${phases[4]} 分钟`, "巡回指导，控制关键节点；不代替学生操作。", "按步骤实施，记录条件、现象和数据；遇异常先停机报告。", "过程记录、程序/作品"],
    ["检查", `${phases[5]} 分钟`, "组织自检、互检；提供验收表和故障案例。", "对照标准检查，记录偏差并修正。", "自检/互检表"],
    ["评价", `${phases[6]} 分钟`, "组织成果展示与证据答辩，按量规评价。", "展示成果，说明依据，进行自评互评。", "评价表、答辩记录"],
    ["总结", `${phases[7]} 分钟`, "归纳知识、技能与安全要点，布置改进任务。", "反思学习过程，形成改进计划。", "反思表"]
  ];
  return doc("lesson", "02 工学一体化教案", `${ctx.task.title} · 工学一体化教案`, metaFor(ctx), [
    section("lesson-01", "01", "教学基本信息", [
      paragraph(`课程：${ctx.course.name}；章节：${ctx.chapter.title}；任务：${ctx.task.title}；课型：${ctx.lessonType}；建议学时：${ctx.hours}。`),
      paragraph(`教学条件：${ctx.conditions}`)
    ], refs),
    section("lesson-02", "02", "教学目标与重难点", [
      objectivesTable(ctx),
      table(["重点", "难点"], [[ctx.keyPoints.join("；"), ctx.difficulties.join("；")]])
    ], refs),
    section("lesson-03", "03", "教学准备", [
      list([
        "教师：任务书、图纸/说明书、评价表、检查表、示范准备、设备安全检查。",
        "学生：复习先修知识，阅读任务书，准备记录工具与防护用品。",
        `设备与工具：${ctx.equipment.map((item) => item.name).join("、")}。`,
        "分组：建议按编程、接线检查、操作、记录等角色分工，并轮换。",
        "安全：完成安全交底，确认急停、隔离和应急路线。"
      ])
    ], refs),
    section("lesson-04", "04", "教学过程", [
      paragraph("以下为教学组织建议，时间可按实际教学计划调整。"),
      table(["阶段", "建议时间", "教师活动", "学生活动", "学习证据"], rows)
    ], refs),
    section("lesson-05", "05", "安全与应急", [
      checklist(ctx.safety),
      callout("边界", "设备参数、I/O 地址、软件版本和安全权限以现场设备说明书、实训室规程及课程负责人确认为准。")
    ], refs),
    section("lesson-06", "06", "作业与课后改进", [
      paragraph("完成任务记录整理，提交成果包；针对本次出现的异常写一条“现象—原因—验证—改进”反思。"),
      lines(3, "教师课后反思")
    ], refs)
  ]);
}

function buildWorkpageDoc(ctx, refs) {
  const isPLC = /PLC/i.test(ctx.course.name) || ctx.pack.id === "CUR-PLC-001";
  return doc("workpage", "03 教学工作页", `${ctx.task.title} · 教学工作页（学生用）`, metaFor(ctx), [
    section("wp-01", "01", "任务情境与交付物", [
      paragraph(ctx.task.situation),
      table(["项目", "要求"], [
        ["交付物", ctx.task.deliverable],
        ["完成方式", "小组合作，角色分工并轮换；个人保留过程记录。"],
        ["验收依据", "任务书、评价表、设备/工艺文件与教师确认。"],
        ["安全前提", "完成安全交底，未经教师确认不得上电或进入动作区域。"]
      ])
    ], refs),
    section("wp-02", "02", "学习目标（学生版）", [
      list([
        ...ctx.objectives.knowledge.map((item) => `我能说明：${item}`),
        ...ctx.objectives.skills.map((item) => `我能完成：${item}`),
        ...ctx.objectives.attitude.map((item) => `我会做到：${item}`)
      ])
    ], refs),
    section("wp-03", "03", "课前准备", [
      checklist([
        "阅读任务书，标出不懂的术语和要求。",
        "核对设备、工具、材料和防护用品。",
        "确认安全通道、急停位置和应急报告方式。",
        "准备记录工具，不在设备上放置杂物。"
      ])
    ], refs),
    section("wp-04", "04", "实施步骤与记录", [
      ...ctx.taskSteps.map((step, index) => paragraph(`${index + 1}. ${step}`)),
      isPLC ? table(["信号/设备", "类型", "地址", "常开/常闭或说明"], [
        ["启动按钮", "输入", "待填写", "常开"],
        ["停止按钮", "输入", "待填写", "按图纸与安全要求"],
        ["光电/接近传感器", "输入", "待填写", "待核对"],
        ["输送电机", "输出", "待填写", "待核对"],
        ["分拣执行器", "输出", "待填写", "待核对"]
      ]) : table(["步骤", "操作要点", "完成情况", "记录/证据"], ctx.taskSteps.map((step, index) => [`${index + 1}`, step, "□完成 □待改进", ""])),
      lines(4, "关键过程记录（条件、预期、实际、处理）")
    ], refs),
    section("wp-05", "05", "自检与互检", [
      checklist([
        "任务要求的交付物是否齐全？",
        "关键步骤是否有记录和证据？",
        "安全确认是否在操作前完成？",
        "异常是否先停机、记录并报告？",
        "同伴能否根据记录复现你的过程？"
      ]),
      table(["检查项", "自检", "互检", "改进"], [
        ["目标/要求理解", "□", "□", ""],
        ["操作步骤", "□", "□", ""],
        ["安全与规范", "□", "□", ""],
        ["记录与成果", "□", "□", ""]
      ])
    ], refs),
    section("wp-06", "06", "反思与提问", [
      lines(3, "本次最需要改进的一点"),
      lines(3, "我还需要教师/同伴帮助的问题")
    ], refs)
  ]);
}

function buildInfoDoc(ctx, refs) {
  const chapterPoints = ctx.chapter?.knowledgePoints || [];
  const taskPoints = (ctx.pack.chapters || []).flatMap((chapter) => chapter.knowledgePoints || []).filter((point) => ctx.taskKPs.includes(point.id));
  const points = uniqueBy([...chapterPoints, ...taskPoints], (point) => point.id);
  return doc("infopage", "04 教学信息页", `${ctx.chapter.title} · 教学信息页`, metaFor(ctx), [
    section("info-01", "01", "本章知识结构", [
      paragraph(`本章“${ctx.chapter.title}”围绕${ctx.task.title}组织。以下知识点用于支持任务实施，不替代教材和课程标准全文。`),
      table(["编号", "知识点", "学习提示", "来源"], points.map((point, index) => [
        `KP-${String(index + 1).padStart(2, "0")}`,
        point.title,
        point.statement,
        (point.sourceRefs || []).join("；") || "待补充"
      ]))
    ], refs),
    section("info-02", "02", "关键概念与操作要点", [
      ...points.slice(0, 8).map((point) => paragraph(`**${point.title}**：${point.statement}`)),
      callout("来源说明", `本页知识点来自${ctx.sourceLabel}。标为“待审核”的内容需教研组确认；设备参数以现场说明书为准。`)
    ], refs),
    section("info-03", "03", "常见错误与安全提醒", [
      list([
        "把“能运行”当作唯一验收标准，缺少过程记录与自检。",
        "未核对 I/O 地址、传感器类型或公共端就下载程序。",
        "强制输出后未解除，复位测试不完整。",
        "为调试方便短接急停、安全门或联锁。",
        "备份文件没有版本、来源和恢复验证。"
      ]),
      checklist(ctx.safety.slice(0, 5))
    ], refs)
  ]);
}

function buildTaskbookDoc(ctx, refs) {
  return doc("taskbook", "05 学习任务书", `${ctx.task.title} · 学习任务书`, metaFor(ctx), [
    section("task-01", "01", "任务情境", [
      paragraph(ctx.task.situation),
      paragraph(`你所在的团队需要完成「${ctx.task.title}」，并提交可核查的成果与过程记录。`)
    ], refs),
    section("task-02", "02", "任务目标与交付物", [
      objectivesTable(ctx),
      table(["交付物", "具体要求", "提交方式"], [
        [ctx.task.deliverable, "真实、完整、可核查；包含过程记录和自检/互检。", "按教师指定时间提交电子/纸质成果。"],
        ["过程记录", "条件、预期、实际、处理四类信息。", "工作页/记录表。"],
        ["反思", "说明一个问题和一条改进措施。", "反思表。"]
      ])
    ], refs),
    section("task-03", "03", "实施要求与时间", [
      table(["阶段", "建议时间", "必须完成"], [
        ["资讯/计划", `${Math.max(5, Math.round(ctx.hours * 45 * 0.2))} 分钟`, "任务理解、资料查阅、流程与分工"],
        ["实施", `${Math.max(10, Math.round(ctx.hours * 45 * 0.5))} 分钟`, "按步骤操作、记录关键节点"],
        ["检查/评价", `${Math.max(5, Math.round(ctx.hours * 45 * 0.3))} 分钟`, "自检互检、成果展示、反思"]
      ]),
      paragraph("总时间以学院教学计划为准；教师可根据设备台套数和班级规模调整。")
    ], refs),
    section("task-04", "04", "安全与纪律", [
      checklist(ctx.safety),
      paragraph("未完成安全交底、未获教师确认，不得上电、下载、复位或进入设备动作区域。")
    ], refs),
    section("task-05", "05", "验收标准", [
      table(["维度", "合格要求"], ctx.assessment.map((item) => [item.dimension, `${item.evidence}（建议权重 ${item.weight}%）`]))
    ], refs)
  ]);
}

function buildPracticalDoc(ctx, refs) {
  return doc("practical", "06 实训操作指导书", `${ctx.task.title} · 实训操作指导书`, metaFor(ctx), [
    section("pr-01", "01", "适用范围与安全前提", [
      paragraph(`适用于${ctx.course.name}课程的「${ctx.task.title}」实训教学。`),
      checklist(ctx.safety),
      callout("设备边界", "本指导书不提供具体设备型号、I/O 地址和参数设定值；必须以现场设备铭牌、图纸、说明书和教师确认值为准。")
    ], refs),
    section("pr-02", "02", "设备、工具与材料", [
      table(["名称", "用途/要求"], ctx.equipment.map((item) => [item.name, item.note]))
    ], refs),
    section("pr-03", "03", "操作步骤", [
      ...ctx.taskSteps.map((step, index) => paragraph(`${index + 1}. ${step}`)),
      paragraph("每完成一个关键步骤，先在记录表写下条件、预期和实际，再进入下一步。")
    ], refs),
    section("pr-04", "04", "质量验收", [
      table(["验收项", "合格标准", "记录方式"], [
        ["任务完整性", "交付物齐全，步骤无遗漏", "检查表"],
        ["功能/质量", "达到任务书规定的功能或质量要求", "功能测试/测量记录"],
        ["安全规范", "无短接安全装置、无违规进入动作区域", "教师观察/自检"],
        ["记录追溯", "条件、现象、处理可复现", "工作页/记录表"]
      ])
    ], refs),
    section("pr-05", "05", "常见异常与处理", [
      table(["现象", "优先检查", "处理边界"], [
        ["设备无反应", "电源、急停、模式选择、通信", "停机报告，不擅自拆修"],
        ["输入信号不变化", "传感器、公共端、地址、接线", "断电检查，教师确认"],
        ["输出不动作", "程序输出、执行器电源、机械卡阻", "断电/停机后检查"],
        ["动作顺序错误", "流程条件、互锁、定时/计数、复位", "先单步验证，再连续运行"],
        ["无法恢复备份", "设备/软件版本、文件完整性、权限", "停止恢复并报告"]
      ])
    ], refs)
  ]);
}

function buildActivityDoc(ctx, refs) {
  return doc("activity", "07 教学活动策划", `${ctx.task.title} · 教学活动策划`, metaFor(ctx), [
    section("act-01", "01", "活动设计原则", [
      list([
        "以工作任务为主线，活动服务于“会做、会查、会说、会改”。",
        "每个活动都有明确产出或证据，避免“讨论一下”没有结果。",
        "教师活动聚焦任务设计、示范、观察、追问和证据审核。",
        "学生活动体现计划、实施、检查、评价的主体地位。"
      ])
    ], refs),
    section("act-02", "02", "活动序列", [
      table(["环节", "教师活动", "学生活动", "资源/工具", "证据"], [
        ["任务导入", "呈现真实任务与成果样例，提出驱动问题", "观察、提问、形成任务意识", "任务书、样例", "问题清单"],
        ["资讯", "提供资料清单，示范检索与识图", "查阅图纸/说明书/知识包", "图纸、信息页", "资讯记录"],
        ["计划", "审核流程与分工，提示风险", "制定步骤、分工和时间计划", "流程图、工作页", "计划表"],
        ["决策", "组织方案说明，追问依据", "说明方案、风险和验收条件", "评价表", "方案说明"],
        ["实施", "巡回观察，关键节点确认", "按步骤实施并记录", "设备、工具、工作页", "过程记录/作品"],
        ["检查", "提供检查表和故障案例", "自检、互检、修正", "检查表", "检查记录"],
        ["评价", "组织展示与证据答辩", "展示、自评、互评", "评价表", "评分与答辩记录"],
        ["总结", "归纳知识/技能/安全要点", "反思并制定改进计划", "反思表", "反思表"]
      ])
    ], refs),
    section("act-03", "03", "分层与支持", [
      list([
        "基础层：提供流程图模板、检查表和关键步骤示范。",
        "提高层：增加故障诊断、节拍优化或方案比较任务。",
        "对操作风险高的环节，先模拟/空载，再在教师监护下实机。",
        "对表达困难的学生，提供“现象—判断—验证—结论”句式支架。"
      ])
    ], refs)
  ]);
}

function buildEvaluationDoc(ctx, refs) {
  const total = ctx.assessment.reduce((sum, item) => sum + Number(item.weight || 0), 0);
  return doc("evaluation", "08 学生评价表", `${ctx.task.title} · 学生评价表`, metaFor(ctx), [
    section("eval-01", "01", "评价说明", [
      paragraph(`本表用于「${ctx.task.title}」的过程性与成果评价。建议权重合计 ${total} 分；如学院有现行评价制度，以学院制度为准。`),
      paragraph("评价证据来自工作页、成果、观察、提问和答辩；不以单一结果或教师印象代替证据。")
    ], refs),
    section("eval-02", "02", "评价量规", [
      table(["维度", "权重", "优秀", "合格", "待改进", "证据"], ctx.assessment.map((item) => [
        item.dimension,
        `${item.weight}%`,
        `达到要求且能说明依据，过程完整、可复现`,
        `基本达到要求，少量遗漏可纠正`,
        `关键要求缺失或需大量提示`,
        item.evidence
      ]))
    ], refs),
    section("eval-03", "03", "自评 / 互评 / 教师评", [
      table(["维度", "自评", "互评", "教师评", "改进建议"], ctx.assessment.map((item) => [item.dimension, "____", "____", "____", ""])),
      paragraph("总分：自评 ____ / 互评 ____ / 教师评 ____。"),
      lines(3, "综合评价与签字（学生/同伴/教师）")
    ], refs),
    section("eval-04", "04", "目标—评价对应检查", [
      table(["目标", "对应评价维度", "是否有证据"], [
        ["知识目标", ctx.assessment[0]?.dimension || "过程与记录", "□有 □部分 □无"],
        ["技能目标", ctx.assessment[1]?.dimension || "程序与功能", "□有 □部分 □无"],
        ["职业素养", ctx.assessment[0]?.dimension || "过程与安全", "□有 □部分 □无"]
      ])
    ], refs)
  ]);
}

function buildReflectionDoc(ctx, refs) {
  return doc("reflection", "09 教学反思表", `${ctx.task.title} · 教学反思表`, metaFor(ctx), [
    section("ref-01", "01", "事实与证据", [
      paragraph("先记录事实，再写判断。事实包括学生完成情况、典型错误、时间使用、设备状态和安全行为。"),
      table(["观察点", "事实记录", "证据"], [
        ["目标达成", "", "成果/测试/提问"],
        ["学生参与", "", "观察/分工/记录"],
        ["难点突破", "", "错误类型/修正过程"],
        ["安全与规范", "", "检查表/教师观察"],
        ["时间与设备", "", "教学记录"]
      ])
    ], refs),
    section("ref-02", "02", "分析与改进", [
      lines(3, "本次最有效的一个教学决定及依据"),
      lines(3, "最需要改进的一个环节及原因"),
      lines(3, "下一次的具体改进措施（可观察、可执行）")
    ], refs),
    section("ref-03", "03", "课程知识包反馈", [
      paragraph(`本次使用知识包：${ctx.pack.title}（${ctx.reviewStatus}）。如发现知识点、任务、设备或评价与现场不符，请记录并提交教研组修订，不直接覆盖原始数据。`),
      lines(2, "需修订的知识点/任务编号与理由")
    ], refs)
  ]);
}

function buildSlidesDoc(ctx, refs) {
  const points = (ctx.chapter?.knowledgePoints || []).slice(0, 6);
  return doc("slides", "10 教学课件内容大纲", `${ctx.task.title} · 课件内容大纲`, metaFor(ctx), [
    section("slide-01", "01", "课件结构", [
      paragraph("以下为课件内容大纲，不是 PPTX 文件；教师可根据课时和学生情况增删。每页控制在 1 个核心信息。")
    ], refs),
    section("slide-02", "02", "页面大纲", [
      list([
        "封面：课程、章节、任务、班级、教师、版本。",
        "任务情境：展示真实工作情境、成果样例和驱动问题。",
        "学习目标：知识、技能、素养，使用学生能理解的语言。",
        "任务书：交付物、验收标准、时间与安全边界。",
        ...points.map((point) => `知识点：${point.title}——用图、例或操作说明解释。`),
        "实施流程：资讯—计划—决策—实施—检查—评价。",
        "关键操作/安全：示范要点、禁止事项、急停与报告。",
        "评价量规：维度、权重、证据和自评互评方式。",
        "总结与反思：本次学什么、下一步改进什么。"
      ]),
      paragraph("每页配 1—2 个问题或任务，避免整页文字；关键图、表和操作步骤应来自课程知识包或教师审核资料。")
    ], refs)
  ]);
}

export function buildTeachingBundle({ courseId, chapterId, taskId, learners, hours, conditions, objectiveExtra, referenceDocs = [] } = {}, catalog) {
  const course = catalog.courses.find((item) => item.id === courseId);
  if (!course) throw new Error("未找到课程记录");
  const pack = resolveCurriculum(course, catalog);
  if (!pack) throw new Error("未找到课程知识包");
  const chapter = pack.chapters.find((item) => item.id === chapterId) || pack.chapters[0];
  if (!chapter) throw new Error("该课程尚未建立章节");
  const task = pack.tasks.find((item) => item.id === taskId) || pack.tasks.find((item) => (item.knowledgePointIds || []).some((id) => chapter.knowledgePoints.some((point) => point.id === id))) || pack.tasks[0];
  if (!task) throw new Error("该课程尚未建立典型工作任务");
  const ctx = buildContext(course, catalog, pack, chapter, task, { learners, hours, conditions, objectiveExtra });
  const refs = knowledgeRefs(pack, task, chapter);
  const sources = buildCurriculumSources(pack, catalog);
  const teacherRefs = (referenceDocs || []).filter((doc) => doc?.id && doc?.title).map((doc) => ({
    key: `KB:${doc.id}`,
    ref: `KB-${doc.id}`,
    docId: doc.id,
    docTitle: doc.title,
    sectionTitle: "教师选择的参考材料",
    source: doc.category || "教学资源",
    snippet: doc.summary || "",
    teacherSelected: true
  }));
  for (const ref of teacherRefs) {
    if (!sources.some((source) => source.ref === ref.ref)) sources.push(ref);
  }
  const knowledge = {
    packId: pack.id,
    packVersion: pack.version || "1.0",
    packUpdatedAt: pack.updatedAt || "",
    reviewer: pack.reviewer || "",
    reviewStatus: pack.reviewStatus || pack.status || "pending",
    reviewStatusLabel: pack.statusLabel || "待教研组审核",
    chapterId: chapter.id,
    chapterTitle: chapter.title,
    taskId: task.id,
    taskTitle: task.title,
    knowledgePoints: (chapter.knowledgePoints || []).map((point) => ({
      id: point.id,
      title: point.title,
      statement: point.statement,
      sourceRefs: point.sourceRefs || [],
      reviewStatus: point.reviewStatus || "pending"
    })),
    taskKnowledgePointIds: task.knowledgePointIds || [],
    taskSteps: task.steps || [],
    taskEquipment: task.equipment || [],
    taskSafety: task.safety || [],
    referenceDocs: (referenceDocs || []).filter((doc) => doc?.id).map((doc) => ({ id: doc.id, title: doc.title, category: doc.category || "" })),
    packKnowledgePointCount: (pack.chapters || []).reduce((sum, item) => sum + (item.knowledgePoints || []).length, 0),
    packTaskCount: (pack.tasks || []).length,
    sourceRefs: Array.from(new Set([...(task.sourceRefs || []), ...(chapter.knowledgePoints || []).flatMap((point) => point.sourceRefs || [])]))
  };
  const docs = [
    buildDesignDoc(ctx, refs),
    buildLessonDoc(ctx, refs),
    buildWorkpageDoc(ctx, refs),
    buildInfoDoc(ctx, refs),
    buildTaskbookDoc(ctx, refs),
    buildPracticalDoc(ctx, refs),
    buildActivityDoc(ctx, refs),
    buildEvaluationDoc(ctx, refs),
    buildReflectionDoc(ctx, refs),
    buildSlidesDoc(ctx, refs)
  ];
  const now = new Date().toISOString();
  const id = `studio_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const compliance = {
    status: "review",
    checks: [
      { status: "warn", title: "课程知识包审核状态", detail: `${pack.title}：${pack.statusLabel}。正式教学使用前须由课程负责人/教研组审核。` },
      { status: "warn", title: "设备与参数边界", detail: "设备型号、I/O 地址、软件版本、参数和安全权限以现场设备说明书、实训室规程和教师确认为准。" },
      { status: "pass", title: "共享上下文", detail: "10 类资源共享课程、章节、任务、学时、版本和来源。" }
    ]
  };
  const artifact = {
    id,
    scene: "studio",
    sceneLabel: "工学一体化教学资源包",
    title: `${course.name} · ${task.title} · 教学资源包`,
    intro: `已基于「${pack.title}」生成 10 类教学资源。知识包状态：${pack.statusLabel}。请重点审核设备参数、安全条款和课程内容；系统不会把未审核内容标为学校官方标准。`,
    context: {
      course: course.name,
      major: ctx.major?.name || "",
      chapter: chapter.title,
      task: task.title,
      hours: ctx.hours,
      learners: ctx.learners,
      conditions: ctx.conditions,
      curriculumId: pack.id,
      curriculumStatus: pack.status,
      curriculumVersion: pack.version || "1.0",
      knowledgePointCount: (chapter.knowledgePoints || []).length,
      referenceDocs: (referenceDocs || []).filter((doc) => doc?.id).map((doc) => ({ id: doc.id, title: doc.title, category: doc.category || "" })),
      sourceLabel: ctx.sourceLabel
    },
    docs,
    sources,
    compliance,
    generatedAt: now,
    template: "工学一体化资源包 v1",
    version: 1
  };
  const bundle = {
    id,
    schema: "shouyu.studio.v1",
    version: 1,
    status: "draft",
    reviewStatus: "待审核",
    createdAt: now,
    updatedAt: now,
    courseId: course.id,
    majorId: course.majorId,
    chapterId: chapter.id,
    taskId: task.id,
    demo: Boolean(pack.demo),
    title: artifact.title,
    curriculumId: pack.id,
    curriculumStatus: pack.status,
    sourceLabel: ctx.sourceLabel,
    context: {
      course: course.name,
      major: ctx.major?.name || "",
      group: ctx.group?.name || "",
      department: ctx.department?.name || "",
      chapter: chapter.title,
      task: task.title,
      learners: ctx.learners,
      hours: ctx.hours,
      conditions: ctx.conditions,
      objectives: ctx.objectives,
      keyPoints: ctx.keyPoints,
      difficulties: ctx.difficulties,
      equipment: ctx.equipment,
      safety: ctx.safety,
      assessment: ctx.assessment,
      reviewStatus: pack.statusLabel,
      sourceLabel: ctx.sourceLabel,
      curriculumId: pack.id
    },
    knowledge,
    artifact,
    quality: null,
    conversationId: ""
  };
  return bundle;
}

export function bundleSummary(bundle) {
  return {
    id: bundle.id,
    title: bundle.title,
    course: bundle.context.course,
    chapter: bundle.context.chapter,
    task: bundle.context.task,
    hours: bundle.context.hours,
    docs: bundle.artifact.docs.length,
    sources: bundle.artifact.sources.length,
    reviewStatus: bundle.curriculumStatus,
    demo: bundle.demo,
    createdAt: bundle.createdAt,
    status: bundle.status
  };
}