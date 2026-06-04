# LookMore 动森露营手作风格前端重设计 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 LookMore 微信小程序前端重写为 Animal Crossing 露营手作风格，2 个页面（首页 + 对话页）。

**Architecture:** 全局样式 app.wxss 定义配色/字体/圆角变量，首页负责 Logo 展示 + 模型选择 + 发送入口，对话页负责消息气泡渲染 + API 交互。模型列表前端硬编码，下拉菜单实现在首页内。

**Tech Stack:** 微信小程序原生框架（WXML + WXSS + JS），无额外依赖。

---

## 文件结构

| 文件 | 操作 | 职责 |
|------|------|------|
| `miniprogram/app.wxss` | 重写 | 全局动森配色、字体、圆角变量 |
| `miniprogram/app.json` | 修改 | 移除 models 页面注册 |
| `miniprogram/app.js` | 修改 | 精简 globalData |
| `miniprogram/pages/index/index.wxml` | 重写 | 首页模板：Logo + 对话框 + 模型选择 + 下拉菜单 |
| `miniprogram/pages/index/index.wxss` | 重写 | 首页样式 |
| `miniprogram/pages/index/index.js` | 重写 | 首页逻辑：模型切换、下拉菜单、发送跳转 |
| `miniprogram/pages/index/index.json` | 不变 | 页面配置 |
| `miniprogram/pages/chat/chat.wxml` | 重写 | 对话页模板：顶部栏 + 头像消息 + 输入区 |
| `miniprogram/pages/chat/chat.wxss` | 重写 | 对话页样式 |
| `miniprogram/pages/chat/chat.js` | 重写 | 对话页逻辑：发消息、收回复、头像获取 |
| `miniprogram/pages/chat/chat.json` | 不变 | 页面配置 |
| `miniprogram/pages/models/` (4 文件) | 删除 | 不再需要独立模型页 |
| `miniprogram/utils/api.js` | 保留 | API 调用层不变 |
| `miniprogram/images/avatar.png` | 新增 | 复制小程序头像到资源目录 |

---

### Task 1: 复制头像资源 + 清理 models 页面

**Files:**
- Create: `miniprogram/images/avatar.png`
- Delete: `miniprogram/pages/models/models.js`
- Delete: `miniprogram/pages/models/models.json`
- Delete: `miniprogram/pages/models/models.wxml`
- Delete: `miniprogram/pages/models/models.wxss`
- Modify: `miniprogram/app.json`

- [ ] **Step 1: 复制小程序头像到 miniprogram 资源目录**

```bash
mkdir -p miniprogram/images
cp "/Users/wenglianfeng/Pictures/LookMore微信小程序/小程序头像.png" miniprogram/images/avatar.png
```

验证：`ls -la miniprogram/images/avatar.png` 应显示文件存在。

- [ ] **Step 2: 删除 models 页面文件**

```bash
rm miniprogram/pages/models/models.js
rm miniprogram/pages/models/models.json
rm miniprogram/pages/models/models.wxml
rm miniprogram/pages/models/models.wxss
rmdir miniprogram/pages/models
```

- [ ] **Step 3: 修改 app.json，移除 models 页面注册**

编辑 `miniprogram/app.json`，将 pages 数组从 3 个减为 2 个：

```json
{
  "pages": [
    "pages/index/index",
    "pages/chat/chat"
  ],
  "window": {
    "navigationBarBackgroundColor": "#EFEBE9",
    "navigationBarTitleText": "LookMore",
    "navigationBarTextStyle": "black",
    "backgroundColor": "#EFEBE9"
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add miniprogram/images/avatar.png miniprogram/app.json
git rm miniprogram/pages/models/models.js miniprogram/pages/models/models.json miniprogram/pages/models/models.wxml miniprogram/pages/models/models.wxss
git commit -m "feat: copy avatar asset, remove models page"
```

---

### Task 2: 重写全局样式 app.wxss

**Files:**
- Modify: `miniprogram/app.wxss`

- [ ] **Step 1: 写入全局样式**

将 `miniprogram/app.wxss` 内容替换为：

```css
/* 动森露营手作风格 — 全局配色 */
page {
  --bg: #EFEBE9;
  --card: #FFFFFF;
  --green: #A5D6A7;
  --green-deep: #81C784;
  --clay: #BCAAA4;
  --cream: #FFF9C4;
  --wood-dark: #4E342E;
  --wood-light: #8D6E63;
  --border-light: #D7CCC8;
  --border-green: #C8E6C9;

  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background-color: var(--bg);
  font-size: 14px;
  color: var(--wood-dark);
}

/* Caveat 字体仅用于品牌名 LookMore — 通过 wx.loadFontFace 在首页动态加载 */
```

