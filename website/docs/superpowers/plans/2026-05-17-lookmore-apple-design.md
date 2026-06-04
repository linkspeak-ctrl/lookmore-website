# LookMore Apple visionOS Frontend Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite LookMore WeChat Mini Program frontend from AC camping style to Apple visionOS spatial style (pure CSS/WXML, no JS logic changes except minor popover toggle).

**Architecture:** Replace all CSS variables (colors, shadows, radii) in `app.wxss` with Apple palette. Rewrite homepage (`index.wxss` + `index.wxml`) with layered depth — background glow, centered model capsule, floating card with input row. Rewrite chat page (`chat.wxss` + `chat.wxml`) with floating capsule topbar and frosted-glass bubbles. Backend API untouched. All JS streaming/scroll/file logic preserved.

**Tech Stack:** WeChat Mini Program (WXSS/WXML/JS), PingFang SC font, CSS custom properties, no new dependencies

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `miniprogram/app.wxss` | Rewrite | Global CSS variables (colors, shadows, radii, typography) |
| `miniprogram/pages/index/index.wxss` | Rewrite | Homepage Apple visionOS styles |
| `miniprogram/pages/index/index.wxml` | Restructure | New homepage layout (centered capsule, card row, popover) |
| `miniprogram/pages/index/index.js` | Edit lines 38, 73-95 | Replace Caveat font load + old dropdown with popover toggle |
| `miniprogram/pages/chat/chat.wxss` | Rewrite | Chat page Apple styles (floating topbar, frosted bubbles) |
| `miniprogram/pages/chat/chat.wxml` | Restructure | Floating capsule topbar replacing old topbar |
| `miniprogram/pages/chat/chat.js` | No change | Streaming, scroll, file logic preserved |
| `miniprogram/utils/api.js` | No change | API layer preserved |
| `miniprogram/app.js` | No change | Global data preserved |
| `server/` | No change | Backend preserved |

---

### Task 1: Rewrite Global CSS Variables

**Files:**
- Modify: `miniprogram/app.wxss` (full rewrite)

- [ ] **Step 1: Replace CSS custom properties with Apple visionOS palette**

Replace the entire content of `miniprogram/app.wxss`:

```css
/* Apple visionOS 空间风格 — 全局配色 */
page {
  --primary: #007AFF;
  --primary-glow: rgba(0,122,255,0.30);
  --bg: #F2F2F7;
  --bg-gradient-start: #E8E8ED;
  --bg-gradient-end: #FAFAFA;
  --surface: rgba(255,255,255,0.68);
  --surface-light: rgba(255,255,255,0.55);
  --surface-heavy: rgba(255,255,255,0.72);
  --text-primary: #1D1D1F;
  --text-secondary: #8E8E93;
  --text-placeholder: #AEAEB2;
  --orange: #FF9500;
  --border-subtle: rgba(0,0,0,0.06);

  --shadow-sm: 0 1px 4px rgba(0,0,0,0.04);
  --shadow-md: 0 4px 16px rgba(0,0,0,0.08), 0 0 0 0.5px rgba(255,255,255,0.5) inset;
  --shadow-lg: 0 12px 40px rgba(0,0,0,0.12), 0 0 0 1px rgba(255,255,255,0.7) inset, 0 0 30px rgba(0,122,255,0.06);
  --shadow-blue-btn: 0 4px 14px rgba(0,122,255,0.35);

  --radius-sm: 6px;
  --radius-md: 12px;
  --radius-lg: 20px;
  --radius-full: 99px;

  font-family: 'PingFang SC', -apple-system, BlinkMacSystemFont, sans-serif;
  background-color: var(--bg);
  font-size: 14px;
  color: var(--text-primary);
  overflow-x: hidden;
  width: 100%;
  box-sizing: border-box;
}
```

- [ ] **Step 2: Verify compile**

Open the project in WeChat DevTools. The app should compile without CSS errors. Pages will look broken (old AC classes referencing deleted variables) — this is expected, subsequent tasks fix each page.

- [ ] **Step 3: Commit**

```bash
git add miniprogram/app.wxss
git commit -m "feat: replace AC camping CSS variables with Apple visionOS palette"
```

---

### Task 2: Rewrite Homepage Styles (index.wxss)

**Files:**
- Modify: `miniprogram/pages/index/index.wxss` (full rewrite)

