/**
 * 将 AI 生成的 Markdown 转为现有成果数据结构。
 * 设计目标：解析失败时明确抛错，由 app.js 回退到本地引擎，绝不把半成品当作正式成果。
 */



const CITATION_RE = /\[([A-Za-z][A-Za-z0-9_-]*?)\s*§\s*(\d{1,3})\]/g;

function stripCodeFence(markdown) {
  let text = String(markdown || "").trim();
  if (text.startsWith("```")) {
    text = text.replace(/^```[a-zA-Z0-9_-]*\s*\n/, "").replace(/\n```\s*$/, "");
  }
  return text.trim();
}

function cleanInline(value) {
  return String(value || "")
    .replace(/\[([^\]]+)\]\((?:https?:\/\/|\/)[^)]+\)/g, "$1")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/[ \t]+$/gm, "")
    .trim();
}

function extractCitations(text) {
  const refs = [];
  const cleaned = String(text || "").replace(CITATION_RE, (match, docId, rawNo) => {
    const no = String(Number(rawNo)).padStart(2, "0");
    refs.push(`${docId} §${no}`);
    return "";
  });
  return { text: cleaned.replace(/[ \t]{2,}/g, " ").trim(), refs };
}

function isTableSeparator(line) {
  return /^\s*\|?[\s:|-]+\|?\s*$/.test(line) && line.includes("-");
}

function splitTableRow(line) {
  let value = line.trim();
  if (value.startsWith("|")) value = value.slice(1);
  if (value.endsWith("|")) value = value.slice(0, -1);
  return value.split("|").map((cell) => cleanInline(cell.replace(/\n/g, " ")));
}

function parseBlocks(lines) {
  const blocks = [];
  let i = 0;
  const paragraph = [];
  const refs = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    const raw = paragraph.join("\n").trim();
    paragraph.length = 0;
    if (!raw) return;
    const citation = extractCitations(raw);
    refs.push(...citation.refs);
    const text = cleanInline(citation.text);
    if (text) blocks.push({ type: "paragraph", text });
  };

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      i += 1;
      continue;
    }

    if (trimmed.startsWith("|") && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      flushParagraph();
      const headers = splitTableRow(trimmed);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        const row = splitTableRow(lines[i]);
        const joined = row.join("");
        const citation = extractCitations(joined);
        refs.push(...citation.refs);
        rows.push(row.map((cell) => cleanInline(cell.replace(CITATION_RE, ""))));
        i += 1;
      }
      if (headers.length) blocks.push({ type: "table", headers, rows });
      continue;
    }

    if (/^[-*•]\s+/.test(trimmed) || /^\d+[.、)]\s+/.test(trimmed)) {
      flushParagraph();
      const ordered = /^\d+[.、)]\s+/.test(trimmed);
      const items = [];
      while (i < lines.length) {
        const current = lines[i].trim();
        const match = ordered ? current.match(/^\d+[.、)]\s+(.*)$/) : current.match(/^[-*•]\s+(.*)$/);
        if (!match) break;
        const citation = extractCitations(match[1]);
        refs.push(...citation.refs);
        const item = cleanInline(citation.text);
        if (item) items.push(item);
        i += 1;
      }
      if (items.length) blocks.push({ type: "list", items, ordered });
      continue;
    }

    if (/^>\s?/.test(trimmed)) {
      flushParagraph();
      const quote = [];
      while (i < lines.length && /^>\s?/.test(lines[i].trim())) {
        quote.push(lines[i].trim().replace(/^>\s?/, ""));
        i += 1;
      }
      const citation = extractCitations(quote.join("\n"));
      refs.push(...citation.refs);
      const text = cleanInline(citation.text);
      if (text) {
        const titleMatch = text.match(/^\*\*(.+?)\*\*/);
        blocks.push({
          type: "callout",
          tone: "note",
          title: titleMatch ? titleMatch[1] : "AI 补充说明",
          text: titleMatch ? text.replace(titleMatch[0], "").trim() : text
        });
      }
      continue;
    }

    if (/^###+\s+/.test(trimmed)) {
      flushParagraph();
      const citation = extractCitations(trimmed.replace(/^###+\s+/, ""));
      refs.push(...citation.refs);
      const text = cleanInline(citation.text);
      if (text) blocks.push({ type: "paragraph", text: `【${text}】` });
      i += 1;
      continue;
    }

    paragraph.push(line);
    i += 1;
  }
  flushParagraph();
  return { blocks, refs };
}

