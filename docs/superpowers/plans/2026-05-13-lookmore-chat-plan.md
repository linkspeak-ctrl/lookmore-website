# Lookmore撸猫 —— 微信AI聊天小程序 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个微信小程序，通过 Node.js 后端代理接入 lazymanchat.com，支持20+个AI模型切换的聊天应用。

**Architecture:** 微信小程序（3页面）→ 阿里云ECS Node.js 后端（Express + JSON文件存储）→ lazymanchat.com 内部API。后端维护共享登录态，前端免登录。

**Tech Stack:** 微信小程序原生框架（WXML/WXSS/JS）、Node.js 18+、Express 4.x、better-sqlite3（可选，默认用JSON文件存储）

---

## 文件结构

```
lookmore-chat/
├── server/
│   ├── package.json          # 依赖声明
│   ├── .env.example          # 环境变量模板
│   ├── index.js              # Express 入口，启动服务器
│   ├── config.js             # 读取环境变量，导出配置
│   ├── store.js              # 对话 CRUD（JSON 文件存储）
│   ├── lazymanchat.js        # lazymanchat.com API 客户端（登录、模型列表、聊天）
│   └── routes.js             # Express 路由（/api/models, /api/chat, /api/conversations）
├── miniprogram/
│   ├── app.js                # 小程序入口，全局数据
│   ├── app.json              # 页面路由、窗口配置
│   ├── app.wxss              # 全局样式
│   ├── project.config.json   # 微信开发者工具配置
│   ├── utils/
│   │   └── api.js            # 封装 wx.request，统一请求后端
│   └── pages/
│       ├── index/            # 对话列表页
│       │   ├── index.js
│       │   ├── index.json
│       │   ├── index.wxml
│       │   └── index.wxss
│       ├── chat/             # 聊天页
│       │   ├── chat.js
│       │   ├── chat.json
│       │   ├── chat.wxml
│       │   └── chat.wxss
│       └── models/           # 模型选择页
│           ├── models.js
│           ├── models.json
│           ├── models.wxml
│           └── models.wxss
```

---

### Task 1: 项目骨架搭建

**Files:**
- Create: `server/package.json`
- Create: `server/.env.example`
- Create: `miniprogram/project.config.json`

- [ ] **Step 1: 创建 server/package.json**

```json
{
  "name": "lookmore-chat-server",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "start": "node index.js",
    "dev": "node --watch index.js"
  },
  "dependencies": {
    "express": "^4.21.0",
    "dotenv": "^16.4.0",
    "node-fetch": "^3.3.2"
  }
}
```

- [ ] **Step 2: 安装后端依赖**

```bash
cd server && npm install
```

- [ ] **Step 3: 创建 server/.env.example**

```
PORT=3000
LAZYMANCHAT_EMAIL=your-email@example.com
LAZYMANCHAT_PASSWORD=your-password
LAZYMANCHAT_BASE_URL=https://lazymanchat.com
```

- [ ] **Step 4: 创建 miniprogram/project.config.json**

```json
{
  "appid": "你的小程序AppID",
  "projectname": "lookmore-chat",
  "miniprogramRoot": "miniprogram/",
  "compileType": "miniprogram",
  "libVersion": "3.6.0",
  "setting": {
    "urlCheck": true,
    "es6": true,
    "postcss": true,
    "minified": true
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add server/package.json server/.env.example miniprogram/project.config.json
git commit -m "feat: project scaffolding for Lookmore chat"
```

---

### Task 2: 后端配置与 Express 服务器启动

**Files:**
- Create: `server/config.js`
- Create: `server/index.js`

- [ ] **Step 1: 创建 server/config.js**

```javascript
require('dotenv').config();

const config = {
  port: parseInt(process.env.PORT, 10) || 3000,
  lazymanchat: {
    baseUrl: process.env.LAZYMANCHAT_BASE_URL || 'https://lazymanchat.com',
    email: process.env.LAZYMANCHAT_EMAIL || '',
    password: process.env.LAZYMANCHAT_PASSWORD || '',
  },
  dataDir: process.env.DATA_DIR || './data',
};

module.exports = config;
```

- [ ] **Step 2: 创建 server/index.js**

```javascript
const express = require('express');
const config = require('./config');
const { initStore } = require('./store');
const { initLazymanchat } = require('./lazymanchat');
const routes = require('./routes');

const app = express();
app.use(express.json({ limit: '50mb' }));

app.use('/api', routes);

async function start() {
  initStore();
  await initLazymanchat();
  app.listen(config.port, () => {
    console.log(`Lookmore server running on port ${config.port}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