- [ ] **Step 1: Write the complete Apple visionOS homepage stylesheet**

Replace the entire content of `miniprogram/pages/index/index.wxss`:

```css
.container {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 100vh;
  width: 100%;
  overflow-x: hidden;
  box-sizing: border-box;
  padding: 90px 16px 40px;
  background: linear-gradient(180deg, var(--bg-gradient-start) 0%, var(--bg) 40%, var(--bg-gradient-end) 100%);
  position: relative;
}

/* Background blue glow orbs */
.container::before {
  content: '';
  position: fixed;
  top: 100px;
  left: 50%;
  transform: translateX(-50%);
  width: 180px;
  height: 180px;
  background: rgba(0,122,255,0.05);
  border-radius: 50%;
  filter: blur(60px);
  pointer-events: none;
  z-index: 1;
}
.container::after {
  content: '';
  position: fixed;
  bottom: 140px;
  left: 50%;
  transform: translateX(-50%);
  width: 140px;
  height: 100px;
  background: rgba(0,122,255,0.03);
  border-radius: 50%;
  filter: blur(50px);
  pointer-events: none;
  z-index: 1;
}

/* ── Logo area ── */
.logo-area {
  position: relative;
  z-index: 2;
  text-align: center;
  margin-bottom: 28px;
}
.logo-icon {
  width: 56px; height: 56px;
  background: var(--primary);
  border-radius: var(--radius-md);
  margin: 0 auto 12px;
  box-shadow: 0 8px 30px var(--primary-glow), 0 2px 8px rgba(0,122,255,0.15);
}
.brand-name {
  display: block;
  font-size: 22px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.3px;
  line-height: 1.3;
}
.brand-sub {
  display: block;
  font-size: 11px;
  color: var(--text-secondary);
  margin-top: 2px;
}

/* ── Model capsule (centered, above card) ── */
.model-area {
  position: relative;
  z-index: 3;
  margin-bottom: 10px;
}
.model-capsule {
  display: inline-block;
  background: var(--primary);
  color: #fff;
  font-size: 12px;
  font-weight: 500;
  padding: 6px 18px;
  border-radius: var(--radius-full);
  box-shadow: var(--shadow-blue-btn);
}

/* ── Popover (centered below capsule) ── */
.popover-mask {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  z-index: 10;
}
.popover {
  position: absolute;
  top: 36px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(255,255,255,0.94);
  border-radius: 16px;
  padding: 14px 16px;
  box-shadow: 0 12px 40px rgba(0,0,0,0.14), 0 0 0 0.5px rgba(255,255,255,0.6) inset;
  min-width: 190px;
  z-index: 11;
}
.popover-title {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  text-align: center;
  margin-bottom: 8px;
}
.popover-group-title {
  display: block;
  font-size: 9px;
  color: var(--text-secondary);
  padding: 2px 6px 2px;
}
.popover-item {
  display: block;
  font-size: 11px;
  padding: 6px 10px;
  border-radius: 8px;
  color: var(--text-primary);
  margin-bottom: 1px;
}
.popover-item.active {
  background: var(--primary);
  color: #fff;
}

/* ── Main floating card ── */
.dialog-card {
  position: relative;
  z-index: 2;
  width: 92%;
  background: var(--surface);
  border-radius: 22px;
  padding: 16px;
  box-shadow: var(--shadow-lg);
  box-sizing: border-box;
}
.dialog-inner {
  display: flex;
  align-items: center;
  gap: 8px;
}
.dialog-input {
  flex: 1;
  min-width: 0;
  height: 40px;
  padding: 0 14px;
  border-radius: 14px;
  border: none;
  outline: none;
  font-size: 12px;
  background: rgba(0,0,0,0.03);
  color: var(--text-primary);
}
.dialog-send {
  width: 36px; height: 36px;
  border-radius: var(--radius-full);
  background: var(--primary);
  color: #fff;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: var(--shadow-blue-btn);
}
.dialog-upload {
  width: 36px; height: 36px;
  border-radius: var(--radius-full);
  background: rgba(0,0,0,0.05);
  color: var(--text-secondary);
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

/* ── File chips ── */
.file-chips {
  position: relative;
  z-index: 2;
  width: 92%;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 10px;
}
.file-chip {
  display: flex;
  align-items: center;
  gap: 4px;
  background: var(--surface-heavy);
  border-radius: 10px;
  padding: 4px 10px;
  font-size: 11px;
  color: var(--text-primary);
  max-width: 100%;
  box-shadow: var(--shadow-sm);
}
.file-chip-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 180px;
}
.file-chip-remove {
  color: var(--text-secondary);
  font-weight: bold;
  font-size: 14px;
  flex-shrink: 0;
}

/* ── Auth overlay ── */
.auth-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  animation: authFadeIn 0.25s ease;
}
@keyframes authFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
.auth-card {
  width: 280px;
  background: rgba(255,255,255,0.94);
  border-radius: var(--radius-lg);
  padding: 32px 24px 24px;
  text-align: center;
  box-shadow: var(--shadow-lg);
}
.auth-logo {
  width: 64px; height: 64px;
  border-radius: var(--radius-md);
  border: 3px solid var(--primary);
  margin-bottom: 12px;
}
.auth-title {
  display: block;
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 6px;
}
.auth-desc {
  display: block;
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 20px;
}
.auth-btn {
  display: inline-block;
  background: var(--primary);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  padding: 10px 40px;
  border-radius: var(--radius-full);
  margin-bottom: 12px;
  border: none;
  line-height: 1.4;
  box-shadow: var(--shadow-blue-btn);
}
.auth-btn::after {
  border: none;
}
.auth-skip {
  display: block;
  font-size: 11px;
  color: var(--text-secondary);
}
```

