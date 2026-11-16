/**
 * 授渔 · 导出与复制
 * 支持：复制、Markdown、Word（.doc，Word/WPS 可直接打开）、打印 / 另存 PDF。
 */

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function sanitizeFilename(name) {
  return String(name || "授渔教学文档")
    .replace(/[\\/:*?"<>|\r\n]+/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 90);
}

function formatDate(iso) {
  const date = iso ? new Date(iso) : new Date();
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}年${String(date.getMonth() + 1).padStart(2, "0")}月${String(date.getDate()).padStart(2, "0")}日`;
}

export function blockToText(block) {
  if (!block) return "";
  if (block.type === "paragraph") return block.text || "";
  if (block.type === "list") {
    return (block.items || []).map((item, index) => `${block.ordered ? `${index + 1}.` : "-"} ${item}`).join("\n");
  }
  if (block.type === "table") {
    const header = (block.headers || []).join(" | ");
    const divider = (block.headers || []).map(() => "---").join(" | ");
    const rows = (block.rows || []).map((row) => row.map((cell) => String(cell ?? "").replace(/\n/g, " ")).join(" | "));
    return [header, divider, ...rows].join("\n");
  }
  if (block.type === "callout") {
    return `【${block.title || "提示"}】${block.text || ""}`;
  }
  if (block.type === "checklist") {
    return (block.items || []).map((item) => `□ ${item}`).join("\n");
  }
  if (block.type === "lines") {
    const lines = Array.from({ length: block.count || 3 }).map(() => "____________________________________________");
    return `${block.label ? `${block.label}\n` : ""}${lines.join("\n")}`;
  }
  return "";
}

export function sectionToText(section) {
  const body = (section.blocks || []).map(blockToText).filter(Boolean).join("\n\n");
  return `${section.no} ${section.title}\n${body}`;
}

export function docToText(doc) {
  const meta = (doc.meta || []).map((item) => `${item.label}：${item.value}`).join("　");
  return [
    doc.title,
    meta,
    "",
    ...(doc.sections || []).map(sectionToText)
  ].join("\n\n");
}

export function artifactToText(artifact) {
  if (!artifact) return "";
  const blocks = [];
  blocks.push(`授渔 · ${artifact.sceneLabel || "教学成果"}`);
  blocks.push(`生成时间：${formatDate(artifact.generatedAt)}`);
  blocks.push("AI 辅助生成，正式使用前须由教师人工审核。");
  blocks.push("");
  (artifact.docs || []).forEach((doc) => {
    blocks.push("＝".repeat(28));
    blocks.push(docToText(doc));
  });
  if (artifact.sources?.length) {
    blocks.push("＝".repeat(28));
    blocks.push("引用依据");
    artifact.sources.forEach((source) => {
      blocks.push(`[${source.ref}] ${source.docTitle} · ${source.sectionTitle}`);
      blocks.push(`> ${source.snippet}`);
    });
  }
  return blocks.join("\n\n");
}

export function artifactToMarkdown(artifact) {
  if (!artifact) return "";
  const lines = [
    `# 授渔 · ${artifact.docs?.[0]?.title || artifact.sceneLabel || "教学成果"}`,
    "",
    `> 生成时间：${formatDate(artifact.generatedAt)}　|　工作流：${artifact.sceneLabel || ""}　|　模板：${artifact.template || ""}`,
    "",
    "> **人工审核提示：** 本文档由本地教学工作流辅助生成，仅作为教学草稿。正式使用前，请由教师核对学习目标、设备参数、企业标准、评价权重和安全条款。",
    ""
  ];
  (artifact.docs || []).forEach((doc) => {
    lines.push(`---`, "", `## ${doc.title}`, "");
    if (doc.meta?.length) {
      lines.push(doc.meta.map((item) => `**${item.label}：** ${item.value}`).join("　"), "");
    }
    (doc.sections || []).forEach((section) => {
      lines.push(`### ${section.no} ${section.title}`, "");
      (section.blocks || []).forEach((block) => {
        if (block.type === "paragraph") {
          lines.push(block.text || "", "");
        } else if (block.type === "list") {
          (block.items || []).forEach((item, index) => {
            lines.push(`${block.ordered ? `${index + 1}.` : "-"} ${item}`);
          });
          lines.push("");
        } else if (block.type === "table") {
          lines.push(`| ${(block.headers || []).map(escapeMarkdownCell).join(" | ")} |`);
          lines.push(`| ${(block.headers || []).map(() => "---").join(" | ")} |`);
          (block.rows || []).forEach((row) => {
            lines.push(`| ${row.map(escapeMarkdownCell).join(" | ")} |`);
          });
          lines.push("");
        } else if (block.type === "callout") {
          lines.push(`> **${block.title || "提示"}**　${block.text || ""}`, "");
        } else if (block.type === "checklist") {
          (block.items || []).forEach((item) => lines.push(`- [ ] ${item}`));
          lines.push("");
        } else if (block.type === "lines") {
          if (block.label) lines.push(`**${block.label}**`, "");
          Array.from({ length: block.count || 3 }).forEach(() => lines.push("________", ""));
        }
      });
      if (section.refs?.length) {
        lines.push(`<sub>依据：${section.refs.join("、")}</sub>`, "");
      }
    });
  });
  if (artifact.sources?.length) {
    lines.push("---", "", "## 知识库依据", "");
    artifact.sources.forEach((source) => {
      lines.push(`- **[${source.ref}] ${source.docTitle} · ${source.sectionTitle}**`, `  > ${source.snippet}`);
    });
  }
  return lines.join("\n");
}