验证：在微信开发者工具中打开项目，页面背景应为 `#EFEBE9` 亚麻灰色。

- [ ] **Step 2: Commit**

```bash
git add miniprogram/app.wxss
git commit -m "feat: AC camping global styles with CSS variables"
```

---

### Task 3: 重写首页 index（WXML + 模型数据）

**Files:**
- Modify: `miniprogram/pages/index/index.wxml`
- Modify: `miniprogram/pages/index/index.js`
- Modify: `miniprogram/pages/index/index.wxss`
- Modify: `miniprogram/app.js`

- [ ] **Step 1: 精简 app.js 全局数据**

将 `miniprogram/app.js` 替换为：

```js
App({
  globalData: {
    apiBase: 'https://你的服务器域名.com',
    currentModel: 'GPT-5.5',
  },
});
```

- [ ] **Step 2: 写入首页 WXML 模板**

将 `miniprogram/pages/index/index.wxml` 替换为：

```xml
<view class="container">
  <!-- Logo 区 -->
  <view class="logo-area">
    <view class="avatar-wrap">
      <image class="avatar" src="/images/avatar.png" mode="aspectFill"></image>
      <text class="avatar-badge">🍃</text>
    </view>
    <text class="brand-name">LookMore</text>
    <text class="brand-sub">撸猫 AI 助手</text>
  </view>

  <!-- 对话框 -->
  <view class="dialog-card">
    <text class="dialog-deco-top">🪵</text>
    <text class="dialog-deco-bottom">🏕️</text>
    <view class="dialog-inner">
      <input class="dialog-input" value="{{inputText}}" bindinput="onInput" placeholder="输入你想问的问题..." confirm-type="send" bindconfirm="sendMessage"/>
      <view class="dialog-send" bindtap="sendMessage">↑</view>
    </view>
  </view>

  <!-- 模型选择 -->
  <view class="model-area">
    <view class="model-btn" bindtap="toggleMenu">
      <text class="model-icon">🍃</text> {{selectedModel}} ▾
    </view>

    <!-- 下拉菜单 -->
    <view wx:if="{{menuOpen}}" class="menu-mask" bindtap="closeMenu"></view>
    <view wx:if="{{menuOpen}}" class="menu-dropdown">
      <view class="menu-group-title">🌱 基础模型</view>
      <view wx:for="{{basicModels}}" wx:key="id" class="menu-item {{selectedModel === item.name ? 'active' : ''}}" bindtap="selectModel" data-name="{{item.name}}">{{item.name}}</view>
      <view class="menu-group-title">🌳 增强模型</view>
      <view wx:for="{{enhancedModels}}" wx:key="id" class="menu-item {{selectedModel === item.name ? 'active' : ''}}" bindtap="selectModel" data-name="{{item.name}}">{{item.name}}</view>
    </view>
  </view>
</view>
```

- [ ] **Step 3: 写入首页 JS 逻辑**

将 `miniprogram/pages/index/index.js` 替换为：

