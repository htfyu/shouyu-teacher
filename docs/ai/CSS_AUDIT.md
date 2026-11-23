# CSS 层审计与合并记录

## 当前结构

```text
assets/tokens.css        3.6 KB   110 个设计变量，单一 :root
assets/components.css  296.3 KB   组件、页面、打印、响应式、动效
```

加载顺序：

```html
<link rel="stylesheet" href="./assets/tokens.css">
<link rel="stylesheet" href="./assets/components.css">
```

## 合并前

```text
styles.css           93.1 KB
ui-refresh.css      110.7 KB
work-theme.css       67.6 KB
rounded-motion.css   11.4 KB
design-language.css  14.4 KB
shouyu-world.css     37.5 KB
```

总计约 334.7 KB，6 个请求；`:root` 声明 397 条、110 个变量，其中 46 个变量存在跨层冲突。

## 合并方法

1. 按原顺序读取六层：`styles → ui-refresh → work-theme → rounded-motion → design-language → shouyu-world`。
2. 提取六层顶层的 `:root`，按原顺序合并为 `tokens.css`；同名变量后层覆盖前层。
3. 剩余规则按原顺序进入 `components.css`，不改变选择器、媒体查询、`@supports`、打印规则和 `@keyframes` 的位置。
4. 只删除“同一选择器、同一 at-rule 上下文、被后续声明完全覆盖”的声明；不合并仍有不同声明的重复选择器，避免改变级联结果。
5. 删除删除后为空的 226 个规则块。

## 合并结果

| 指标 | 前 | 后 |
|---|---:|---:|
| CSS 文件 | 6 | 2 |
| CSS 请求 | 6 | 2 |
| 未压缩字节 | 334,667 | 306,443 |
| gzip 字节 | 55,733 | 43,306 |
| 样式规则（含嵌套 qualified） | 3,096 | 2,988 |
| 重复选择器出现次数 | 1,176 | 993 |
| 精确重复规则块 | 12 | 0 |
| `:root` 变量 | 110 | 110 |
| 冲突变量 | 46 | 0 |
| 计算样式指纹差异 | — | **32 个页面/视口组合 0 差异** |

> 用户给出的基线为 47 个冲突变量 / 476 个重复选择器；本机合并前实测为 46 / 1,176 次重复出现。这里报告实测值，不为了对齐数字而删除仍有不同声明的选择器。

## 验证

- 16 路由 × 1440/390 = 32 个页面/视口组合，逐元素计算样式指纹：0 差异。
- 单元 100、E2E 75、文件 18、P0 专用测试通过。
- 32 次路由加载：0 console error / 0 failed request / 0 横向溢出。
- CSS 加载数：2。
- 公开站目标区域与 404 状态保持正常。

## 后续

- P1-5 继续收敛字号（6 级）、圆角（4 级）、文字色（5 级）；本轮只做文件层与重复声明合并，不改变视觉值。
- 不再恢复六层结构；旧文件保留在 Git 历史中。