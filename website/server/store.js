const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'data', 'user-conversations.json');
let store = {};

function initStore() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      store = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch (e) {
    store = {};
  }
}

function saveStore() {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2));
}

function getUserTopics(userId) {
  return store[userId] || {};
}

function addUserTopic(userId, topicId, title) {
  if (!userId || !topicId) return;
  if (!store[userId]) store[userId] = {};
  store[userId][topicId] = title || '';
  saveStore();
}

function removeUserTopic(userId, topicId) {
  if (store[userId]) {
    delete store[userId][topicId];
    saveStore();
  }
}

function userOwnsTopic(userId, topicId) {
  return !!(store[userId] && store[userId][topicId]);
}

module.exports = {
  initStore,
  getUserTopics,
  addUserTopic,
  removeUserTopic,
  userOwnsTopic,
};