```

- [ ] **Step 3: 验证服务器启动**

```bash
cd server && node -e "require('./config'); console.log('config OK');"
```

预期输出：`config OK`

- [ ] **Step 4: Commit**

```bash
git add server/config.js server/index.js
git commit -m "feat: Express server entry with config"
```

---

### Task 3: 对话存储服务

**Files:**
- Create: `server/store.js`

- [ ] **Step 1: 创建 server/store.js**

```javascript
const fs = require('fs');
const path = require('path');
const config = require('./config');

let dataDir;

function initStore() {
  dataDir = config.dataDir;
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const indexPath = path.join(dataDir, 'index.json');
  if (!fs.existsSync(indexPath)) {
    fs.writeFileSync(indexPath, JSON.stringify([], null, 2));
  }
}

function readIndex() {
  const raw = fs.readFileSync(path.join(dataDir, 'index.json'), 'utf-8');
  return JSON.parse(raw);
}

function writeIndex(conversations) {
  fs.writeFileSync(
    path.join(dataDir, 'index.json'),
    JSON.stringify(conversations, null, 2)
  );
}

function createConversation(title) {
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const conversation = {
    id,
    title: title || '新对话',
    model: '',
    messages: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const index = readIndex();
  index.unshift({ id, title: conversation.title, model: '', messageCount: 0, updatedAt: conversation.updatedAt });
  writeIndex(index);
  fs.writeFileSync(path.join(dataDir, `${id}.json`), JSON.stringify(conversation, null, 2));
  return conversation;
}

function getConversation(id) {
  const filePath = path.join(dataDir, `${id}.json`);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function updateConversation(id, updates) {
  const conv = getConversation(id);
  if (!conv) return null;
  Object.assign(conv, updates, { updatedAt: new Date().toISOString() });
  fs.writeFileSync(path.join(dataDir, `${id}.json`), JSON.stringify(conv, null, 2));
  const index = readIndex();
  const entry = index.find((e) => e.id === id);
  if (entry) {
    entry.title = conv.title;
    entry.model = conv.model;
    entry.messageCount = conv.messages.length;
    entry.updatedAt = conv.updatedAt;
    writeIndex(index);
  }
  return conv;
}

function deleteConversation(id) {
  const filePath = path.join(dataDir, `${id}.json`);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  const index = readIndex().filter((e) => e.id !== id);
  writeIndex(index);
}

function listConversations() {
  return readIndex();
}

function addMessage(id, role, content, model) {
  const conv = getConversation(id);
  if (!conv) return null;
  conv.messages.push({
    role,
    content,
    model: model || '',
    timestamp: new Date().toISOString(),
  });
  if (role === 'user' && conv.messages.length === 1) {
    conv.title = content.slice(0, 30);
  }
  return updateConversation(id, { messages: conv.messages, title: conv.title, model });
}

module.exports = {
  initStore,
  createConversation,
  getConversation,
  updateConversation,
  deleteConversation,
  listConversations,
  addMessage,
};
```

- [ ] **Step 2: 验证存储逻辑**

```bash
cd server && node -e "
const s = require('./store');
s.initStore();
const c = s.createConversation('测试对话');
console.log('created:', c.id);
const m = s.addMessage(c.id, 'user', '你好', 'Claude 4.6 Sonnet');
console.log('added message, count:', m.messages.length);
const list = s.listConversations();
console.log('list length:', list.length);
s.deleteConversation(c.id);
console.log('deleted, remaining:', s.listConversations().length);
console.log('store OK');
"
```

预期输出：`store OK`

- [ ] **Step 3: Commit**

```bash
git add server/store.js
git commit -m "feat: conversation store with JSON file persistence"
```

---

### Task 4: lazymanchat.com API 客户端

**Files:**
- Create: `server/lazymanchat.js`

> **注意：** 此模块的具体实现依赖于对 lazymanchat.com 网络请求的实际抓包结果。以下代码基于常见模式编写，开发时需要根据实际抓包调整登录接口路径、请求格式、Cookie处理方式。

- [ ] **Step 1: 创建 server/lazymanchat.js**

```javascript
const config = require('./config');

let sessionCookie = null;
let modelListCache = null;
let lastLoginTime = 0;

async function request(endpoint, options = {}) {
  const url = `${config.lazymanchat.baseUrl}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  if (sessionCookie) {
    headers.Cookie = sessionCookie;
  }
  const res = await fetch(url, {
    ...options,
    headers,
  });
  if (options.raw) return res;
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function login() {
  const res = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: config.lazymanchat.email,
      password: config.lazymanchat.password,
    }),
    raw: true,
  });
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) {
    sessionCookie = setCookie.split(';')[0];
  }
  lastLoginTime = Date.now();
  console.log('lazymanchat: logged in, got cookie:', !!sessionCookie);
  return !!sessionCookie;
}

async function ensureSession() {
  if (!sessionCookie || Date.now() - lastLoginTime > 3600000) {
    return login();
  }
  return true;
}

async function fetchModels() {
  await ensureSession();
  const data = await request('/api/models');
  modelListCache = data.models || data || [];
  return modelListCache;
}

async function getModels() {
  if (modelListCache) return modelListCache;
  return fetchModels();
}

async function sendMessage(model, message, files = []) {
  await ensureSession();
  const body = { model, message };
  if (files && files.length > 0) {
    body.files = files;
  }
  return request('/api/chat/send', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

async function initLazymanchat() {
  if (config.lazymanchat.email && config.lazymanchat.password) {
    await login();
    await fetchModels();
  } else {
    console.log('lazymanchat: no credentials set, skipping auto-login');
  }
}

module.exports = {
  initLazymanchat,
  getModels,
  sendMessage,
  ensureSession,
};
```

- [ ] **Step 2: 验证模块加载**

```bash
cd server && node -e "
const m = require('./lazymanchat');
console.log('lazymanchat module OK, functions:', Object.keys(m).join(', '));
"
```

预期输出：`lazymanchat module OK, functions: initLazymanchat, getModels, sendMessage, ensureSession`

- [ ] **Step 3: Commit**

```bash
git add server/lazymanchat.js
git commit -m "feat: lazymanchat API client with shared session management"
```

---

### Task 5: 后端 API 路由

**Files:**
- Create: `server/routes.js`

- [ ] **Step 1: 创建 server/routes.js**

```javascript
const { Router } = require('express');
const store = require('./store');
const lazymanchat = require('./lazymanchat');

const router = Router();

// 获取模型列表
router.get('/models', async (req, res) => {
  try {
    const models = await lazymanchat.getModels();
    res.json({ models });
  } catch (err) {
    console.error('GET /models error:', err.message);
    res.status(500).json({ error: '获取模型列表失败' });
  }
});

// 发送聊天消息
router.post('/chat', async (req, res) => {
  try {
    const { conversationId, model, message, files } = req.body;
    if (!message) {
      return res.status(400).json({ error: '消息不能为空' });
    }

    let convId = conversationId;
    if (!convId) {
      const conv = store.createConversation(message);
      convId = conv.id;
    }

    store.addMessage(convId, 'user', message, model);

    const result = await lazymanchat.sendMessage(model, message, files || []);
    const reply = result.reply || result.text || result.content || JSON.stringify(result);

    store.addMessage(convId, 'assistant', reply, model);

    res.json({ conversationId: convId, reply });
  } catch (err) {
    console.error('POST /chat error:', err.message);
    res.status(500).json({ error: '发送消息失败，请重试' });
  }
});

// 获取对话列表
router.get('/conversations', (req, res) => {
  try {
    const list = store.listConversations();
    res.json({ conversations: list });
  } catch (err) {
    console.error('GET /conversations error:', err.message);
    res.status(500).json({ error: '获取对话列表失败' });
  }
});

// 获取单个对话详情
router.get('/conversations/:id', (req, res) => {
  try {
    const conv = store.getConversation(req.params.id);
    if (!conv) return res.status(404).json({ error: '对话不存在' });
    res.json({ conversation: conv });
  } catch (err) {
    console.error('GET /conversations/:id error:', err.message);
    res.status(500).json({ error: '获取对话详情失败' });
  }
});

// 删除对话
router.delete('/conversations/:id', (req, res) => {
  try {
    store.deleteConversation(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /conversations/:id error:', err.message);
    res.status(500).json({ error: '删除对话失败' });
  }
});

module.exports = router;
```

- [ ] **Step 2: 验证路由加载**

```bash
cd server && node -e "
const routes = require('./routes');
console.log('routes OK, stack length:', routes.stack.length);
"
```

预期输出：`routes OK, stack length: 4`

- [ ] **Step 3: Commit**

```bash
git add server/routes.js
git commit -m "feat: API routes for models, chat, and conversations"
```

---

### Task 6: 小程序骨架与 API 工具

**Files:**
- Create: `miniprogram/app.js`
- Create: `miniprogram/app.json`
- Create: `miniprogram/app.wxss`
- Create: `miniprogram/utils/api.js`

- [ ] **Step 1: 创建 miniprogram/app.js**

```javascript
App({
  globalData: {
    apiBase: 'https://你的服务器域名.com', // 替换为阿里云ECS域名
    conversations: [],
    currentModel: '',
    quickModels: [],
  },
});
```

- [ ] **Step 2: 创建 miniprogram/app.json**

```json
{
  "pages": [
    "pages/index/index",
    "pages/chat/chat",
    "pages/models/models"
  ],
  "window": {
    "navigationBarBackgroundColor": "#ffffff",
    "navigationBarTitleText": "Lookmore撸猫",
    "navigationBarTextStyle": "black",
    "backgroundColor": "#f5f5f5"
  }
}
```

- [ ] **Step 3: 创建 miniprogram/app.wxss**

```css
page {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background-color: #f5f5f5;
  font-size: 16px;
  color: #333;
}
```

- [ ] **Step 4: 创建 miniprogram/utils/api.js**

```javascript
const app = getApp();

function request(endpoint, options = {}) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: app.globalData.apiBase + endpoint,
      method: options.method || 'GET',
      data: options.data || {},
      header: {
        'Content-Type': 'application/json',
      },
      success(res) {
        if (res.statusCode === 200) {
          resolve(res.data);
        } else {
          reject(new Error(res.data.error || '请求失败'));
        }
      },
      fail(err) {
        reject(new Error('网络错误，请检查连接'));
      },
    });
  });
}

function getModels() {
  return request('/api/models');
}

function sendChat(conversationId, model, message, files) {
  return request('/api/chat', {
    method: 'POST',
    data: { conversationId, model, message, files },
  });
}

function getConversations() {
  return request('/api/conversations');
}

function getConversation(id) {
  return request('/api/conversations/' + id);
}

function deleteConversation(id) {
  return request('/api/conversations/' + id, { method: 'DELETE' });
}

module.exports = {
  getModels,
  sendChat,
  getConversations,
  getConversation,
  deleteConversation,
};
```

- [ ] **Step 5: Commit**

```bash
git add miniprogram/app.js miniprogram/app.json miniprogram/app.wxss miniprogram/utils/api.js
git commit -m "feat: miniprogram shell and API utility"
```

---

### Task 7: 对话列表页（首页）

**Files:**
- Create: `miniprogram/pages/index/index.js`
- Create: `miniprogram/pages/index/index.json`
- Create: `miniprogram/pages/index/index.wxml`
- Create: `miniprogram/pages/index/index.wxss`

- [ ] **Step 1: 创建 miniprogram/pages/index/index.json**

```json
{
  "navigationBarTitleText": "Lookmore撸猫"
}
```

- [ ] **Step 2: 创建 miniprogram/pages/index/index.wxml**

```xml
<view class="container">
  <view class="brand">
    <text class="brand-text">Lookmore撸猫</text>
  </view>
  <view class="list">
    <block wx:for="{{conversations}}" wx:key="id">
      <view class="item" bindtap="openChat" data-id="{{item.id}}" bindlongpress="onLongPress" data-id="{{item.id}}">
        <view class="item-title">{{item.title}}</view>
        <view class="item-meta">{{item.model || '未选择模型'}} · {{item.messageCount}}条消息 · {{item.updatedAt}}</view>
      </view>
    </block>
    <view wx:if="{{conversations.length === 0}}" class="empty">
      <text>还没有对话，点击下方按钮开始</text>
    </view>
  </view>
  <view class="new-btn-wrapper">
    <button class="new-btn" bindtap="newChat">+ 新建对话</button>
  </view>
</view>
```

- [ ] **Step 3: 创建 miniprogram/pages/index/index.wxss**

```css
.container {
  display: flex;
  flex-direction: column;
  height: 100vh;
}
.brand {
  text-align: center;
  padding: 40px 0 20px;
}
.brand-text {
  font-size: 28px;
  font-weight: bold;
  color: #333;
  letter-spacing: 2px;
}
.list {
  flex: 1;
  padding: 0 16px;
  overflow-y: auto;
}
.item {
  background: #fff;
  border-radius: 10px;
  padding: 14px 16px;
  margin-bottom: 10px;
}
.item-title {
  font-size: 16px;
  font-weight: 500;
  color: #333;
  margin-bottom: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.item-meta {
  font-size: 12px;
  color: #999;
}
.empty {
  text-align: center;
  color: #aaa;
  margin-top: 100px;
  font-size: 15px;
}
.new-btn-wrapper {
  padding: 16px;
}
.new-btn {
  background: #07c160;
  color: #fff;
  border-radius: 24px;
  font-size: 16px;
}
```

- [ ] **Step 4: 创建 miniprogram/pages/index/index.js**

```javascript
const api = require('../../utils/api');
const app = getApp();

Page({
  data: {
    conversations: [],
  },
  onShow() {
    this.loadList();
  },
  loadList() {
    api.getConversations().then((res) => {
      const conversations = (res.conversations || []).map((c) => ({
        ...c,
        updatedAt: this.formatTime(c.updatedAt),
      }));
      this.setData({ conversations });
      app.globalData.conversations = conversations;
    }).catch(() => {
      wx.showToast({ title: '加载失败', icon: 'none' });
    });
  },
  formatTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const now = new Date();
    const diff = now - d;
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
    if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
    return Math.floor(diff / 86400000) + '天前';
  },
  newChat() {
    wx.navigateTo({ url: '/pages/chat/chat' });
  },
  openChat(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/chat/chat?id=' + id });
  },
  onLongPress(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除对话',
      content: '确定要删除这个对话吗？',
      success: (res) => {
        if (res.confirm) {
          api.deleteConversation(id).then(() => this.loadList());
        }
      },
    });
  },
});
```

- [ ] **Step 5: Commit**

```bash
git add miniprogram/pages/index/
git commit -m "feat: conversation list page with brand header"
```

---

### Task 8: 聊天页

**Files:**
- Create: `miniprogram/pages/chat/chat.js`
- Create: `miniprogram/pages/chat/chat.json`
- Create: `miniprogram/pages/chat/chat.wxml`
- Create: `miniprogram/pages/chat/chat.wxss`

- [ ] **Step 1: 创建 miniprogram/pages/chat/chat.json**

```json
{
  "navigationBarTitleText": "聊天"
}
```

- [ ] **Step 2: 创建 miniprogram/pages/chat/chat.wxml**

```xml
<view class="container">
  <scroll-view class="messages" scroll-y scroll-into-view="{{scrollToId}}" scroll-with-animation>
    <block wx:for="{{messages}}" wx:key="index">
      <view class="msg-row {{item.role}}" id="msg-{{index}}">
        <view class="bubble {{item.role}}">
          <text wx:if="{{item.role === 'assistant'}}" class="model-label">{{item.model}}</text>
          <text class="content">{{item.content}}</text>
          <view wx:if="{{item.files}}" class="files">
            <image wx:for="{{item.files}}" wx:key="index" wx:for-item="f" src="{{f.url}}" mode="aspectFill" class="msg-img" bindtap="previewImage" data-url="{{f.url}}"></image>
          </view>
        </view>
      </view>
    </block>
    <view wx:if="{{loading}}" class="msg-row assistant">
      <view class="bubble assistant"><text class="loading-dots">思考中...</text></view>
    </view>
    <view id="msg-bottom"></view>
  </scroll-view>

  <view class="input-area">
    <view class="model-tags">
      <scroll-view scroll-x class="tags-scroll">
        <view class="tag {{currentModel === item ? 'active' : ''}}" wx:for="{{quickModels}}" wx:key="*this" bindtap="switchModel" data-model="{{item}}">{{item}}</view>
      </scroll-view>
      <view class="tag more-tag" bindtap="openModels">+更多</view>
    </view>
    <view class="input-row">
      <view class="upload-btn" bindtap="uploadFile">＋</view>
      <input class="input" value="{{inputText}}" bindinput="onInput" placeholder="输入消息..." confirm-type="send" bindconfirm="send" adjust-position="{{true}}"/>
      <button class="send-btn" bindtap="send" disabled="{{!inputText && !pendingFiles.length}}">发送</button>
    </view>
    <view wx:if="{{pendingFiles.length}}" class="pending-files">
      <view class="file-tag" wx:for="{{pendingFiles}}" wx:key="index">
        {{item.name}}
        <text class="file-remove" bindtap="removeFile" data-index="{{index}}">×</text>
      </view>
    </view>
  </view>
</view>
```

- [ ] **Step 3: 创建 miniprogram/pages/chat/chat.wxss**

```css
.container { display:flex; flex-direction:column; height:100vh; }
.messages { flex:1; padding:12px 14px; overflow-y:auto; }
.msg-row { display:flex; margin-bottom:14px; }
.msg-row.user { justify-content:flex-end; }
.msg-row.assistant { justify-content:flex-start; }
.bubble { max-width:78%; padding:10px 14px; border-radius:10px; font-size:15px; line-height:1.6; word-break:break-all; }
.bubble.user { background:#07c160; color:#fff; border-bottom-right-radius:4px; }
.bubble.assistant { background:#fff; color:#333; border:1px solid #e8e8e8; border-bottom-left-radius:4px; }
.model-label { display:block; font-size:11px; color:#07c160; margin-bottom:4px; }
.loading-dots { color:#999; font-size:14px; }
.msg-img { width:120px; height:120px; border-radius:6px; margin-top:6px; }
.input-area { background:#f8f8f8; border-top:1px solid #e5e5e5; }
.model-tags { display:flex; padding:8px 12px 4px; align-items:center; }
.tags-scroll { flex:1; white-space:nowrap; display:flex; gap:8px; }
.tag { display:inline-block; padding:4px 12px; border-radius:14px; font-size:12px; background:#fff; color:#666; border:1px solid #ddd; white-space:nowrap; }
.tag.active { background:#07c160; color:#fff; border-color:#07c160; }
.more-tag { margin-left:4px; color:#07c160; border-color:#07c160; }
.input-row { display:flex; padding:6px 12px 10px; align-items:center; gap:8px; }
.upload-btn { width:36px; height:36px; border-radius:50%; background:#fff; border:1px solid #ddd; display:flex; align-items:center; justify-content:center; font-size:22px; color:#666; flex-shrink:0; }
.input { flex:1; height:36px; padding:0 12px; border-radius:18px; background:#fff; border:1px solid #e5e5e5; font-size:15px; }
.send-btn { width:56px; height:36px; border-radius:18px; background:#07c160; color:#fff; font-size:14px; line-height:36px; padding:0; flex-shrink:0; }
.send-btn[disabled] { background:#ccc; }
.pending-files { display:flex; flex-wrap:wrap; padding:0 12px 8px; gap:6px; }
.file-tag { background:#e8f5e9; color:#333; padding:3px 8px; border-radius:10px; font-size:12px; }
.file-remove { color:#f55; margin-left:4px; font-weight:bold; }
```

- [ ] **Step 4: 创建 miniprogram/pages/chat/chat.js**

```javascript
const api = require('../../utils/api');
const app = getApp();

Page({
  data: {
    conversationId: null,
    messages: [],
    inputText: '',
    currentModel: '',
    quickModels: [],
    pendingFiles: [],
    loading: false,
    scrollToId: '',
  },
  onLoad(options) {
    if (options.model) {
      this.setData({ currentModel: options.model });
    }
    this.loadModels();
    if (options.id) {
      this.setData({ conversationId: options.id });
      this.loadConversation(options.id);
    }
  },
  onShow() {
    if (app.globalData.currentModel && app.globalData.currentModel !== this.data.currentModel) {
      this.setData({ currentModel: app.globalData.currentModel });
    }
  },
  loadModels() {
    api.getModels().then((res) => {
      const models = res.models || [];
      const names = models.map((m) => (typeof m === 'string' ? m : m.name));
      const quick = names.slice(0, 6);
      this.setData({ quickModels: quick });
      if (!this.data.currentModel && quick.length > 0) {
        this.setData({ currentModel: quick[0] });
      }
    }).catch(() => {});
  },
  loadConversation(id) {
    api.getConversation(id).then((res) => {
      const conv = res.conversation;
      this.setData({
        messages: conv.messages || [],
        currentModel: conv.model || this.data.currentModel,
      });
      this.scrollBottom();
    }).catch(() => {});
  },
  onInput(e) {
    this.setData({ inputText: e.detail.value });
  },
  switchModel(e) {
    this.setData({ currentModel: e.currentTarget.dataset.model });
  },
  openModels() {
    wx.navigateTo({ url: '/pages/models/models' });
  },
  uploadFile() {
    wx.chooseMessageFile({
      count: 5,
      type: 'all',
      success: (res) => {
        const files = res.tempFiles.map((f) => ({
          name: f.name || 'file',
          path: f.path,
        }));
        this.setData({ pendingFiles: [...this.data.pendingFiles, ...files] });
      },
    });
  },
  removeFile(e) {
    const idx = e.currentTarget.dataset.index;
    const files = [...this.data.pendingFiles];
    files.splice(idx, 1);
    this.setData({ pendingFiles: files });
  },
  send() {
    const text = this.data.inputText.trim();
    const hasFiles = this.data.pendingFiles.length > 0;
    if (!text && !hasFiles) return;
    if (!this.data.currentModel) {
      wx.showToast({ title: '请先选择模型', icon: 'none' });
      return;
    }

    this.setData({ loading: true, inputText: '' });
    const pendingFiles = [...this.data.pendingFiles];
    this.setData({ pendingFiles: [] });

    const filePromises = pendingFiles.map((f) => {
      return new Promise((resolve) => {
        const fs = wx.getFileSystemManager();
        const data = fs.readFileSync(f.path, 'base64');
        resolve({ name: f.name, type: f.name.split('.').pop() || 'file', base64: data });
      });
    });

    Promise.all(filePromises).then((files) => {
      api.sendChat(this.data.conversationId, this.data.currentModel, text, files)
        .then((res) => {
          const newMessages = [...this.data.messages];
          newMessages.push({ role: 'user', content: text || '[文件]', model: this.data.currentModel, files: pendingFiles.map((f) => ({ url: f.path })) });
          newMessages.push({ role: 'assistant', content: res.reply, model: this.data.currentModel });
          this.setData({
            messages: newMessages,
            conversationId: res.conversationId,
            loading: false,
          });
          this.scrollBottom();
        })
        .catch((err) => {
          wx.showToast({ title: err.message || '发送失败', icon: 'none' });
          this.setData({ loading: false, pendingFiles });
        });
    });
  },
  scrollBottom() {
    setTimeout(() => {
      this.setData({ scrollToId: 'msg-bottom' });
    }, 100);
  },
  previewImage(e) {
    wx.previewImage({ urls: [e.currentTarget.dataset.url], current: e.currentTarget.dataset.url });
  },
});
```

- [ ] **Step 5: Commit**

```bash
git add miniprogram/pages/chat/
git commit -m "feat: chat page with model tags, file upload, and messaging"
```

---

### Task 9: 模型选择页

**Files:**
- Create: `miniprogram/pages/models/models.js`
- Create: `miniprogram/pages/models/models.json`
- Create: `miniprogram/pages/models/models.wxml`
- Create: `miniprogram/pages/models/models.wxss`

- [ ] **Step 1: 创建 miniprogram/pages/models/models.json**

```json
{
  "navigationBarTitleText": "选择模型"
}
```

- [ ] **Step 2: 创建 miniprogram/pages/models/models.wxml**

```xml
<view class="container">
  <view class="tabs">
    <view class="tab {{activeTab === 'basic' ? 'active' : ''}}" bindtap="switchTab" data-tab="basic">基础模型</view>
    <view class="tab {{activeTab === 'enhanced' ? 'active' : ''}}" bindtap="switchTab" data-tab="enhanced">增强模型</view>
  </view>
  <view class="list">
    <block wx:for="{{displayModels}}" wx:key="name">
      <view class="model-item {{selectedModel === item.name ? 'selected' : ''}}" bindtap="selectModel" data-name="{{item.name}}">
        <view class="model-info">
          <view class="model-name">{{item.name}}</view>
          <view class="model-provider" wx:if="{{item.provider}}">{{item.provider}}</view>
        </view>
        <view class="radio {{selectedModel === item.name ? 'checked' : ''}}"></view>
      </view>
    </block>
  </view>
  <view class="confirm-wrapper">
    <button class="confirm-btn" bindtap="confirm">确认选择</button>
  </view>
</view>
```

- [ ] **Step 3: 创建 miniprogram/pages/models/models.wxss**

```css
.container { display:flex; flex-direction:column; height:100vh; }
.tabs { display:flex; background:#fff; border-bottom:1px solid #eee; }
.tab { flex:1; text-align:center; padding:14px 0; font-size:15px; color:#666; }
.tab.active { color:#07c160; border-bottom:2px solid #07c160; font-weight:bold; }
.list { flex:1; padding:12px 16px; overflow-y:auto; }
.model-item { background:#fff; border-radius:10px; padding:14px 16px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center; border:1px solid #eee; }
.model-item.selected { border-color:#07c160; background:#f0fdf4; }
.model-name { font-size:15px; font-weight:500; }
.model-provider { font-size:12px; color:#999; margin-top:4px; }
.radio { width:20px; height:20px; border-radius:50%; border:2px solid #ddd; }
.radio.checked { border-color:#07c160; background:#07c160; box-shadow:inset 0 0 0 3px #fff; }
.confirm-wrapper { padding:16px; }
.confirm-btn { background:#07c160; color:#fff; border-radius:24px; font-size:16px; }
```

- [ ] **Step 4: 创建 miniprogram/pages/models/models.js**

```javascript
const api = require('../../utils/api');
const app = getApp();

Page({
  data: {
    basicModels: [],
    enhancedModels: [],
    displayModels: [],
    activeTab: 'basic',
    selectedModel: '',
  },
  onLoad() {
    this.fetchModels();
  },
  fetchModels() {
    api.getModels().then((res) => {
      const all = res.models || [];
      const modelNames = all.map((m) => (typeof m === 'string' ? m : m.name));
      const providerMap = {};
      all.forEach((m) => {
        if (typeof m !== 'string' && m.provider) providerMap[m.name || m] = m.provider;
      });

      const basic = ['GPT-5.4 mini', 'GPT-5 mini', 'GPT-4.1 mini', 'GPT-4o mini', 'Gemini 3 Flash', 'DeepSeek V3.2'];
      const basicFiltered = basic.filter((n) => modelNames.some((mn) => mn.includes(n) || n.includes(mn)));
      const enhanced = modelNames.filter((n) => !basicFiltered.includes(n));

      const toObj = (name) => ({ name, provider: providerMap[name] || '' });
      const basicModels = (basicFiltered.length ? basicFiltered : modelNames.slice(0, 6)).map(toObj);
      const enhancedModels = (enhanced.length ? enhanced : modelNames.slice(6)).map(toObj);

      this.setData({
        basicModels,
        enhancedModels,
        displayModels: basicModels,
        selectedModel: app.globalData.currentModel || (basicModels[0] ? basicModels[0].name : ''),
      });
    }).catch(() => {
      wx.showToast({ title: '加载模型失败', icon: 'none' });
    });
  },
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({
      activeTab: tab,
      displayModels: tab === 'basic' ? this.data.basicModels : this.data.enhancedModels,
    });
  },
  selectModel(e) {
    this.setData({ selectedModel: e.currentTarget.dataset.name });
  },
  confirm() {
    if (this.data.selectedModel) {
      app.globalData.currentModel = this.data.selectedModel;
      wx.navigateBack();
    }
  },
});
```

- [ ] **Step 5: Commit**

```bash
git add miniprogram/pages/models/
git commit -m "feat: model selection page with basic/enhanced tabs"
```

---

### Task 10: 部署指南

> 此任务为文档性质，不产生可执行代码。

- [ ] **Step 1: 阿里云 ECS 环境准备**

```bash
# SSH 登录服务器后执行
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs nginx
sudo systemctl enable nginx && sudo systemctl start nginx
```

- [ ] **Step 2: 上传后端代码并启动**

```bash
# 在服务器上
mkdir -p /opt/lookmore && cd /opt/lookmore
# 将 server/ 目录上传到此路径
cp .env.example .env
# 编辑 .env 填入真实的 LAZYMANCHAT_EMAIL 和 LAZYMANCHAT_PASSWORD
npm install
node index.js  # 先测试能否启动
# 确认无误后用 pm2 守护
npm install -g pm2
pm2 start index.js --name lookmore
pm2 save && pm2 startup
```

- [ ] **Step 3: 配置 Nginx 反向代理 + HTTPS**

```nginx
server {
    listen 443 ssl http2;
    server_name 你的域名.com;

    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;

    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_buffering off;
    }
}
```

- [ ] **Step 4: 微信小程序后台配置**

在微信公众平台 → 开发管理 → 开发设置 → 服务器域名中，将你的 HTTPS 域名添加到 `request合法域名`。

- [ ] **Step 5: 修改小程序 API 地址**

将 `miniprogram/app.js` 中的 `apiBase` 改为你的实际域名。

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "docs: deployment guide and final config"
```

---

## 关键注意事项

1. **lazymanchat.com 接口抓包是第一步**：Task 4 中的 `lazymanchat.js` 接口路径（`/api/auth/login`、`/api/models`、`/api/chat/send`）是基于常见模式的假设，必须在开发前通过 Chrome DevTools Network 面板抓包确认实际接口路径、请求格式和响应格式。

2. **HTTPS 是硬性要求**：微信小程序要求后端必须是 HTTPS，阿里云 ECS 需要绑定域名并配置 SSL 证书（可用 Let's Encrypt 免费证书）。

3. **小程序AppID**：需要先到微信公众平台注册小程序，获取 AppID 后填入 `project.config.json`。

4. **个人资质限制**：个人身份注册的小程序无法使用 web-view、支付等高级能力，本方案已规避这些限制。
