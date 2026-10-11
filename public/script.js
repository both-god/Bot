/* =========================================================
   🕷️ spiderexusX tester — FRONTEND
   Real HTTP requests via backend /api/*
   ========================================================= */

const $ = id => document.getElementById(id);

const logo        = $('logo');
const startBtn    = $('startBtn');
const singleBtn   = $('singleBtn');
const bar         = $('bar');
const phaseText   = $('phaseText');
const pctText     = $('pctText');
const logBox      = $('log');
const globalSt    = $('globalStatus');
const statusText  = $('statusText');

const baselineBox = $('baselineBox');
const tableWrap   = $('tableWrap');
const resultBody  = $('resultBody');
const emptyState  = $('emptyState');
const verdictBox  = $('verdict');
const verdictIcon = $('verdictIcon');
const verdictText = $('verdictText');

const state = { running: false };

/* ---------- Logging ---------- */
function stamp() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
function log(msg, cls = 'dim') {
  const el = document.createElement('div');
  el.className = 'l';
  el.innerHTML = `<span class="t">[${stamp()}]</span><span class="${cls}">${msg}</span>`;
  logBox.appendChild(el);
  logBox.scrollTop = logBox.scrollHeight;
}

/* ---------- Progress / Status ---------- */
function setProgress(pct, phase) {
  bar.style.width = pct + '%';
  pctText.textContent = Math.round(pct) + '%';
  if (phase) phaseText.textContent = phase;
}
function setStatus(text, cls = '') {
  statusText.textContent = text;
  globalSt.className = 'status' + (cls ? ' ' + cls : '');
}

/* ---------- Headers JSON parse ---------- */
function parseHeaders() {
  const raw = $('headers').value.trim();
  if (!raw) return {};
  try { return JSON.parse(raw); }
  catch (e) { log('⚠ Invalid headers JSON — ignoring.', 'warn'); return {}; }
}

/* =========================================================
   TEST SINGLE REQUEST (baseline)
   ========================================================= */
async function testSingle() {
  if (state.running) return;
  state.running = true;
  startBtn.disabled = true;
  singleBtn.disabled = true;
  logo.classList.add('busy');
  setStatus('BASELINE', 'running');

  const baseUrl    = $('baseUrl').value.trim();
  const targetPath = $('targetPath').value.trim() || '/';
  const method     = $('method').value;
  const headers    = parseHeaders();

  log('Testing baseline request...', 'info');
  log(`→ ${method} ${baseUrl}${targetPath}`, 'dim');

  try {
    const res = await fetch('/api/baseline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ baseUrl, targetPath, method, headers })
    }).then(r => r.json());

    if (!res.ok) {
      log(`✖ Baseline failed: ${res.error || 'unknown error'}`, 'bad');
      setStatus('ERROR', 'error');
      logo.classList.remove('busy');
      state.running = false;
      startBtn.disabled = false;
      singleBtn.disabled = false;
      return;
    }

    baselineBox.style.display = 'grid';
    $('baselineStatus').textContent = res.status + ' ' + (res.statusText || '');
    $('baselineLen').textContent    = res.length;
    $('baselineMs').textContent     = res.ms + 'ms';

    const cls = res.status < 400 ? 'ok' : 'warn';
    log(`✔ Baseline: ${res.status} · ${res.length} bytes · ${res.ms}ms`, cls);
    setStatus('BASELINE OK', 'done');
  } catch (err) {
    log(`✖ Network error: ${err.message}`, 'bad');
    setStatus('ERROR', 'error');
  }

  logo.classList.remove('busy');
  state.running = false;
  startBtn.disabled = false;
  singleBtn.disabled = false;
}

/* =========================================================
   FULL SCAN (baseline + bypass vectors)
   ========================================================= */