- [ ] **Step 2: Verify style file loads**

Open the project in WeChat DevTools. The `index.wxss` should compile without errors. Visuals will be misaligned until WXML is updated in Task 3.

- [ ] **Step 3: Commit**

```bash
git add miniprogram/pages/index/index.wxss
git commit -m "feat: rewrite homepage styles with Apple visionOS layered depth"
```

---

### Task 3: Restructure Homepage Layout (index.wxml)

**Files:**
- Modify: `miniprogram/pages/index/index.wxml` (full rewrite)

- [ ] **Step 1: Replace the WXML structure**

Replace the entire content of `miniprogram/pages/index/index.wxml`:

```html
<view class="container">
  <view class="logo-area">
    <view class="logo-icon"></view>
    <text class="brand-name">LookMore</text>
    <text class="brand-sub">智能助手</text>
  </view>

  <view class="model-area">
    <text class="model-capsule" bindtap="togglePopover">{{selectedModel}} ▾</text>

    <view wx:if="{{popoverOpen}}" class="popover-mask" bindtap="closePopover"></view>
    <view wx:if="{{popoverOpen}}" class="popover" style="position:absolute;">
      <text class="popover-title">选择模型</text>
      <text class="popover-group-title">对话</text>
      <view wx:for="{{chatModels}}" wx:key="id" class="popover-item {{selectedModelId === item.id ? 'active' : ''}}" bindtap="selectModelPopover" data-name="{{item.name}}" data-id="{{item.id}}">{{item.name}}</view>
      <text class="popover-group-title">画图</text>
      <view wx:for="{{imageModels}}" wx:key="id" class="popover-item {{selectedModelId === item.id ? 'active' : ''}}" bindtap="selectModelPopover" data-name="{{item.name}}" data-id="{{item.id}}">{{item.name}}</view>
      <text class="popover-group-title">编程</text>
      <view wx:for="{{codeModels}}" wx:key="id" class="popover-item {{selectedModelId === item.id ? 'active' : ''}}" bindtap="selectModelPopover" data-name="{{item.name}}" data-id="{{item.id}}">{{item.name}}</view>
    </view>
  </view>

  <view wx:if="{{pendingFiles.length}}" class="file-chips">
    <view class="file-chip" wx:for="{{pendingFiles}}" wx:key="index">
      <text class="file-chip-name">{{item.name}}</text>
      <text class="file-chip-remove" bindtap="removeFile" data-index="{{index}}">×</text>
    </view>
  </view>

  <view class="dialog-card">
    <view class="dialog-inner">
      <input class="dialog-input" value="{{inputText}}" bindinput="onInput" placeholder="输入你想了解的内容..." confirm-type="send" bindconfirm="sendMessage"/>
      <view class="dialog-send" bindtap="sendMessage">↑</view>
      <view class="dialog-upload" bindtap="chooseFile">+</view>
    </view>
  </view>

  <view wx:if="{{showAuth}}" class="auth-overlay">
    <view class="auth-card">
      <image class="auth-logo" src="/images/avatar.png" mode="aspectFill"></image>
      <text class="auth-title">欢迎使用 LookMore</text>
      <text class="auth-desc">授权获取你的微信头像和昵称</text>
      <button class="auth-btn" open-type="chooseAvatar" bindchooseavatar="onChooseAvatar">选择微信头像</button>
      <text class="auth-skip" bindtap="skipAuth">暂不授权</text>
    </view>
  </view>
</view>
```

