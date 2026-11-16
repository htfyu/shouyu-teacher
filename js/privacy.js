/**
 * 匠备 V2 · 隐私保护模块
 *
 * 纯浏览器 ES Module，无第三方依赖、无网络请求、无日志副作用。
 * 输入只在本函数的栈内参与匹配；本模块不读取、不写入任何外部存储。
 *
 * 设计目标：
 * - 为“发送 / 导出 / 保存”前的隐私检查提供可解释的候选命中；
 * - 返回结构保留原文位置，便于界面高亮与按类型脱敏；
 * - 只提供规则与校验位级别的“疑似”判断，不是法律意义上的去标识化；
 * - 任何结果都必须由教师或数据责任人人工确认。
 *
 * 准确率限制（必须阅读）：
 * 1. 本模块使用正则、上下文窗口、常见姓氏与校验位，不是 NLP 模型，无法保证 100% 查全或零误报。
 * 2. 姓名仅覆盖常见汉族单姓 / 复姓 + 2—4 字模式，并且需要“姓名 / 学生 / 家长”等上下文；
 *    无上下文的裸姓名、少数民族姓名、生僻姓氏、外文名、仅称谓（如“张女士”）可能漏检。
 * 3. 身份证只识别中国大陆 18 位号码，并校验出生日期与第 18 位校验码；不识别 15 位旧号、
 *    港澳台证件、护照等（护照等部分证件以 other_id 形式做启发式提示）。
 * 4. 手机号仅覆盖中国大陆 11 位手机号；座机、国际号码、带分隔符的号码可能漏检。
 * 5. 地址依赖“住址 / 地址 / 家住”等上下文与地址线索词；无标点长句可能截断，或把邻近内容带上。
 * 6. QQ、微信号、银行卡号、其他证件号属于上下文启发式命中，置信度低于身份证与手机号。
 * 7. 掩码只用于降低展示与传输风险，不构成匿名化保证。不要记录原文、findings.value 或含原文的调试日志；
 *    需要日志时只使用 reviewSummary() 的统计摘要。
 *
 * 请始终保留人工确认与最小化收集原则。
 */

const TYPE_META = Object.freeze({
  parent_contact: { label: "家长联系方式", severity: "high", priority: 120 },
  cn_id: { label: "居民身份证号", severity: "high", priority: 110 },
  bank_card: { label: "银行卡号", severity: "high", priority: 100 },
  address: { label: "家庭住址", severity: "high", priority: 95 },
  name: { label: "姓名", severity: "high", priority: 90 },
  other_id: { label: "其他证件号码", severity: "high", priority: 85 },
  student_id: { label: "学号", severity: "medium", priority: 80 },
  email: { label: "电子邮箱", severity: "medium", priority: 75 },
  wechat: { label: "微信号", severity: "medium", priority: 70 },
  qq: { label: "QQ号", severity: "medium", priority: 65 },
  phone: { label: "手机号", severity: "high", priority: 60 }
});

const ALL_TYPES = Object.freeze(Object.keys(TYPE_META));

/* ------------------------------------------------------------------ */
/* 通用小工具（不产生日志）                                             */
/* ------------------------------------------------------------------ */

function asText(value) {
  return value == null ? "" : String(value);
}

function isAsciiDigit(char) {
  return char >= "0" && char <= "9";
}

function hasAsciiDigit(value) {
  return /[0-9]/.test(value);
}

function isHan(char) {
  return Boolean(char && /[\u4e00-\u9fa5]/.test(char));
}

function resolveEnabledTypes(options) {
  const input = options && typeof options === "object" ? options.types : undefined;
  if (Array.isArray(input)) {
    return new Set(input.filter((type) => ALL_TYPES.includes(type)));
  }
  if (typeof input === "string" && input.trim()) {
    return new Set(input.split(/[,，\s]+/).filter((type) => ALL_TYPES.includes(type)));
  }
  return new Set(ALL_TYPES);
}

function severityFor(type) {
  return TYPE_META[type] ? TYPE_META[type].severity : "low";
}

function labelFor(type) {
  return TYPE_META[type] ? TYPE_META[type].label : "疑似个人信息";
}

function priorityFor(type) {
  return TYPE_META[type] ? TYPE_META[type].priority : 0;
}

