# 变更记录

## 2026-11-21 · Daylight Workspace 视觉更新

### 修改

- 参考轻量数据工作台：冷白画布、白色 18px 圆角数据卡、青绿主动作、蓝色数据强调。
- 保留深松木侧栏作为品牌锚点；侧栏选中项改为薄荷底 + 深绿字。
- 工作台新增 4 个真实 KPI：待审核成果、备课项目、待审核知识包、知识材料。
- 新增知识包覆盖卡：4/4 已建立、待审核 4、真实进度条。
- 右栏新增知识库入口：教学材料 35、专业课程记录 567。
- 全局 token 从暖纸调为冷雾白；清理 studio 等页面的暖色硬编码表面。
- 更新 DESIGN.md 为 Daylight Workspace。

### 验证

- 全站 32 个路由/视口 detector 0 primary；首页 1440/390 均为 0。
- E2E 88、单元 100、P0 PASS、32 路由 0 错误/溢出、7 档宽度无溢出。
- 对比度修复：辅助文字最低 `#5f6b7d`；触控目标保持 ≥44px。

## 2026-11-20 · 工作台首页信息层级重构

### 修改

- 首页标题改为“工作台”，删除日期、问候语、工作区说明段落。
- 只保留一个主 CTA“新建备课”；“我的课程”降为“全部课程”链接。
- 无项目/草稿时不再渲染“继续上次的备课”空状态；无第二个项目时不渲染“最近成果”。
- 课程审核状态由每行重复改为分组标题 + 单一状态行。
- 单项工具改为默认折叠的原生 `<details>`，删除标签、说明段落和使用说明链接。
- 右栏只渲染非零待处理项；无文件时不渲染最近文件；删除提醒块。
- 同一项目不再同时出现在“继续”和“最近成果”。
- 修复首页嵌套 `<main>`；新增 `data-home-state` 与首页区域 `data-role`。

### 清理

- 删除首页未使用的 `stats`、`featured`、`approvedPacks`。
- 清理旧首页死样式约 6.7KB；CSS 计算样式指纹 32 组合 0 差异。

### 验证

- 首页文字 702→311 字符，元素 234→271（新增 4 个真实 KPI），空状态 4→0，待处理行 4→1，`<main>` 2→1。
- E2E 88、单元 100、文件 18；32 路由 0 错误/溢出；全站 detector 0 primary。

## 2026-11-20 · P1-1 CSS 六层合并为两层

### 新增

- `assets/tokens.css`：110 个设计变量，单一 `:root`，冲突变量 46→0。
- `assets/components.css`：原六层组件/页面/打印/响应式规则按原顺序合并。

### 修改

- `index.html`：6 个 CSS 请求改为 `tokens.css` + `components.css`。
- 删除 `styles.css`、`ui-refresh.css`、`work-theme.css`、`rounded-motion.css`、`design-language.css`、`shouyu-world.css`。
- CSS 未压缩体积 334,667→298,415；gzip 55,733→41,801；请求 6→2。
- 删除 226 个被完全覆盖的空规则；重复选择器出现 1,176→944；精确重复规则 12→0。
- 32 个页面/视口组合的计算样式指纹 0 差异。

### 未开始

- P1-2 app.js 拆分/动态 import；P1-3/4/5；P2 全部。

## 2026-11-20 · P0 路由兜底与移动端可用性

### 新增

- `tests/p0-accessibility.mjs`：404、版本、导航语义、抽屉焦点、44px、hash 回退回归。
- `docs/ai/P0_REPORT.md`、`docs/ai/P0_DIFF.patch`：P0 指标与逐行 diff。

### 修改

- 未知 hash 保留地址并渲染 404，不再静默 replace 回首页。
- `index.html` / 使用说明统一 V3.0。
- 侧栏 15 个 `nav-item` 改为带 `href` 的 `<a>`；保留单一 `aria-current="page"`。
- 移动抽屉打开聚焦首项、Tab 焦点陷阱、Escape/遮罩/导航关闭后归还焦点。
- 960px 以下交互目标 44px；390px 可见小于 44px 的目标从 24 降至 0。

### 未开始

- P1/P2 全部条目；LCP 与 60KB 首屏 JS 目标尚未通过 P0 达成。

## 2026-11-20 · 指定区域、全站可读性与冗余清理

### 指定区域

- `js/app.js`：侧栏 Logo 改用 `logo-mark-inverse.png`；删除已废弃的 `brand-sub` 文案节点。
- `assets/shouyu-world.css`：Logo 改为 34×34、无内边距/无底板/无边框；开始备课按钮统一 38px 高、11px 内边距、弹性文字区与固定快捷键位；今日待处理四行统一 42px、左标签/右数值、分隔线收口。
- `assets/brand/README.md`：补充深色侧栏使用反白透明资源与 Alpha 说明。

### 全站 Bug 修复

