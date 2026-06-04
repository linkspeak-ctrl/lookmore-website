const api = require('../../utils/api');
const { markdownToHtml, markdownToPlainText } = require('../../utils/markdown');
const app = getApp();

const CHAT_MODELS = [
  { id: 'gpt-5.5', name: 'GPT-5.5' },
  { id: 'gpt-5.4', name: 'GPT-5.4' },
  { id: 'gpt-5.4-mini', name: 'GPT-5.4-mini' },
  { id: 'gpt-4.1-mini', name: 'GPT-4.1 mini' },
  { id: 'gemini-3.1-pro-preview', name: 'Gemini-3.1-pro（图像识别）' },
  { id: 'gemini-2.5-pro', name: 'Gemini-2.5-pro（图像识别）' },
  { id: 'gemini-3-flash-preview', name: 'Gemini-3-flash（图像识别）' },
];

const IMAGE_MODELS = [
  { id: 'gpt-image-2', name: 'GPT-image-2' },
  { id: 'gemini-3.1-flash-image-preview', name: 'Nano Banana 2' },
  { id: 'gemini-3-pro-image', name: 'Nano Banana Pro（10次/3h）' },
];

const CODE_MODELS = [
  { id: 'claude-sonnet-4-6', name: 'Claude-Sonnet-4.6' },
  { id: 'claude-opus-4-6', name: 'Claude-Opus-4.6（10次/3h）' },
  { id: 'claude-opus-4-7', name: 'Claude-Opus-4.7（10次/3h）' },
];

function imageForSave(rawUrl) {
  return new Promise((resolve, reject) => {
    if (rawUrl.startsWith('data:')) {
      const fs = wx.getFileSystemManager();
      const tmpPath = `${wx.env.USER_DATA_PATH}/img_${Date.now()}.jpg`;
      const parts = rawUrl.split('base64,');
      const base64 = parts.length > 1 ? parts[1] : rawUrl;
      fs.writeFile({
        filePath: tmpPath,
        data: base64,
        encoding: 'base64',
        success: () => resolve(tmpPath),
        fail: reject,
      });
    } else {
      wx.getImageInfo({
        src: rawUrl,
        success: (res) => resolve(res.path),
        fail: () => {
          wx.downloadFile({
            url: rawUrl,
            success: (r) => r.statusCode === 200 ? resolve(r.tempFilePath) : reject(new Error('download failed')),
            fail: reject,
          });
        },
      });
    }
  });
}

function toPreviewUrl(rawUrl) {
  if (!rawUrl || !rawUrl.startsWith('data:')) return rawUrl;
  return new Promise((resolve, reject) => {
    const fs = wx.getFileSystemManager();
    const tmpPath = `${wx.env.USER_DATA_PATH}/prev_${Date.now()}.jpg`;
    const parts = rawUrl.split('base64,');
    fs.writeFile({
      filePath: tmpPath,
      data: parts.length > 1 ? parts[1] : rawUrl,
      encoding: 'base64',
      success: () => resolve(tmpPath),
      fail: reject,
    });
  });
}

