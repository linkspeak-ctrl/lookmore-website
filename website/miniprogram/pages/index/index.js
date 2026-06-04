const app = getApp();
const api = require('../../utils/api');

const CHAT_MODELS = [
  { id: 'gpt-5.5', name: 'GPT-5.5' },
  { id: 'gpt-5.4', name: 'GPT-5.4' },
  { id: 'gpt-5.4-mini', name: 'GPT-5.4-mini' },
  { id: 'gpt-4.1-mini', name: 'GPT-4.1 mini' },
  { id: 'gemini-3.1-pro-preview', name: 'Gemini-3.1-pro（支持图像识别）' },
  { id: 'gemini-2.5-pro', name: 'Gemini-2.5-pro（支持图像识别）' },
  { id: 'gemini-3-flash-preview', name: 'Gemini-3-flash（支持图像识别）' },
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

Page({
  data: {
    inputText: '',
    selectedModel: 'GPT-5.5',
    selectedModelId: 'gpt-5.5',
    chatModels: CHAT_MODELS,
    codeModels: CODE_MODELS,
    imageModels: IMAGE_MODELS,
    popoverOpen: false,
    pendingFiles: [],
    showAuth: false,
    keyboardHeight: 0,
    isDesktop: false,
  },
  onLoad() {
    const savedName = app.globalData.currentModel;
    const savedId = app.globalData.currentModelId;
    if (savedName) this.setData({ selectedModel: savedName });
    if (savedId) this.setData({ selectedModelId: savedId });
    const sys = wx.getSystemInfoSync();
    this.setData({ isDesktop: sys.platform === 'mac' || sys.platform === 'windows' });
    this.checkAuth();
    this._onKeyboardChange = (res) => this.setData({ keyboardHeight: res.height });
    wx.onKeyboardHeightChange(this._onKeyboardChange);
  },
  checkAuth() {
    const cached = wx.getStorageSync('userAvatar') || '';
    if (!cached.startsWith('data:image/')) {
      this.setData({ showAuth: true });
    }
  },
  onChooseAvatar(e) {
    const url = e.detail.avatarUrl;
    if (!url) return;
    const that = this;
    const fs = wx.getFileSystemManager();
    fs.readFile({
      filePath: url,
      encoding: 'base64',
      success(readRes) {
        const dataUrl = `data:image/png;base64,${readRes.data}`;
        wx.setStorageSync('userAvatar', dataUrl);
        that.setData({ showAuth: false });
      },
      fail() {
        that.setData({ showAuth: false });
      },
    });
  },
  skipAuth() {
    this.setData({ showAuth: false });
  },

  onInput(e) {
    this.setData({ inputText: e.detail.value });
  },
  onHistoryTap() {
    wx.navigateTo({ url: '/pages/chat/chat?showHistory=1' });
  },
  togglePopover() {
    this.setData({ popoverOpen: !this.data.popoverOpen });
  },
  onUnload() {
    if (this._onKeyboardChange) wx.offKeyboardHeightChange(this._onKeyboardChange);
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
  sendMessage() {
    const text = this.data.inputText.trim();
    const hasFiles = this.data.pendingFiles.length > 0;
    if (!text && !hasFiles) return;
    app.globalData.currentModel = this.data.selectedModel;
    app.globalData.currentModelId = this.data.selectedModelId;
    app.globalData.pendingFiles = this.data.pendingFiles;
    wx.navigateTo({
      url: '/pages/chat/chat?model=' + encodeURIComponent(this.data.selectedModelId) + '&message=' + encodeURIComponent(text || ''),
    });
  },
});
