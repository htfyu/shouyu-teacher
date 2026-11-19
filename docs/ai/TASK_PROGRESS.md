# 任务进度

## 当前阶段

第 1 批：环境识别、上下文建立、Impeccable 部署、视觉世界落地、导航分组。  
**未完成**：课堂记录、质量页重构、全站逐页验收、发布。

## 已完成

- [x] 核实技术栈：静态 ES Modules，无构建步骤；Git 干净，`main` 分支。
- [x] 建立 `PRODUCT.md`、`DESIGN.md`、`docs/ai/`。
- [x] 安装 Impeccable 4.10.0 到项目 `.dsh/skills/impeccable`，DSH 已识别 `impeccable` skill。
- [x] 验证引擎 `impeccable.exe` v0.1.27；`context` 可运行；无自动 hook，结束时需手动 `detect`。
- [x] 获取 `VoltAgent/awesome-design-md` 参考（commit `fcc7028`），保留 Linear / Notion / Stripe / Apple / Raycast / Framer 六份 DESIGN.md 与来源。
- [x] 运行 `concept-seed --scope direction --mode operate`，记录 seed reference `seed:0833bd0ce85e6e83`。
- [x] 建立 Workshop Folio 视觉世界：深松木书脊、暖纸、细线、状态章、朱砂强调。
- [x] 新增 `assets/shouyu-world.css` 并在 `index.html` 最后加载。
- [x] 移除导航左侧色条、装饰性 kicker、课程左侧色条。
- [x] “更多功能”从 10 个平铺入口改为三组：教学资料 / 审阅与记录 / 设置与帮助。
- [x] 课程行状态改为有语义的状态章（待审核 / 通过 / 中性）。
- [x] 首页、我的课程、课程工作空间、质量页初步实机检查，0 控制台错误。
- [x] 课程工作空间新增“授课记录”真实本地模块：新增/编辑/删除、空状态、汇总、备份/恢复、清空本机数据。
- [x] 新增 `tests/teaching-store.test.mjs`；单元测试增至 99；E2E 增至 75。
- [x] 课程工作空间空状态增加“从本章开始 / 先选任务 / 查知识依据”真实下一步。
- [x] 修正课程状态章宽度，增加待审核/通过/中性三种语义。
- [x] 移除页面装饰性 kicker、左侧色条、旧脉冲点和重复条纹。

## 进行中

- 无。可执行交付已完成并发布：公开提交 `08767f0`，Pages `built`；详细交付见 `docs/ai/DELIVERY.md`。

## 本轮新增验证（第二批）

- [x] 完整备份端到端：`tests/backup.e2e.mjs`，新建授课记录 + 生成备课项目 → 导出 JSON → 清空本机数据 → 导入恢复；结果 `{"ok":true,"backupBytes":133481,"teachingRecords":1,"projects":1,"errors":[]}`。
- [x] `#/studio` 带真实项目的 CDP detector：exit 0，0 primary findings（1 条 em-dash advisory）。
- [x] `#/quality` 带真实报告：exit 0，0 findings；复跑仍通过。
- [x] 修复质量页 10px/9px 功能文字、7.5px 反思标签、低对比步骤序号、文档目录/上下文栏嵌套卡片。
- [x] 修复授课记录任务与章节关联（以任务 chapterId 为准）。
- [x] 增加 `/` 聚焦当前页搜索（课程 / 知识库 / 专业库），不再只聚焦旧聊天输入。
- [x] 建立 `docs/ai/CSS_AUDIT.md`，记录六层 CSS 的职责、风险和后续安全合并方案。
- [x] 390px 移动端 detector：工作台 / 课程 / 课程工作空间 / 质量 / 专业库 / 工作室均 0 primary findings。
- [x] 授课记录写入失败改为可操作提示（导出备份、清理旧记录）；单元测试增至 100。
- [x] 质量页移动端 `§04` 孤行通过 `text-wrap: pretty` 消除。
- [x] 长文档阅读：编辑器写入 80 段/9,017 字，正文 13.5px/24.3px，无横向溢出，纵向滚动正常。

## 待完成

- [ ] 极长真实文档下的阅读检查。
- [ ] 首页“继续备课”真实项目的视觉层级复核（本批已有项目截图）。
- [ ] 旧 CSS 五层叠加的物理清理（仅记录，未删除）。
- [ ] 真实教师长时间使用测试。

## 本批验证结果

- 单元测试：99 passed / 0 failed。
- 浏览器 E2E：75 passed / 0 failed。
- 文件解析：18 passed / 0 failed。
- 7 档宽度：无横向溢出。
- Impeccable 变更检测：0 findings。
- 渲染检测（工作台 / 我的课程 / 课程工作空间 / 质量空态 / 专业库）：0 findings。
- 授课记录新增/编辑/删除：手测通过。
- 页面框架：1440 下全部 x=260 / width=1180 / head x=306。

## 阻塞

无。新增课堂模块涉及新本地存储字段和 UI，需在下一批单独实施并做兼容测试；不属于纯视觉修改。