async function runScan() {
  if (state.running) return;
  state.running = true;
  startBtn.disabled = true;
  singleBtn.disabled = true;
  logo.classList.add('busy');

  // reset
  logBox.innerHTML = '';
  resultBody.innerHTML = '';
  tableWrap.style.display = 'none';
  verdictBox.style.display = 'none';
  emptyState.style.display = 'flex';
  baselineBox.style.display = 'none';
  setProgress(0, 'INITIALIZING');
  setStatus('SCANNING', 'running');

  const baseUrl    = $('baseUrl').value.trim();
  const targetPath = $('targetPath').value.trim() || '/admin';
  const method     = $('method').value;
  const headers    = parseHeaders();
  const delay      = parseInt($('delay').value, 10) || 0;

  if (!baseUrl) {
    log('✖ Base URL is required.', 'bad');
    setStatus('ERROR', 'error');
    resetBtns();
    return;
  }

  log('🕷️ spiderexusX tester initiated.', 'info');
  log(`Target: ${baseUrl}${targetPath}`, 'dim');
  log(`Method: ${method} · Delay: ${delay}ms`, 'dim');
  await sleep(300);

  /* ---------- PHASE 1: baseline ---------- */
  setProgress(8, 'BASELINE');
  log('Fetching baseline response...', 'info');

  let baseline = { status: 0, length: 0 };
  try {
    const res = await fetch('/api/baseline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ baseUrl, targetPath, method, headers })
    }).then(r => r.json());

    if (res.ok) {
      baseline.status = res.status;
      baseline.length = res.length;
      baselineBox.style.display = 'grid';
      $('baselineStatus').textContent = res.status + ' ' + (res.statusText || '');
      $('baselineLen').textContent    = res.length;
      $('baselineMs').textContent     = res.ms + 'ms';

      const cls = res.status < 400 ? 'ok' : 'warn';
      log(`✔ Baseline: ${res.status} · ${res.length} bytes · ${res.ms}ms`, cls);
    } else {
      log(`⚠ Baseline error: ${res.error}`, 'warn');
    }
  } catch (err) {
    log(`⚠ Baseline network error: ${err.message}`, 'warn');
  }
  await sleep(400);

  /* ---------- PHASE 2: scan (server does the work) ---------- */
  setProgress(25, 'SCANNING BYPASS VECTORS');
  log('Launching bypass payload batch...', 'info');

  try {
    const scanRes = await fetch('/api/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        baseUrl,
        targetPath,
        method,
        headers,
        baselineStatus: baseline.status,
        baselineLength: baseline.length,
        delay
      })
    }).then(r => r.json());

    if (!scanRes.ok) {
      log(`✖ Scan failed: ${scanRes.error}`, 'bad');
      setStatus('ERROR', 'error');
      resetBtns();
      return;
    }

    const { results, summary } = scanRes;

    /* ---------- animate rows ---------- */
    emptyState.style.display = 'none';
    tableWrap.style.display = 'block';
    resultBody.innerHTML = '';

    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      const pct = 25 + ((i + 1) / results.length) * 70;
      setProgress(pct, 'SCANNING BYPASS VECTORS');

      const cls = r.verdict === 'bypass'   ? 'warn'
                : r.verdict === 'pass'     ? 'ok'
                : r.verdict === 'redirect' ? 'info'
                : r.verdict === 'diff'     ? 'info'
                : r.verdict === 'error'    ? 'bad'
                : 'dim';

      const label =
        r.verdict === 'bypass'   ? '⚠ BYPASS'   :
        r.verdict === 'pass'     ? '✔ PASS'     :
        r.verdict === 'redirect' ? '↪ REDIRECT' :
        r.verdict === 'diff'     ? '≠ DIFF'     :
        r.verdict === 'error'    ? '✖ ERROR'    :
                                   '✖ BLOCKED';

      log(
        `[${String(i + 1).padStart(2, '0')}/${results.length}] ${r.name.padEnd(20)} → ${r.status || 'ERR'} ${label}`,
        cls
      );

      const tagCls = r.verdict;
      const tr = document.createElement('tr');
      tr.style.animationDelay = (i * 25) + 'ms';
      tr.innerHTML = `
        <td style="color:#3d4d6b">${i + 1}</td>
        <td style="color:#c7d2e5">${escapeHtml(r.name)}</td>
        <td style="color:#a9b6cf;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(r.path)}</td>
        <td style="color:${r.status >= 200 && r.status < 300 ? 'var(--green)' : r.status >= 400 ? 'var(--red)' : 'var(--amber)'}">${r.status || '—'}</td>
        <td style="color:#7b89a6">${r.length || 0}</td>
        <td style="color:#7b89a6">${r.ms}</td>
        <td><span class="tag ${tagCls}">${label}</span></td>
      `;
      resultBody.appendChild(tr);

      await sleep(60);
    }

    /* ---------- summary ---------- */
    setProgress(100, 'COMPLETE');
    $('sTotal').textContent = summary.total;
    $('sPass').textContent  = summary.passed;
    $('sBy').textContent    = summary.bypassed;
    $('sBlock').textContent = summary.blocked;

    verdictBox.style.display = 'flex';
    if (summary.bypassed > 0) {
      verdictBox.className = 'verdict warn';
      verdictIcon.textContent = '⚠';
      verdictText.textContent =
        `PROOF: ${summary.total} vectors tested · ${summary.bypassed} BYPASS · ${summary.passed} pass · ${summary.blocked} blocked`;
      log(`⚠ DONE — ${summary.bypassed} bypass vector(s) succeeded!`, 'warn');
      setStatus('BYPASS FOUND', 'error');
    } else if (summary.passed > 0) {
      verdictBox.className = 'verdict ok';
      verdictIcon.textContent = '✔';
      verdictText.textContent =
        `PROOF: ${summary.total} vectors tested · 0 bypass · ${summary.passed} pass · ${summary.blocked} blocked`;
      log(`✔ DONE — 0 bypass. Target appears hardened.`, 'ok');
      setStatus('COMPLETE', 'done');
    } else {
      verdictBox.className = 'verdict ok';
      verdictIcon.textContent = '✔';
      verdictText.textContent =
        `PROOF: ${summary.total} vectors tested · 0 bypass · all blocked`;
      log(`✔ DONE — All vectors blocked.`, 'ok');
      setStatus('COMPLETE', 'done');
    }

    log(`Summary: ${JSON.stringify(summary)}`, 'info');

  } catch (err) {
    log(`✖ Scan error: ${err.message}`, 'bad');
    setStatus('ERROR', 'error');
  }

  resetBtns();
}

function resetBtns() {
  logo.classList.remove('busy');
  state.running = false;
  startBtn.disabled = false;
  singleBtn.disabled = false;
}

/* ---------- utils ---------- */
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ---------- events ---------- */
startBtn.addEventListener('click', runScan);
singleBtn.addEventListener('click', testSingle);

// Optional: press Enter in inputs to start scan
['baseUrl', 'targetPath'].forEach(id => {
  $(id).addEventListener('keydown', e => { if (e.key === 'Enter') runScan(); });
});