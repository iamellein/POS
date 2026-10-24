const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { validateMealPlan } = require('./engine');

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const MAX_BODY_BYTES = 1_000_000;
const pagePath = path.join(__dirname, 'bloom.html');

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

const server = http.createServer((request, response) => {
  if (request.method === 'GET' && ['/', '/bloom.html', '/lab2.html', '/engine.js'].includes(request.url)) {
    const filePath = request.url === '/engine.js'
      ? path.join(__dirname, 'engine.js')
      : request.url === '/lab2.html'
        ? path.join(__dirname, 'lab2.html')
        : pagePath;
    const contentType = request.url === '/engine.js' ? 'text/javascript; charset=utf-8' : 'text/html; charset=utf-8';
    fs.readFile(filePath, (error, page) => {
      if (error) {
        response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        response.end('Unable to load the lab interface.');
        return;
      }
      response.writeHead(200, { 'Content-Type': contentType });
      response.end(page);
    });
    return;
  }

  if (request.method === 'GET' && request.url.startsWith('/api/wearable/daily')) {
    const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
    const provider = url.searchParams.get('provider') || 'googleFit';
    const date = url.searchParams.get('date') || new Date().toISOString().slice(0, 10);
    const parsedDate = new Date(`${date}T00:00:00.000Z`);
    if (!['googleFit', 'appleHealth'].includes(provider)) {
      sendJson(response, 400, { error: 'Provider must be googleFit or appleHealth.' });
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) {
      sendJson(response, 400, { error: 'Date must be a valid YYYY-MM-DD calendar date.' });
      return;
    }
    const providerLabel = provider === 'googleFit' ? 'Google Fit' : 'Apple Health';
    sendJson(response, 200, {
      provider,
      providerLabel,
      date,
      steps: provider === 'googleFit' ? 8426 : 7914,
      activeEnergyKcal: provider === 'googleFit' ? 438 : 412,
      syncedAt: new Date().toISOString(),
      source: 'mock',
    });
    return;
  }

  if (request.method !== 'POST' || request.url !== '/api/validate') {
    sendJson(response, 404, { error: 'Route not found.' });
    return;
  }

  let body = '';
  request.setEncoding('utf8');
  request.on('data', chunk => {
    body += chunk;
    if (Buffer.byteLength(body, 'utf8') > MAX_BODY_BYTES) {
      sendJson(response, 413, { error: 'Request body is too large.' });
      request.destroy();
    }
  });
  request.on('end', () => {
    if (response.writableEnded) return;
    try {
      const input = JSON.parse(body);
      sendJson(response, 200, validateMealPlan(input));
    } catch (error) {
      sendJson(response, 400, { error: error instanceof SyntaxError ? 'Request body must be valid JSON.' : error.message });
    }
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Policy rule engine ready at http://localhost:${PORT}`);
  console.log('To open it from another device on the same Wi-Fi, use this computer\'s LAN IP and the same port.');
});