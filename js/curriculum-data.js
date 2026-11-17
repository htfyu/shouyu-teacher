/**
 * 授渔 · 代表性课程知识包（演示版）
 *
 * 设计边界：
 * - 课程名称、类别、阶段、年份来自专业数据库中的原始课程记录；
 * - 章节、知识点、任务、设备与评价，来自已存在的校本教学示例
 *   PK-PLC-01 / PK-PLC-02，并明确标注“校本示例 · 待教研组审核”；
 * - 本文不是学院正式课程标准，不虚构学校未公开的学时、教材版本或设备型号；
 * - 设备参数、I/O 地址、软件版本和安全权限必须以现场设备说明书、
 *   实训室规程和课程负责人确认结果为准。
 */

export const CURRICULUM_REVIEW_STATUS = {
  pending: "待教研组审核",
  approved: "已审核",
  rejected: "退回修改"
};

export const SOURCE_TYPES = {
  A: "官方权威资料",
  B: "学校审核资料",
  C: "教师个人教学资料",
  D: "行业参考资料",
  E: "AI 辅助生成内容"
};

/**
 * 原表课程行的来源编号与来源表专业字段存在错配。
 * 这里保留原值，只记录经来源表比对后的“建议修订”，不修改原始 Excel / programs-data。
 */
export const SOURCE_CORRECTIONS = [
  {
    courseId: "course-0010",
    courseName: "PLC技术及应用",
    original: ["S1", "S20", "S27"],
    corrected: ["S1", "S2", "S3"],
    method: "按来源表 major/title 字段比对；S20、S27 在来源表中属于其他专业，S2/S3 为机电一体化技术专业介绍",
    basis: ["S2", "S3"],
    status: "recommended",
    statusLabel: "建议修订，待教研组确认",
    checkedAt: "2026-11-17"
  },
  {
    courseId: "course-0035",
    courseName: "工业机器人操作与应用",
    original: ["S1", "S24", "S27"],
    corrected: ["S1", "S6", "S7", "S8"],
    method: "按来源表 major 字段比对；S24/S27 在来源表中属于交通装备产业系其他专业，S6/S7/S8 为工业机器人应用与维护专业来源",
    basis: ["S6", "S7", "S8"],
    status: "recommended",
    statusLabel: "建议修订，待教研组确认",
    checkedAt: "2026-11-17"
  },
  {
    courseId: "course-0111",
    courseName: "新能源汽车底盘与维修",
    original: ["S1", "S14", "S37"],
    corrected: ["S1", "S20", "S21", "S22"],
    method: "按来源表 major 字段比对；S14/S37 在来源表中属于其他专业，S20/S21/S22 为新能源汽车检测与维修专业来源",
    basis: ["S20", "S21", "S22"],
    status: "recommended",
    statusLabel: "建议修订，待教研组确认",
    checkedAt: "2026-11-17"
  }
];

export function getSourceCorrection(courseId) {
  return SOURCE_CORRECTIONS.find((item) => item.courseId === courseId) || null;
}

