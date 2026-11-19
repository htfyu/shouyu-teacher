# 测试报告

> 执行日期：2026-11-19  
> 环境：Windows / Node v26.12.0 / npm 11.20.0 / Edge headless / 本地静态服务器 `127.0.0.1:5598`  
> 结论：本轮自动化可执行检查全部通过；浏览器端完整备份下载/恢复未自动化，列为未验证。

## 1. 单元测试

命令：

```bash
npm run test:unit
```

结果：

```text
tests 100
pass 100
fail 0
```

本轮新增 `tests/teaching-store.test.mjs`，覆盖：

- 空存储；
- 创建、课程筛选、学时汇总；
- 编辑保留 id/createdAt；
- 删除单条；
- 导出/导入；
- 拒绝无课程记录；
- 本机存储写入失败时给出可操作错误。

## 2. 浏览器 E2E

命令（环境变量指向本机 Playwright/Edge）：

```bash
node tests/e2e.smoke.mjs
```

结果：

```text
passed: 75
```

本轮新增：

- 课程工作空间标签数 6 → 7；
- “授课记录”入口存在；
- 授课记录空状态存在。

原有检查（品牌、四项核心导航、更多功能、专业库、备课生成、质量、成果、导出、移动端）全部通过。

## 3. 文件解析测试

```bash
npm --prefix tests run test:files
```

结果：

```text
PASS no page errors
RESULT 18 passed, 0 failed
```

## 4. 宽度与溢出

覆盖页面：

```text
工作台、我的课程、课程工作空间、备课工作室、我的成果、质量检测、
知识库、专业数据库、资料中心、知识图谱、模板库、历史记录、
系统设置、使用说明、教学应用成效、演示
```

宽度：

```text
1920 / 1440 / 1280 / 1024 / 900 / 768 / 390
```

结果：脚本无横向溢出输出；全部通过。

页面框架实测（1440）：

```text
16 个主页面：x=260，width=1180，head x=306
```

## 5. Impeccable

安装：

- skill 版本：4.10.0
- 引擎：v0.1.27（windows-x64）
- DSH 已识别 `impeccable` skill
- 项目级路径：`.dsh/skills/impeccable`
- 未安装自动 hook（`--no-hooks`），采用手动检测

### 变更文件检测

```bash
.dsh/skills/impeccable/scripts/impeccable.cmd detect --json --changed
```

```text
EXIT 0
FINDINGS 0
```

### 渲染页面检测

| 页面 | 结果 |
|---|---|
| 工作台 | 0 findings |
| 我的课程 | 0 findings |
| 课程工作空间 | 0 findings |
| 质量检测（空状态） | 0 findings |
| 专业数据库 | 0 findings |

检测覆盖：字号下限、对比度、装饰性反模式、侧色条、嵌套卡片。

### 带真实项目的 CDP 检测

使用 Playwright 启动带 `--remote-debugging-port` 的 Edge，生成一个真实备课项目，再通过 `detect --cdp` 扫描运行中的页面：

```text
#/studio  with generated project
EXIT 0
primary findings 0
advisory 1（正文 em-dash 饱和，advisory 不改变退出码）

#/quality with generated report
EXIT 0
findings 0
```

文件：

- `tests/studio-detect.e2e.mjs`
- `资料/impeccable-studio-cdp.json`
- `资料/impeccable-quality-cdp.json`
- `资料/impeccable-studio-mobile-cdp.json`
- `资料/impeccable-quality-mobile-cdp.json`

移动端 390×844：

```text
#/studio  0 primary findings（1 条 em-dash advisory）
#/quality 0 findings
#/programs 0 findings
```

**未验证**：极长真实文档（数万字）下的 detector 全量扫描；当前使用课程知识包生成的正常长度项目。

## 6. 交互手测

| 场景 | 结果 |
|---|---|
| 课程工作空间 7 个标签 | 通过 |
| 授课记录空状态 | 通过 |
| 新建授课记录 | 通过 |
| 编辑授课记录 | 通过 |
| 删除授课记录（确认弹窗） | 通过 |
| 记录后重新进入课程 | 通过（localStorage） |
| 课程状态章（待审核/通过/中性） | 通过 |
| 更多功能分组 | 通过 |
| 搜索、筛选、课程行点击 | 通过 |
| 质量页问题选中、状态章宽度 | 通过 |
| `/` 聚焦课程/知识库/专业库搜索 | 通过 |
| 备课生成、编辑器、质检、导出入口 | E2E 覆盖通过 |
| 控制台错误 | 0（本轮检查页面） |

## 7. 完整备份端到端

新增 `tests/backup.e2e.mjs`，真实执行：

1. 通过 UI 新建一条授课记录；
2. 生成一个真实备课项目；
3. 导出完整备份，读取 JSON，确认 `teaching.records` 和 `studio.bundles` 存在；
4. 删除本机数据，确认记录与项目消失；
5. 导入同一备份，确认授课记录和备课项目重新出现。

结果：

```text
{"ok":true,"backupBytes":133481,"teachingRecords":1,"projects":1,"errors":[]}
```

命令：

```bash
$env:PLAYWRIGHT_MODULE='<playwright/index.js>'
node tests/backup.e2e.mjs
```

## 8. 长文档阅读

新增 `tests/long-doc.e2e.mjs`：生成项目 → 打开编辑器 → 写入 80 段、约 9,000 字 → 自动保存 → 返回工作室读取。

结果：

```text
textLength: 9017
bodyWidth: 472
bodyScrollWidth: 472
mainClientHeight: 760
mainScrollHeight: 10956
fontSize: 13.5px
lineHeight: 24.3px
pageOverflow: 0
```

结论：长文档变为纵向滚动，没有横向溢出，正文宽度和行高保持稳定。

## 9. 未验证/风险

1. 真实教师长时间使用、真实课堂记录量下的性能未测试。
2. 旧 CSS 五层叠加仍有历史死规则；未做物理删除。
3. 新增课堂记录使用 localStorage；已有写入失败的可操作错误提示，但没有精确容量预检。
4. 移动端已验证主要页面 detector 干净；复杂质量审阅的完整操作流程仍未逐项手测。
5. 极长真实文档下的阅读与 detector 扫描未测试。

## 10. 结论

可自动化的核心回归全部通过；没有发现本轮改造引入的控制台错误、横向溢出或测试回归。

已补齐完整备份端到端、真实项目/质量页桌面与移动 CDP detector、9,017 字长文档阅读；公开站点 `08767f0`，Pages `built`。  
仍需补：真实教师长时间使用、旧 CSS 物理清理、学生侧模块与跨设备能力。