- [ ] **Step 2: Verify layout in WeChat DevTools**

Open the index page in DevTools. The structure should show:
- Centered blue logo square + "LookMore" + "智能助手"
- Centered blue model capsule "GPT-5.5 ▾"
- White semi-transparent card with input + ↑ + +
- File chips (if any) between capsule and card
- No AC deco elements (🪵, 🏕️, 🍃)
- Popover will not work yet (JS not updated — Task 4)

- [ ] **Step 3: Commit**

```bash
git add miniprogram/pages/index/index.wxml
git commit -m "feat: restructure homepage layout with centered capsule and floating card"
```

---

### Task 4: Update Homepage JS (index.js) — Popover + Remove Caveat Font

**Files:**
- Modify: `miniprogram/pages/index/index.js` lines 38, 73–95

- [ ] **Step 1: Add `popoverOpen` to data and replace old menu handlers**

Edit `miniprogram/pages/index/index.js`. First, add `popoverOpen: false` to the `data` object. Find:

```javascript
    menuOpen: false,
```

Replace with:

```javascript
    popoverOpen: false,
```

- [ ] **Step 2: Remove Caveat font loading from onLoad**

Find the `onLoad()` method. Remove the line:

```javascript
    this.loadFont();
```

And remove the entire `loadFont()` method:

```javascript
  loadFont() {
    wx.loadFontFace({
      family: 'Caveat',
      source: 'url("https://fonts.gstatic.com/s/caveat/v18/WnznHAc5bAfYB2QRah7pcpNvOx-pjfJ9eIWpZA.ttf")',
      success: () => console.log('Caveat font loaded'),
    });
  },
```

- [ ] **Step 3: Replace old menu handlers with popover handlers**

Find the three old handler methods:

```javascript
  toggleMenu() {
    this.setData({ menuOpen: !this.data.menuOpen });
  },
  closeMenu() {
    this.setData({ menuOpen: false });
  },
  selectModel(e) {
    const name = e.currentTarget.dataset.name;
    const id = e.currentTarget.dataset.id;
    this.setData({ selectedModel: name, selectedModelId: id, menuOpen: false });
    app.globalData.currentModel = name;
    app.globalData.currentModelId = id;
  },
```

Replace with:

```javascript
  togglePopover() {
    this.setData({ popoverOpen: !this.data.popoverOpen });
  },
  closePopover() {
    this.setData({ popoverOpen: false });
  },
  selectModelPopover(e) {
    const name = e.currentTarget.dataset.name;
    const id = e.currentTarget.dataset.id;
    this.setData({ selectedModel: name, selectedModelId: id, popoverOpen: false });
    app.globalData.currentModel = name;
    app.globalData.currentModelId = id;
  },
```

- [ ] **Step 4: Verify popover interaction in DevTools**

Open the index page and:
- Tap the model capsule → popover should appear below it, centered
- Tap a model → popover closes, capsule text updates
- Tap outside the popover (mask) → popover closes
- Tap capsule again → popover toggles
- Send a message → navigates to chat page with correct model

- [ ] **Step 5: Commit**

```bash
git add miniprogram/pages/index/index.js
git commit -m "feat: replace dropdown menu with centered popover, remove Caveat font loading"
```

---

### Task 5: Rewrite Chat Page Styles (chat.wxss)

**Files:**
- Modify: `miniprogram/pages/chat/chat.wxss` (full rewrite)

- [ ] **Step 1: Write the complete Apple visionOS chat page stylesheet**

Replace the entire content of `miniprogram/pages/chat/chat.wxss`:

```css
.container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100%;
  overflow-x: hidden;
  box-sizing: border-box;
  background: var(--bg);
}

/* ── Floating capsule topbar ── */
.topbar {
  display: flex;
  justify-content: center;
  padding: 8px 0;
  position: relative;
  z-index: 10;
  flex-shrink: 0;
}
.topbar-capsule {
  display: flex;
  align-items: center;
  gap: 24px;
  background: var(--surface-heavy);
  border-radius: var(--radius-full);
  padding: 8px 20px;
  box-shadow: var(--shadow-md);
}
.topbar-back {
  font-size: 12px;
  color: var(--primary);
  line-height: 1;
}
.topbar-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}
.topbar-more {
  font-size: 14px;
  color: var(--text-secondary);
  letter-spacing: 2px;
}

/* ── Messages ── */
.messages {
  flex: 1;
  padding: 12px 0;
  overflow-y: auto;
}

.msg-row {
  display: flex;
  align-items: flex-start;
  padding: 0 12px;
  margin-bottom: 14px;
  gap: 8px;
}
.msg-row.user {
  justify-content: flex-end;
}

/* ── Avatar ── */
.msg-avatar {
  width: 36px; height: 36px;
  border-radius: 8px;
  flex-shrink: 0;
}
.ai-avatar {
  border: 2px solid var(--primary);
  box-shadow: 0 2px 8px rgba(0,122,255,0.2);
}
.user-avatar {
  border: 2px solid var(--orange);
}

/* ── Message column (bubble + copy btn) ── */
.msg-col {
  display: flex;
  flex-direction: column;
  max-width: 65%;
  min-width: 0;
}
.msg-col.assistant {
  align-items: flex-start;
}
.msg-col.user {
  align-items: flex-end;
}

/* ── Bubbles ── */
.msg-bubble {
  position: relative;
  padding: 10px 14px;
  border-radius: 14px;
  font-size: 12px;
  line-height: 1.6;
  word-break: break-all;
}
.msg-bubble.assistant {
  background: rgba(255,255,255,0.62);
  color: var(--text-primary);
  box-shadow: 0 2px 12px rgba(0,0,0,0.04), 0 0 0 0.5px rgba(255,255,255,0.5) inset;
}
.msg-bubble.user {
  background: var(--primary);
  color: #fff;
  box-shadow: 0 4px 16px rgba(0,122,255,0.25);
}

/* Triangle pointer — assistant (points left) */
.msg-bubble.assistant::before {
  content: '';
  position: absolute;
  left: -5px;
  top: 10px;
  width: 0; height: 0;
  border-top: 5px solid transparent;
  border-bottom: 5px solid transparent;
  border-right: 5px solid rgba(255,255,255,0.62);
}
/* Triangle pointer — user (points right) */
.msg-bubble.user::before {
  content: '';
  position: absolute;
  right: -5px;
  top: 10px;
  width: 0; height: 0;
  border-top: 5px solid transparent;
  border-bottom: 5px solid transparent;
  border-left: 5px solid var(--primary);
}

.msg-bubble.assistant rich-text {
  word-break: break-all;
}
.bubble-inner {
  position: relative;
}
.selectable-overlay {
  position: absolute;
  top: 0; left: 0;
  width: 100%; height: 100%;
  color: transparent;
  font-size: 12px;
  line-height: 1.6;
  word-break: break-all;
}
.loading-dots {
  color: #999;
  font-size: 12px;
}

/* ── Image in bubble ── */
.msg-image {
  width: 200px;
  height: 200px;
  border-radius: 4px;
  margin-top: 8px;
  background: #F5F5F5;
}

/* ── Copy button ── */
.copy-btn {
  width: 18px;
  height: 18px;
  margin-top: 4px;
  opacity: 0.35;
  flex-shrink: 0;
}
.copy-btn:active {
  opacity: 0.7;
}

/* ── Input area ── */
.input-area {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px 16px;
  flex-shrink: 0;
}
.input-box {
  flex: 1;
  min-width: 0;
  height: 38px;
  padding: 0 14px;
  border-radius: 19px;
  border: none;
  font-size: 12px;
  background: var(--surface-heavy);
  color: var(--text-primary);
  box-shadow: 0 2px 10px rgba(0,0,0,0.04);
}
.send-btn {
  width: 34px; height: 34px;
  border-radius: var(--radius-full);
  background: var(--primary);
  color: #fff;
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: var(--shadow-blue-btn);
}
.upload-btn {
  width: 34px; height: 34px;
  border-radius: var(--radius-full);
  background: rgba(0,0,0,0.05);
  color: var(--text-secondary);
  font-size: 15px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

/* ── File chips ── */
.file-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 0 12px 6px;
}
.file-chip {
  display: flex;
  align-items: center;
  gap: 4px;
  background: var(--surface-heavy);
  border-radius: 10px;
  padding: 4px 10px;
  font-size: 11px;
  color: var(--text-primary);
  max-width: 100%;
  box-shadow: var(--shadow-sm);
}
.file-chip-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 120px;
}
.file-chip-remove {
  color: var(--text-secondary);
  font-weight: bold;
  font-size: 14px;
  flex-shrink: 0;
}
```

