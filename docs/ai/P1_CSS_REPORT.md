# P1-1 批次报告：六层 CSS 合并为 tokens + components

> 代码提交：`e064b3e`（公开 `1f1d548`）  
> 日期：2026-11-20  
> 状态：**P1-1 完成；P1-2~P1-5、P2 未开始**  
> 完整逐行 diff：[P1_CSS_DIFF.patch](P1_CSS_DIFF.patch)（647KB）

## 1. 结果

| 指标 | 前 | 后 |
|---|---:|---:|
| CSS 文件 | 6 | 2 |
| CSS 请求 | 6 | 2 |
| 未压缩字节 | 334,667 | 298,415 |
| gzip 字节 | 55,733 | 41,801 |
| 解析规则（含嵌套 qualified） | 3,096 | 2,870 |
| 重复选择器出现 | 1,176 | 944 |
| 精确重复规则块 | 12 | 0 |
| `:root` 变量 | 110 | 110 |
| 冲突变量 | 46 | 0 |
| 计算样式指纹差异 | — | 32 组合 0 差异 |

新增：

```text
assets/tokens.css        3.6 KB
assets/components.css  294.8 KB
```

删除：

```text
assets/styles.css
assets/ui-refresh.css
assets/work-theme.css
assets/rounded-motion.css
assets/design-language.css
assets/shouyu-world.css
```

## 2. 合并方法

1. 按原加载顺序读取六层。
2. 提取六层顶层 `:root`，按原顺序合并为单一 token 层；后层变量覆盖前层。
3. 其余规则按原顺序进入组件层，不改变选择器、媒体查询、打印规则、`@keyframes` 位置。
4. 只删除同一选择器、同一 at-rule 上下文、被后续声明完全覆盖的声明；不删除仍有不同声明的重复选择器。
5. 删除删除后为空的 226 个规则块。

> 用户给出的基线是 47 个冲突变量 / 476 个重复选择器；本机合并前实测为 46 / 1,176 次重复出现。这里报告实测值，不为对齐数字删除仍承担页面差异的选择器。

## 3. 视觉回归

新增计算样式指纹脚本：对 16 个路由 × 1440/390，共 32 个页面/视口组合，逐元素比对 35 个布局/排版属性。

```text
diffPages: 0
```

不是截图“看起来一样”，而是计算样式零差异。

另外：

```text
单元测试        100 passed / 0 failed
浏览器 E2E      75 passed / 0 failed
文件解析        18 passed / 0 failed
P0 专用回归     PASS
32 次路由加载   0 console error / 0 failed request / 0 横向溢出
公开站 CSS      tokens.css + components.css 两张，0 控制台错误
```

## 4. 网络前后

公开站，Edge，3G：1.6Mbps / 750kbps / 150ms / 4x CPU。

| 指标 | P0 后 | P1-1 后 |
|---|---:|---:|
| 请求数 | 31 | 27 |
| 传输字节 | 522,050 | 506,379 |
| JS gzip | 409,490 | 409,490 |
| 3G 桌面 LCP（单次采样） | 5.20s | 4.14s |
| 3G 移动 LCP（单次采样） | 0.94s | 1.08s |

说明：

- CSS 请求减少 4 个，传输减少约 15.7KB。
- LCP 单次采样受网络波动影响；本批没有改 JS，不能把 LCP 全部归因于 CSS。
- **首屏 JS 仍约 409KB gzip，未达到 60KB 目标。** 该项属于 P1-2，尚未开始。

## 5. 逐文件

| 文件 | 改动 |
|---|---|
| `assets/tokens.css` | 新增，110 个变量，单一 `:root` |
| `assets/components.css` | 新增，原六层规则按顺序合并 |
| `assets/styles.css` | 删除 |
| `assets/ui-refresh.css` | 删除 |
| `assets/work-theme.css` | 删除 |
| `assets/rounded-motion.css` | 删除 |
| `assets/design-language.css` | 删除 |
| `assets/shouyu-world.css` | 删除 |
| `index.html` | 6 个 link → 2 个 |
| `.gitignore` | 忽略 `.memsearch/` |
| `README.md` / `docs/ai/*` | 更新样式结构与本轮记录 |

## 6. 未开始

- **P1-2**：app.js 拆分、engine/knowledge/export/ai 动态 import。当前首屏 JS 409KB，目标 60KB，未达标。
- **P1-3**：首页 CTA/折叠区/右栏非零项。
- **P1-4**：课程列表状态合并。
- **P1-5**：字号 6 级/圆角 4 级/文字色 5 级。
- **P2** 全部。

P1-1 没有改变业务逻辑、数据结构、路由、导出或本地优先边界。