Page({
  data: {
    conversationId: null,
    messages: [],
    inputText: '',
    currentModelId: '',
    currentModelName: '',
    userAvatar: '',
    loading: false,
    scrollToId: '',
    pendingFiles: [],
    isDesktop: false,
    keyboardHeight: 0,
    showHistory: false,
    historyList: [],
    historyLoading: false,
    historyRefreshing: false,
    modelPopoverOpen: false,
    chatModels: CHAT_MODELS,
    codeModels: CODE_MODELS,
    imageModels: IMAGE_MODELS,
  },
  onScroll(e) {
    const st = e.detail.scrollTop;
    if (this._prevScrollTop !== undefined && st < this._prevScrollTop - 10) {
      this._userScrolledUp = true;
    }
    this._prevScrollTop = st;
  },
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

    if (options.showHistory === '1') {
      this._fromHome = true;
      this.setData({ showHistory: true });
      this.loadHistoryList();
      return;
    }

    let msg = options.message || '';
    try { msg = decodeURIComponent(msg); } catch (e) {}
    if (msg) this.sendMessage(msg);
  },
  loadUserAvatar() {
    const cached = wx.getStorageSync('userAvatar') || '';
    this.setData({ userAvatar: cached.startsWith('data:image/') ? cached : '/images/avatar.png' });
  },
  onAvatarError() {
    this.setData({ userAvatar: '/images/avatar.png' });
  },
  onInput(e) {
    this.setData({ inputText: e.detail.value });
  },
  onUnload() {
    if (this._onKeyboardChange) wx.offKeyboardHeightChange(this._onKeyboardChange);
  },
  goBack() {
    wx.navigateBack();
  },
  toggleModelPopover() {
    this.setData({ modelPopoverOpen: !this.data.modelPopoverOpen });
  },
  closeModelPopover() {
    this.setData({ modelPopoverOpen: false });
  },
  selectModel(e) {
    const name = e.currentTarget.dataset.name;
    const id = e.currentTarget.dataset.id;
    this.setData({ currentModelName: name, currentModelId: id, modelPopoverOpen: false });
    app.globalData.currentModel = name;
    app.globalData.currentModelId = id;
  },
  loadConversation(conversationId) {
    const that = this;
    this.setData({ conversationId: conversationId });
    try {
      const stored = wx.getStorageSync('chat_' + conversationId);
      if (stored && stored.length) {
        that.setData({ messages: stored });
        that.scrollBottom();
        return;
      }
    } catch (e) {}
    wx.showToast({ title: '未找到本地记录', icon: 'none' });
  },
  onHistoryTap() {
    this.setData({ showHistory: true });
    this.loadHistoryList();
  },
  closeHistory() {
    if (this._fromHome) {
      wx.navigateBack();
      return;
    }
    this.setData({ showHistory: false });
  },
  loadHistoryList() {
    const that = this;
    this.setData({ historyLoading: true });
    try {
      const localIndex = wx.getStorageSync('chat_index') || {};
      const localList = Object.entries(localIndex)
        .map(([id, item]) => ({
          id: id,
          title: that.formatHistoryTitle(item.title || ''),
          updatedAt: item.updatedAt || 0,
          _swipeX: 0,
          _swiping: false,
        }));
      that.setData({ historyList: localList.sort((a, b) => b.updatedAt - a.updatedAt), historyLoading: false, historyRefreshing: false });
    } catch (e) {
      that.setData({ historyLoading: false, historyRefreshing: false });
    }
  },
  saveChatToStorage(conversationId, messages) {
    if (!conversationId || !messages || !messages.length) return;
    try {
      wx.setStorageSync('chat_' + conversationId, messages);
      const index = wx.getStorageSync('chat_index') || {};
      const firstUser = messages.find(m => m.role === 'user');
      const title = (firstUser && firstUser.content) ? firstUser.content.slice(0, 30) : '新对话';
      index[conversationId] = { title: title, updatedAt: Date.now() };
      wx.setStorageSync('chat_index', index);
    } catch (e) {
      console.error('saveChatToStorage error:', e);
    }
  },
  formatHistoryTitle(text) {
    if (!text) return '新对话';
    return text.length > 20 ? text.slice(0, 20) + '...' : text;
  },
  onHistoryRefresh() {
    this.setData({ historyRefreshing: true });
    this.loadHistoryList();
  },
  onHistoryNewChat() {
    this._fromHome = false;
    this.setData({
      showHistory: false,
      conversationId: null,
      messages: [],
    });
  },
  onHistoryTapItem(e) {
    const index = e.currentTarget.dataset.index;
    const item = this.data.historyList[index];
    if (!item || !item.id) return;
    if (item._swipeX && item._swipeX < 0) {
      this.setData({
        ['historyList[' + index + ']._swipeX']: 0,
        ['historyList[' + index + ']._swiping']: false,
      });
      return;
    }
    this._fromHome = false;
    this.setData({ showHistory: false });
    this.loadConversation(item.id);
  },
  onHistoryTouchStart(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({
      ['historyList[' + index + ']._swiping']: true,
      ['historyList[' + index + ']._touchStartX']: e.touches[0].clientX,
    });
  },
  onHistoryTouchMove(e) {
    const index = e.currentTarget.dataset.index;
    const dx = e.touches[0].clientX - this.data.historyList[index]._touchStartX;
    if (dx > 0) return;
    const swipeX = Math.max(dx, -56);
    this.setData({ ['historyList[' + index + ']._swipeX']: swipeX });
  },
  onHistoryTouchEnd(e) {
    const index = e.currentTarget.dataset.index;
    const item = this.data.historyList[index];
    const snapX = item._swipeX < -28 ? -56 : 0;
    this.setData({
      ['historyList[' + index + ']._swipeX']: snapX,
      ['historyList[' + index + ']._swiping']: false,
    });
  },
  onHistoryDelete(e) {
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
            try {
              wx.removeStorageSync('chat_' + id);
              const index = wx.getStorageSync('chat_index') || {};
              delete index[id];
              wx.setStorageSync('chat_index', index);
            } catch (e) {}
            that.loadHistoryList();
          })
          .catch((err) => { wx.showToast({ title: err.message || '删除失败', icon: 'none' }); });
      },
    });
  },
  sendMessage(text) {
    const msg = text || this.data.inputText.trim();

    const files = [
      ...(app.globalData.pendingFiles || []),
      ...(this.data.pendingFiles || []),
    ];
    app.globalData.pendingFiles = [];
    this.setData({ pendingFiles: [] });

    if (!msg && !files.length) return;

    let displayText = msg;
    if (files.length > 0) {
      const labels = files.map((f) => {
        if (f.type === "image") return "[图片]";
        if (f.type === "video") return "[视频]";
        return "[" + f.name + "]";
      });
      displayText = msg ? msg + " " + labels.join(" ") : labels.join(" ");
    }

    const userMsg = { id: 'u_' + Date.now(), role: "user", content: displayText, files: files };
    const assistantMsg = { id: 'a_' + Date.now(), role: "assistant", content: "", htmlContent: "", plainContent: "", imageUrl: null };
    const newMessages = [...this.data.messages, userMsg, assistantMsg];
    this._userScrolledUp = false;
    this._prevScrollTop = undefined;
    this.setData({ messages: newMessages, inputText: "", loading: true });
    this.scrollBottom();

    const that = this;
    let fullText = "";
    let lastUpdate = 0;
    let lastHtmlUpdate = 0;

    api.sendChatStream(this.data.conversationId, this.data.currentModelId, msg, files, (token) => {
      fullText += token;
      const now = Date.now();
      if (now - lastUpdate < 10) return;
      lastUpdate = now;

      const doHtml = now - lastHtmlUpdate >= 200;
      if (doHtml) lastHtmlUpdate = now;

      const updated = that.data.messages.map((m, i) => {
        if (i === that.data.messages.length - 1) {
          return {
            ...m,
            content: fullText,
            htmlContent: doHtml ? markdownToHtml(fullText) : m.htmlContent,
            plainContent: markdownToPlainText(fullText),
          };
        }
        return m;
      });
      that.setData({ messages: updated });
      that.scrollBottom();
    })
    .then((res) => {
      const updated = that.data.messages.map((m, i) => {
        if (i === that.data.messages.length - 1) {
          return {
            ...m,
            content: fullText,
            htmlContent: fullText ? markdownToHtml(fullText) : "",
            plainContent: fullText ? markdownToPlainText(fullText) : "",
            imageUrl: res.imageUrl || null,
          };
        }
        return m;
      });
      const finalId = res.conversationId || that.data.conversationId;
      that.setData({
        messages: updated,
        conversationId: finalId,
        loading: false,
      });
      that.saveChatToStorage(finalId, updated);
      that.scrollBottom();
    })
    .catch((err) => {
      wx.showModal({ title: "发送失败", content: err.message || "未知错误", showCancel: false });
      if (!fullText) {
        const fallback = that.data.messages.slice(0, -1);
        fallback.push({ id: 'err_' + Date.now(), role: "assistant", content: "抱歉，请求失败，请重试。", htmlContent: "" });
        that.setData({ messages: fallback, loading: false });
      } else {
        that.setData({ loading: false });
      }
    });
  },

  send() {
    this.sendMessage();
  },
  copyMessage(e) {
    const content = e.currentTarget.dataset.content;
    if (!content) return;
    wx.setClipboardData({ data: content, success() {
      wx.showToast({ title: '已复制', icon: 'success', duration: 1500 });
    }});
  },
  chooseFile() {
    const that = this;
    const isDesktop = this.data.isDesktop;
    const items = isDesktop ? ['图片', '视频', '聊天文件'] : ['相册/拍摄', '聊天文件'];
    wx.showActionSheet({
      itemList: items,
      success(res) {
        if (isDesktop) {
          if (res.tapIndex === 0) {
            wx.chooseImage({
              count: 9,
              sourceType: ['album'],
              success(r) {
                const files = (r.tempFiles || []).map((f) => {
                  let ext = 'jpg';
                  const m = f.path.match(/\.(\w+)$/);
                  if (m) ext = m[1];
                  return {
                    tempFilePath: f.path,
                    size: f.size,
                    name: 'photo_' + Date.now() + '.' + ext,
                    fileType: 'image',
                  };
                });
                that.uploadFiles(files);
              },
            });
          } else if (res.tapIndex === 1) {
            wx.chooseVideo({
              sourceType: ['album'],
              success(r) {
                let ext = 'mp4';
                const m = r.tempFilePath.match(/\.(\w+)$/);
                if (m) ext = m[1];
                that.uploadFiles([{
                  tempFilePath: r.tempFilePath,
                  size: r.size,
                  name: 'video_' + Date.now() + '.' + ext,
                  fileType: 'video',
                }]);
              },
            });
          } else if (res.tapIndex === 2) {
            wx.chooseMessageFile({
              count: 5,
              type: 'all',
              success(r) {
                const files = (r.tempFiles || []).map((f) => ({
                  tempFilePath: f.path,
                  size: f.size,
                  name: f.name || 'file',
                  fileType: 'file',
                }));
                that.uploadFiles(files);
              },
            });
          }
        } else {
          if (res.tapIndex === 0) {
            wx.chooseMedia({
              count: 9,
              mediaType: ['mix'],
              sourceType: ['album', 'camera'],
              sizeType: ['original', 'compressed'],
              success(r) {
                const files = (r.tempFiles || []).map((f) => {
                  const isVideo = f.fileType === 'video';
                  let ext = isVideo ? 'mp4' : 'jpg';
                  const m = f.tempFilePath.match(/\.(\w+)$/);
                  if (m) ext = m[1];
                  return {
                    tempFilePath: f.tempFilePath,
                    size: f.size,
                    name: (isVideo ? 'video_' : 'photo_') + Date.now() + '.' + ext,
                    fileType: isVideo ? 'video' : 'image',
                  };
                });
                that.uploadFiles(files);
              },
            });
          } else if (res.tapIndex === 1) {
            wx.chooseMessageFile({
              count: 5,
              type: 'all',
              success(r) {
                const files = (r.tempFiles || []).map((f) => ({
                  tempFilePath: f.path,
                  size: f.size,
                  name: f.name || 'file',
                  fileType: 'file',
                }));
                that.uploadFiles(files);
              },
            });
          }
        }
      },
    });
  },
  uploadFiles(files) {
    if (!files || !files.length) return;
    const that = this;
    wx.showLoading({ title: '上传中...' });
    const tasks = files.map((f) => {
      return api.uploadFile(f.tempFilePath, f.name)
        .then((result) => ({
          name: f.name,
          path: result.url,
          size: f.size || result.size || 0,
          type: f.fileType,
        }));
    });
    Promise.all(tasks)
      .then((uploaded) => {
        wx.hideLoading();
        that.setData({ pendingFiles: [...that.data.pendingFiles, ...uploaded] });
        wx.showToast({ title: `已选${uploaded.length}个文件`, icon: 'success' });
      })
      .catch((err) => {
        wx.hideLoading();
        console.error('upload error:', err);
        wx.showToast({ title: '上传失败，请重试', icon: 'none' });
      });
  },
  removeFile(e) {
    const idx = e.currentTarget.dataset.index;
    const files = [...this.data.pendingFiles];
    files.splice(idx, 1);
    this.setData({ pendingFiles: files });
  },
  previewImage(e) {
    const url = e.currentTarget.dataset.url;
    if (!url) return;
    if (url.startsWith('data:')) {
      toPreviewUrl(url).then((filePath) => {
        wx.previewImage({ current: filePath, urls: [filePath] });
      }).catch(() => {
        wx.showToast({ title: '预览失败', icon: 'none' });
      });
    } else {
      wx.previewImage({ current: url, urls: [url] });
    }
  },
  saveImage(e) {
    const url = e.currentTarget.dataset.url;
    if (!url) return;
    wx.showLoading({ title: '保存中...' });
    imageForSave(url)
      .then((filePath) => {
        wx.saveImageToPhotosAlbum({
          filePath,
          success: () => {
            wx.hideLoading();
            wx.showToast({ title: '已保存', icon: 'success' });
          },
          fail: (err) => {
            wx.hideLoading();
            if (err.errMsg.includes('auth deny')) {
              wx.showModal({
                title: '需要授权',
                content: '请在设置中允许保存图片到相册',
                confirmText: '去设置',
                success: (m) => { if (m.confirm) wx.openSetting(); },
              });
            } else {
              this.saveToUserPath(filePath);
            }
          },
        });
      })
      .catch(() => {
        wx.hideLoading();
        wx.showToast({ title: '图片下载失败', icon: 'none' });
      });
  },
  saveToUserPath(srcPath) {
    const fs = wx.getFileSystemManager();
    const dest = `${wx.env.USER_DATA_PATH}/lookmore_${Date.now()}.jpg`;
    fs.copyFile({
      srcPath,
      destPath: dest,
      success: () => {
        wx.showToast({ title: '已保存到本地', icon: 'success' });
        const sys = wx.getSystemInfoSync();
        if (sys.platform === 'mac' || sys.platform === 'windows') {
          wx.openDocument({ filePath: dest, showMenu: true, fileType: 'jpg' });
        }
      },
      fail: () => wx.showToast({ title: '保存失败', icon: 'none' }),
    });
  },
  scrollBottom() {
    if (this._userScrolledUp) return;
    setTimeout(() => this.setData({ scrollToId: 'msg-bottom' }), 100);
  },
});
