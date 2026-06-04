# LookMore 历史会话功能 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增独立历史会话页面，用户可查看、继续、删除过往对话

**Architecture:** 新建 pages/history 页面 + 修改 chat 页支持 conversationId 参数。后端 API 已就绪（`GET /api/conversations`、`GET /api/conversations/:id`、`DELETE /api/conversations/:id`），前端 api.js 已有封装。纯前端改动，6 个文件。

**Tech Stack:** 微信小程序原生框架 (Page/WXML/WXSS)，现有 CSS 变量复用 app.wxss 中的 Apple visionOS 主题

---

### Task 1: 注册 history 页面路由

**Files:**
- Modify: `miniprogram/app.json:1-12`

- [ ] **Step 1: 将 history 页面添加到 pages 数组首位**

编辑 `miniprogram/app.json`，在 pages 数组第一项添加 `pages/history/history`：

```json
{
  "pages": [
    "pages/index/index",
    "pages/chat/chat",
    "pages/history/history"
  ],
  "window": {
    "navigationBarBackgroundColor": "#EFEBE9",
    "navigationBarTitleText": "LookMore",
    "navigationBarTextStyle": "black",
    "backgroundColor": "#EFEBE9"
  }
}
```

> 注意：pages 数组中的 index 仍为第一项（小程序的首页入口不变），history 放在最后即可。微信编译器检测到 pages 中添加了新路径后会自动识别页面文件。

- [ ] **Step 2: 验证编译通过**

在微信开发者工具中点击编译，确认无报错（此时 history 页面文件尚未创建，工具会提示缺少文件但不会阻止编译）。

- [ ] **Step 3: Commit**

```bash
git add miniprogram/app.json
git commit -m "feat: register history page route in app.json"
```

---

### Task 2: 创建历史页面模板 (history.wxml)

**Files:**
- Create: `miniprogram/pages/history/history.wxml`

- [ ] **Step 1: 编写 history.wxml**

```html
<view class="container">
  <view class="header">
    <text class="header-title">历史会话</text>
    <view class="header-new-btn" bindtap="onNewChat">
      <text class="header-new-icon">+</text>
    </view>
  </view>

  <scroll-view class="list" scroll-y refresher-enabled refresher-triggered="{{refreshing}}" bindrefresherrefresh="onRefresh">
    <block wx:if="{{list.length > 0}}">
      <view
        class="item-wrapper"
        wx:for="{{list}}"
        wx:key="id"
      >
        <view class="item-delete-btn" catchtap="onDelete" data-id="{{item.id}}">删除</view>
        <view
          class="item-card"
          style="transform: translateX({{item._swipeX || 0}}px); transition: transform {{item._swiping ? '0s' : '0.25s'}};"
          bindtap="onTapItem"
          bindtouchstart="onTouchStart"
          bindtouchmove="onTouchMove"
          bindtouchend="onTouchEnd"
          data-index="{{index}}"
          data-id="{{item.id}}"
        >
          <text class="item-title">{{item.title}}</text>
          <text class="item-arrow">›</text>
        </view>
      </view>
    </block>
    <block wx:elif="{{!loading}}">
      <view class="empty">
        <text class="empty-text">暂无历史会话</text>
      </view>
    </block>
    <block wx:if="{{loading}}">
      <view class="loading">
        <text class="loading-text">加载中...</text>
      </view>
    </block>
  </scroll-view>
</view>
```

- [ ] **Step 2: Commit**

```bash
git add miniprogram/pages/history/history.wxml
git commit -m "feat: add history page template with swipe-to-delete cards"
```

---

### Task 3: 创建历史页面样式 (history.wxss)

**Files:**
- Create: `miniprogram/pages/history/history.wxss`

- [ ] **Step 1: 编写 history.wxss**

```css
.container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--bg);
}

/* ── Header ── */
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px 12px;
  flex-shrink: 0;
}
.header-title {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-primary);
}
.header-new-btn {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-full);
  background: var(--surface-heavy);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow-sm);
}
.header-new-icon {
  font-size: 20px;
  color: var(--primary);
  font-weight: 400;
  line-height: 1;
}

/* ── List ── */
.list {
  flex: 1;
  padding: 0 16px;
}

/* ── Item wrapper (contains hidden delete + card) ── */
.item-wrapper {
  position: relative;
  overflow: hidden;
  margin-bottom: 8px;
  border-radius: var(--radius-md);
}

/* Delete button hidden behind card */
.item-delete-btn {
  position: absolute;
  right: 0;
  top: 0;
  height: 100%;
  width: 64px;
  background: #FF3B30;
  color: #fff;
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
}

/* Card slides over delete button */
.item-card {
  position: relative;
  z-index: 1;
  background: var(--surface-heavy);
  border-radius: var(--radius-md);
  padding: 14px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: var(--shadow-sm);
}
.item-title {
  font-size: 14px;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}
.item-arrow {
  font-size: 16px;
  color: var(--text-placeholder);
  flex-shrink: 0;
  margin-left: 8px;
}

/* ── Empty state ── */
.empty {
  display: flex;
  align-items: center;
  justify-content: center;
  padding-top: 120px;
}
.empty-text {
  font-size: 14px;
  color: var(--text-secondary);
}

/* ── Loading ── */
.loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding-top: 60px;
}
.loading-text {
  font-size: 13px;
  color: var(--text-placeholder);
}
```