function splitDocumentBlocks(markdown, expectedDocs) {
  const markerRe = /^<!--\s*DOC\s*:\s*(.+?)\s*-->\s*$/gim;
  const markers = [];
  let match;
  while ((match = markerRe.exec(markdown))) {
    markers.push({ label: match[1].trim(), index: match.index, length: match[0].length });
  }
  if (markers.length) {
    const docs = [];
    for (let i = 0; i < markers.length; i += 1) {
      const start = markers[i].index + markers[i].length;
      const end = i + 1 < markers.length ? markers[i + 1].index : markdown.length;
      docs.push({ label: markers[i].label, body: markdown.slice(start, end).trim() });
    }
    return docs;
  }

  // 如果模型没有输出标记但给出了多个一级标题，把每个一级标题视为一个文档。
  const lines = markdown.split("\n");
  const h1Indices = [];
  lines.forEach((line, index) => {
    if (/^#\s+\S/.test(line)) h1Indices.push(index);
  });
  if (expectedDocs > 1 && h1Indices.length > 1) {
    const docs = [];
    for (let i = 0; i < h1Indices.length; i += 1) {
      const start = h1Indices[i];
      const end = i + 1 < h1Indices.length ? h1Indices[i + 1] : lines.length;
      docs.push({ label: "", body: lines.slice(start, end).join("\n").trim() });
    }
    return docs;
  }
  return [{ label: "", body: markdown.trim() }];
}

function parseOneDoc(body, fallbackDoc, number) {
  const lines = body.split("\n");
  let title = "";
  const contentLines = [];
  let foundTitle = false;
  for (const line of lines) {
    if (!foundTitle && /^#\s+\S/.test(line)) {
      title = cleanInline(line.replace(/^#\s+/, ""));
      foundTitle = true;
      continue;
    }
    contentLines.push(line);
  }

  const sections = [];
  let current = null;
  const intro = [];
  for (const line of contentLines) {
    if (/^##\s+\S/.test(line)) {
      if (current) sections.push(current);
      const heading = cleanInline(line.replace(/^##\s+/, ""));
      const noMatch = heading.match(/^(\d{1,3})[.、\s]\s*(.*)$/);
      current = {
        title: noMatch ? noMatch[2].trim() : heading,
        lines: []
      };
      continue;
    }
    if (current) current.lines.push(line);
    else intro.push(line);
  }
  if (current) sections.push(current);

  // 没有 ## 时，把正文按段落拆为一节，避免整篇丢失。
  if (!sections.length) {
    sections.push({ title: fallbackDoc?.sections?.[0]?.title || "AI 生成内容", lines: contentLines });
  }

  const introText = intro.join("\n").trim();
  const parsed = sections.map((section, index) => {
    const { blocks, refs } = parseBlocks(section.lines);
    return {
      id: `${fallbackDoc?.id || `ai-doc-${number}`}-ai-${index + 1}`,
      no: String(index + 1).padStart(2, "0"),
      title: section.title || `模块 ${index + 1}`,
      blocks,
      refs: Array.from(new Set(refs))
    };
  }).filter((section) => section.blocks.length > 0);

  return {
    title: title || fallbackDoc?.title || `AI 生成文档 ${number}`,
    introText,
    sections: parsed,
    label: fallbackDoc?.label || "AI 成果"
  };
}

function sectionKey(title) {
  return String(title || "")
    .replace(/^\s*\d{1,3}[.、\s]*/, "")
    .replace(/[（(].*?[)）]/g, "")
    .replace(/[\s·、，,。；;：:！!？?/—\-]/g, "")
    .replace(/^(教学|学习|课堂|实训|本课|本节)/, "")
    .replace(/(设计与|与|及|和)$/g, "");
}

const SECTION_GROUPS = [
  { key: "objectives", test: /目标/ },
  { key: "flow", test: /流程|实施过程|教学过程|教学组织|工作过程/ },
  { key: "evaluation", test: /评价|评分|考核/ },
  { key: "safety", test: /安全|应急|防护/ },
  { key: "keypoints", test: /重难点|重点|难点|突破/ },
  { key: "learners", test: /学情|学生基础|支持策略/ },
  { key: "reflection", test: /反思|改进/ },
  { key: "task", test: /任务情境|基本信息|任务信息|情境/ },
  { key: "preparation", test: /教学准备|课前准备|资源|条件/ },
  { key: "plan", test: /计划|决策/ },
  { key: "implement", test: /实施|步骤|记录/ },
  { key: "check", test: /检查|自检|互检/ },
  { key: "evidence", test: /证据|事实|观察/ },
  { key: "feedback", test: /建议|评课意见|反馈/ }
];

function groupForTitle(title) {
  const key = sectionKey(title);
  const found = SECTION_GROUPS.find((group) => group.test.test(key));
  return found?.key || "";
}

function titlesMatch(aiTitle, localTitle) {
  const a = sectionKey(aiTitle);
  const b = sectionKey(localTitle);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.length >= 4 && b.length >= 4 && (a.includes(b) || b.includes(a))) return true;
  const ag = groupForTitle(aiTitle);
  const bg = groupForTitle(localTitle);
  return Boolean(ag && bg && ag === bg);
}

function resolveAllowedSources(refs, providedSources) {
  const byKey = new Map();
  const byRef = new Map();
  (providedSources || []).forEach((source) => {
    if (!source) return;
    byKey.set(source.key, source);
    byRef.set(source.ref, source);
  });
  const resolved = [];
  const unknown = [];
  refs.forEach((ref) => {
    const parts = String(ref).trim().match(/^(.+?)\s*§\s*(\d+)$/);
    const normalized = parts ? `${parts[1]} §${String(Number(parts[2])).padStart(2, "0")}` : String(ref).trim();
    const docId = parts ? parts[1] : "";
    const existing = byRef.get(normalized) || byKey.get(normalized) || providedSources.find((s) => s?.docId === docId && s?.ref === normalized);
    if (existing) {
      if (!resolved.some((item) => item.key === existing.key)) resolved.push(existing);
      return;
    }
    if (!unknown.includes(normalized)) unknown.push(normalized);
  });
  return { sources: resolved, unknown };
}

/**
 * @param {object} options
 * @param {string} options.markdown
 * @param {object} options.localResult generate() 的本地结果
 * @param {object} options.params
 * @param {string} options.scene
 * @param {object} options.provider {name, model, duration, endpoint}
 * @returns {{result: object, artifact: object, warnings: string[]}}
 */
export function parseAIMarkdown({ markdown, localResult, params, scene, provider = {} }) {
  const raw = stripCodeFence(markdown);
  if (!raw || raw.length < 120) throw new Error("AI 返回内容过短，无法形成可用教学成果");
  const expectedDocs = localResult?.artifact?.docs?.length || 1;
  const blocks = splitDocumentBlocks(raw, expectedDocs);
  if (!blocks.length) throw new Error("AI 返回内容缺少文档结构");

  const aiDocs = blocks.map((block, index) => {
    const fallback = localResult?.artifact?.docs?.[index] || localResult?.artifact?.docs?.[0];
    const parsed = parseOneDoc(block.body, fallback, index + 1);
    if (block.label) parsed.label = block.label;
    return { ...parsed, aiLabel: block.label || "" };
  }).filter((doc) => doc.sections.length);

  if (!aiDocs.length) throw new Error("AI 返回内容没有可解析的小节");

  const localDocs = localResult?.artifact?.docs || [];
  // 在本地完整文档上合并 AI 模块。AI 输出被截断时，未覆盖的模块仍保留本地内容，
  // 不会把一份只有 2—3 节的半成品冒充完整教案。
  const docs = localDocs.map((doc) => ({
    ...doc,
    sections: (doc.sections || []).map((section) => ({
      ...section,
      blocks: (section.blocks || []).map((block) => ({ ...block })),
      refs: [...(section.refs || [])]
    }))
  }));

  const changedSections = [];
  const unmatchedTitles = [];
  const allRefs = [];

  const findDocForAI = (aiDoc) => {
    const label = sectionKey(aiDoc.aiLabel || aiDoc.label || "");
    if (label) {
      const byLabel = docs.find((doc) => {
        const docLabel = sectionKey(doc.label || "");
        return docLabel && (docLabel.includes(label) || label.includes(docLabel));
      });
      if (byLabel) return byLabel;
    }
    return null;
  };

  aiDocs.forEach((aiDoc, aiDocIndex) => {
    const preferred = findDocForAI(aiDoc);
    const candidates = preferred ? [preferred] : docs;
    aiDoc.sections.forEach((aiSection) => {
      aiSection.refs?.forEach((ref) => allRefs.push(ref));
      let targetDoc = null;
      let targetSection = null;
      for (const doc of candidates) {
        const match = (doc.sections || []).find((section) => titlesMatch(aiSection.title, section.title));
        if (match) {
          targetDoc = doc;
          targetSection = match;
          break;
        }
      }
      if (!targetSection) {
        // 若模型没有按标题分节，退化到同一文档的同序号模块。
        const fallbackDoc = preferred || docs[aiDocIndex] || docs[0];
        targetDoc = fallbackDoc;
        targetSection = fallbackDoc?.sections?.[Math.min(aiDocIndex, (fallbackDoc.sections?.length || 1) - 1)];
      }
      if (!targetDoc || !targetSection) return;
      if (!aiSection.blocks?.length) return;
      const previousTitle = targetSection.title;
      targetSection.blocks = aiSection.blocks.map((block) => ({ ...block }));
      targetSection.refs = Array.from(new Set([...(targetSection.refs || []), ...(aiSection.refs || [])]));
      targetSection.aiEnhanced = true;
      changedSections.push({
        docId: targetDoc.id,
        docLabel: targetDoc.label,
        sectionId: targetSection.id,
        title: previousTitle
      });
      if (!titlesMatch(aiSection.title, previousTitle)) unmatchedTitles.push(`${aiSection.title} → ${previousTitle}`);
    });
  });

  if (!changedSections.length) {
    throw new Error("AI 返回的模块无法与本地成果结构匹配，已回退本地引擎");
  }

  const { sources: aiSources, unknown } = resolveAllowedSources(Array.from(new Set(allRefs)), localResult?.sources || []);
  // 合并后保留本地原有依据，并加入 AI 引用到的有效知识库章节。
  const sources = [...(localResult?.sources || [])];
  aiSources.forEach((source) => {
    if (!sources.some((item) => item.key === source.key)) sources.push(source);
  });

  const warnings = [];
  if (!aiSources.length) {
    warnings.push("AI 改写模块没有标注新的知识库引用；原有本地依据仍保留，请逐项核对这些模块的事实表述。");
  }
  if (unknown.length) {
    warnings.push(`AI 返回了未在上下文中的引用（${unknown.slice(0, 3).join("、")}），已忽略，不作为依据。`);
  }
  if (provider.finishReason === "length") {
    warnings.push("AI 输出达到模型长度上限，可能只改写了一部分模块；未覆盖的模块保留本地内容，请逐节核对。");
  }

  const localArtifact = localResult.artifact;
  const changedLabels = changedSections.map((section) => `${section.docLabel ? `${section.docLabel} · ` : ""}${section.title}`);
  const compliance = {
    ...(localArtifact.compliance || {}),
    status: "review",
    checks: [
      ...((localArtifact.compliance && localArtifact.compliance.checks) || []),
      {
        status: "warn",
        title: "AI 改写内容",
        detail: `本成果中 ${changedSections.length} 个模块由 ${provider.provider || "AI 服务"} / ${provider.model || "模型"} 改写，其余模块沿用本地规则与知识库结构。AI 输出必须由教师逐项审核。`
      },
      ...warnings.map((warning) => ({ status: "warn", title: "AI 引用检查", detail: warning }))
    ]
  };

  const artifact = {
    ...localArtifact,
    docs,
    sources,
    compliance,
    template: `AI 增强 · ${localArtifact.template || "教学工作流"}`,
    generatedAt: new Date().toISOString(),
    ai: {
      used: true,
      mode: "merged",
      provider: provider.provider || "",
      model: provider.model || "",
      endpoint: provider.endpoint || "",
      duration: provider.duration || 0,
      generatedAt: new Date().toISOString(),
      rawMarkdown: raw,
      finishReason: provider.finishReason || "",
      truncated: provider.finishReason === "length",
      citations: aiSources.map((source) => source.ref),
      unknownCitations: unknown,
      changedSections,
      changedSectionCount: changedSections.length,
      sectionMappingNotes: unmatchedTitles
    }
  };

  const result = {
    ...localResult,
    intro: `AI 已基于知识库与您的任务条件改写 ${changedSections.length} 个关键模块：${changedLabels.slice(0, 5).join("、")}${changedLabels.length > 5 ? " 等" : ""}。其余模块保留本地结构与依据，共引用 ${sources.length} 处知识库来源。AI 改写不代表事实已经审核，请重点核对设备、企业标准、评价权重与安全条款。`,
    artifact,
    sources,
    compliance,
    ai: artifact.ai,
    workflow: [
      ...(localResult.workflow || []).map((step) => ({ ...step, status: "done" })),
      { index: (localResult.workflow?.length || 0) + 1, label: "AI 深度改写", detail: `${provider.model || "AI"} · ${Math.round((provider.duration || 0) / 1000)} 秒 · ${changedSections.length} 个模块`, status: "done" }
    ],
    suggestions: localResult.suggestions || []
  };

  return { result, artifact, warnings };
}

export function extractCitationRefs(text) {
  const refs = [];
  String(text || "").replace(CITATION_RE, (match, docId, no) => {
    refs.push(`${docId} §${String(Number(no)).padStart(2, "0")}`);
    return match;
  });
  return refs;
}