# LookMore 历史会话功能 — 设计规范

> **关联计划:** 将通过 writing-plans 创建实施计划

**目标:** 允许用户在微信小程序中查看、继续、删除历史对话

**架构:** 新建独立 history 页面，通过 chat 页胶囊栏入口进入。后端 API 已就绪，前端 api.js 已有对应封装，仅需新建页面和修改 chat 页导航。

**技术栈:** 微信小程序原生框架 (Page/WXML/WXSS)，Node.js Express 后端 (已有)

---

## 1. 入口设计

- **位置:** chat 页顶部浮动胶囊栏右侧
- **图标:** 将现有 `⋯` 替换为 `☰`（三条横线菜单图标）
- **行为:** 点击 `☰` → `wx.navigateTo('/pages/history/history')`

## 2. 历史会话页面 (pages/history)

### 2.1 页面布局

```
┌─────────────────────────────┐
│  历史会话               [+] │  ← 标题 + 新建按钮
├─────────────────────────────┤
│  ┌───────────────────────┐  │
│  │ 第一条用户消息截断...   › │  │  ← 会话卡片
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │ 第二条用户消息截断...   › │  │
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │ 第三条用户消息截断...   › │  │
│  └───────────────────────┘  │
│                             │
│      暂无历史会话           │  ← 空状态 (列表为空时)
└─────────────────────────────┘
```

### 2.2 列表项信息

- **标题:** 该会话第一条用户消息，超过 20 字时截断加 `...`
- **不需要:** 模型名称、时间戳、消息预览

### 2.3 交互

| 操作 | 行为 |
|------|------|
| **点击卡片** | `wx.navigateTo` 跳转 chat 页，传入 `conversationId`，chat 页加载历史消息 |
| **左滑卡片** | 显示红色删除按钮，点击后弹确认框，确认则调用 `DELETE /api/conversations/:id` |
| **点击 +** | `wx.navigateBack` 回到首页，开始新对话 |
| **下拉** | 触发列表刷新 |

### 2.4 状态处理

- **加载中:** 显示 loading 样式
- **空列表:** 显示 "暂无历史会话" 居中提示
- **删除失败:** toast 提示错误信息
- **加载失败:** toast 提示重试

## 3. Chat 页改动

### 3.1 胶囊栏

- 将现有 `⋯` 替换为 `☰`
- 新增 `onHistoryTap` 方法 → `wx.navigateTo({ url: '/pages/history/history' })`

### 3.2 接收 conversationId 参数

- `onLoad(options)` 中检查 `options.conversationId`
- 如果传入 conversationId：
  - 调用 `GET /api/conversations/:id` 获取历史消息
  - 将消息渲染到聊天列表
  - 用户可继续发送新消息（使用已有 conversationId）
- 如果未传入 conversationId：
  - 保持现有行为（新对话，conversationId 由首次消息返回）

## 4. 导航流程

```
首页(index)
  │
  └─ 输入消息 → chat页?model=xxx&message=xxx (新对话)
                    │
                    ├─ 首次消息返回 conversationId
                    ├─ 点 ☰ → history页
                    │           │
                    │           ├─ 点会话 → chat页?conversationId=xxx&model=xxx
                    │           ├─ 左滑 → 确认删除 → 刷新列表
                    │           └─ 点 + → wx.navigateBack → 首页
                    │
                    └─ ← 返回首页
```

## 5. 后端接口 (已就绪)

| 端点 | 方法 | 用途 |
|------|------|------|
| `/api/conversations` | GET | 获取会话列表 |
| `/api/conversations/:id` | GET | 获取会话消息 |
| `/api/conversations/:id` | DELETE | 删除会话 |

## 6. 文件变更清单

| 操作 | 文件 | 说明 |
|------|------|------|
| 新建 | `miniprogram/pages/history/history.js` | 页面逻辑 |
| 新建 | `miniprogram/pages/history/history.wxml` | 页面模板 |
| 新建 | `miniprogram/pages/history/history.wxss` | 页面样式 |
| 修改 | `miniprogram/pages/chat/chat.wxml` | 胶囊栏 ☰ 图标 |
| 修改 | `miniprogram/pages/chat/chat.js` | 新增 history 跳转 + 接收 conversationId |
| 修改 | `miniprogram/app.json` | 注册 history 页面路由 |
