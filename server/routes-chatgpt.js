const { Router } = require('express');
const ChatGPTScraper = require('./chatgpt-scraper');
const config = require('./config');

const router = Router();

// 全局 ChatGPT 会话
let globalScraper = null;
let isInitializing = false;
let isReady = false;

// 初始化全局 ChatGPT 会话
async function initGlobalChatGPT() {
  if (globalScraper || isInitializing) return;

  isInitializing = true;
  console.log('[ChatGPT] Initializing global session...');

  const scraper = new ChatGPTScraper();
  const initResult = await scraper.init();
  if (!initResult) {
    console.error('[ChatGPT] Browser init failed');
    isInitializing = false;
    return;
  }

  if (!config.chatgpt.email || !config.chatgpt.password) {
    console.error('[ChatGPT] Email or password not configured');
    isInitializing = false;
    return;
  }

  const loginResult = await scraper.login(config.chatgpt.email, config.chatgpt.password);
  if (!loginResult.success) {
    console.error('[ChatGPT] Login failed:', loginResult.error);
    await scraper.close();
    isInitializing = false;
    return;
  }

  globalScraper = scraper;
  isReady = true;
  isInitializing = false;
  console.log('[ChatGPT] Global session ready');
}

// 服务器启动时初始化
initGlobalChatGPT();

// ChatGPT 发送消息（所有用户共享一个会话）
router.post('/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ error: '请输入消息' });
    }

    if (isInitializing) {
      return res.status(503).json({ error: 'ChatGPT 正在初始化，请稍后再试' });
    }

    if (!isReady || !globalScraper) {
      return res.status(503).json({ error: 'ChatGPT 未就绪，请检查配置' });
    }

    const result = await globalScraper.sendMessage(message);
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json({ success: true, message: result.message });
  } catch (err) {
    console.error('ChatGPT chat error:', err.message);
    res.status(500).json({ error: '发送消息失败' });
  }
});

// ChatGPT 测试连接
router.get('/test', async (req, res) => {
  try {
    if (isInitializing) {
      return res.json({ success: false, message: 'ChatGPT 正在初始化中...' });
    }

    if (isReady && globalScraper) {
      res.json({ success: true, message: 'ChatGPT 已就绪' });
    } else {
      res.json({ success: false, message: 'ChatGPT 未就绪，正在重新初始化...' });
      initGlobalChatGPT();
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ChatGPT 重新初始化
router.post('/reinit', async (req, res) => {
  try {
    if (globalScraper) {
      await globalScraper.close();
      globalScraper = null;
      isReady = false;
    }
    initGlobalChatGPT();
    res.json({ success: true, message: '正在重新初始化 ChatGPT...' });
  } catch (err) {
    res.status(500).json({ error: '重新初始化失败' });
  }
});

module.exports = router;