- [ ] **Step 2: Commit**

```bash
git add miniprogram/pages/history/history.wxss
git commit -m "feat: add history page styles with Apple visionOS theme"
```

---

### Task 4: 创建历史页面逻辑 (history.js)

**Files:**
- Create: `miniprogram/pages/history/history.js`

- [ ] **Step 1: 编写 history.js**

```javascript
const api = require('../../utils/api');

Page({
  data: {
    list: [],
    loading: true,
    refreshing: false,
  },

  onLoad() {
    this.loadList();
  },

  onShow() {
    this.loadList();
  },

  loadList() {
    api.getConversations()
      .then((res) => {
        const raw = (res && res.conversations) || [];
        const list = raw.map((item) => ({
          id: item.id,
          title: this.formatTitle(item.title || item.firstMessage || ''),
          _swipeX: 0,
          _swiping: false,
        }));
        this.setData({ list, loading: false, refreshing: false });
      })
      .catch(() => {
        this.setData({ loading: false, refreshing: false });
        wx.showToast({ title: '加载失败，下拉重试', icon: 'none' });
      });
  },

  formatTitle(text) {
    if (!text) return '新对话';
    return text.length > 20 ? text.slice(0, 20) + '...' : text;
  },

  onRefresh() {
    this.setData({ refreshing: true });
    this.loadList();
  },

  onNewChat() {
    wx.navigateBack();
  },

  onTapItem(e) {
    const index = e.currentTarget.dataset.index;
    const item = this.data.list[index];
    if (item._swipeX && item._swipeX < 0) {
      this.resetSwipe(index);
      return;
    }
    wx.navigateTo({
      url: '/pages/chat/chat?conversationId=' + encodeURIComponent(item.id),
    });
  },

  resetSwipe(index) {
    this.setData({
      ['list[' + index + ']._swipeX']: 0,
      ['list[' + index + ']._swiping']: false,
    });
  },

  /* ── Swipe-to-delete ── */
  onTouchStart(e) {
    const index = e.currentTarget.dataset.index;
    const list = this.data.list.map((item, i) => ({
      ...item,
      _swiping: i === index,
      _touchStartX: i === index ? e.touches[0].clientX : item._touchStartX,
    }));
    this.setData({ list });
  },

  onTouchMove(e) {
    const index = e.currentTarget.dataset.index;
    const dx = e.touches[0].clientX - this.data.list[index]._touchStartX;
    if (dx > 0) return;
    const swipeX = Math.max(dx, -64);
    this.setData({ ['list[' + index + ']._swipeX']: swipeX });
  },

  onTouchEnd(e) {
    const index = e.currentTarget.dataset.index;
    const item = this.data.list[index];
    const snapX = item._swipeX < -32 ? -64 : 0;
    this.setData({
      ['list[' + index + ']._swipeX']: snapX,
      ['list[' + index + ']._swiping']: false,
    });
  },

  onDelete(e) {
    const id = e.currentTarget.dataset.id;
    const that = this;
    wx.showModal({
      title: '确认删除',
      content: '删除后无法恢复',
      confirmText: '删除',
      confirmColor: '#FF3B30',
      success(res) {
        if (!res.confirm) return;
        api.deleteConversation(id)
          .then(() => {
            that.loadList();
          })
          .catch((err) => {
            wx.showToast({ title: err.message || '删除失败', icon: 'none' });
          });
      },
    });
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add miniprogram/pages/history/history.js
git commit -m "feat: add history page logic with swipe-to-delete and load"
```

---

### Task 5: 修改 chat 页 — 胶囊栏入口 + 接收 conversationId

**Files:**
- Modify: `miniprogram/pages/chat/chat.wxml:6`
- Modify: `miniprogram/pages/chat/chat.js:72-88` (onLoad), 新增 onHistoryTap

- [ ] **Step 1: 修改 chat.wxml 胶囊栏**

将胶囊栏右侧的 `⋯` 替换为 `☰`，并绑定新事件：

```html
<view class="container">
  <view class="topbar">
    <view class="topbar-capsule">
      <text class="topbar-back" bindtap="goBack">←</text>
      <text class="topbar-title">{{currentModelName}}</text>
      <text class="topbar-more" bindtap="onHistoryTap">☰</text>
    </view>
  </view>
```

> 其余部分保持不变。

- [ ] **Step 2: 修改 chat.js — onLoad 支持 conversationId**

