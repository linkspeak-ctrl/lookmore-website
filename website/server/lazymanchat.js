const config = require('./config');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const store = require('./store');


// HTTP keep-alive — reuse TLS connections to lazymanchat
const { setGlobalDispatcher, Agent } = require("undici");
setGlobalDispatcher(new Agent({ keepAliveTimeout: 30000, keepAliveMaxTimeout: 60000, connections: 20 }));

function lmcFetch(url, options) {
  return fetch(url, options);
}

const MODELS = [
  { id: 'gpt-5.5', name: 'GPT-5.5', provider: 'openai', category: 'chat' },
  { id: 'gpt-5.4-mini', name: 'GPT-5.4-mini', provider: 'openai', category: 'chat' },
  { id: 'gpt-5.4', name: 'GPT-5.4', provider: 'openai', category: 'chat' },
  { id: 'gpt-4.1-mini', name: 'GPT-4.1 mini', provider: 'openai', category: 'chat' },
  { id: 'gemini-2.5-pro', name: 'Gemini-2.5-pro', provider: 'google', category: 'chat' },
  { id: 'gemini-3.1-pro-preview', name: 'Gemini-3.1-pro', provider: 'google', category: 'chat' },
  { id: 'gemini-3-flash-preview', name: 'Gemini-3-flash', provider: 'google', category: 'chat' },
  { id: 'claude-opus-4-6', name: 'Claude-Opus-4.6', provider: 'anthropic', category: 'code' },
  { id: 'claude-opus-4-7', name: 'Claude-Opus-4.7', provider: 'anthropic', category: 'code' },
  { id: 'claude-sonnet-4-6', name: 'Claude-Sonnet-4.6', provider: 'anthropic', category: 'code' },
  { id: 'gpt-image-2', name: 'GPT-image-2', provider: 'openai', category: 'image' },
  { id: 'gemini-3.1-flash-image-preview', name: 'Nano Banana 2', provider: 'openai', category: 'image' },
  { id: 'gemini-3-pro-image', name: 'Nano Banana Pro', provider: 'openai', category: 'image' },
];

let sessionCookie = null;
let userId = null;
let authToken = config.lazymanchat.authToken || '';

const AUTH_XOR_KEY = Buffer.from('LazyMan · LazyMan', 'utf-8');

function forgeAuthToken(provider) {
  if (!userId) return '';
  const payload = JSON.stringify({ userId, runtimeProvider: provider });
  const payloadBytes = Buffer.from(payload, 'utf-8');
  const encoded = Buffer.alloc(payloadBytes.length);
  for (let i = 0; i < payloadBytes.length; i++) {
    encoded[i] = payloadBytes[i] ^ AUTH_XOR_KEY[i % AUTH_XOR_KEY.length];
  }
  return encoded.toString('base64');
}

function findModel(modelId) {
  return MODELS.find((m) => m.id === modelId);
}

function buildTrpcInput(json) {
  const nullPaths = [];
  function scan(obj, path) {
    if (obj === null || obj === undefined) {
      nullPaths.push(path.join('.'));
      return;
    }
    if (Array.isArray(obj)) {
      obj.forEach((item, i) => scan(item, [...path, String(i)]));
      return;
    }
    if (typeof obj === 'object') {
      const keys = Object.keys(obj);
      for (const key of keys) {
        if (obj[key] === null || obj[key] === undefined) {
          nullPaths.push([...path, key].join('.'));
          delete obj[key];
        } else {
          scan(obj[key], [...path, key]);
        }
      }
    }
  }
  scan(json, []);

  const meta = { v: 1 };
  if (nullPaths.length > 0) {
    meta.values = {};
    for (const p of nullPaths) {
      meta.values[p] = ['undefined'];
    }
  }

  return { 0: { json, meta } };
}

function commonHeaders() {
  return {
    Origin: config.lazymanchat.baseUrl,
    Referer: config.lazymanchat.baseUrl + '/',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  };
}