function maskPhone(value) {
  const digits = String(value).replace(/\D/g, "");
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}****${digits.slice(-4)}`;
  }
  if (digits.length > 4) {
    return `${digits.slice(0, 2)}${"*".repeat(Math.max(2, digits.length - 4))}${digits.slice(-2)}`;
  }
  return "*".repeat(Math.max(3, digits.length || 1));
}

function maskEmail(value) {
  const raw = String(value);
  const at = raw.lastIndexOf("@");
  if (at <= 0) return "*".repeat(Math.max(3, raw.length || 1));
  const local = raw.slice(0, at);
  const domain = raw.slice(at + 1);
  if (local.length <= 1) return `*@${domain}`;
  if (local.length === 2) return `${local[0]}*@${domain}`;
  return `${local[0]}***${local.slice(-1)}@${domain}`;
}

function maskId(value) {
  const raw = String(value);
  if (raw.length >= 10) {
    return `${raw.slice(0, 6)}${"*".repeat(Math.max(4, raw.length - 10))}${raw.slice(-4)}`;
  }
  return "*".repeat(Math.max(4, raw.length || 1));
}

function maskName(value) {
  const chars = Array.from(String(value));
  if (!chars.length) return "*";
  return `${chars[0]}${"*".repeat(Math.max(1, chars.length - 1))}`;
}

function maskStudentId(value) {
  const raw = String(value);
  if (raw.length <= 3) return "*".repeat(Math.max(3, raw.length || 1));
  if (raw.length <= 5) return `${raw.slice(0, 1)}${"*".repeat(Math.max(2, raw.length - 1))}`;
  return `${raw.slice(0, 2)}${"*".repeat(Math.max(3, raw.length - 4))}${raw.slice(-2)}`;
}

function maskAddress(value) {
  const raw = String(value).trim();
  if (raw.length <= 3) return "***";
  // 保留极短的行政区线索，其余门牌、楼栋、房间号一律隐藏。
  return `${raw.slice(0, 3)}***`;
}

function maskQq(value) {
  const raw = String(value);
  if (raw.length <= 4) return `${raw.slice(0, 1)}***`;
  return `${raw.slice(0, 2)}***${raw.slice(-2)}`;
}

function maskWechat(value) {
  const raw = String(value);
  if (raw.length <= 4) return `${raw.slice(0, 1)}***`;
  return `${raw.slice(0, 2)}***${raw.slice(-2)}`;
}

function maskBankCard(value) {
  const digits = String(value).replace(/\D/g, "");
  if (digits.length <= 8) return "*".repeat(Math.max(6, digits.length || 1));
  return `${digits.slice(0, 4)}${"*".repeat(Math.max(4, digits.length - 8))}${digits.slice(-4)}`;
}

function maskOtherId(value) {
  const raw = String(value);
  if (raw.length <= 4) return "*".repeat(Math.max(4, raw.length || 1));
  return `${raw.slice(0, 2)}${"*".repeat(Math.max(3, raw.length - 4))}${raw.slice(-2)}`;
}

/**
 * 按类型生成掩码。不读取原文字段以外的上下文。
 * @param {string} type
 * @param {string} value
 * @returns {string}
 */
function maskValue(type, value) {
  switch (type) {
    case "cn_id":
      return maskId(value);
    case "phone":
      return maskPhone(value);
    case "parent_contact":
      if (/^1[3-9]\d{9}$/.test(String(value).replace(/\D/g, ""))) return maskPhone(value);
      if (String(value).includes("@")) return maskEmail(value);
      return maskPhone(value);
    case "email":
      return maskEmail(value);
    case "name":
      return maskName(value);
    case "student_id":
      return maskStudentId(value);
    case "address":
      return maskAddress(value);
    case "qq":
      return maskQq(value);
    case "wechat":
      return maskWechat(value);
    case "bank_card":
      return maskBankCard(value);
    case "other_id":
      return maskOtherId(value);
    default:
      return "*".repeat(Math.min(8, Math.max(3, String(value).length || 1)));
  }
}

function makeFinding(type, value, start, end, confidence, reason) {
  return {
    type,
    label: labelFor(type),
    start,
    end,
    value: String(value),
    masked: maskValue(type, value),
    severity: severityFor(type),
    confidence: Math.round(Math.max(0, Math.min(1, confidence)) * 100) / 100,
    reason: String(reason)
  };
}

/* ------------------------------------------------------------------ */
/* 身份证                                                              */
/* ------------------------------------------------------------------ */

const ID_WEIGHTS = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
const ID_CHECK_CODES = "10X98765432";

function isValidDateParts(dateText) {
  if (!/^\d{8}$/.test(dateText)) return false;
  const year = Number(dateText.slice(0, 4));
  const month = Number(dateText.slice(4, 6));
  const day = Number(dateText.slice(6, 8));
  if (year < 1900 || year > 2100) return false;
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function idChecksum(prefix17) {
  let sum = 0;
  for (let i = 0; i < 17; i += 1) {
    sum += Number(prefix17[i]) * ID_WEIGHTS[i];
  }
  return ID_CHECK_CODES[sum % 11];
}

function isValidChineseId(value) {
  const raw = String(value);
  if (!/^\d{17}[0-9Xx]$/.test(raw)) return false;
  if (!isValidDateParts(raw.slice(6, 14))) return false;
  if (raw.slice(14, 17) === "000") return false;
  return raw[17].toUpperCase() === idChecksum(raw.slice(0, 17));
}

function detectIds(text) {
  const findings = [];
  const pattern = /\d{17}[0-9Xx]/g;
  let match;
  while ((match = pattern.exec(text))) {
    const start = match.index;
    const end = start + match[0].length;
    const before = start > 0 ? text[start - 1] : "";
    const after = end < text.length ? text[end] : "";
    if (before && /[0-9Xx]/.test(before)) {
      pattern.lastIndex = end;
      continue;
    }
    if (after && /[0-9Xx]/.test(after)) {
      pattern.lastIndex = end;
      continue;
    }
    if (!isValidChineseId(match[0])) {
      pattern.lastIndex = end;
      continue;
    }
    findings.push(
      makeFinding(
        "cn_id",
        match[0],
        start,
        end,
        0.99,
        "18 位身份证格式通过出生日期与校验位验证"
      )
    );
    pattern.lastIndex = end;
  }
  return findings;
}

/* ------------------------------------------------------------------ */
/* 联系方式：手机号 / 邮箱 / 家长联系方式                              */
/* ------------------------------------------------------------------ */

function isParentContactContext(text, start) {
  const before = text.slice(Math.max(0, start - 30), start);
  return /(?:家长(?!会)|监护人|父亲|母亲|爸爸|妈妈)\s*(?:的)?\s*(?:联系)?\s*(?:电话|手机|联系方式|号码|邮箱|电子邮箱)?\s*[:：]?\s*$/.test(
    before
  );
}

function detectPhones(text, enabled) {
  if (!enabled.has("phone") && !enabled.has("parent_contact")) return [];
  const findings = [];
  const pattern = /1[3-9]\d{9}/g;
  let match;
  while ((match = pattern.exec(text))) {
    const start = match.index;
    const end = start + match[0].length;
    const before = start > 0 ? text[start - 1] : "";
    const after = end < text.length ? text[end] : "";
    if (isAsciiDigit(before) || isAsciiDigit(after)) {
      pattern.lastIndex = end;
      continue;
    }
    const parent = isParentContactContext(text, start);
    if (parent && enabled.has("parent_contact")) {
      findings.push(
        makeFinding(
          "parent_contact",
          match[0],
          start,
          end,
          0.95,
          "手机号前出现家长 / 监护人联系方式语境"
        )
      );
    } else if (enabled.has("phone")) {
      findings.push(
        makeFinding("phone", match[0], start, end, 0.97, "符合中国大陆 11 位手机号格式")
      );
    }
    pattern.lastIndex = end;
  }
  return findings;
}

function detectEmails(text, enabled) {
  if (!enabled.has("email") && !enabled.has("parent_contact")) return [];
  const findings = [];
  const pattern = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
  let match;
  while ((match = pattern.exec(text))) {
    const start = match.index;
    const end = start + match[0].length;
    const before = start > 0 ? text[start - 1] : "";
    const after = end < text.length ? text[end] : "";
    if (/[A-Za-z0-9._%+-]/.test(before) || /[A-Za-z0-9-]/.test(after)) {
      pattern.lastIndex = end;
      continue;
    }
    const parent = isParentContactContext(text, start);
    if (parent && enabled.has("parent_contact")) {
      findings.push(
        makeFinding(
          "parent_contact",
          match[0],
          start,
          end,
          0.94,
          "邮箱前出现家长 / 监护人联系方式语境"
        )
      );
    } else if (enabled.has("email")) {
      findings.push(
        makeFinding("email", match[0], start, end, 0.97, "符合常见电子邮箱格式")
      );
    }
    pattern.lastIndex = end;
  }
  return findings;
}

/* ------------------------------------------------------------------ */
/* 学号 / QQ / 微信 / 银行卡 / 其他证件                                 */
/* ------------------------------------------------------------------ */

function detectStudentIds(text, enabled) {
  if (!enabled.has("student_id")) return [];
  const findings = [];
  const pattern = /(学号|学生编号|学籍号|学生证号)\s*(?:是|为|[:：])?\s*([A-Za-z0-9][A-Za-z0-9-]{3,23})/g;
  let match;
  while ((match = pattern.exec(text))) {
    let value = match[2].replace(/-+$/, "");
    if (value.length < 4 || !hasAsciiDigit(value)) {
      pattern.lastIndex = match.index + match[0].length;
      continue;
    }
    const valueOffset = match[0].indexOf(match[2]) + (match[2].length - value.length);
    const start = match.index + valueOffset;
    const end = start + value.length;
    if (start < 0 || end > text.length) {
      pattern.lastIndex = match.index + match[0].length;
      continue;
    }
    findings.push(
      makeFinding("student_id", value, start, end, 0.9, "“学号 / 学籍号”标签后的编号")
    );
    pattern.lastIndex = match.index + match[0].length;
  }
  return findings;
}

function detectQq(text, enabled) {
  if (!enabled.has("qq")) return [];
  const findings = [];
  const pattern = /(QQ|qq|Qq|扣扣)\s*(?:号码|号)?\s*[:：]?\s*([1-9]\d{4,11})/g;
  let match;
  while ((match = pattern.exec(text))) {
    const start = match.index + match[0].lastIndexOf(match[2]);
    const end = start + match[2].length;
    const before = start > 0 ? text[start - 1] : "";
    const after = end < text.length ? text[end] : "";
    if (isAsciiDigit(before) || isAsciiDigit(after)) {
      pattern.lastIndex = match.index + match[0].length;
      continue;
    }
    findings.push(makeFinding("qq", match[2], start, end, 0.9, "“QQ / 扣扣”标签后的 5—12 位数字"));
    pattern.lastIndex = match.index + match[0].length;
  }
  return findings;
}

function detectWechat(text, enabled) {
  if (!enabled.has("wechat")) return [];
  const findings = [];
  const pattern = /(微信ID|微信id|微信号?|WeChat(?:\s*ID)?|VX|vx)\s*[:：]?\s*([A-Za-z][-_A-Za-z0-9]{5,19})/g;
  let match;
  while ((match = pattern.exec(text))) {
    const start = match.index + match[0].lastIndexOf(match[2]);
    const end = start + match[2].length;
    const after = end < text.length ? text[end] : "";
    if (/[-_A-Za-z0-9]/.test(after)) {
      pattern.lastIndex = match.index + match[0].length;
      continue;
    }
    findings.push(
      makeFinding("wechat", match[2], start, end, 0.9, "“微信 / WeChat / VX”标签后的账号格式")
    );
    pattern.lastIndex = match.index + match[0].length;
  }
  return findings;
}

function isLuhnValid(digits) {
  if (!/^\d+$/.test(digits)) return false;
  let sum = 0;
  let doubleNext = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let digit = Number(digits[i]);
    if (doubleNext) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    doubleNext = !doubleNext;
  }
  return sum % 10 === 0;
}

function detectBankCards(text, enabled, options) {
  if (!enabled.has("bank_card") || options.includeBankCard === false) return [];
  const findings = [];
  const pattern = /(银行卡号|银行卡|银行账号|卡号|账户)\s*(?:是|为|[:：])?\s*(\d(?:[ -]?\d){11,18})/g;
  let match;
  while ((match = pattern.exec(text))) {
    const digits = match[2].replace(/\D/g, "");
    if (digits.length < 12 || digits.length > 19) {
      pattern.lastIndex = match.index + match[0].length;
      continue;
    }
    const start = match.index + match[0].lastIndexOf(match[2]);
    const end = start + match[2].length;
    const after = end < text.length ? text[end] : "";
    if (isAsciiDigit(after)) {
      pattern.lastIndex = match.index + match[0].length;
      continue;
    }
    const luhn = isLuhnValid(digits);
    findings.push(
      makeFinding(
        "bank_card",
        match[2],
        start,
        end,
        luhn ? 0.93 : 0.82,
        luhn ? "银行卡语境 + 12—19 位数字，并通过 Luhn 校验" : "银行卡语境 + 12—19 位数字（未通过 Luhn 校验，仅作提示）"
      )
    );
    pattern.lastIndex = match.index + match[0].length;
  }
  return findings;
}

const OTHER_ID_LABELS = [
  "港澳居民来往内地通行证",
  "台湾居民来往大陆通行证",
  "港澳通行证",
  "台胞证",
  "护照号码",
  "护照号",
  "驾驶证号",
  "社保卡号",
  "医保卡号"
];

function detectOtherIds(text, enabled) {
  if (!enabled.has("other_id")) return [];
  const labelGroup = OTHER_ID_LABELS.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const pattern = new RegExp(`(${labelGroup})\\s*(?:是|为|[:：])?\\s*([A-Za-z0-9][A-Za-z0-9-]{4,19})`, "g");
  const findings = [];
  let match;
  while ((match = pattern.exec(text))) {
    let value = match[2].replace(/-+$/, "");
    if (value.length < 5) {
      pattern.lastIndex = match.index + match[0].length;
      continue;
    }
    const valueOffset = match[0].indexOf(match[2]) + (match[2].length - value.length);
    const start = match.index + valueOffset;
    const end = start + value.length;
    const after = end < text.length ? text[end] : "";
    if (/[A-Za-z0-9-]/.test(after)) {
      pattern.lastIndex = match.index + match[0].length;
      continue;
    }
    findings.push(
      makeFinding("other_id", value, start, end, 0.86, `“${match[1]}”标签后的证件号码格式`)
    );
    pattern.lastIndex = match.index + match[0].length;
  }
  return findings;
}

/* ------------------------------------------------------------------ */
/* 姓名（上下文 + 常见姓氏 + 边界与停用词）                             */
/* ------------------------------------------------------------------ */

// 常见单姓（不是完整百家姓，精确率优先；生僻姓氏请人工补充/确认）
const SINGLE_SURNAMES = new Set(
  Array.from(
    "赵钱孙李周吴郑王冯陈褚卫蒋沈韩杨朱秦尤许何吕施张孔曹严华金魏陶姜戚谢邹喻柏水窦章云苏潘葛奚范彭郎鲁韦昌马苗凤花方俞任袁柳鲍史唐费廉岑薛雷贺倪汤滕殷罗毕郝邬安常乐于时傅皮卞齐康伍余元卜顾孟平黄和穆萧尹姚邵湛汪祁毛禹狄米贝明臧计伏成戴谈宋茅庞熊纪舒屈项祝董梁杜阮蓝闵席季麻强贾路娄危江童颜郭梅盛林刁钟徐邱骆高夏蔡田樊胡凌霍虞万支柯管卢莫经房裘解应宗丁宣邓郁单杭洪包诸左石崔吉龚程邢裴陆荣翁荀羊惠甄曲封芮储靳段富巫乌焦巴弓牧山谷车侯全班秋仲伊宫宁仇栾暴甘厉戎祖武符刘景詹束龙叶幸司韶黎薄印宿白怀蒲邰鄂索咸赖卓蔺屠蒙池乔翟谭劳姬申扶冉雍桑桂牛通燕冀浦尚农温庄晏柴瞿阎慕连茹艾鱼容向古易慎戈廖庾居衡步都耿满弘匡国文寇广禄阙东欧沃利蔚越隆师巩聂晁融冷辛简饶曾沙养鞠须丰巢关相查后荆红游竺权盖益桓"
  )
);

const COMPOUND_SURNAMES = new Set([
  "欧阳", "司马", "上官", "诸葛", "东方", "皇甫", "尉迟", "公孙", "慕容", "长孙",
  "宇文", "司徒", "司空", "夏侯", "令狐", "独孤", "南宫", "西门", "第五", "端木",
  "轩辕", "钟离", "闾丘", "羊舌", "微生", "梁丘", "左丘", "东郭", "百里", "呼延"
]);

const NAME_STOP_WORDS = new Set([
  "学生", "家长", "监护人", "联系人", "教师", "老师", "同学", "先生", "女士", "主任", "校长",
  "学校", "学院", "班级", "年级", "专业", "课程", "成绩", "发展", "工作", "活动", "管理",
  "信息", "档案", "记录", "情况", "表现", "评语", "作业", "任务", "名单", "委员", "委员会",
  "家长会", "学生会", "学生处", "教务处", "安全", "教育", "学习", "成长", "方式", "方法",
  "电话", "手机", "联系方式", "地址", "住址", "家庭", "身份证", "学号", "编号", "日期",
  "时间", "结果", "原因", "问题", "意见", "建议", "计划", "总结", "报告", "材料", "内容",
  "目标", "要求", "标准", "过程", "评价", "考核", "考试", "分数", "名次", "排名", "姓名",
  "性别", "年龄", "民族", "籍贯", "政治", "面貌", "健康", "状况", "通知", "附件", "表格",
  "数据", "系统", "平台", "项目", "任务书", "工作页", "任务单", "教案", "手册", "规范",
  "方面", "方案", "方向", "方法", "方针", "方便", "明白", "明确", "明天", "明年",
  "成就", "成果", "成员", "成本", "成人", "成才", "成功", "成立", "成为", "成熟",
  "高兴", "高峰", "高校", "高中", "高级", "高考", "高效", "单元", "单独",
  "未填写", "未知", "不详", "保密", "匿名", "待定", "无"
]);

const NAME_BAD_SUFFIXES = [
  "同学", "老师", "先生", "女士", "主任", "校长", "家长", "学生", "电话", "手机", "住址", "地址"
];

const NAME_BOUNDARY_WORDS = [
  "同学", "老师", "先生", "女士", "今天", "明天", "昨天", "家长", "父亲", "母亲",
  "电话", "手机", "联系方式", "住址", "地址", "家庭", "成绩", "表现", "情况", "问题",
  "作业", "任务", "课程", "学号", "身份证", "已经", "正在", "需要", "参加", "完成",
  "负责", "联系", "离校", "返校", "请假", "在教室", "在课堂", "就读", "来自"
];

const NAME_BOUNDARY_CHAR = /[\s，。；、,.!?！？：:（）()【】\[\]《》“”"'‘’]/;

function isNameBoundary(text, end) {
  if (end >= text.length) return true;
  const char = text[end];
  if (NAME_BOUNDARY_CHAR.test(char)) return true;
  const tail = text.slice(end, end + 6);
  if (NAME_BOUNDARY_WORDS.some((word) => tail.startsWith(word))) return true;
  // 单字动词 / 助词边界：在姓名后面常直接跟这些字。
  return "在的是和与及等也都不没未已将要需请说做去来上下班".includes(char);
}

function isPlausibleName(value) {
  if (value.length < 2 || value.length > 4) return false;
  if (!/^[\u4e00-\u9fa5]+$/.test(value)) return false;
  if (NAME_STOP_WORDS.has(value)) return false;
  for (const word of NAME_STOP_WORDS) {
    if (word.length >= 2 && value.startsWith(word) && value !== word) return false;
  }
  if (NAME_BAD_SUFFIXES.some((suffix) => value.endsWith(suffix))) return false;
  return true;
}

function readNameAt(text, position) {
  if (position >= text.length) return null;
  const first = text[position];
  if (!isHan(first)) return null;

  const two = text.slice(position, position + 2);
  let lengths = [];
  if (COMPOUND_SURNAMES.has(two)) {
    lengths = [4, 3];
  } else if (SINGLE_SURNAMES.has(first)) {
    lengths = [3, 2];
  } else {
    return null;
  }

  for (const length of lengths) {
    if (position + length > text.length) continue;
    const value = text.slice(position, position + length);
    if (!/^[\u4e00-\u9fa5]+$/.test(value)) continue;
    if (!isNameBoundary(text, position + length)) continue;
    if (!isPlausibleName(value)) continue;
    return { value, start: position, end: position + length };
  }
  return null;
}

function detectNames(text, enabled) {
  if (!enabled.has("name")) return [];
  const findings = [];
  // 长标签优先；姓名标签要求后续仍通过常见姓氏与边界校验，避免“学生发展”“家长会”等误报。
  const pattern = /(学生姓名|家长姓名|监护人姓名|联系人姓名|姓名|学生|家长|监护人|联系人|父亲|母亲)\s*(?:姓名\s*)?(?:[：:]|叫|是|为)?\s*/g;
  let match;
  while ((match = pattern.exec(text))) {
    const nameStart = match.index + match[0].length;
    const parsed = readNameAt(text, nameStart);
    if (!parsed) {
      pattern.lastIndex = match.index + Math.max(1, match[0].length);
      continue;
    }
    const explicit = /姓名|[:：]/.test(match[0]) || /学生姓名|家长姓名|监护人姓名|联系人姓名/.test(match[1]);
    findings.push(
      makeFinding(
        "name",
        parsed.value,
        parsed.start,
        parsed.end,
        explicit ? 0.93 : 0.82,
        explicit
          ? "姓名标签 + 常见姓氏 + 边界词验证"
          : "学生 / 家长语境 + 常见姓氏 + 边界词验证"
      )
    );
    pattern.lastIndex = parsed.end;
  }
  return findings;
}

/* ------------------------------------------------------------------ */
/* 地址                                                                */
/* ------------------------------------------------------------------ */

const ADDRESS_MARKERS = /[省市区县镇乡村路街巷道号栋幢单元室楼园苑里组]/;
const ADDRESS_CONTACT_STOP = /(电话|手机|联系方式|邮箱|邮编|QQ|微信)/i;
const ADDRESS_GENERIC_PREFIX_BLOCK = /(邮箱|邮件|网址|网页|服务器|网络|IP|ip|公众号|二维码|链接|收货)/;

function detectAddresses(text, enabled) {
  if (!enabled.has("address")) return [];
  const findings = [];
  const pattern = /(家庭住址|家庭地址|现住址|户籍地址|居住地址|通讯地址|联系地址|住址|家住|居住地|地址)/g;
  let match;
  while ((match = pattern.exec(text))) {
    const label = match[1];
    if (label === "地址") {
      const before = text.slice(Math.max(0, match.index - 12), match.index);
      if (ADDRESS_GENERIC_PREFIX_BLOCK.test(before)) {
        pattern.lastIndex = match.index + match[0].length;
        continue;
      }
    }

    let valueStart = match.index + match[0].length;
    const prefix = text.slice(valueStart, valueStart + 8).match(/^\s*(?:是|为|在|[:：])?\s*/);
    if (prefix) valueStart += prefix[0].length;

    const tail = text.slice(valueStart, valueStart + 80);
    const stopAtPunctuation = tail.search(/[\n\r，。；;！？!?]/);
    let raw = stopAtPunctuation >= 0 ? tail.slice(0, stopAtPunctuation) : tail;
    const contactAt = raw.search(ADDRESS_CONTACT_STOP);
    if (contactAt >= 0) raw = raw.slice(0, contactAt);
    raw = raw.replace(/^[\s,，:：-]+|[\s,，:：-]+$/g, "");

    if (raw.length < 4 || raw.length > 80) {
      pattern.lastIndex = match.index + match[0].length;
      continue;
    }
    if (/@|https?:\/\/|www\./i.test(raw)) {
      pattern.lastIndex = match.index + match[0].length;
      continue;
    }
    if (!ADDRESS_MARKERS.test(raw)) {
      pattern.lastIndex = match.index + match[0].length;
      continue;
    }
    const hanCount = (raw.match(/[\u4e00-\u9fa5]/g) || []).length;
    if (hanCount < 2) {
      pattern.lastIndex = match.index + match[0].length;
      continue;
    }

    const start = valueStart;
    const end = valueStart + raw.length;
    findings.push(
      makeFinding(
        "address",
        raw,
        start,
        end,
        0.86,
        "“住址 / 地址 / 家住”语境后的文本包含行政区、道路或门牌线索"
      )
    );
    pattern.lastIndex = match.index + match[0].length;
  }
  return findings;
}

/* ------------------------------------------------------------------ */
/* 去重、排序与主入口                                                  */
/* ------------------------------------------------------------------ */

function overlaps(a, b) {
  return a.start < b.end && b.start < a.end;
}

function dedupeFindings(findings) {
  const seen = new Set();
  const unique = [];
  for (const finding of findings) {
    const key = `${finding.type}|${finding.start}|${finding.end}|${finding.value}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(finding);
  }

  // 先保留“更具体”的类型（家长联系方式、身份证、地址等），再按长度与位置稳定排序。
  const ranked = unique.sort(
    (a, b) =>
      priorityFor(b.type) - priorityFor(a.type) ||
      (b.end - b.start) - (a.end - a.start) ||
      a.start - b.start
  );
  const selected = [];
  for (const candidate of ranked) {
    if (selected.some((existing) => overlaps(existing, candidate))) continue;
    selected.push(candidate);
  }
  return selected.sort((a, b) => a.start - b.start || priorityFor(b.type) - priorityFor(a.type));
}

