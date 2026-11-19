# CSS 层审计

## 当前加载顺序

```text
styles.css           93 KB  基础组件、历史布局、文档/聊天/编辑器
ui-refresh.css      111 KB  早期重排与全站覆盖
work-theme.css       68 KB  工作型主题与页面专用样式
rounded-motion.css   11 KB  圆角、阴影、焦点与动效
design-language.css  14 KB  页面框架、字号、间距、阅读区
shouyu-world.css     31 KB  Workshop Folio 视觉世界与状态章
```

总计约 328 KB（未压缩，本地静态加载）。

## 为什么暂不删除

1. 六层之间不是简单覆盖：`styles.css` 仍定义编辑器、旧聊天、文件中心和打印样式。
2. `ui-refresh.css` 仍有大量页面专用布局，无法仅凭“看起来重复”判断死代码。
3. 没有构建期 CSS 树摇；直接删除需要用页面覆盖率和视觉回归双重验证。
4. 当前项目没有视觉回归基线工具；贸然清理会把不可见页面的样式一起删掉。

## 已完成的低风险收敛

- 删除 `styles.css` 中警告块的重复条纹渐变；
- 删除 `work-theme.css` 中导航/课程/专业卡/质量行/工作台侧色条；
- 删除选中行 inset 2px 色条；
- 删除 `.studio-doc-tab.is-active` 的 inset 色条；
- 用 `shouyu-world.css` 统一颜色、圆角、状态章和表面；
- 将页面框架、字号下限集中在 `design-language.css` / `shouyu-world.css`；
- 检测器 `--changed` 为 0 findings，主要渲染页 0 findings。

## 后续安全清理方案

1. 用 Playwright 覆盖率采集 16 个路由 + 移动端 + 编辑器/弹窗。
2. 生成选择器使用清单，标记“未命中”而非“看起来重复”。
3. 对未命中规则先在浏览器禁用，再做截图对比。
4. 按层合并为：
   - `tokens.css`
   - `base.css`
   - `components.css`
   - `pages.css`
   - `motion.css`
5. 每次只删一层的一段，保留 Git 回滚点。

## 不做什么

- 不做一次性 CSS 重写；
- 不删除 `styles.css` 中仍被编辑器/文件中心/打印使用的规则；
- 不为减少行数引入 Tailwind 或运行时 CSS-in-JS；
- 不在没有视觉回归的情况下大范围删除选择器。

## 结论

当前保留六层是**过渡状态**，不是最终架构。已消除最明显的重复装饰和侧色条；物理清理需要覆盖率与截图基线，不在本批冒险执行。