将 `onLoad` 方法从：

```javascript
onLoad(options) {
    if (options.model) {
      const modelId = options.model;
      const modelName = app.globalData.currentModel || modelId;
      this.setData({
        currentModelId: modelId,
        currentModelName: modelName,
      });
    }
    const sys = wx.getSystemInfoSync();
      this.setData({ isDesktop: sys.platform === 'mac' || sys.platform === 'windows' });
    this.loadUserAvatar();
    this._onKeyboardChange = (res) => { this.setData({ keyboardHeight: res.height }); this.scrollBottom(); };
    wx.onKeyboardHeightChange(this._onKeyboardChange);
    let msg = options.message || '';
    try { msg = decodeURIComponent(msg); } catch (e) {}
    if (msg) this.sendMessage(msg);
  },
```

替换为：

```javascript
onLoad(options) {
    if (options.model) {
      const modelId = options.model;
      const modelName = app.globalData.currentModel || modelId;
      this.setData({
        currentModelId: modelId,
        currentModelName: modelName,
      });
    } else {
      this.setData({
        currentModelId: app.globalData.currentModelId || 'gpt-5.5',
        currentModelName: app.globalData.currentModel || 'GPT-5.5',
      });
    }
    const sys = wx.getSystemInfoSync();
    this.setData({ isDesktop: sys.platform === 'mac' || sys.platform === 'windows' });
    this.loadUserAvatar();
    this._onKeyboardChange = (res) => { this.setData({ keyboardHeight: res.height }); this.scrollBottom(); };
    wx.onKeyboardHeightChange(this._onKeyboardChange);

    if (options.conversationId) {
      this.loadConversation(options.conversationId);
      return;
    }

    let msg = options.message || '';
    try { msg = decodeURIComponent(msg); } catch (e) {}
    if (msg) this.sendMessage(msg);
  },
```

- [ ] **Step 3: 新增 loadConversation 方法**

在 `chat.js` 的 `Page({})` 对象中（`goBack()` 方法之后）添加：

```javascript
loadConversation(conversationId) {
    const that = this;
    this.setData({ conversationId: conversationId });
    api.getConversation(conversationId)
      .then((res) => {
        const messages = (res && res.conversation && res.conversation.messages) || [];
        const formatted = messages.map((msg) => ({
          role: msg.role,
          content: msg.content || '',
          htmlContent: msg.role === 'assistant' ? markdownToHtml(msg.content || '') : '',
          plainContent: msg.role === 'assistant' ? markdownToPlainText(msg.content || '') : '',
          imageUrl: msg.imageUrl || null,
        }));
        that.setData({ messages: formatted });
        that.scrollBottom();
      })
      .catch((err) => {
        wx.showToast({ title: '加载对话失败', icon: 'none' });
        console.error('loadConversation error:', err);
      });
  },
```

- [ ] **Step 4: 新增 onHistoryTap 方法**

在同一位置添加：

```javascript
onHistoryTap() {
    wx.navigateTo({ url: '/pages/history/history' });
  },
```

- [ ] **Step 5: 验证括号平衡**

检查 chat.js 所有 `{` 和 `}` 数量一致（112 个 `{` → 112 个 `}`）。

- [ ] **Step 6: Commit**

```bash
git add miniprogram/pages/chat/chat.wxml miniprogram/pages/chat/chat.js
git commit -m "feat: add history entry button and conversationId loading to chat page"
```

---

### Task 6: 端到端验证

**Files:** 无新文件

- [ ] **Step 1: 编译检查**

在微信开发者工具中点击编译，确认无报错、无警告。

- [ ] **Step 2: 验证新对话流程**

首页输入消息 → 进入 chat 页 → 确认消息正常发送和接收 → 确认胶囊栏显示 `☰`。

- [ ] **Step 3: 验证历史入口**

chat 页点击 `☰` → 进入 history 页 → 确认刚刚的对话出现在列表中。

- [ ] **Step 4: 验证继续对话**

history 页点击一条会话 → 进入 chat 页 → 确认历史消息加载 → 发送新消息 → 确认对话延续。

- [ ] **Step 5: 验证删除**

history 页左滑一条会话 → 点击删除 → 确认 → 确认列表刷新后该会话消失。

- [ ] **Step 6: 验证空状态**

删除所有会话后 → history 页显示 "暂无历史会话"。

- [ ] **Step 7: 验证新建对话**

history 页点击 `+` → 回到首页 → 输入新消息 → 进入新对话。

---

### 文件变更总览

| 操作 | 文件 |
|------|------|
| 修改 | `miniprogram/app.json` |
| 新建 | `miniprogram/pages/history/history.wxml` |
| 新建 | `miniprogram/pages/history/history.wxss` |
| 新建 | `miniprogram/pages/history/history.js` |
| 修改 | `miniprogram/pages/chat/chat.wxml` |
| 修改 | `miniprogram/pages/chat/chat.js` |