/**
 * 检测文本中的疑似敏感信息。
 *
 * @param {string} text 待检查文本
 * @param {{
 *   types?: string[] | string,
 *   minConfidence?: number,
 *   includeBankCard?: boolean
 * }} [options]
 * @returns {Array<{
 *   type: string, label: string, start: number, end: number,
 *   value: string, masked: string, severity: string,
 *   confidence: number, reason: string
 * }>}
 *
 * 注意：findings.value 仍包含原文，只应在内存中用于定位 / 脱敏；
 * 不要把 findings 或原文写入日志。记录日志请使用 reviewSummary(findings)。
 */
export function detectSensitive(text, options = {}) {
  const source = asText(text);
  if (!source) return [];
  const opts = options && typeof options === "object" ? options : {};
  const enabled = resolveEnabledTypes(opts);
  if (!enabled.size) return [];

  const raw = [
    ...detectIds(source),
    ...detectPhones(source, enabled),
    ...detectEmails(source, enabled),
    ...detectStudentIds(source, enabled),
    ...detectQq(source, enabled),
    ...detectWechat(source, enabled),
    ...detectBankCards(source, enabled, opts),
    ...detectOtherIds(source, enabled),
    ...detectNames(source, enabled),
    ...detectAddresses(source, enabled)
  ].filter((finding) => enabled.has(finding.type));

  const rawMin = Number.isFinite(opts.minConfidence) ? Math.max(0, Math.min(1, opts.minConfidence)) : 0;
  const filtered = raw.filter((finding) => finding.confidence >= rawMin);
  return dedupeFindings(filtered);
}

