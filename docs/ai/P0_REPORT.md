# P0 批次报告：路由兜底与样式层合并前置

> 代码提交：`8828d19`（公开 `0ddd634`）  
> 日期：2026-11-20  
> 状态：**P0 完成；P1/P2 未开始**  
> 完整逐行 diff：[P0_DIFF.patch](P0_DIFF.patch)

## 1. 改动文件

| 文件 | 改动 | 对应 |
|---|---:|---|
| `js/app.js` | +138 / -29 | P0-1、P0-3、P0-4 |
| `assets/shouyu-world.css` | +93 | P0-1、P0-4 |
| `index.html` | +2 / -1 | P0-2 |
| `docs/使用说明.md` | +1 / -1 | P0-2 |
| `package.json` | +1 | P0 回归脚本 |
| `tests/p0-accessibility.mjs` | 新增 100 行 | P0-1～P0-4 |

## 2. P0-1 未知路由 404

### 前

```text
#/unknown
→ handleRoute()
→ history.replaceState("#/")
→ 静默显示首页
```

### 后

```text
#/unknown
→ parseRoute() → { name: "notfound", path: "/unknown" }
→ 保留 hash
→ 渲染 .notfound-page
→ 显示请求地址
→ 可回工作台 / 我的课程
→ 浏览器后退仍回到 404，前进仍可恢复
```

关键代码：

- `parseRoute()` 末尾返回 `notfound`，不再返回 `home`。
- `handleRoute()` 删除 `history.replaceState`。
- `routeIdentity()` 对未知路由加入 `path`，避免不同未知地址被当成同一页。
- 新增 `renderNotFoundPage()` 与对应样式。

## 3. P0-2 版本号统一

| 位置 | 前 | 后 |
|---|---|---|
| `index.html` `<title>` | 无版本 | `授渔 V3.0 · …` |
| `index.html` meta | 无 | `application-version: 3.0.0` |
| 使用说明页 | `V2.0` | `V3.0` |
| `docs/使用说明.md` | `V2.2` | `V3.0` |

## 4. P0-3 侧栏导航语义

### 前

```html
<button class="nav-item" type="button" data-action="nav">…</button>
```

### 后

```html
<a class="nav-item" href="#/courses" data-action="nav" aria-current="page">…</a>
```

- 15 个 `nav-item` 全部是带 `href` 的 `<a>`。
- 当前路由只有一个 `aria-current="page"`。
- 14 个路由入口 + AI 教学对话动作入口。
- 品牌、开始备课、更多、隐私、折叠辅助按钮共 20 个可交互目标；19 个入口全部保持可达。
- 保留点击代理与 hash 前进/后退。

## 5. P0-4 移动端抽屉与 44px

### 焦点

- 打开抽屉：焦点进入第一个侧栏导航项。
- Tab：焦点只会在侧栏内循环。
- Shift+Tab：从第一项回到最后一项。
- Escape / 遮罩 / 导航离开：关闭抽屉，焦点归还 `.mobile-menu`。
- `.mobile-menu` 增加 `aria-controls="sidebar"`、`aria-expanded`。

### 触控

在 `@media (max-width: 960px)`：

- 抽屉导航、开始备课、最近记录、隐私链接、折叠按钮 `min-height: 44px`。
- 顶栏按钮与 AI 模式 `min-width/min-height: 44px`。
- 页面内按钮、`[role=button]`、`select`、`summary`、submit `min-height: 44px`。
- 内联 `.btn-link` 也提升到 44px 触控高度。
- 390px 下页面横向溢出为 0。

## 6. 前后指标

### 网络（公开站，Edge，3G：1.6Mbps / 750kbps / 150ms / 4x CPU）

| 指标 | 前 | 后 |
|---|---:|---:|
| 请求数 | 31 | 31 |
| 传输字节 | 520,871 | 522,050 |
| JS gzip | 408,634 | 409,490 |
| 3G 桌面 LCP（单次采样） | 4.98s | 5.20s |
| 3G 移动 LCP（单次采样） | 1.01s | 0.94s |

说明：

- P0 是路由/导航/焦点/触控改动，**没有做网络优化**；请求数不变，体积增加约 1.2KB。
- LCP 单次采样有波动，P0 不能据此宣称改善首屏。
- 用户提供的基线为 9.08s；本机同条件采样为 4.98s，环境/网络路径不同，不能直接对比。
- **首屏 JS 仍约 409KB gzip，未达到 60KB 目标——该项属于 P1-2，尚未开始。**
- **CSS 仍有 6 个文件；合并与重复选择器清理属于 P1-1，尚未开始。**

### 触控目标（390px，首页）

| 指标 | 前 | 后 |
|---|---:|---:|
| 可见交互目标 `<44px` | 24 | 0 |
| 抽屉打开后 `<44px` | 24 | 0 |

### P0 逐项结果

| 项 | 结果 |
|---|---|
| P0-1 | hash 保留；404 视图；后退/前进通过 |
| P0-2 | index / 使用说明 / 文档均为 V3.0 |
| P0-3 | 15 个 nav link；1 个 aria-current；路由点击/后退通过 |
| P0-4 | 首项聚焦、Tab 陷阱、Escape 归还、44px、无横向溢出 |

## 7. 回归结果

```text
单元测试            100 passed / 0 failed
浏览器 E2E          75 passed / 0 failed
文件解析            18 passed / 0 failed
P0 专用回归         PASS（tests/p0-accessibility.mjs）
全站路由加载        32/32 页，0 console error / 0 failed request / 0 横向溢出
7 档宽度            无横向溢出
公开站 404           #/no-such-page 保留，页面渲染，控制台 0 错误
```

## 8. 未进入 P1/P2

以下按 CTA 等待确认后再开始：

- P1-1 CSS 合并（6→2，重复选择器/冲突变量清理）
- P1-2 app.js 拆分与动态 import
- P1-3 首页 CTA/折叠区/右栏非零项
- P1-4 课程列表状态合并
- P1-5 字号/圆角/文字色收敛
- P2-1 Logo 格式与关键 CSS/boot 骨架
- P2-2 首页空状态合并
- P2-3 OG/manifest/内容 hash 资源
- P2-4 路由焦点与 aria-live

P0 没有删除业务功能、未改数据结构/API/本地优先边界。