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

export const CURRICULUM_PACKS = [
  {
    id: "CUR-PLC-001",
    courseId: "course-0010",
    majorId: "major-008",
    title: "PLC技术及应用",
    subtitle: "物料分拣站 PLC 控制系统安装与调试",
    version: "2026.11-demo-v1",
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