/**
 * 根据检测结果对原文做掩码。findings 应来自 detectSensitive；本函数不修改原文和 findings。
 * 若传入的区间重叠，保留靠后（右侧）的命中，跳过与其重叠的左侧命中。
 *
 * @param {string} text
 * @param {Array<{type:string,start:number,end:number,value?:string}>} findings
 * @returns {string}
 */
export function maskSensitive(text, findings) {
  const source = asText(text);
  if (!source) return "";
  if (!Array.isArray(findings) || !findings.length) return source;

  const valid = findings
    .filter(
      (finding) =>
        finding &&
        Number.isInteger(finding.start) &&
        Number.isInteger(finding.end) &&
        finding.start >= 0 &&
        finding.end <= source.length &&
        finding.end > finding.start
    )
    .sort((a, b) => b.start - a.start || b.end - a.end);

  let result = source;
  let rightBoundary = source.length;
  for (const finding of valid) {
    if (finding.end > rightBoundary) continue;
    const value = finding.value != null ? String(finding.value) : source.slice(finding.start, finding.end);
    const masked = maskValue(finding.type, value);
    result = result.slice(0, finding.start) + masked + result.slice(finding.end);
    rightBoundary = finding.start;
  }
  return result;
}

/**
 * 检测并脱敏的一步式便捷函数。
 * @param {string} text
 * @param {object} [options] 同 detectSensitive
 * @returns {string}
 */