export const CURRICULUM_PACKS = [
  {
    id: "CUR-PLC-001",
    courseId: "course-0010",
    majorId: "major-008",
    title: "PLC技术及应用",
    subtitle: "物料分拣站 PLC 控制系统安装与调试",
    version: "2026.11-demo-v1",
    updatedAt: "2026-11-17",
    reviewer: "",
    reviewedAt: "",
    reviewStatus: "pending",
    reviewNote: "由授渔教研示例整理，尚未由机电一体化技术教研组逐条审核。",
    status: "pending",
    statusLabel: CURRICULUM_REVIEW_STATUS.pending,
    demo: true,
    officialBasis: {
      sourceIds: ["S2", "S3"],
      note: "课程名称、课程类别、开设阶段与数据年份来自原表课程记录；S2/S3 为学院公开专业介绍来源。原表未公开本课程完整课程标准，故以下内容不冒充官方标准。",
      sourceType: "A"
    },
    contentProvenance: {
      sourceType: "C",
      label: "教师教学资料 / 校本示例",
      note: "章节、知识点与任务由授渔教研示例 PK-PLC-01 / PK-PLC-02 整理；需由机电一体化技术教研组审核后方可作为正式教学依据。"
    },
    summary: "以物料分拣站为教学载体，围绕 PLC 硬件与 I/O、基本逻辑、顺序控制、单步与联调、故障诊断、程序备份与安全边界组织 4 个章节和 5 个典型工作任务。",
    objectives: {
      knowledge: [
        "说明 PLC 的基本组成、扫描工作过程以及输入/输出接口的作用",
        "解释梯形图、定时器、计数器、互锁与复位的基本逻辑",
        "说明 I/O 分配、程序注释、版本标识和备份记录的基本规范"
      ],
      skills: [
        "依据工艺流程完成物料分拣站的 I/O 分配和外围接线检查",
        "编写并下载带注释的梯形图程序，完成手动、单步和自动运行验证",
        "按“现象—判断—验证—结论”分析常见故障，完成程序备份与恢复验证"
      ],
      attitude: [
        "执行急停可达、危险区域确认和强制 I/O 登记等安全要求",
        "坚持先验证输入再验证输出、先单步再连续、每次只改变一个条件",
        "如实记录测试条件、预期现象、实际现象和修改内容"
      ]
    },
    keyPoints: [
      "I/O 分配与外围接线的一致性",
      "顺序控制中的进入条件、输出动作和退出条件",
      "单步验证与自动联调的先后关系",
      "强制 I/O 的登记、监护和及时解除"
    ],
    difficulties: [
      "把工艺流程转换为状态转移表或流程图",
      "根据现象定位到输入信号、程序逻辑、输出执行或机械卡阻",
      "在故障处理中保持安全回路完整，不以短接换取调试便利"
    ],
    chapters: [
      {
        id: "CH-PLC-01",
        no: "01",
        title: "PLC 硬件、I/O 与安全边界",
        summary: "认识 PLC 及物料分拣站的硬件组成，理解输入/输出类型、I/O 分配和调试安全边界。",
        knowledgePoints: [
          {
            id: "KP-PLC-01-01",
            title: "PLC 的基本组成与扫描过程",
            statement: "PLC 由电源、CPU、存储器、输入/输出模块和通信接口等组成；运行时按输入采样、程序执行、输出刷新循环工作。理解扫描过程有助于解释输入变化与输出响应之间的时间关系。",
            sourceRefs: ["PK-PLC-01 §01"],
            sourceType: "C",
            reviewStatus: "pending"
          },
          {
            id: "KP-PLC-01-02",
            title: "输入/输出类型与接线检查",
            statement: "输入信号可能来自按钮、限位、光电/接近传感器等，输出可能驱动继电器、接触器、指示灯或电磁阀。接线前必须核对信号类型、公共端、电源等级和端子定义，不能仅凭线色判断。",
            sourceRefs: ["PK-PLC-01 §01"],
            sourceType: "C",
            reviewStatus: "pending"
          },
          {
            id: "KP-PLC-01-03",
            title: "I/O 分配表与地址核对",
            statement: "I/O 分配表应说明设备/信号名称、输入或输出类型、地址、常开/常闭状态和备注。程序中的地址必须与分配表、外围接线和工作站图纸一致；设备实际地址以设备说明书和图纸为准。",
            sourceRefs: ["PK-PLC-01 §01"],
            sourceType: "C",
            reviewStatus: "pending"
          },
          {
            id: "KP-PLC-01-04",
            title: "调试安全边界与急停",
            statement: "程序下载、复位和强制 I/O 前必须确认输出负载和机械动作范围，保持急停可达并设置警示。不得短接急停、安全门、光栅或其他联锁；人员不得进入未确认安全的机械动作区域。",
            sourceRefs: ["PK-PLC-01 §03"],
            sourceType: "C",
            reviewStatus: "pending"
          }
        ]
      },
      {
        id: "CH-PLC-02",
        no: "02",
        title: "基本逻辑、定时与程序结构",
        summary: "从梯形图基本逻辑到定时器、计数器、互锁与复位，建立可读、可调试、可维护的程序结构。",
        knowledgePoints: [
          {
            id: "KP-PLC-02-01",
            title: "梯形图基本逻辑",
            statement: "梯形图用触点、线圈和功能块表达逻辑关系。常开/常闭触点的选择取决于控制要求，不能把“停止按钮用常闭”简单等同于程序中的常闭触点；应结合外围接线和故障安全要求判断。",
            sourceRefs: ["PK-PLC-01 §02"],
            sourceType: "C",
            reviewStatus: "pending"
          },
          {
            id: "KP-PLC-02-02",
            title: "定时器、计数器与顺序关系",
            statement: "定时器和计数器用于实现延时、节拍和计数控制。使用时要明确计时/计数条件、设定值、复位条件和单位；顺序控制应写清每一步的进入条件、输出动作和退出条件。",
            sourceRefs: ["PK-PLC-01 §02"],
            sourceType: "C",
            reviewStatus: "pending"
          },
          {
            id: "KP-PLC-02-03",
            title: "互锁、自锁与复位",
            statement: "互锁用于阻止相互冲突的动作同时发生；自锁用于保持启动后的运行状态；复位条件必须明确且可验证。安全联锁不得被普通程序逻辑替代。",
            sourceRefs: ["PK-PLC-01 §02"],
            sourceType: "C",
            reviewStatus: "pending"
          },
          {
            id: "KP-PLC-02-04",
            title: "注释、版本与可维护性",
            statement: "程序应包含清晰的变量/地址注释、版本标识和必要的修改记录。含义不明的中间变量、无注释的输出和未记录的参数修改，会显著增加维护与排故成本。",
            sourceRefs: ["PK-PLC-01 §02", "PK-PLC-02 §01"],
            sourceType: "C",
            reviewStatus: "pending"
          }
        ]
      },
      {
        id: "CH-PLC-03",
        no: "03",
        title: "物料分拣站控制程序与联调",
        summary: "把分拣工艺流程转换为 I/O 分配、状态流程和程序，完成手动、单步与自动联调。",
        knowledgePoints: [
          {
            id: "KP-PLC-03-01",
            title: "分拣工艺流程与状态划分",
            statement: "将工件识别、输送、分拣、复位等动作拆分为可观察的状态；每个状态明确进入条件、输出动作、退出条件和异常处理。流程不清时先画状态转移表或流程图，不要直接堆砌梯形图。",
            sourceRefs: ["PK-PLC-01 §02"],
            sourceType: "C",
            reviewStatus: "pending"
          },
          {
            id: "KP-PLC-03-02",
            title: "手动、单步与自动模式",
            statement: "手动模式用于逐个验证输入和输出；单步模式用于检查顺序和互锁；自动模式用于验证连续运行、复位和异常停止。调试顺序应为先输入、后输出，先单步、后连续。",
            sourceRefs: ["PK-PLC-01 §02"],
            sourceType: "C",
            reviewStatus: "pending"
          },
          {
            id: "KP-PLC-03-03",
            title: "联调记录与验收证据",
            statement: "联调记录应写明测试条件、预期现象、实际现象、判断和修改内容；验收证据可包括 I/O 分配表、程序、单步记录、自动运行记录和异常处理记录。只写“运行正常”不能证明目标达成。",
            sourceRefs: ["PK-PLC-01 §02", "PK-PLC-01 §04"],
            sourceType: "C",
            reviewStatus: "pending"
          }
        ]
      },
      {
        id: "CH-PLC-04",
        no: "04",
        title: "故障诊断、备份恢复与交付",
        summary: "从现象出发排查故障，完成程序/参数备份、恢复验证与安全交付。",
        knowledgePoints: [
          {
            id: "KP-PLC-04-01",
            title: "故障现象与信号链排查",
            statement: "按输入信号、程序逻辑、输出执行、机械/气动执行和电源/通信的顺序排查；先确认安全和停机状态，再测量与验证。常见问题包括输入类型判断错误、定时/顺序关系混乱、强制输出未复位和未做复位测试。",
            sourceRefs: ["PK-PLC-01 §04"],
            sourceType: "C",
            reviewStatus: "pending"
          },
          {
            id: "KP-PLC-04-02",
            title: "程序与参数备份",
            statement: "备份不是复制一个文件，而是能在授权范围内被找到、识别、校验和恢复。备份前核对设备、控制器、软件和工程文件的对应关系，记录来源、时间、版本和责任人。",
            sourceRefs: ["PK-PLC-02 §01"],
            sourceType: "C",
            reviewStatus: "pending"
          },
          {
            id: "KP-PLC-04-03",
            title: "恢复验证与变更记录",
            statement: "恢复前确认设备处于安全维护状态并再次核对版本；恢复后检查程序块、参数、通信和关键动作，记录差异。发现版本不一致时停止恢复，先查清原因并报告。",
            sourceRefs: ["PK-PLC-02 §02", "PK-PLC-02 §04"],
            sourceType: "C",
            reviewStatus: "pending"
          },
          {
            id: "KP-PLC-04-04",
            title: "数据、授权与交付边界",
            statement: "程序、参数、网络配置和工艺数据可能属于学校或合作单位资产，应按授权访问和存储，不上传到未经批准的网盘、聊天工具或第三方平台。恢复和下载必须有授权、有人复核并记录变更原因。",
            sourceRefs: ["PK-PLC-02 §03"],
            sourceType: "C",
            reviewStatus: "pending"
          }
        ]
      }
    ],
    tasks: [
      {
        id: "TASK-PLC-01",
        title: "物料分拣站 I/O 分配与接线检查",
        situation: "教学用物料分拣站需要接入 PLC 控制。你拿到工艺流程、工作站图纸和器件清单，但 I/O 分配表尚未完成，部分外围接线需要核对。",
        deliverable: "I/O 分配表、外围接线检查记录、风险确认单",
        knowledgePointIds: ["KP-PLC-01-01", "KP-PLC-01-02", "KP-PLC-01-03", "KP-PLC-01-04"],
        steps: [
          "阅读工艺流程和图纸，列出输入/输出设备及信号类型。",
          "为每个信号分配地址，注明常开/常闭、公共端和备注。",
          "断电核对端子、线号和公共端，记录与图纸不一致处。",
          "完成上电前安全检查，经教师确认后做输入信号逐点验证。"
        ],
        equipment: ["PLC 实训台", "物料分拣教学工作站", "工作站图纸与 I/O 清单", "万用表", "端子/导线/线号管"],
        safety: ["断电、验电后接线", "上电前经教师确认", "不得擅自短接急停或安全联锁"],
        sourceRefs: ["PK-PLC-01 §01", "PK-PLC-01 §03"]
      },
      {
        id: "TASK-PLC-02",
        title: "手动与单步模式程序验证",
        situation: "程序初稿已完成。需要在不进入自动运行的情况下，逐个验证输入信号、输出动作、定时/计数和互锁关系。",
        deliverable: "手动/单步验证记录、程序修改说明、互锁测试记录",
        knowledgePointIds: ["KP-PLC-02-01", "KP-PLC-02-02", "KP-PLC-02-03", "KP-PLC-03-02"],
        steps: [
          "确认急停可达、机械动作区域无人，进入手动模式。",
          "逐点验证输入信号在程序中的状态变化。",
          "逐点验证输出动作、定时/计数和复位条件。",
          "测试互锁：人为制造冲突条件，确认输出被阻止且可复位。",
          "记录测试条件、预期、实际和修改内容。"
        ],
        equipment: ["PLC 实训台", "编程软件", "物料分拣教学工作站", "万用表"],
        safety: ["机械动作前确认人员撤离", "强制 I/O 须登记并监护", "异常先停机记录，不擅自复位"],
        sourceRefs: ["PK-PLC-01 §02", "PK-PLC-01 §03"]
      },
      {
        id: "TASK-PLC-03",
        title: "物料分拣自动联调与验收",
        situation: "手动/单步验证通过后，需要在自动模式下验证连续运行、分拣结果、复位和异常停止。",
        deliverable: "自动联调记录、验收单、异常处理记录",
        knowledgePointIds: ["KP-PLC-03-01", "KP-PLC-03-02", "KP-PLC-03-03"],
        steps: [
          "确认所有强制 I/O 已解除，工作区安全。",
          "从初始状态启动自动流程，观察上料、输送、识别、分拣和复位。",
          "连续运行并记录节拍、分拣结果和异常现象。",
          "测试停止、急停和复位后的恢复流程。",
          "对照验收条件完成自检、互检和教师确认。"
        ],
        equipment: ["PLC 实训台", "物料分拣教学工作站", "工件/模拟物料", "编程软件", "计时工具"],
        safety: ["运行中不得进入动作区域", "急停后须查明原因再复位", "不得为追求节拍拆除防护"],
        sourceRefs: ["PK-PLC-01 §02", "PK-PLC-01 §04"]
      },
      {
        id: "TASK-PLC-04",
        title: "分拣站故障诊断与处理",
        situation: "教师设置了一个受控故障：某类工件不被分拣或输送动作不按顺序执行。你需要在不扩大故障的前提下定位并处理。",
        deliverable: "故障诊断记录、处理方案、恢复验证记录",
        knowledgePointIds: ["KP-PLC-04-01", "KP-PLC-01-02", "KP-PLC-02-03"],
        steps: [
          "记录故障现象，确认安全状态并停止相关动作。",
          "按输入—程序—输出—执行机构—电源/通信的顺序排查。",
          "用测量/监控/替换/对比等方法验证假设。",
          "提出处理方案，经教师确认后实施。",
          "恢复后进行功能验证并记录原因与预防措施。"
        ],
        equipment: ["PLC 实训台", "编程软件", "万用表", "工作站图纸", "设备说明书"],
        safety: ["故障排查前先停机隔离", "不得带电拆装", "不擅自修改安全联锁"],
        sourceRefs: ["PK-PLC-01 §04", "PK-PLC-01 §03"]
      },
      {
        id: "TASK-PLC-05",
        title: "程序备份、恢复与版本交接",
        situation: "课程结束前，需要将可运行程序、参数和必要说明归档，确保下一组能够找到、识别并恢复正确版本。",
        deliverable: "备份文件清单、版本记录、恢复验证记录、交接说明",
        knowledgePointIds: ["KP-PLC-02-04", "KP-PLC-04-02", "KP-PLC-04-03", "KP-PLC-04-04"],
        steps: [
          "核对设备、控制器、软件和工程文件版本。",
          "按命名规则导出程序/参数，记录时间、版本和责任人。",
          "做一次恢复验证，检查程序块、参数、通信和关键动作。",
          "填写版本记录和交接说明，清理临时文件。",
          "按授权要求存放，不上传到未批准的平台。"
        ],
        equipment: ["PLC 实训台", "编程软件", "授权存储介质", "备份/恢复记录表"],
        safety: ["恢复前确认设备处于安全维护状态", "不得覆盖来源不明的程序", "按学校数据管理制度存放"],
        sourceRefs: ["PK-PLC-02 §01", "PK-PLC-02 §02", "PK-PLC-02 §03", "PK-PLC-02 §04"]
      }
    ],
    abilities: [
      "识读 PLC 控制系统图纸与 I/O 清单",
      "编写、下载并调试带注释的梯形图程序",
      "按单步—联调顺序验证顺序控制与互锁",
      "按信号链分析常见故障并形成记录",
      "完成程序/参数备份、恢复验证与版本交接",
      "执行急停、强制 I/O、机械动作区域的安全要求"
    ],
    equipment: [
      { name: "PLC 实训台", note: "型号、I/O 地址和电源等级以现场设备铭牌及说明书为准" },
      { name: "物料分拣教学工作站", note: "传感器类型、执行器和机械动作范围以现场为准" },
      { name: "编程软件", note: "版本与授权以学校安装环境为准" },
      { name: "万用表", note: "量程、表笔和测量方法按教师要求" },
      { name: "工作站图纸、I/O 清单、设备说明书", note: "不得用记忆替代图纸核对" }
    ],
    safety: [
      "接线、改线、拆线前必须断电、验电并确认隔离。",
      "上电、下载、复位和强制 I/O 前须经教师确认，保持急停可达。",
      "不得短接急停、安全门、光栅或其他安全联锁。",
      "机械动作前确认人员撤离危险区域，运行中不得进入。",
      "发生碰撞、异常停止或安全装置动作时，先保护现场并报告。"
    ],
    assessment: [
      { dimension: "过程与安全", weight: 30, evidence: "防护、断电验电、急停/危险区确认、强制 I/O 登记、工位整理" },
      { dimension: "程序与功能", weight: 30, evidence: "I/O 分配、梯形图逻辑、注释/版本、手动/单步/自动功能" },
      { dimension: "调试与排故", weight: 25, evidence: "测试条件、现象记录、信号链排查、恢复验证" },
      { dimension: "记录与交接", weight: 15, evidence: "I/O 表、联调记录、备份清单、版本/交接说明" }
    ],
    sourceRefs: [
      "PK-PLC-01 §01",
      "PK-PLC-01 §02",
      "PK-PLC-01 §03",
      "PK-PLC-01 §04",
      "PK-PLC-02 §01",
      "PK-PLC-02 §02",
      "PK-PLC-02 §03",
      "PK-PLC-02 §04"
    ],
    disclaimer: "本课程知识包是校本教学示例，不是广州市技师学院正式课程标准。课程名称/类别/阶段来自原表；章节、知识点、任务与评价由 PK-PLC-01/02 整理，需机电一体化技术教研组审核。设备型号、I/O 地址、软件版本和安全权限以现场设备说明书、实训室规程和课程负责人确认结果为准。"
  },
  {
    id: "CUR-ROBOT-001",
    courseId: "course-0035",
    majorId: "major-005",
    title: "工业机器人操作与应用",
    subtitle: "搬运工作站点位示教、单步验证与安全联锁",
    version: "2026.11-demo-v1",
    updatedAt: "2026-11-17",
    reviewer: "",
    reviewedAt: "",
    reviewStatus: "pending",
    reviewNote: "由授渔教研示例整理，尚未由工业机器人应用与维护教研组逐条审核。",
    status: "pending",
    statusLabel: CURRICULUM_REVIEW_STATUS.pending,
    demo: true,
    officialBasis: {
      sourceIds: ["S6", "S7", "S8"],
      note: "课程名称、类别、阶段和数据年份来自原表课程记录；S6/S7/S8 为学院公开的工业机器人应用与维护专业来源。原表课程行误引 S24/S27，本知识包采用来源表比对后的 S6/S7/S8，原值保留在 SOURCE_CORRECTIONS。",
      sourceType: "A"
    },
    contentProvenance: {
      sourceType: "C",
      label: "教师教学资料 / 校本示例",
      note: "章节、知识点与任务由授渔教研示例 PK-ROBOT-01 / PK-ROBOT-02 整理；机器人型号、负载、坐标系、夹具和示教器操作以设备说明书与工作站图纸为准。"
    },
    summary: "以包装/装配工作站的搬运任务为载体，围绕工作站组成、工具/工件坐标系、点位示教、单步验证、围栏安全、自动循环和异常交接组织 4 个章节与 5 个典型工作任务。",
    objectives: {
      knowledge: [
        "说明搬运工作站的机器人、控制器、示教器、末端夹具、围栏和安全装置的基本组成",
        "解释工具坐标系、工件坐标系与关节/直角坐标的关系",
        "说明手动、单步、自动运行的区别以及安全联锁的作用",
        "说明点位表、程序注释、试运行记录和交接记录的基本规范"
      ],
      skills: [
        "在教师监护下完成工作站外观、围栏、急停和夹具的作业前检查",
        "核对工具/工件坐标系并完成抓取、提升、搬运、放置和返回点位示教",
        "按“低速—单步—连续”的顺序验证路径、干涉和循环稳定性",
        "记录修改内容、预期动作、实际动作和异常处理结果"
      ],
      attitude: [
        "进入机器人工作范围前执行停机、隔离、上锁挂牌和现场确认",
        "不短接、不屏蔽围栏门锁、光栅、急停等安全装置",
        "修改程序后重新单步验证，不以“以前能跑”替代验证记录"
      ]
    },
    keyPoints: [
      "工具/工件坐标系与点位姿态的一致性",
      "抓取、提升、搬运、放置和返回的路径无干涉",
      "单步验证与自动循环的先后关系",
      "围栏内作业许可、监护人职责和急停可达"
    ],
    difficulties: [
      "根据工件与夹具姿态判断点位是否会产生碰撞",
      "把连续动作拆成可单步验证的程序段",
      "在节拍优化与安全、路径可靠性之间取舍"
    ],
    chapters: [
      {
        id: "CH-ROBOT-01",
        no: "01",
        title: "搬运工作站、坐标系与任务边界",
        summary: "认识工作站组成和搬运任务，理解坐标系、夹具、点位和交付物的关系。",
        knowledgePoints: [
          {
            id: "KP-ROBOT-01-01",
            title: "搬运工作站的组成",
            statement: "典型搬运工作站由工业机器人、控制器、示教器、末端夹具、工件/托盘、围栏、安全门锁、光栅和急停等组成。教学任务开始前必须确认设备状态、围栏完整和人员位置；具体型号与配置以工作站图纸和说明书为准。",
            sourceRefs: ["PK-ROBOT-01 §01"],
            sourceType: "C",
            reviewStatus: "pending"
          },
          {
            id: "KP-ROBOT-01-02",
            title: "工具坐标系与工件坐标系",
            statement: "工具坐标系描述末端工具中心点的位置与姿态，工件坐标系描述工件/托盘在机器人坐标系中的位置。点位示教前必须核对当前使用的坐标系，不能把不同坐标系下的点位混用。",
            sourceRefs: ["PK-ROBOT-01 §01", "PK-ROBOT-01 §02"],
            sourceType: "C",
            reviewStatus: "pending"
          },
          {
            id: "KP-ROBOT-01-03",
            title: "抓取点、放置点与姿态",
            statement: "搬运点位不仅包含位置，还包含末端姿态、夹具开合和接近/离开方向。抓取点和放置点应留有安全间隙，先确认无干涉，再验证夹持和释放是否可靠。",
            sourceRefs: ["PK-ROBOT-01 §01", "PK-ROBOT-01 §02"],
            sourceType: "C",
            reviewStatus: "pending"
          },
          {
            id: "KP-ROBOT-01-04",
            title: "任务交付物与节拍边界",
            statement: "搬运任务的交付物通常包括点位表、带注释的程序、试运行记录和异常处理记录。节拍要求应建立在安全、质量和循环稳定的基础上；未验证的单点速度不能作为节拍结论。",
            sourceRefs: ["PK-ROBOT-01 §01", "PK-ROBOT-01 §04"],
            sourceType: "C",
            reviewStatus: "pending"
          }
        ]
      },
      {
        id: "CH-ROBOT-02",
        no: "02",
        title: "点位示教、程序结构与单步验证",
        summary: "从手动模式、使能开关到点位示教、程序注释和单步验证，建立可复现的调试流程。",
        knowledgePoints: [
          {
            id: "KP-ROBOT-02-01",
            title: "手动模式、使能开关与速度限制",
            statement: "示教应在手动/低速模式下进行，使用使能开关并保持安全距离。示教器操作、模式切换和速度限制以设备说明书为准；不得在自动运行状态下进入围栏内示教。",
            sourceRefs: ["PK-ROBOT-01 §02", "PK-ROBOT-01 §03"],
            sourceType: "C",
            reviewStatus: "pending"
          },
          {
            id: "KP-ROBOT-02-02",
            title: "点位示教顺序",
            statement: "按“原点/安全位—接近点—抓取点—提升点—搬运中间点—放置点—离开点—返回点”的顺序示教，逐点确认姿态、夹具状态和干涉。点位命名应与程序注释一致。",
            sourceRefs: ["PK-ROBOT-01 §02"],
            sourceType: "C",
            reviewStatus: "pending"
          },
          {
            id: "KP-ROBOT-02-03",
            title: "单步验证与干涉检查",
            statement: "每次修改程序后先单步验证，确认机器人、夹具、工件和周边设备不干涉；再逐步提高速度。不能跳过单步直接连续运行，也不能用遮挡安全装置的方式“试一下”。",
            sourceRefs: ["PK-ROBOT-01 §02", "PK-ROBOT-01 §03"],
            sourceType: "C",
            reviewStatus: "pending"
          },
          {
            id: "KP-ROBOT-02-04",
            title: "程序注释与修改记录",
            statement: "程序应包含点位、坐标系、夹具动作和关键等待条件的注释；修改记录应写明修改内容、预期动作、实际动作和结论。只写“运行正常”不能作为调试证据。",
            sourceRefs: ["PK-ROBOT-01 §02", "PK-ROBOT-01 §04"],
            sourceType: "C",
            reviewStatus: "pending"
          }
        ]
      },
      {
        id: "CH-ROBOT-03",
        no: "03",
        title: "围栏内作业许可与安全联锁",
        summary: "把停机、隔离、上锁挂牌、监护和自动运行前确认落实到每一步操作。",
        knowledgePoints: [
          {
            id: "KP-ROBOT-03-01",
            title: "安全围栏、门锁、光栅与急停",
            statement: "围栏、门锁、光栅和急停构成机器人工作站的人员防护。任何短接、屏蔽、拆卸或旁路都会使防护失效；发现安全装置异常应立即停止使用并报告。",
            sourceRefs: ["PK-ROBOT-01 §03"],
            sourceType: "C",
            reviewStatus: "pending"
          },
          {
            id: "KP-ROBOT-03-02",
            title: "进入工作范围前的停机与隔离",
            statement: "进入机器人工作范围前，必须按现场要求停止机器人、切断驱动或置于安全状态，并完成上锁挂牌和现场确认。不能只按示教器停止键就进入围栏。",
            sourceRefs: ["PK-ROBOT-01 §03"],
            sourceType: "C",
            reviewStatus: "pending"
          },
          {
            id: "KP-ROBOT-03-03",
            title: "示教监护与人员位置",
            statement: "围栏内示教应有监护人，示教者与监护人明确急停位置和撤离路线；其他人员不得进入。多人配合作业时，谁操作、谁监护、谁确认必须说清。",
            sourceRefs: ["PK-ROBOT-01 §03"],
            sourceType: "C",
            reviewStatus: "pending"
          },
          {
            id: "KP-ROBOT-03-04",
            title: "首次自动运行前确认",
            statement: "首次自动运行前确认人员撤离、围栏复位、工具/工件夹持可靠，并采用验证过的低速条件；运行中不得伸手进入工作范围。",
            sourceRefs: ["PK-ROBOT-01 §03", "PK-ROBOT-01 §04"],
            sourceType: "C",
            reviewStatus: "pending"
          }
        ]
      },
      {
        id: "CH-ROBOT-04",
        no: "04",
        title: "自动循环、异常处置与评价",
        summary: "从单步到自动循环，记录节拍、异常和交接信息，形成可审核的成果。",
        knowledgePoints: [
          {
            id: "KP-ROBOT-04-01",
            title: "从单步到自动循环",
            statement: "自动循环前确认所有单步验证通过、强制/手动干预已解除、工作区无人。先低速连续运行，观察抓取、放置、返回和等待条件，再逐步优化节拍。",
            sourceRefs: ["PK-ROBOT-01 §02", "PK-ROBOT-01 §04"],
            sourceType: "C",
            reviewStatus: "pending"
          },
          {
            id: "KP-ROBOT-04-02",
            title: "循环稳定性与节拍记录",
            statement: "循环稳定性应记录连续运行的次数、失败现象、复位方式和恢复结果；节拍记录要注明测试条件、程序和速度参数。不能用单次演示替代稳定性结论。",
            sourceRefs: ["PK-ROBOT-01 §04"],
            sourceType: "C",
            reviewStatus: "pending"
          },
          {
            id: "KP-ROBOT-04-03",
            title: "常见异常与处置边界",
            statement: "常见异常包括坐标系未核对、点位姿态干涉、夹具未夹紧、跳过单步直接连续运行和人员进入围栏。出现异常先停机、保护现场、报告教师，不擅自屏蔽报警或反复复位。",
            sourceRefs: ["PK-ROBOT-01 §04", "PK-ROBOT-01 §03"],
            sourceType: "C",
            reviewStatus: "pending"
          },
          {
            id: "KP-ROBOT-04-04",
            title: "评价证据与交接",
            statement: "评价应覆盖坐标系与工具检查、点位正确性、路径无干涉、程序结构、单步验证、循环稳定性、安全行为和记录。交接时说明程序版本、点位修改、已知异常和下次运行条件。",
            sourceRefs: ["PK-ROBOT-01 §04"],
            sourceType: "C",
            reviewStatus: "pending"
          }
        ]
      }
    ],
    tasks: [
      {
        id: "TASK-ROBOT-01",
        title: "搬运工作站认知与作业前安全检查",
        situation: "你第一次进入工业机器人搬运工作站。任务书要求在不启动自动运行的情况下，识别工作站组成、安全装置和本次搬运任务边界。",
        deliverable: "工作站组成清单、安全装置确认表、风险点与人员位置记录",
        knowledgePointIds: ["KP-ROBOT-01-01", "KP-ROBOT-03-01", "KP-ROBOT-03-03"],
        steps: [
          "对照工作站图纸识别机器人、控制器、示教器、夹具、围栏和安全装置。",
          "检查围栏、门锁、光栅、急停和警示标识，记录异常。",
          "确认本次任务的工件、托盘、夹具和人员活动范围。",
          "完成作业前安全确认，经教师签字后进入下一任务。"
        ],
        equipment: ["工业机器人搬运工作站", "工作站图纸", "安全确认表", "示教器", "警示标识"],
        safety: ["不得短接或屏蔽围栏门锁、光栅、急停", "进入围栏前完成停机、隔离和上锁挂牌", "示教必须有监护人"],
        sourceRefs: ["PK-ROBOT-01 §01", "PK-ROBOT-01 §03"]
      },
      {
        id: "TASK-ROBOT-02",
        title: "工具坐标系与工件坐标系核对",
        situation: "工作站更换了末端夹具和托盘。若直接使用旧点位，可能发生碰撞或抓取失败。你需要核对坐标系和工具中心点。",
        deliverable: "坐标系核对记录、工具/工件参数确认单、旧点位影响说明",
        knowledgePointIds: ["KP-ROBOT-01-02", "KP-ROBOT-01-03", "KP-ROBOT-02-01"],
        steps: [
          "确认当前工具编号、工具中心点和工件坐标系编号。",
          "在手动/低速模式下核对工具姿态和工件位置。",
          "检查旧点位是否仍适用，标记需要重新示教的点位。",
          "记录坐标系变更和影响范围，经教师确认。"
        ],
        equipment: ["工业机器人工作站", "示教器", "工具/工件坐标系记录表", "夹具", "托盘"],
        safety: ["手动/低速模式示教", "保持安全距离和急停可达", "不得在自动运行状态下进入围栏"],
        sourceRefs: ["PK-ROBOT-01 §01", "PK-ROBOT-01 §02", "PK-ROBOT-01 §03"]
      },
      {
        id: "TASK-ROBOT-03",
        title: "搬运点位示教与单步验证",
        situation: "需要完成从输送线抓取工件到托盘放置的点位示教，并确保每个点位无干涉、夹持可靠。",
        deliverable: "点位表、带注释程序、单步验证记录、干涉检查记录",
        knowledgePointIds: ["KP-ROBOT-02-02", "KP-ROBOT-02-03", "KP-ROBOT-02-04", "KP-ROBOT-01-03"],
        steps: [
          "按安全位、接近点、抓取点、提升点、放置点和返回点顺序示教。",
          "逐点确认姿态、夹具开合和周边间隙。",
          "添加程序注释，记录每个点位的用途。",
          "单步运行并记录预期动作、实际动作和修改内容。"
        ],
        equipment: ["工业机器人工作站", "示教器", "工件/托盘", "点位记录表", "夹具"],
        safety: ["每次修改后重新单步验证", "示教时使用使能开关并设监护人", "不得跳过干涉检查直接连续运行"],
        sourceRefs: ["PK-ROBOT-01 §02", "PK-ROBOT-01 §03"]
      },
      {
        id: "TASK-ROBOT-04",
        title: "路径优化与自动循环调试",
        situation: "单步验证通过后，需要在安全条件下验证连续搬运、放置和返回，并记录循环稳定性与节拍。",
        deliverable: "自动循环记录、节拍记录、异常与复位记录、验收单",
        knowledgePointIds: ["KP-ROBOT-04-01", "KP-ROBOT-04-02", "KP-ROBOT-03-04", "KP-ROBOT-02-04"],
        steps: [
          "确认所有手动干预和强制状态已解除，工作区无人。",
          "低速启动自动循环，观察抓取、搬运、放置和返回。",
          "连续运行并记录次数、失败现象、复位方式和节拍。",
          "经教师确认后逐步优化，保留修改前后的记录。"
        ],
        equipment: ["工业机器人工作站", "示教器", "计时工具", "自动循环记录表", "工件/托盘"],
        safety: ["首次自动运行前确认人员撤离和围栏复位", "运行中不得进入工作范围", "异常先停机，不擅自屏蔽报警"],
        sourceRefs: ["PK-ROBOT-01 §03", "PK-ROBOT-01 §04"]
      },
      {
        id: "TASK-ROBOT-05",
        title: "异常处置、程序交接与成果归档",
        situation: "连续运行中出现一次放置偏移。你需要按边界处理异常，并把程序、点位和已知问题交接给下一组。",
        deliverable: "异常记录、处置说明、程序版本清单、交接记录",
        knowledgePointIds: ["KP-ROBOT-04-03", "KP-ROBOT-04-04", "KP-ROBOT-02-04", "KP-ROBOT-03-02"],
        steps: [
          "立即停止循环，确认人员与设备安全。",
          "记录现象、发生阶段、程序版本和已执行操作。",
          "在教师指导下判断是点位、夹具、工件还是程序问题。",
          "修改后重新单步验证并更新版本记录。",
          "填写交接说明，明确已知异常和下次运行条件。"
        ],
        equipment: ["工业机器人工作站", "示教器", "异常记录表", "程序版本清单", "交接记录"],
        safety: ["异常处置前先停机隔离", "不擅自修改安全回路", "程序交接必须核对版本"],
        sourceRefs: ["PK-ROBOT-01 §02", "PK-ROBOT-01 §03", "PK-ROBOT-01 §04"]
      }
    ],
    abilities: [
      "识读工业机器人搬运工作站图纸与安全装置",
      "核对工具/工件坐标系和点位姿态",
      "完成抓取、搬运、放置和返回点位示教",
      "按单步—连续顺序验证路径与循环稳定性",
      "执行围栏内作业许可、监护和急停要求",
      "记录异常、程序版本和交接信息"
    ],
    equipment: [
      { name: "工业机器人搬运工作站", note: "机器人型号、负载、轴数和工作范围以设备铭牌与说明书为准" },
      { name: "机器人控制器与示教器", note: "操作模式、使能开关和权限以设备说明书为准" },
      { name: "末端夹具与工件/托盘", note: "夹持方式、负载和干涉边界以现场配置为准" },
      { name: "安全围栏、门锁、光栅、急停", note: "不得短接或屏蔽；具体联锁逻辑以工作站安全评估为准" },
      { name: "工作站图纸、点位表、程序版本清单", note: "点位和程序修改必须留记录" }
    ],
    safety: [
      "进入机器人工作范围前必须停机、隔离、上锁挂牌并完成现场确认。",
      "示教必须使用使能开关、保持安全距离并设监护人。",
      "不得短接、屏蔽或拆卸围栏门锁、光栅、急停等安全装置。",
      "首次自动运行前确认人员撤离、围栏复位和夹具可靠。",
      "发生碰撞、异常停止或人员进入时，先停机保护现场并报告。"
    ],
    assessment: [
      { dimension: "安全与作业许可", weight: 30, evidence: "停机隔离、上锁挂牌、围栏/急停检查、监护与人员位置" },
      { dimension: "坐标系与点位", weight: 30, evidence: "工具/工件坐标系核对、点位姿态、抓取/放置可靠性" },
      { dimension: "程序与单步验证", weight: 25, evidence: "程序注释、点位表、单步记录、干涉检查" },
      { dimension: "循环与交接", weight: 15, evidence: "自动循环记录、节拍、异常处置、版本与交接" }
    ],
    sourceRefs: [
      "PK-ROBOT-01 §01",
      "PK-ROBOT-01 §02",
      "PK-ROBOT-01 §03",
      "PK-ROBOT-01 §04",
      "PK-ROBOT-02 §01",
      "PK-ROBOT-02 §02",
      "PK-ROBOT-02 §03",
      "PK-ROBOT-02 §04"
    ],
    disclaimer: "本课程知识包是校本教学示例，不是广州市技师学院正式课程标准。课程名称/类别/阶段来自原表；章节、知识点、任务与评价由 PK-ROBOT-01/02 整理，需工业机器人应用与维护教研组审核。机器人型号、负载、坐标系、夹具、速度参数和安全联锁以设备说明书、工作站图纸、安全评估和现场负责人确认结果为准。"
  },
  {
    id: "CUR-NEV-001",
    courseId: "course-0111",
    majorId: "major-015",
    title: "新能源汽车底盘与维修",
    subtitle: "高压安全确认与制动系统检查更换",
    version: "2026.11-demo-v1",
    updatedAt: "2026-11-17",
    reviewer: "",
    reviewedAt: "",
    reviewStatus: "pending",
    reviewNote: "由授渔教研示例整理，尚未由新能源汽车检测与维修教研组逐条审核。",
    status: "pending",
    statusLabel: CURRICULUM_REVIEW_STATUS.pending,
    demo: true,
    officialBasis: {
      sourceIds: ["S20", "S21", "S22"],
      note: "课程名称、类别、阶段和数据年份来自原表课程记录；S20/S21/S22 为学院公开的新能源汽车检测与维修专业来源。原表课程行误引 S14/S37，本知识包采用来源表比对后的 S20/S21/S22，原值保留在 SOURCE_CORRECTIONS。",
      sourceType: "A"
    },
    contentProvenance: {
      sourceType: "C",
      label: "教师教学资料 / 校本示例",
      note: "章节、知识点与任务由授渔教研示例 PK-CAR-01 / PK-CAR-02 整理；高压部件、断电验电、举升点、制动扭矩和路试条件以整车维修手册、高压安全规程和现场负责人确认为准。"
    },
    summary: "以新能源教学车辆的制动系统检查与更换为载体，围绕高压作业准入、车辆举升、制动片/盘测量、拆装复装、功能确认和交车记录组织 4 个章节与 5 个典型工作任务。",
    objectives: {
      knowledge: [
        "说明新能源车高压系统的主要部件、警示标识和潜在储能部位",
        "说明作业授权、断电、验电、防复电和隔离看护的基本流程",
        "说明制动片/制动盘磨损测量、卡钳检查和复装扭矩的基本要求",
        "说明举升点、锁止、功能确认和交车记录的基本规范"
      ],
      skills: [
        "在教学车辆上完成高压作业前安全确认和隔离设置",
        "按维修手册核对举升点并完成车辆举升与锁止",
        "使用量具检查制动片/盘磨损并记录实测数据",
        "按顺序完成制动片更换、复装和功能确认",
        "完成高压恢复确认、交车说明和异常记录"
      ],
      attitude: [
        "没有授权、没有监护、没有维修资料时不开始高压作业",
        "不凭经验缩短断电等待时间或跳过验电",
        "举升和拆装时先确认锁止、支撑和人员位置",
        "涉及车辆与客户信息时使用车辆编号并脱敏"
      ]
    },
    keyPoints: [
      "高压作业授权、监护和隔离边界",
      "断电、验电、防复电与恢复确认",
      "举升点、锁止和支撑稳定性",
      "制动片/盘测量与磨损判断",
      "复装扭矩、功能确认和交车记录"
    ],
    difficulties: [
      "把高压安全流程落实到每一步确认和记录",
      "区分制动片磨损、制动盘异常和卡钳导向问题的现象",
      "在空间受限的底盘区域规范使用量具和扭矩工具"
    ],
    chapters: [
      {
        id: "CH-NEV-01",
        no: "01",
        title: "高压安全、作业准入与车辆状态",
        summary: "从人员资质、作业授权、车辆状态和高压部件识别开始，建立不可跳过的安全前置条件。",
        knowledgePoints: [
          {
            id: "KP-NEV-01-01",
            title: "高压部件识别与警示标识",
            statement: "新能源车高压系统可能包括动力电池、驱动电机、逆变器、高压线束和充电接口等。作业前应识别高压部件、线束走向、警示标识和潜在储能部位；具体位置以车型维修手册和车辆标识为准。",
            sourceRefs: ["PK-CAR-02 §01"],
            sourceType: "C",
            reviewStatus: "pending"
          },
          {
            id: "KP-NEV-01-02",
            title: "作业授权、监护与人员边界",
            statement: "高压系统作业必须由具备相应资质和授权的人员执行，并设置监护人和隔离区域。学生只进行安全确认、资料查询和模拟演练，不独立拆装高压部件。",
            sourceRefs: ["PK-CAR-02 §01", "PK-CAR-02 §04"],
            sourceType: "C",
            reviewStatus: "pending"
          },
          {
            id: "KP-NEV-01-03",
            title: "断电、验电与防复电",
            statement: "按车型维修手册执行关机、断开维修开关或低压电源、等待规定时间、验电和隔离防护。每一步记录确认人、时间与结果；验电结果明确前按带电状态对待，完成后设置防复电措施。",
            sourceRefs: ["PK-CAR-02 §02"],
            sourceType: "C",
            reviewStatus: "pending"
          },
          {
            id: "KP-NEV-01-04",
            title: "个人防护与异常应急",
            statement: "使用符合要求的绝缘工具和防护用品，去除导电饰品，保持作业区干燥整洁。发现异味、冒烟、异常发热、液体泄漏或人员疑似触电时，立即停止作业、隔离现场并报告，不直接触碰可能带电部位。",
            sourceRefs: ["PK-CAR-02 §03"],
            sourceType: "C",
            reviewStatus: "pending"
          }
        ]
      },
      {
        id: "CH-NEV-02",
        no: "02",
        title: "车辆举升、底盘与制动系统检查",
        summary: "在高压安全确认后，完成举升点核对、锁止和制动系统外观/尺寸检查。",
        knowledgePoints: [
          {
            id: "KP-NEV-02-01",
            title: "举升点、支撑与锁止",
            statement: "举升前确认车辆停放位置、举升点、支撑面和锁止机构；举升过程中人员不得进入车辆下方，举升后必须确认锁止可靠。举升设备额定载荷和操作要求以设备说明书为准。",
            sourceRefs: ["PK-CAR-01 §02"],
            sourceType: "C",
            reviewStatus: "pending"
          },
          {
            id: "KP-NEV-02-02",
            title: "制动片与制动盘测量",
            statement: "制动片厚度、制动盘厚度和表面状态应使用合适量具测量并记录实测值；判断标准以车型维修手册和学校教学要求为准。不能只凭目视或经验判断“还能用”。",
            sourceRefs: ["PK-CAR-01 §01", "PK-CAR-01 §04"],
            sourceType: "C",
            reviewStatus: "pending"
          },
          {
            id: "KP-NEV-02-03",
            title: "卡钳、导向销与线束检查",
            statement: "检查卡钳、导向销、防尘套、制动软管和轮速/磨损传感器线束的状态；发现泄漏、破损、卡滞或异常磨损应记录并报告，不擅自扩大拆检范围。",
            sourceRefs: ["PK-CAR-01 §01", "PK-CAR-01 §03"],
            sourceType: "C",
            reviewStatus: "pending"
          },
          {
            id: "KP-NEV-02-04",
            title: "底盘检查记录与异常分级",
            statement: "记录检查部位、实测数据、照片编号和异常等级；涉及高压部件、制动安全或结构损伤的异常必须立即停止并上报，不能以“下次再修”处理。",
            sourceRefs: ["PK-CAR-01 §04", "PK-CAR-02 §04"],
            sourceType: "C",
            reviewStatus: "pending"
          }
        ]
      },
      {
        id: "CH-NEV-03",
        no: "03",
        title: "制动片更换、复装与扭矩控制",
        summary: "按拆装顺序完成制动片更换，控制清洁、润滑和复装扭矩边界。",
        knowledgePoints: [
          {
            id: "KP-NEV-03-01",
            title: "拆装顺序与零件管理",
            statement: "按维修手册规定的顺序拆卸卡钳、制动片和附件，零件分类摆放并记录位置/方向；不得用撬棍强行撬动制动盘或拉扯传感器线束。",
            sourceRefs: ["PK-CAR-01 §03"],
            sourceType: "C",
            reviewStatus: "pending"
          },
          {
            id: "KP-NEV-03-02",
            title: "清洁、润滑与防尘",
            statement: "制动系统清洁应使用规定清洁剂和防护用品；润滑部位、润滑剂类型和用量以维修手册为准，不能让润滑剂污染摩擦面。粉尘清理应按职业健康要求进行。",
            sourceRefs: ["PK-CAR-01 §03"],
            sourceType: "C",
            reviewStatus: "pending"
          },
          {
            id: "KP-NEV-03-03",
            title: "复装扭矩与紧固顺序",
            statement: "螺栓/螺母应按维修手册规定的扭矩和顺序复装，使用校准过的扭矩工具；不得用“拧紧即可”替代规定扭矩。复装后检查防尘套、卡簧和线束走向。",
            sourceRefs: ["PK-CAR-01 §03", "PK-CAR-01 §04"],
            sourceType: "C",
            reviewStatus: "pending"
          },
          {
            id: "KP-NEV-03-04",
            title: "旧件、照片与维修记录",
            statement: "保留旧件或按学校要求拍照编号，记录拆前状态、更换原因和复装结果。涉及车辆/客户信息的照片应脱敏，不用车牌和学生姓名作为文件名。",
            sourceRefs: ["PK-CAR-01 §04"],
            sourceType: "C",
            reviewStatus: "pending"
          }
        ]
      },
      {
        id: "CH-NEV-04",
        no: "04",
        title: "功能确认、交车与评价",
        summary: "从制动功能、高压恢复到交车说明，完成可验证的闭环。",
        knowledgePoints: [
          {
            id: "KP-NEV-04-01",
            title: "制动踏板与静态功能确认",
            statement: "复装后先做静态检查：踏板行程、制动液液位、泄漏、卡钳/制动片安装和车轮转动是否正常。具体检查项目和路试条件以维修手册和学校安全规定为准，教学车辆的路试必须经教师批准。",
            sourceRefs: ["PK-CAR-01 §04", "PK-CAR-02 §04"],
            sourceType: "C",
            reviewStatus: "pending"
          },
          {
            id: "KP-NEV-04-02",
            title: "高压恢复与复电确认",
            statement: "高压系统恢复前确认人员撤离、工具清点、防护复位和维修开关状态；复电顺序、验证方法和授权人员以车型手册和现场规程为准。任何人不得擅自复电。",
            sourceRefs: ["PK-CAR-02 §02", "PK-CAR-02 §04"],
            sourceType: "C",
            reviewStatus: "pending"
          },
          {
            id: "KP-NEV-04-03",
            title: "交车说明与客户信息脱敏",
            statement: "交车说明应区分已确认完成、待观察和不能承诺的内容；使用车辆编号/教学编号，不记录车主姓名、电话、车牌等个人信息。",
            sourceRefs: ["PK-CAR-01 §04", "PK-CAR-02 §04"],
            sourceType: "C",
            reviewStatus: "pending"
          },
          {
            id: "KP-NEV-04-04",
            title: "评价证据与安全复盘",
            statement: "评价覆盖作业授权、断电验电、举升锁止、测量判断、拆装规范、扭矩复装、功能确认和记录交接。安全违规应终止操作并按学校制度处理，不能只扣分了事。",
            sourceRefs: ["PK-CAR-01 §04", "PK-CAR-02 §04"],
            sourceType: "C",
            reviewStatus: "pending"
          }
        ]
      }
    ],
    tasks: [
      {
        id: "TASK-NEV-01",
        title: "高压作业前安全确认与隔离",
        situation: "教学车辆进入制动系统维护工位。作业开始前，你需要确认人员资质、作业授权、车辆状态、高压部件和隔离边界。",
        deliverable: "高压作业前确认表、风险点清单、隔离与监护记录",
        knowledgePointIds: ["KP-NEV-01-01", "KP-NEV-01-02", "KP-NEV-01-03", "KP-NEV-01-04"],
        steps: [
          "核对作业授权、监护人和教学车辆状态。",
          "识别高压部件、线束走向、警示标识和潜在储能部位。",
          "按手册执行断电、等待、验电和隔离防护，记录确认人和时间。",
          "设置隔离区域、警示标识和防复电措施。"
        ],
        equipment: ["新能源教学车辆", "绝缘工具与防护用品", "验电设备", "隔离警示牌", "作业前确认表"],
        safety: ["没有授权/监护/维修资料不开始作业", "不得缩短等待时间或跳过验电", "学生不独立拆装高压部件"],
        sourceRefs: ["PK-CAR-02 §01", "PK-CAR-02 §02", "PK-CAR-02 §03"]
      },
      {
        id: "TASK-NEV-02",
        title: "车辆举升与底盘/制动系统检查",
        situation: "高压安全确认完成。需要按维修手册核对举升点，举升车辆并检查制动片、制动盘、卡钳和线束状态。",
        deliverable: "举升检查记录、制动片/盘实测数据、异常分级记录",
        knowledgePointIds: ["KP-NEV-02-01", "KP-NEV-02-02", "KP-NEV-02-03", "KP-NEV-02-04"],
        steps: [
          "核对举升点、支撑面和设备额定载荷。",
          "举升车辆并确认锁止可靠，人员不得进入未支撑区域。",
          "测量制动片/盘并记录实测值，检查卡钳、导向销和线束。",
          "按异常等级记录问题，涉及高压/制动安全的立即上报。"
        ],
        equipment: ["两柱/剪式举升设备", "制动片/盘量具", "照明与防护用品", "检查记录表"],
        safety: ["举升后必须确认锁止", "不得进入仅靠千斤顶支撑的车辆下方", "发现高压或制动安全异常立即停止"],
        sourceRefs: ["PK-CAR-01 §01", "PK-CAR-01 §02", "PK-CAR-01 §03", "PK-CAR-02 §04"]
      },
      {
        id: "TASK-NEV-03",
        title: "制动片检查与更换",
        situation: "检查发现一侧制动片接近更换界限。需要按维修手册完成拆装、清洁、润滑和复装，不能扩大拆检范围。",
        deliverable: "拆装记录、旧件/照片记录、复装扭矩记录、更换说明",
        knowledgePointIds: ["KP-NEV-03-01", "KP-NEV-03-02", "KP-NEV-03-03", "KP-NEV-03-04", "KP-NEV-02-02"],
        steps: [
          "按手册顺序拆卸卡钳和制动片，分类摆放零件。",
          "清洁安装面，按规定使用润滑剂并避免污染摩擦面。",
          "安装新制动片，按顺序和规定扭矩复装。",
          "保留旧件/照片记录，填写更换原因和复装结果。"
        ],
        equipment: ["制动片组件", "扭矩扳手", "清洁剂/防护用品", "零件盘", "维修记录表"],
        safety: ["粉尘清理按职业健康要求", "不得用普通润滑脂污染摩擦面", "扭矩以维修手册为准，不使用未校准工具"],
        sourceRefs: ["PK-CAR-01 §03", "PK-CAR-01 §04"]
      },
      {
        id: "TASK-NEV-04",
        title: "复装、功能确认与高压恢复",
        situation: "制动片更换完成。需要检查静态制动功能，确认工具清点、防护复位和高压系统恢复条件。",
        deliverable: "静态功能确认单、工具清点记录、高压恢复确认单",
        knowledgePointIds: ["KP-NEV-04-01", "KP-NEV-04-02", "KP-NEV-03-03", "KP-NEV-01-03"],
        steps: [
          "检查踏板行程、制动液液位、泄漏和车轮转动。",
          "清点工具、复位防护、确认人员撤离。",
          "按手册和现场授权完成高压恢复/复电确认。",
          "记录功能确认结果和仍需观察的项目。"
        ],
        equipment: ["新能源教学车辆", "扭矩扳手", "工具清点表", "高压恢复确认表"],
        safety: ["路试必须经教师批准", "任何人不得擅自复电", "恢复前确认人员撤离和防护复位"],
        sourceRefs: ["PK-CAR-01 §04", "PK-CAR-02 §02", "PK-CAR-02 §04"]
      },
      {
        id: "TASK-NEV-05",
        title: "交车记录、异常上报与安全复盘",
        situation: "车辆准备交回。你需要说明已完成项目、待观察项和不能承诺的内容，并对本次作业做安全复盘。",
        deliverable: "交车说明、异常上报表、安全复盘记录、脱敏照片清单",
        knowledgePointIds: ["KP-NEV-04-03", "KP-NEV-04-04", "KP-NEV-02-04", "KP-NEV-01-04"],
        steps: [
          "区分已确认完成、待观察和不能承诺的内容。",
          "使用车辆编号/教学编号记录，不上传车主个人信息。",
          "对本次作业的安全行为、工具使用和记录质量做复盘。",
          "将异常和未完成项按学校流程上报。"
        ],
        equipment: ["交车记录表", "异常上报表", "安全复盘表", "脱敏照片清单"],
        safety: ["不得把未确认项目写成已完成", "客户信息必须脱敏", "安全违规按学校制度处理"],
        sourceRefs: ["PK-CAR-01 §04", "PK-CAR-02 §04"]
      }
    ],
    abilities: [
      "识别新能源车高压部件和警示标识",
      "执行作业授权、断电验电、隔离和防复电",
      "按维修手册核对举升点并安全举升",
      "测量制动片/盘并判断异常",
      "按顺序完成制动片更换和扭矩复装",
      "完成功能确认、高压恢复和交车记录"
    ],
    equipment: [
      { name: "新能源教学车辆", note: "车型、高压部件位置和维修开关以整车维修手册为准" },
      { name: "绝缘工具与防护用品", note: "耐压等级、检查周期和穿戴要求以学校高压安全规程为准" },
      { name: "验电设备", note: "量程、使用前检查和验电方法按手册与现场规程" },
      { name: "举升设备", note: "额定载荷、举升点和锁止方式以设备说明书与车型手册为准" },
      { name: "制动片/盘量具与扭矩扳手", note: "量具和扭矩工具应在校准有效期内" }
    ],
    safety: [
      "没有授权、监护和维修资料时，不开始高压系统作业。",
      "严格执行断电、等待、验电、隔离和防复电，不凭经验缩短时间。",
      "举升后确认锁止，人员不得进入未可靠支撑的车辆下方。",
      "制动系统清洁、粉尘处理和润滑按职业健康与维修手册要求。",
      "高压恢复/复电必须由授权人员确认，教学车辆路试须经教师批准。",
      "车辆、车主和车牌信息必须脱敏。"
    ],
    assessment: [
      { dimension: "高压安全与作业许可", weight: 30, evidence: "授权核对、高压识别、断电验电、隔离防复电、监护" },
      { dimension: "举升与检查", weight: 25, evidence: "举升点、锁止、制动片/盘测量、异常记录" },
      { dimension: "拆装与复装", weight: 25, evidence: "拆装顺序、清洁润滑、扭矩、旧件记录" },
      { dimension: "功能确认与交车", weight: 20, evidence: "静态功能、工具清点、高压恢复、交车说明" }
    ],
    sourceRefs: [
      "PK-CAR-01 §01",
      "PK-CAR-01 §02",
      "PK-CAR-01 §03",
      "PK-CAR-01 §04",
      "PK-CAR-02 §01",
      "PK-CAR-02 §02",
      "PK-CAR-02 §03",
      "PK-CAR-02 §04"
    ],
    disclaimer: "本课程知识包是校本教学示例，不是广州市技师学院正式课程标准。课程名称/类别/阶段来自原表；章节、知识点、任务与评价由 PK-CAR-01/02 整理，需新能源汽车检测与维修教研组审核。高压部件位置、断电顺序、等待时间、验电方法、举升点、制动扭矩和路试条件以整车维修手册、高压安全规程、设备说明书和现场负责人确认结果为准。"
  }
];

export function getRepresentativePack(courseId = "course-0010") {
  return CURRICULUM_PACKS.find((pack) => pack.courseId === courseId) || null;
}

export function getCurriculumPack(courseId) {
  return CURRICULUM_PACKS.find((pack) => pack.courseId === courseId) || null;
}

export function getPackTask(pack, taskId) {
  return pack?.tasks?.find((task) => task.id === taskId) || null;
}

export function getPackChapter(pack, chapterId) {
  return pack?.chapters?.find((chapter) => chapter.id === chapterId) || null;
}