- 修复统计行被通用卡片规则染成白色圆角胶囊的问题。
- 修复 `.upload-privacy` 的 `!important` 覆盖，恢复 11.5px。
- 修复知识库 9px 编号、移动端分类标签、图谱/资料/模板/历史/设置/说明/成效/演示页的功能文字低于 11px 问题。
- 修复 `.kb-note` 的 3px 左侧色条（改为全边框暖纸提示）。
- 修复历史批量操作栏、文件库、上传区、设置提示条、存储摘要的嵌套卡片。
- 修复“历史记录”统计后缀的 9px 内联样式，改成语义类 `.stat-value-note`。
- 修复指南/演示页标题层级：`h1 → h2`、`h2 → h3`，消除 skipped-heading。

### 清理

- 删除五个 CSS 层里的 `.brand-sub` 死规则。
- 删除 `.upload-privacy` 的 `!important` 和重复字号覆盖。
- 移除 `role-card h4` / `demo-step h3` / `demo-architecture h3` 旧选择器。
- 移除历史统计的内联 9px 样式。
- 保留 `logo-mark.png`（启动页/移动端/README）与 `logo-mark-inverse.png`（深色侧栏）。

### 验证

- 单元 100、E2E 75、文件 18。
- 16 路由 × 1440/390 共 32 次 rendered detector：0 primary findings。
- 32 次路由加载：0 console error、0 failed request、0 横向溢出。
- 完整备份：授课记录 + 备课项目恢复通过。
- 长文档：9,017 字，无横向溢出。

## 2026-11-19 · 设计世界与产品结构第一批

### 新增

- `PRODUCT.md`：产品事实、用户、边界、证据、原则。
- `DESIGN.md`：Workshop Folio / 工作手册视觉世界。
- `assets/shouyu-world.css`：深松木书脊、暖纸、细线、状态章、阅读与工作区表面。
- `js/teaching-store.js`：教师真实授课记录（localStorage，已进入完整备份）。
- `tests/teaching-store.test.mjs`：授课记录 CRUD、筛选、汇总、导入导出。
- `docs/ai/`：项目上下文、架构、诊断、决策、进度、测试。
- `docs/design/`：六份外部设计参考与来源版本。

### 修改

- `index.html`：加载世界样式；元描述更新到 V3.0。
- `js/app.js`：
  - 更多功能按“教学资料 / 审阅与记录 / 设置与帮助”分组；
  - 课程工作空间新增“授课记录”标签、空状态、真实增删改；
  - 课程概览空项目状态增加三个真实下一步；
  - 课程状态章语义（待审核/通过/中性）；
  - 完整备份/恢复/清空本机数据纳入授课记录。
- `assets/work-theme.css`：去掉页面侧色条、选中 inset 色条、旧点状装饰。
- `assets/styles.css`：去掉警告块重复条纹。
- `tests/e2e.smoke.mjs`：课程工作空间 6→7 个标签，新增授课记录空状态检查。
- `package.json`：单元测试加入 teaching-store。
- `README.md`、`docs/UI设计规范.md`：同步新世界与测试数。

### 验证

见 `TEST_REPORT.md`。关键结果：单元 99、E2E 75、文件 18、Impeccable 变更检测 0、五个主要渲染页 0 发现、7 档宽度无横向溢出。

## 2026-11-19 · 第二批：验证闭环与真实项目检测

### 新增

- `tests/backup.e2e.mjs`：完整备份下载 / 清空 / 导入恢复端到端。
- `tests/studio-detect.e2e.mjs`：通过 CDP 扫描运行中的真实 `#/studio` 和 `#/quality` 页面。
- `npm run test:backup`、`npm run test:design-qa`。

### 修复

- 质量页：10px/9px 功能文字、7.5px 反思标签、对比度不足的步骤序号。
- 工作室：文档目录/上下文面板嵌套卡片与 1px 侧边分隔、问题详情嵌套卡片。
- 授课记录：章节按任务 `chapterId` 归档，避免章节与任务错配。
- 键盘：`/` 可直接聚焦当前页搜索（课程 / 知识库 / 专业库）。
- 文档：新增 `docs/ai/CSS_AUDIT.md`。
- 移动端：390px 检测修复专业库筛选/管理按钮 9–10px 字号；质量页移动端孤行。
- 授课记录：本机存储写入失败时给出“导出备份、清理旧记录”的可操作提示。
- 测试：单元测试增至 100；新增长文档阅读测试 `tests/long-doc.e2e.mjs`。

### 验证

- 完整备份：`ok: true`，备份 133481 bytes；授课记录与备课项目均恢复成功。
- studio detector：exit 0，0 primary findings。
- quality detector：exit 0，0 findings。
- 单元 99 / E2E 75 / 文件 18。

### 最终交付

- 公开提交 `08767f0`，Pages `built`。
- 新增 `docs/ai/DELIVERY.md` 汇总交付范围、验证结果、未实现项和边界。

### 未完成

- 质量页/编辑器新世界的逐页微调。
- 旧 CSS 五层叠加的物理清理。
- 真实教师长时间使用测试。
- 完整备份的浏览器端到端下载/恢复尚未自动化（store 层已测试）。