export function maskAll(text, options = {}) {
  const source = asText(text);
  const findings = detectSensitive(source, options);
  return maskSensitive(source, findings);
}

/**
 * 仅用于日志 / 监控的统计摘要，不包含原文、值、位置或掩码。
 * @param {Array<{type:string,severity:string}>} findings
 * @returns {Array<{type:string,count:number,severity:string}>}
 */
export function reviewSummary(findings) {
  if (!Array.isArray(findings) || !findings.length) return [];
  const groups = new Map();
  for (const finding of findings) {
    if (!finding || !finding.type) continue;
    const type = String(finding.type);
    const severity = String(finding.severity || severityFor(type));
    const key = `${type}|${severity}`;
    const current = groups.get(key);
    if (current) current.count += 1;
    else groups.set(key, { type, count: 1, severity });
  }
  const severityRank = { high: 3, medium: 2, low: 1 };
  return Array.from(groups.values())
    .sort(
      (a, b) =>
        (severityRank[b.severity] || 0) - (severityRank[a.severity] || 0) ||
        a.type.localeCompare(b.type)
    )
    .map(({ type, count, severity }) => ({ type, count, severity }));
}

/**
 * 返回最高风险级别：high / medium / low / none。
 * @param {Array<{severity:string}>} findings
 * @returns {"high"|"medium"|"low"|"none"}
 */
export function riskLevel(findings) {
  if (!Array.isArray(findings) || !findings.length) return "none";
  const rank = { high: 3, medium: 2, low: 1 };
  let max = 0;
  for (const finding of findings) {
    max = Math.max(max, rank[finding && finding.severity] || 0);
  }
  if (max >= 3) return "high";
  if (max === 2) return "medium";
  if (max === 1) return "low";
  return "none";
}

/**
 * 是否存在高风险命中。
 * @param {Array<{severity:string}>} findings
 * @returns {boolean}
 */
export function hasHighRisk(findings) {
  return Array.isArray(findings) && findings.some((finding) => finding && finding.severity === "high");
}

/**
 * 是否需要人工确认后才能继续发送 / 导出 / 保存。
 * 隐私优先：只要发现任何疑似个人信息，都应人工确认；低置信命中尤其需要复核。
 * @param {Array<{severity:string,confidence:number}>} findings
 * @returns {boolean}
 */
export function requiresConfirmation(findings) {
  if (!Array.isArray(findings) || !findings.length) return false;
  return findings.some(
    (finding) =>
      finding &&
      (finding.severity === "high" ||
        finding.severity === "medium" ||
        typeof finding.confidence !== "number" ||
        finding.confidence < 0.85)
  );
}