require('dotenv').config();
const path = require('path');
const express = require('express');
const config = require('./config');
const { initStore } = require('./store');
const { initLazymanchat } = require('./lazymanchat');
const routes = require('./routes');

const app = express();
app.use(express.json({ limit: '50mb' }));

app.use((req, res, next) => {
  req.userId = req.headers['x-user-id'] || '';
  next();
});

app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));
app.use('/api', routes);

async function start() {
  initStore();
  initLazymanchat().catch((err) => {
    console.error('lazymanchat init failed:', err.message);
  });
  app.listen(config.port, () => {
    console.log(`Lookmore server running on port ${config.port}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
