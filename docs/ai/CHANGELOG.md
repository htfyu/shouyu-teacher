# 变更记录

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
- 测试：单元测试增至 100。

### 验证

- 完整备份：`ok: true`，备份 133481 bytes；授课记录与备课项目均恢复成功。
- studio detector：exit 0，0 primary findings。
- quality detector：exit 0，0 findings。
- 单元 99 / E2E 75 / 文件 18。

### 未完成

- 质量页/编辑器新世界的逐页微调。
- 旧 CSS 五层叠加的物理清理。
- 真实教师长时间使用测试。
- 完整备份的浏览器端到端下载/恢复尚未自动化（store 层已测试）。