async function trpcQuery(endpoint, input) {
  const params = new URLSearchParams();
  params.set('batch', '1');
  params.set('input', JSON.stringify(buildTrpcInput(input)));
  const url = `${config.lazymanchat.baseUrl}/trpc/lambda/${endpoint}?${params.toString()}`;

  const headers = { 'Content-Type': 'application/json', ...commonHeaders() };
  if (sessionCookie) headers.Cookie = sessionCookie;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await lmcFetch(url, { headers, signal: controller.signal });
    clearTimeout(timeout);
    const text = await res.text();
    if (!res.ok) {
      console.error(`trpcQuery ${endpoint} ${res.status}:`, text.slice(0, 200));
      return { error: `Upstream error: ${res.status}` };
    }
    try {
      const batch = JSON.parse(text);
      const first = batch[0];
      if (first.error) throw new Error(first.error.json.message);
      return first.result.data.json;
    } catch (e) {
      return { error: e.message };
    }
  } catch (err) {
    clearTimeout(timeout);
    return { error: err.message };
  }
}

async function trpcMutation(endpoint, input) {
  const url = `${config.lazymanchat.baseUrl}/trpc/lambda/${endpoint}?batch=1`;
  const headers = { 'Content-Type': 'application/json', ...commonHeaders() };
  if (sessionCookie) headers.Cookie = sessionCookie;

  const body = JSON.stringify(buildTrpcInput(input));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);
  try {
    const res = await lmcFetch(url, { method: 'POST', headers, body, signal: controller.signal });
    clearTimeout(timeout);
    const text = await res.text();
    if (!res.ok) {
      console.error(`trpcMutation ${endpoint} ${res.status}:`, text.slice(0, 200));
      return { error: `Upstream error: ${res.status}` };
    }
    try {
      const batch = JSON.parse(text);
      const first = batch[0];
      if (first.error) throw new Error(first.error.json.message);
      return first.result.data.json;
    } catch (e) {
      return { error: e.message };
    }
  } catch (err) {
    clearTimeout(timeout);
    return { error: err.message };
  }
}

async function login() {
  try {
    const url = `${config.lazymanchat.baseUrl}/api/auth/sign-in/email`;
    const res = await lmcFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...commonHeaders() },
      body: JSON.stringify({ email: config.lazymanchat.email, password: config.lazymanchat.password }),
    });
    const cookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    const data = await res.json();
    if (data.token) {
      authToken = data.token;
      sessionCookie = cookies.map((c) => c.split(';')[0]).join('; ');
      userId = data.user?.id || null;
      console.log('lazymanchat: logged in, userId:', userId, 'token:', authToken.slice(0, 10) + '...');
      return true;
    }
    console.error('lazymanchat: login failed:', JSON.stringify(data).slice(0, 200));
    return false;
  } catch (err) {
    console.error('lazymanchat: login error:', err.message);
    return false;
  }
}

async function ensureSession() {
  if (!sessionCookie) return login();
  return true;
}

function parseSSE(text) {
  let result = { text: '', imageUrl: null };
  const lines = text.split('\n');
  let currentEvent = '';
  for (const line of lines) {
    if (line.startsWith('event: ')) {
      currentEvent = line.slice(7).trim();
    } else if (line.startsWith('data: ')) {
      const raw = line.slice(6);
      if (currentEvent === 'text') {
        try {
          result.text += JSON.parse(raw) ?? '';
        } catch {
          result.text += raw;
        }
      } else if (currentEvent === 'url_image') {
        try {
          result.imageUrl = JSON.parse(raw);
        } catch {
          result.imageUrl = raw;
        }
      } else if (currentEvent === 'content_part') {
        try {
          const json = JSON.parse(raw);
          if (json.content) {
            if (json.content.startsWith('/9j/')) {
              result.imageUrl = 'data:image/jpeg;base64,' + json.content;
            } else {
              result.text += json.content;
            }
          }
        } catch {}
      } else if (currentEvent === 'base64_image') {
        if (raw.startsWith('data:image/')) {
          result.imageUrl = raw;
        } else {
          result.imageUrl = 'data:image/jpeg;base64,' + raw;
        }
      }
    }
  }
  return result;
}

const authCache = {};

async function checkAuth(modelId) {
  if (!userId) return true;
  const now = Date.now();
  const cached = authCache[modelId];
  if (cached && now - cached.time < 300000) return cached.result;

  try {
    const url = "https://spe.lazymanchat.com/api/aiwork/checkAuth/" + userId + "?model=" + modelId;
    const res = await lmcFetch(url, {
      headers: { ...commonHeaders(), Cookie: sessionCookie },
    });
    const result = res.ok;
    authCache[modelId] = { time: now, result };
    return result;
  } catch {
    return false;
  }
}

