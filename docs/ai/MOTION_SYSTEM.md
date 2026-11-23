# Motion System：从 Web Motion Showcase 学到的克制动效

> 日期：2026-11-23  
> 代码提交：`e512dd2`  
> 完整 diff：[MOTION_DIFF.patch](MOTION_DIFF.patch)  
> 参考：<https://holynova.github.io/web-motion-showcase/?lang=zh&theme=slate&mode=light>  
> 落地：工作台进入、数据条生长、工具展开、悬停/按压、顶栏滚动阴影  
> 验证：E2E 88、P0 PASS、32 路由 0 错误、1440/390 detector 0  
> 画面：[进入中的工作台](../screenshots/motion-entrance.png) · [减少动态模式](../screenshots/motion-reduced.png)

## 1. 参考站拆解

站点收录 60 个动效，分类分布：

```text
反馈 19
进入 12
悬停 12
滚动 8
布局 5
图片 4
```

它的核心不是“多”，而是**短、稳、可预期**：

- `--transition-fast: 150ms`：hover、颜色、按钮反馈；
- `--transition-normal: 250ms`：导航、边框、阴影、状态；
- `--transition-slow: 400ms`：卡片上浮、较慢的场景变化；
- 常规缓动 `cubic-bezier(0.4, 0, 0.2, 1)`；
- 显现缓动 `cubic-bezier(0.16, 1, 0.3, 1)`；
- 卡片 hover `translateY(-5px)`，阴影和边框同帧变化；
- 卡片操作按钮在 hover/focus-within 时以 150ms 出现；
- 滚动进度 3px 顶线，100ms 过渡；导航滚动后只增加阴影；
- 全局 `prefers-reduced-motion` 会把动画、过渡、位移全部压掉。

参考站的展示卡片里有很多 2–4 秒无限循环、礼花、流星、光标跟随、3D 倾斜。这些是**展品**，不是工作台行为。授渔不照搬。

## 2. 授渔采纳

### 一次性进入

- 页面路由切换：270ms，opacity + 7px。
- KPI：360ms，20 / 65 / 110 / 155ms 错峰。
- 主卡：400ms，80 / 120 / 160 / 200ms 错峰。
- 右栏：400ms，120 / 175 / 230ms 错峰。
- 只在 `.view.is-route-enter` 下播放；普通状态重渲染不重播。

### 有含义的数据显现

- 知识包覆盖条：650ms，`scaleX(0) → 1`，220ms 延迟。
- 条的长度来自真实 `4/4` 数据，不是装饰性无限动画。
- 不做数字滚动/滚动计数，避免指标被误读。

### 交互反馈

- KPI / 卡片 hover：上浮 2px，150ms。
- 箭头 hover：位移 1–2px。
- 主按钮 hover：上浮 1px；按压 `scale(0.985)`。
- 工具区展开：240ms，opacity + 5px。
- 顶栏滚动超过 8px：220ms 内增加阴影和更实的白底。

### 降级

- `prefers-reduced-motion: reduce` 下新动效全部 `animation: none`，KPI 与卡片直接 `opacity: 1`。
- 没有依赖动效才能理解的状态；所有内容在不播放动画时完整可见。
- 不使用滚动劫持、视差、光标跟随、无限循环或自动播放装饰。

## 3. 未采纳

| 参考案例 | 不采用的原因 |
|---|---|
| 60 个循环预览 | 展品逻辑；工作台会持续分心 |
| Custom Cursor / Trail | 破坏系统光标与可访问性 |
| Confetti / Meteors / Aurora | 与教学任务无关，抢注意力 |
| Tilt / Glare / 3D | 影响阅读与命中，移动端无意义 |
| Count Up / Odometer | 数据需要可信的一眼读数，不做表演 |
| Scroll Hijack / Parallax | 长文档和表格阅读会被劫持 |
| Infinite Marquee | 无信息增量的持续运动 |
| 金属渐变文字 | 可读性和印刷感都更差 |

## 4. 代码位置

- `assets/tokens.css`：`--motion-fast/base/slow`、`--motion-ease/out/spring`。
- `assets/components.css`：
  - `home-rise`、`coverage-grow`、`tools-unfold`
  - KPI / 主卡 / 右栏 stagger
  - hover / press / arrow motion
  - `.topbar.is-scrolled`
  - `prefers-reduced-motion` 覆盖
- `js/app.js`：`initScrollChrome()`，passive scroll + rAF，只切换顶栏 class。
- `DESIGN.md`：动效规则同步更新。

## 5. 验证

```text
正常模式
  KPI animation: home-rise / 0.36s / iteration 1
  主卡 animation: home-rise / 0.4s / iteration 1
  覆盖条 animation: coverage-grow / 0.65s
  工具展开 animation: tools-unfold / 0.24s
  滚动后 topbar.is-scrolled: true

减少动态
  KPI animationName: none
  覆盖条 animationName: none
  KPI opacity: 1
  内容无隐藏、无位移

回归
  E2E 88 passed
  P0 PASS
  32 路由 0 console error / 0 failed request / 0 溢出
  1440 / 390 detector 0 primary
  7 档宽度无横向溢出
```

## 6. 已知边界

- 未在低端 Android 真机测帧率；目前只用合成层属性，避免布局动画。
- 只在 Edge/Chromium 自动化验证，未跑 Safari/Firefox 视觉回归。
- 动效是工作台优先；课程/质量等页面沿用既有路由进入和交互过渡，没有逐页重做。
- 没有新增动画库或构建依赖。