- [ ] **Step 2: Verify styles compile**

Open the project in WeChat DevTools. The `chat.wxss` should compile. Visuals may be slightly off until WXML is updated in Task 6.

- [ ] **Step 3: Commit**

```bash
git add miniprogram/pages/chat/chat.wxss
git commit -m "feat: rewrite chat page styles with floating topbar and frosted glass bubbles"
```

---

### Task 6: Restructure Chat Page Layout (chat.wxml)

**Files:**
- Modify: `miniprogram/pages/chat/chat.wxml` lines 2–6 (topbar only, rest unchanged)

- [ ] **Step 1: Replace the topbar section**

Find the current topbar in `miniprogram/pages/chat/chat.wxml`:

```html
  <view class="topbar">
    <text class="topbar-back" bindtap="goBack">←</text>
    <text class="topbar-title">{{currentModelName}}</text>
    <text class="topbar-more">⋯</text>
  </view>
```

Replace with:

```html
  <view class="topbar">
    <view class="topbar-capsule">
      <text class="topbar-back" bindtap="goBack">←</text>
      <text class="topbar-title">{{currentModelName}}</text>
      <text class="topbar-more">⋯</text>
    </view>
  </view>
```

The rest of the file (scroll-view, messages, input-area) remains the same.

- [ ] **Step 2: Add `flex-shrink: 0` to input-area if needed**

Verify chat.wxml has no other changes needed. The current `.input-area` already has `flex-shrink: 0` in the new WXSS. The WXML structure for messages and input is already correct — only the topbar wrapper changed.

- [ ] **Step 3: Verify full chat page in DevTools**

Open the chat page and verify:
- Topbar is a floating capsule (rounded pill, centered, not full-width)
- ← and ⋯ are accessible and centered in the pill
- AI bubbles have semi-transparent white background with inner glow
- User bubbles have blue background with outer glow
- Triangle pointers point correct directions
- Input bar has ↑ left, + right
- Scroll freeze still works
- Streaming text still works
- Copy button still works

- [ ] **Step 4: Commit**

```bash
git add miniprogram/pages/chat/chat.wxml
git commit -m "feat: wrap chat topbar in floating capsule pill"
```

---

### Task 7: Final Verification

**Files:**
- None (verification only)

- [ ] **Step 1: Check package size**

```bash
cd miniprogram && find . -type f ! -path './node_modules/*' | xargs wc -c | tail -1
```

Expected: total under 2MB (2,097,152 bytes). With only 3 compressed images already in the project, this should be well under the limit.

- [ ] **Step 2: Full flow test in WeChat DevTools**

Run through the complete user flow:
1. Open index page → see Apple-style homepage with blue glow, centered capsule, floating card
2. Tap model capsule → popover opens centered below
3. Select a different model → capsule text updates
4. Type a message → tap ↑ → navigates to chat page
5. Chat page shows floating capsule topbar with model name
6. AI responds with frosted glass bubble (semi-transparent white)
7. User message shows as blue bubble
8. Long-press or use copy button → copies text
9. Upload a file → file chip appears above input
10. Scroll up during streaming → auto-scroll freezes
11. Back button → returns to index

- [ ] **Step 3: Preview on real device**

Use WeChat DevTools "Preview" to scan QR code and test on a real phone. Verify:
- Colors render correctly (no CSS variable fallback issues)
- No horizontal overflow/scrolling
- Popover centered correctly on different screen sizes
- Fonts render as PingFang SC
- All interactions work

- [ ] **Step 4: Final commit (if any fixes from device testing)**

```bash
git add -A
git commit -m "chore: final verification fixes for Apple visionOS redesign"
```
