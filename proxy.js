// proxy.js — запуск: node proxy.js
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;

function log(...args) {
  console.log(new Date().toISOString().slice(11,19), ...args);
}

function proxyToBitrix(webhook, method, params) {
  return new Promise((resolve, reject) => {
    const base = webhook.endsWith('/') ? webhook : webhook + '/';
    const targetUrl = base + method;
    log('→ B24:', targetUrl);

    let parsed;
    try { parsed = new URL(targetUrl); }
    catch(e) { return reject(new Error('Некорректный URL: ' + targetUrl)); }

    const body = JSON.stringify(params || {});
    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + (parsed.search || ''),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'User-Agent': 'DupeHunter/1.0',
      },
    };

    log('→ host=' + options.hostname + ' path=' + options.path);

    const transport = parsed.protocol === 'https:' ? https : http;
    const req = transport.request(options, (res) => {
      log('← HTTP', res.statusCode);
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        log('← body:', data.slice(0, 150));
        if (res.statusCode === 404) {
          return reject(new Error('404 от Битрикс24. URL запроса: ' + targetUrl + ' — проверьте вебхук'));
        }
        if (res.statusCode >= 400) {
          return reject(new Error('Битрикс24 HTTP ' + res.statusCode + ': ' + data.slice(0,200)));
        }
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(new Error('Некорректный JSON: ' + data.slice(0,200))); }
      });
    });

    req.on('error', e => { log('✗ Сеть:', e.message); reject(e); });
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Timeout')); });
    req.write(body);
    req.end();
  });
}

const server = http.createServer(async (req, res) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (req.method === 'OPTIONS') { res.writeHead(200, cors); res.end(); return; }

  const parsedUrl = url.parse(req.url);

  // ── ПРОКСИ ──────────────────────────────────────────────────
  if (parsedUrl.pathname === '/b24proxy' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      let parsed;
      try { parsed = JSON.parse(body); }
      catch(e) {
        res.writeHead(400, {...cors,'Content-Type':'application/json'});
        res.end(JSON.stringify({error:'Invalid JSON body'}));
        return;
      }

      const { webhook, method, params } = parsed;
      if (!webhook || !method) {
        res.writeHead(400, {...cors,'Content-Type':'application/json'});
        res.end(JSON.stringify({error:'webhook and method required'}));
        return;
      }

      // Проверяем только что это http(s) URL с /rest/ — поддерживаем любые домены
      if (!webhook.startsWith('http') || !webhook.includes('/rest/')) {
        res.writeHead(403, {...cors,'Content-Type':'application/json'});
        res.end(JSON.stringify({error:'URL должен содержать /rest/ — это не вебхук Битрикс24'}));
        return;
      }

      try {
        const result = await proxyToBitrix(webhook, method, params);
        res.writeHead(200, {...cors,'Content-Type':'application/json'});
        res.end(JSON.stringify(result));
      } catch(e) {
        log('✗ Прокси ошибка:', e.message);
        res.writeHead(502, {...cors,'Content-Type':'application/json'});
        res.end(JSON.stringify({error: e.message}));
      }
    });
    return;
  }

  // ── HEALTH CHECK ─────────────────────────────────────────────
  if (parsedUrl.pathname === '/health') {
    res.writeHead(200, {...cors,'Content-Type':'application/json'});
    res.end(JSON.stringify({status:'ok', port: PORT, time: new Date().toISOString()}));
    return;
  }

  // ── СТАТИКА ──────────────────────────────────────────────────
  let filePath = parsedUrl.pathname === '/' ? '/index.html' : parsedUrl.pathname;
  filePath = path.join(__dirname, filePath);
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404, cors); res.end('Not found: ' + parsedUrl.pathname); return; }
    const mime = {'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css'};
    const ext = path.extname(filePath);
    res.writeHead(200, {...cors,'Content-Type': mime[ext]||'text/plain'});
    res.end(data);
  });
});

server.listen(PORT, () => {
  log('✅ DupeHunter запущен, порт', PORT);
  log('   Приложение: http://localhost:' + PORT);
  log('   Health:     http://localhost:' + PORT + '/health');
});