function providerEndpoint(provider) {
  switch (provider) {
    case 'anthropic': return '/webapi/chat/anthropic';
    case 'google': return '/webapi/chat/google';
    default: return '/webapi/chat/openai';
  }
}

async function chatCompletion(model, messages) {
  let fullText = "";
  let imageUrl = null;
  const result = await streamChatCompletion(model, messages, (token) => {
    fullText += token;
  });
  if (result.error) return { error: result.error };
  imageUrl = result.imageUrl;
  if (!fullText && !imageUrl) {
    return { reply: "", imageUrl: null };
  }
  return { reply: fullText, imageUrl: imageUrl || null };
}

async function streamChatCompletion(model, messages, onToken) {
  const m = findModel(model);
  const provider = m ? m.provider : 'openai';
  const endpoint = providerEndpoint(provider);

  if (provider !== 'openai') {
    checkAuth(model); // fire-and-forget — result doesn't block the request
  }

  const t0 = Date.now();
  const isImageModel = m && m.category === 'image';
  const reqBody = JSON.stringify({
    model,
    stream: !isImageModel,
    temperature: 1,
    top_p: 1,
    messages,
    apiMode: 'chatCompletion',
  });
  console.log(`streamChatCompletion [${model}] POST ${endpoint} stream:${!isImageModel} body:`, reqBody.slice(0, 500));
  const res = await lmcFetch(`${config.lazymanchat.baseUrl}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...commonHeaders(),
      'Cookie': sessionCookie,
      'x-lobe-chat-auth': forgeAuthToken(provider),
      'Accept': 'text/event-stream',
    },
    body: reqBody,
  });

  if (!res.ok) {
    const text = await res.text();
    const resHeaders = {};
    for (const [k, v] of res.headers.entries()) {
      resHeaders[k] = v;
    }
    console.error(`streamChatCompletion ${model} ${res.status} FULL:`, text);
    console.error(`streamChatCompletion ${model} ${res.status} HEADERS:`, JSON.stringify(resHeaders));
    let errDetail = "";
    try {
      const errJson = JSON.parse(text);
      if (errJson.body?.error) errDetail = errJson.body.error;
      if (errJson.message) errDetail = errJson.message;
    } catch {}
    if (!errDetail && text) errDetail = text.slice(0, 300);
    return { error: `Chat completion error: ${res.status}${errDetail ? " - " + errDetail : ""}` };
  }

  // Non-streaming mode (image models): parse JSON response
  if (isImageModel) {
    const text = await res.text();
    console.log(`streamChatCompletion [${model}] non-stream response:`, text.slice(0, 500));
    try {
      const json = JSON.parse(text);
      let reply = '';
      let imageUrl = null;
      // Try to extract reply from various response formats
      if (json.choices && json.choices[0]) {
        const msg = json.choices[0].message;
        if (msg.content) {
          if (typeof msg.content === 'string') reply = msg.content;
          else if (Array.isArray(msg.content)) {
            for (const part of msg.content) {
              if (part.type === 'text') reply += part.text;
              else if (part.type === 'image_url') imageUrl = part.image_url?.url;
            }
          }
        }
        if (msg.images && msg.images[0]) {
          imageUrl = msg.images[0].image_url?.url || msg.images[0].url || msg.images[0];
        }
      }
      if (json.image_url) imageUrl = json.image_url;
      if (json.url) imageUrl = json.url;
      if (json.data && json.data[0]?.url) imageUrl = json.data[0].url;
      if (reply) onToken(reply);
      console.log(`streamChatCompletion [${model}] done in ${Date.now() - t0}ms reply:${reply.length} img:${!!imageUrl}`);
      return { imageUrl, reply };
    } catch (e) {
      // If JSON parse fails, try SSE parsing (the upstream might still stream)
      console.log(`streamChatCompletion [${model}] JSON parse failed, trying SSE parse`);
      const sse = parseSSE(text);
      if (sse.text) onToken(sse.text);
      return { imageUrl: sse.imageUrl, reply: sse.text };
    }
  }

  // Streaming mode (text models): parse SSE
  let imageUrl = null;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const chunk = await Promise.race([
        reader.read(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('READ_TIMEOUT')), 60000)),
      ]);
      const { done, value } = chunk;
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      let currentEvent = '';
      for (const line of lines) {
        if (line.startsWith('event: ')) {
          currentEvent = line.slice(7).trim();
        } else if (line.startsWith('data: ')) {
          const raw = line.slice(6);
          if (currentEvent === 'text') {
            try {
              const token = JSON.parse(raw);
              if (token != null) onToken(token);
            } catch { onToken(raw); }
          } else if (currentEvent === 'url_image') {
            try { imageUrl = JSON.parse(raw); } catch { imageUrl = raw; }
          } else if (currentEvent === 'content_part') {
            try {
              const json = JSON.parse(raw);
              if (json.content) {
                if (json.content.startsWith('/9j/')) {
                  imageUrl = 'data:image/jpeg;base64,' + json.content;
                } else {
                  onToken(json.content);
                }
              }
            } catch {}
          } else if (currentEvent === 'base64_image') {
            if (raw.startsWith('data:image/')) imageUrl = raw;
            else imageUrl = 'data:image/jpeg;base64,' + raw;
          }
        }
      }
    }
  } catch (e) {
    if (e.message === 'READ_TIMEOUT') {
      console.error(`streamChatCompletion [${model}] read timeout after ${Date.now() - t0}ms`);
    } else {
      console.error(`streamChatCompletion read error:`, e.message);
    }
  }
  console.log(`streamChatCompletion [${model}] done in ${Date.now() - t0}ms`);
  return { imageUrl };
}

async function directChatCompletion(model, messages) {
  const apiKey = config.ai.apiKey;
  const baseUrl = config.ai.baseUrl;
  if (!apiKey) return null;

  try {
    const res = await lmcFetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        messages,
        temperature: 1,
        stream: false,
      }),
      signal: AbortSignal.timeout(60000),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error(`directChatCompletion ${model} ${res.status}:`, JSON.stringify(data).slice(0, 200));
      return null;
    }
    const reply = data.choices?.[0]?.message?.content || '';
    return { reply, imageUrl: null };
  } catch (err) {
    console.error('directChatCompletion error:', err.message);
    return null;
  }
}



async function getChatResponse(model, messages) {
  if (config.ai.apiKey) {
    const direct = await directChatCompletion(model, messages);
    if (direct) return direct;
    console.log('Direct AI failed, falling back to lazymanchat...');
  }
  return chatCompletion(model, messages);
}

function getModels() {
  return MODELS;
}

async function getTopics(userId) {
  if (!userId) return [];
  const userTopics = store.getUserTopics(userId);
  return Object.entries(userTopics).map(([id, title]) => ({ id, title }));
}

async function getMessages(topicId) {
  await ensureSession();
  return trpcQuery('message.getMessages', { groupId: null, sessionId: null, topicId });
}


async function uploadFileToLazymanchat(filePath) {
  const fullPath = path.join(__dirname, 'public', filePath);
  if (!fs.existsSync(fullPath)) {
    console.error('uploadFileToLazymanchat: file not found:', fullPath);
    return null;
  }

  const buf = fs.readFileSync(fullPath);
  const hash = crypto.createHash('sha256').update(buf).digest('hex');
  const ext = path.extname(filePath).toLowerCase();
  const mimeMap = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp', '.bmp': 'image/bmp' };
  const mime = mimeMap[ext] || 'image/jpeg';
  const name = path.basename(filePath);

  await ensureSession();

  // Step 1: Check if file already exists on lazymanchat
  const hashCheck = await trpcQuery('file.checkFileHash', { hash });
  console.log('file.checkFileHash result for', name, 'hash:', hash.slice(0, 16), JSON.stringify(hashCheck).slice(0, 300));
  if (hashCheck && !hashCheck.error && hashCheck.exists) {
    console.log('lazymanchat file already exists:', name);
    return { id: hashCheck.id || hash, name, type: mime, size: buf.length, hash, url: hashCheck.url || null, lzUrl: hashCheck.url || null, path: filePath };
  }

  // Step 2: Upload file content as base64 via file.createFile (reference image flow)
  const base64Content = buf.toString('base64');
  const createResult = await trpcMutation('file.createFile', {
    name,
    size: buf.length,
    type: mime,
    hash,
    content: base64Content,
  });
  console.log('file.createFile result for', name, JSON.stringify(createResult).slice(0, 500));

  if (createResult && !createResult.error) {
    const fileId = createResult.id || createResult.fileId || hash;
    const fileUrl = createResult.url || createResult.lzUrl || null;
    console.log('lazymanchat file created:', name, 'id:', fileId, 'url:', fileUrl || 'none');
    return { id: fileId, name, type: mime, size: buf.length, hash, url: fileUrl, lzUrl: fileUrl, path: filePath };
  }

  // Step 3: Fallback — try S3 pre-signed URL flow (for generated images)
  console.log('file.createFile failed, trying S3 flow for', name);
  const s3Result = await trpcMutation('upload.createS3PreSignedUrl', { name, size: buf.length, type: mime, hash });
  console.log('upload.createS3PreSignedUrl result for', name, JSON.stringify(s3Result).slice(0, 300));

  if (s3Result && !s3Result.error) {
    const s3Url = s3Result.url || s3Result.s3Url || s3Result.uploadUrl;
    if (s3Url) {
      try {
        const s3Res = await lmcFetch(s3Url, { method: 'PUT', headers: { 'Content-Type': mime }, body: buf });
        if (s3Res.ok) {
          console.log('S3 upload ok:', name);
          return { id: hash, name, type: mime, size: buf.length, hash, url: null, lzUrl: null, path: filePath };
        }
      } catch (e) {
        console.error('S3 upload error:', name, e.message);
      }
    }
  }

  console.error('lazymanchat file upload completely failed for:', name);
  return null;
}

function readImageAsBase64(filePath) {
  const fullPath = path.join(__dirname, 'public', filePath);
  if (!fs.existsSync(fullPath)) return null;
  const buf = fs.readFileSync(fullPath);
  const ext = path.extname(filePath).toLowerCase();
  const mimeMap = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp', '.bmp': 'image/bmp' };
  const mime = mimeMap[ext] || 'image/jpeg';
  return { mime, base64: buf.toString('base64') };
}

function buildChatMessages(message, files, uploadedFiles, modelCategory) {
  if (!files || !files.length) {
    return [{ role: 'user', content: message }];
  }

  const uploadedMap = {};
  if (uploadedFiles) {
    for (const uf of uploadedFiles) {
      if (uf && uf.lzUrl) uploadedMap[uf.path] = uf;
    }
  }

  const images = [];
  const otherFiles = [];
  for (const f of files) {
    if (f.type === 'image') {
      const uf = uploadedMap[f.path];
      if (uf) {
        // Use lazymanchat-uploaded file URL instead of local base64
        images.push({ ...uf, lzUploaded: true });
      } else {
        const imgData = readImageAsBase64(f.path);
        if (imgData) {
          images.push({ ...imgData, name: f.name, lzUploaded: false });
        } else {
          otherFiles.push(f);
        }
      }
    } else {
      otherFiles.push(f);
    }
  }

  // Build content array
  const content = [];
  if (message) {
    content.push({ type: 'text', text: message });
  }

  // Add file references in text
  if (otherFiles.length > 0) {
    const lines = otherFiles.map(f => {
      if (f.type === 'video') return `[视频文件: ${f.name}]`;
      return `[文件: ${f.name}]`;
    });
    content.push({ type: 'text', text: '\n' + lines.join('\n') });
  }

  // Add images as image_url (skip for image models — lazymanchat gets them from newUserMessage.files)
  if (modelCategory !== 'image') {
    for (const img of images) {
      if (img.lzUploaded && img.lzUrl) {
        content.push({
          type: 'image_url',
          image_url: { url: img.lzUrl },
        });
      } else if (!img.lzUploaded && img.mime && img.base64) {
        content.push({
          type: 'image_url',
          image_url: { url: `data:${img.mime};base64,${img.base64}` },
        });
      }
    }
  }

  // If only images and no text, add a default prompt
  if (!message && !otherFiles.length && images.length > 0) {
    content.unshift({ type: 'text', text: '请描述这张图片' });
  }

  return [{ role: 'user', content }];
}

async function sendMessage(modelId, message, topicId, files, userId) {
  await ensureSession();
  const model = findModel(modelId);
  if (!model) return { error: `Unknown model: ${modelId}` };

  let displayContent = message || '';
  if (files && files.length) {
    const fileDescs = files.map(f => {
      if (f.type === 'image') return '[图片]';
      if (f.type === 'video') return '[视频]';
      return `[文件: ${f.name}]`;
    });
    displayContent = displayContent || '发送了文件';
    displayContent += '\n' + fileDescs.join(' ');
  }

  const input = {
    newUserMessage: {
      content: displayContent,
      files: [],
      parentId: null,
      truncatedFiles: null,
    },
    newAssistantMessage: {
      model: model.id,
      provider: model.provider,
    },
  };

  if (topicId) {
    input.newUserMessage.topicId = topicId;
  } else {
    input.newTopic = {
      topicMessageIds: [],
      title: displayContent.slice(0, 50),
    };
  }

  // Upload files to lazymanchat first (so image models can access them)
  let uploadedFiles = [];
  const uploadErrors = [];
  if (files && files.length) {
    const uploadResults = await Promise.all(files.map(f => uploadFileToLazymanchat(f.path)));
    uploadedFiles = uploadResults.filter(r => r && !r.error);
    for (let i = 0; i < uploadResults.length; i++) {
      if (!uploadResults[i]) uploadErrors.push(files[i].name + ": upload returned null");
      else if (uploadResults[i].error) uploadErrors.push(files[i].name + ": " + uploadResults[i].error);
    }
    // Add lazymanchat file URLs to newUserMessage.files
    input.newUserMessage.files = uploadedFiles.map(uf => ({
      id: uf.id,
      name: uf.name,
      type: uf.type,
      size: uf.size,
      url: uf.lzUrl || uf.url,
      hash: uf.hash,
    }));
  }

  console.log('sendMessage files in newUserMessage:', JSON.stringify(input.newUserMessage.files).slice(0, 300));
  // Run persist and AI call in parallel for new topics
  const persistPromise = trpcMutation('aiChat.sendMessageInServer', input);
  const chatPromise = topicId
    ? null  // for existing topics, we need history first
    : getChatResponse(modelId, buildChatMessages(message, files, uploadedFiles, model.category));

  let persistRes, chatRes;
  if (topicId) {
    // Existing topic: persist + getMessages in parallel, then AI
    const [pRes, history] = await Promise.all([
      persistPromise,
      getMessages(topicId),
    ]);
    persistRes = pRes;
    console.log('sendMessageInServer response:', JSON.stringify(persistRes).slice(0, 300));
    if (persistRes.error) return persistRes;
    const chatMessages = buildChatMessages(message, files, uploadedFiles, model.category);
    if (!history.error && Array.isArray(history)) {
      const recent = history.filter(m => m.role === 'user').slice(-5);
      chatMessages.unshift(...recent.map(m => ({ role: 'user', content: m.content })));
    }
    chatRes = await getChatResponse(modelId, chatMessages);
  } else {
    // New topic: persist and AI in parallel
    const [pRes, cRes] = await Promise.all([persistPromise, chatPromise]);
    persistRes = pRes;
    chatRes = cRes;
    console.log('sendMessageInServer response (new topic):', JSON.stringify(persistRes).slice(0, 300));
    if (persistRes.error) return persistRes;
  }

  const newTopicId = persistRes.topicId || topicId;

  if (userId && newTopicId && !topicId) {
    store.addUserTopic(userId, newTopicId, displayContent.slice(0, 50));
  }

  if (chatRes.error) {
    return {
      topicId: newTopicId,
      reply: '',
      imageUrl: null,
      error: chatRes.error,
      messages: persistRes.messages || [],
      topics: persistRes.topics,
    };
  }

  // Update message asynchronously — don't block response
  if (chatRes.reply || chatRes.imageUrl) {
    const asstMsg = (persistRes.messages || []).find(m => m.role === 'assistant');
    if (asstMsg) {
      const content = chatRes.imageUrl ? `![image](${chatRes.imageUrl})` : chatRes.reply;
      updateMessage(asstMsg.id, content).catch(e => console.error('updateMessage async error:', e.message));
    }
  }

  return {
    topicId: newTopicId,
    reply: chatRes.reply || '',
    imageUrl: chatRes.imageUrl || null,
    messages: persistRes.messages || [],
    topics: persistRes.topics,
  };
}

async function sendMessageStream(modelId, message, topicId, files, onToken, userId) {
  await ensureSession();
  const model = findModel(modelId);
  if (!model) return { error: "Unknown model: " + modelId };

  let displayContent = message || "";
  if (files && files.length) {
    const fileDescs = files.map(f => {
      if (f.type === "image") return "[图片]";
      if (f.type === "video") return "[视频]";
      return "[文件: " + f.name + "]";
    });
    displayContent = displayContent || "发送了文件";
    displayContent += "\n" + fileDescs.join(" ");
  }

  const input = {
    newUserMessage: {
      content: displayContent,
      files: [],
      parentId: null,
      truncatedFiles: null,
    },
    newAssistantMessage: {
      model: model.id,
      provider: model.provider,
    },
  };

  if (topicId) {
    input.newUserMessage.topicId = topicId;
  } else {
    input.newTopic = {
      topicMessageIds: [],
      title: displayContent.slice(0, 50),
    };
  }

  // Upload files to lazymanchat first
  let uploadedFiles = [];
  const uploadErrors = [];
  if (files && files.length) {
    const uploadResults = await Promise.all(files.map(f => uploadFileToLazymanchat(f.path)));
    uploadedFiles = uploadResults.filter(r => r && !r.error);
    for (let i = 0; i < uploadResults.length; i++) {
      if (!uploadResults[i]) uploadErrors.push(files[i].name + ": upload returned null");
      else if (uploadResults[i].error) uploadErrors.push(files[i].name + ": " + uploadResults[i].error);
    }
    input.newUserMessage.files = uploadedFiles.map(uf => ({
      id: uf.id,
      name: uf.name,
      type: uf.type,
      size: uf.size,
      url: uf.lzUrl || uf.url,
      hash: uf.hash,
    }));
  }

  let persistRes, chatResult;
  const chatMessages = buildChatMessages(message, files, uploadedFiles, model.category);

  if (topicId) {
    // Existing topic: persist + getMessages in parallel, then stream AI
    const [pRes, history] = await Promise.all([
      trpcMutation("aiChat.sendMessageInServer", input),
      getMessages(topicId),
    ]);
    persistRes = pRes;
    if (persistRes.error) return persistRes;
    if (!history.error && Array.isArray(history)) {
      const recent = history.filter(m => m.role === "user").slice(-5);
      chatMessages.unshift(...recent.map(m => ({ role: "user", content: m.content })));
    }
    chatResult = await streamChatCompletion(modelId, chatMessages, onToken);
  } else {
    // New topic: persist and AI stream in parallel, tokens flow immediately
    const persistPromise = trpcMutation("aiChat.sendMessageInServer", input);
    const streamPromise = streamChatCompletion(modelId, chatMessages, onToken);
    const [pRes, sRes] = await Promise.all([persistPromise, streamPromise]);
    persistRes = pRes;
    chatResult = sRes;
    if (persistRes.error) return persistRes;
  }

  const newTopicId = persistRes.topicId || topicId;
  if (userId && newTopicId && !topicId) {
    store.addUserTopic(userId, newTopicId, displayContent.slice(0, 50));
  }

  if (chatResult.error) {
    let errMsg = chatResult.error;
    if (uploadErrors.length) errMsg += " | upload: " + uploadErrors.join("; ");
    return {
      topicId: persistRes.topicId || topicId,
      reply: "",
      imageUrl: null,
      error: errMsg,
    };
  }

  // Async update
  let fullText = "";
  // Full text is already streamed — just need image handling
  if (chatResult.imageUrl) {
    const asstMsg = (persistRes.messages || []).find(m => m.role === "assistant");
    if (asstMsg) {
      const content = "![image](" + chatResult.imageUrl + ")";
      updateMessage(asstMsg.id, content).catch(e => console.error("updateMessage async error:", e.message));
    }
  }

  return {
    topicId: persistRes.topicId || topicId,
    reply: "",
    imageUrl: chatResult.imageUrl || null,
    messages: persistRes.messages || [],
  };
}

async function updateMessage(messageId, content) {
  await ensureSession();
  return trpcMutation('message.update', { id: messageId, content, value: { content } });
}

async function initLazymanchat() {
  if (config.lazymanchat.email && config.lazymanchat.password) {
    const ok = await login();
    if (ok) console.log('lazymanchat: session ready');
  } else {
    console.log('lazymanchat: no credentials set, skipping auto-login');
  }
}

module.exports = {
  initLazymanchat,
  getModels,
  getTopics,
  getMessages,
  sendMessage,
  sendMessageStream,
  updateMessage,
  directChatCompletion,
};
