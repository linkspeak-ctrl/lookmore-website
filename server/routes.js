const { Router } = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const lazymanchat = require('./lazymanchat');
const store = require('./store');

const router = Router();

const uploadDir = path.join(__dirname, 'public', 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname || 'file.bin') || '.bin';
      cb(null, `file_${Date.now()}_${Math.random().toString(36).slice(2, 6)}${ext}`);
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
});

// Helper: save base64 image to file, return public URL
function saveBase64Image(dataUrl) {
  const match = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!match) return null;
  const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
  const base64 = match[2];
  const filename = `ai_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${ext}`;
  const filePath = path.join(uploadDir, filename);
  fs.writeFileSync(filePath, Buffer.from(base64, 'base64'));
  return `/uploads/${filename}`;
}

router.get('/models', (req, res) => {
  try {
    const models = lazymanchat.getModels();
    res.json({ models });
  } catch (err) {
    console.error('GET /models error:', err.message);
    res.status(500).json({ error: '获取模型列表失败' });
  }
});

router.post('/chat', async (req, res) => {
  try {
    const { conversationId, model, message, files } = req.body;
    if (!message && (!files || !files.length)) return res.status(400).json({ error: '消息不能为空' });

    const stream = req.query.stream === '1';

    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.setHeader('Transfer-Encoding', 'chunked');
      res.flushHeaders();
      if (res.socket) res.socket.setNoDelay(true);

      const result = await lazymanchat.sendMessageStream(
        model, message || '', conversationId, files || [],
        (token) => {
          res.write(`event: text\ndata: ${JSON.stringify(token)}\n\n`);
        },
        req.userId
      );

      if (result && result.error) {
        res.write(`event: error\ndata: ${JSON.stringify(result.error)}\n\n`);
        res.end();
        return;
      }

      if (result && result.imageUrl) {
        // If it's a base64 data URI, save to file and return URL
        if (result.imageUrl.startsWith('data:image')) {
          const savedUrl = saveBase64Image(result.imageUrl);
          if (savedUrl) {
            result.imageUrl = `https://api.lookmore.cyou${savedUrl}`;
          }
        }
        res.write(`event: image\ndata: ${JSON.stringify(result.imageUrl)}\n\n`);
      }

      res.write(`event: done\ndata: ${JSON.stringify({ conversationId: result.topicId })}\n\n`);
      res.end();
      return;
    }

    const result = await lazymanchat.sendMessage(model, message || '', conversationId, files || [], req.userId);
    if (result && result.error) {
      return res.status(502).json({ error: result.error });
    }

    // If imageUrl is base64, save to file
    if (result && result.imageUrl && result.imageUrl.startsWith('data:image')) {
      const savedUrl = saveBase64Image(result.imageUrl);
      if (savedUrl) {
        result.imageUrl = `https://api.lookmore.cyou${savedUrl}`;
      }
    }

    res.json({
      conversationId: result.topicId,
      reply: result.reply || '',
      imageUrl: result.imageUrl || null,
      messages: result.messages || [],
      topics: result.topics,
    });
  } catch (err) {
    console.error('POST /chat error:', err.message);
    res.status(500).json({ error: '发送消息失败，请重试' });
  }
});

router.get('/conversations', async (req, res) => {
  try {
    const list = await lazymanchat.getTopics(req.userId);
    res.json({ conversations: Array.isArray(list) ? list : [] });
  } catch (err) {
    console.error('GET /conversations error:', err.message);
    res.status(500).json({ error: '获取对话列表失败' });
  }
});

router.get('/conversations/:id', async (req, res) => {
  try {
    if (!store.userOwnsTopic(req.userId, req.params.id)) {
      return res.status(404).json({ error: '对话不存在' });
    }
    const data = await lazymanchat.getMessages(req.params.id);
    if (data && data.error) return res.status(502).json({ error: data.error });
    const messages = (data && data.json) || data || [];
    res.json({ conversation: { id: req.params.id, messages: Array.isArray(messages) ? messages : [] } });
  } catch (err) {
    console.error('GET /conversations/:id error:', err.message);
    res.status(500).json({ error: '获取对话详情失败' });
  }
});

router.delete('/conversations/:id', async (req, res) => {
  try {
    if (!store.userOwnsTopic(req.userId, req.params.id)) {
      return res.status(404).json({ error: '对话不存在' });
    }
    store.removeUserTopic(req.userId, req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /conversations/:id error:', err.message);
    res.status(500).json({ error: '删除失败' });
  }
});

router.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '缺少文件' });
  res.json({ url: `/uploads/${req.file.filename}`, filename: req.file.originalname, size: req.file.size });
});

module.exports = router;
