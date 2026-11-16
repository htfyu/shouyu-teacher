# 匠备 V2 · 文件解析 vendor 依赖

本目录只存放**浏览器可直接加载的 UMD/min 构建**，用于 `js/files.js` 的按需懒加载。页面首屏不会加载这些文件。

| 依赖 | 版本 | 本地文件 | 来源 | 许可 |
|---|---|---|---|---|
| mammoth | 1.13.0 | `mammoth/mammoth.browser.min.js` | npm `mammoth@1.13.0`（官方 browser min build） | BSD-2-Clause，见 `mammoth/LICENSE` |
| PDF.js (pdfjs-dist) | 3.11.174 | `pdfjs/pdf.min.js`、`pdfjs/pdf.worker.min.js`、`pdfjs/cmaps/*.bcmap` | npm `pdfjs-dist@3.11.174` 的 `build/` 与 `cmaps/` | Apache-2.0，见 `pdfjs/LICENSE` |
| SheetJS CE | 0.18.5 | `xlsx/xlsx.full.min.js` | npm `xlsx@0.18.5` 的 `dist/` | Apache-2.0，见 `xlsx/LICENSE` |
| JSZip | 3.10.2 | `jszip/jszip.min.js` | npm `jszip@3.10.2` 的 `dist/` | MIT / GPLv3 双许可，见 `jszip/LICENSE.markdown` |

## SHA-256（本次 vendored 构建）

```
mammoth.browser.min.js  92914A3708CFDF1E62CB553D1856A7FEDAB21DA83D8EE82845DE2F897B368CAB
pdf.min.js              5B5799E6F8C680663207AC5B42EE14EED2A406FA7AF48F50C154F0C0B1566946
pdf.worker.min.js       FEABDF309770ED24BBA31A5467836CDC8CF639C705AF27D52B585B041BB8527B
xlsx.full.min.js        C9506197CAF809A075B6DEE1DA0D36FB19DA7158FFE8A88E7B0C96C5D8623C99
jszip.min.js            7F839B2D4688B845C105EBF5D2F9803075F91EA0FE72BDAAC176C3A04DD3D2C1
```

`pdfjs/cmaps` 为 PDF.js 包内 CMap 数据，用于部分中日韩 PDF 的文本提取。没有收录 `standard_fonts/`；对纯文本提取通常不需要，若后续要在无嵌入字体的 PDF 上做 OCR 渲染，可再补充该目录。

## 唯一例外：OCR CDN

Tesseract.js **不随站点打包**。只有调用方显式传入 `enableOCR: true`，且 PDF 被判定为低文本时，`js/files.js` 才会动态加载：

```
https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js
```

Tesseract.js 还会自行从 CDN 获取 worker/core 与语言数据（默认 `chi_sim+eng`）。因此：

- OCR 是唯一会离开本机网络边界的解析步骤；
- CDN、CSP、内网或离线环境不可用时，`parseFile` 会以 `OCR_UNAVAILABLE` 明确失败；
- 不会用占位文本或模型猜测冒充 OCR 结果；
- 本仓库将 OCR 标为**未完成稳定自动化验证**，详见 `docs/文件解析说明.md`。

## 更新依赖时

1. 从 npm 官方包取对应 min/UMD 构建，不手改源码；
2. 保留 LICENSE；
3. 更新本 README 的版本、来源、SHA-256；
4. 重新跑 `tests/files.test.mjs`（含 DOCX/XLSX/PPTX/PDF 夹具）。