const path = require('path');

const config = {
  port: parseInt(process.env.PORT, 10) || 3000,
  lazymanchat: {
    baseUrl: process.env.LAZYMANCHAT_BASE_URL || 'https://lazymanchat.com',
    email: process.env.LAZYMANCHAT_EMAIL || '',
    password: process.env.LAZYMANCHAT_PASSWORD || '',
    authToken: process.env.LAZYMANCHAT_AUTH_TOKEN || '',
  },
  ai: {
    apiKey: process.env.AI_API_KEY || '',
    baseUrl: process.env.AI_BASE_URL || 'https://api.openai.com/v1',
    model: process.env.AI_MODEL || 'gpt-5.5',
  },
  chatgpt: {
    email: process.env.CHATGPT_EMAIL || '',
    password: process.env.CHATGPT_PASSWORD || '',
  },
  dataDir: path.resolve(__dirname, process.env.DATA_DIR || './data'),
};

module.exports = config;