```js
const app = getApp();

const BASIC_MODELS = [
  { id: 'gpt-5.4-mini', name: 'GPT-5.4-mini', provider: 'openai', category: 'chat' },
  { id: 'gpt-4.1-mini', name: 'GPT-4.1 mini', provider: 'openai', category: 'chat' },
  { id: 'gemini-3-flash-preview', name: 'Gemini-3-flash', provider: 'google', category: 'chat' },
  { id: 'gpt-image-2', name: 'GPT-image-2', provider: 'openai', category: 'image' },
  { id: 'gemini-3.1-flash-image-preview', name: 'Nano Banan 2', provider: 'google', category: 'image' },
];

const ENHANCED_MODELS = [
  { id: 'gpt-5.5', name: 'GPT-5.5', provider: 'openai', category: 'chat' },
  { id: 'gpt-5.4', name: 'GPT-5.4', provider: 'openai', category: 'chat' },
  { id: 'gemini-2.5-pro', name: 'Gemini-2.5-pro', provider: 'google', category: 'chat' },
  { id: 'gemini-3.1-pro-preview', name: 'Gemini-3.1-pro', provider: 'google', category: 'chat' },
  { id: 'claude-opus-4-6', name: 'Claude-Opus-4.6', provider: 'anthropic', category: 'code' },
  { id: 'claude-opus-4-7', name: 'Claude-Opus-4.7', provider: 'anthropic', category: 'code' },
  { id: 'claude-sonnet-4-6', name: 'Claude-Sonnet-4.6', provider: 'anthropic', category: 'code' },
  { id: 'gemini-3-pro-image', name: 'Nano Banan Pro', provider: 'google', category: 'image' },
];

Page({
  data: {
    inputText: '',
    selectedModel: 'GPT-5.5',
    basicModels: BASIC_MODELS,
    enhancedModels: ENHANCED_MODELS,
    menuOpen: false,
  },
  onLoad() {
    const saved = app.globalData.currentModel;
    if (saved) this.setData({ selectedModel: saved });
    this.loadFont();
  },
  loadFont() {
    wx.loadFontFace({
      family: 'Caveat',
      source: 'url("https://fonts.gstatic.com/s/caveat/v18/WnznHAc5bAfYB2QRah7pcpNvOx-pjfJ9eIWpZA.ttf")',
      success: () => console.log('Caveat font loaded'),
    });
  },
  onInput(e) {
    this.setData({ inputText: e.detail.value });
  },
  toggleMenu() {
    this.setData({ menuOpen: !this.data.menuOpen });
  },
  closeMenu() {
    this.setData({ menuOpen: false });
  },
  selectModel(e) {
    const name = e.currentTarget.dataset.name;
    this.setData({ selectedModel: name, menuOpen: false });
    app.globalData.currentModel = name;
  },
  sendMessage() {
    const text = this.data.inputText.trim();
    if (!text) return;
    app.globalData.currentModel = this.data.selectedModel;
    wx.navigateTo({
      url: '/pages/chat/chat?model=' + encodeURIComponent(this.data.selectedModel) + '&message=' + encodeURIComponent(text),
    });
  },
});
```

- [ ] **Step 4: 写入首页 WXSS 样式**

将 `miniprogram/pages/index/index.wxss` 替换为：

```css
.container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 60px 24px 40px;
}

/* Logo */
.logo-area {
  text-align: center;
  margin-bottom: 28px;
}
.avatar-wrap {
  position: relative;
  width: 72px; height: 72px;
  margin: 0 auto 10px;
}
.avatar {
  width: 72px; height: 72px;
  border-radius: 50%;
  border: 3px solid var(--green);
  box-sizing: border-box;
}
.avatar-badge {
  position: absolute;
  top: -8px;
  right: -8px;
  font-size: 18px;
}
.brand-name {
  display: block;
  font-family: 'Caveat', cursive;
  font-size: 36px;
  font-weight: 700;
  color: var(--wood-dark);
  line-height: 1.3;
}
.brand-sub {
  display: block;
  font-size: 11px;
  color: var(--wood-light);
}

/* 对话框 */
.dialog-card {
  width: 260px;
  position: relative;
  background: var(--card);
  border-radius: 18px;
  border: 2px solid var(--border-green);
  padding: 12px 14px;
  margin-bottom: 14px;
  box-sizing: border-box;
}
.dialog-deco-top {
  position: absolute;
  top: -12px;
  left: 10px;
  font-size: 16px;
  z-index: 1;
}
.dialog-deco-bottom {
  position: absolute;
  bottom: -10px;
  right: 12px;
  font-size: 14px;
}
.dialog-inner {
  display: flex;
  align-items: center;
  gap: 6px;
}
.dialog-input {
  flex: 1;
  border: none;
  outline: none;
  font-size: 13px;
  background: transparent;
  color: var(--wood-dark);
}
.dialog-send {
  width: 26px; height: 26px;
  border-radius: 50%;
  background: var(--green);
  color: #fff;
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

/* 模型选择 */
.model-area { position: relative; }
.model-btn {
  background: var(--green);
  border-radius: 12px;
  padding: 6px 12px;
  font-size: 11px;
  font-weight: bold;
  color: #33691E;
  white-space: nowrap;
}
.model-icon { margin-right: 2px; }

/* 下拉菜单 */
.menu-mask {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  z-index: 10;
}
.menu-dropdown {
  position: absolute;
  top: 36px;
  left: 50%;
  transform: translateX(-50%);
  background: #fff;
  border-radius: 14px;
  padding: 8px 0;
  box-shadow: 0 4px 16px rgba(0,0,0,0.1);
  z-index: 11;
  min-width: 200px;
}
.menu-group-title {
  padding: 6px 14px 2px;
  font-size: 11px;
  color: var(--wood-light);
}
.menu-item {
  padding: 8px 14px;
  font-size: 13px;
  color: var(--wood-dark);
}
.menu-item.active {
  background: #E8F5E9;
  color: #33691E;
}
```

