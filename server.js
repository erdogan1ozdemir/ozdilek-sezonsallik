// Simple static server for Seasonal Keyword Dashboard (Railway deploy)
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
// Railway container networking requires binding to 0.0.0.0;
// default IPv6 localhost binding causes healthchecks to fail.
const HOST = process.env.HOST || '0.0.0.0';

// Serve all project files as static
app.use(express.static(__dirname, {
  extensions: ['html'],
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.jsx')) res.setHeader('Content-Type', 'text/babel; charset=utf-8');
    if (filePath.endsWith('.svg')) res.setHeader('Content-Type', 'image/svg+xml');
  }
}));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Healthcheck for Railway
app.get('/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, HOST, () => {
  console.log(`[seasonal-keyword-dashboard] serving on ${HOST}:${PORT}`);
});