function escapeMarkdownCell(value) {
  return String(value ?? "").replace(/\|/g, "\\|").replace(/\n/g, "<br>");
}

function renderBlocksHtml(blocks) {
  return (blocks || []).map((block) => {
    if (block.type === "paragraph") {
      return `<p>${escapeHtml(block.text)}</p>`;
    }
    if (block.type === "list") {
      const tag = block.ordered ? "ol" : "ul";
      return `<${tag}>${(block.items || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</${tag}>`;
    }
    if (block.type === "table") {
      return `<table><thead><tr>${(block.headers || []).map((cell) => `<th>${escapeHtml(cell)}</th>`).join("")}</tr></thead><tbody>${(block.rows || []).map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell).replace(/\n/g, "<br>")}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
    }
    if (block.type === "callout") {
      return `<div class="callout ${block.tone === "danger" ? "danger" : ""}"><strong>${escapeHtml(block.title || "提示")}</strong><br>${escapeHtml(block.text)}</div>`;
    }
    if (block.type === "checklist") {
      return `<div class="checks">${(block.items || []).map((item) => `<div>□　${escapeHtml(item)}</div>`).join("")}</div>`;
    }
    if (block.type === "lines") {
      return `${block.label ? `<p class="line-label">${escapeHtml(block.label)}</p>` : ""}${Array.from({ length: block.count || 3 }).map(() => `<div class="line"></div>`).join("")}`;
    }
    return "";
  }).join("");
}

function renderWordDoc(doc, artifact) {
  return `
    <div class="doc">
      <div class="doc-kicker">授渔 · ${escapeHtml(artifact.sceneLabel || "教学成果")}　|　${escapeHtml(formatDate(artifact.generatedAt))}</div>
      <h1>${escapeHtml(doc.title)}</h1>
      <table class="meta"><tbody>
        ${(doc.meta || []).map((item) => `<tr><th>${escapeHtml(item.label)}</th><td>${escapeHtml(item.value)}</td></tr>`).join("")}
      </tbody></table>
      ${(doc.sections || []).map((section) => `
        <h2>${escapeHtml(section.no)}　${escapeHtml(section.title)}</h2>
        ${renderBlocksHtml(section.blocks)}
        ${section.refs?.length ? `<p class="refs">依据：${escapeHtml(section.refs.join("、"))}</p>` : ""}
      `).join("")}
    </div>
  `;
}

export function downloadWord(artifact, activeDocId) {
  if (!artifact) return;
  const docs = activeDocId ? (artifact.docs || []).filter((doc) => doc.id === activeDocId) : artifact.docs || [];
  const content = docs.length ? docs : artifact.docs || [];
  const title = content[0]?.title || "授渔教学成果";
  const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
<style>
  @page { size: A4; margin: 2cm 1.9cm; }
  body { font-family: "Microsoft YaHei", "SimSun", sans-serif; color: #111; font-size: 10.5pt; line-height: 1.7; }
  .doc { page-break-after: always; }
  .doc:last-child { page-break-after: auto; }
  .doc-kicker { font-family: Consolas, monospace; font-size: 8pt; letter-spacing: 1px; color: #777; border-bottom: 1px solid #111; padding-bottom: 5pt; margin-bottom: 12pt; }
  h1 { font-family: SimSun, serif; font-size: 22pt; line-height: 1.35; margin: 0 0 10pt; font-weight: bold; }
  h2 { font-family: SimSun, serif; font-size: 14pt; margin: 16pt 0 7pt; padding-bottom: 3pt; border-bottom: 1px solid #ccc; font-weight: bold; }
  p { margin: 0 0 6pt; white-space: pre-wrap; }
  .callout p { white-space: pre-wrap; }
  ul, ol { margin: 4pt 0 7pt 18pt; padding: 0; }
  li { margin: 2pt 0; }
  table { width: 100%; border-collapse: collapse; margin: 6pt 0 9pt; font-size: 9pt; }
  th, td { border: 1px solid #999; padding: 4pt 5pt; vertical-align: top; text-align: left; }
  th { background: #f0f0ec; font-weight: bold; }
  .meta { width: 100%; margin-bottom: 12pt; }
  .meta th { width: 18%; background: #f5f5f1; }
  .callout { border-left: 3px solid #111; background: #f5f4ef; padding: 6pt 8pt; margin: 6pt 0; }
  .callout.danger { border-left-color: #111; background: #111; color: #fff; }
  .checks { margin: 4pt 0 7pt; }
  .line { border-bottom: 1px solid #bbb; height: 20pt; }
  .line-label { color: #666; font-size: 9pt; }
  .refs { color: #777; font-size: 8pt; margin-top: 4pt; }
  .footer { margin-top: 14pt; border-top: 1px solid #999; padding-top: 5pt; font-size: 8pt; color: #666; }
</style>
</head>
<body>
  ${content.map((doc) => renderWordDoc(doc, artifact)).join("")}
  <div class="footer">
    人工审核提示：本文档由「授渔」本地工作流辅助生成，仅作为教学草稿。正式使用前请核对学习目标、设备参数、评价权重、安全条款及数据脱敏情况。<br>
    知识库版本：${escapeHtml(artifact.sources?.[0]?.version || "校本示例")}　｜　生成时间：${escapeHtml(formatDate(artifact.generatedAt))}　｜　授渔 SHOUYU
  </div>
</body>
</html>`;
  const blob = new Blob(["\ufeff", html], { type: "application/msword;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${sanitizeFilename(title)}.doc`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2500);
}

function printStyles() {
  return `
    @page { size: A4; margin: 18mm 16mm; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #111; font-family: "Microsoft YaHei", "SimSun", sans-serif; font-size: 10.5pt; line-height: 1.7; }
    .cover { border-bottom: 1px solid #111; padding-bottom: 8mm; margin-bottom: 8mm; }
    .kicker { font-family: Consolas, monospace; font-size: 7.5pt; letter-spacing: 1.2px; color: #666; }
    h1 { font-family: SimSun, serif; font-size: 22pt; margin: 3mm 0 2mm; }
    .intro { color: #555; font-size: 9pt; max-width: 150mm; }
    .doc { page-break-after: always; }
    .doc:last-of-type { page-break-after: auto; }
    .doc-kicker { font-family: Consolas, monospace; font-size: 7.5pt; color: #666; border-bottom: 1px solid #111; padding-bottom: 3mm; margin-bottom: 5mm; }
    h2 { font-family: SimSun, serif; font-size: 14pt; margin: 6mm 0 2mm; padding-bottom: 1mm; border-bottom: 1px solid #ccc; }
    h3 { font-size: 10pt; margin: 3mm 0 1mm; }
    p { margin: 0 0 2mm; white-space: pre-wrap; }
    .callout p { white-space: pre-wrap; }
    ul, ol { margin: 1mm 0 3mm 5mm; padding: 0; }
    li { margin: 0.5mm 0; }
    table { width: 100%; border-collapse: collapse; margin: 2mm 0 4mm; font-size: 8.5pt; page-break-inside: auto; }
    th, td { border: 1px solid #999; padding: 1.2mm 1.6mm; vertical-align: top; text-align: left; }
    th { background: #f0f0ec; }
    tr { page-break-inside: avoid; }
    .meta th { width: 18%; background: #f5f5f1; }
    .callout { border-left: 1mm solid #111; background: #f5f4ef; padding: 2mm 3mm; margin: 2mm 0; }
    .callout.danger { background: #111; color: #fff; }
    .checks { margin: 2mm 0 3mm; }
    .line { border-bottom: 1px solid #bbb; height: 7mm; }
    .line-label { color: #666; font-size: 8pt; }
    .refs { color: #777; font-size: 7.5pt; margin-top: 1mm; }
    .art-meta { display: flex; flex-wrap: wrap; gap: 2mm 6mm; font-size: 8pt; color: #555; margin-top: 2mm; }
    .sources { page-break-before: always; }
    .sources h3 { font-size: 9pt; border-top: 1px solid #ddd; padding-top: 2mm; }
    .sources p { color: #666; font-size: 8pt; }
    .footer { margin-top: 8mm; border-top: 1px solid #ccc; padding-top: 3mm; color: #777; font-size: 7.5pt; }
  `;
}

export function printArtifact(artifact, activeDocId) {
  if (!artifact) return;
  const docs = activeDocId ? (artifact.docs || []).filter((doc) => doc.id === activeDocId) : artifact.docs || [];
  const content = docs.length ? docs : artifact.docs || [];
  const title = content[0]?.title || "授渔教学成果";
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>${printStyles()}</style></head>
<body>
  <div class="cover">
    <div class="kicker">授渔 SHOUYU / 工学一体化教学工作台</div>
    <h1>${escapeHtml(title)}</h1>
    <div class="art-meta">
      <span>生成时间：${escapeHtml(formatDate(artifact.generatedAt))}</span>
      <span>工作流：${escapeHtml(artifact.sceneLabel || "")}</span>
      <span>模板：${escapeHtml(artifact.template || "")}</span>
      <span>引用：${artifact.sources?.length || 0} 处知识库依据</span>
    </div>
    <p class="intro">本文档由「授渔」辅助生成，仅作为教学草稿。正式使用前须由教师人工审核学习目标、设备参数、评价权重、安全条款与数据脱敏情况。</p>
  </div>
  ${content.map((doc) => `
    <div class="doc">
      <div class="doc-kicker">${escapeHtml(doc.label || "")}　|　${escapeHtml(doc.title)}</div>
      <table class="meta"><tbody>
        ${(doc.meta || []).map((item) => `<tr><th>${escapeHtml(item.label)}</th><td>${escapeHtml(item.value)}</td></tr>`).join("")}
      </tbody></table>
      ${(doc.sections || []).map((section) => `
        <h2>${escapeHtml(section.no)}　${escapeHtml(section.title)}</h2>
        ${renderBlocksHtml(section.blocks)}
        ${section.refs?.length ? `<p class="refs">依据：${escapeHtml(section.refs.join("、"))}</p>` : ""}
      `).join("")}
    </div>
  `).join("")}
  <div class="sources">
    <h3>知识库依据</h3>
    ${(artifact.sources || []).map((source) => `<p><strong>[${escapeHtml(source.ref)}] ${escapeHtml(source.docTitle)} · ${escapeHtml(source.sectionTitle)}</strong><br>${escapeHtml(source.snippet)}</p>`).join("")}
  </div>
  <div class="footer">人工审核提示：AI 生成内容仅作参考，不替代教师专业判断、学校正式文件或现场安全交底。知识库为演示版时，正式使用前请替换为学院现行文件。</div>
</body>
</html>`;

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.style.opacity = "0";
  iframe.srcdoc = html;
  iframe.onload = () => {
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } catch (error) {
      console.error(error);
    }
    setTimeout(() => iframe.remove(), 60000);
  };
  document.body.appendChild(iframe);
}

export function downloadMarkdown(artifact) {
  if (!artifact) return;
  const title = artifact.docs?.[0]?.title || "授渔教学成果";
  const blob = new Blob([artifactToMarkdown(artifact)], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${sanitizeFilename(title)}.md`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function downloadTextFile(filename, content, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = sanitizeFilename(filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function copyText(text) {
  const value = String(text ?? "");
  if (!value) throw new Error("没有可复制的内容");
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch (error) {
    // Fall through to the compatibility path.
  }
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  textarea.setSelectionRange(0, value.length);
  let success = false;
  try {
    success = document.execCommand("copy");
  } finally {
    textarea.remove();
  }
  if (!success) throw new Error("浏览器未允许复制，请手动选择文本");
  return true;
}
/* ==========================================================
   V2 · Real DOCX / XLSX export
   ========================================================== */

function loadBrowserScript(src, globalName) {
  if (globalName && window[globalName]) return Promise.resolve(window[globalName]);
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(globalName ? window[globalName] : true), { once: true });
      existing.addEventListener("error", () => reject(new Error(`无法加载 ${src}`)), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve(globalName ? window[globalName] : true);
    script.onerror = () => reject(new Error(`无法加载导出组件 ${src}`));
    document.head.appendChild(script);
  });
}

async function loadJSZipForExport() {
  return loadBrowserScript(new URL("assets/vendor/jszip/jszip.min.js", location.href).toString(), "JSZip");
}

async function loadXLSXForExport() {
  return loadBrowserScript(new URL("assets/vendor/xlsx/xlsx.full.min.js", location.href).toString(), "XLSX");
}

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function wmlRun(text, { bold = false, size = 22, color = "000000", font = "宋体" } = {}) {
  const lines = String(text ?? "").split("\n");
  return lines.map((line, index) => `
    <w:r>
      <w:rPr>
        ${bold ? "<w:b/>" : ""}
        <w:rFonts w:ascii="Times New Roman" w:eastAsia="${font}" w:hAnsi="Times New Roman"/>
        <w:sz w:val="${size}"/>
        <w:color w:val="${color}"/>
      </w:rPr>
      ${index > 0 ? "<w:br/>" : ""}<w:t xml:space="preserve">${escapeXml(line)}</w:t>
    </w:r>`).join("");
}

function wmlParagraph(text, { bold = false, size = 22, align = "", after = 120, indent = 0, shading = "", font = "宋体" } = {}) {
  return `
    <w:p>
      <w:pPr>
        <w:spacing w:after="${after}" w:line="360" w:lineRule="auto"/>
        ${align ? `<w:jc w:val="${align}"/>` : ""}
        ${indent ? `<w:ind w:left="${indent}"/>` : ""}
        ${shading ? `<w:shd w:val="clear" w:color="auto" w:fill="${shading}"/>` : ""}
      </w:pPr>
      ${wmlRun(text, { bold, size, font })}
    </w:p>`;
}

function wmlTable(block) {
  const headers = block.headers || [];
  const rows = block.rows || [];
  if (!headers.length) return "";
  const width = Math.max(900, Math.floor(9000 / headers.length));
  const cell = (value, { header = false, colIndex = 0 } = {}) => `
    <w:tc>
      <w:tcPr>
        <w:tcW w:w="${width}" w:type="dxa"/>
        ${header ? `<w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/>` : ""}
      </w:tcPr>
      ${wmlParagraph(value, { bold: header, size: 20, after: 40 })}
    </w:tc>`;
  const border = `<w:tblBorders>
    <w:top w:val="single" w:sz="4" w:color="000000"/>
    <w:left w:val="single" w:sz="4" w:color="000000"/>
    <w:bottom w:val="single" w:sz="4" w:color="000000"/>
    <w:right w:val="single" w:sz="4" w:color="000000"/>
    <w:insideH w:val="single" w:sz="4" w:color="000000"/>
    <w:insideV w:val="single" w:sz="4" w:color="000000"/>
  </w:tblBorders>`;
  return `
    <w:tbl>
      <w:tblPr><w:tblW w:w="5000" w:type="pct"/>${border}</w:tblPr>
      <w:tr>${headers.map((value) => cell(value, { header: true })).join("")}</w:tr>
      ${rows.map((row) => `<w:tr>${headers.map((_, index) => cell(row[index] ?? "")).join("")}</w:tr>`).join("")}
    </w:tbl>
    <w:p><w:pPr><w:spacing w:after="80"/></w:pPr></w:p>`;
}

function wmlBlocks(blocks = []) {
  return blocks.map((block) => {
    if (!block) return "";
    if (block.type === "paragraph") return wmlParagraph(block.text || "");
    if (block.type === "list") {
      return (block.items || []).map((item, index) => wmlParagraph(`${block.ordered ? `${index + 1}.` : "•"} ${item}`, { indent: 360, after: 60 })).join("");
    }
    if (block.type === "table") return wmlTable(block);
    if (block.type === "callout") return wmlParagraph(`【${block.title || "提示"}】${block.text || ""}`, { shading: "F2F2F2", indent: 120, after: 100 });
    if (block.type === "checklist") return (block.items || []).map((item) => wmlParagraph(`□ ${item}`, { indent: 360, after: 60 })).join("");
    if (block.type === "lines") {
      const lines = Array.from({ length: block.count || 3 }).map(() => "____________________________________________");
      return wmlParagraph(`${block.label ? `${block.label}\n` : ""}${lines.join("\n")}`, { after: 100 });
    }
    return "";
  }).join("");
}

function buildDocxDocument(artifact, options = {}) {
  const docs = artifact.docs || [];
  const title = options.title || artifact.title || docs[0]?.title || "授渔教学成果";
  const generated = artifact.generatedAt ? new Date(artifact.generatedAt).toLocaleString("zh-CN") : new Date().toLocaleString("zh-CN");
  const docsXml = docs.map((doc, index) => `
    ${index > 0 ? "<w:p><w:r><w:br w:type=\"page\"/></w:r></w:p>" : ""}
    ${wmlParagraph(doc.label || `文档 ${index + 1}`, { bold: true, size: 24, color: "666666", after: 80 })}
    ${wmlParagraph(doc.title, { bold: true, size: 32, align: "center", after: 180 })}
    ${(doc.meta || []).map((item) => wmlParagraph(`${item.label}：${item.value}`, { size: 18, color: "666666", after: 50 })).join("")}
    ${(doc.meta || []).length ? "<w:p><w:pPr><w:spacing w:after=\"120\"/></w:pPr></w:p>" : ""}
    ${(doc.sections || []).map((section) => `
      ${wmlParagraph(`${section.no} ${section.title}`, { bold: true, size: 26, after: 100, shading: section.aiEnhanced ? "F2F2F2" : "" })}
      ${wmlBlocks(section.blocks)}
      ${(section.refs || []).length ? wmlParagraph(`依据：${section.refs.join("；")}`, { size: 17, color: "666666", after: 80 }) : ""}
    `).join("")}
  `).join("");
  const sourcesXml = artifact.sources?.length ? `
    ${wmlParagraph("附录：知识来源", { bold: true, size: 24, after: 100 })}
    ${artifact.sources.map((source) => wmlParagraph(`${source.ref}  《${source.docTitle}》 / ${source.sectionTitle}`, { size: 18, after: 50 })).join("")}
  ` : "";
  const body = `
    ${wmlParagraph(title, { bold: true, size: 38, align: "center", after: 160 })}
    ${wmlParagraph(`授渔 · ${artifact.sceneLabel || "教学成果"}`, { size: 19, color: "666666", align: "center", after: 60 })}
    ${wmlParagraph(`生成时间：${generated} · AI/本地辅助草稿，正式使用前须由教师人工审核`, { size: 17, color: "666666", align: "center", after: 240 })}
    ${docsXml}
    ${sourcesXml}
    <w:sectPr>
      <w:footerReference w:type="default" r:id="rId2"/>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1440" w:right="1418" w:bottom="1440" w:left="1418" w:header="720" w:footer="720" w:gutter="0"/>
      <w:cols w:space="720"/>
      <w:docGrid w:linePitch="312"/>
    </w:sectPr>`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>${body}</w:body>
</w:document>`;
}

export async function downloadDOCX(artifact, { title } = {}) {
  if (!artifact?.docs?.length) throw new Error("没有可导出的内容");
  const JSZip = await loadJSZipForExport();
  const zip = new JSZip();
  const docTitle = title || artifact.docs[0]?.title || "授渔教学成果";
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`);
  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`);
  zip.file("word/_rels/document.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>
</Relationships>`);
  zip.file("word/document.xml", buildDocxDocument(artifact, { title }));
  zip.file("word/styles.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:pPr><w:spacing w:after="120" w:line="360" w:lineRule="auto"/></w:pPr>
    <w:rPr><w:rFonts w:ascii="Times New Roman" w:eastAsia="宋体" w:hAnsi="Times New Roman"/><w:sz w:val="22"/></w:rPr>
  </w:style>
</w:styles>`);
  zip.file("word/footer1.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:p><w:pPr><w:jc w:val="center"/></w:pPr>
    <w:r><w:rPr><w:sz w:val="18"/><w:color w:val="666666"/></w:rPr><w:t xml:space="preserve">授渔 · </w:t></w:r>
    <w:r><w:fldChar w:fldCharType="begin"/></w:r>
    <w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r>
    <w:r><w:fldChar w:fldCharType="separate"/></w:r>
    <w:r><w:t>1</w:t></w:r>
    <w:r><w:fldChar w:fldCharType="end"/></w:r>
  </w:p>
</w:ftr>`);
  zip.file("docProps/core.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>${escapeXml(docTitle)}</dc:title><dc:creator>授渔 · 工学一体化教师助手</dc:creator><cp:lastModifiedBy>授渔</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created>
</cp:coreProperties>`);
  zip.file("docProps/app.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>授渔 · 工学一体化教师助手</Application><DocSecurity>0</DocSecurity><AppVersion>2.0</AppVersion>
</Properties>`);
  const blob = await zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${sanitizeFilename(docTitle)}.docx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
  return true;
}

export async function downloadXLSX(artifact, { title } = {}) {
  if (!artifact?.docs?.length) throw new Error("没有可导出的内容");
  const XLSX = await loadXLSXForExport();
  const wb = XLSX.utils.book_new();
  const summary = [["授渔 · 教学成果"], ["标题", title || artifact.docs[0]?.title || ""], ["场景", artifact.sceneLabel || ""], ["生成时间", artifact.generatedAt || ""], []];
  artifact.docs.forEach((doc, docIndex) => {
    const rows = [["模块", "内容", "依据"], [`${doc.label} ${doc.title}`, "", ""]];
    doc.sections.forEach((section) => {
      rows.push([`${section.no} ${section.title}`, "", (section.refs || []).join("；")]);
      (section.blocks || []).forEach((block) => {
        if (block.type === "table") {
          rows.push([`${section.title} · 表格`, "", ""]);
          rows.push(["表头", (block.headers || []).join(" | "), ""]);
          (block.rows || []).forEach((row) => rows.push(["行", row.join(" | "), ""]));
        } else if (block.type === "list" || block.type === "checklist") {
          (block.items || []).forEach((item) => rows.push(["条目", item, ""]));
        } else if (block.type === "callout") {
          rows.push([block.title || "提示", block.text || "", ""]);
        } else {
          rows.push(["正文", blockToText(block), ""]);
        }
      });
    });
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 30 }, { wch: 90 }, { wch: 22 }];
    const name = sanitizeFilename(doc.label || `文档${docIndex + 1}`).slice(0, 28) || `文档${docIndex + 1}`;
    XLSX.utils.book_append_sheet(wb, ws, name);
  });
  if (artifact.sources?.length) {
    const sourceRows = [["引用编号", "文档", "章节", "片段"]];
    artifact.sources.forEach((source) => sourceRows.push([source.ref || source.key, source.docTitle, source.sectionTitle, source.snippet || ""]));
    const sourceWs = XLSX.utils.aoa_to_sheet(sourceRows);
    sourceWs["!cols"] = [{ wch: 16 }, { wch: 30 }, { wch: 30 }, { wch: 90 }];
    XLSX.utils.book_append_sheet(wb, sourceWs, "引用来源");
  }
  const summaryWs = XLSX.utils.aoa_to_sheet(summary);
  XLSX.utils.book_append_sheet(wb, summaryWs, "说明");
  const filename = `${sanitizeFilename(title || artifact.docs[0]?.title || "授渔教学成果")}.xlsx`;
  XLSX.writeFile(wb, filename);
  return true;
}

export function downloadTXT(artifact, { title } = {}) {
  if (!artifact) throw new Error("没有可导出的内容");
  downloadTextFile(`${sanitizeFilename(title || artifact.docs?.[0]?.title || "授渔教学成果")}.txt`, artifactToText(artifact), "text/plain;charset=utf-8");
}