- [ ] **Step 5: Commit**

```bash
git add miniprogram/app.js miniprogram/pages/index/index.wxml miniprogram/pages/index/index.js miniprogram/pages/index/index.wxss
git commit -m "feat: rewrite homepage with AC style, logo, dialog, model dropdown"
```

---

### Task 4: 重写对话页 chat（WXML + JS + WXSS）

**Files:**
- Modify: `miniprogram/pages/chat/chat.wxml`
- Modify: `miniprogram/pages/chat/chat.js`
- Modify: `miniprogram/pages/chat/chat.wxss`

- [ ] **Step 1: 写入对话页 WXML 模板**

将 `miniprogram/pages/chat/chat.wxml` 替换为：

```xml
<view class="container">
  <!-- 顶部栏 -->
  <view class="topbar">
    <text class="topbar-back" bindtap="goBack">🍃 ←</text>
    <text class="topbar-model">{{currentModel}}</text>
    <text class="topbar-deco">🪵</text>
  </view>

  <!-- 消息列表 -->
  <scroll-view class="messages" scroll-y scroll-into-view="{{scrollToId}}" scroll-with-animation>
    <block wx:for="{{messages}}" wx:key="index">
      <view class="msg-row {{item.role}}" id="msg-{{index}}">
        <!-- AI 头像 -->
        <image wx:if="{{item.role === 'assistant'}}" class="msg-avatar ai-avatar" src="/images/avatar.png" mode="aspectFill"></image>
        <view class="msg-body {{item.role}}">
          <text class="msg-name">{{item.role === 'assistant' ? 'LookMore 助手' : '我'}}</text>
          <view class="bubble {{item.role}}">
            <text>{{item.content}}</text>
          </view>
        </view>
        <!-- 用户头像 -->
        <image wx:if="{{item.role === 'user'}}" class="msg-avatar user-avatar" src="{{userAvatar}}" mode="aspectFill"></image>
      </view>
    </block>
    <view wx:if="{{loading}}" class="msg-row assistant">
      <image class="msg-avatar ai-avatar" src="/images/avatar.png" mode="aspectFill"></image>
      <view class="msg-body assistant">
        <text class="msg-name">LookMore 助手</text>
        <view class="bubble assistant loading-bubble">正在输入...</view>
      </view>
    </view>
    <view id="msg-bottom"></view>
  </scroll-view>

  <!-- 底部输入区 -->
  <view class="input-area">
    <input class="input-box" value="{{inputText}}" bindinput="onInput" placeholder="输入消息..." confirm-type="send" bindconfirm="send"/>
    <view class="send-btn" bindtap="send">↑</view>
  </view>
</view>
```

- [ ] **Step 2: 写入对话页 JS 逻辑**

将 `miniprogram/pages/chat/chat.js` 替换为：

```js
const api = require('../../utils/api');
const app = getApp();

Page({
  data: {
    conversationId: null,
    messages: [],
    inputText: '',
    currentModel: 'GPT-5.5',
    userAvatar: '',
    loading: false,
    scrollToId: '',
  },
  onLoad(options) {
    if (options.model) this.setData({ currentModel: options.model });
    this.loadUserAvatar();
    const msg = options.message;
    if (msg) this.sendMessage(msg);
  },
  loadUserAvatar() {
    const that = this;
    wx.getUserInfo({
      success(res) {
        that.setData({ userAvatar: res.userInfo.avatarUrl || '' });
      },
      fail() {
        that.setData({ userAvatar: '/images/avatar.png' });
      },
    });
  },
  onInput(e) {
    this.setData({ inputText: e.detail.value });
  },
  goBack() {
    wx.navigateBack();
  },
  sendMessage(text) {
    const msg = text || this.data.inputText.trim();
    if (!msg) return;

    const newMessages = [...this.data.messages, { role: 'user', content: msg }];
    this.setData({ messages: newMessages, inputText: '', loading: true });
    this.scrollBottom();

    api.sendChat(this.data.conversationId, this.data.currentModel, msg, [])
      .then((res) => {
        const withReply = [...this.data.messages, { role: 'user', content: msg }];
        withReply.push({ role: 'assistant', content: res.reply || '' });
        this.setData({
          messages: withReply,
          conversationId: res.conversationId,
          loading: false,
        });
        this.scrollBottom();
      })
      .catch((err) => {
        wx.showToast({ title: err.message || '发送失败', icon: 'none' });
        const fallback = [...this.data.messages, { role: 'user', content: msg }];
        fallback.push({ role: 'assistant', content: '抱歉，请求失败，请重试。' });
        this.setData({ messages: fallback, loading: false });
      });
  },
  send() {
    this.sendMessage();
  },
  scrollBottom() {
    setTimeout(() => this.setData({ scrollToId: 'msg-bottom' }), 100);
  },
});
```

