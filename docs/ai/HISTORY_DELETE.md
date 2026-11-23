# 历史对话单条删除入口

> 日期：2026-11-23  
> 代码提交：`0029786`  
> 完整 diff：[HISTORY_DELETE_DIFF.patch](HISTORY_DELETE_DIFF.patch)  
> 截图：[桌面](../screenshots/history-delete.png) · [移动端](../screenshots/history-delete-mobile.png)

## 问题

历史页原来有垃圾桶图标，也有确认弹窗和持久化删除；但图标只有 30px、没有文字，实际很难被发现，用户会认为“没有办法删除”。

## 修改

历史卡片右侧的图标按钮改为明确的 **“删除”** 按钮：

> 2026-11-23 后续：侧栏“RECENT / 最近”也增加了可见删除按钮，支持聚焦后按 `Delete`/`Backspace`，详见 [WORKBENCH_CHAT.md](WORKBENCH_CHAT.md)。

```text
[调整标题] [收藏] [🗑 删除]
```

- 桌面：58×30px，带边框、垃圾桶图标和文字。
- 移动端：66×44px，符合触控目标。
- 悬停：砖红文字、淡红底、红色边框。
- `aria-label` 为“删除对话：{标题}”，读屏能点名具体对话。
- 保留原有确认弹窗：显示对话标题、删除范围、取消/确认。
- 保留原删除链路：`delete-conv` → 确认 → localStorage + IndexedDB → 刷新不恢复。
- 批量“删除所选”不变。

## 验证

```text
E2E 103 passed / 0 failed
  · 删除键存在
  · 文案包含“删除”
  · 390px 下高度 ≥44px
  · 确认弹窗包含“删除这条对话”
  · 删除后卡片数 -1
  · 刷新后仍为删除状态

P0 专用回归        PASS
32 路由            0 console error / 0 failed request / 0 溢出
7 档宽度           无横向溢出
单元测试           100 passed
文件解析           18 passed
```

## 文件

- `js/app.js`：删除按钮标记与读屏名称
- `assets/components.css`：可见删除按钮、移动端 44px、悬停/按压
- `tests/e2e.smoke.mjs`：6 项删除入口断言
- `docs/screenshots/history-delete.png`
- `docs/screenshots/history-delete-mobile.png`

## 边界

- 删除仍是本机删除，不同步、不影响专业数据库或课程知识包。
- 没有做“回收站/撤销”；删除前有确认弹窗。
- 批量删除仍通过复选框 + “删除所选”完成。