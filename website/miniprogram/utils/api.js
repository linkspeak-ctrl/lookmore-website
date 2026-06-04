function request(endpoint, options = {}) {
  return new Promise((resolve, reject) => {
    const app = getApp();
    const method = options.method || 'GET';
    const header = {};
    if (method !== 'GET' && method !== 'DELETE') {
      header['Content-Type'] = 'application/json';
    }
    header['X-User-Id'] = app.globalData.userId || '';
    const reqOpts = {
      url: app.globalData.apiBase + endpoint,
      method: method,
      header: header,
      timeout: 120000,
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
        } else {
          reject(new Error(res.data.error || '请求失败'));
        }
      },
      fail(err) {
        console.error('wx.request fail:', JSON.stringify(err));
        reject(new Error('网络错误：' + (err.errMsg || '未知错误')));
      },
    };
    if (options.data) {
      reqOpts.data = options.data;
    }
    wx.request(reqOpts);
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

function sendChatStream(conversationId, model, message, files, onToken) {
  return new Promise((resolve, reject) => {
    const app = getApp();
    let buffer = '';
    let finished = false;
    let chunkReceived = false;

    function finish(result) {
      if (finished) return;
      finished = true;
      resolve(result);
    }
    function fail(err) {
      if (finished) return;
      finished = true;
      reject(err);
    }

    const requestTask = wx.request({
      url: app.globalData.apiBase + '/api/chat?stream=1',
      method: 'POST',
      data: { conversationId, model, message, files },
      enableChunked: true,
      header: { 'Content-Type': 'application/json', 'X-User-Id': app.globalData.userId || '' },
      timeout: 300000,
      success(res) {
        if (finished) return;
        if (res.statusCode >= 200 && res.statusCode < 300) {
          if (chunkReceived) {
            // Chunks were streaming — flush remaining buffer
            buffer = processSSEBuffer(buffer, onToken, finish, fail);
            if (!finished) finish({ conversationId: null, imageUrl: null });
          } else {
            // No chunks received — enableChunked not supported on this platform
            // res.data contains the full assembled SSE body, parse it all at once
            const body = typeof res.data === 'string' ? res.data : '';
            if (body) processSSEBuffer(body, onToken, finish, fail);
            if (!finished) finish({ conversationId: null, imageUrl: null });
          }
        } else {
          fail(new Error('请求失败'));
        }
      },
      fail(err) {
        fail(new Error('网络错误：' + (err.errMsg || '未知错误')));
      },
    });

    requestTask.onChunkReceived((chunk) => {
      if (finished) return;
      chunkReceived = true;
      const text = arrayBufferToString(chunk.data);
      buffer += text;
      buffer = processSSEBuffer(buffer, onToken, finish, fail);
    });
  });
}

function arrayBufferToString(buf) {
  if (typeof buf === 'string') return buf;
  const bytes = new Uint8Array(buf);
  if (typeof TextDecoder !== 'undefined') {
    return new TextDecoder('utf-8').decode(bytes);
  }
  // Fallback UTF-8 decoder for older environments
  let str = '';
  let i = 0;
  while (i < bytes.length) {
    const b = bytes[i];
    if (b < 0x80) {
      str += String.fromCharCode(b);
      i += 1;
    } else if (b < 0xE0) {
      str += String.fromCharCode(((b & 0x1F) << 6) | (bytes[i + 1] & 0x3F));
      i += 2;
    } else if (b < 0xF0) {
      str += String.fromCharCode(((b & 0x0F) << 12) | ((bytes[i + 1] & 0x3F) << 6) | (bytes[i + 2] & 0x3F));
      i += 3;
    } else {
      const cp = ((b & 0x07) << 18) | ((bytes[i + 1] & 0x3F) << 12) | ((bytes[i + 2] & 0x3F) << 6) | (bytes[i + 3] & 0x3F);
      str += String.fromCodePoint(cp);
      i += 4;
    }
  }
  return str;
}

function processSSEBuffer(buffer, onToken, resolve, reject) {
  // Find complete SSE events (delimited by \n\n)
  let idx = 0;
  while (idx < buffer.length) {
    const sep = buffer.indexOf('\n\n', idx);
    if (sep === -1) break;
    const event = buffer.slice(idx, sep);
    idx = sep + 2;
    if (!event.trim()) continue;
    parseSSEEvent(event, onToken, resolve, reject);
  }
  // Return remaining incomplete data
  return idx > 0 ? buffer.slice(idx) : buffer;
}

function parseSSEEvent(event, onToken, resolve, reject) {
  const lines = event.split('\n');
  let eventType = '';
  for (const line of lines) {
    if (line.startsWith('event: ')) {
      eventType = line.slice(7).trim();
    } else if (line.startsWith('data: ')) {
      const data = line.slice(6);
      if (eventType === 'text') {
        try { onToken(JSON.parse(data)); } catch { onToken(data); }
      } else if (eventType === 'image') {
        try { resolve({ conversationId: null, imageUrl: JSON.parse(data) }); } catch {}
      } else if (eventType === 'done') {
        try {
          const result = JSON.parse(data);
          resolve({ conversationId: result.conversationId || null, imageUrl: null });
        } catch {
          resolve({ conversationId: null, imageUrl: null });
        }
      } else if (eventType === 'error') {
        reject(new Error(data));
      }
    }
  }
}

function uploadFile(filePath, fileName) {
  return new Promise((resolve, reject) => {
    const app = getApp();
    wx.uploadFile({
      url: app.globalData.apiBase + '/api/upload',
      filePath: filePath,
      name: 'file',
      header: { 'X-User-Id': app.globalData.userId || '' },
      formData: {
        filename: fileName || 'file',
      },
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(res.data));
          } catch (e) {
            reject(new Error('解析响应失败'));
          }
        } else {
          reject(new Error('上传失败'));
        }
      },
      fail(err) {
        console.error('wx.request/upload fail:', JSON.stringify(err));
        reject(new Error('网络错误：' + (err.errMsg || '未知错误')));
      },
    });
  });
}

module.exports = {
  getModels,
  sendChat,
  sendChatStream,
  getConversations,
  getConversation,
  deleteConversation,
  uploadFile,
};
