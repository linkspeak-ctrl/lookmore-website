App({
  globalData: {
    apiBase: 'https://api.lookmore.cyou',
    currentModel: 'GPT-5.5',
    currentModelId: 'gpt-5.5',
    userId: '',
  },
  onLaunch() {
    let userId = wx.getStorageSync('userId');
    if (!userId) {
      userId = 'u_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
      wx.setStorageSync('userId', userId);
    }
    this.globalData.userId = userId;
  },
});