- [ ] **Step 3: 写入对话页 WXSS 样式**

将 `miniprogram/pages/chat/chat.wxss` 替换为：

```css
.container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--bg);
}

/* 顶部栏 */
.topbar {
  display: flex;
  align-items: center;
  padding: 12px 14px;
  background: var(--bg);
  border-bottom: 1px solid var(--border-light);
  gap: 10px;
}
.topbar-back {
  font-size: 15px;
  color: var(--wood-dark);
}
.topbar-model {
  flex: 1;
  font-size: 12px;
  color: var(--wood-light);
}
.topbar-deco {
  font-size: 14px;
}

/* 消息区 */
.messages {
  flex: 1;
  padding: 12px 14px;
  overflow-y: auto;
}
.msg-row {
  display: flex;
  margin-bottom: 16px;
  gap: 10px;
}
.msg-row.user {
  flex-direction: row-reverse;
}
.msg-row.assistant {
  flex-direction: row;
}

.msg-avatar {
  width: 40px; height: 40px;
  border-radius: 50%;
  flex-shrink: 0;
}
.ai-avatar {
  border: 3px solid var(--green);
}
.user-avatar {
  border: 3px solid #FFB74D;
}

.msg-body {
  max-width: 65%;
}
.msg-body.user {
  align-items: flex-end;
  text-align: right;
}
.msg-body.assistant {
  align-items: flex-start;
}

.msg-name {
  display: block;
  font-size: 10px;
  color: var(--wood-light);
  margin-bottom: 3px;
}

.bubble {
  padding: 8px 12px;
  border-radius: 14px;
  font-size: 13px;
  line-height: 1.6;
  word-break: break-all;
}
.bubble.user {
  background: var(--green);
  color: #33691E;
  border-bottom-right-radius: 4px;
}
.bubble.assistant {
  background: #fff;
  color: var(--wood-dark);
  border: 1px solid #E8F5E9;
  border-bottom-left-radius: 4px;
}
.loading-bubble {
  color: #999;
}

/* 输入区 */
.input-area {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px 16px;
  background: #fff;
  border-top: 1px solid var(--border-light);
}
.input-box {
  flex: 1;
  height: 34px;
  padding: 0 12px;
  border-radius: 16px;
  border: 1px solid #E8E8E8;
  font-size: 13px;
  background: #fff;
}
.send-btn {
  width: 26px; height: 26px;
  border-radius: 50%;
  background: var(--green);
  color: #fff;
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
```

- [ ] **Step 4: Commit**

```bash
git add miniprogram/pages/chat/chat.wxml miniprogram/pages/chat/chat.js miniprogram/pages/chat/chat.wxss
git commit -m "feat: rewrite chat page with AC style, avatars, top bar"
```

---

### Task 5: 端到端验证

- [ ] **Step 1: 确认所有文件就位**

```bash
find miniprogram -type f -not -name ".DS_Store" | sort
```

预期输出（无 models 目录，有 images/avatar.png）：

```
miniprogram/app.js
miniprogram/app.json
miniprogram/app.wxss
miniprogram/images/avatar.png
miniprogram/pages/chat/chat.js
miniprogram/pages/chat/chat.json
miniprogram/pages/chat/chat.wxml
miniprogram/pages/chat/chat.wxss
miniprogram/pages/index/index.js
miniprogram/pages/index/index.json
miniprogram/pages/index/index.wxml
miniprogram/pages/index/index.wxss
miniprogram/utils/api.js
```

- [ ] **Step 2: 在微信开发者工具中验证**

1. 打开项目 → 首页应显示亚麻灰背景 + 居中头像 + Caveat 手写体 LookMore
2. 输入框 + 发送按钮 + 模型选择按钮
3. 点击模型按钮 → 下拉菜单出现，分基础/增强两组，点击切换
4. 输入文字点发送 → 跳转对话页，顶部栏有 🍃 ← 和 🪵
5. 用户气泡在右（绿色），AI 气泡在左（白色），各有 40px 头像 + 名称
6. 实际发送到后端 API → 收到回复

- [ ] **Step 3: Commit 最终调整**

```bash
git add -A
git commit -m "chore: final verification, ensure all files correct"
```
