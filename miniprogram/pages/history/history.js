const api = require('../../utils/api');

Page({
  data: {
    list: [],
    loading: true,
    refreshing: false,
    _firstLoad: true,
  },

  onLoad() {
    this.loadList();
  },

  onShow() {
    if (this.data._firstLoad) {
      this.setData({ _firstLoad: false });
      return;
    }
    this.loadList();
  },

  _loadLock: false,

  loadList() {
    if (this._loadLock) return;
    this._loadLock = true;
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
        this._loadLock = false;
      })
      .catch(() => {
        this.setData({ loading: false, refreshing: false });
        this._loadLock = false;
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
    if (!item || !item.id) return;
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
    this.setData({
      ['list[' + index + ']._swiping']: true,
      ['list[' + index + ']._touchStartX']: e.touches[0].clientX,
    });
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
