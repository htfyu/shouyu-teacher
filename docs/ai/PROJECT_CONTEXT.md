# 授渔项目上下文

## 定位

授渔是面向技工院校教师的工学一体化教学工作平台。核心链路：

```text
专业系 → 专业组 → 专业 → 专业课
→ 章节 → 典型工作任务 → 专业知识
→ 10 类教学资源 → 质量自检 → 教师审核 → 导出归档
```

## 技术栈（已核实）

- 纯静态前端，ES Modules，无构建步骤。
- 入口：`index.html`，主逻辑：`js/app.js`（约 10,300 行）。
- 样式：`tokens.css → components.css`（六层已合并；组件层保留原级联顺序）。
- 数据：`js/programs-data.js`、`js/curriculum-data.js`、`js/knowledge*.js` 等静态模块。
- 存储：IndexedDB `jiangbei_v2`、`shouyu_programs_v1`、`shouyu_studio_v1`、`shouyu_impact_v1`；localStorage 兼容键。
- 测试：Node test + Playwright（Edge）+ 文件解析测试。
- 部署：GitHub Pages，`main` 分支；构建产物即静态文件。

## 用户与场景

- 主用户：技工院校工学一体化教师、课程负责人、教研组。
- 场景：办公室/实训室备课，课程资料整理，公开课与竞赛材料，教研组审阅，成果归档。
- 数据边界：默认本地；不输入学生姓名、学号、联系方式等个人信息；无服务端数据库。

## 当前真实数据

- 6 教学单位 / 13 专业组 / 56 专业条目 / 75 招生计划 / 567 课程记录 / 134 来源。
- 13 条官方课程简介。
- 4 个课程知识包（PLC、工业机器人、新能源汽车、网络综合布线）。
- 35 份知识材料 / 155 个可检索章节。
- 0 个已审核课程知识包；0 条真实课堂授课记录；0 条真实应用成效记录。

## 产品约束

- 不删除业务功能、不改变数据结构/接口/导出格式。
- 不用假数据、假按钮、静态页面冒充功能。
- 视觉升级不得隐藏关键业务入口。
- 新增模块必须基于教师真实录入的本地记录，不得预置伪造数据。
- 当前 PDF 为打印面板，不是服务端 PDF 生成。

## 设计工具

- Impeccable 4.10.0，项目级 `.dsh/skills/impeccable`，引擎 v0.1.27。
- 入口命令：`.dsh/skills/impeccable/scripts/impeccable.cmd`。
- 未启用自动 hook；UI 修改完成后手动运行 `detect --json --changed`。
- `docs/design/references/` 固定保存 6 份 awesome-design-md 参考，来源 commit `fcc70284932276d085f01ef9f83edde90b1258cb`。

## 关键文档

- `PRODUCT.md`
- `DESIGN.md`
- `docs/ai/ARCHITECTURE.md`
- `docs/ai/TASK_PROGRESS.md`
- `docs/ai/TEST_REPORT.md`
- `docs/UI设计规范.md`
- `docs/数据来源与审核依据清单.md`
- `docs/V3产品信息架构.md`（历史方案，需与新方案区分）